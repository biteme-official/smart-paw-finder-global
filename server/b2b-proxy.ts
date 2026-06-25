import type { Connect } from 'vite';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  addApplication,
  getApplicationByEmail,
  getAllApplications,
  getApplicationById,
  updateApplicationStatus,
  type B2BApplication,
} from './b2b-store';

function loadEnvPassword(): string {
  try {
    const envContent = readFileSync(resolve(process.cwd(), '.env'), 'utf-8');
    const match = envContent.match(/^B2B_ADMIN_PASSWORD=["']?(.+?)["']?\s*$/m);
    return match?.[1] || 'b2b-admin-2026';
  } catch {
    return 'b2b-admin-2026';
  }
}

let cachedAdminToken: string | null = null;
let adminTokenExpiresAt = 0;

async function getAdminToken(): Promise<string> {
  const now = Date.now();
  if (cachedAdminToken && now < adminTokenExpiresAt - 5 * 60 * 1000) {
    return cachedAdminToken;
  }
  const shop = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const clientId = process.env.VITE_SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!shop || !clientId || !clientSecret) throw new Error('Missing Shopify env vars');

  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
  });
  if (!res.ok) throw new Error(`Admin token failed (${res.status})`);
  const data = await res.json();
  cachedAdminToken = data.access_token;
  adminTokenExpiresAt = now + data.expires_in * 1000;
  return cachedAdminToken!;
}

