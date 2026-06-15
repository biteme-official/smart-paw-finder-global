/**
 * 주문번호 기준 상품 중량/부피 계산기
 *
 * 사용법:
 *   npx tsx scripts/order-weight-volume.ts 1001           # 단일 주문
 *   npx tsx scripts/order-weight-volume.ts 1001 1002      # 복수 주문
 *   npx tsx scripts/order-weight-volume.ts --all-products # 전체 상품 중량 목록
 */

import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env.local') });

const STORE_DOMAIN = process.env.VITE_SHOPIFY_STORE_DOMAIN!;
const CLIENT_ID = process.env.VITE_SHOPIFY_CLIENT_ID!;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET!;
const API_VERSION = '2025-07';

if (!STORE_DOMAIN || !CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ 환경변수 누락: VITE_SHOPIFY_STORE_DOMAIN / VITE_SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET');
  process.exit(1);
}

async function getAccessToken(): Promise<string> {
  const res = await fetch(`https://${STORE_DOMAIN}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`토큰 요청 실패 (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

async function adminGraphQL(token: string, query: string, variables: Record<string, unknown> = {}) {
  const res = await fetch(`https://${STORE_DOMAIN}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Admin API 오류 (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

// ─── 주문번호로 주문 조회 ───

const ORDER_QUERY = `
  query OrderByNumber($query: String!) {
    orders(first: 1, query: $query) {
      edges {
        node {
          id
          name
          createdAt
          lineItems(first: 50) {
            edges {
              node {
                title
                quantity
                variant {
                  id
                  title
                  inventoryItem {
                    measurement {
                      weight {
                        value
                        unit
                      }
                    }
                  }
                  product {
                    id
                    title
                    handle
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

// ─── 전체 상품 목록 ───

const ALL_PRODUCTS_QUERY = `
  query AllProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          handle
          variants(first: 50) {
            edges {
              node {
                id
                title
                inventoryItem {
                  measurement {
                    weight {
                      value
                      unit
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
  switch (unit.toUpperCase()) {
    case 'GRAMS': return value;
    case 'KILOGRAMS': return value * 1000;
    case 'POUNDS': return value * 453.592;
    case 'OUNCES': return value * 28.3495;
    default: return value;
  }
}

function parseWeight(variant: any): { value: number; unit: string; grams: number } | null {
  const w = variant?.inventoryItem?.measurement?.weight;
  if (w && w.value > 0) {
    return { value: w.value, unit: w.unit, grams: toGrams(w.value, w.unit) };
  }
  return null;
}

// ─── 주문 처리 ───

async function processOrder(token: string, orderNumber: string) {
  const query = `name:#${orderNumber}`;
  const data = await adminGraphQL(token, ORDER_QUERY, { query });

  const order = data.data?.orders?.edges?.[0]?.node;
  if (!order) {
    console.error(`❌ 주문 #${orderNumber}을 찾을 수 없습니다.`);
    return null;
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📦 주문: ${order.name} (${new Date(order.createdAt).toLocaleDateString('ko-KR')})`);
  console.log(`${'═'.repeat(60)}`);

  let totalGrams = 0;
  const missingWeight: string[] = [];
  const lineItems = order.lineItems?.edges || [];
  const itemResults: { name: string; qty: number; unitGrams: number; totalGrams: number }[] = [];

  for (const { node: item } of lineItems) {
    const qty = item.quantity;
    const variantTitle = item.variant?.title && item.variant.title !== 'Default Title'
      ? ` (${item.variant.title})`
      : '';
    const displayName = `${item.title}${variantTitle}`;

    const weight = parseWeight(item.variant);

    console.log(`\n  ▸ ${displayName}`);
    console.log(`    수량: ${qty}`);

    if (weight) {
      const itemTotalGrams = weight.grams * qty;
      totalGrams += itemTotalGrams;
      itemResults.push({ name: displayName, qty, unitGrams: weight.grams, totalGrams: itemTotalGrams });
      console.log(`    중량: ${weight.value} ${weight.unit} × ${qty} = ${itemTotalGrams.toFixed(0)}g`);
    } else {
      missingWeight.push(displayName);
      console.log(`    중량: ⚠️ 미등록`);
    }
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`📊 합계`);
  console.log(`  총 실중량: ${totalGrams.toFixed(0)}g (${(totalGrams / 1000).toFixed(2)}kg)`);

  // 용적중량 안내 (Shopify에 치수 데이터 없음)
  console.log(`  ※ 부피/용적중량: Shopify에 치수(L×W×H) 미등록 → 수동 입력 필요`);

  if (missingWeight.length > 0) {
    console.log(`\n  ⚠️ 중량 미등록 상품 (${missingWeight.length}개):`);
    missingWeight.forEach(name => console.log(`    - ${name}`));
  }

  return { orderName: order.name, totalGrams, missingWeight, items: itemResults };
}

// ─── 전체 상품 목록 ───

async function listAllProducts(token: string) {
  console.log(`\n전체 상품 중량 목록 조회 중...\n`);

  const products: any[] = [];
  let after: string | null = null;

  while (true) {
    const data = await adminGraphQL(token, ALL_PRODUCTS_QUERY, { first: 50, after });
    const edges = data.data?.products?.edges || [];
    for (const { node } of edges) products.push(node);
    const pageInfo = data.data?.products?.pageInfo;
    if (!pageInfo?.hasNextPage) break;
    after = pageInfo.endCursor;
  }

  console.log(`${'═'.repeat(75)}`);
  console.log(`총 ${products.length}개 상품\n`);
  console.log(`${'상품명'.padEnd(45)}${'배리언트'.padEnd(20)}${'중량'}`);
  console.log(`${'─'.repeat(75)}`);

  let withWeight = 0;
  let totalVariants = 0;

  for (const product of products) {
    const variants = product.variants?.edges || [];

    for (const { node: variant } of variants) {
      totalVariants++;
      const weight = parseWeight(variant);
      const variantLabel = variant.title !== 'Default Title' ? variant.title : '-';
      const title = product.title.length > 43 ? product.title.slice(0, 40) + '...' : product.title;

      let weightStr = '⚠️ 미등록';
      if (weight) {
        weightStr = `${weight.grams}g (${(weight.grams / 1000).toFixed(2)}kg)`;
        withWeight++;
      }

      console.log(`${title.padEnd(45)}${variantLabel.slice(0, 18).padEnd(20)}${weightStr}`);
    }
  }

  console.log(`\n${'─'.repeat(75)}`);
  console.log(`📊 데이터 현황: 총 ${totalVariants} 배리언트 중 중량 등록 ${withWeight}건 (${((withWeight / totalVariants) * 100).toFixed(0)}%)`);
  console.log(`※ 부피(치수) 데이터는 Shopify에 미등록. 필요 시 metafield로 관리 권장.`);
}

// ─── main ───

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('사용법:');
    console.log('  npx tsx scripts/order-weight-volume.ts 1001           # 주문번호 기준 조회');
    console.log('  npx tsx scripts/order-weight-volume.ts 1001 1002      # 복수 주문');
    console.log('  npx tsx scripts/order-weight-volume.ts --all-products # 전체 상품 목록');
    process.exit(0);
  }

  console.log('🔑 Shopify Admin API 토큰 발급 중...');
  const token = await getAccessToken();
  console.log('✅ 토큰 발급 완료');

  if (args.includes('--all-products')) {
    await listAllProducts(token);
    return;
  }

  const results = [];
  for (const orderNum of args) {
    const result = await processOrder(token, orderNum);
    if (result) results.push(result);
  }

  if (results.length > 1) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📊 전체 주문 합산`);
    const totalG = results.reduce((s, r) => s + r.totalGrams, 0);
    console.log(`  총 중량: ${totalG.toFixed(0)}g (${(totalG / 1000).toFixed(2)}kg)`);
  }
}

main().catch(err => {
  console.error('❌ 오류:', err.message || err);
  process.exit(1);
});
