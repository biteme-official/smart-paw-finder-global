// Colosseum (overseas fulfilment partner) shipment sheet: fixed values, product list,
// address parsing and in-browser .xlsx generation from the empty template in public/.
// Everything here runs in the browser only: city / state / zip are read from the address text
// (no map or address lookup), recipient data is never sent anywhere and nothing is stored on a server.
// The fixed sender details (FIXED, SEEDING_EMAIL) ship only in the /manage/international-shipping
// chunk, which App.tsx loads on demand, not in the store bundle.
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
  /** Seeding: the customer's email from the survey (수취인 Email); invalid / empty falls back to SEEDING_EMAIL. */
  email?: string;
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
  /** Units of refunded (sold-out) lines left out of the order (shown on the card). */
  cancelledQty?: number;
  /** Order exported before fulfilment: refunded lines may still be listed (shown for review). */
  preShipment?: boolean;
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

/** "  Lamariee.Accessories@Gmail.com " → "lamariee.accessories@gmail.com" */
export const normalizeEmail = (v: string) => v.trim().toLowerCase();
export const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/** 수취인 Email (AD) of a seeding shipment: the survey email, or SEEDING_EMAIL when it is missing / malformed. */
export function seedingEmail(r: Pick<Recipient, 'email'>): string {
  const email = normalizeEmail(r.email ?? '');
  return isValidEmail(email) ? email : SEEDING_EMAIL;
}

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

/** Card as written to the sheet: ALL-CAPS name, address and city in normal capitalisation. */
function sheetRecipient(input: Recipient): Recipient {
  return {
    ...input,
    name: titleCaseIfAllCaps(input.name.trim()),
    address: titleCaseIfAllCaps(input.address, input.countryCode),
    city: titleCaseIfAllCaps(input.city.trim(), input.countryCode),
  };
}

/**
 * Address in W / AC. Seeding: the survey address in normalized form.
 * Orders: Shopify address lines + city / state / zip / country, as the overseas team writes it.
 */
function sheetAddress(r: Recipient, country?: Country): string {
  return r.order ? formatOrderAddress(r, r.order.hasAddress2, country) : formatShippingAddress(r, country);
}

/** Packing key: sheet address (W) + country, ignoring case and spacing. '' when either is missing. */
function packingKey(r: Recipient, countries: Country[]): string {
  if (!r.countryCode || !r.address.trim()) return '';
  const address = sheetAddress(sheetRecipient(r), countries.find((c) => c.code === r.countryCode))
    .toLowerCase().replace(/\s*,\s*/g, ',').replace(/\s+/g, ' ').trim();
  return address && `${r.countryCode}|${address}`;
}

/**
 * Order number per recipient: seeding recipients with the same sheet address and country share
 * one number (combined packing); a name alone never joins two recipients. Each new address
 * takes the next number.
 */
export function assignOrderNumbers(
  recipients: Recipient[],
  date: string,
  start = ORDER_START,
  countries: Country[] = [],
): Map<string, string> {
  const byAddress = new Map<string, string>();
  const result = new Map<string, string>();
  let next = 0;
  for (const r of recipients) {
    // Shopify orders keep their own number (#1648) and don't use up a seeding number.
    if (r.order) { result.set(r.id, r.order.number); continue; }
    const key = packingKey(r, countries);
    let order = key ? byAddress.get(key) : undefined;
    if (!order) {
      order = orderNumber(date, next++, start);
      if (key) byAddress.set(key, order);
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
    ? `${tracking.trim()} / 시딩출고건 / 배터리 포함 / $1`
    : `${tracking.trim()} / 시딩출고건 / $1`;
}

const US_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC', 'PR', 'GU', 'VI', 'AS', 'MP',
]);

