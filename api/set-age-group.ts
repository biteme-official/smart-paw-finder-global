import type { VercelRequest, VercelResponse } from '@vercel/node';

const STORE_DOMAIN = process.env.VITE_SHOPIFY_STORE_DOMAIN!;
const CLIENT_ID = process.env.VITE_SHOPIFY_CLIENT_ID!;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET!;
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
const API_VERSION = '2025-07';

const ALLOWED_ORIGINS = [
  'https://biteme.one',
  'https://www.biteme.one',
  'http://localhost:5173',
];

function getCorsOrigin(req: VercelRequest): string {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (/^https:\/\/smart-paw-finder[a-z0-9-]*\.vercel\.app$/.test(origin)) return origin;
  return ALLOWED_ORIGINS[0];
}

// Google Merchant Center - Missing age_group 대상 상품 ID
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

const METAFIELDS_SET_MUTATION = `
  mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { key namespace value }
      userErrors { field message }
    }
  }
`;

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
  if (!res.ok) throw new Error(`Token error: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const corsOrigin = getCorsOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = req.headers.authorization || '';
  if (ADMIN_SECRET && auth !== `Bearer ${ADMIN_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const token = await getAccessToken();
    const batches = chunk(PRODUCT_IDS, 25);
    let successCount = 0;
    const errors: unknown[] = [];

    for (const batch of batches) {
      const metafields = batch.map(id => ({
        ownerId: `gid://shopify/Product/${id}`,
        namespace: 'shopify',
        key: 'recommended-age-group',
        value: '["Adult"]',
        type: 'list.single_line_text_field',
      }));

      const r = await fetch(`https://${STORE_DOMAIN}/admin/api/${API_VERSION}/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': token,
        },
        body: JSON.stringify({ query: METAFIELDS_SET_MUTATION, variables: { metafields } }),
      });

      const data = await r.json();
      const result = data?.data?.metafieldsSet;

      if (result?.userErrors?.length > 0) {
        errors.push(...result.userErrors);
      } else {
        successCount += result?.metafields?.length ?? 0;
      }

      await new Promise(resolve => setTimeout(resolve, 300));
    }

    return res.status(200).json({
      success: true,
      updated: successCount,
      total: PRODUCT_IDS.length,
      errors,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
