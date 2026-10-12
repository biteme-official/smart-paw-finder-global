// Bulk recipient input: rows copied from the survey response Google Sheet.
// Runs in the browser only; nothing is sent anywhere.

export interface SurveyRow {
  name: string;
  phone: string;
  country: string;
  address: string;
  /** "Fill in your email" answer as written (header paste only; '' otherwise). */
  email: string;
  /** Product option answers (e.g. BANANA), in sheet order; see seeding-options.json. */
  options: string[];
}

export type SurveyPasteMode = 'header' | 'content' | 'four';

type Field = 'name' | 'phone' | 'country' | 'address';
type HeaderField = Field | 'email';

// Header text match for each field (lower-cased, ’ read as ', partial match). Survey columns may
// move as questions are added, so a pasted header row always wins over fixed positions.
// "Recipient's" alone is in both the name and the phone header: it is never enough on its own.
const HEADER_MATCHERS: { field: HeaderField; label: string; test: (h: string) => boolean }[] = [
  { field: 'name', label: '수취인', test: (h) => h.includes('recipient') && h.includes('name') && !h.includes('phone') },
  { field: 'phone', label: '전화번호', test: (h) => h.includes('phone number') },
  { field: 'country', label: '국가', test: (h) => h.includes('country / region') },
  { field: 'address', label: '주소', test: (h) => h.includes('shipping address') },
  { field: 'email', label: '이메일', test: (h) => h.includes('email') },
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
  const found = new Map(HEADER_MATCHERS.map((m) => [m.field, header.findIndex(m.test)]));
  if ([...found.values()].some((i) => i >= 0)) {
    // Header row present: a column that isn't found stays empty (never guessed) and is reported.
    for (const m of HEADER_MATCHERS) if (found.get(m.field)! < 0) missing.push(m.label);
    fixed = {
      name: found.get('name')!, phone: found.get('phone')!, country: found.get('country')!, address: found.get('address')!,
    };
    emailAt = found.get('email')!;
    mode = 'header';
    body = table.slice(1);
  } else if (table.every((r) => r.length === 4)) {
    fixed = FOUR_COLUMNS;
    mode = 'four';
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
      return {
        name: cell(columns.name), phone: cell(columns.phone),
        country: cell(columns.country), address: cell(columns.address), email: cell(emailAt), options,
      };
    })
    .filter((r): r is SurveyRow => !!r && !!(r.name || r.phone || r.country || r.address));
  return { rows, mode, missing };
}
