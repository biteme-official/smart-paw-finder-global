/**
 * B2C 첫구매 쿠폰 팝업용 메타객체 정의(email_popup)와 기본 항목 1개를 만든다.
 * 운영값(문구·이미지·쿠폰 코드·노출 기간)은 이후 Shopify 어드민 › 콘텐츠 › 메타객체에서 바꾼다.
 *
 * 사용법:
 *   npx tsx scripts/create-email-popup-metaobject.ts          # 미리보기 (아무것도 만들지 않음)
 *   npx tsx scripts/create-email-popup-metaobject.ts --apply  # 실제 생성
 *
 * 이미 정의·항목이 있으면 건너뛴다(덮어쓰지 않음). 기본 항목은 '미노출' + 쿠폰 코드 비움 상태라
 * 만들어도 사이트에는 아무것도 뜨지 않는다.
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
const APPLY = process.argv.includes('--apply');

const TYPE = 'email_popup';
const ENTRY_HANDLE = 'b2c-first-order';

interface FieldDef {
  key: string;
  name: string;
  description: string;
  type: string;
  validations?: { name: string; value: string }[];
}

// 키는 src/lib/shopify.ts fetchEmailPopupConfig()가 읽는 이름과 같아야 한다
const FIELDS: FieldDef[] = [
  { key: 'title', name: '관리용 이름', description: '어드민 목록에서 구분용. 팝업 1단계 제목은 아래 “1단계 제목”', type: 'single_line_text_field' },
  { key: 'active', name: '노출', description: '“노출”일 때만 사이트에 뜸', type: 'single_line_text_field', validations: [{ name: 'choices', value: JSON.stringify(['노출', '미노출']) }] },
  { key: 'start_at', name: '시작 일시', description: '비우면 바로', type: 'date_time' },
  { key: 'end_at', name: '종료 일시', description: '비우면 계속', type: 'date_time' },
  { key: 'coupon_code', name: '쿠폰 코드', description: 'Shopify 할인 코드와 철자가 같아야 함. 비우면 팝업이 뜨지 않음', type: 'single_line_text_field' },
  { key: 'discount_label', name: '할인 표시', description: '예: 10%. 문구의 {pct} 자리에 들어감', type: 'single_line_text_field' },
  { key: 'delay_seconds', name: '진입 후 몇 초 뒤 노출', description: '기본 5', type: 'number_integer' },
  { key: 'hide_days', name: '탭 닫으면 며칠 숨김', description: '기본 7', type: 'number_integer' },
  { key: 'image_pc', name: 'PC 이미지', description: '왼쪽 절반을 채움(세로형 약 400×520). 비우면 폼만 작게', type: 'file_reference', validations: [{ name: 'file_type_options', value: JSON.stringify(['Image']) }] },
  { key: 'featured_product', name: '대표 상품', description: 'PC 이미지가 비면 이 상품의 대표 사진을 씀. SHOP NOW가 이 상품으로 연결', type: 'product_reference' },
  { key: 'image_mobile', name: '모바일 이미지', description: '모바일 시트 상단. 비우면 이미지 없음', type: 'file_reference', validations: [{ name: 'file_type_options', value: JSON.stringify(['Image']) }] },
  { key: 'image_badge', name: '이미지 위 배지', description: '예: NEW MEMBER ONLY. 비우면 안 보임(글자가 그려진 소재면 비우기)', type: 'single_line_text_field' },
  { key: 'image_headline', name: '이미지 위 제목', description: '줄바꿈 가능. 비우면 안 보임', type: 'multi_line_text_field' },
  { key: 'image_button', name: '이미지 아래 버튼', description: '예: SHOP NOW. 비우면 안 보임', type: 'single_line_text_field' },
  { key: 'form_title', name: '1단계 제목', description: '{pct} = 할인 표시. 줄바꿈 가능', type: 'multi_line_text_field' },
  { key: 'subtitle', name: '1단계 설명', description: '', type: 'multi_line_text_field' },
  { key: 'success_title', name: '2단계 제목', description: '{pct} 사용 가능. 줄바꿈 가능', type: 'multi_line_text_field' },
  { key: 'success_message', name: '2단계 설명', description: '', type: 'multi_line_text_field' },
  { key: 'code_note', name: '코드 아래 안내', description: '예: Valid on your first order only.', type: 'single_line_text_field' },
  { key: 'excluded_paths', name: '안 뜨는 페이지', description: '주소 앞부분. 비우면 기본 목록(/cart, /checkout, /mypage, /affiliate, /a/, /auth, /manage, /admin, /discount)', type: 'list.single_line_text_field' },
];

// 기본 항목 — zeoy 설계안(11/4) 문구. 미노출 + 쿠폰 코드 비움
const ENTRY_FIELDS: { key: string; value: string }[] = [
  { key: 'title', value: 'B2C 첫구매 쿠폰 팝업' },
  { key: 'active', value: '미노출' },
  { key: 'discount_label', value: '10%' },
  { key: 'delay_seconds', value: '5' },
  { key: 'hide_days', value: '7' },
  { key: 'image_badge', value: 'NEW MEMBER ONLY' },
  { key: 'image_headline', value: 'Toys & treats\nyour dog will love' },
  { key: 'image_button', value: 'SHOP NOW' },
  { key: 'form_title', value: 'Sign up & get {pct} off\nyour first order' },
  { key: 'subtitle', value: 'Join our list for exclusive deals and new arrivals for your pup.' },
  { key: 'success_title', value: "You're in!\nHere is your code!" },
  { key: 'success_message', value: 'Tap the code to copy it. It will be applied at checkout.' },
  { key: 'code_note', value: 'Valid on your first order only.' },
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
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function gql<T>(token: string, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`https://${STORE_DOMAIN}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as { data?: T; errors?: unknown };
  if (!res.ok || json.errors) throw new Error(`GraphQL 오류 (${res.status}): ${JSON.stringify(json.errors ?? json)}`);
  return json.data as T;
}

// --product <상품 handle>: 기본 항목의 대표 상품을 지정 (예: biteme-jumping-boogie-auto-ball-toy)
const productArgIndex = process.argv.indexOf('--product');
const PRODUCT_HANDLE = productArgIndex > -1 ? process.argv[productArgIndex + 1] : '';

async function setFeaturedProduct(token: string, entryId: string) {
  const found = await gql<{ productByIdentifier: { id: string; title: string; status: string } | null }>(
    token,
    `query($handle: String!) { productByIdentifier(identifier: { handle: $handle }) { id title status } }`,
    { handle: PRODUCT_HANDLE },
  );
  const product = found.productByIdentifier;
  if (!product) throw new Error(`상품을 찾지 못함: ${PRODUCT_HANDLE}`);
  console.log(`대표 상품 지정 예정: ${product.title} (${product.status})`);
  if (!APPLY) return;
  const res = await gql<{ metaobjectUpdate: { userErrors: { field: string[]; message: string }[] } }>(
    token,
    `mutation($id: ID!, $metaobject: MetaobjectUpdateInput!) {
      metaobjectUpdate(id: $id, metaobject: $metaobject) { userErrors { field message } }
    }`,
    { id: entryId, metaobject: { fields: [{ key: 'featured_product', value: product.id }] } },
  );
  if (res.metaobjectUpdate.userErrors.length) throw new Error(`대표 상품 지정 실패: ${JSON.stringify(res.metaobjectUpdate.userErrors)}`);
  console.log('대표 상품 지정 완료');
}

// --update-copy: 기존 항목의 팝업 문구(1·2단계 제목·설명)를 위 기본 문구로 덮어쓴다
const UPDATE_COPY = process.argv.includes('--update-copy');
const COPY_KEYS = ['form_title', 'subtitle', 'success_title', 'success_message'];

async function updateCopy(token: string, entryId: string) {
  const fields = ENTRY_FIELDS.filter((f) => COPY_KEYS.includes(f.key));
  console.log('문구 덮어쓰기 예정:');
  for (const f of fields) console.log(`  - ${f.key}: ${f.value.replace(/\n/g, ' / ')}`);
  if (!APPLY) return;
  const res = await gql<{ metaobjectUpdate: { userErrors: { field: string[]; message: string }[] } }>(
    token,
    `mutation($id: ID!, $metaobject: MetaobjectUpdateInput!) {
      metaobjectUpdate(id: $id, metaobject: $metaobject) { userErrors { field message } }
    }`,
    { id: entryId, metaobject: { fields } },
  );
  if (res.metaobjectUpdate.userErrors.length) throw new Error(`문구 변경 실패: ${JSON.stringify(res.metaobjectUpdate.userErrors)}`);
  console.log('문구 변경 완료');
}

async function main() {
  if (!STORE_DOMAIN || !CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('.env.local에 VITE_SHOPIFY_STORE_DOMAIN / VITE_SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET 필요');
  }
  console.log(`스토어: ${STORE_DOMAIN} · ${APPLY ? '실제 생성' : '미리보기 (--apply 없으면 아무것도 만들지 않음)'}`);
  const token = await getAccessToken();

  // 1. 정의
  const existing = await gql<{ metaobjectDefinitionByType: { id: string; fieldDefinitions: { key: string }[] } | null }>(
    token,
    `query($type: String!) { metaobjectDefinitionByType(type: $type) { id fieldDefinitions { key } } }`,
    { type: TYPE },
  );

  if (existing.metaobjectDefinitionByType) {
    const def = existing.metaobjectDefinitionByType;
    const have = new Set(def.fieldDefinitions.map((f) => f.key));
    const missing = FIELDS.filter((f) => !have.has(f.key));
    console.log(`정의 이미 있음 (${def.id})${missing.length ? ` · 추가할 필드: ${missing.map((f) => f.key).join(', ')}` : ' · 필드 모두 있음'}`);
    // 기존 필드·값은 건드리지 않고 없는 필드만 추가
    if (APPLY && missing.length) {
      const updated = await gql<{ metaobjectDefinitionUpdate: { userErrors: { field: string[]; message: string }[] } }>(
        token,
        `mutation($id: ID!, $definition: MetaobjectDefinitionUpdateInput!) {
          metaobjectDefinitionUpdate(id: $id, definition: $definition) {
            userErrors { field message }
          }
        }`,
        {
          id: def.id,
          definition: {
            fieldDefinitions: missing.map((f) => ({
              create: { key: f.key, name: f.name, description: f.description || null, type: f.type, validations: f.validations ?? [] },
            })),
          },
        },
      );
      if (updated.metaobjectDefinitionUpdate.userErrors.length) {
        throw new Error(`필드 추가 실패: ${JSON.stringify(updated.metaobjectDefinitionUpdate.userErrors)}`);
      }
      console.log(`필드 추가 완료: ${missing.map((f) => f.key).join(', ')}`);
    }
  } else {
    console.log(`정의 생성 예정: type=${TYPE}, 필드 ${FIELDS.length}개`);
    for (const f of FIELDS) console.log(`  - ${f.key} (${f.type}) ${f.name}`);
    if (APPLY) {
      const created = await gql<{ metaobjectDefinitionCreate: { metaobjectDefinition: { id: string } | null; userErrors: { field: string[]; message: string }[] } }>(
        token,
        `mutation($definition: MetaobjectDefinitionCreateInput!) {
          metaobjectDefinitionCreate(definition: $definition) {
            metaobjectDefinition { id }
            userErrors { field message }
          }
        }`,
        {
          definition: {
            type: TYPE,
            name: 'Email popup (B2C 첫구매 쿠폰)',
            description: 'biteme-us.com 첫구매 쿠폰 · 이메일 수집 팝업 운영 설정. “노출”이면서 기간 안인 첫 항목이 사용됨',
            displayNameKey: 'title',
            fieldDefinitions: FIELDS.map((f) => ({
              key: f.key,
              name: f.name,
              description: f.description || null,
              type: f.type,
              validations: f.validations ?? [],
            })),
          },
        },
      );
      const r = created.metaobjectDefinitionCreate;
      if (r.userErrors.length) throw new Error(`정의 생성 실패: ${JSON.stringify(r.userErrors)}`);
      console.log(`정의 생성 완료: ${r.metaobjectDefinition?.id}`);
    }
  }

  // 2. 기본 항목
  if (!APPLY && !existing.metaobjectDefinitionByType) {
    console.log(`항목 생성 예정: handle=${ENTRY_HANDLE} (미노출, 쿠폰 코드 비움)`);
    return;
  }
  const entry = await gql<{ metaobjectByHandle: { id: string } | null }>(
    token,
    `query($handle: MetaobjectHandleInput!) { metaobjectByHandle(handle: $handle) { id } }`,
    { handle: { type: TYPE, handle: ENTRY_HANDLE } },
  );
  if (entry.metaobjectByHandle) {
    console.log(`항목 이미 있음 (${entry.metaobjectByHandle.id})`);
    if (PRODUCT_HANDLE) await setFeaturedProduct(token, entry.metaobjectByHandle.id);
    if (UPDATE_COPY) await updateCopy(token, entry.metaobjectByHandle.id);
    return;
  }
  console.log(`항목 생성 예정: handle=${ENTRY_HANDLE} (미노출, 쿠폰 코드 비움)`);
  if (!APPLY) return;
  const createdEntry = await gql<{ metaobjectCreate: { metaobject: { id: string } | null; userErrors: { field: string[]; message: string }[] } }>(
    token,
    `mutation($metaobject: MetaobjectCreateInput!) {
      metaobjectCreate(metaobject: $metaobject) {
        metaobject { id }
        userErrors { field message }
      }
    }`,
    { metaobject: { type: TYPE, handle: ENTRY_HANDLE, fields: ENTRY_FIELDS } },
  );
  const e = createdEntry.metaobjectCreate;
  if (e.userErrors.length) throw new Error(`항목 생성 실패: ${JSON.stringify(e.userErrors)}`);
  console.log(`항목 생성 완료: ${e.metaobject?.id}`);
  console.log('다음: 어드민 › 콘텐츠 › 메타객체 › Email popup에서 쿠폰 코드·이미지 입력 후 “노출”로 변경');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
