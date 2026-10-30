import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

// Saved 해외출고 sheets (/manage/international-shipping → 출고시트 tab). Admin only: the sheets hold
// recipients' names, addresses and phone numbers. Self-contained like every other function in api/;
// the validation below is exported so server/shipping-sheets-proxy.ts (local dev) shares it.

/** Sheets are deleted 90 days after they were saved. */
export const SHEET_TTL_SECONDS = 90 * 24 * 60 * 60;
/** Generated sheets are ~130-200 KB; base64 adds a third. */
const MAX_FILE_CHARS = 3_000_000;
const KINDS = ['B2B', '주문', '시딩'] as const;

export type SheetKind = (typeof KINDS)[number];

export interface SheetMeta {
  id: string;
  savedAt: string;
  expiresAt: string;
  /** YYYY-MM-DD */
  shipDate: string;
  startNo: number;
  /** Seeding order numbers on the sheet ('' when it only has Shopify orders). */
  firstOrder: string;
  lastOrder: string;
  /** Shopify order numbers on the sheet (#1704, ...), in card order. */
  orderNumbers: string[];
  kinds: SheetKind[];
  recipients: number;
  lines: number;
  fileName: string;
}

/** One recipient of a saved sheet (수취인 조회 tab). Stored and deleted together with its sheet. */
export interface SheetRecipient {
  /** Seeding order number (261028-160) or Shopify order number (#1801). */
  orderNo: string;
  kind: 'B2B' | 'B2C' | '시딩';
  name: string;
  country: string;
  /** Address as written to the sheet. */
  address: string;
  tracking: string;
  /** "Toothbrush 외 2개" */
  products: string;
}

/** A recipient with the sheet it is on. */
export interface SheetRecipientRow extends SheetRecipient {
  sheetId: string;
  shipDate: string;
}

export interface SheetInput {
  meta: Omit<SheetMeta, 'id' | 'savedAt' | 'expiresAt' | 'fileName'>;
  recipients: SheetRecipient[];
  /** The .xlsx as downloaded, base64. */
  file: string;
}

export interface StoredSheet {
  meta: SheetMeta;
  recipients: SheetRecipient[];
  file: string;
}

const isInt = (v: unknown) => Number.isInteger(v) && (v as number) >= 0;
const ORDER_RE = /^(\d{6}-\d+)?$/;
const SHOPIFY_ORDER_RE = /^#?[A-Za-z0-9-]{1,20}$/;
const RECIPIENT_KINDS = ['B2B', 'B2C', '시딩'];
const RECIPIENT_FIELDS = ['orderNo', 'name', 'country', 'address', 'tracking', 'products'] as const;

function validRecipients(list: unknown, count: number): SheetRecipient[] | null {
  if (!Array.isArray(list) || list.length !== count) return null;
  const out: SheetRecipient[] = [];
  for (const r of list as Record<string, unknown>[]) {
    if (!r || !RECIPIENT_KINDS.includes(r.kind as string)) return null;
    if (!RECIPIENT_FIELDS.every((f) => typeof r[f] === 'string' && (r[f] as string).length <= 500)) return null;
    const pick = (f: (typeof RECIPIENT_FIELDS)[number]) => r[f] as string;
    out.push({
      orderNo: pick('orderNo'), kind: r.kind as SheetRecipient['kind'], name: pick('name'), country: pick('country'),
      address: pick('address'), tracking: pick('tracking'), products: pick('products'),
    });
  }
  return out;
}

/** 콜로세움+해외출고양식_YYMMDD.xlsx, the name the download uses. */
export const sheetFileName = (shipDate: string) => `콜로세움+해외출고양식_${shipDate.replace(/-/g, '').slice(2)}.xlsx`;

export const isSheetId = (id: unknown): id is string => typeof id === 'string' && /^sh_[a-z0-9_]{1,40}$/.test(id);

