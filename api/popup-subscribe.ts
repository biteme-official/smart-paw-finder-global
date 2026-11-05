import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

// B2C 첫구매 쿠폰 팝업 — 이메일을 Shopify 고객(구독자)으로 등록한다 (#196).
// 비밀번호 없는 고객 기록 + 이메일 마케팅 구독됨(싱글 옵트인, 확인 메일 없음) + 태그 popup-subscribe.
// 이미 있는 고객: 태그를 붙이고, 수신 동의를 한 적 없으면(NOT_SUBSCRIBED·PENDING) 구독됨으로 바꾼다.
// 예전에 수신 거부(UNSUBSCRIBED)한 고객은 수신 상태를 바꾸지 않는다. 고객에게 메일을 보내지 않는다.
// site-b2c 태그는 붙이지 않는다 — 로그인한 고객 표시용(zeoy 설계안: 팝업만 = popup-subscribe만).
// Self-contained like every other function in api/ — server/popup-subscribe-proxy.ts가 subscribeEmail을 재사용한다.

const API_VERSION = '2025-07';
const TAG = 'popup-subscribe';
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT = 5; // 같은 IP 1분에 5회까지
const RATE_WINDOW_SECONDS = 60;

let cachedAdminToken: string | null = null;
let adminTokenExpiresAt = 0;

async function getAdminToken(): Promise<string> {
  const now = Date.now();
  if (cachedAdminToken && now < adminTokenExpiresAt - 5 * 60 * 1000) return cachedAdminToken;
  const shop = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.VITE_SHOPIFY_CLIENT_ID!,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET!,
    }),
  });
  if (!res.ok) throw new Error(`Token request failed (${res.status})`);
  const data = await res.json();
  cachedAdminToken = data.access_token;
  adminTokenExpiresAt = now + data.expires_in * 1000;
  return cachedAdminToken!;
}

async function adminGraphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const shop = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const res = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': await getAdminToken() },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.errors) {
    throw new Error(`Admin API error (${res.status}): ${JSON.stringify(json?.errors ?? json)}`);
  }
  return json.data as T;
}

export type SubscribeResult = 'created' | 'existing';

const SUBSCRIBED_CONSENT = () => ({
  marketingState: 'SUBSCRIBED',
  marketingOptInLevel: 'SINGLE_OPT_IN',
  consentUpdatedAt: new Date().toISOString(),
});

// 이미 있는 고객: 태그 추가 + 수신 동의를 한 적 없으면 구독 처리 (수신 거부 고객은 그대로)
async function updateExisting(id: string, marketingState: string | null): Promise<void> {
  await adminGraphql(
    `mutation($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { userErrors { field message } } }`,
    { id, tags: [TAG] },
  );
  if (marketingState !== 'NOT_SUBSCRIBED' && marketingState !== 'PENDING') return;
  const res = await adminGraphql<{ customerEmailMarketingConsentUpdate: { userErrors: { message: string }[] } }>(
    `mutation($input: CustomerEmailMarketingConsentUpdateInput!) {
      customerEmailMarketingConsentUpdate(input: $input) { userErrors { field message } }
    }`,
    { input: { customerId: id, emailMarketingConsent: SUBSCRIBED_CONSENT() } },
  );
  const errors = res.customerEmailMarketingConsentUpdate.userErrors;
  if (errors.length) throw new Error(`consent update failed: ${JSON.stringify(errors)}`);
}

// 이메일을 구독자로 등록
export async function subscribeEmail(rawEmail: string): Promise<SubscribeResult> {
  const email = rawEmail.trim().toLowerCase();
  const found = await adminGraphql<{
    customers: { nodes: { id: string; emailMarketingConsent: { marketingState: string } | null }[] };
  }>(
    `query($q: String!) { customers(first: 1, query: $q) { nodes { id emailMarketingConsent { marketingState } } } }`,
    { q: `email:"${email.replace(/"/g, '')}"` },
  );
  const existing = found.customers.nodes[0];
  if (existing) {
    await updateExisting(existing.id, existing.emailMarketingConsent?.marketingState ?? null);
    return 'existing';
  }

  const created = await adminGraphql<{
    customerCreate: { customer: { id: string } | null; userErrors: { field: string[] | null; message: string }[] };
  }>(
    `mutation($input: CustomerInput!) {
      customerCreate(input: $input) { customer { id } userErrors { field message } }
    }`,
    {
      input: {
        email,
        tags: [TAG],
        emailMarketingConsent: SUBSCRIBED_CONSENT(),
      },
    },
  );
  const errors = created.customerCreate.userErrors;
  // 조회와 생성 사이에 같은 이메일이 먼저 만들어진 경우 — 이미 있는 고객으로 본다
  if (errors.some((e) => /taken|already/i.test(e.message))) return 'existing';
  if (errors.length || !created.customerCreate.customer) {
    throw new Error(`customerCreate failed: ${JSON.stringify(errors)}`);
  }
  return 'created';
}

async function isRateLimited(ip: string): Promise<boolean> {
  if (!ip) return false;
  try {
    const key = `popup-subscribe:ip:${ip}`;
    const count = await kv.incr(key);
    if (count === 1) await kv.expire(key, RATE_WINDOW_SECONDS);
    return count > RATE_LIMIT;
  } catch {
    return false; // KV 장애 시 제한 없이 진행
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // B2B 사이트(biteme.one)에는 팝업이 없다 — 이 기능도 쓰지 않는다
  if (process.env.SITE_MODE !== 'b2c') return res.status(404).json({ error: 'Not found' });

  // 다른 사이트의 브라우저에서 보낸 요청은 거절 (Origin이 있으면 우리 사이트 주소와 같아야 함)
  const origin = String(req.headers.origin || '');
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '');
  if (origin && host) {
    let originHost = '';
    try {
      originHost = new URL(origin).host;
    } catch {
      // "null" 등 잘못된 Origin
    }
    if (originHost !== host) return res.status(403).json({ error: 'Forbidden' });
  }

  const body = (req.body ?? {}) as { email?: unknown; website?: unknown };
  // 봇용 숨김 칸이 채워졌으면 저장하지 않고 성공처럼 응답
  if (typeof body.website === 'string' && body.website.trim()) return res.status(200).json({ ok: true });

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!EMAIL_RE.test(email) || email.length > 254) return res.status(400).json({ error: 'Invalid email' });

  const ip = String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  if (await isRateLimited(ip)) return res.status(429).json({ error: 'Too many requests' });

  try {
    const result = await subscribeEmail(email);
    return res.status(200).json({ ok: true, result });
  } catch (error) {
    console.error('[Popup Subscribe] Error:', error);
    return res.status(500).json({ error: 'Subscribe failed' });
  }
}
