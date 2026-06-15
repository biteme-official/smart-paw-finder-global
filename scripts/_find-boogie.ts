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
  const orderNums = [...new Set(rawRows.slice(1).filter((r: any[]) => r[0]).map((r: any[]) => Number(r[0])))];

  const token = await getAccessToken();

  const found: { orderNum: number; items: { title: string; qty: number; weight: number }[] }[] = [];

  for (const num of orderNums) {
    const data = await adminGraphQL(token, ORDER_QUERY, { query: `name:#${num}` });
    const order = data.data?.orders?.edges?.[0]?.node;
    if (!order) continue;

    const boogieItems: { title: string; qty: number; weight: number }[] = [];
    for (const { node: item } of order.lineItems.edges) {
      if (/jumping.*boogie|boogie.*ball/i.test(item.title)) {
        const w = item.variant?.inventoryItem?.measurement?.weight;
        const g = w ? toGrams(w.value, w.unit) : 0;
        const vt = item.variant?.title !== 'Default Title' ? ` (${item.variant?.title})` : '';
        boogieItems.push({ title: `${item.title}${vt}`, qty: item.quantity, weight: g });
      }
    }

    if (boogieItems.length > 0) {
      found.push({ orderNum: num, items: boogieItems });
    }

    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n🔍 "Jumping Boogie Auto-Ball Toy" 포함 주문 (엑셀 ${orderNums.length}건 중)\n`);

  if (found.length === 0) {
    console.log('해당 상품이 포함된 주문이 없습니다.');
    return;
  }

  console.log('═'.repeat(80));
  console.log(`${'주문번호'.padEnd(10)}${'배리언트'.padEnd(35)}${'수량'.padEnd(6)}${'단위중량(g)'.padEnd(13)}비고`);
  console.log('─'.repeat(80));

  for (const o of found) {
    for (const item of o.items) {
      const note = item.weight === 0 ? '⚠️ 중량 미등록' : '';
      console.log(
        `#${String(o.orderNum).padEnd(9)}` +
        `${item.title.slice(0, 33).padEnd(35)}` +
        `×${String(item.qty).padEnd(5)}` +
        `${item.weight > 0 ? String(item.weight) + 'g' : '-'}`.padEnd(13) +
        note
      );
    }
  }

  console.log('─'.repeat(80));
  console.log(`총 ${found.length}건 주문에 포함`);
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