/** Checks a save request; returns the error to show, or the sheet to store. */
export function validateSheet(body: unknown, now = new Date()): { error: string } | StoredSheet {
  const { meta, file, recipients: people } = (body ?? {}) as Partial<SheetInput>;
  if (!meta || typeof file !== 'string') return { error: 'meta and file are required.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(meta.shipDate))) return { error: 'Invalid shipDate.' };
  if (![meta.startNo, meta.recipients, meta.lines].every(isInt) || !meta.recipients) return { error: 'Invalid counts.' };
  if (!ORDER_RE.test(String(meta.firstOrder)) || !ORDER_RE.test(String(meta.lastOrder))) return { error: 'Invalid order numbers.' };
  if (!Array.isArray(meta.orderNumbers) || meta.orderNumbers.length > 500
    || !meta.orderNumbers.every((n) => typeof n === 'string' && SHOPIFY_ORDER_RE.test(n))) {
    return { error: 'Invalid orderNumbers.' };
  }
  if (!Array.isArray(meta.kinds) || !meta.kinds.length || !meta.kinds.every((k) => KINDS.includes(k))) {
    return { error: 'Invalid kinds.' };
  }
  const recipients = validRecipients(people, meta.recipients);
  if (!recipients) return { error: 'Invalid recipients.' };
  // An .xlsx is a zip: base64 of "PK\x03\x04" starts with "UEsDB".
  if (file.length > MAX_FILE_CHARS || !file.startsWith('UEsDB') || !/^[A-Za-z0-9+/]+=*$/.test(file)) {
    return { error: 'Invalid file.' };
  }
  const id = `sh_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    file,
    recipients,
    meta: {
      id,
      savedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + SHEET_TTL_SECONDS * 1000).toISOString(),
      shipDate: meta.shipDate,
      startNo: meta.startNo,
      firstOrder: meta.firstOrder,
      lastOrder: meta.lastOrder,
      orderNumbers: meta.orderNumbers,
      kinds: [...new Set(meta.kinds)],
      recipients: meta.recipients,
      lines: meta.lines,
      fileName: sheetFileName(meta.shipDate),
    },
  };
}

/** Another saved sheet with the same ship date and start number. */
export const isDuplicate = (meta: SheetMeta, saved: SheetMeta[]) =>
  saved.some((s) => s.id !== meta.id && s.shipDate === meta.shipDate && s.startNo === meta.startNo);

const IDS_KEY = 'shipping-sheet:ids';
const metaKey = (id: string) => `shipping-sheet:meta:${id}`;
const fileKey = (id: string) => `shipping-sheet:file:${id}`;
const recipientsKey = (id: string) => `shipping-sheet:recipients:${id}`;

function checkAdmin(req: VercelRequest): boolean {
  const expected = process.env.B2B_ADMIN_PASSWORD;
  if (!expected) return false; // never treat "both undefined" as a match
  return (req.headers['x-admin-key'] as string) === expected;
}

/** Saved sheets, newest first. Expired ones are dropped from the index. */
async function listSheets(): Promise<SheetMeta[]> {
  await kv.zremrangebyscore(IDS_KEY, 0, Date.now() - SHEET_TTL_SECONDS * 1000);
  const ids = await kv.zrange<string[]>(IDS_KEY, 0, -1, { rev: true });
  if (!ids.length) return [];
  const metas = await kv.mget<(SheetMeta | null)[]>(...ids.map(metaKey));
  return metas.filter((m): m is SheetMeta => !!m);
}

/** Recipients of every live sheet: a deleted or expired sheet takes its recipients with it. */
async function listRecipients(): Promise<SheetRecipientRow[]> {
  const sheets = await listSheets();
  if (!sheets.length) return [];
  const lists = await kv.mget<(SheetRecipient[] | null)[]>(...sheets.map((s) => recipientsKey(s.id)));
  return sheets.flatMap((s, i) => (lists[i] ?? []).map((r) => ({ ...r, sheetId: s.id, shipDate: s.shipDate })));
}

async function handleSave(req: VercelRequest, res: VercelResponse) {
  const checked = validateSheet(req.body);
  if ('error' in checked) return res.status(400).json({ error: checked.error });
  const { meta, file, recipients } = checked;
  const duplicate = isDuplicate(meta, await listSheets());
  await Promise.all([
    kv.set(fileKey(meta.id), file, { ex: SHEET_TTL_SECONDS }),
    kv.set(metaKey(meta.id), meta, { ex: SHEET_TTL_SECONDS }),
    kv.set(recipientsKey(meta.id), recipients, { ex: SHEET_TTL_SECONDS }),
    kv.zadd(IDS_KEY, { score: Date.parse(meta.savedAt), member: meta.id }),
  ]);
  return res.status(200).json({ sheet: meta, duplicate });
}

async function handleFile(req: VercelRequest, res: VercelResponse) {
  const id = req.query.id;
  if (!isSheetId(id)) return res.status(400).json({ error: 'Invalid id.' });
  const [meta, file] = await Promise.all([kv.get<SheetMeta>(metaKey(id)), kv.get<string>(fileKey(id))]);
  if (!meta || !file) return res.status(404).json({ error: 'Sheet not found (deleted or expired).' });
  return res.status(200).json({ fileName: meta.fileName, file });
}

async function handleDelete(req: VercelRequest, res: VercelResponse) {
  const id = req.query.id;
  if (!isSheetId(id)) return res.status(400).json({ error: 'Invalid id.' });
  await Promise.all([kv.del(metaKey(id), fileKey(id), recipientsKey(id)), kv.zrem(IDS_KEY, id)]);
  return res.status(200).json({ ok: true });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // The same api/ is deployed to the B2C project too: sheets (recipients' personal data) are B2B admin only.
  if (process.env.SITE_MODE === 'b2c') return res.status(404).json({ error: 'Not found' });
  // Same-origin admin page only: no CORS headers.
  if (!checkAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  const action = req.query.action as string;
  try {
    if (action === 'list' && req.method === 'GET') return res.status(200).json({ sheets: await listSheets() });
    if (action === 'recipients' && req.method === 'GET') return res.status(200).json({ recipients: await listRecipients() });
    if (action === 'file' && req.method === 'GET') return await handleFile(req, res);
    if (action === 'save' && req.method === 'POST') return await handleSave(req, res);
    if (action === 'delete' && req.method === 'POST') return await handleDelete(req, res);
    return res.status(400).json({ error: 'Invalid action' });
  } catch (e) {
    console.error('[Shipping sheets] Error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