/** State / province name → code, for the countries whose addresses use the code (Western Australia → WA). */
const STATE_NAME_CODES: Record<string, Record<string, string>> = {
  AU: {
    'new south wales': 'NSW', victoria: 'VIC', queensland: 'QLD', 'western australia': 'WA', 'south australia': 'SA',
    tasmania: 'TAS', 'australian capital territory': 'ACT', 'northern territory': 'NT',
  },
  CA: {
    alberta: 'AB', 'british columbia': 'BC', manitoba: 'MB', 'new brunswick': 'NB', 'newfoundland and labrador': 'NL',
    'nova scotia': 'NS', ontario: 'ON', 'prince edward island': 'PE', quebec: 'QC', québec: 'QC', saskatchewan: 'SK',
    'northwest territories': 'NT', nunavut: 'NU', yukon: 'YT',
  },
  US: {
    alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO', connecticut: 'CT',
    delaware: 'DE', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
    kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI',
    minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
    'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC',
    'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI',
    'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
    virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
    'district of columbia': 'DC', 'puerto rico': 'PR',
  },
};
const STATE_CODE_SETS: Record<string, Set<string>> = {
  AU: new Set(Object.values(STATE_NAME_CODES.AU)),
  CA: new Set(Object.values(STATE_NAME_CODES.CA)),
  US: US_STATE_CODES,
};
const isStateCode = (token: string, countryCode: string) => !!STATE_CODE_SETS[countryCode]?.has(token.toUpperCase());

/**
 * State as written in the address: the code for AU / US / CA ("Western Australia" / "Wa" → "WA"),
 * the name as given elsewhere (Indonesia "Banten").
 */
export function stateCode(state: string, countryCode: string): string {
  const s = state.replace(/\s+/g, ' ').trim();
  if (isStateCode(s, countryCode)) return s.toUpperCase();
  return STATE_NAME_CODES[countryCode]?.[s.toLowerCase()] ?? s;
}

/**
 * Country of a survey "Country / Region" answer that isn't a plain country name
 * ("Perth, Western Australia" → Australia): any comma part that is a country, or a state /
 * province name of a country whose states are known.
 */
export function countryFromRegion(value: string, countries: Country[]): Country | undefined {
  const parts = value.split(/[,/]/).map((p) => p.trim()).filter(Boolean);
  for (const p of [...parts].reverse()) {
    const c = findCountry(p, countries);
    if (c) return c;
  }
  for (const p of parts) {
    const t = p.toLowerCase();
    const code = Object.keys(STATE_NAME_CODES).find((cc) => t in STATE_NAME_CODES[cc])
      ?? (MALAYSIA_STATES.some((st) => st.toLowerCase() === t) ? 'MY' : undefined);
    if (code) return countries.find((c) => c.code === code);
  }
  return undefined;
}

/**
 * ALL-CAPS text → first letter of each word upper-case, to match the other addresses:
 * "SHOP 307, RICHMOND SHOPPING ARCADE" → "Shop 307, Richmond Shopping Arcade", "SUKI MA" → "Suki Ma".
 * Mixed-case text is returned unchanged. Tokens with digits (1/F, #09-181, 174C) are kept; with
 * `countryCode` (addresses), that country code and AU / US / CA state codes stay upper-case too.
 */
