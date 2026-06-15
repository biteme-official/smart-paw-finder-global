import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env.local') });

const STORE_DOMAIN = process.env.VITE_SHOPIFY_STORE_DOMAIN!;
const CLIENT_ID = process.env.VITE_SHOPIFY_CLIENT_ID!;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET!;

async function getAccessToken(): Promise<string> {
  const res = await fetch(`https://${STORE_DOMAIN}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  });
  return (await res.json()).access_token;
}

async function adminGraphQL(token: string, query: string, variables: Record<string, unknown> = {}) {
  const res = await fetch(`https://${STORE_DOMAIN}/admin/api/2025-07/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

const PRODUCT_QUERY = `
  query ProductsByTitle($query: String!) {
    products(first: 5, query: $query) {
      edges {
        node {
          title handle
          variants(first: 10) {
            edges {
              node {
                title
                inventoryItem { measurement { weight { value unit } } }
              }
            }
          }
          metafields(first: 30) {
            edges {
              node { namespace key value }
            }
          }
        }
      }
    }
  }
`;

const ORDER_QUERY = `
  query Order($query: String!) {
    orders(first: 1, query: $query) {
      edges {
        node {
          name
          lineItems(first: 50) {
            edges {
              node {
                title quantity
                variant {
                  title
                  inventoryItem { measurement { weight { value unit } } }
                  product {
                    title
                    metafields(first: 30) {
                      edges { node { namespace key value } }
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

function toGrams(v: number, u: string): number {
  if (u === 'KILOGRAMS') return v * 1000;
  return v;
}

function getShippingDims(mfs: any[]): { w: number; d: number; h: number } | null {
  const dims: Record<string, number> = {};
  for (const { node: mf } of mfs) {
    if (mf.namespace === 'shipping') {
      const val = parseFloat(mf.value);
      if (!isNaN(val)) dims[mf.key] = val;
    }
  }
  if (dims.width && dims.depth && dims.height) {
    return { w: dims.width, d: dims.depth, h: dims.height };
  }
  return null;
}

async function main() {
  const token = await getAccessToken();

  // 1) 부피 대형 3개 상품 조회
  const targets = ['Jumping Boogie', 'Braining Spin Bunny', 'Braining Spin Squirrel'];
  const queries = ['Jumping Boogie', 'Braining Bunny', 'Braining Squirrel'];

  console.log('═'.repeat(90));
  console.log('📦 부피 대형 상품 3종 — 중량 vs 부피 비교');
  console.log('═'.repeat(90));

  for (const q of queries) {
    const data = await adminGraphQL(token, PRODUCT_QUERY, { query: q });
    const products = data.data?.products?.edges || [];

    for (const { node: p } of products) {
      if (!/jumping boogie|braining.*spin/i.test(p.title)) continue;

      const dims = getShippingDims(p.metafields?.edges || []);
      const variant = p.variants?.edges?.[0]?.node;
      const w = variant?.inventoryItem?.measurement?.weight;
      const weightG = w ? toGrams(w.value, w.unit) : 0;

      console.log(`\n  📌 ${p.title}`);
      console.log(`     실중량: ${weightG}g`);

      if (dims) {
        const volCm3 = (dims.w / 10) * (dims.d / 10) * (dims.h / 10);
        const volWeightG = volCm3 / 5;
        const ratio = volWeightG / weightG;
        console.log(`     치수: ${dims.w} × ${dims.d} × ${dims.h} mm`);
        console.log(`     부피: ${volCm3.toFixed(0)} cm³`);
        console.log(`     부피중량: ${volWeightG.toFixed(0)}g`);
        console.log(`     부피÷실중량: ×${ratio.toFixed(1)} (부피가 ${ratio.toFixed(1)}배 큼)`);
      } else {
        console.log(`     치수: 미등록`);
      }
    }
    await new Promise(r => setTimeout(r, 200));
  }

  // 2) 엑셀 주문 중 이 3개 포함 주문에서 부피 기여도 분석
  const wb = XLSX.readFile('C:/Users/User/Desktop/쇼피파이_실중량.xlsx');
  const rawRows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  const orderNums = [...new Set(rawRows.slice(1).filter((r: any[]) => r[0]).map((r: any[]) => Number(r[0])))];
  const excelMap = new Map<number, { actual: number; volume: number }>();
  for (const row of rawRows.slice(1)) {
    if (!row[0]) continue;
    const n = Number(row[0]);
    if (!excelMap.has(n)) excelMap.set(n, { actual: Number(row[1]), volume: Number(row[2]) });
  }

  console.log('\n\n' + '═'.repeat(90));
  console.log('📊 부피 대형 상품 포함 주문별 — 대형상품 기여도');
  console.log('═'.repeat(90));
  console.log(
    '주문'.padEnd(7) +
    '엑셀실중량'.padEnd(11) +
    '엑셀부피중량'.padEnd(12) +
    '대형상품'.padEnd(30) +
    '수량'.padEnd(5) +
    '대형중량'.padEnd(10) +
    '중량비중'
  );
  console.log('─'.repeat(90));

  const bulkyPattern = /jumping.*boogie|braining.*spin.*snack/i;

  for (const num of orderNums) {
    const data = await adminGraphQL(token, ORDER_QUERY, { query: `name:#${num}` });
    const order = data.data?.orders?.edges?.[0]?.node;
    if (!order) continue;

    const bulkyItems: { name: string; qty: number; g: number }[] = [];
    let totalOrderG = 0;

    for (const { node: item } of order.lineItems.edges) {
      const w = item.variant?.inventoryItem?.measurement?.weight;
      const g = w ? toGrams(w.value, w.unit) * item.quantity : 0;
      totalOrderG += g;

      if (bulkyPattern.test(item.title)) {
        const vt = item.variant?.title !== 'Default Title' ? ` (${item.variant?.title})` : '';
        bulkyItems.push({ name: `${item.title}${vt}`.slice(0, 28), qty: item.quantity, g });
      }
    }

    if (bulkyItems.length > 0) {
      const excel = excelMap.get(num);
      for (const b of bulkyItems) {
        const pct = excel ? ((b.g / excel.actual) * 100).toFixed(0) : '-';
        console.log(
          `#${String(num).padEnd(6)}` +
          `${excel ? excel.actual + 'g' : '-'}`.padEnd(11) +
          `${excel ? excel.volume + 'g' : '-'}`.padEnd(12) +
          b.name.padEnd(30) +
          `×${b.qty}`.padEnd(5) +
          `${b.g}g`.padEnd(10) +
          `${pct}%`
        );
      }
    }
    await new Promise(r => setTimeout(r, 200));
  }

  // 3) 전체 상품 부피÷실중량 배율 TOP 20 (치수 등록된 것만)
  console.log('\n\n' + '═'.repeat(90));
  console.log('📈 전체 상품 부피÷실중량 배율 TOP 20 (부피가 실중량 대비 큰 순)');
  console.log('═'.repeat(90));

  const ALL_QUERY = `
    query All($first: Int!, $after: String) {
      products(first: $first, after: $after) {
        pageInfo { hasNextPage endCursor }
        edges {
          node {
            title
            variants(first: 1) {
              edges {
                node {
                  inventoryItem { measurement { weight { value unit } } }
                }
              }
            }
            metafields(first: 30) {
              edges { node { namespace key value } }
            }
          }
        }
      }
    }
  `;

  const allProducts: { title: string; weightG: number; volG: number; ratio: number; dims: string }[] = [];
  let after: string | null = null;

  while (true) {
    const data = await adminGraphQL(token, ALL_QUERY, { first: 50, after });
    const edges = data.data?.products?.edges || [];
    for (const { node: p } of edges) {
      const dims = getShippingDims(p.metafields?.edges || []);
      const v = p.variants?.edges?.[0]?.node;
      const w = v?.inventoryItem?.measurement?.weight;
      const weightG = w ? toGrams(w.value, w.unit) : 0;
      if (!dims || weightG === 0) continue;

      const volCm3 = (dims.w / 10) * (dims.d / 10) * (dims.h / 10);
      const volG = volCm3 / 5;
      allProducts.push({
        title: p.title,
        weightG,
        volG: Math.round(volG),
        ratio: volG / weightG,
        dims: `${dims.w}×${dims.d}×${dims.h}`,
      });
    }
    if (!data.data?.products?.pageInfo?.hasNextPage) break;
    after = data.data.products.pageInfo.endCursor;
  }

  allProducts.sort((a, b) => b.ratio - a.ratio);

  console.log(
    '순위'.padEnd(5) +
    '상품명'.padEnd(42) +
    '치수(mm)'.padEnd(18) +
    '실중량'.padEnd(9) +
    '부피중량'.padEnd(9) +
    '배율'
  );
  console.log('─'.repeat(90));

  for (let i = 0; i < Math.min(20, allProducts.length); i++) {
    const p = allProducts[i];
    const name = p.title.length > 40 ? p.title.slice(0, 37) + '...' : p.title;
    console.log(
      `${String(i + 1).padEnd(5)}` +
      `${name.padEnd(42)}` +
      `${p.dims.padEnd(18)}` +
      `${p.weightG + 'g'}`.padEnd(9) +
      `${p.volG + 'g'}`.padEnd(9) +
      `×${p.ratio.toFixed(1)}`
    );
  }
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
