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

function toGrams(v: number, u: string): number {
  if (u === 'KILOGRAMS') return v * 1000;
  if (u === 'POUNDS') return v * 453.592;
  if (u === 'OUNCES') return v * 28.3495;
  return v;
}

// ───────────────────────────────────────────
// Part 1: 50g 미만 상품 리스트
// ───────────────────────────────────────────

const ALL_QUERY = `
  query All($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          title handle
          variants(first: 1) {
            edges {
              node {
                title
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

// ───────────────────────────────────────────
// Part 2: Boogie 1300g 고정 후 엑셀 재비교
// ───────────────────────────────────────────

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
                }
              }
            }
          }
        }
      }
    }
  }
`;

async function main() {
  const token = await getAccessToken();

  // ═══ Part 1: 50g 미만 상품 ═══
  console.log('전체 상품 조회 중...');
  const lightProducts: { title: string; weightG: number; volG: number; dims: string; ratio: number }[] = [];
  let after: string | null = null;

  while (true) {
    const data = await adminGraphQL(token, ALL_QUERY, { first: 50, after });
    const edges = data.data?.products?.edges || [];
    for (const { node: p } of edges) {
      const v = p.variants?.edges?.[0]?.node;
      const w = v?.inventoryItem?.measurement?.weight;
      const weightG = w ? toGrams(w.value, w.unit) : 0;
      if (weightG <= 0 || weightG >= 50) continue;

      const dims: Record<string, number> = {};
      for (const { node: mf } of (p.metafields?.edges || [])) {
        if (mf.namespace === 'shipping') {
          const val = parseFloat(mf.value);
          if (!isNaN(val)) dims[mf.key] = val;
        }
      }

      let volG = 0;
      let dimsStr = '-';
      let ratio = 0;
      if (dims.width && dims.depth && dims.height) {
        const volCm3 = (dims.width / 10) * (dims.depth / 10) * (dims.height / 10);
        volG = Math.round(volCm3 / 5);
        dimsStr = `${dims.width}×${dims.depth}×${dims.height}`;
        ratio = volG / weightG;
      }

      lightProducts.push({ title: p.title, weightG, volG, dims: dimsStr, ratio });
    }
    if (!data.data?.products?.pageInfo?.hasNextPage) break;
    after = data.data.products.pageInfo.endCursor;
  }

  lightProducts.sort((a, b) => a.weightG - b.weightG);

  console.log('\n' + '═'.repeat(100));
  console.log(`📋 실중량 50g 미만 상품 리스트 (총 ${lightProducts.length}개)`);
  console.log('═'.repeat(100));
  console.log(
    '상품명'.padEnd(45) +
    '실중량'.padEnd(9) +
    '치수(mm)'.padEnd(20) +
    '부피중량'.padEnd(9) +
    '부피÷실중량'
  );
  console.log('─'.repeat(100));

  for (const p of lightProducts) {
    const name = p.title.length > 43 ? p.title.slice(0, 40) + '...' : p.title;
    console.log(
      name.padEnd(45) +
      `${p.weightG}g`.padEnd(9) +
      p.dims.padEnd(20) +
      (p.volG > 0 ? `${p.volG}g` : '-').padEnd(9) +
      (p.ratio > 0 ? `×${p.ratio.toFixed(1)}` : '-')
    );
  }

  // ═══ Part 2: Boogie 1300g 고정 후 엑셀 재비교 ═══
  const wb = XLSX.readFile('C:/Users/User/Desktop/쇼피파이_실중량.xlsx');
  const rawRows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  const dataRows = rawRows.slice(1).filter((r: any[]) => r[0]);

  console.log('\n\n' + '═'.repeat(105));
  console.log('📊 Jumping Boogie = 1300g 고정 후 엑셀 비교');
  console.log('═'.repeat(105));
  console.log(
    '주문'.padEnd(7) +
    '엑셀실중량'.padEnd(11) +
    '엑셀부피중량'.padEnd(12) +
    '과금중량'.padEnd(11) +
    'Shopify'.padEnd(11) +
    'Boogie보정'.padEnd(12) +
    '보정후÷과금'.padEnd(11) +
    'Boogie수량'
  );
  console.log('─'.repeat(105));

  interface Result {
    orderNum: number;
    billing: number;
    shopifyOriginal: number;
    shopifyCorrected: number;
    ratio: number;
    boogieQty: number;
  }

  const results: Result[] = [];
  const seen = new Set<string>();

  for (const row of dataRows) {
    const orderNum = Number(row[0]);
    const excelActual = Number(row[1]);
    const excelVolume = Number(row[2]);
    const billing = Math.max(excelActual, excelVolume);
    const key = `${orderNum}-${excelActual}-${excelVolume}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const data = await adminGraphQL(token, ORDER_QUERY, { query: `name:#${orderNum}` });
    const order = data.data?.orders?.edges?.[0]?.node;
    if (!order) continue;

    let shopifyOriginal = 0;
    let boogieQty = 0;

    for (const { node: item } of order.lineItems.edges) {
      const w = item.variant?.inventoryItem?.measurement?.weight;
      const g = w ? toGrams(w.value, w.unit) : 0;

      if (/jumping.*boogie/i.test(item.title)) {
        boogieQty += item.quantity;
        shopifyOriginal += g * item.quantity;
      } else {
        shopifyOriginal += g * item.quantity;
      }
    }

    // Boogie를 1300g으로 고정
    let shopifyCorrected = 0;
    for (const { node: item } of order.lineItems.edges) {
      const w = item.variant?.inventoryItem?.measurement?.weight;
      const g = w ? toGrams(w.value, w.unit) : 0;

      if (/jumping.*boogie/i.test(item.title)) {
        shopifyCorrected += 1300 * item.quantity;
      } else {
        shopifyCorrected += g * item.quantity;
      }
    }

    const ratio = billing > 0 && shopifyCorrected > 0 ? billing / shopifyCorrected : 0;
    results.push({ orderNum, billing, shopifyOriginal: Math.round(shopifyOriginal), shopifyCorrected: Math.round(shopifyCorrected), ratio, boogieQty });

    await new Promise(r => setTimeout(r, 200));
  }

  for (const r of results) {
    const changed = r.boogieQty > 0;
    console.log(
      `#${String(r.orderNum).padEnd(6)}` +
      `${r.billing > r.shopifyOriginal ? '' : ''}${(results.find(x => x.orderNum === r.orderNum)!.billing === Math.max(Number(dataRows.find(d => Number(d[0]) === r.orderNum)?.[1] || 0), Number(dataRows.find(d => Number(d[0]) === r.orderNum)?.[2] || 0)) ? '' : '')}`.padEnd(0) +
      `${dataRows.find(d => Number(d[0]) === r.orderNum)?.[1] || '-'}g`.padEnd(11) +
      `${dataRows.find(d => Number(d[0]) === r.orderNum)?.[2] || '-'}g`.padEnd(12) +
      `${r.billing}g`.padEnd(11) +
      `${r.shopifyOriginal}g`.padEnd(11) +
      `${r.shopifyCorrected}g`.padEnd(12) +
      `×${r.ratio.toFixed(2)}`.padEnd(11) +
      (changed ? `×${r.boogieQty}` : '-')
    );
  }

  // 통계
  const clean = results.filter(r => r.ratio > 0 && r.ratio < 50);
  const withBoogie = clean.filter(r => r.boogieQty > 0);
  const withoutBoogie = clean.filter(r => r.boogieQty === 0);
  const ratios = clean.map(r => r.ratio).sort((a, b) => a - b);

  const avg = ratios.reduce((s, v) => s + v, 0) / ratios.length;
  const med = ratios[Math.floor(ratios.length / 2)];
  const p75 = ratios[Math.floor(ratios.length * 0.75)];
  const p90 = ratios[Math.floor(ratios.length * 0.90)];

  console.log('\n' + '═'.repeat(70));
  console.log('📈 Boogie 1300g 보정 후 배율 통계 (과금중량 ÷ Shopify 보정)');
  console.log('═'.repeat(70));
  console.log(`  전체 ${clean.length}건: 평균 ×${avg.toFixed(2)} / 중앙 ×${med.toFixed(2)} / p75 ×${p75.toFixed(2)} / p90 ×${p90.toFixed(2)}`);

  if (withBoogie.length > 0) {
    const bRatios = withBoogie.map(r => r.ratio).sort((a, b) => a - b);
    const bAvg = bRatios.reduce((s, v) => s + v, 0) / bRatios.length;
    console.log(`  Boogie 포함 ${withBoogie.length}건: 평균 ×${bAvg.toFixed(2)}`);
  }
  if (withoutBoogie.length > 0) {
    const nRatios = withoutBoogie.map(r => r.ratio).sort((a, b) => a - b);
    const nAvg = nRatios.reduce((s, v) => s + v, 0) / nRatios.length;
    console.log(`  Boogie 미포함 ${withoutBoogie.length}건: 평균 ×${nAvg.toFixed(2)}`);
  }

  // 커버율
  console.log('\n' + '═'.repeat(60));
  console.log('🔢 Boogie 1300g 보정 후 — 배율별 커버율');
  console.log('═'.repeat(60));
  for (const mult of [1.0, 1.2, 1.5, 1.8, 2.0, 2.5, 3.0, 3.5]) {
    let covered = 0;
    for (const r of clean) {
      if (r.shopifyCorrected * mult >= r.billing) covered++;
    }
    const pct = ((covered / clean.length) * 100).toFixed(0);
    const bar = '█'.repeat(Math.round(covered / clean.length * 30));
    console.log(`  ×${mult.toFixed(1)} → ${pct.padStart(3)}% (${covered}/${clean.length}) ${bar}`);
  }
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
