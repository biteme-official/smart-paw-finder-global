/**
 * 옵션(Variant) 메타필드 custom.intl_retail_price (해외 리테일가, USD) 정의 + 시트 기존 환산가 기록
 * B2B 쇼핑몰에서 미국 외 도매처에게 보여줄 리테일가. 표시용이며 결제가가 아님.
 * 값 출처: data/intl-price-map.json (시트 '쇼피파이 프라이싱 > new프라이싱' G열, 상품명+옵션명 매칭)
 *
 * - 상품(Product) 단위로 만든 같은 키 정의가 있고 값이 0개면 삭제
 * - 옵션 단위 정의가 없으면 생성
 * - 값이 비어 있고 시트와 매칭되는 옵션에만 기록 (이미 있는 값은 덮어쓰지 않음, 가격 $0·미매칭은 건너뜀)
 *
 * 사용법:
 *   npx tsx scripts/create-intl-retail-metafield.ts          # 미리보기 (아무것도 바꾸지 않음)
 *   npx tsx scripts/create-intl-retail-metafield.ts --apply  # 실제 적용
 */

import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env.local') });

const STORE_DOMAIN = process.env.VITE_SHOPIFY_STORE_DOMAIN!;
const CLIENT_ID = process.env.VITE_SHOPIFY_CLIENT_ID!;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET!;
const API_VERSION = '2025-07';

const NAMESPACE = 'custom';
const KEY = 'intl_retail_price';
const APPLY = process.argv.includes('--apply');

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

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function adminGraphQL(token: string, query: string, variables: Record<string, unknown> = {}, attempt = 1) {
  const res = await fetch(`https://${STORE_DOMAIN}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Admin API 실패 (${res.status}): ${await res.text()}`);
  const data = await res.json();
  const throttled = data.errors?.some((e: { extensions?: { code?: string } }) => e.extensions?.code === 'THROTTLED');
  if (throttled && attempt <= 5) {
    await sleep(2000 * attempt);
    return adminGraphQL(token, query, variables, attempt + 1);
  }
  if (data.errors) throw new Error(`GraphQL 오류: ${JSON.stringify(data.errors)}`);
  return data.data;
}

const FIND_DEFINITION = `
  query ($ownerType: MetafieldOwnerType!, $namespace: String!, $key: String!) {
    metafieldDefinitions(first: 1, ownerType: $ownerType, namespace: $namespace, key: $key) {
      nodes { id name metafieldsCount }
    }
  }
`;

const DELETE_DEFINITION = `
  mutation ($id: ID!) {
    metafieldDefinitionDelete(id: $id, deleteAllAssociatedMetafields: false) {
      deletedDefinitionId
      userErrors { field message code }
    }
  }
`;

const CREATE_DEFINITION = `
  mutation ($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) {
      createdDefinition { id name namespace key ownerType type { name } access { storefront } }
      userErrors { field message code }
    }
  }
`;

const VARIANTS_PAGE = `
  query ($cursor: String) {
    productVariants(first: 250, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        title
        price
        product { title }
        metafield(namespace: "${NAMESPACE}", key: "${KEY}") { value }
      }
    }
  }
`;

const METAFIELDS_SET = `
  mutation ($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id }
      userErrors { field message code }
    }
  }
`;

type Variant = { id: string; title: string; price: string; product: { title: string }; metafield: { value: string } | null };

// 시트 '쇼피파이 프라이싱 > new프라이싱'에서 뽑은 상품명||옵션명 → { intl: 기존 환산가(G열), us: 새 미국가(J열) }
const PRICE_MAP: Record<string, { intl: number; us: number }> = JSON.parse(
  readFileSync(join(__dirname, '..', 'data', 'intl-price-map.json'), 'utf-8'),
);

const decodeEntities = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const norm = (s: string) => decodeEntities(s).toLowerCase().split(/\s+/).filter(Boolean).join(' ');
const priceKey = (v: Variant) => `${norm(v.product.title)}||${norm(v.title)}`;

async function findDefinition(token: string, ownerType: 'PRODUCT' | 'PRODUCTVARIANT') {
  const data = await adminGraphQL(token, FIND_DEFINITION, { ownerType, namespace: NAMESPACE, key: KEY });
  return data.metafieldDefinitions.nodes[0] as { id: string; name: string; metafieldsCount: number } | undefined;
}

async function fetchAllVariants(token: string): Promise<Variant[]> {
  const all: Variant[] = [];
  let cursor: string | null = null;
  do {
    const data = await adminGraphQL(token, VARIANTS_PAGE, { cursor });
    all.push(...data.productVariants.nodes);
    cursor = data.productVariants.pageInfo.hasNextPage ? data.productVariants.pageInfo.endCursor : null;
  } while (cursor);
  return all;
}

