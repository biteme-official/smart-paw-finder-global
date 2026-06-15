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

// 고객 이메일로 전체 주문 조회
const CUSTOMER_ORDERS_QUERY = `
  query CustomerOrders($query: String!, $first: Int!, $after: String) {
    orders(first: $first, after: $after, query: $query, sortKey: CREATED_AT) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          name createdAt
          displayFulfillmentStatus
          shippingAddress {
            name address1 address2 city province country zip
          }
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

  // #1280 고객: elsa@multilines.com.hk, 주문일 2026-05-30
  const customerEmail = 'elsa@multilines.com.hk';

  console.log('═'.repeat(110));
  console.log(`🔍 고객 ${customerEmail} 전체 주문 이력 (합배송 가능성 확인)`);
  console.log('═'.repeat(110));

  // 엑셀 데이터 로드
  const wb = XLSX.readFile('C:/Users/User/Desktop/쇼피파이_실중량.xlsx');
  const rawRows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  const excelMap = new Map<number, { actual: number; volume: number }>();
  for (const row of rawRows.slice(1)) {
    if (!row[0]) continue;
    const num = Number(String(row[0]).replace('#', ''));
    if (!excelMap.has(num)) excelMap.set(num, { actual: Number(row[1]), volume: Number(row[2]) });
  }

  let after: string | null = null;
  const allOrders: any[] = [];

  while (true) {
    const data = await adminGraphQL(token, CUSTOMER_ORDERS_QUERY, {
      query: `email:${customerEmail}`,
      first: 50,
      after,
    });
    const edges = data.data?.orders?.edges || [];
    for (const { node } of edges) allOrders.push(node);
    if (!data.data?.orders?.pageInfo?.hasNextPage) break;
    after = data.data.orders.pageInfo.endCursor;
  }

  console.log(`\n  총 주문 ${allOrders.length}건\n`);

  // #1280 주문일 기준 ±7일 내 주문을 하이라이트
  const target1280Date = new Date('2026-05-30');

  let totalShopifyNearby = 0;
  let totalBillingNearby = 0;
  const nearbyOrders: any[] = [];

  for (const order of allOrders) {
    const orderNum = Number(order.name.replace('#', ''));
    const orderDate = new Date(order.createdAt);
    const dayDiff = Math.abs((orderDate.getTime() - target1280Date.getTime()) / 86400000);
    const isNearby = dayDiff <= 7;

    let shopifyG = 0;
    const items: string[] = [];

    for (const { node: item } of order.lineItems.edges) {
      const w = item.variant?.inventoryItem?.measurement?.weight;
      const g = w ? toGrams(w.value, w.unit) : 0;
      const total = g * item.quantity;
      shopifyG += total;
      const vt = item.variant?.title !== 'Default Title' ? ` (${item.variant?.title})` : '';
      items.push(`${item.title}${vt} ×${item.quantity} [${total}g]`);
    }

    const excel = excelMap.get(orderNum);
    const billing = excel ? Math.max(excel.actual, excel.volume) : 0;
    const fulfillment = order.displayFulfillmentStatus || '-';
    const addr = order.shippingAddress;
    const addrShort = addr ? [addr.address1, addr.city, addr.country].filter(Boolean).join(', ') : '-';

    const marker = orderNum === 1280 ? '★' : isNearby ? '◆' : ' ';
    const excelInfo = excel ? `엑셀: 실${excel.actual}g/부피${excel.volume}g/과금${billing}g` : '엑셀 미포함';

    console.log(`${marker} #${orderNum} — ${order.createdAt?.slice(0, 10)} — Shopify ${shopifyG}g — ${excelInfo} — ${fulfillment}`);
    console.log(`  배송지: ${addrShort}`);
    for (const item of items) {
      console.log(`    ${item}`);
    }
    console.log('');

    if (isNearby) {
      nearbyOrders.push({ num: orderNum, shopifyG, billing, date: order.createdAt?.slice(0, 10), items, excel });
      totalShopifyNearby += shopifyG;
      if (billing > 0) totalBillingNearby += billing;
    }
  }

  // ±7일 합산 분석
  if (nearbyOrders.length > 1) {
    console.log('═'.repeat(110));
    console.log(`📦 #1280 주문일(2026-05-30) ±7일 내 주문 합산 (합배송 추정)`);
    console.log('═'.repeat(110));
    console.log(`  ${'주문'.padEnd(8)}${'날짜'.padEnd(13)}${'Shopify(g)'.padEnd(13)}${'엑셀과금(g)'.padEnd(13)}메모`);
    console.log(`  ${'─'.repeat(90)}`);

    for (const o of nearbyOrders.sort((a, b) => a.num - b.num)) {
      console.log(`  #${String(o.num).padEnd(7)}${o.date.padEnd(13)}${(o.shopifyG + 'g').padEnd(13)}${o.billing > 0 ? o.billing + 'g' : '엑셀없음'.padEnd(13)}${o.num === 1280 ? '← 대상 주문' : ''}`);
    }

    console.log(`  ${'─'.repeat(90)}`);
    console.log(`  합산: Shopify ${totalShopifyNearby}g`);
    if (totalBillingNearby > 0) {
      console.log(`  합산 과금(엑셀): ${totalBillingNearby}g`);
      console.log(`  합산 배율: ×${(totalBillingNearby / totalShopifyNearby).toFixed(2)}`);
    }
  }

  // 추가: 동일 날짜(2026-05-30) 전체 주문 중 같은 배송지
  console.log(`\n\n${'═'.repeat(110)}`);
  console.log('📊 2026-05-30 전후 ±3일 — 전체 주문 중 동일 배송지(Hong Kong Kowloon Bay) 검색');
  console.log('═'.repeat(110));

  const dateQuery = 'created_at:>=2026-05-27 created_at:<=2026-06-02';
  let after2: string | null = null;
  const dateOrders: any[] = [];

  while (true) {
    const data = await adminGraphQL(token, CUSTOMER_ORDERS_QUERY, {
      query: dateQuery,
      first: 50,
      after: after2,
    });
    const edges = data.data?.orders?.edges || [];
    for (const { node } of edges) dateOrders.push(node);
    if (!data.data?.orders?.pageInfo?.hasNextPage) break;
    after2 = data.data.orders.pageInfo.endCursor;
  }

  const kowloonOrders = dateOrders.filter(o => {
    const addr = o.shippingAddress;
    if (!addr) return false;
    const full = [addr.address1, addr.address2, addr.city, addr.province, addr.country].join(' ').toLowerCase();
    return full.includes('kowloon') || full.includes('multilines') || full.includes('kuo');
  });

  console.log(`\n  해당 기간 전체 주문: ${dateOrders.length}건`);
  console.log(`  Kowloon/KUO 관련: ${kowloonOrders.length}건\n`);

  for (const order of kowloonOrders) {
    const orderNum = order.name.replace('#', '');
    let shopifyG = 0;
    for (const { node: item } of order.lineItems.edges) {
      const w = item.variant?.inventoryItem?.measurement?.weight;
      shopifyG += (w ? toGrams(w.value, w.unit) : 0) * item.quantity;
    }
    const addr = order.shippingAddress;
    const excel = excelMap.get(Number(orderNum));
    console.log(`  #${orderNum} — ${order.createdAt?.slice(0, 10)} — Shopify ${shopifyG}g — ${excel ? `엑셀과금 ${Math.max(excel.actual, excel.volume)}g` : '엑셀미포함'} — ${order.displayFulfillmentStatus}`);
    console.log(`    ${addr?.name}, ${addr?.address1}, ${addr?.city}, ${addr?.country}`);
  }
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
