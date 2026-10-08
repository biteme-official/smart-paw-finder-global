// Colosseum (overseas fulfilment partner) shipment sheet: fixed values, product list,
// address parsing and in-browser .xlsx generation from the empty template in public/.
// Everything here runs client-side only; recipient data never leaves the browser.
import type * as XLSXNS from 'xlsx';
import { normalizePhone } from './phone';
import { allocateUnitAmounts } from './shopifyOrders';

type XLSXModule = typeof XLSXNS;

export const TEMPLATE_URL = '/templates/colosseum-shipping-template.xlsx';
const DATA_SHEET = 'xl/worksheets/sheet1.xml';
const FIRST_DATA_ROW = 3;

/** Order numbers start here each shipment day: YYMMDD-160, YYMMDD-161, ... */
export const ORDER_START = 160;

/** Products whose name contains one of these words ship with a battery. */
const BATTERY_KEYWORDS = /boogie|blinker/i;

export const hasBattery = (productName: string) => BATTERY_KEYWORDS.test(productName);

/** 수취인 Email (AD) on seeding shipments; order shipments use the customer's email from Shopify. */
export const SEEDING_EMAIL = 'zoey@biteme.co.kr';

// Sender block (L–Q) as on the original sheet, the same on seeding and order shipments.
const FIXED: Record<string, string | number> = {
  A: 'SHOPIFY',
  B: 'Express',
  C: 'Fedex',
  F: 'USD',
  G: 1,
  K: 1,
  L: 'Biteme Inc.',
  M: '070-4888-6191',
  N: '010-3258-0834',
  O: '31-14, Baegam-ro, Baegam-myeon, Cheoin-gu, Yongin-si, Gyeonggi-do, Republic of Korea',
  P: 17180,
  Q: 'Gyeonggi-do',
  AD: SEEDING_EMAIL,
  AE: 'N',
  // 세금식별코드: fixed for every product (the product list's HS CODE is not used here).
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
  /** Set for cards created from a Shopify order export; seeding cards leave it undefined. */
  order?: ShopifyOrderInfo;
}

/** Shopify order data that seeding shipments don't have. qtys / prices line up with products. */
export interface ShopifyOrderInfo {
  number: string;
  currency: string;
  total: string;
  b2b: boolean;
  /** Customer email from the export (수취인 Email). */
  email: string;
  qtys: number[];
  prices: string[];
  /** Shopify Address2 is part of the card's address line (affects the W / AC separator). */
  hasAddress2: boolean;
  /** Address2 that was left out because it looked like a phone number (shown for review). */
  droppedAddress2?: string;
  /** The surname / given-name split of the Shopify name was unclear (shown for review). */
  nameAmbiguous?: boolean;
}

/** Countries without states / provinces: 수취인주 gets the country name. */
export const NO_STATE_COUNTRIES = new Set(['SG', 'HK', 'MO']);

/** Countries without postal codes: 수취인우편번호 (AB) stays blank and isn't required. */
export const NO_POSTAL_COUNTRIES = new Set([
  'HK', 'MO', 'AE', 'QA', 'AG', 'AW', 'BS', 'BZ', 'BJ', 'BO', 'BW', 'BF', 'BI', 'CM', 'CF', 'TD',
  'KM', 'CG', 'CD', 'CK', 'CI', 'DJ', 'DM', 'GQ', 'ER', 'FJ', 'GM', 'GH', 'GD', 'GY', 'KI', 'LY',
  'ML', 'MR', 'NR', 'NU', 'KP', 'RW', 'KN', 'LC', 'ST', 'SC', 'SL', 'SB', 'SR', 'SY', 'TL', 'TG',
  'TK', 'TO', 'TV', 'UG', 'VU', 'YE', 'ZW',
]);
export const hasNoPostalCode = (countryCode: string) => NO_POSTAL_COUNTRIES.has(countryCode);

/** 수취인우편번호 (AB): blank for countries without postal codes. */
const postalCell = (r: Recipient) => (hasNoPostalCode(r.countryCode) ? '' : r.zip.trim());

/**
 * Σ G × K minus the order total, in dollars (0 when they match). Non-zero when rounding
 * leftovers couldn't be placed, e.g. two quantity-2 lines for a total of 30.01.
 */
export function orderTotalGap(r: Recipient): number {
  const o = r.order;
  if (!o) return 0;
  const lines = r.products.map((p, i) => ({ name: p.trim(), i })).filter((x) => x.name);
  const totalCents = Math.round(Number.parseFloat(o.total) * 100);
  if (!lines.length || !Number.isFinite(totalCents)) return 0;
  const qtys = lines.map((x) => o.qtys[x.i] ?? 1);
  const { units } = allocateUnitAmounts(qtys, lines.map((x) => o.prices[x.i] ?? ''), o.total);
  const sumCents = units.reduce((a, u, j) => a + Math.round(u * 100) * qtys[j], 0);
  return (sumCents - totalCents) / 100;
}

