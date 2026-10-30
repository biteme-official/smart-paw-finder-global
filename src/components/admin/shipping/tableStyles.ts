// Shared look of the 출고시트 and 수취인 조회 tables, laid out as a grid: every column is as wide as its
// content and the room that's left is shared out evenly between the columns (justify-between), so all
// gaps are the same across the full width. Rows are subgrids spanning every column, so the grey header
// bar and the row lines run edge to edge. A table needs grid-cols-[repeat(<columns>,max-content)].
// Headers stay on one line and are aligned like their cells (numbers right, the rest left).
// Long text (addresses, products, an opened order list) wraps inside a WRAP box instead of widening its column.
export const TABLE = 'grid w-full min-w-max justify-between text-xs';
export const GROUP = 'contents';
export const HEAD_ROW = 'col-span-full grid grid-cols-subgrid bg-gray-50 text-muted-foreground';
export const ROW = 'col-span-full grid grid-cols-subgrid border-t';
// Same wider inset at both ends of every row (header and body), inside the table's border.
const EDGE = 'first:pl-5 last:pr-5';
export const TH = `px-2.5 py-2 font-medium text-left self-end whitespace-nowrap ${EDGE}`;
export const TD = `px-2.5 py-2 self-center whitespace-nowrap ${EDGE}`;
/** A message row (empty / loading / error) across every column. */
export const FULL = 'col-span-full px-3 py-8 text-center';
export const WRAP = 'whitespace-normal break-words';
export const NUM = 'text-right tabular-nums';

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-10-28" as a local date; an ISO time as is. */
function toDate(value: string): Date {
  const ymd = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').map(Number) : null;
  return ymd ? new Date(ymd[0], ymd[1] - 1, ymd[2]) : new Date(value);
}

/** "2026-10-28" / an ISO time → "10.28" */
export const monthDay = (value: string) => {
  const d = toDate(value);
  return `${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
};

/** "2027-01-28" / an ISO time → "27.01.28" (with the year, for dates months ahead). */
export const shortDate = (value: string) => `${pad(toDate(value).getFullYear() % 100)}.${monthDay(value)}`;

/** ISO time → "10.30 14:17" */
export const shortDateTime = (iso: string) => {
  const d = new Date(iso);
  return `${monthDay(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
