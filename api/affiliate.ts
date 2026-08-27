import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import { createSign } from 'crypto';

// Self-contained like every other function in api/. The coupon + Sheets helpers
// are exported so server/affiliate-proxy.ts (local dev) can reuse them without a
// second copy — a previous split into api/_lib/* did not get bundled into the
// deployed function and crashed it with FUNCTION_INVOCATION_FAILED.

const ALLOWED_ORIGINS = ['https://biteme.one', 'https://www.biteme.one', 'http://localhost:5173'];
function getCorsOrigin(req: VercelRequest): string {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (/^https:\/\/smart-paw-finder[a-z0-9-]*\.vercel\.app$/.test(origin)) return origin;
  return ALLOWED_ORIGINS[0];
}

function checkAdmin(req: VercelRequest): boolean {
  const expected = process.env.B2B_ADMIN_PASSWORD;
  if (!expected) return false; // never treat "both undefined" as a match
  return (req.headers['x-admin-key'] as string) === expected;
}

const SOCIAL_PLATFORMS = ['Instagram', 'TikTok'];

// ─── Coupon code ───────────────────────────────────────────────────────────────

// Pet-name-only codes collide whenever two applicants share a name (e.g. two
// "Coco"s both get COCO15), and non-ASCII names strip down to an empty base.
// Appending a short slice of the application id keeps codes unique and non-empty
// regardless of the name's script.
export function generateCouponCode(petName: string, applicationId: string): string {
  const base = petName.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'PET';
  const suffix = applicationId.slice(-4).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `${base}15${suffix}`;
}

// ─── Google Sheets log ─────────────────────────────────────────────────────────

const AFFILIATE_SHEET_ID = process.env.AFFILIATE_SHEET_ID || '';
const AFFILIATE_SHEET_GID = process.env.AFFILIATE_SHEET_GID || '0';
const SHEET_HEADER = ['Submitted At', 'Email Address', "Pet's Name", 'Instagram', 'TikTok', 'Country / Region', 'Acquisition Source'];

let sheetsToken: string | null = null;
let sheetsTokenExpiresAt = 0;

async function getSheetsAccessToken(): Promise<string> {
  const now = Date.now();
  if (sheetsToken && now < sheetsTokenExpiresAt - 60_000) return sheetsToken;

  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
  if (!saJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set');
  const sa = JSON.parse(saJson);
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
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
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

async function writeSheetRange(token: string, title: string, range: string, values: string[][]) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${AFFILIATE_SHEET_ID}/values/${encodeURIComponent(`${title}!${range}`)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    },
  );
  if (!res.ok) throw new Error(`Sheets write error: ${(await res.text()).slice(0, 300)}`);
}

// Row 1 is a fixed header; data always lands at A{n}:G{n} for a deterministic next
// row, instead of values.append — which can misdetect the table's column offset
// once a row has any blank cell (e.g. an empty TikTok), shifting later appends
// sideways. The next-row scan reads the whole A column, not a fixed A1:G1000
// window that would cap out and overwrite row 1001 once the sheet has 1000+ rows.
async function ensureHeaderAndGetNextRow(token: string, title: string): Promise<number> {
  const headerRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${AFFILIATE_SHEET_ID}/values/${encodeURIComponent(`${title}!A1:A1`)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!headerRes.ok) throw new Error(`Sheets header read error: ${(await headerRes.text()).slice(0, 300)}`);
  const headerData = await headerRes.json();
  if (headerData.values?.[0]?.[0] !== SHEET_HEADER[0]) {
    await writeSheetRange(token, title, 'A1:G1', [SHEET_HEADER]);
  }

  const colRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${AFFILIATE_SHEET_ID}/values/${encodeURIComponent(`${title}!A:A`)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!colRes.ok) throw new Error(`Sheets range read error: ${(await colRes.text()).slice(0, 300)}`);
  const colData = await colRes.json();
  const filledRows = (colData.values || []).length;
  return Math.max(filledRows + 1, 2);
}

export interface AffiliateSheetRow {
  submittedAt: Date;
  email: string;
  petName: string;
  accounts: { platform: string; account: string }[];
  country: string;
  acquisitionSource: string;
}

export async function appendAffiliateApplicationRow(row: AffiliateSheetRow): Promise<void> {
  if (!AFFILIATE_SHEET_ID) {
    console.warn('[Affiliate] AFFILIATE_SHEET_ID is not set — skipping Sheets log');
    return;
  }

  const handles = (platform: string) =>
    row.accounts.filter((a) => a.platform === platform).map((a) => `@${a.account}`).join(', ');

  const token = await getSheetsAccessToken();
  const title = await getSheetTitle(token);
  const nextRow = await ensureHeaderAndGetNextRow(token, title);

  await writeSheetRange(token, title, `A${nextRow}:G${nextRow}`, [[
    formatTimestamp(row.submittedAt),
    row.email,
    row.petName,
    handles('Instagram'),
    handles('TikTok'),
    row.country,
    row.acquisitionSource,
  ]]);
}

// ─── Handlers ──────────────────────────────────────────────────────────────────

async function handleApply(req: VercelRequest, res: VercelResponse) {
  const { socialAccounts, email, petName, country, acquisitionSource } = req.body || {};
  if (!Array.isArray(socialAccounts) || socialAccounts.length === 0 || !email || !petName) {
    return res.status(400).json({ error: 'At least one social account, email, and pet name are required.' });
  }

  const normalizedAccounts: { platform: string; account: string }[] = [];
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

  const normalizedCountry = country ? String(country).trim() : '';
  const normalizedAcquisitionSource = acquisitionSource ? String(acquisitionSource).trim() : '';

  const id = `aff_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = new Date();
  const couponCode = generateCouponCode(normalizedPetName, id);
  await Promise.all([
    kv.set(`affiliate:app:${id}`, {
      id,
      socialAccounts: normalizedAccounts,
      email: normalizedEmail,
      petName: normalizedPetName,
      country: normalizedCountry,
      acquisitionSource: normalizedAcquisitionSource,
      couponCode,
      status: 'pending',
      createdAt: createdAt.toISOString(),
    }),
    kv.set(`affiliate:email:${normalizedEmail}`, id),
    kv.sadd('affiliate:ids', id),
  ]);

  let sheetLogged = false;
  let sheetError: string | undefined;
  try {
    await appendAffiliateApplicationRow({
      submittedAt: createdAt,
      email: normalizedEmail,
      petName: normalizedPetName,
      accounts: normalizedAccounts,
      country: normalizedCountry,
      acquisitionSource: normalizedAcquisitionSource,
    });
    sheetLogged = true;
  } catch (e) {
    // Application is already saved in KV; don't fail the request if the sheet log fails.
    sheetError = String(e);
    console.error('[Affiliate] Sheets append failed:', e);
  }

  // Surface the Sheets outcome only to an authenticated caller (ops verification);
  // regular applicants just get success.
  const diag = checkAdmin(req) ? { sheetLogged, sheetError } : {};
  return res.status(200).json({ success: true, id, couponCode, ...diag });
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
        return await handleApply(req, res);
      case 'list':
        return await handleList(req, res);
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (e) {
    console.error('[Affiliate] Error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
