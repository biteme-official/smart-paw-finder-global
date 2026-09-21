import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createSign } from 'crypto';

// Public endpoint — returns only GA4 view counts per product (no revenue/order data),
// so unlike api/analytics.ts this does not require ADMIN_SECRET.

const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID || '';
const GOOGLE_SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';

const ALLOWED_ORIGINS = [
  'https://biteme.one',
  'https://www.biteme.one',
  'http://localhost:5173',
];

let ga4Token: string | null = null;
let ga4TokenExpiresAt = 0;

async function getGA4AccessToken(): Promise<string> {
  const now = Date.now();
  if (ga4Token && now < ga4TokenExpiresAt - 60_000) return ga4Token;

  const sa = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
  const iat = Math.floor(now / 1000);
  const exp = iat + 3600;

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat,
    exp,
  })).toString('base64url');

  const input = `${header}.${payload}`;
  const sign = createSign('RSA-SHA256');
  sign.update(input);
  const jwt = `${input}.${sign.sign(sa.private_key, 'base64url')}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!res.ok) throw new Error(`Token error: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  ga4Token = data.access_token;
  ga4TokenExpiresAt = now + data.expires_in * 1000;
  return ga4Token!;
}

async function runReport(token: string, body: object) {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) throw new Error(`GA4 error (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

interface GA4Report {
  dimensionHeaders: { name: string }[];
  metricHeaders: { name: string }[];
  rows?: { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }[];
}

function parseRows(report: GA4Report): Record<string, string | number>[] {
  return (report.rows || []).map((row) => {
    const out: Record<string, string | number> = {};
    row.dimensionValues?.forEach((v, i) => { out[report.dimensionHeaders[i].name] = v.value; });
    row.metricValues?.forEach((v, i) => { out[report.metricHeaders[i].name] = parseFloat(v.value) || 0; });
    return out;
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin || '';
  const corsOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!GA4_PROPERTY_ID || !GOOGLE_SERVICE_ACCOUNT_JSON) {
    return res.status(500).json({ error: 'GA4 not configured. Set GA4_PROPERTY_ID and GOOGLE_SERVICE_ACCOUNT_JSON env vars.' });
  }

  const limit = Math.min(Number(req.query.limit) || 30, 100);

  try {
    const token = await getGA4AccessToken();
    // itemId = Shopify product GID, set as item_id on the view_item GA4 event (see src/lib/ga4-ecommerce.ts)
    const raw = await runReport(token, {
      dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'itemId' }],
      metrics: [{ name: 'itemsViewed' }],
      orderBys: [{ metric: { metricName: 'itemsViewed' }, desc: true }],
      limit,
    });

    const items = parseRows(raw)
      .filter((row) => row.itemId)
      .map((row) => ({ productId: String(row.itemId), views: Number(row.itemsViewed) || 0 }));

    return res.status(200).json({ items });
  } catch (error) {
    console.error('[top-viewed-products]', error);
    return res.status(500).json({ error: 'Failed to fetch top viewed products' });
  }
}
