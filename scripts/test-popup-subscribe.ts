/**
 * 팝업 이메일 등록이 Shopify에 어떻게 들어가는지 확인하는 테스트 스크립트.
 * api/popup-subscribe(예정)와 같은 방식으로 고객 1명을 만든다:
 *   - 비밀번호 없는 고객 기록 생성
 *   - 이메일 마케팅 수신: 구독됨 (싱글 옵트인 — 확인 메일 없음)
 *   - 태그 popup-subscribe
 * 고객에게 메일을 보내지 않는다.
 *
 * 사용법:
 *   npx tsx scripts/test-popup-subscribe.ts --email 주소           # 미리보기 (아무것도 만들지 않음)
 *   npx tsx scripts/test-popup-subscribe.ts --email 주소 --apply   # 실제 생성
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
const emailArgIndex = process.argv.indexOf('--email');
const EMAIL = (emailArgIndex > -1 ? process.argv[emailArgIndex + 1] : '').trim().toLowerCase();
const TAG = 'popup-subscribe';

async function getAccessToken(): Promise<string> {
  const res = await fetch(`https://${STORE_DOMAIN}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  });
  if (!res.ok) throw new Error(`토큰 요청 실패 (${res.status}): ${await res.text()}`);
  return ((await res.json()) as { access_token: string }).access_token;
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

interface CustomerView {
  id: string;
  email: string;
  state: string;
  tags: string[];
  numberOfOrders: string;
  createdAt: string;
  emailMarketingConsent: { marketingState: string; marketingOptInLevel: string | null } | null;
}

const CUSTOMER_FIELDS = `id email state tags numberOfOrders createdAt emailMarketingConsent { marketingState marketingOptInLevel }`;

function show(c: CustomerView) {
  const numericId = c.id.split('/').pop();
  console.log(`  이메일: ${c.email}`);
  console.log(`  계정 상태: ${c.state}`);
  console.log(`  마케팅 수신: ${c.emailMarketingConsent?.marketingState ?? '-'} (${c.emailMarketingConsent?.marketingOptInLevel ?? '-'})`);
  console.log(`  태그: ${c.tags.join(', ') || '(없음)'}`);
  console.log(`  주문 수: ${c.numberOfOrders} · 생성: ${c.createdAt}`);
  console.log(`  어드민: https://admin.shopify.com/store/${STORE_DOMAIN.replace('.myshopify.com', '')}/customers/${numericId}`);
}

async function main() {
  if (!EMAIL || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(EMAIL)) throw new Error('--email 주소 필요');
  if (!STORE_DOMAIN || !CLIENT_ID || !CLIENT_SECRET) throw new Error('.env.local 자격증명 필요');
  console.log(`스토어: ${STORE_DOMAIN} · ${APPLY ? '실제 생성' : '미리보기 (--apply 없으면 아무것도 만들지 않음)'}`);
  const token = await getAccessToken();

  const found = await gql<{ customers: { nodes: CustomerView[] } }>(
    token,
    `query($q: String!) { customers(first: 1, query: $q) { nodes { ${CUSTOMER_FIELDS} } } }`,
    { q: `email:"${EMAIL}"` },
  );
  const existing = found.customers.nodes[0];
  if (existing) {
    console.log('이미 있는 고객 — 팝업에서는 새로 만들지 않고 코드만 보여준다:');
    show(existing);
    return;
  }

  console.log(`생성 예정: ${EMAIL} · 마케팅 수신 구독됨(싱글 옵트인) · 태그 ${TAG} · 메일 발송 없음`);
  if (!APPLY) return;

  const created = await gql<{ customerCreate: { customer: CustomerView | null; userErrors: { field: string[] | null; message: string }[] } }>(
    token,
    `mutation($input: CustomerInput!) {
      customerCreate(input: $input) {
        customer { ${CUSTOMER_FIELDS} }
        userErrors { field message }
      }
    }`,
    {
      input: {
        email: EMAIL,
        tags: [TAG],
        emailMarketingConsent: {
          marketingState: 'SUBSCRIBED',
          marketingOptInLevel: 'SINGLE_OPT_IN',
          consentUpdatedAt: new Date().toISOString(),
        },
      },
    },
  );
  const r = created.customerCreate;
  if (r.userErrors.length) throw new Error(`고객 생성 실패: ${JSON.stringify(r.userErrors)}`);
  console.log('생성 완료:');
  if (r.customer) show(r.customer);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
