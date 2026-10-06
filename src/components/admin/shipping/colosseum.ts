// Colosseum (overseas fulfilment partner) shipment sheet: fixed values, product list,
// address parsing and in-browser .xlsx generation from the empty template in public/.
// Everything here runs client-side only; recipient data never leaves the browser.
import type * as XLSXNS from 'xlsx';

type XLSXModule = typeof XLSXNS;

export const TEMPLATE_URL = '/templates/colosseum-shipping-template.xlsx';
const DATA_SHEET = 'xl/worksheets/sheet1.xml';
const FIRST_DATA_ROW = 3;

/** Order numbers start here each shipment day: YYMMDD-160, YYMMDD-161, ... */
export const ORDER_START = 160;

/** Products whose name contains one of these words ship with a battery. */
const BATTERY_KEYWORDS = /boogie|blinker/i;

export const hasBattery = (productName: string) => BATTERY_KEYWORDS.test(productName);

// Sender block (L–Q) as on the original sheet. N (sender mobile) is intentionally
// left blank so no personal number ships in the public bundle.
const FIXED: Record<string, string | number> = {
  A: 'SHOPIFY',
  B: 'Express',
  C: 'Fedex',
  F: 'USD',
  G: 1,
  K: 1,
  L: 'Biteme Inc.',
  M: '070-4888-6191',
  O: '31-14, Baegam-ro, Baegam-myeon, Cheoin-gu, Yongin-si, Gyeonggi-do, Republic of Korea',
  P: 17180,
  Q: 'Gyeonggi-do',
  AD: 'zoey@biteme.co.kr',
  AE: 'N',
  AJ: 4201009000,
};

export interface Recipient {
  id: string;
  name: string;
  phone: string;
  countryCode: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  products: string[];
  tracking: string;
}

export interface Country {
  code: string;
  en: string;
  ko: string;
}

export type SheetRow = Record<string, string | number>;

/** "2026-10-06" + 2 → "261006-162" */
export function orderNumber(date: string, index: number): string {
  return `${date.replace(/-/g, '').slice(2)}-${ORDER_START + index}`;
}

/**
 * Order number per recipient: recipients with the same name share one number
 * (combined packing); each new name takes the next number.
 */
export function assignOrderNumbers(recipients: Pick<Recipient, 'id' | 'name'>[], date: string): Map<string, string> {
  const byName = new Map<string, string>();
  const result = new Map<string, string>();
  let next = 0;
  for (const r of recipients) {
    const key = r.name.trim().toLowerCase();
    let order = key ? byName.get(key) : undefined;
    if (!order) {
      order = orderNumber(date, next++);
      if (key) byName.set(key, order);
    }
    result.set(r.id, order);
  }
  return result;
}

export function remark(tracking: string, battery: boolean): string {
  return battery
    ? `${tracking.trim()} / 시딩출고건 / 배터리 포함/ $1`
    : `${tracking.trim()} / 시딩출고건 / $1`;
}

/** One sheet row per product; products under the same order number are packed together. */
export function buildRows(recipients: Recipient[], date: string): SheetRow[] {
  const orders = assignOrderNumbers(recipients, date);
  return recipients.flatMap((r) => {
    const order = orders.get(r.id) ?? '';
    const address = r.address.trim();
    return r.products.map((p) => p.trim()).filter(Boolean).map((name) => {
      const battery = hasBattery(name);
      return {
        ...FIXED,
        D: order,
        J: name,
        R: r.name.trim(),
        S: r.name.trim(),
        U: r.phone.trim(),
        W: address,
        Y: r.city.trim(),
        Z: r.state.trim(),
        AA: r.countryCode,
        AB: r.zip.trim(),
        AC: address,
        AT: remark(r.tracking, battery),
      };
    });
  });
}

// Fallback when the country has no specific rule: 4–6 digits (opt. -4), Canada, UK, NL shapes.
const ZIP_RE = /\b(\d{4}\s?[A-Z]{2}|[A-Z]\d[A-Z]\s?\d[A-Z]\d|[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}|\d{3,6}(?:-\d{3,4})?)\b/gi;

/**
 * Postal code format per country. Group 1 (+ group 2 when present) is the code itself;
 * the rest of the match is a prefix that gets stripped ("S681816", "SG 681816", "〒150-0001").
 */
