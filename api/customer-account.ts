import type { VercelRequest, VercelResponse } from '@vercel/node';

const SHOP_ID = process.env.VITE_SHOPIFY_SHOP_ID;
const API_VERSION = '2025-07';
const API_ENDPOINT = `https://shopify.com/${SHOP_ID}/account/customer/api/${API_VERSION}/graphql`;

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const corsOrigin = getCorsOrigin(req);

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const { query, variables } = req.body || {};
  if (!query) {
    return res.status(400).json({ error: 'Missing query' });
  }

  try {
    console.log('[Customer Account Proxy] Endpoint:', API_ENDPOINT);
    console.log('[Customer Account Proxy] SHOP_ID:', SHOP_ID || 'MISSING');

    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({ query, variables }),
    });

    const data = await response.text();
    if (!response.ok) {
      console.error('[Customer Account Proxy] Shopify responded', response.status, data.slice(0, 500));
    }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    return res.status(response.status).send(data);
  } catch (error) {
    console.error('[Customer Account Proxy] Error:', error);
    return res.status(500).json({ error: 'Customer Account API request failed' });
  }
}
