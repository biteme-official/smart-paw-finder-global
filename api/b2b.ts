import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

const ALLOWED_ORIGINS = ['https://biteme.one', 'https://www.biteme.one', 'http://localhost:5173'];
function getCorsOrigin(req: VercelRequest): string {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (/^https:\/\/smart-paw-finder[a-z0-9-]*\.vercel\.app$/.test(origin)) return origin;
  return ALLOWED_ORIGINS[0];
}

let cachedToken: string | null = null;
let tokenExpiresAt = 0;
async function getAdminToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 5 * 60 * 1000) return cachedToken;
  const shop = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const clientId = process.env.VITE_SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId!, client_secret: clientSecret! }),
  });
  if (!res.ok) throw new Error(`Token failed (${res.status})`);
  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = now + data.expires_in * 1000;
  return cachedToken!;
}

async function findCustomerAndTag(email: string, tagsToAdd: string[], tagsToRemove: string[]): Promise<{ success: boolean; customerId?: string; error?: string }> {
  try {
    const token = await getAdminToken();
    const shop = process.env.VITE_SHOPIFY_STORE_DOMAIN;
    const apiUrl = `https://${shop}/admin/api/2025-07/graphql.json`;
    const headers = { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token };

    const custRes = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: `query($q:String!){customers(first:1,query:$q){edges{node{id tags}}}}`,
        variables: { q: `email:${email}` },
      }),
    });
    const custData = await custRes.json();
    console.log('[B2B] Customer lookup for', email, JSON.stringify(custData));

    const customerId = custData.data?.customers?.edges?.[0]?.node?.id;
    if (!customerId) return { success: false, error: `Customer not found for email: ${email}` };

    if (tagsToRemove.length > 0) {
      const removeRes = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: `mutation($id:ID!,$tags:[String!]!){tagsRemove(id:$id,tags:$tags){node{id}userErrors{field message}}}`,
          variables: { id: customerId, tags: tagsToRemove },
        }),
      });
      const removeData = await removeRes.json();
      console.log('[B2B] Tags remove result:', JSON.stringify(removeData));
      const removeErrors = removeData.data?.tagsRemove?.userErrors;
      if (removeErrors?.length > 0) return { success: false, customerId, error: `Tag remove failed: ${removeErrors[0].message}` };
    }

    if (tagsToAdd.length > 0) {
      const addRes = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: `mutation($id:ID!,$tags:[String!]!){tagsAdd(id:$id,tags:$tags){node{id}userErrors{field message}}}`,
          variables: { id: customerId, tags: tagsToAdd },
        }),
      });
      const addData = await addRes.json();
      console.log('[B2B] Tags add result:', JSON.stringify(addData));
      const addErrors = addData.data?.tagsAdd?.userErrors;
      if (addErrors?.length > 0) return { success: false, customerId, error: `Tag add failed: ${addErrors[0].message}` };
    }

    return { success: true, customerId };
  } catch (e) {
    console.error('[B2B] Shopify tag error:', e);
    return { success: false, error: String(e) };
  }
}

function checkAdmin(req: VercelRequest): boolean {
  return (req.headers['x-admin-key'] as string) === process.env.B2B_ADMIN_PASSWORD;
}

