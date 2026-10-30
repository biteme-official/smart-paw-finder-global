// Saved 출고시트 (api/shipping-sheets.ts): the downloaded .xlsx itself is stored, so a later
// download is byte-for-byte the sheet as it was saved, whatever changed in the template or rules since.
import type {
  SheetInput, SheetKind, SheetMeta, SheetRecipient, SheetRecipientRow,
} from '../../../../api/shipping-sheets';
import type { Recipient } from './colosseum';

export type { SheetKind, SheetMeta, SheetRecipient, SheetRecipientRow };
export { productSummary, sheetRecipients } from './sheetRecipients';

export const SHEET_RETENTION_DAYS = 90;

export class SheetApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function call<T>(adminKey: string, query: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/shipping-sheets?${query}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'x-admin-key': adminKey, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new SheetApiError(data.error || `HTTP ${res.status}`, res.status);
  return data as T;
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/** B2B / 주문 (Shopify order) / 시딩 (survey) of each card on the sheet. */
export const recipientKinds = (recipients: Pick<Recipient, 'order'>[]): SheetKind[] =>
  [...new Set(recipients.map((r) => (r.order ? (r.order.b2b ? 'B2B' : '주문') : '시딩') as SheetKind))];

/** Shown kind: B2B and B2C orders are both 주문 (cards keep "주문 · B2B"). */
export const shownKind = (kind: SheetKind | SheetRecipient['kind']) => (kind === '시딩' ? '시딩' : '주문');

/** 주문 / 시딩, or 혼합 only when a sheet has both seeding and orders. */
export const kindLabel = (kinds: SheetKind[]) => {
  const shown = new Set(kinds.map(shownKind));
  return shown.size === 1 ? [...shown][0] : '혼합';
};

/** "261030-160~165", "261030-160", or '-' for a sheet of Shopify orders only. */
export const orderRange = (s: Pick<SheetMeta, 'firstOrder' | 'lastOrder'>) => {
  if (!s.firstOrder) return '-';
  if (!s.lastOrder || s.lastOrder === s.firstOrder) return s.firstOrder;
  return `${s.firstOrder}~${s.lastOrder.split('-').pop()}`;
};

/** Seeding range first, then the Shopify #numbers: "261010-170~171", "#1830". */
export const sheetOrderNumbers = (s: Pick<SheetMeta, 'firstOrder' | 'lastOrder' | 'orderNumbers'>) =>
  [...(s.firstOrder ? [orderRange(s)] : []), ...(s.orderNumbers ?? [])];

export const saveSheet = (adminKey: string, meta: SheetInput['meta'], recipients: SheetRecipient[], bytes: Uint8Array) =>
  call<{ sheet: SheetMeta; duplicate: boolean }>(adminKey, 'action=save', { meta, recipients, file: toBase64(bytes) });

export const listRecipients = (adminKey: string) =>
  call<{ recipients: SheetRecipientRow[] }>(adminKey, 'action=recipients').then((d) => d.recipients);

export const listSheets = (adminKey: string) =>
  call<{ sheets: SheetMeta[] }>(adminKey, 'action=list').then((d) => d.sheets);

export const deleteSheet = (adminKey: string, id: string) =>
  call<{ ok: true }>(adminKey, `action=delete&id=${encodeURIComponent(id)}`, {});

export async function fetchSheetFile(adminKey: string, id: string): Promise<{ fileName: string; bytes: Uint8Array }> {
  const { fileName, file } = await call<{ fileName: string; file: string }>(adminKey, `action=file&id=${encodeURIComponent(id)}`);
  return { fileName, bytes: fromBase64(file) };
}

/** Saves the bytes as a file through a temporary link. */
export function downloadBytes(bytes: Uint8Array, fileName: string) {
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