/** "$90.00" → "$90", "$136.59" stays. */
export const formatTotal = (total: string) => {
  const n = Number.parseFloat(total);
  if (!Number.isFinite(n)) return total.trim();
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
};

/**
 * Order shipment address (W / AC), as on the team sheet:
 *   "2514 Henry St, Honolulu HI 96817 USA", "174C Edgedale Plains, #09-181 Singapore 823174".
 * Address lines first; then city, state (US only), postal code and country, space separated
 * (country left out when it repeats the city).
 * Without a postal code (Hong Kong) the team writes "<lines> <district>, Hong Kong".
 */
export function formatOrderAddress(
  r: Pick<Recipient, 'address' | 'city' | 'state' | 'zip' | 'countryCode'>,
  hasAddress2: boolean,
  country?: Country,
): string {
  const lines = r.address.replace(/\s+/g, ' ').trim().replace(/,\s*$/, '');
  const city = r.city.trim();
  const countryName = r.countryCode === 'US' ? 'USA' : country?.en ?? r.countryCode;
  const noPostal = !r.zip.trim();
  if (noPostal && countryName.toLowerCase() !== city.toLowerCase()) {
    return [[lines, city].filter(Boolean).join(' '), countryName].filter(Boolean).join(', ');
  }
  const tail = [
    city,
    r.countryCode === 'US' ? r.state.trim() : '',
    r.zip.trim(),
    countryName.toLowerCase() === city.toLowerCase() ? '' : countryName,
  ].filter(Boolean).join(' ');
  if (!tail) return lines;
  return hasAddress2 ? `${lines} ${tail}` : `${lines}, ${tail}`;
}

export interface Country {
  code: string;
  /** Display names (common short form). The ISO code is what goes into the sheet. */
  en: string;
  ko: string;
  /** Lower-cased other names that should match this country: sheet's official names, abbreviations. */
  aliases?: string[];
}

export type SheetRow = Record<string, string | number>;

/** "2026-10-06" → "261006" */
export const orderDatePrefix = (date: string) => date.replace(/-/g, '').slice(2);

/** "2026-10-06" + 2 → "261006-162" (start defaults to 160) */
export function orderNumber(date: string, index: number, start = ORDER_START): string {
  return `${orderDatePrefix(date)}-${start + index}`;
}

/**
 * Order number per recipient: recipients with the same name share one number
 * (combined packing); each new name takes the next number.
 */
export function assignOrderNumbers(
  recipients: Pick<Recipient, 'id' | 'name' | 'order'>[],
  date: string,
  start = ORDER_START,
): Map<string, string> {
  const byName = new Map<string, string>();
  const result = new Map<string, string>();
  let next = 0;
  for (const r of recipients) {
    // Shopify orders keep their own number (#1648) and don't use up a seeding number.
    if (r.order) { result.set(r.id, r.order.number); continue; }
    const key = r.name.trim().toLowerCase();
    let order = key ? byName.get(key) : undefined;
    if (!order) {
      order = orderNumber(date, next++, start);
      if (key) byName.set(key, order);
    }
    result.set(r.id, order);
  }
  return result;
}

/** Shopify order remark: "송장번호 / B2B / 배터리 포함 / $총금액" (B2B and battery parts only when they apply). */
export function orderRemark(tracking: string, b2b: boolean, battery: boolean, total: string): string {
  return [tracking.trim(), b2b && 'B2B', battery && '배터리 포함', `$${formatTotal(total)}`]
    .filter(Boolean)
    .join(' / ');
}

export function remark(tracking: string, battery: boolean): string {
  return battery
    ? `${tracking.trim()} / 시딩출고건 / 배터리 포함/ $1`
    : `${tracking.trim()} / 시딩출고건 / $1`;
}

const US_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC', 'PR', 'GU', 'VI', 'AS', 'MP',
]);

/**
 * ALL-CAPS text → first letter of each word upper-case, to match the other addresses:
 * "SHOP 307, RICHMOND SHOPPING ARCADE" → "Shop 307, Richmond Shopping Arcade", "SUKI MA" → "Suki Ma".
 * Mixed-case text is returned unchanged. Tokens with digits (1/F, #09-181, 174C) are kept; with
 * `countryCode` (addresses), that country code and — for the US — state codes stay upper-case too.
 */