const POSTAL_RULES: Record<string, { re: RegExp; join?: string }> = {
  SG: { re: /(?:\b(?:SINGAPORE|SG)\s*|\bS)?(?<!\d)(\d{6})\b/gi },
  US: { re: /\b(\d{5}(?:-\d{4})?)\b/g },
  CA: { re: /\b([A-Z]\d[A-Z])\s?(\d[A-Z]\d)\b/gi, join: ' ' },
  GB: { re: /\b([A-Z]{1,2}\d[A-Z\d]?)\s?(\d[A-Z]{2})\b/gi, join: ' ' },
  NL: { re: /\b(\d{4})\s?([A-Z]{2})\b/g, join: ' ' },
  JP: { re: /(?:〒\s*)?\b(\d{3})-?(\d{4})\b/g, join: '-' },
  BR: { re: /\b(\d{5})-?(\d{3})\b/g, join: '-' },
  PT: { re: /\b(\d{4})-(\d{3})\b/g, join: '-' },
  PL: { re: /\b(\d{2})-(\d{3})\b/g, join: '-' },
  SE: { re: /\b(\d{3})\s?(\d{2})\b/g, join: ' ' },
  ...Object.fromEntries(['KR', 'DE', 'FR', 'ES', 'IT', 'MX', 'FI', 'ID', 'MY', 'TH', 'VN', 'TR', 'SA', 'UA']
    .map((c) => [c, { re: /\b(\d{5})\b/g }])),
  ...Object.fromEntries(['AU', 'NZ', 'PH', 'ZA', 'CH', 'AT', 'BE', 'DK', 'NO', 'HU', 'LU']
    .map((c) => [c, { re: /\b(\d{4})\b/g }])),
  ...Object.fromEntries(['CN', 'IN', 'RU', 'KZ'].map((c) => [c, { re: /\b(\d{6})\b/g }])),
  TW: { re: /\b(\d{3}(?:\d{2,3})?)\b/g },
};

/**
 * Finds the postal code in an address line. Takes the last match that isn't at the very
 * start of the line (a leading number is the house / block number, not a postal code).
 * Returns the normalized code and the exact text it was matched from.
 */
export function extractPostal(address: string, countryCode?: string): { zip: string; raw: string } | null {
  const rule = countryCode ? POSTAL_RULES[countryCode] : undefined;
  const re = new RegExp((rule?.re ?? ZIP_RE).source, (rule?.re ?? ZIP_RE).flags);
  // Two-part codes ("150-0001", "M5V 3L9") are distinctive enough to trust even at the start.
  const matches = [...address.matchAll(re)].filter((m) => (m.index ?? 0) > 0 || (!!rule && rule.join !== undefined));
  if (!rule) {
    // Without a country rule only trust codes outside the first comma segment (the street line).
    const firstComma = address.indexOf(',');
    const tail = matches.filter((m) => firstComma >= 0 && (m.index ?? 0) > firstComma);
    const m = tail[tail.length - 1];
    return m ? { zip: m[1].toUpperCase(), raw: m[0] } : null;
  }
  const m = matches[matches.length - 1];
  if (!m) return null;
  const zip = (m[2] ? `${m[1]}${rule.join ?? ''}${m[2]}` : m[1]).toUpperCase();
  return { zip, raw: m[0] };
}

// Unit details: "#14-59", "Apt 4", "Flat 2", Spanish/Latin floors like "3º B", "piso 2", "dpto 5".
const UNIT_RE = /#\s?[\w-]+|\b(?:unit|apt|apartment|suite|ste|room|rm|flat|floor|fl|level|lvl|piso|planta|puerta|depto|dpto|bloque|escalera|esc)\b\.?\s*[\w-]+|\b\d+\s?[ºª°]\s?[A-Z]?\b/gi;

/**
 * Address prepared for a map search: unit / apartment details, "Blk", the postal code
 * and the country segment removed ("Blk 816A Keat hong link #14-59 S681816" → "816A Keat hong link").
 */
export function searchableAddress(address: string, countryCode?: string): { full: string; road: string } {
  const postal = extractPostal(address, countryCode);
  let s = postal ? address.replace(postal.raw, ' ') : address;
  s = s.replace(UNIT_RE, ' ').replace(/\b(?:blk|block)\b\.?/gi, ' ');
  const parts = s.split(',').map((p) => p.replace(/\s{2,}/g, ' ').trim()).filter((p) => p && !/^[\d\s-]+$/.test(p));
  const full = parts.join(', ');
  // Road only: first segment without its leading house / block number.
  const road = (parts[0] ?? '').replace(/^\d+[A-Z]?\b\s*/i, '').trim();
  return { full, road };
}

const COUNTRY_ALIASES: Record<string, string[]> = {
  US: ['usa', 'u.s.a.', 'united states', 'america'],
  GB: ['uk', 'u.k.', 'united kingdom', 'great britain', 'england', 'scotland', 'wales'],
  KR: ['korea', 'south korea'],
  AE: ['uae'],
};

function matchesCountry(part: string, country: Country): boolean {
  const t = part.trim().toLowerCase().replace(/\.$/, '');
  if (!t) return false;
  return t === country.code.toLowerCase()
    || t === country.en.toLowerCase()
    || (t.length >= 4 && country.en.toLowerCase().startsWith(t))
    || (COUNTRY_ALIASES[country.code] ?? []).includes(t);
}

/** Country named in the last segment of the address, if any. */
export function detectCountry(address: string, countries: Country[]): Country | undefined {
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return undefined;
  // Drop a trailing postal code ("Singapore 018989") before comparing.
  const last = parts[parts.length - 1].replace(/\b\d[\d -]*\b/g, '').trim();
  return countries.find((c) => c.en.toLowerCase() === last.toLowerCase())
    ?? countries.find((c) => matchesCountry(last, c) && last.length > 2);
}

