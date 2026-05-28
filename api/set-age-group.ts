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

const GET_ALL_PRODUCT_IDS = `
  query GetProductIds($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges { node { id } }
    }
  }
`;

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

async function adminGQL(token: string, query: string, variables: Record<string, unknown>) {
  const res = await fetch(`https://${STORE_DOMAIN}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}`);
  return res.json();
}

async function fetchAllProductIds(token: string): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | null = null;

  while (true) {
    const data = await adminGQL(token, GET_ALL_PRODUCT_IDS, {
      first: 250,
      after: cursor,
    });
    const products = data?.data?.products;
    if (!products) break;

    for (const edge of products.edges) {
      // GID → numeric ID
      ids.push(edge.node.id.split('/').pop()!);
    }

    if (!products.pageInfo.hasNextPage) break;
    cursor = products.pageInfo.endCursor;
    await new Promise(r => setTimeout(r, 200));
  }

  return ids;
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

    // 전체 상품 ID 조회
    const allIds = await fetchAllProductIds(token);

    // 25개씩 배치로 메타필드 설정
    const batches = chunk(allIds, 25);
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

      const data = await adminGQL(token, METAFIELDS_SET_MUTATION, { metafields });
      const result = data?.data?.metafieldsSet;

      if (result?.userErrors?.length > 0) {
        errors.push(...result.userErrors);
      } else {
        successCount += result?.metafields?.length ?? 0;
      }

      await new Promise(r => setTimeout(r, 300));
    }

    return res.status(200).json({
      success: true,
      updated: successCount,
      total: allIds.length,
      errors,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
