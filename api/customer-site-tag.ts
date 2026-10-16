import type { VercelRequest, VercelResponse } from '@vercel/node';

// B2C 사이트에 로그인한 고객에게 site-b2c 태그를 붙인다 (CRM에서 B2C 이용 고객 구분용).
// 두 사이트가 같은 Shopify 고객 목록을 쓰므로, 태그로만 B2C 이용 여부를 알 수 있다.
const SITE_TAG = 'site-b2c';
const SHOP_ID = process.env.VITE_SHOPIFY_SHOP_ID;
const API_VERSION = '2025-07';
const CUSTOMER_ACCOUNT_ENDPOINT = `https://shopify.com/${SHOP_ID}/account/customer/api/${API_VERSION}/graphql`;

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

// 요청한 고객 본인의 ID를 고객 토큰으로 확인 — 이메일을 받지 않아 다른 고객에게 태그를 붙일 수 없다.
async function getCustomerId(authHeader: string): Promise<string | null> {
  const res = await fetch(CUSTOMER_ACCOUNT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader },
    body: JSON.stringify({ query: '{ customer { id } }' }),
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return data?.data?.customer?.id ?? null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // B2B 사이트(biteme.one)에서는 아무것도 하지 않는다.
  if (process.env.SITE_MODE !== 'b2c') return res.status(200).json({ skipped: true });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });

  try {
    const customerId = await getCustomerId(authHeader);
    if (!customerId) return res.status(401).json({ error: 'Invalid customer token' });

    const shop = process.env.VITE_SHOPIFY_STORE_DOMAIN;
    const response = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': await getAdminToken() },
      body: JSON.stringify({
        query: `mutation($id:ID!,$tags:[String!]!){tagsAdd(id:$id,tags:$tags){userErrors{field message}}}`,
        variables: { id: customerId, tags: [SITE_TAG] },
      }),
    });
    const data = await response.json().catch(() => null);
    const errors = data?.errors ?? data?.data?.tagsAdd?.userErrors;
    if (!response.ok || !data || errors?.length) {
      console.error('[Customer Site Tag] tagsAdd failed:', response.status, JSON.stringify(errors));
      return res.status(502).json({ error: 'Tag update failed' });
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Customer Site Tag] Error:', error);
    return res.status(500).json({ error: 'Tag update failed' });
  }
}