/**
 * Best-effort split of a one-line address into city / state / zip.
 * Comma-separated: trailing country is dropped, the postal code is taken from the
 * last parts, then state = last remaining part and city = the part before it.
 */
export function parseAddress(address: string, country?: Country): { city: string; state: string; zip: string } {
  const isCountry = (p: string) => !!country && matchesCountry(p, country);
  // Unit / apartment segments ("#05-01", "Apt 4") are never the city or state.
  const parts = address.split(',').map((p) => p.trim()).filter((p) => p && p.replace(UNIT_RE, '').trim());
  while (parts.length > 1 && isCountry(parts[parts.length - 1])) parts.pop();

  let zip = '';
  const postal = extractPostal(parts.join(', '), country?.code);
  if (postal) {
    zip = postal.zip;
    const i = parts.findIndex((p) => p.includes(postal.raw.trim()));
    if (i >= 0) {
      const rest = parts[i].replace(postal.raw.trim(), '').replace(/\s{2,}/g, ' ').trim();
      if (rest || i === 0) parts[i] = rest;
      else parts.splice(i, 1);
    }
  }

  let state = '';
  let city = '';
  if (parts.length >= 3) {
    state = parts[parts.length - 1];
    city = parts[parts.length - 2];
  } else if (parts.length === 2) {
    // "street, city": the state is unknown here and is left for the address search.
    city = parts[1];
  }
  // City-states (e.g. Singapore) have no separate state: use the country name for both.
  if (country && ['SG', 'HK', 'MO'].includes(country.code)) city = state = country.en;
  return { city, state, zip };
}

/** Country list from the template's '국가코드' sheet (column B = ISO alpha-2). */
export function readCountries(XLSX: XLSXModule, template: ArrayBuffer): Country[] {
  const wb = XLSX.read(template, { type: 'array', sheets: '국가코드' });
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets['국가코드'], { header: 1 });
  return rows
    .slice(1)
    .filter((r) => typeof r[1] === 'string' && /^[A-Z]{2}$/.test(r[1].trim()))
    .map((r) => ({ code: String(r[1]).trim(), en: String(r[5] ?? '').trim(), ko: String(r[6] ?? '').trim() }))
    .sort((a, b) => a.en.localeCompare(b.en));
}

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const colIndex = (col: string) => [...col].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);

function cellXml(ref: string, style: string | undefined, value: string | number | undefined): string {
  const s = style ? ` s="${style}"` : '';
  if (value === undefined || value === '') return `<c r="${ref}"${s}/>`;
  if (typeof value === 'number') return `<c r="${ref}"${s}><v>${value}</v></c>`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

/** Writes rows into the data sheet XML, keeping each template cell's style. */
export function fillSheetXml(xml: string, rows: SheetRow[]): string {
  let out = xml;
  rows.forEach((data, i) => {
    const r = FIRST_DATA_ROW + i;
    const rowRe = new RegExp(`<row r="${r}"([^>]*?)(/>|>([\\s\\S]*?)</row>)`);
    const existing = out.match(rowRe);
    const styles = new Map<string, string | undefined>();
    if (existing?.[3]) {
      for (const m of existing[3].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(\/>|>[\s\S]*?<\/c>)/g)) {
        styles.set(m[1], m[2].match(/s="(\d+)"/)?.[1]);
      }
    }
    const cols = [...new Set([...styles.keys(), ...Object.keys(data)])].sort((a, b) => colIndex(a) - colIndex(b));
    const cells = cols.map((c) => cellXml(`${c}${r}`, styles.get(c), data[c])).join('');
    const rowXml = existing
      ? `<row r="${r}"${existing[1]}>${cells}</row>`
      : `<row r="${r}">${cells}</row>`;
    // Function replacers: the row text contains "$1" (remarks), which a string replacement would expand.
    out = existing ? out.replace(rowRe, () => rowXml) : out.replace('</sheetData>', () => `${rowXml}</sheetData>`);
  });
  const last = FIRST_DATA_ROW + rows.length - 1;
  return out.replace(/<autoFilter ref="A1:AZ\d+"/, `<autoFilter ref="A1:AZ${Math.max(last, 2)}"`);
}

/** Returns a new .xlsx (template + rows) without touching the template buffer. */
export function buildWorkbook(XLSX: XLSXModule, template: ArrayBuffer, rows: SheetRow[]): Uint8Array {
  const zip = XLSX.CFB.read(new Uint8Array(template), { type: 'buffer' });
  const i = zip.FullPaths.findIndex((p) => p.endsWith(DATA_SHEET));
  if (i < 0) throw new Error('Template is missing the shipment sheet.');
  const entry = zip.FileIndex[i];
  const xml = new TextDecoder().decode(entry.content as Uint8Array);
  entry.content = new TextEncoder().encode(fillSheetXml(xml, rows)) as unknown as typeof entry.content;
  const written = XLSX.CFB.write(zip, { fileType: 'zip', type: 'array', compression: true });
  return written instanceof Uint8Array ? written : new Uint8Array(written as ArrayLike<number>);
}

export function downloadFileName(now = new Date()): string {
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `해외출고양식_${yy}${mm}${dd}.xlsx`;
}
