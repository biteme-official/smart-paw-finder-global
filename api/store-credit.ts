import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_ORIGINS = [
  'https://biteme.one',
  'https://www.biteme.one',
  'http://localhost:5173',
  'http://localhost:5174',
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

let cachedAdminToken: string | null = null;
let adminTokenExpiresAt: number = 0;

async function getAdminToken(): Promise<string> {
  const now = Date.now();
  if (cachedAdminToken && now < adminTokenExpiresAt - 5 * 60 * 1000) {
    return cachedAdminToken;
  }

  const shop = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const clientId = process.env.VITE_SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId!,
      client_secret: clientSecret!,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token request failed (${response.status})`);
  }

  const data = await response.json();
  cachedAdminToken = data.access_token;
  adminTokenExpiresAt = now + data.expires_in * 1000;
  return cachedAdminToken!;
}

const STORE_CREDIT_QUERY = `
  query CustomerStoreCredit($query: String!) {
    customers(first: 1, query: $query) {
      edges {
        node {
          id
          storeCreditAccounts(first: 1) {
            edges {
              node {
                balance { amount currencyCode }
                transactions(first: 50, reverse: true) {
                  edges {
                    node {
                      id
                      amount { amount currencyCode }
                      balanceAfterTransaction { amount currencyCode }
                      createdAt
                      type
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const corsOrigin = getCorsOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ balance: null, transactions: [] });
  }

  try {
    const adminToken = await getAdminToken();
    const shop = process.env.VITE_SHOPIFY_STORE_DOMAIN;

    const response = await fetch(`https://${shop}/admin/api/2025-07/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': adminToken,
      },
      body: JSON.stringify({
        query: STORE_CREDIT_QUERY,
        variables: { query: `email:${email}` },
      }),
    });

    if (!response.ok) {
      console.error('[Store Credit] Admin API error:', response.status);
      return res.status(200).json({ balance: null, transactions: [] });
    }

    const data = await response.json();
    const account = data.data?.customers?.edges?.[0]?.node?.storeCreditAccounts?.edges?.[0]?.node;

    if (!account) {
      return res.status(200).json({ balance: { amount: '0.0', currencyCode: 'USD' }, transactions: [] });
    }

    const transactions = (account.transactions?.edges || []).map((edge: any) => edge.node);

    return res.status(200).json({
      balance: account.balance,
      transactions,
    });
  } catch (error) {
    console.error('[Store Credit] Error:', error);
    return res.status(200).json({ balance: null, transactions: [] });
  }
}
