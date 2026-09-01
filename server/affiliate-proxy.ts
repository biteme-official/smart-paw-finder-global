import type { Connect } from 'vite';
import { addApplication, getApplicationByEmail, getAllApplications, type AffiliateApplication } from './affiliate-store';
import { appendAffiliateApplicationRow, generateCouponCode, EMAIL_RE } from '../api/affiliate';

const SOCIAL_PLATFORMS = ['Instagram', 'TikTok'];

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
  if (!process.env.B2B_ADMIN_PASSWORD) return false;
  const key = (req.headers['x-admin-key'] as string) || '';
  return key === process.env.B2B_ADMIN_PASSWORD;
}

async function handleApply(req: Connect.IncomingMessage, res: any) {
  const body = JSON.parse(await readBody(req));
  const { socialAccounts, email, petName, country, acquisitionSource } = body || {};

  if (!Array.isArray(socialAccounts) || socialAccounts.length === 0 || !email || !petName) {
    return json(res, 400, { error: 'At least one social account, email, and pet name are required.' });
  }

  const normalizedAccounts: { platform: string; account: string }[] = [];
  for (const entry of socialAccounts) {
    const platform = String(entry?.platform || '');
    const account = String(entry?.account || '').replace(/^@/, '').trim();
    if (!SOCIAL_PLATFORMS.includes(platform) || !account) {
      return json(res, 400, { error: 'Each social account needs a valid platform and account name.' });
    }
    normalizedAccounts.push({ platform, account });
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const normalizedPetName = String(petName).trim();
  if (!normalizedEmail || !normalizedPetName) {
    return json(res, 400, { error: 'At least one social account, email, and pet name are required.' });
  }
  if (!EMAIL_RE.test(normalizedEmail)) {
    return json(res, 400, { error: 'Enter a valid email address.' });
  }

  if (getApplicationByEmail(normalizedEmail)) {
    return json(res, 409, { error: 'An application with this email already exists.' });
  }

  const normalizedCountry = country ? String(country).trim() : '';
  const normalizedAcquisitionSource = acquisitionSource ? String(acquisitionSource).trim() : '';

  const id = `aff_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = new Date();
  const couponCode = generateCouponCode(normalizedPetName, id);

  const app: AffiliateApplication = {
    id,
    email: normalizedEmail,
    petName: normalizedPetName,
    socialAccounts: normalizedAccounts,
    country: normalizedCountry,
    acquisitionSource: normalizedAcquisitionSource,
    couponCode,
    status: 'pending',
    createdAt: createdAt.toISOString(),
  };
  addApplication(app);

  try {
    await appendAffiliateApplicationRow({
      submittedAt: createdAt,
      email: normalizedEmail,
      petName: normalizedPetName,
      accounts: normalizedAccounts,
      country: normalizedCountry,
      acquisitionSource: normalizedAcquisitionSource,
    });
    console.log(`[Affiliate] Sheets row appended for ${normalizedEmail}`);
  } catch (e) {
    // Application is already saved locally; don't fail the request if the sheet log fails —
    // mirrors production behavior in api/affiliate.ts.
    console.error('[Affiliate] Sheets append failed (submission still succeeds):', e);
  }

  console.log(`[Affiliate] New application: ${normalizedPetName} (${normalizedEmail}) coupon=${couponCode}`);
  return json(res, 200, { success: true, id, couponCode });
}

async function handleList(req: Connect.IncomingMessage, res: any) {
  if (!checkAdminAuth(req)) return json(res, 401, { error: 'Unauthorized' });
  return json(res, 200, { applications: getAllApplications() });
}

export function affiliateProxyMiddleware(): Connect.NextHandleFunction {
  return async (req, res, next) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'OPTIONS' && url.pathname.startsWith('/api/affiliate')) {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-admin-key',
      });
      return res.end();
    }

    try {
      if (req.method === 'POST' && url.pathname === '/api/affiliate-apply') return await handleApply(req, res);
      if (req.method === 'GET' && url.pathname === '/api/affiliate-list') return await handleList(req, res);
    } catch (e) {
      console.error('[Affiliate Proxy] Error:', e);
      return json(res, 500, { error: 'Internal server error' });
    }

    return next();
  };
}
