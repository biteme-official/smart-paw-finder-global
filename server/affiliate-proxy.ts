import type { Connect } from 'vite';
import { createSign } from 'crypto';
import { addApplication, getApplicationByEmail, getAllApplications, type AffiliateApplication } from './affiliate-store';

const SOCIAL_PLATFORMS = ['Instagram', 'TikTok'];

// ─── Google Sheets logging — mirrors api/affiliate.ts so local dev writes to the same sheet ───
const AFFILIATE_SHEET_ID = process.env.AFFILIATE_SHEET_ID || '1hIKdC_afPFTp1CkPzEwBwx4rtDpRZJD3LXpoeRd_HRM';
const AFFILIATE_SHEET_GID = process.env.AFFILIATE_SHEET_GID || '0';

let sheetsToken: string | null = null;
let sheetsTokenExpiresAt = 0;

async function getSheetsAccessToken(): Promise<string> {
  const now = Date.now();
  if (sheetsToken && now < sheetsTokenExpiresAt - 60_000) return sheetsToken;

  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
  if (!saJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set locally (.env.local)');
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

const SHEET_HEADER = ['Submitted At', 'Email Address', "Pet's Name", 'Instagram', 'TikTok', 'Country / Region', 'Acquisition Source'];

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

// Row 1 is a fixed header; data always lands at A{n}:G{n} for a deterministic next row,
// instead of values.append — which can misdetect the table's column offset once a row
// has any blank cell (e.g. an empty TikTok), shifting later appends sideways.
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
    `https://sheets.googleapis.com/v4/spreadsheets/${AFFILIATE_SHEET_ID}/values/${encodeURIComponent(`${title}!A1:G1000`)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!colRes.ok) throw new Error(`Sheets range read error: ${(await colRes.text()).slice(0, 300)}`);
  const colData = await colRes.json();
  const filledRows = (colData.values || []).length;
  return Math.max(filledRows + 1, 2);
}

async function appendApplicationRow(row: {
  submittedAt: Date;
  email: string;
  petName: string;
  accounts: { platform: string; account: string }[];
  country: string;
  acquisitionSource: string;
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
  const nextRow = await ensureHeaderAndGetNextRow(token, title);

  await writeSheetRange(token, title, `A${nextRow}:G${nextRow}`, [[
    formatTimestamp(row.submittedAt),
    row.email,
    row.petName,
    instagram,
    tiktok,
    row.country,
    row.acquisitionSource,
  ]]);
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
  return key === (process.env.B2B_ADMIN_PASSWORD || '');
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

  if (getApplicationByEmail(normalizedEmail)) {
    return json(res, 409, { error: 'An application with this email already exists.' });
  }

  const normalizedCountry = country ? String(country).trim() : '';
  const normalizedAcquisitionSource = acquisitionSource ? String(acquisitionSource).trim() : '';

  const id = `aff_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = new Date();
  const couponCode = `${normalizedPetName.toUpperCase().replace(/[^A-Z0-9]/g, '')}15`;

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
    await appendApplicationRow({
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
      if (req.method === 'POST' && url.pathname === '/api/affiliate-apply') return handleApply(req, res);
      if (req.method === 'GET' && url.pathname === '/api/affiliate-list') return handleList(req, res);
    } catch (e) {
      console.error('[Affiliate Proxy] Error:', e);
      return json(res, 500, { error: 'Internal server error' });
    }

    return next();
  };
}
