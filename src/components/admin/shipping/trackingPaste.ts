// Bulk tracking-number input: a two-column sheet (수취인명 / 송장번호) pasted or uploaded,
// matched to the recipient cards by name. Runs in the browser only; nothing is sent anywhere.
import type * as XLSXNS from 'xlsx';
import { parseTsv } from './surveyPaste';

type XLSXModule = typeof XLSXNS;

/** "522795857783" / "5227 9585 7783" → "5227-9585-7783"; null when it isn't a 12-digit number. */
export function formatTracking(value: string): string | null {
  const v = value.trim();
  if (!/^[\d\s-]+$/.test(v)) return null;
  const digits = v.replace(/\D/g, '');
  return digits.length === 12 ? `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8)}` : null;
}

/** Name compared without case, edge spaces or repeated spaces. */
export const trackingNameKey = (name: string) => name.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();

export interface TrackingEntry { name: string; tracking: string }

export interface TrackingSheet {
  entries: TrackingEntry[];
  /** Rows whose tracking number isn't 12 digits: shown for review, never applied. */
  invalid: { name: string; value: string }[];
}

const clean = (s: unknown) => String(s ?? '').replace(/^'/, '').replace(/\s+/g, ' ').trim();
// A tracking-number cell (with or without hyphens); 8+ digits so a phone-free name column never matches.
const isTrackingCell = (v: string) => /^[\d\s-]+$/.test(v) && v.replace(/\D/g, '').length >= 8;
const hasLetter = (v: string) => /\p{L}/u.test(v);

/**
 * Rows of cells → name / tracking pairs. The tracking column is the one holding tracking-shaped
 * values in the most rows, the name column the other one with letters; a first row without a
 * tracking-shaped value there (송장번호 / Tracking) is a header and skipped.
 */
export function parseTrackingRows(cells: unknown[][]): TrackingSheet {
  const rows = cells.map((r) => r.map(clean)).filter((r) => r.some(Boolean));
  const width = Math.max(0, ...rows.map((r) => r.length));
  const count = (col: number, test: (v: string) => boolean) => rows.filter((r) => test(r[col] ?? '')).length;
  let trackCol = -1;
  for (let c = 0; c < width; c++) {
    if (count(c, isTrackingCell) > (trackCol < 0 ? 0 : count(trackCol, isTrackingCell))) trackCol = c;
  }
  if (trackCol < 0) return { entries: [], invalid: [] };
  let nameCol = -1;
  for (let c = 0; c < width; c++) {
    if (c !== trackCol && count(c, hasLetter) > (nameCol < 0 ? 0 : count(nameCol, hasLetter))) nameCol = c;
  }
  if (nameCol < 0) return { entries: [], invalid: [] };

  const body = rows.length && !/\d/.test(rows[0][trackCol] ?? '') ? rows.slice(1) : rows;
  const sheet: TrackingSheet = { entries: [], invalid: [] };
  for (const r of body) {
    const name = r[nameCol] ?? '';
    const value = r[trackCol] ?? '';
    if (!name && !value) continue;
    const tracking = formatTracking(value);
    if (name && tracking) sheet.entries.push({ name, tracking });
    else sheet.invalid.push({ name, value });
  }
  return sheet;
}

// Tracking number at the end of a line ("5227-0000-0008", "522700000008"), after a space or comma.
const TRAILING_TRACKING_RE = /^(.*?)[\s,]+(\d{4}[\s-]?\d{4}[\s-]?\d{4})\s*$/;

/**
 * A line without tabs: the tracking number is taken from the end and everything before it is the
 * name, so "Jane Van Doe 5227-0000-0008" and "Jane Doe,522700000008" both work. Other lines
 * (a header, a malformed number) are split on commas.
 */
function splitTrackingLine(line: string): string[] {
  const m = line.match(TRAILING_TRACKING_RE);
  return m ? [m[1].replace(/[\s,]+$/, ''), m[2]] : line.split(',');
}

/** Pasted text: tab-separated (copied from a sheet), or name and number split by a space or comma. */
export function parseTrackingPaste(text: string): TrackingSheet {
  const rows = text.includes('\t') ? parseTsv(text) : text.replace(/\r\n?/g, '\n').split('\n').map((line) => [line]);
  // Lines without a tab (also inside tab-separated text) are split at the trailing number.
  return parseTrackingRows(rows.map((r) => (r.length === 1 ? splitTrackingLine(r[0]) : r)));
}

/** .xlsx / .csv file, first sheet. Numbers are read as written (no "5.22E+11"). */
export function readTrackingFile(XLSX: XLSXModule, file: { name: string; data: ArrayBuffer }): TrackingSheet {
  const isCsv = file.name.toLowerCase().endsWith('.csv');
  const wb = isCsv
    ? XLSX.read(new TextDecoder('utf-8').decode(file.data), { type: 'string', raw: true })
    : XLSX.read(file.data, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: true });
  return parseTrackingRows(rows.map((r) => r.map((v) => (typeof v === 'number' ? v.toFixed(0) : v))));
}

export interface TrackingCard { id: string; name: string; tracking: string }

export interface TrackingMatch {
  /** Card ids whose tracking is set straight away (was empty or already the same). */
  apply: { id: string; tracking: string }[];
  /** Cards that already hold a different number: replaced only after confirmation. */
  overwrite: { id: string; name: string; from: string; to: string }[];
}

/**
 * Sheet entries ↔ cards by name (case / spacing ignored, nothing else guessed). A name shared by
 * several cards, or listed in the sheet with different numbers, is left unmatched (never filled in order).
 */
export function matchTracking(cards: TrackingCard[], entries: TrackingEntry[]): TrackingMatch {
  const result: TrackingMatch = { apply: [], overwrite: [] };
  const sheet = new Map<string, TrackingEntry[]>();
  for (const e of entries) {
    const key = trackingNameKey(e.name);
    sheet.set(key, [...(sheet.get(key) ?? []), e]);
  }
  const byName = new Map<string, TrackingCard[]>();
  for (const c of cards) {
    const key = trackingNameKey(c.name);
    if (key) byName.set(key, [...(byName.get(key) ?? []), c]);
  }
  for (const [key, list] of sheet) {
    const matched = byName.get(key) ?? [];
    const numbers = [...new Set(list.map((e) => e.tracking))];
    if (matched.length !== 1 || numbers.length !== 1) continue;
    const card = matched[0];
    const to = numbers[0];
    const from = formatTracking(card.tracking) ?? card.tracking.trim();
    if (!from || from === to) result.apply.push({ id: card.id, tracking: to });
    else result.overwrite.push({ id: card.id, name: card.name, from: card.tracking.trim(), to });
  }
  return result;
}
