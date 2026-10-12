// Bulk recipient input: rows copied from the survey response Google Sheet.
// Runs in the browser only; nothing is sent anywhere.

export interface SurveyRow {
  name: string;
  phone: string;
  country: string;
  address: string;
  /** Answer from the column whose answers are email addresses ('' when there is none). */
  email: string;
  /** Product option answers (e.g. BANANA), in sheet order; see seeding-options.json. */
  options: string[];
  /** Phone column value that isn't a phone number (an email, text): `phone` is left blank. */
  phoneRejected?: string;
}

export type SurveyPasteMode = 'header' | 'content' | 'four';

type Field = 'name' | 'phone' | 'country' | 'address';

// Header text match for each field (lower-cased, ’ read as ', partial match). Survey columns may
// move as questions are added, so a pasted header row always wins over fixed positions.
// `survey` = the survey's own header (always enough to take the row as a header); `common` = short
// headers of other sheets ("Name", "Address", "Country"), used when the survey header isn't there.
// "Recipient's" alone is in both the name and the phone header: it is never enough on its own.
// The email column is found by its answers instead (emailColumn): a consent question that
// mentions "email" would otherwise be taken for it.
const HEADER_MATCHERS: { field: Field; label: string; survey: (h: string) => boolean; common: (h: string) => boolean }[] = [
  {
    field: 'name', label: '수취인',
    survey: (h) => h.includes('recipient') && h.includes('name') && !h.includes('phone'),
    common: (h) => /\bname\b|이름|성함/.test(h) && !/phone|e-?mail|user ?name|instagram|company|product/.test(h),
  },
  {
    field: 'phone', label: '전화번호',
    survey: (h) => h.includes('phone number'),
    common: (h) => /phone|mobile|\btel\b|telephone|whatsapp|전화|휴대폰/.test(h),
  },
  {
    field: 'country', label: '국가',
    survey: (h) => h.includes('country / region'),
    common: (h) => /country|nation|국가/.test(h),
  },
  {
    field: 'address', label: '주소',
    survey: (h) => h.includes('shipping address'),
    common: (h) => /address|주소/.test(h) && !/e-?mail|이메일/.test(h),
  },
];
const normalizeHeader = (h: string) => h.toLowerCase().replace(/[’‘`´]/g, "'").replace(/\s*\/\s*/g, ' / ').replace(/\s+/g, ' ').trim();

// Copied from the sheet without a header: Timestamp / ID / Yes / name / phone / country / address (A–G).
const DEFAULT_COLUMNS: Record<Field, number> = { name: 3, phone: 4, country: 5, address: 6 };
// Only the four needed cells copied, in that order.
const FOUR_COLUMNS: Record<Field, number> = { name: 0, phone: 1, country: 2, address: 3 };

/**
 * Tab-separated text as Google Sheets copies it: cells containing tabs, newlines or
 * quotes are wrapped in double quotes, with "" for a literal quote.
 */
export function parseTsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/\r\n?/g, '\n');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') {
      quoted = true;
    } else if (ch === '\t') {
      row.push(cell); cell = '';
    } else if (ch === '\n') {
      row.push(cell); rows.push(row); row = []; cell = '';
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

const clean = (s: string | undefined) => (s ?? '').replace(/^'/, '').replace(/\s+/g, ' ').trim();

const isEmailCell = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/** Column holding email-shaped answers (name@domain.tld) in the most rows, or -1. */
function emailColumn(rows: string[][]): number {
  const counts: number[] = [];
  for (const r of rows) r.forEach((c, i) => { if (isEmailCell(clean(c))) counts[i] = (counts[i] ?? 0) + 1; });
  let best = -1;
  counts.forEach((n, i) => { if (n && (best < 0 || n > counts[best])) best = i; });
  return best;
}

/** "+6592768179", "0917 813 3000", "+65 9023-3190": digits with optional +, spaces, dashes, brackets. */
const isPhoneCell = (v: string) => /^\+?[\d\s().-]+$/.test(v) && v.replace(/\D/g, '').length >= 7;

// Sheet timestamp (A): "2026. 10. 6 오후 1:40:48", "2026/10/06 13:40:48", "10/6/2026 13:40:48".
const isTimestampCell = (v: string) => /^(?:\d{4}\s*[./-]\s*\d{1,2}\s*[./-]\s*\d{1,2}|\d{1,2}\/\d{1,2}\/\d{4})(?:\s|$)/.test(v);
// Consent answer (C).
const isYesNoCell = (v: string) => /^(?:yes|no)\b/i.test(v);

/**
 * Row copied from the sheet starting at A (timestamp first) or at B (ID, then Yes / No):
 * the survey's own column order, so an ID made of digits or a name that is also a
 * country ("Jordan") can't be mistaken for the phone or the country.
 */
function sheetColumns(row: string[]): Record<Field, number> | null {
  const cells = row.map(clean);
  if (cells.length >= 7 && isTimestampCell(cells[0]) && isYesNoCell(cells[2])) return DEFAULT_COLUMNS;
  if (cells.length >= 6 && !isTimestampCell(cells[0]) && isYesNoCell(cells[1])) {
    return { name: 2, phone: 3, country: 4, address: 5 };
  }
  return null;
}

/**
 * Columns of a row copied without a header, found by content (any columns may be left out
 * or added around them): phone = digits-only cell, country = known country name after it,
 * name = the cell before the phone, address = the cell after the country.
 */
function contentColumns(row: string[], isCountry: (v: string) => boolean): Record<Field, number> | null {
  const cells = row.map(clean);
  const phone = cells.findIndex(isPhoneCell);
  let country = cells.findIndex((c, i) => i > phone && isCountry(c));
  if (country < 0 && phone < 0) country = cells.findIndex((c) => isCountry(c));
  if (phone < 0 && country < 0) return null;
  // Country not recognised: the cell after the phone is where the survey puts it.
  if (country < 0) country = phone + 1;
  return { name: phone > 0 ? phone - 1 : -1, phone, country, address: country + 1 };
}

const headerFields = (header: string[]) => ({
  survey: HEADER_MATCHERS.filter((m) => header.some(m.survey)).length,
  common: HEADER_MATCHERS.filter((m) => header.some((h) => m.survey(h) || m.common(h))).length,
});

/**
 * First row is a header: a survey header, or two or more common ones ("Name", "Address"),
 * and no answer-shaped cell (email / phone number) that only a recipient row has.
 */
function isHeaderRow(row: string[], header: string[]): boolean {
  if (row.some((c) => isEmailCell(clean(c)) || isPhoneCell(clean(c)))) return false;
  const { survey, common } = headerFields(header);
  return survey > 0 || common >= 2;
}

/** Most rows of `col` pass `test` (blank answers aside). */
const columnIs = (rows: string[][], col: number, test: (v: string) => boolean) => {
  const values = rows.map((r) => clean(r[col])).filter(Boolean);
  return values.length > 0 && values.filter(test).length * 2 > values.length;
};

/**
 * Columns from the header, checked against the answers: the survey header first, then a common
 * one, never the email column or a column already taken. A phone / country column with no
 * matching header is taken from its answers (phone numbers / country names); name and address
 * are never guessed.
 */
function headerColumns(
  header: string[], body: string[][], emailAt: number, isCountry: (v: string) => boolean,
): Record<Field, number> {
  const taken = new Set<number>();
  // The phone header may sit on the email column (answers mixing both): each cell is sorted by its shape.
  const pick = (test: (h: string, i: number) => boolean, field?: Field) => {
    const i = header.findIndex((h, at) => !taken.has(at) && (at !== emailAt || field === 'phone') && test(h, at));
    if (i >= 0) taken.add(i);
    return i;
  };
  const out = {} as Record<Field, number>;
  for (const m of HEADER_MATCHERS) out[m.field] = pick(m.survey, m.field);
  for (const m of HEADER_MATCHERS) if (out[m.field] < 0) out[m.field] = pick(m.common, m.field);
  if (out.phone < 0) out.phone = pick((_h, i) => columnIs(body, i, isPhoneCell));
  if (out.country < 0) out.country = pick((_h, i) => columnIs(body, i, isCountry));
  return out;
}

/**
 * @param isCountry  whether a cell is a country name (trimmed, case-insensitive match)
 * @param optionKeys product option answers to pick up (upper-case), e.g. BANANA / PINK
 */
export function parseSurveyPaste(
  text: string,
  isCountry: (v: string) => boolean,
  optionKeys: Set<string>,
): { rows: SurveyRow[]; mode: SurveyPasteMode; missing: string[] } {
  const table = parseTsv(text).filter((r) => r.some((c) => c.trim()));
  if (!table.length) return { rows: [], mode: 'content', missing: [] };

  let fixed: Record<Field, number> | null = null;
  let emailAt = -1;
  let mode: SurveyPasteMode = 'content';
  let body = table;
  const missing: string[] = [];

  const header = table[0].map(normalizeHeader);
  if (isHeaderRow(table[0], header)) {
    mode = 'header';
    body = table.slice(1);
    emailAt = emailColumn(body);
    fixed = headerColumns(header, body, emailAt, isCountry);
    // A column that isn't found stays empty and is reported.
    for (const m of HEADER_MATCHERS) if (fixed[m.field] < 0) missing.push(m.label);
    if (emailAt < 0) missing.push('이메일');
  } else {
    if (table.every((r) => r.length === 4)) {
      fixed = FOUR_COLUMNS;
      mode = 'four';
    }
    emailAt = emailColumn(body);
  }

  const rows = body
    .map((r) => {
      const columns = fixed ?? sheetColumns(r) ?? contentColumns(r, isCountry);
      if (!columns) return null;
      const cell = (i: number) => (i >= 0 ? clean(r[i]) : '');
      // Option answers sit after the address (BANANA, PINK, ...); other columns are ignored.
      const options = (columns.address >= 0 ? r.slice(columns.address + 1) : r).map(clean)
        .filter((c) => optionKeys.has(c.toUpperCase()))
        .map((c) => c.toUpperCase());
      // An email-shaped answer only goes into 이메일, and only a phone-shaped one into 전화번호:
      // anything else in the phone column (text) is left out and reported.
      const phoneCell = cell(columns.phone);
      const phoneIsEmail = isEmailCell(phoneCell);
      const email = columns.phone === emailAt ? (phoneIsEmail ? phoneCell : '') : cell(emailAt) || (phoneIsEmail ? phoneCell : '');
      const phone = phoneIsEmail ? '' : phoneCell;
      const phoneOk = !phone || isPhoneCell(phone);
      return {
        name: cell(columns.name), phone: phoneOk ? phone : '',
        country: cell(columns.country), address: cell(columns.address), email, options,
        ...(phoneOk ? {} : { phoneRejected: phone }),
      };
    })
    .filter((r): r is SurveyRow => !!r && !!(r.name || r.phone || r.country || r.address));
  return { rows, mode, missing };
}
