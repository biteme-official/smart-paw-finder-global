import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_ORIGINS = [
  'https://biteme.one',
  'https://www.biteme.one',
  'http://localhost:5173',
];

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^https:\/\/smart-paw-finder[a-z0-9-]*\.vercel\.app$/.test(origin)) return true;
  return false;
}

function getCorsOrigin(req: VercelRequest): string {
  const origin = req.headers.origin || '';
  return isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
}

// ── Admin token (for tags) ──
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

// ── Action: tags ──
async function handleTags(req: VercelRequest, res: VercelResponse, corsOrigin: string) {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ tags: [] });

  try {
    const adminToken = await getAdminToken();
    const shop = process.env.VITE_SHOPIFY_STORE_DOMAIN;
    const response = await fetch(`https://${shop}/admin/api/2025-07/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': adminToken },
      body: JSON.stringify({
        query: `query CustomerByEmail($query: String!) {
          customers(first: 1, query: $query) { edges { node { id tags } } }
        }`,
        variables: { query: `email:${email}` },
      }),
    });
    if (!response.ok) return res.status(200).json({ tags: [] });
    const data = await response.json();
    const tags: string[] = data.data?.customers?.edges?.[0]?.node?.tags || [];
    return res.status(200).json({ tags });
  } catch (error) {
    console.error('[Customer Tags] Error:', error);
    return res.status(200).json({ tags: [] });
  }
}

// ── Action: token ──
async function handleToken(req: VercelRequest, res: VercelResponse, corsOrigin: string) {
  const SHOP_ID = process.env.VITE_SHOPIFY_SHOP_ID;
  const clientId = process.env.VITE_SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID;

  if (!clientId || !SHOP_ID) return res.status(500).json({ error: 'Missing server configuration' });

  const { grant_type, code, redirect_uri, code_verifier, refresh_token } = req.body || {};
  const body = new URLSearchParams({ grant_type, client_id: clientId });

  if (grant_type === 'authorization_code') {
    if (!code || !redirect_uri || !code_verifier) return res.status(400).json({ error: 'Missing required parameters' });
    body.set('code', code);
    body.set('redirect_uri', redirect_uri);
    body.set('code_verifier', code_verifier);
  } else if (grant_type === 'refresh_token') {
    if (!refresh_token) return res.status(400).json({ error: 'Missing refresh_token' });
    body.set('refresh_token', refresh_token);
  } else {
    return res.status(400).json({ error: 'Unsupported grant_type' });
  }

  try {
    const response = await fetch(`https://shopify.com/authentication/${SHOP_ID}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = await response.text();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    return res.status(response.status).send(data);
  } catch (error) {
    console.error('[Customer Token Proxy] Error:', error);
    return res.status(500).json({ error: 'Token exchange failed' });
  }
}

// ── Handler ──
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const corsOrigin = getCorsOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const action = (req.query.action as string) || '';
  if (action === 'tags') return handleTags(req, res, corsOrigin);
  if (action === 'token') return handleToken(req, res, corsOrigin);
  return res.status(400).json({ error: 'Unknown action' });
}