async function main() {
  console.log(APPLY ? '🚀 적용 모드' : '👀 미리보기 모드 (아무것도 바꾸지 않음, 적용은 --apply)');
  const token = await getAccessToken();

  // 1. 상품 단위 정의 정리
  const productDef = await findDefinition(token, 'PRODUCT');
  if (productDef) {
    if (productDef.metafieldsCount > 0) {
      console.error(`❌ 상품 단위 정의에 값이 ${productDef.metafieldsCount}개 있어 삭제하지 않고 중단합니다.`);
      process.exit(1);
    }
    console.log(`🗑️  상품 단위 정의 삭제 대상 (값 0개): ${productDef.id}`);
    if (APPLY) {
      const result = (await adminGraphQL(token, DELETE_DEFINITION, { id: productDef.id })).metafieldDefinitionDelete;
      if (result.userErrors.length) throw new Error(`정의 삭제 실패: ${JSON.stringify(result.userErrors)}`);
      console.log('   ✅ 삭제 완료');
    }
  } else {
    console.log('⏭️  상품 단위 정의 없음');
  }

  // 2. 옵션 단위 정의 생성
  const variantDef = await findDefinition(token, 'PRODUCTVARIANT');
  if (variantDef) {
    console.log(`⏭️  옵션 단위 정의 이미 있음: ${variantDef.id} (값 ${variantDef.metafieldsCount}개)`);
  } else {
    console.log('➕ 옵션 단위 정의 생성 대상');
    if (APPLY) {
      const result = (await adminGraphQL(token, CREATE_DEFINITION, {
        definition: {
          name: '해외 리테일가 (USD)',
          namespace: NAMESPACE,
          key: KEY,
          description: 'B2B 쇼핑몰에서 미국 외 도매처에게 보여줄 리테일가. 표시용이며 결제가가 아님. 미국가 전환 전 기본가(기존 환산가)를 복사해 둔 값.',
          type: 'number_decimal',
          ownerType: 'PRODUCTVARIANT',
          access: { storefront: 'PUBLIC_READ' },
          validations: [{ name: 'min', value: '0' }],
        },
      })).metafieldDefinitionCreate;
      if (result.userErrors.length) throw new Error(`정의 생성 실패: ${JSON.stringify(result.userErrors)}`);
      console.log('   ✅ 생성 완료:', result.createdDefinition);
    }
  }

  // 3. 현재 가격 복사 (비어 있는 옵션만)
  const variants = await fetchAllVariants(token);
  const empty = variants.filter(v => !v.metafield);
  const zero = empty.filter(v => Number(v.price) <= 0);
  const priced = empty.filter(v => Number(v.price) > 0);
  const existing = variants.length - empty.length;

  const matched = priced.filter(v => PRICE_MAP[priceKey(v)]);
  const unmatched = priced.filter(v => !PRICE_MAP[priceKey(v)]);
  const targets = matched.map(v => ({ v, intl: PRICE_MAP[priceKey(v)].intl, us: PRICE_MAP[priceKey(v)].us }));
  const nowUs = targets.filter(t => Math.abs(Number(t.v.price) - t.us) < 0.005).length;
  const nowIntl = targets.filter(t => Math.abs(Number(t.v.price) - t.intl) < 0.005).length;

  console.log(`\n📊 전체 옵션 ${variants.length}개 · 이미 값 있음 ${existing}개 · 가격 $0 건너뜀 ${zero.length}개`);
  console.log(`   시트와 매칭 ${matched.length}개 (기록 대상) · 매칭 안 됨 ${unmatched.length}개 (건너뜀)`);
  console.log(`   매칭된 옵션의 현재 Shopify 가격: 시트 미국가와 같음 ${nowUs}개 · 시트 기존가와 같음 ${nowIntl}개 · 둘 다 아님 ${targets.length - nowUs - nowIntl}개`);
  console.log('\n   샘플 (현재 가격 → 기록할 해외가):');
  targets.slice(0, 10).forEach(t => console.log(`   - ${t.v.product.title} / ${t.v.title}: $${t.v.price} → $${t.intl}`));
  const others = targets.filter(t => Math.abs(Number(t.v.price) - t.us) >= 0.005 && Math.abs(Number(t.v.price) - t.intl) >= 0.005);
  if (others.length) {
    console.log('\n⚠️  현재 가격이 시트 미국가·기존가 어느 쪽과도 다른 옵션 (최대 20개):');
    others.slice(0, 20).forEach(t => console.log(`   - ${t.v.product.title} / ${t.v.title}: 현재 $${t.v.price} · 시트 미국 $${t.us} · 시트 기존 $${t.intl}`));
  }
  const unmatchedProducts = [...new Set(unmatched.map(v => v.product.title))];
  console.log(`\n⚠️  시트에 없는 상품 ${unmatchedProducts.length}개 (최대 30개):`);
  unmatchedProducts.slice(0, 30).forEach(t => console.log(`   - ${t}`));

  if (!APPLY) {
    console.log('\n👀 미리보기 끝. 적용하려면 --apply 를 붙여 다시 실행하세요.');
    return;
  }

  let written = 0;
  const failed: string[] = [];
  for (let i = 0; i < targets.length; i += 25) {
    const batch = targets.slice(i, i + 25);
    const result = (await adminGraphQL(token, METAFIELDS_SET, {
      metafields: batch.map(t => ({ ownerId: t.v.id, namespace: NAMESPACE, key: KEY, type: 'number_decimal', value: String(t.intl) })),
    })).metafieldsSet;
    if (result.userErrors.length) {
      failed.push(...batch.map(t => `${t.v.product.title} / ${t.v.title}`));
      console.error(`   ❌ ${i + 1}~${i + batch.length}번 실패:`, result.userErrors);
    } else {
      written += result.metafields.length;
    }
  }
  console.log(`\n✅ 기록 ${written}개 · 실패 ${failed.length}개`);
  failed.forEach(f => console.log(`   - ${f}`));
}

main().catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
