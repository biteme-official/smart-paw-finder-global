import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env.local') });

const STORE = process.env.VITE_SHOPIFY_STORE_DOMAIN!;
const CID = process.env.VITE_SHOPIFY_CLIENT_ID!;
const CS = process.env.SHOPIFY_CLIENT_SECRET!;

async function main() {
  const r1 = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: CID, client_secret: CS }),
  });
  const token = (await r1.json()).access_token;

  const query = `{
    products(first: 3, query: "title:*Boogie*") {
      edges { node {
        title handle
        variants(first: 10) { edges { node {
          title sku
          inventoryItem {
            measurement {
              weight { value unit }
            }
          }
        } } }
        width: metafield(namespace: "shipping", key: "width") { value }
        depth: metafield(namespace: "shipping", key: "depth") { value }
        height: metafield(namespace: "shipping", key: "height") { value }
      } }
    }
  }`;

  const r2 = await fetch(`https://${STORE}/admin/api/2025-07/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query }),
  });
  const data = await r2.json();

  for (const { node: p } of data.data?.products?.edges || []) {
    console.log(`\n=== ${p.title} ===`);
    const w = p.width?.value;
    const d = p.depth?.value;
    const h = p.height?.value;
    console.log(`  치수 metafield: ${w || 'N/A'} × ${d || 'N/A'} × ${h || 'N/A'} mm`);
    if (w && d && h) {
      const vol = Number(w) * Number(d) * Number(h);
      const volKg = vol / 5000000;
      console.log(`  부피중량: ${vol.toLocaleString()} mm³ ÷ 5,000,000 = ${(volKg * 1000).toFixed(0)}g (${volKg.toFixed(2)}kg)`);
    }
    console.log('  Variants:');
    for (const { node: v } of p.variants.edges) {
      const mw = v.inventoryItem?.measurement?.weight;
      console.log(`    [${v.title}] weight: ${mw ? mw.value + ' ' + mw.unit : 'N/A'}`);
    }
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