export function titleCaseIfAllCaps(text: string, countryCode?: string): string {
  if (!/[A-Z]/.test(text) || /[a-z]/.test(text)) return text;
  return text.replace(/[^\s,]+/g, (token) => {
    if (/\d/.test(token)) return token;
    if (countryCode) {
      const bare = token.replace(/[^A-Z]/g, '');
      if (bare.length === 2 && (bare === countryCode || (countryCode === 'US' && US_STATE_CODES.has(bare)))) return token;
    }
    return token.toLowerCase().replace(/(^|[-/'(.])([a-z])/g, (_m, before: string, ch: string) => before + ch.toUpperCase());
  });
}

/** One sheet row per product; products under the same order number are packed together. */
export function buildRows(
  recipients: Recipient[],
  date: string,
  countries: Country[] = [],
  start = ORDER_START,
): SheetRow[] {
  const orders = assignOrderNumbers(recipients, date, start);
  return recipients.flatMap((input) => {
    const order = orders.get(input.id) ?? '';
    const country = countries.find((c) => c.code === input.countryCode);
    // The card keeps what was typed / imported; the sheet gets ALL-CAPS name, address and city
    // in normal capitalisation.
    const r: Recipient = {
      ...input,
      name: titleCaseIfAllCaps(input.name.trim()),
      address: titleCaseIfAllCaps(input.address, input.countryCode),
      city: titleCaseIfAllCaps(input.city.trim(), input.countryCode),
    };
    const o = r.order;
    // Seeding: the address is pasted as written in the survey, W / AC get the normalized form.
    // Orders: Shopify address lines + city / state / zip / country, as the overseas team writes it.
    const address = o ? formatOrderAddress(r, o.hasAddress2, country) : formatShippingAddress(r, country);
    const lines = r.products.map((p, i) => ({ name: p.trim(), i })).filter((x) => x.name);
    // 구매자전체결제금 per unit: order total spread over the lines (Σ unit × qty = total).
    const units = o
      ? allocateUnitAmounts(lines.map((x) => o.qtys[x.i] ?? 1), lines.map((x) => o.prices[x.i] ?? ''), o.total).units
      : [];
    return lines.map(({ name, i }, li) => {
      const battery = hasBattery(name);
      const orderCells: SheetRow = o
        ? {
            F: o.currency || 'USD',
            G: units[li],
            K: o.qtys[i] ?? 1,
            AT: orderRemark(r.tracking, o.b2b, battery, o.total),
            AD: o.email,
          }
        : {};
      return {
        ...FIXED,
        D: order,
        J: name,
        R: r.name.trim(),
        S: r.name.trim(),
        U: normalizePhone(r.phone, r.countryCode).value,
        W: address,
        Y: r.city.trim(),
        Z: r.state.trim(),
        AA: r.countryCode,
        AB: postalCell(r),
        AC: address,
        AT: remark(r.tracking, battery),
        ...orderCells,
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

// Brackets left empty once the postal code is taken out: "crescent (540155)" → "crescent ( )".
const EMPTY_BRACKETS_RE = /[([{（【]\s*[)\]}）】]/g;
/** Removes the postal code together with the brackets it was written in. */
const removePostal = (text: string, raw: string) => text.replace(raw, ' ').replace(EMPTY_BRACKETS_RE, ' ');

const HOUSE_NUMBER_PREFIX = /\b(?:no|number|nr|sec|section|lane|ln|alley|aly|blk|block|lot|km)\.?\s*$|#\s*$/i;

/**
 * Finds the postal code in an address line. Takes the last match that isn't at the very
 * start of the line (a leading number is the house / block number, not a postal code).
 * Returns the normalized code and the exact text it was matched from.
 */
export function extractPostal(address: string, countryCode?: string): { zip: string; raw: string } | null {
  const rule = countryCode ? POSTAL_RULES[countryCode] : undefined;
  const re = new RegExp((rule?.re ?? ZIP_RE).source, (rule?.re ?? ZIP_RE).flags);
  const lastSegmentsStart = (() => {
    const commas = [...address.matchAll(/,/g)].map((c) => c.index ?? 0);
    return commas.length >= 2 ? commas[commas.length - 2] : -1;
  })();
  const matches = [...address.matchAll(re)].filter((m) => {
    const at = m.index ?? 0;
    // Numbers labelled as house / section / lane / block numbers are never postal codes.
    if (HOUSE_NUMBER_PREFIX.test(address.slice(0, at))) return false;
    // Short all-digit codes (3–4 digits, e.g. Taiwan, Australia) only count near the end.
    if (/^\d{3,4}$/.test(m[1]) && !m[2] && at < lastSegmentsStart) return false;
    // Two-part codes ("150-0001", "M5V 3L9") are distinctive enough to trust even at the start.
    return at > 0 || (!!rule && rule.join !== undefined);
  });
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

// Unit details: "#14-59", "Apt 4", "Flat 2", Spanish/Latin floors like "3º B", "piso 2", "dpto 5", floors like "1F".
const UNIT_RE = /#\s?[\w-]+|\b(?:unit|apt|apartment|suite|ste|room|rm|flat|floor|fl|level|lvl|piso|planta|puerta|depto|dpto|bloque|escalera|esc)\b\.?\s*[\w-]+|\b\d+\s?[ºª°]\s?[A-Z]?\b|\b\d{1,3}F\b/gi;

/**
 * Address prepared for a map search: unit / apartment details, "Blk", the postal code
 * and the country segment removed ("Blk 816A Keat hong link #14-59 S681816" → "816A Keat hong link").
 */
export function searchableAddress(address: string, countryCode?: string): { full: string; road: string } {
  const postal = extractPostal(address, countryCode);
  let s = postal ? removePostal(address, postal.raw) : address;
  s = s.replace(UNIT_RE, ' ').replace(/\b(?:blk|block)\b\.?/gi, ' ').replace(/\bno\.?\s*(?=\d)/gi, '');
  const raw = s.split(',').map((p) => p.replace(/\s{2,}/g, ' ').trim()).filter(Boolean);
  // "No. 122, Section 1, Chongqing South Road" → "122 Section 1 Chongqing South Road":
  // house-number / section-only segments belong to the road that follows them.
  const isNumberPart = (p: string) => /^(?:\d+[A-Z]?|(?:section|sec\.?|lane|alley)\s*\d+)$/i.test(p);
  const parts: string[] = [];
  let carry = '';
  for (const p of raw) {
    if (isNumberPart(p)) { carry = `${carry} ${p}`.trim(); continue; }
    parts.push(`${carry} ${p}`.trim());
    carry = '';
  }
  const full = parts.join(', ');
  // Road only: first segment with its leading house number / section removed.
  const road = (parts[0] ?? '')
    .replace(/^(?:\d+[A-Z]?\b\s*)?(?:(?:section|sec\.?|lane|alley)\s*\d+\s*)?/i, '')
    .trim();
  return { full, road };
}

/**
 * Names shown in the country picker, replacing the long / official (or misspelled) names of
 * the template's 국가코드 sheet. Only the display changes: the sheet keeps the ISO code.
 */
export const COUNTRY_DISPLAY_NAMES: Record<string, { en?: string; ko?: string }> = {
  US: { en: 'United States', ko: '미국' },
  KR: { en: 'South Korea', ko: '한국' },
  HK: { en: 'Hong Kong' },
  NP: { ko: '네팔' },
  FM: { en: 'Micronesia', ko: '마이크로네시아' },
  KG: { en: 'Kyrgyzstan', ko: '키르기스스탄' },
  TR: { en: 'Türkiye', ko: '튀르키예' },
  EH: { en: 'Western Sahara', ko: '서사하라' },
  AE: { en: 'United Arab Emirates' },
  EU: { en: 'European Union' },
  PG: { en: 'Papua New Guinea' },
  GG: { en: 'Guernsey' },
  JE: { en: 'Jersey' },
  VE: { ko: '베네수엘라' },
  CH: { en: 'Switzerland' },
  IT: { en: 'Italy' },
  MZ: { en: 'Mozambique' },
  ET: { en: 'Ethiopia' },
};

/** Extra names people / Shopify / surveys use for a country (lower-case). */
const COUNTRY_ALIASES: Record<string, string[]> = {
  US: ['usa', 'u.s.a.', 'u.s.', 'us', 'united states', 'united states of america', 'america', '미합중국', '미국'],
  GB: ['uk', 'u.k.', 'united kingdom', 'great britain', 'britain', 'england', 'scotland', 'wales',
    'united kingdom of great britain and northern ireland'],
  KR: ['korea', 'south korea', 'republic of korea', 'korea, republic of', '대한민국'],
  AE: ['uae', 'united arab emirates : uae'],
  HK: ['hong kong', 'hongkong', 'hk', 'hong kong sar', '홍콩특별행정구'],
  VN: ['viet nam', '베트남사회주의공화국'],
  TW: ['taiwan (roc)', 'republic of china', 'taiwan, province of china', '중화민국'],
  RU: ['russian federation', '러시아연방'],
  CN: ['prc', "people's republic of china", '중화인민공화국'],
  MO: ['macau', 'macao sar'],
  CZ: ['czech republic', 'czechia'],
  TR: ['turkey', 'turkiye', 'republic of turkiye', '튀르키예공화국', '터키'],
  CH: ['swiss'],
  IT: ['italia'],
  NL: ['the netherlands', 'holland'],
  LA: ["lao people's democratic republic"],
  IR: ['islamic republic of iran'],
  SY: ['syrian arab republic'],
  MD: ['republic of moldova'],
  TZ: ['united republic of tanzania'],
  BO: ['plurinational state of bolivia'],
  VE: ['bolivarian republic of venezuela'],
  BN: ['brunei darussalam'],
  CI: ["cote d'ivoire", 'ivory coast'],
  CV: ['cabo verde'],
  SZ: ['swaziland'],
  MK: ['macedonia'],
  BA: ['bosnia and herzegovina'],
};

/** Display names + aliases for a row of the 국가코드 sheet. */
function withDisplayNames(code: string, sheetEn: string, sheetKo: string): Country {
  const shown = COUNTRY_DISPLAY_NAMES[code] ?? {};
  const en = shown.en ?? sheetEn;
  const ko = shown.ko ?? sheetKo;
  const aliases = [...new Set([sheetEn, sheetKo, ...(COUNTRY_ALIASES[code] ?? [])]
    .map((a) => a.trim().toLowerCase())
    // "etc" is the sheet's placeholder English name for Ethiopia, not a real alias.
    .filter((a) => a && a !== 'etc' && a !== en.toLowerCase() && a !== ko))];
  return { code, en, ko, aliases };
}

const aliasesOf = (c: Country) => c.aliases ?? COUNTRY_ALIASES[c.code] ?? [];

function matchesCountry(part: string, country: Country): boolean {
  const t = part.trim().toLowerCase().replace(/\.$/, '');
  if (!t) return false;
  return t === country.code.toLowerCase()
    || t === country.en.toLowerCase()
    || t === country.ko
    || (t.length >= 4 && country.en.toLowerCase().startsWith(t))
    || aliasesOf(country).includes(t);
}

/** Country for a value typed in a form ("Singapore", "Taiwan", "USA", "싱가포르", "SG"). */
export function findCountry(value: string, countries: Country[]): Country | undefined {
  const t = value.trim().toLowerCase();
  if (!t) return undefined;
  return countries.find((c) => c.en.toLowerCase() === t || c.ko === value.trim() || c.code.toLowerCase() === t)
    ?? countries.find((c) => aliasesOf(c).includes(t))
    // "Taiwan" vs "Taiwan, Province of China" style official names.
    ?? countries.find((c) => t.length >= 4 && c.en.toLowerCase().startsWith(t))
    ?? countries.find((c) => c.en.length >= 4 && t.startsWith(c.en.toLowerCase()));
}

// Country names that are also common US state names: never auto-detected.
const AMBIGUOUS_COUNTRIES = new Set(['GE']);

/**
 * Country named at the end of the address, if any: the last comma segment, or — for
 * addresses written without commas — the trailing words ("... Avenue 6 Singapore 731693").
 */
export function detectCountry(address: string, countries: Country[]): Country | undefined {
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return undefined;
  // Drop a trailing postal code ("Singapore 018989", "S681816") before comparing.
  const last = parts[parts.length - 1].replace(/\bS?\d[\d -]*\b/gi, '').trim();
  const candidates = countries.filter((c) => !AMBIGUOUS_COUNTRIES.has(c.code));
  if (parts.length >= 2) {
    const found = candidates.find((c) => c.en.toLowerCase() === last.toLowerCase())
      ?? candidates.find((c) => matchesCountry(last, c) && last.length > 2);
    if (found) return found;
  }
  const tail = last.toLowerCase();
  return candidates
    .filter((c) => c.en.length > 3 && tail.length > c.en.length && tail.endsWith(` ${c.en.toLowerCase()}`))
    .sort((a, b) => b.en.length - a.en.length)[0];
}

const STREET_SUFFIX = 'street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd|lane|ln|way|court|ct|place|pl|terrace|ter|circle|cir|parkway|pkwy|highway|hwy|trail|trl|square|sq|loop|plaza|crescent|cres';
// "<street + suffix> [NW] [#208 | Apt 4 ...] <City>" — the words after the street (and unit) are the city.
const CITY_AFTER_STREET_RE = new RegExp(
  `^.*\\b(?:${STREET_SUFFIX})\\.?(?:\\s+(?:n|s|e|w|ne|nw|se|sw)\\b)?`
  + `(?:\\s+(?:#\\s?[\\w-]+|(?:apt|apartment|unit|suite|ste|fl|floor|rm|room)\\.?\\s*[\\w-]+))*`
  + `\\s+([A-Za-z][A-Za-z .'-]*?)$`,
  'i',
);

/**
 * US / Canada / Australia style tail: "<street> <City>, <ST> <zip>" or "<street>, <City>, <ST> <zip>"
 * (zip already removed from parts). Returns null when there is no 2–3 letter state code at the end.
 */
function parseStateCodeTail(parts: string[]): { city: string; state: string } | null {
  if (!parts.length) return null;
  const segs = [...parts];
  const last = segs[segs.length - 1];
  const code = last.match(/(?:^|\s)([A-Z]{2,3})$/);
  if (!code) return null;
  const state = code[1];
  const before = last.slice(0, last.length - state.length).trim();
  if (before) segs[segs.length - 1] = before;
  else segs.pop();
  if (!segs.length) return { city: '', state };
  const cityPart = segs[segs.length - 1];
  // City in its own comma segment: "..., Springfield, IL 62704"
  if (segs.length >= 2) return { city: cityPart.replace(UNIT_RE, '').trim(), state };
  // City glued to the street line: "21103 Gary Drive #208 Castro Valley, CA 94546"
  const m = cityPart.match(CITY_AFTER_STREET_RE);
  return { city: m ? m[1].trim() : '', state };
}

/** "petaling jaya" / "PETALING JAYA" → "Petaling Jaya"; mixed case is kept as written. */
const titleCaseWords = (s: string) => (s === s.toLowerCase() || s === s.toUpperCase()
  ? s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase())
  : s);

const MALAYSIA_STATES = [
  'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Malacca', 'Negeri Sembilan', 'Pahang', 'Penang', 'Pulau Pinang',
  'Perak', 'Perlis', 'Sabah', 'Sarawak', 'Selangor', 'Terengganu', 'Kuala Lumpur', 'Labuan', 'Putrajaya',
  'Wilayah Persekutuan',
];
const malaysiaState = (s: string) => MALAYSIA_STATES.find((st) => st.toLowerCase() === s.trim().toLowerCase());

/**
 * Malaysia writes "<street>, <zip> <City>, <State>" (zip sometimes in its own segment:
 * "..., 47400, petaling jaya"). The place after the postal code is the city — or the one
 * before it when nothing follows; a known state name after the city is the state.
 * A missing state is left for the address search.
 */
function parseMalaysiaTail(parts: string[], zipAt: number, zipRest: string): { city: string; state: string } {
  // "..., 47400 Selangor": a state name after the zip is not the city; the city is left for the address search.
  const zipState = zipRest ? malaysiaState(zipRest) : undefined;
  if (zipState) return { city: '', state: zipState };
  let cityAt = -1;
  let city = '';
  if (zipAt >= 0 && zipRest) {
    city = zipRest; cityAt = zipAt;
  } else if (zipAt >= 0 && parts[zipAt]) {
    city = parts[zipAt]; cityAt = zipAt; // zip segment removed: the next segment moved here
  } else if (parts.length >= 2) {
    city = parts[parts.length - 1]; cityAt = parts.length - 1;
  }
  let state = malaysiaState(parts[cityAt + 1] ?? '') ?? '';
  if (!state && malaysiaState(city) && cityAt > 0 && zipAt >= 0 && !zipRest) {
    // "..., <City>, <zip>, <State>": the segment after the zip is the state, the city is before it.
    state = malaysiaState(city) ?? '';
    city = parts[cityAt - 1] ?? '';
  }
  return { city: titleCaseWords(city.trim()), state };
}

// Philippine cities as written in addresses, with the abbreviations customers use.
const PHILIPPINE_CITIES: { name: string; re: RegExp }[] = [
  { name: 'Quezon City', re: /\b(?:quezon\s+city|q\.?\s?c\.?)(?=\s|$)/i },
  { name: 'Makati', re: /\bmakati(?:\s+city)?\b/i },
  { name: 'Taguig', re: /\btaguig(?:\s+city)?\b/i },
  { name: 'Pasig', re: /\bpasig(?:\s+city)?\b/i },
  { name: 'Mandaluyong', re: /\bmandaluyong(?:\s+city)?\b/i },
  // Not "Metro Manila" (the region, written after the actual city).
  { name: 'Manila', re: /(?<!metro\s)\b(?:city\s+of\s+)?manila\b(?!\s+bay)/i },
  { name: 'Pasay', re: /\bpasay(?:\s+city)?\b/i },
  { name: 'Parañaque', re: /\bpara[ñn]aque(?:\s+city)?\b/i },
  { name: 'Las Piñas', re: /\blas\s+pi[ñn]as(?:\s+city)?\b/i },
  { name: 'Muntinlupa', re: /\bmuntinlupa(?:\s+city)?\b/i },
  { name: 'Marikina', re: /\bmarikina(?:\s+city)?\b/i },
  { name: 'Caloocan', re: /\bcaloocan(?:\s+city)?\b/i },
  { name: 'Valenzuela', re: /\bvalenzuela(?:\s+city)?\b/i },
  { name: 'San Juan', re: /\bsan\s+juan(?:\s+city)?\b/i },
  { name: 'Cebu City', re: /\bcebu\s+city\b/i },
  { name: 'Davao City', re: /\bdavao\s+city\b/i },
];

/**
 * Philippine addresses are often one run-on line ("63A dalisay st ... q c 1104 Philippines").
 * Returns the known city written last in it, or '' (then the address search fills it).
 */
function findPhilippineCity(text: string): string {
  const t = text.replace(/\bphilippines\b/gi, ' ');
  let best = { name: '', at: -1 };
  for (const c of PHILIPPINE_CITIES) {
    for (const m of t.matchAll(new RegExp(c.re.source, 'gi'))) {
      if ((m.index ?? -1) > best.at) best = { name: c.name, at: m.index ?? -1 };
    }
  }
  return best.name;
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
  // Where the postal code was, and the text sharing its comma segment (MY "47400 Petaling Jaya").
  let zipAt = -1;
  let zipRest = '';
  const postal = extractPostal(parts.join(', '), country?.code);
  if (postal) {
    zip = postal.zip;
    const i = parts.findIndex((p) => p.includes(postal.raw.trim()));
    if (i >= 0) {
      zipAt = i;
      const rest = removePostal(parts[i], postal.raw.trim()).replace(/\s{2,}/g, ' ').trim();
      zipRest = rest;
      if (rest || i === 0) parts[i] = rest;
      else parts.splice(i, 1);
    }
  }

  if (country?.code === 'MY') return { ...parseMalaysiaTail(parts, zipAt, zipRest), zip };
  if (country?.code === 'PH') {
    const city = findPhilippineCity(parts.join(' '));
    if (city || parts.length < 2) return { city, state: '', zip };
  }

  let state = '';
  let city = '';
  if (country && ['US', 'CA', 'AU'].includes(country.code)) {
    const us = parseStateCodeTail(parts);
    if (us) return { ...us, zip };
  }
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

// Survey field labels pasted along with the address ("Unit Number:", "Postal Code:" ...).
const LABEL_RE = /\b(?:unit\s*(?:no\.?|number|#)?|address(?:\s*line\s*\d)?|street(?:\s*address)?|postal\s*code|post\s*code|zip(?:\s*code)?|city|state|province|country)\s*:/gi;

const collapse = (s: string) => s.replace(/\s+/g, ' ').replace(/\s+,/g, ',').replace(/^[\s,]+|[\s,]+$/g, '');

// Countries that write the postal code before the city ("28014 Madrid", "47400 Petaling Jaya, Selangor").
const ZIP_BEFORE_CITY = new Set(['ES', 'MY', 'DE', 'FR', 'IT', 'NL', 'BE', 'AT', 'CH', 'PT', 'PL', 'SE', 'DK', 'NO', 'FI']);
// Countries whose unit / apartment goes after the street ("350 Fifth Avenue, Apt 4B"): a unit written
// first is moved there. Elsewhere (TW "3F, No. 12 ...", PH / ID building first) the order is kept as written.
const UNIT_AFTER_STREET = new Set(['US', 'CA', 'AU', 'NZ', 'GB', 'SG', 'ES']);

/**
 * Address written to the sheet (W and AC), in the country's own order:
 *   "<street, with unit where it was written>, <city>, <state> <zip>"  (zip first where the country does so)
 * e.g. "Unit Number: #07-709 Blk 693A Woodlands Avenue 6  Singapore 731693"
 *    → "Blk 693A Woodlands Avenue 6, #07-709, Singapore 731693"
 * City / state / zip come from their own fields; copies of them (and of the country)
 * inside the pasted text are dropped so each appears once. Parts written after the city
 * (PH "Makati City, Metro Manila") stay after it.
 */
export function formatShippingAddress(
  r: Pick<Recipient, 'address' | 'city' | 'state' | 'zip' | 'countryCode'>,
  country?: Country,
): string {
  let text = r.address.replace(LABEL_RE, ' ');

  // Units are held as placeholders so their numbers aren't taken for the postal code, and put back in place.
  const units: string[] = [];
  text = text.replace(UNIT_RE, (m) => ` ${units.push(collapse(m)) - 1} `);
  const restore = (s: string) => s.replace(/(\d+)/g, (_, i: string) => units[Number(i)]);

  const zip = r.zip.trim();
  const postal = extractPostal(text, r.countryCode || undefined);
  if (postal) text = removePostal(text, postal.raw);
  if (zip) text = text.split(zip).join(' ').replace(EMPTY_BRACKETS_RE, ' ');

  const city = collapse(r.city);
  const state = collapse(r.state);
  const lower = (s: string) => s.toLowerCase();
  // "Makati City" in the text for the city field "Makati".
  const isCity = (s: string) => {
    const t = lower(collapse(s));
    const c = lower(city);
    return !!c && (t === c || t === `${c} city` || `${t} city` === c);
  };
  const isPlace = (s: string) => {
    const t = lower(collapse(s));
    return !t || isCity(t) || t === lower(state) || (!!country && matchesCountry(t, country));
  };
  // Trailing words that repeat city / state / country, e.g. "... Avenue 6 Singapore".
  const trailing = [city, state, country?.en, ...(country ? aliasesOf(country) : [])]
    .filter((s): s is string => !!s)
    .sort((a, b) => b.length - a.length);
  const stripTrailing = (seg: string) => {
    let s = collapse(seg);
    for (let changed = true; changed;) {
      changed = false;
      for (const word of trailing) {
        if (s.length > word.length && lower(s).endsWith(` ${lower(word)}`)) {
          s = collapse(s.slice(0, s.length - word.length));
          changed = true;
        }
      }
    }
    return s;
  };

  const all = text.split(',').map(collapse).filter(Boolean);
  let cityAt = -1;
  all.forEach((s, i) => { if (isCity(s)) cityAt = i; });
  const street = (cityAt >= 0 ? all.slice(0, cityAt) : all).filter((s) => !isPlace(s));
  const afterCity = cityAt >= 0 ? all.slice(cityAt + 1).filter((s) => !isPlace(s)) : [];
  if (street.length) street[street.length - 1] = stripTrailing(street[street.length - 1]);

  // A unit written before the street goes after it where the country writes it so.
  const leading: string[] = [];
  if (UNIT_AFTER_STREET.has(r.countryCode)) {
    for (let m = street[0]?.match(/^\d+/); m; m = street[0]?.match(/^\d+/)) {
      const rest = collapse(street[0].slice(m[0].length));
      if (!rest && street.length === 1) break; // nothing but the unit: leave it
      leading.push(m[0]);
      if (rest) street[0] = rest;
      else street.shift();
    }
  }
  const streetLine = [...street, ...leading].filter(Boolean);

  const stateShown = state && lower(state) !== lower(city) ? state : '';
  let tail: string[];
  if (ZIP_BEFORE_CITY.has(r.countryCode)) {
    tail = [collapse(`${zip} ${city}`), ...afterCity, stateShown];
  } else {
    tail = [city, ...afterCity, stateShown].filter(Boolean);
    if (zip) tail = tail.length ? [...tail.slice(0, -1), `${tail[tail.length - 1]} ${zip}`] : [zip];
  }
  return collapse(restore([...streetLine, ...tail].filter(Boolean).join(', ')));
}

/** Country list from the template's '국가코드' sheet (column B = ISO alpha-2). */
export function readCountries(XLSX: XLSXModule, template: ArrayBuffer): Country[] {
  const wb = XLSX.read(template, { type: 'array', sheets: '국가코드' });
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets['국가코드'], { header: 1 });
  return rows
    .slice(1)
    .filter((r) => typeof r[1] === 'string' && /^[A-Z]{2}$/.test(r[1].trim()))
    .map((r) => withDisplayNames(String(r[1]).trim(), String(r[5] ?? '').trim(), String(r[6] ?? '').trim()))
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
// Data rows use one cell style across A–AZ (template style 23: no fill, thin border, left /
// middle aligned — as columns O–Q and T). AJ uses style 35, identical but with the number
// format that shows the full tax code instead of 4.2E+09. Rows without data stay unformatted.
const DATA_CELL_STYLE = '23';
const COLUMN_STYLES: Record<string, string> = { AJ: '35' };
const DATA_COLUMNS = Array.from({ length: colIndex('AZ') }, (_, i) => {
  let n = i + 1;
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
});

export function fillSheetXml(xml: string, rows: SheetRow[]): string {
  let out = xml;
  rows.forEach((data, i) => {
    const r = FIRST_DATA_ROW + i;
    const rowRe = new RegExp(`<row r="${r}"([^>]*?)(/>|>([\\s\\S]*?)</row>)`);
    const existing = out.match(rowRe);
    const cells = DATA_COLUMNS
      .map((c) => cellXml(`${c}${r}`, COLUMN_STYLES[c] ?? DATA_CELL_STYLE, data[c]))
      .join('');
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

/** 해외출고양식_YYMMDD.xlsx, dated by the ship date (YYYY-MM-DD). */
export const downloadFileName = (shipDate: string) => `해외출고양식_${orderDatePrefix(shipDate)}.xlsx`;