export function titleCaseIfAllCaps(text: string, countryCode?: string): string {
  if (!/[A-Z]/.test(text) || /[a-z]/.test(text)) return text;
  return text.replace(/[^\s,]+/g, (token) => {
    if (/\d/.test(token)) return token;
    if (countryCode) {
      const bare = token.replace(/[^A-Z]/g, '');
      if (bare.length >= 2 && bare.length <= 3 && (bare === countryCode || isStateCode(bare, countryCode))) return token;
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
  const orders = assignOrderNumbers(recipients, date, start, countries);
  return recipients.flatMap((input) => {
    const order = orders.get(input.id) ?? '';
    const country = countries.find((c) => c.code === input.countryCode);
    // The card keeps what was typed / imported; the sheet gets the normalized form.
    const r = sheetRecipient(input);
    const o = r.order;
    const address = sheetAddress(r, country);
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
        AD: seedingEmail(r),
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
  ...Object.fromEntries(['KR', 'DE', 'FR', 'ES', 'IT', 'MX', 'FI', 'ID', 'MY', 'TH', 'TR', 'SA', 'UA']
    .map((c) => [c, { re: /\b(\d{5})\b/g }])),
  // Vietnam: 5 digits since 2018, the older 6-digit codes ("700000") still in use.
  VN: { re: /\b(\d{6}|\d{5})\b/g },
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
/** Georgia (GE) is also a US state: a survey answer naming it is shown for review. */
export const isAmbiguousCountry = (code: string) => AMBIGUOUS_COUNTRIES.has(code);

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
  const named = candidates
    .filter((c) => c.en.length > 3 && tail.length > c.en.length && tail.endsWith(` ${c.en.toLowerCase()}`))
    .sort((a, b) => b.en.length - a.en.length)[0];
  if (named) return named;
  // No country written: a Malaysian state name plus a 5-digit postal code ("..., 47500, Selangor",
  // "..., 80400 Johor") is a Malaysian address.
  // Also a Malaysian city or a road / area word Malaysia alone uses (not "Jalan" / "Taman": Indonesia has them too).
  const hasState = parts.some((p) => malaysiaState(p) || malaysiaState(p.replace(/^\d{5}\s+/, '')));
  const malaysian = hasState || MALAYSIA_CITY_RE.test(address) || /\b(?:persiaran|seksyen|lebuh|lorong|lrg)\b/i.test(address);
  if (malaysian && /(?:^|[\s,])\d{5}(?:$|[\s,])/.test(address)) return countries.find((c) => c.code === 'MY');
  return undefined;
}

const STREET_SUFFIX = 'street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd|lane|ln|way|court|ct|place|pl|terrace|ter|circle|cir|parkway|pkwy|highway|hwy|trail|trl|square|sq|loop|plaza|crescent|cres';
// "<street + suffix> [NW] [#208 | Apt 4 ...] <City>" — the words after the street (and unit) are the city.
const CITY_AFTER_STREET_RE = new RegExp(
  `^.*\\b(?:${STREET_SUFFIX})\\.?(?:\\s+(?:n|s|e|w|ne|nw|se|sw)\\b)?`
  + `(?:\\s+(?:#\\s?[\\w-]+|(?:apt|apartment|unit|suite|ste|fl|floor|rm|room)\\.?\\s*[\\w-]+))*`
  + `\\s+([A-Za-z][A-Za-z .'-]*?)$`,
  'i',
);

// A street direction ("... Ave NW") is never the city.
const DIRECTION_RE = /^(?:n|s|e|w|ne|nw|se|sw)$/i;

/**
 * Cities named like their state, written with no separate city part ("5 Park Ave, New York 10001"):
 * taken as the city only when the zip is that city's; otherwise the city stays blank for the user.
 */
const SAME_NAME_CITIES: Record<string, Record<string, { city: string; state?: string; zip: RegExp }>> = {
  US: {
    'new york': { city: 'New York', zip: /^10[0-2]\d{2}\b/ }, // Manhattan
    washington: { city: 'Washington', state: 'DC', zip: /^20[0-5]\d{2}\b/ }, // Washington, D.C.
  },
};

/**
 * US / Canada / Australia style tail: "<street> <City>, <ST> <zip>" or "<street>, <City>, <ST> <zip>"
 * (zip already removed from parts). Returns null when there is no 2–3 letter state code at the end.
 */
function parseStateCodeTail(parts: string[], countryCode: string, zip: string): { city: string; state: string } | null {
  if (!parts.length) return null;
  const segs = [...parts];
  const last = segs[segs.length - 1];
  // "CA", "Wa" (a known code in any case), or the full name ("Western Australia") at the end.
  const lowerLast = last.toLowerCase();
  const name = Object.keys(STATE_NAME_CODES[countryCode] ?? {})
    .sort((a, b) => b.length - a.length)
    .find((n) => lowerLast === n || lowerLast.endsWith(` ${n}`));
  const code = name ? null : last.match(/(?:^|\s)([A-Za-z]{2,3})$/);
  if (!name && !(code && (/^[A-Z]+$/.test(code[1]) || isStateCode(code[1], countryCode)))) return null;
  const written = name ? last.slice(last.length - name.length) : code![1];
  const state = name ? written : written.toUpperCase();
  const before = last.slice(0, last.length - written.length).trim();
  if (before) segs[segs.length - 1] = before;
  else segs.pop();
  let city = '';
  if (segs.length >= 2) {
    // City in its own comma segment: "..., Springfield, IL 62704"
    city = segs[segs.length - 1].replace(UNIT_RE, '').trim();
  } else if (segs.length === 1) {
    // City glued to the street line: "21103 Gary Drive #208 Castro Valley, CA 94546"
    const glued = segs[0].match(CITY_AFTER_STREET_RE)?.[1].trim() ?? '';
    city = DIRECTION_RE.test(glued) ? '' : glued;
  }
  // Only a state name with no city before it ("5 Park Ave, New York 10001"): the city of the same name.
  const same = !city && name ? SAME_NAME_CITIES[countryCode]?.[name] : undefined;
  if (same && same.zip.test(zip)) return { city: same.city, state: same.state ?? state };
  return { city, state };
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
// Federal territories: the city is the territory itself ("50450, Kuala Lumpur" → city and state Kuala Lumpur).
const MALAYSIA_FEDERAL_TERRITORIES = new Set(['Kuala Lumpur', 'Labuan', 'Putrajaya']);
const MALAYSIA_CITY_RE = /\b(?:petaling jaya|subang jaya|shah alam|george ?town|johor bahru|kota kinabalu|kuching|ipoh|klang|seremban|puchong|cyberjaya|kajang|ampang|cheras|bangsar|mont kiara|iskandar puteri|alor setar|kuantan|kota bharu|kuala terengganu|miri|sandakan)\b/i;
// Road / area names ("Jalan Ampang", "Taman Pelangi", "Seksyen 9") and anything with a number
// ("SS2/72", "No 12"): never the city.
const MALAYSIA_NOT_CITY_RE = /\d|\b(?:jalan|jln|lorong|lrg|persiaran|psrn|seksyen|taman|tmn|lebuh|lebuhraya|no|lot|blok|block|blk|unit|level|tingkat)\b/i;
const malaysiaCity = (s: string) => (s && !MALAYSIA_NOT_CITY_RE.test(s) && !malaysiaState(s) ? s : '');

/**
 * Malaysia writes "<street>, <zip> <City>, <State>" (zip sometimes in its own segment:
 * "..., 47400, petaling jaya"). The place after the postal code is the city — or the one
 * before it when nothing follows; a known state name after the city is the state.
 * When the zip is followed by the state ("George Town, 10200, Penang", "Ipoh, 30000 Perak"),
 * the city is the segment before the zip. Road / area names are never the city: it is left
 * blank for the user to type. A missing state is left blank too.
 */
function parseMalaysiaTail(parts: string[], zipAt: number, zipRest: string): { city: string; state: string } {
  const afterZip = zipAt >= 0 ? zipRest || parts[zipAt] || '' : '';
  const zipState = malaysiaState(afterZip);
  if (zipState) {
    if (MALAYSIA_FEDERAL_TERRITORIES.has(zipState)) return { city: zipState, state: zipState };
    return { city: titleCaseWords(malaysiaCity(parts[zipAt - 1] ?? '').trim()), state: zipState };
  }
  let cityAt = -1;
  let city = '';
  if (zipAt >= 0 && zipRest) {
    city = zipRest; cityAt = zipAt;
  } else if (zipAt >= 0 && parts[zipAt]) {
    city = parts[zipAt]; cityAt = zipAt; // zip segment removed: the next segment moved here
  } else if (parts.length >= 2) {
    city = parts[parts.length - 1]; cityAt = parts.length - 1;
  }
  const state = malaysiaState(parts[cityAt + 1] ?? '') ?? '';
  return { city: titleCaseWords(malaysiaCity(city).trim()), state };
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
 * Returns the known city written last in it, or '' (left for the user to type).
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
  // Country written after the state in the same part ("Banten 15334 Indonesia" → "Banten").
  // A state name ending in the country's name ("Western Australia") is left whole.
  if (country && parts.length > 1) {
    const last = parts[parts.length - 1];
    const lowerLast = last.toLowerCase();
    const endsWithState = Object.keys(STATE_NAME_CODES[country.code] ?? {})
      .some((n) => lowerLast === n || lowerLast.endsWith(` ${n}`));
    const name = endsWithState ? undefined : [country.en, ...aliasesOf(country)].sort((a, b) => b.length - a.length)
      .find((n) => n.length > 2 && lowerLast.endsWith(` ${n.toLowerCase()}`));
    if (name) parts[parts.length - 1] = last.slice(0, last.length - name.length).trim();
  }

  if (country?.code === 'MY') return { ...parseMalaysiaTail(parts, zipAt, zipRest), zip };
  if (country?.code === 'PH') {
    const city = findPhilippineCity(parts.join(' '));
    if (city || parts.length < 2) return { city, state: '', zip };
  }

  let state = '';
  let city = '';
  if (country && ['US', 'CA', 'AU'].includes(country.code)) {
    const us = parseStateCodeTail(parts, country.code, zip);
    if (us) return { ...us, zip };
  }
  if (parts.length >= 3) {
    state = parts[parts.length - 1];
    city = parts[parts.length - 2];
  } else if (parts.length === 2) {
    // "street, city": the state is unknown here and is left blank for the user.
    city = parts[1];
  }
  // Indonesia writes the district before the regency / city in one part: the city is
  // "Tangerang Regency" in "Pagedangan District Tangerang Regency".
  if (country?.code === 'ID') {
    const m = city.match(/\s((?:kota|kabupaten|kab\.)\s+\S+|\S+\s+(?:regency|city))$/i);
    if (m) city = m[1];
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
// "Kecamatan" / "District" label of an Indonesian district ("Pagedangan District" → "Pagedangan").
const ID_DISTRICT_LABEL_RE = /\s+(?:district|kecamatan|kec\.?)$|^(?:kecamatan|kec\.?)\s+/i;
// A lower-case street type after a capitalised name ("Angus avenue" → "Angus Avenue"); all lower-case lines are kept.
const STREET_SUFFIX_LOWER_RE = new RegExp(`(\\b[A-Z][\\w'.-]*\\s+)(${STREET_SUFFIX})\\b`, 'g');

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
  const code = stateCode(state, r.countryCode);
  // State / country words repeated at the end of a segment ("Spearwood WA", "Banten Indonesia").
  const trailing = [state, code, country?.en, ...(country ? aliasesOf(country) : [])]
    .filter((s): s is string => !!s)
    .sort((a, b) => b.length - a.length);
  /**
   * Splits a segment into what's left once trailing state / country words and the city are
   * taken off ("17B Edward Street Bedford WA" → "17B Edward Street" + city), so each appears
   * once in the tail. A segment that is only places leaves ''.
   */
  const strip = (seg: string): { rest: string; hasCity: boolean } => {
    let s = collapse(seg);
    let hasCity = false;
    for (let changed = true; changed && s;) {
      changed = false;
      if (isCity(s)) return { rest: '', hasCity: true };
      for (const word of trailing) {
        const w = lower(word);
        if (lower(s) === w || (country && matchesCountry(s, country))) return { rest: '', hasCity };
        if (lower(s).endsWith(` ${w}`)) { s = collapse(s.slice(0, s.length - word.length)); changed = true; }
      }
      // City glued to the end of a segment, written as "Makati City" or "Makati".
      for (const cityWord of city ? [`${city} city`, city] : []) {
        if (s.length > cityWord.length && lower(s).endsWith(` ${lower(cityWord)}`)) {
          s = collapse(s.slice(0, s.length - cityWord.length));
          hasCity = true;
          changed = true;
          break;
        }
      }
    }
    return { rest: s, hasCity };
  };

  const all = text.split(',').map(collapse).filter(Boolean).map(strip);
  let cityAt = -1;
  all.forEach((s, i) => { if (s.hasCity) cityAt = i; });
  // The district written with the city stays before it (ID "Pagedangan District Tangerang Regency").
  const cityRest = cityAt >= 0 ? all[cityAt].rest : '';
  const street = [...(cityAt >= 0 ? all.slice(0, cityAt) : all).map((s) => s.rest), cityRest]
    .map((s) => (r.countryCode === 'ID' ? s.replace(ID_DISTRICT_LABEL_RE, '').trim() : s))
    .filter(Boolean)
    .map((s) => s.replace(STREET_SUFFIX_LOWER_RE, (_m, name: string, w: string) => name + w[0].toUpperCase() + w.slice(1)));
  const afterCity = cityAt >= 0 ? all.slice(cityAt + 1).map((s) => s.rest).filter(Boolean) : [];

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

  const stateShown = state && lower(state) !== lower(city) ? code : '';
  let tail: string[];
  if (ZIP_BEFORE_CITY.has(r.countryCode)) {
    tail = [collapse(`${zip} ${city}`), ...afterCity, stateShown];
  } else {
    tail = [city, ...afterCity, stateShown].filter(Boolean);
    if (zip) tail = tail.length ? [...tail.slice(0, -1), `${tail[tail.length - 1]} ${zip}`] : [zip];
  }
  // English country name last, unless it is the city too (Singapore, Hong Kong).
  const countryName = country && !isCity(country.en) ? country.en : '';
  return collapse(restore([...streetLine, ...tail, countryName].filter(Boolean).join(', ')));
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

/** 콜로세움+해외출고양식_YYMMDD.xlsx, dated by the ship date (YYYY-MM-DD). */
export const downloadFileName = (shipDate: string) => `콜로세움+해외출고양식_${orderDatePrefix(shipDate)}.xlsx`;
