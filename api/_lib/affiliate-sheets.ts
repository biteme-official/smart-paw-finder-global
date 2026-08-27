import { createSign } from 'crypto';

// Shared by api/affiliate.ts (production) and server/affiliate-proxy.ts (local dev)
// so both write to the same sheet with a single bug-fix surface.
const AFFILIATE_SHEET_ID = process.env.AFFILIATE_SHEET_ID || '';
const AFFILIATE_SHEET_GID = process.env.AFFILIATE_SHEET_GID || '0';

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

  // Read the whole column instead of a fixed A1:G1000 window — a fixed window caps
  // filledRows at 1000 once the sheet has 1000+ rows, so every later append reuses
  // row 1001 and overwrites the previous entry.
  const colRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${AFFILIATE_SHEET_ID}/values/${encodeURIComponent(`${title}!A:A`)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!colRes.ok) throw new Error(`Sheets range read error: ${(await colRes.text()).slice(0, 300)}`);
  const colData = await colRes.json();
  const filledRows = (colData.values || []).length;
  return Math.max(filledRows + 1, 2);
}

export async function appendAffiliateApplicationRow(row: {
  submittedAt: Date;
  email: string;
  petName: string;
  accounts: { platform: string; account: string }[];
  country: string;
  acquisitionSource: string;
}): Promise<void> {
  if (!AFFILIATE_SHEET_ID) {
    console.warn('[Affiliate] AFFILIATE_SHEET_ID is not set — skipping Sheets log');
    return;
  }

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
