// Bulk recipient input: rows copied from the survey response Google Sheet.
// Runs in the browser only; nothing is sent anywhere.

export interface SurveyRow {
  name: string;
  phone: string;
  country: string;
  address: string;
}

export type SurveyPasteMode = 'header' | 'default' | 'four';

type Field = keyof SurveyRow;

// Header text (lower-cased "includes" match) for each field. Survey columns may move as
// questions are added, so a pasted header row always wins over fixed positions.
const HEADER_KEYS: Record<Field, string> = {
  name: "recipient's full name",
  phone: "recipient's phone",
  country: 'country / region',
  address: 'full shipping address',
};

// Without a header: Timestamp / ID / Yes / name / phone / country / address (A–G).
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

export function parseSurveyPaste(text: string): { rows: SurveyRow[]; mode: SurveyPasteMode } {
  const table = parseTsv(text).filter((r) => r.some((c) => c.trim()));
  if (!table.length) return { rows: [], mode: 'default' };

  let columns: Record<Field, number> | null = null;
  let mode: SurveyPasteMode;
  let body = table;

  const header = table[0].map((c) => c.toLowerCase());
  const found = Object.fromEntries(
    (Object.keys(HEADER_KEYS) as Field[]).map((f) => [f, header.findIndex((h) => h.includes(HEADER_KEYS[f]))]),
  ) as Record<Field, number>;
  if (Object.values(found).some((i) => i >= 0)) {
    // Header row present: missing columns fall back to the default position.
    columns = Object.fromEntries(
      (Object.keys(found) as Field[]).map((f) => [f, found[f] >= 0 ? found[f] : DEFAULT_COLUMNS[f]]),
    ) as Record<Field, number>;
    mode = 'header';
    body = table.slice(1);
  } else if (table.every((r) => r.length === 4)) {
    columns = FOUR_COLUMNS;
    mode = 'four';
  } else {
    columns = DEFAULT_COLUMNS;
    mode = 'default';
  }

  const rows = body
    .map((r) => ({
      name: clean(r[columns.name]),
      phone: clean(r[columns.phone]),
      country: clean(r[columns.country]),
      address: clean(r[columns.address]),
    }))
    .filter((r) => r.name || r.phone || r.country || r.address);
  return { rows, mode };
}
