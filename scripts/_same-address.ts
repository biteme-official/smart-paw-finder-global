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

const ORDER_QUERY = `
  query Order($query: String!) {
    orders(first: 1, query: $query) {
      edges {
        node {
          name createdAt
          shippingAddress {
            name address1 address2 city province country zip phone
          }
          customer { displayName email }
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

function toGrams(v: number, u: string): number {
  if (u === 'KILOGRAMS') return v * 1000;
  if (u === 'POUNDS') return v * 453.592;
  if (u === 'OUNCES') return v * 28.3495;
  return v;
}

function addrKey(addr: any): string {
  if (!addr) return '';
  return [addr.name, addr.address1, addr.address2, addr.city, addr.province, addr.country, addr.zip]
    .map(s => (s || '').trim().toLowerCase())
    .join('|');
}

async function main() {
  const wb = XLSX.readFile('C:/Users/User/Desktop/쇼피파이_실중량.xlsx');
  const rawRows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  const seen = new Set<number>();
  const dataRows: { num: number; actual: number; volume: number }[] = [];
  for (const row of rawRows.slice(1)) {
    if (!row[0]) continue;
    const num = Number(row[0]);
    if (seen.has(num)) continue;
    seen.add(num);
    dataRows.push({ num, actual: Number(row[1]), volume: Number(row[2]) });
  }

  const token = await getAccessToken();

  // 1) #1280 배송지 조회
  console.log('═'.repeat(100));
  console.log('🔍 #1280 주문 상세 + 동일 배송지 합배송 분석');
  console.log('═'.repeat(100));

  const target1280 = await adminGraphQL(token, ORDER_QUERY, { query: 'name:#1280' });
  const order1280 = target1280.data?.orders?.edges?.[0]?.node;
  if (!order1280) { console.log('#1280 주문 없음'); return; }

  const addr1280 = order1280.shippingAddress;
  const key1280 = addrKey(addr1280);

  console.log(`\n📍 #1280 배송지:`);
  console.log(`  받는분: ${addr1280?.name || '-'}`);
  console.log(`  주소: ${[addr1280?.address1, addr1280?.address2, addr1280?.city, addr1280?.province, addr1280?.zip, addr1280?.country].filter(Boolean).join(', ')}`);
  console.log(`  고객: ${order1280.customer?.displayName || '-'} (${order1280.customer?.email || '-'})`);
  console.log(`  주문일: ${order1280.createdAt?.slice(0, 10)}`);

  // 2) 엑셀 전체 주문 배송지 비교
  interface OrderInfo {
    num: number;
    date: string;
    addrKey: string;
    addrDisplay: string;
    customer: string;
    shopifyG: number;
    excelActual: number;
    excelVolume: number;
    billing: number;
    items: { name: string; qty: number; g: number }[];
  }

  const allOrders: OrderInfo[] = [];

  console.log(`\n전체 ${dataRows.length}건 주문 배송지 조회 중...`);

  for (const row of dataRows) {
    const data = await adminGraphQL(token, ORDER_QUERY, { query: `name:#${row.num}` });
    const order = data.data?.orders?.edges?.[0]?.node;
    if (!order) continue;

    const addr = order.shippingAddress;
    let shopifyG = 0;
    const items: { name: string; qty: number; g: number }[] = [];

    for (const { node: item } of order.lineItems.edges) {
      const w = item.variant?.inventoryItem?.measurement?.weight;
      const g = w ? toGrams(w.value, w.unit) : 0;
      const vt = item.variant?.title !== 'Default Title' ? ` (${item.variant?.title})` : '';
      const total = g * item.quantity;
      shopifyG += total;
      items.push({ name: `${item.title}${vt}`, qty: item.quantity, g: total });
    }

    allOrders.push({
      num: row.num,
      date: order.createdAt?.slice(0, 10) || '-',
      addrKey: addrKey(addr),
      addrDisplay: [addr?.name, addr?.address1, addr?.city, addr?.country].filter(Boolean).join(', '),
      customer: `${order.customer?.displayName || '-'} (${order.customer?.email || '-'})`,
      shopifyG,
      excelActual: row.actual,
      excelVolume: row.volume,
      billing: Math.max(row.actual, row.volume),
      items,
    });

    await new Promise(r => setTimeout(r, 200));
  }

  // 3) 동일 배송지 그룹핑
  const addrGroups = new Map<string, OrderInfo[]>();
  for (const o of allOrders) {
    if (!o.addrKey) continue;
    const list = addrGroups.get(o.addrKey) || [];
    list.push(o);
    addrGroups.set(o.addrKey, list);
  }

  // #1280과 동일 배송지
  const sameAddr = addrGroups.get(key1280) || [];

  console.log(`\n${'═'.repeat(100)}`);
  console.log(`📦 #1280과 동일 배송지 주문 (${sameAddr.length}건)`);
  console.log('═'.repeat(100));

  let combinedShopify = 0;
  let combinedBilling = 0;

  for (const o of sameAddr.sort((a, b) => a.num - b.num)) {
    combinedShopify += o.shopifyG;
    combinedBilling += o.billing;

    const isBoogie = o.items.some(i => /jumping.*boogie/i.test(i.name));
    console.log(`\n  #${o.num} — ${o.date} — 실중량 ${o.excelActual}g / 부피중량 ${o.excelVolume}g / 과금 ${o.billing}g / Shopify ${o.shopifyG}g${isBoogie ? ' [Boogie포함]' : ''}`);
    for (const item of o.items) {
      const short = item.name.length > 60 ? item.name.slice(0, 57) + '...' : item.name;
      console.log(`    ${short.padEnd(62)} ×${String(item.qty).padEnd(4)} ${item.g}g`);
    }
  }

  if (sameAddr.length > 1) {
    console.log(`\n${'─'.repeat(100)}`);
    console.log(`  🔄 합배송 합산: Shopify ${combinedShopify}g / 과금(엑셀) ${combinedBilling}g / 합산배율 ×${(combinedBilling / combinedShopify).toFixed(2)}`);
    console.log(`  📌 #1280 단독: Shopify ${sameAddr.find(o => o.num === 1280)?.shopifyG}g → 과금 ${sameAddr.find(o => o.num === 1280)?.billing}g (×${((sameAddr.find(o => o.num === 1280)?.billing || 0) / (sameAddr.find(o => o.num === 1280)?.shopifyG || 1)).toFixed(2)})`);
  }

  // 4) 전체 주문 중 합배송(동일 배송지 2건+) 그룹 모두 표시
  console.log(`\n\n${'═'.repeat(100)}`);
  console.log('📊 전체 엑셀 주문 중 동일 배송지 합배송 그룹');
  console.log('═'.repeat(100));

  let groupCount = 0;
  for (const [key, orders] of addrGroups) {
    if (orders.length < 2) continue;
    groupCount++;

    const totalBilling = orders.reduce((s, o) => s + o.billing, 0);
    const totalShopify = orders.reduce((s, o) => s + o.shopifyG, 0);
    const nums = orders.sort((a, b) => a.num - b.num).map(o => `#${o.num}`).join(', ');
    const addr = orders[0].addrDisplay;

    console.log(`\n  그룹 ${groupCount}: ${nums} — ${addr}`);
    console.log(`  ${'주문'.padEnd(7)}${'주문일'.padEnd(12)}${'과금(g)'.padEnd(10)}${'Shopify(g)'.padEnd(12)}${'단독배율'.padEnd(10)}비고`);
    console.log(`  ${'─'.repeat(90)}`);

    for (const o of orders) {
      const ratio = o.shopifyG > 0 ? (o.billing / o.shopifyG).toFixed(2) : '-';
      const isBoogie = o.items.some(i => /jumping.*boogie/i.test(i.name));
      console.log(`  #${String(o.num).padEnd(6)}${o.date.padEnd(12)}${(o.billing + 'g').padEnd(10)}${(o.shopifyG + 'g').padEnd(12)}×${ratio.toString().padEnd(9)}${isBoogie ? 'Boogie포함' : ''}`);
    }

    const combinedRatio = totalShopify > 0 ? (totalBilling / totalShopify).toFixed(2) : '-';
    console.log(`  ${'─'.repeat(90)}`);
    console.log(`  합산: 과금 ${totalBilling}g / Shopify ${totalShopify}g / 합산배율 ×${combinedRatio}`);
  }

  if (groupCount === 0) {
    console.log('  동일 배송지 합배송 그룹 없음');
  }

  // 5) 요약
  const singles = allOrders.filter(o => {
    const group = addrGroups.get(o.addrKey);
    return !group || group.length === 1;
  });
  const multiOrders = allOrders.filter(o => {
    const group = addrGroups.get(o.addrKey);
    return group && group.length >= 2;
  });

  console.log(`\n\n${'═'.repeat(80)}`);
  console.log('📈 합배송 vs 단독배송 배율 비교');
  console.log('═'.repeat(80));

  if (singles.length > 0) {
    const sRatios = singles.filter(o => o.shopifyG > 0).map(o => o.billing / o.shopifyG).filter(r => r < 50);
    const sAvg = sRatios.reduce((s, v) => s + v, 0) / sRatios.length;
    const sMed = sRatios.sort((a, b) => a - b)[Math.floor(sRatios.length / 2)];
    console.log(`  단독배송 ${singles.length}건: 평균 ×${sAvg.toFixed(2)} / 중앙 ×${sMed.toFixed(2)}`);
  }

  if (multiOrders.length > 0) {
    const mRatios = multiOrders.filter(o => o.shopifyG > 0).map(o => o.billing / o.shopifyG).filter(r => r < 50);
    const mAvg = mRatios.reduce((s, v) => s + v, 0) / mRatios.length;
    const mMed = mRatios.sort((a, b) => a - b)[Math.floor(mRatios.length / 2)];
    console.log(`  합배송건 ${multiOrders.length}건: 평균 ×${mAvg.toFixed(2)} / 중앙 ×${mMed.toFixed(2)}`);

    // 합배송 그룹별 합산 배율
    console.log('\n  합배송 그룹 합산 기준 배율:');
    let gi = 0;
    for (const [, orders] of addrGroups) {
      if (orders.length < 2) continue;
      gi++;
      const tB = orders.reduce((s, o) => s + o.billing, 0);
      const tS = orders.reduce((s, o) => s + o.shopifyG, 0);
      const nums = orders.map(o => `#${o.num}`).join('+');
      console.log(`    그룹${gi} (${nums}): 합산과금 ${tB}g / 합산Shopify ${tS}g → ×${(tB / tS).toFixed(2)}`);
    }
  }
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
