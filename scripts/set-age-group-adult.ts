/**
 * Google Merchant Center Missing age_group 해결
 * shopify.recommended-age-group 메타필드를 "Adult"로 일괄 설정
 *
 * 사용법: npx tsx scripts/set-age-group-adult.ts
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

// Google Merchant Center에서 Missing age_group으로 반려된 상품 ID 목록
const PRODUCT_IDS = [
  '8695912562742', '8688374317110', '8688347512886', '8684462571574',
  '8627310362678', '8616092270646', '8615128825910', '8598063054902',
  '8487275855926', '8340665008182', '8266004627510', '8265996992566',
  '8265994534966', '8200430288950', '8181947629622', '8181942485046',
  '8181942190134', '8177877319734', '8177864638518', '8177835376694',
  '8156242673718', '8156238544950', '8155879866422', '8154573668406',
  '8154566885430', '8154565640246', '8154564493366', '8154562986038',
  '8154559545398', '8154554171446', '8154549944374', '8154548764726',
  '8154547650614', '8154545913910', '8154543030326', '8154542243894',
  '8154541555766', '8154540736566', '8154539294774', '8154537099318',
  '8154535198774', '8154533330998', '8154530938934', '8154527957046',
  '8154525728822', '8154524975158', '8154523435062', '8154521272374',
  '8154516357174', '8154515144758',
];

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

const METAFIELDS_SET_MUTATION = `
  mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { key namespace value }
      userErrors { field message }
    }
  }
`;

async function adminGraphQL(token: string, query: string, variables: Record<string, unknown>) {
  const res = await fetch(
    `https://${STORE_DOMAIN}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({ query, variables }),
    }
  );
  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

async function main() {
  console.log(`\n🔧 shopify.recommended-age-group → "Adult" 일괄 설정`);
  console.log(`📦 대상 상품: ${PRODUCT_IDS.length}개\n`);

  console.log('🔑 액세스 토큰 발급 중...');
  const token = await getAccessToken();
  console.log('✅ 토큰 발급 완료\n');

  // metafieldsSet은 최대 25개씩 처리
  const batches = chunk(PRODUCT_IDS, 25);
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`⏳ 배치 ${i + 1}/${batches.length} 처리 중 (${batch.length}개)...`);

    const metafields = batch.map(id => ({
      ownerId: `gid://shopify/Product/${id}`,
      namespace: 'shopify',
      key: 'recommended-age-group',
      value: '["Adult"]',
      type: 'list.single_line_text_field',
    }));

    try {
      const data = await adminGraphQL(token, METAFIELDS_SET_MUTATION, { metafields });
      const result = data?.data?.metafieldsSet;

      if (result?.userErrors?.length > 0) {
        console.error(`  ❌ userErrors:`, JSON.stringify(result.userErrors, null, 2));
        errorCount += batch.length;
      } else {
        const updated = result?.metafields?.length ?? 0;
        console.log(`  ✅ ${updated}개 업데이트 완료`);
        successCount += updated;
      }
    } catch (err) {
      console.error(`  ❌ 배치 오류:`, err);
      errorCount += batch.length;
    }

    // Rate limit 방지
    if (i < batches.length - 1) await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n📊 결과: 성공 ${successCount}개 / 실패 ${errorCount}개`);
  if (errorCount === 0) {
    console.log('✅ 완료! Google Merchant Center에서 상품 재검토를 기다려주세요.');
  }
}

main().catch(err => {
  console.error('❌ 스크립트 오류:', err);
  process.exit(1);
});