async function findCustomerByEmail(email: string): Promise<{ id: string; tags: string[] } | null> {
  try {
    const token = await getAdminToken();
    const shop = process.env.VITE_SHOPIFY_STORE_DOMAIN;
    const res = await fetch(`https://${shop}/admin/api/2025-07/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
      body: JSON.stringify({
        query: `query($q:String!){customers(first:1,query:$q){edges{node{id tags}}}}`,
        variables: { q: `email:${email}` },
      }),
    });
    const data = await res.json();
    const node = data.data?.customers?.edges?.[0]?.node;
    return node ? { id: node.id, tags: node.tags || [] } : null;
  } catch (e) {
    console.error('[B2B] findCustomer error:', e);
    return null;
  }
}

async function modifyCustomerTags(customerId: string, tagsToAdd: string[], tagsToRemove: string[]): Promise<boolean> {
  try {
    const token = await getAdminToken();
    const shop = process.env.VITE_SHOPIFY_STORE_DOMAIN;

    if (tagsToRemove.length > 0) {
      await fetch(`https://${shop}/admin/api/2025-07/graphql.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
        body: JSON.stringify({
          query: `mutation($id:ID!,$tags:[String!]!){tagsRemove(id:$id,tags:$tags){userErrors{message}}}`,
          variables: { id: customerId, tags: tagsToRemove },
        }),
      });
    }

    if (tagsToAdd.length > 0) {
      await fetch(`https://${shop}/admin/api/2025-07/graphql.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
        body: JSON.stringify({
          query: `mutation($id:ID!,$tags:[String!]!){tagsAdd(id:$id,tags:$tags){userErrors{message}}}`,
          variables: { id: customerId, tags: tagsToAdd },
        }),
      });
    }

    return true;
  } catch (e) {
    console.error('[B2B] modifyTags error:', e);
    return false;
  }
}

function readBody(req: Connect.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

function json(res: any, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(body));
}

function checkAdminAuth(req: Connect.IncomingMessage): boolean {
  const key = (req.headers['x-admin-key'] as string) || '';
  const password = process.env.B2B_ADMIN_PASSWORD || loadEnvPassword();
  return key === password;
}

async function handleApply(req: Connect.IncomingMessage, res: any) {
  const body = JSON.parse(await readBody(req));
  const { email, representativeName, phoneNumber, address, companyName, document } = body;

  if (!email || !representativeName || !phoneNumber || !address || !companyName || !document) {
    return json(res, 400, { error: 'All fields are required.' });
  }

  const existing = getApplicationByEmail(email);
  if (existing) {
    return json(res, 409, { error: 'An application with this email already exists.' });
  }

  const id = `b2b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const app: B2BApplication = {
    id, email, representativeName, phoneNumber, address, companyName,
    document: { name: document.name, type: document.type, data: document.data },
    status: 'pending', createdAt: now, updatedAt: now,
  };
  addApplication(app);

  const customer = await findCustomerByEmail(email);
  if (customer) {
    await modifyCustomerTags(customer.id, ['B2B-pending'], []);
  }

  console.log(`[B2B] New application: ${companyName} (${email})`);
  return json(res, 200, { success: true, id });
}

async function handleList(req: Connect.IncomingMessage, res: any) {
  if (!checkAdminAuth(req)) return json(res, 401, { error: 'Unauthorized' });
  const apps = getAllApplications().map(({ document, ...rest }) => ({
    ...rest,
    documentName: document.name,
  }));
  return json(res, 200, { applications: apps });
}

async function handleDetail(req: Connect.IncomingMessage, res: any, id: string) {
  if (!checkAdminAuth(req)) return json(res, 401, { error: 'Unauthorized' });
  const app = getApplicationById(id);
  if (!app) return json(res, 404, { error: 'Application not found' });
  return json(res, 200, { application: app });
}

async function handleApprove(req: Connect.IncomingMessage, res: any) {
  if (!checkAdminAuth(req)) return json(res, 401, { error: 'Unauthorized' });
  const body = JSON.parse(await readBody(req));
  const { id, action, reason } = body;

  if (!id || !['approve', 'reject'].includes(action)) {
    return json(res, 400, { error: 'Invalid request. id and action (approve/reject) required.' });
  }

  if (action === 'reject' && !reason?.trim()) {
    return json(res, 400, { error: 'Rejection reason is required.' });
  }

  const app = updateApplicationStatus(
    id,
    action === 'approve' ? 'approved' : 'rejected',
    action === 'reject' ? reason.trim() : undefined
  );
  if (!app) return json(res, 404, { error: 'Application not found' });

  const customer = await findCustomerByEmail(app.email);
  if (customer) {
    if (action === 'approve') {
      await modifyCustomerTags(customer.id, ['B2B-approved'], ['B2B-pending']);
    } else {
      await modifyCustomerTags(customer.id, [], ['B2B-pending']);
    }
  }

  console.log(`[B2B] Application ${action}d: ${app.companyName} (${app.email}) ${reason ? `reason: ${reason}` : ''}`);
  return json(res, 200, { success: true, status: app.status });
}

async function handleStatus(req: Connect.IncomingMessage, res: any, email: string) {
  if (!email) return json(res, 400, { error: 'Email is required.' });
  const app = getApplicationByEmail(email);
  if (!app) return json(res, 200, { status: 'none' });
  return json(res, 200, {
    status: app.status,
    rejectionReason: app.rejectionReason || null,
    companyName: app.companyName,
    createdAt: app.createdAt,
  });
}

let devDiscountRate = 0.60;

export function b2bProxyMiddleware(): Connect.NextHandleFunction {
  return async (req, res, next) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'OPTIONS' && url.pathname.startsWith('/api/b2b')) {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-admin-key',
      });
      return res.end();
    }

    try {
      const action = url.searchParams.get('action');

      if (url.pathname === '/api/b2b' && action === 'get-discount-rate') {
        return json(res, 200, { rate: devDiscountRate });
      }
      if (url.pathname === '/api/b2b' && action === 'set-discount-rate' && req.method === 'POST') {
        if (!checkAdminAuth(req)) return json(res, 401, { error: 'Unauthorized' });
        const body = JSON.parse(await readBody(req));
        if (typeof body.rate !== 'number' || body.rate < 0 || body.rate > 1) {
          return json(res, 400, { error: 'rate must be between 0 and 1' });
        }
        devDiscountRate = body.rate;
        return json(res, 200, { success: true, rate: devDiscountRate });
      }

      if (req.method === 'POST' && url.pathname === '/api/b2b-apply') return handleApply(req, res);
      if (req.method === 'GET' && url.pathname === '/api/b2b-list') return handleList(req, res);
      if (req.method === 'GET' && url.pathname === '/api/b2b-detail') {
        const id = url.searchParams.get('id') || '';
        return handleDetail(req, res, id);
      }
      if (req.method === 'POST' && url.pathname === '/api/b2b-approve') return handleApprove(req, res);
      if (req.method === 'GET' && url.pathname === '/api/b2b-status') {
        const email = url.searchParams.get('email') || '';
        return handleStatus(req, res, email);
      }
    } catch (e) {
      console.error('[B2B Proxy] Error:', e);
      return json(res, 500, { error: 'Internal server error' });
    }

    return next();
  };
}
