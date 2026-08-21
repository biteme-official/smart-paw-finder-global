import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import { createSign } from 'crypto';

const ALLOWED_ORIGINS = ['https://biteme.one', 'https://www.biteme.one', 'http://localhost:5173'];
function getCorsOrigin(req: VercelRequest): string {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (/^https:\/\/smart-paw-finder[a-z0-9-]*\.vercel\.app$/.test(origin)) return origin;
  return ALLOWED_ORIGINS[0];
}

function checkAdmin(req: VercelRequest): boolean {
  return (req.headers['x-admin-key'] as string) === process.env.B2B_ADMIN_PASSWORD;
}

const SOCIAL_PLATFORMS = ['Instagram', 'TikTok'];

// ─── Google Sheets logging ───
// Reuses the same service account as GA4 (api/analytics.ts). Share the target
// spreadsheet with that service account's client_email as an Editor for this to work.
const GOOGLE_SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
const AFFILIATE_SHEET_ID = process.env.AFFILIATE_SHEET_ID || '1hIKdC_afPFTp1CkPzEwBwx4rtDpRZJD3LXpoeRd_HRM';
const AFFILIATE_SHEET_GID = process.env.AFFILIATE_SHEET_GID || '0';

let sheetsToken: string | null = null;
let sheetsTokenExpiresAt = 0;

async function getSheetsAccessToken(): Promise<string> {
  const now = Date.now();
  if (sheetsToken && now < sheetsTokenExpiresAt - 60_000) return sheetsToken;

  const sa = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
  const iat = Math.floor(now / 1000);
  const exp = iat + 3600;

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
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

  if (!res.ok) throw new Error(`Sheets token error: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  sheetsToken = data.access_token;
  sheetsTokenExpiresAt = now + data.expires_in * 1000;
  return sheetsToken!;
}

let cachedSheetTitle: string | null = null;

async function getSheetTitle(token: string): Promise<string> {
  if (cachedSheetTitle) return cachedSheetTitle;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${AFFILIATE_SHEET_ID}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Sheets metadata error: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const sheet = (data.sheets || []).find(
    (s: { properties: { sheetId: number; title: string } }) => String(s.properties.sheetId) === AFFILIATE_SHEET_GID,
  );
  if (!sheet) throw new Error(`Sheet with gid=${AFFILIATE_SHEET_GID} not found`);
  cachedSheetTitle = sheet.properties.title;
  return cachedSheetTitle!;
}

function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function appendApplicationRow(row: {
  submittedAt: Date;
  email: string;
  petName: string;
  accounts: { platform: string; account: string }[];
}) {
  const instagram = row.accounts
    .filter((a) => a.platform === 'Instagram')
    .map((a) => `@${a.account}`)
    .join(', ');
  const tiktok = row.accounts
    .filter((a) => a.platform === 'TikTok')
    .map((a) => `@${a.account}`)
    .join(', ');

  const token = await getSheetsAccessToken();
  const title = await getSheetTitle(token);
  const range = encodeURIComponent(`${title}!A:E`);

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${AFFILIATE_SHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        values: [[formatTimestamp(row.submittedAt), row.email, row.petName, instagram, tiktok]],
      }),
    },
  );
  if (!res.ok) throw new Error(`Sheets append error: ${(await res.text()).slice(0, 300)}`);
}

async function handleApply(req: VercelRequest, res: VercelResponse) {
  const { socialAccounts, email, petName } = req.body || {};
  if (!Array.isArray(socialAccounts) || socialAccounts.length === 0 || !email || !petName) {
    return res.status(400).json({ error: 'At least one social account, email, and pet name are required.' });
  }

  const normalizedAccounts = [];
  for (const entry of socialAccounts) {
    const platform = String(entry?.platform || '');
    const account = String(entry?.account || '').replace(/^@/, '').trim();
    if (!SOCIAL_PLATFORMS.includes(platform) || !account) {
      return res.status(400).json({ error: 'Each social account needs a valid platform and account name.' });
    }
    normalizedAccounts.push({ platform, account });
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const normalizedPetName = String(petName).trim();
  if (!normalizedEmail || !normalizedPetName) {
    return res.status(400).json({ error: 'At least one social account, email, and pet name are required.' });
  }

  const existingId = await kv.get<string>(`affiliate:email:${normalizedEmail}`);
  if (existingId) return res.status(409).json({ error: 'An application with this email already exists.' });

  const id = `aff_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = new Date();
  const now = createdAt.toISOString();
  const couponCode = `${normalizedPetName.toUpperCase().replace(/[^A-Z0-9]/g, '')}15`;
  await Promise.all([
    kv.set(`affiliate:app:${id}`, {
      id,
      socialAccounts: normalizedAccounts,
      email: normalizedEmail,
      petName: normalizedPetName,
      couponCode,
      status: 'pending',
      createdAt: now,
    }),
    kv.set(`affiliate:email:${normalizedEmail}`, id),
    kv.sadd('affiliate:ids', id),
  ]);

  try {
    await appendApplicationRow({
      submittedAt: createdAt,
      email: normalizedEmail,
      petName: normalizedPetName,
      accounts: normalizedAccounts,
    });
  } catch (e) {
    // Application is already saved in KV; don't fail the request if the sheet log fails.
    console.error('[Affiliate] Sheets append failed:', e);
  }

  return res.status(200).json({ success: true, id, couponCode });
}

async function handleList(req: VercelRequest, res: VercelResponse) {
  if (!checkAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  const ids = await kv.smembers('affiliate:ids');
  const apps = await Promise.all(ids.map((id) => kv.get(`affiliate:app:${id}`)));
  return res.status(200).json({ applications: apps.filter(Boolean) });
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
      case 'apply':
        return handleApply(req, res);
      case 'list':
        return handleList(req, res);
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (e) {
    console.error('[Affiliate] Error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
