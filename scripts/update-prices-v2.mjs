import { readFileSync } from 'fs';

const SHOP = process.env.VITE_SHOPIFY_STORE_DOMAIN;
const CLIENT_ID = process.env.VITE_SHOPIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
const API_VERSION = '2025-04';

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAdminToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 60_000) return cachedToken;
  const res = await fetch(`https://${SHOP}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`Token failed (${res.status})`);
  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = now + data.expires_in * 1000;
  return cachedToken;
}

async function adminGql(query, variables = {}) {
  const token = await getAdminToken();
  const res = await fetch(`https://${SHOP}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Admin API ${res.status}`);
  return res.json();
}

async function fetchAllProducts() {
  const products = [];
  let cursor = null;
  let page = 0;
  while (true) {
    page++;
    const query = `
      query($cursor: String) {
        products(first: 50, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              id
              title
              status
              variants(first: 100) {
                edges {
                  node {
                    id
                    title
                    price
                  }
                }
              }
            }
          }
        }
      }
    `;
    const data = await adminGql(query, { cursor });
    const edges = data.data?.products?.edges || [];
    for (const { node } of edges) {
      products.push({
        id: node.id,
        title: node.title,
        status: node.status,
        variants: (node.variants?.edges || []).map(e => ({
          id: e.node.id,
          numericId: e.node.id.replace('gid://shopify/ProductVariant/', ''),
          title: e.node.title,
          price: e.node.price,
        })),
      });
    }
    const pi = data.data?.products?.pageInfo;
    console.log(`  page ${page}: ${edges.length} products (total ${products.length})`);
    if (!pi?.hasNextPage) break;
    cursor = pi.endCursor;
  }
  return products;
}

function normalizeTitle(t) {
  return (t || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// REST API for variant price update
async function updateVariantPriceREST(numericId, newPrice) {
  const token = await getAdminToken();
  const res = await fetch(`https://${SHOP}/admin/api/${API_VERSION}/variants/${numericId}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ variant: { id: parseInt(numericId), price: newPrice } }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`REST ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  if (!data.variant) throw new Error('No variant in response');
  return data.variant;
}

const MODE = process.argv[2] || 'dry-run';

async function main() {
  console.log(`\n=== Shopify Price Update v2 — REST API (${MODE}) ===\n`);

  const raw = readFileSync('data/price-update-map.json', 'utf-8').replace(/^﻿/, '');
  const priceMap = JSON.parse(raw);
  console.log(`Excel entries: ${priceMap.length}`);

  console.log('\nFetching all Shopify products...');
  const shopifyProducts = await fetchAllProducts();
  console.log(`Shopify products: ${shopifyProducts.length}\n`);

  const shopifyIndex = new Map();
  for (const p of shopifyProducts) {
    shopifyIndex.set(normalizeTitle(p.title), p);
  }

  const matched = [];
  const excluded = [];

  for (const entry of priceMap) {
    const product = shopifyIndex.get(normalizeTitle(entry.product));
    if (!product) {
      excluded.push({ ...entry, reason: 'product not found' });
      continue;
    }

    const variantTitle = normalizeTitle(entry.variant);
    let variant;
    if (!variantTitle || variantTitle === 'default title') {
      variant = product.variants[0];
    } else {
      variant = product.variants.find(v => normalizeTitle(v.title) === variantTitle);
      if (!variant) {
        variant = product.variants.find(v =>
          normalizeTitle(v.title).includes(variantTitle) || variantTitle.includes(normalizeTitle(v.title))
        );
      }
    }

    if (!variant) {
      excluded.push({ ...entry, reason: `variant not found` });
      continue;
    }

    const currentPrice = parseFloat(variant.price);
    const newPrice = parseFloat(entry.newPrice);
    const oldPrice = parseFloat(entry.oldPrice);

    if (Math.abs(currentPrice - newPrice) < 0.01) {
      continue; // already correct
    }

    if (Math.abs(currentPrice - oldPrice) > 0.01) {
      excluded.push({ ...entry, reason: `price mismatch: Shopify=$${currentPrice}, Excel old=$${oldPrice}` });
      continue;
    }

    matched.push({
      product: entry.product,
      variant: entry.variant,
      numericId: variant.numericId,
      currentPrice,
      newPrice,
    });
  }

  console.log(`To update: ${matched.length}`);
  console.log(`Excluded:  ${excluded.length}`);

  if (MODE === 'execute') {
    console.log(`\nExecuting ${matched.length} price updates via REST API...`);
    let success = 0;
    let fail = 0;

    for (let i = 0; i < matched.length; i++) {
      const m = matched[i];
      try {
        const updated = await updateVariantPriceREST(m.numericId, m.newPrice.toString());
        const actualPrice = parseFloat(updated.price);
        if (Math.abs(actualPrice - m.newPrice) < 0.01) {
          success++;
        } else {
          console.log(`  WARN [${i + 1}] ${m.product}/${m.variant}: expected $${m.newPrice}, got $${actualPrice}`);
          fail++;
        }
        if ((i + 1) % 50 === 0 || i === matched.length - 1) {
          console.log(`  Progress: ${i + 1}/${matched.length} (${success} ok, ${fail} fail)`);
        }
        // Rate limiting: Shopify REST allows ~40 req/sec bucket
        if ((i + 1) % 35 === 0) await new Promise(r => setTimeout(r, 1000));
      } catch (e) {
        console.log(`  ERROR [${i + 1}] ${m.product}/${m.variant}: ${e.message}`);
        fail++;
      }
    }
    console.log(`\nDone: ${success} updated, ${fail} failed`);

    // Verification: spot check 5 random items
    console.log('\nSpot-checking 5 random items...');
    const checks = matched.sort(() => Math.random() - 0.5).slice(0, 5);
    for (const c of checks) {
      try {
        const token = await getAdminToken();
        const res = await fetch(`https://${SHOP}/admin/api/${API_VERSION}/variants/${c.numericId}.json`, {
          headers: { 'X-Shopify-Access-Token': token },
        });
        const data = await res.json();
        const actual = data.variant?.price;
        const ok = Math.abs(parseFloat(actual) - c.newPrice) < 0.01;
        console.log(`  ${ok ? 'OK' : 'FAIL'}: ${c.product}/${c.variant} — $${actual} (expected $${c.newPrice})`);
      } catch (e) {
        console.log(`  CHECK ERROR: ${c.product}: ${e.message}`);
      }
    }
  } else {
    console.log('\n(dry-run — run with "execute" to apply)');
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
