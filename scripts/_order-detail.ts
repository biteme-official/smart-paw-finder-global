import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env.local') });

const STORE_DOMAIN = process.env.VITE_SHOPIFY_STORE_DOMAIN!;
const CLIENT_ID = process.env.VITE_SHOPIFY_CLIENT_ID!;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET!;
const API_VERSION = '2025-07';

async function getAccessToken(): Promise<string> {
  const res = await fetch(`https://${STORE_DOMAIN}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  });
  return (await res.json()).access_token;
}

async function adminGraphQL(token: string, query: string, variables: Record<string, unknown> = {}) {
  const res = await fetch(`https://${STORE_DOMAIN}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

const ORDER_QUERY = `
  query OrderByNumber($query: String!) {
    orders(first: 1, query: $query) {
      edges {
        node {
          id name createdAt
          lineItems(first: 50) {
            edges {
              node {
                title quantity
                variant {
                  title
                  inventoryItem {
                    measurement { weight { value unit } }
                  }
                  product {
                    id title handle
                    metafields(first: 30) {
                      edges {
                        node { namespace key value }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

function toGrams(value: number, unit: string): number {
  switch (unit) {
    case 'KILOGRAMS': return value * 1000;
    case 'POUNDS': return value * 453.592;
    case 'OUNCES': return value * 28.3495;
    default: return value;
  }
}

async function main() {
  const token = await getAccessToken();
  const data = await adminGraphQL(token, ORDER_QUERY, { query: 'name:#1314' });
  const order = data.data?.orders?.edges?.[0]?.node;
  if (!order) { console.log('주문 없음'); return; }

  console.log(`\n📦 주문 #1314 — 상품별 중량/부피 상세`);
  console.log('═'.repeat(100));
  console.log(
    '상품명'.padEnd(42) +
    '수량'.padEnd(5) +
    'W(mm)'.padEnd(8) +
    'D(mm)'.padEnd(8) +
    'H(mm)'.padEnd(8) +
    '부피(cm³)'.padEnd(11) +
    '실중량(g)'.padEnd(11) +
    '부피중량(g)'
  );
  console.log('─'.repeat(100));

  let totalActualG = 0;
  let totalVolCm3 = 0;
  let totalVolWeightG = 0;
  let missingDims: string[] = [];

  for (const { node: item } of order.lineItems.edges) {
    const v = item.variant;
    const qty = item.quantity;
    const vTitle = v?.title !== 'Default Title' ? ` (${v?.title})` : '';
    const name = `${item.title}${vTitle}`;
    const shortName = name.length > 40 ? name.slice(0, 37) + '...' : name;

    // 중량
    const w = v?.inventoryItem?.measurement?.weight;
    const unitG = w ? toGrams(w.value, w.unit) : 0;
    const itemActualG = unitG * qty;
    totalActualG += itemActualG;

    // 치수 (shipping metafields, 단위: mm)
    const mfs = v?.product?.metafields?.edges || [];
    const dims: Record<string, number> = {};
    for (const { node: mf } of mfs) {
      if (mf.namespace === 'shipping') {
        const val = parseFloat(mf.value);
        if (!isNaN(val)) dims[mf.key] = val;
      }
    }

    const widthMm = dims['width'] || 0;
    const depthMm = dims['depth'] || 0;
    const heightMm = dims['height'] || 0;
    const hasDims = widthMm > 0 && depthMm > 0 && heightMm > 0;

    // 부피 계산: mm → cm 변환 후 cm³
    const volCm3Unit = hasDims ? (widthMm / 10) * (depthMm / 10) * (heightMm / 10) : 0;
    const volCm3Total = volCm3Unit * qty;
    totalVolCm3 += volCm3Total;

    // 부피중량: cm³ / 5000 = kg → g로 변환
    const volWeightGUnit = hasDims ? volCm3Unit / 5 : 0; // cm³/5000*1000 = cm³/5
    const volWeightGTotal = volWeightGUnit * qty;
    totalVolWeightG += volWeightGTotal;

    if (!hasDims) missingDims.push(name);

    console.log(
      shortName.padEnd(42) +
      `×${qty}`.padEnd(5) +
      (hasDims ? String(widthMm) : '-').padEnd(8) +
      (hasDims ? String(depthMm) : '-').padEnd(8) +
      (hasDims ? String(heightMm) : '-').padEnd(8) +
      (hasDims ? volCm3Total.toFixed(0) : '-').padEnd(11) +
      String(itemActualG).padEnd(11) +
      (hasDims ? volWeightGTotal.toFixed(0) : '-')
    );
  }

  console.log('─'.repeat(100));
  console.log(
    '합계'.padEnd(42) +
    ''.padEnd(29) +
    String(totalVolCm3.toFixed(0)).padEnd(11) +
    String(totalActualG).padEnd(11) +
    String(totalVolWeightG.toFixed(0))
  );

  // 엑셀 기준값
  const excelActual = 2300;
  const excelVolume = 3058;

  console.log('\n' + '═'.repeat(70));
  console.log('📊 Shopify 계산 vs 엑셀 실측 비교');
  console.log('═'.repeat(70));
  console.log(`${''.padEnd(20)}${'Shopify 계산'.padEnd(18)}${'엑셀 실측'.padEnd(18)}${'차이'}`);
  console.log('─'.repeat(70));
  console.log(
    `${'실중량(g)'.padEnd(20)}` +
    `${String(totalActualG).padEnd(18)}` +
    `${String(excelActual).padEnd(18)}` +
    `${totalActualG - excelActual >= 0 ? '+' : ''}${totalActualG - excelActual}g (${((totalActualG - excelActual) / excelActual * 100).toFixed(1)}%)`
  );
  console.log(
    `${'부피중량(g)'.padEnd(20)}` +
    `${String(totalVolWeightG.toFixed(0)).padEnd(18)}` +
    `${String(excelVolume).padEnd(18)}` +
    `${totalVolWeightG - excelVolume >= 0 ? '+' : ''}${(totalVolWeightG - excelVolume).toFixed(0)}g (${((totalVolWeightG - excelVolume) / excelVolume * 100).toFixed(1)}%)`
  );

  const shopifyBilling = Math.max(totalActualG, totalVolWeightG);
  console.log(
    `\n${'과금중량(g)'.padEnd(20)}` +
    `${String(shopifyBilling.toFixed(0)).padEnd(18)}` +
    `${String(excelVolume).padEnd(18)}` +
    `${shopifyBilling - excelVolume >= 0 ? '+' : ''}${(shopifyBilling - excelVolume).toFixed(0)}g (${((shopifyBilling - excelVolume) / excelVolume * 100).toFixed(1)}%)`
  );

  console.log(`\n  → Shopify 과금중량 = max(${totalActualG}g, ${totalVolWeightG.toFixed(0)}g) = ${shopifyBilling.toFixed(0)}g`);
  console.log(`  → 엑셀 과금중량 = max(${excelActual}g, ${excelVolume}g) = ${excelVolume}g`);

  if (missingDims.length > 0) {
    console.log(`\n  ⚠ 치수 미등록 상품:`);
    missingDims.forEach(n => console.log(`    - ${n}`));
  }

  // 참고: 부피중량은 개별 상품 합산 vs 실제 박스 기준 차이 설명
  console.log('\n' + '═'.repeat(70));
  console.log('💡 참고');
  console.log('─'.repeat(70));
  console.log('  Shopify 부피중량 = 개별 상품 shipping 치수 합산 (상품별 부피 → 합계)');
  console.log('  엑셀 부피중량 = 실제 발송 박스 외형 치수 기준');
  console.log('  → 합포장 시 실제 박스가 개별 합산보다 클 수 있음 (빈 공간, 완충재)');
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
