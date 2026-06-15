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

function toGrams(v: number, u: string): number {
  if (u === 'KILOGRAMS') return v * 1000;
  if (u === 'POUNDS') return v * 453.592;
  if (u === 'OUNCES') return v * 28.3495;
  return v;
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

  console.log('\n' + '═'.repeat(130));
  console.log('📋 Jumping Boogie 미포함 주문 상세 (엑셀 기준)');
  console.log('═'.repeat(130));

  for (const row of dataRows) {
    const data = await adminGraphQL(token, ORDER_QUERY, { query: `name:#${row.num}` });
    const order = data.data?.orders?.edges?.[0]?.node;
    if (!order) continue;

    let hasBoogie = false;
    for (const { node: item } of order.lineItems.edges) {
      if (/jumping.*boogie/i.test(item.title)) { hasBoogie = true; break; }
    }
    if (hasBoogie) continue;

    const billing = Math.max(row.actual, row.volume);

    // 상품 목록
    let shopifyTotal = 0;
    const items: { name: string; qty: number; unitG: number; totalG: number }[] = [];
    for (const { node: item } of order.lineItems.edges) {
      const w = item.variant?.inventoryItem?.measurement?.weight;
      const g = w ? toGrams(w.value, w.unit) : 0;
      const vt = item.variant?.title !== 'Default Title' ? ` (${item.variant?.title})` : '';
      const total = g * item.quantity;
      shopifyTotal += total;
      items.push({ name: `${item.title}${vt}`, qty: item.quantity, unitG: g, totalG: total });
    }

    const ratio = shopifyTotal > 0 ? billing / shopifyTotal : 0;

    console.log(`\n#${row.num} — 실중량 ${row.actual}g / 부피중량 ${row.volume}g / 과금 ${billing}g / Shopify ${shopifyTotal}g / 배율 ×${ratio.toFixed(2)}`);
    console.log('─'.repeat(130));
    console.log(`  ${'상품명'.padEnd(55)}${'수량'.padEnd(5)}${'단가(g)'.padEnd(10)}${'소계(g)'}`);

    for (const item of items) {
      const short = item.name.length > 53 ? item.name.slice(0, 50) + '...' : item.name;
      console.log(`  ${short.padEnd(55)}×${String(item.qty).padEnd(4)}${item.unitG > 0 ? String(item.unitG) + 'g' : '⚠미등록'}`.padEnd(75) + `${item.totalG}g`);
    }

    await new Promise(r => setTimeout(r, 200));
  }
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