async function handleApply(req: VercelRequest, res: VercelResponse) {
  const { email, representativeName, phoneNumber, address, companyName, document } = req.body || {};
  if (!email || !representativeName || !phoneNumber || !address || !companyName || !document) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  const existingId = await kv.get<string>(`b2b:email:${email.toLowerCase()}`);
  if (existingId) return res.status(409).json({ error: 'An application with this email already exists.' });

  const id = `b2b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  await Promise.all([
    kv.set(`b2b:app:${id}`, {
      id, email, representativeName, phoneNumber, address, companyName,
      documentName: document.name, documentType: document.type,
      status: 'pending', createdAt: now, updatedAt: now,
    }),
    kv.set(`b2b:doc:${id}`, { name: document.name, type: document.type, data: document.data }),
    kv.set(`b2b:email:${email.toLowerCase()}`, id),
    kv.sadd('b2b:ids', id),
  ]);
  const tagResult = await findCustomerAndTag(email, ['B2B-pending'], []);
  return res.status(200).json({ success: true, id, tagResult });
}

async function handleList(req: VercelRequest, res: VercelResponse) {
  if (!checkAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  const ids = await kv.smembers('b2b:ids');
  if (!ids || ids.length === 0) return res.status(200).json({ applications: [] });
  const keys = (ids as string[]).map((id) => `b2b:app:${id}`);
  const apps = await kv.mget(...keys);
  const valid = (apps as any[]).filter(Boolean).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return res.status(200).json({ applications: valid });
}

async function handleDetail(req: VercelRequest, res: VercelResponse) {
  if (!checkAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  const id = req.query.id as string;
  if (!id) return res.status(400).json({ error: 'Missing id' });
  const [appMeta, docData] = await Promise.all([kv.get(`b2b:app:${id}`), kv.get(`b2b:doc:${id}`)]);
  if (!appMeta) return res.status(404).json({ error: 'Application not found' });
  return res.status(200).json({ application: { ...(appMeta as any), document: docData } });
}

async function handleApprove(req: VercelRequest, res: VercelResponse) {
  if (!checkAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { id, action, reason } = req.body || {};
  if (!id || !['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'Invalid request.' });
  if (action === 'reject' && !reason?.trim()) return res.status(400).json({ error: 'Rejection reason is required.' });

  const appMeta = await kv.get<any>(`b2b:app:${id}`);
  if (!appMeta) return res.status(404).json({ error: 'Application not found' });

  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  await kv.set(`b2b:app:${id}`, {
    ...appMeta, status: newStatus,
    rejectionReason: action === 'reject' ? reason.trim() : undefined,
    updatedAt: new Date().toISOString(),
  });

  let tagResult;
  if (action === 'approve') {
    tagResult = await findCustomerAndTag(appMeta.email, ['B2B'], ['B2B-pending']);
  } else {
    tagResult = await findCustomerAndTag(appMeta.email, [], ['B2B-pending']);
  }
  return res.status(200).json({ success: true, status: newStatus, tagResult });
}

async function handleShopifyB2B(req: VercelRequest, res: VercelResponse) {
  if (!checkAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const token = await getAdminToken();
    const shop = process.env.VITE_SHOPIFY_STORE_DOMAIN;
    const apiUrl = `https://${shop}/admin/api/2025-07/graphql.json`;
    const headers = { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token };
    const fields = `id displayName email phone tags numberOfOrders amountSpent{amount currencyCode} defaultAddress{address1 city country company} createdAt`;

    let cursor: string | null = null;
    const customers: any[] = [];
    while (true) {
      const query = cursor
        ? `query($q:String!,$after:String){customers(first:50,query:$q,after:$after){edges{node{${fields}}cursor}pageInfo{hasNextPage}}}`
        : `query($q:String!){customers(first:50,query:$q){edges{node{${fields}}cursor}pageInfo{hasNextPage}}}`;
      const variables = cursor ? { q: 'tag:B2B', after: cursor } : { q: 'tag:B2B' };
      const r = await fetch(apiUrl, { method: 'POST', headers, body: JSON.stringify({ query, variables }) });
      const data = await r.json();
      const edges = data.data?.customers?.edges || [];
      customers.push(...edges.map((e: any) => e.node));
      if (!data.data?.customers?.pageInfo?.hasNextPage || edges.length === 0) break;
      cursor = edges[edges.length - 1].cursor;
    }

    const countryMap = await kv.hgetall('b2b:countries') || {};
    const result = customers.map((c: any) => ({
      ...c,
      businessCountry: (countryMap as Record<string, string>)[c.email?.toLowerCase()] || null,
    }));

    return res.status(200).json({ customers: result });
  } catch (e) {
    console.error('[B2B] Shopify B2B list error:', e);
    return res.status(500).json({ error: 'Failed to fetch Shopify B2B customers' });
  }
}

async function handleUpdateCountry(req: VercelRequest, res: VercelResponse) {
  if (!checkAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { email, country } = req.body || {};
  if (!email || !country) return res.status(400).json({ error: 'email and country are required' });

  try {
    await kv.hset('b2b:countries', { [email.toLowerCase()]: country });
    return res.status(200).json({ success: true, country });
  } catch (e) {
    console.error('[B2B] Update country error:', e);
    return res.status(500).json({ error: 'Failed to update country' });
  }
}

async function handleGetDiscountRate(_req: VercelRequest, res: VercelResponse) {
  const rate = await kv.get<number>('b2b:discount-rate');
  return res.status(200).json({ rate: rate ?? 0.60 });
}

async function handleSetDiscountRate(req: VercelRequest, res: VercelResponse) {
  if (!checkAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { rate } = req.body || {};
  if (typeof rate !== 'number' || rate < 0 || rate > 1) {
    return res.status(400).json({ error: 'rate must be a number between 0 and 1' });
  }
  await kv.set('b2b:discount-rate', rate);
  return res.status(200).json({ success: true, rate });
}

async function handleStatus(req: VercelRequest, res: VercelResponse) {
  const email = req.query.email as string;
  if (!email) return res.status(200).json({ status: 'none' });
  const appId = await kv.get<string>(`b2b:email:${email.toLowerCase()}`);
  if (!appId) return res.status(200).json({ status: 'none' });
  const app = await kv.get<any>(`b2b:app:${appId}`);
  if (!app) return res.status(200).json({ status: 'none' });
  return res.status(200).json({ status: app.status, rejectionReason: app.rejectionReason || null, companyName: app.companyName, createdAt: app.createdAt });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cors = getCorsOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', cors);
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');
    return res.status(200).end();
  }

  const action = req.query.action as string;
  try {
    switch (action) {
      case 'apply': return handleApply(req, res);
      case 'list': return handleList(req, res);
      case 'detail': return handleDetail(req, res);
      case 'approve': return handleApprove(req, res);
      case 'status': return handleStatus(req, res);
      case 'shopify-b2b': return handleShopifyB2B(req, res);
      case 'update-country': return handleUpdateCountry(req, res);
      case 'get-discount-rate': return handleGetDiscountRate(req, res);
      case 'set-discount-rate': return handleSetDiscountRate(req, res);
      default: return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (e) {
    console.error('[B2B] Error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
