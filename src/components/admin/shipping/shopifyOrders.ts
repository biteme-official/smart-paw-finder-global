// Shopify "Export orders" CSV / xlsx → one entry per order. Runs in the browser only;
// the file contains customer data and is never uploaded or stored.
import type * as XLSXNS from 'xlsx';

type XLSXModule = typeof XLSXNS;

export interface ShopifyOrderLine {
  name: string;
  qty: number;
  price: string;
}

export interface ShopifyOrder {
  number: string;
  shippingName: string;
  email: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  province: string;
  zip: string;
  country: string;
  currency: string;
  total: string;
  shippingMethod: string;
  cancelled: boolean;
  lines: ShopifyOrderLine[];
}

type Row = Record<string, string>;

// Order-level columns are only filled on an order's first line; later lines inherit them.
const ORDER_COLUMNS = [
  'Email', 'Shipping Name', 'Shipping Phone', 'Shipping Address1', 'Shipping Address2', 'Shipping City',
  'Shipping Province', 'Shipping Zip', 'Shipping Country', 'Currency', 'Total', 'Shipping Method', 'Cancelled at',
] as const;

const cell = (row: Row, col: string) => String(row[col] ?? '').trim();

export function readShopifyRows(XLSX: XLSXModule, file: { name: string; data: ArrayBuffer }): Row[] {
  const isCsv = file.name.toLowerCase().endsWith('.csv');
  // raw: keep every cell as text (zip codes, prices) instead of letting the parser guess numbers.
  const wb = isCsv
    ? XLSX.read(new TextDecoder('utf-8').decode(file.data), { type: 'string', raw: true })
    : XLSX.read(file.data, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Row>(ws, { defval: '', raw: false });
}

export function parseShopifyOrders(rows: Row[]): ShopifyOrder[] {
  if (rows.length && !('Name' in rows[0] && 'Lineitem name' in rows[0])) {
    throw new Error('Shopify 주문 내보내기 파일이 아닙니다 (Name / Lineitem name 열 없음).');
  }
  const orders = new Map<string, ShopifyOrder>();
  const firstRow = new Map<string, Row>();
  for (const row of rows) {
    const number = cell(row, 'Name');
    if (!number) continue;
    if (!firstRow.has(number)) firstRow.set(number, row);
    const head = firstRow.get(number)!;
    const pick = (col: (typeof ORDER_COLUMNS)[number]) => cell(row, col) || cell(head, col);

    let order = orders.get(number);
    if (!order) {
      order = {
        number,
        shippingName: pick('Shipping Name'),
        email: pick('Email'),
        phone: pick('Shipping Phone').replace(/^'/, ''),
        address1: pick('Shipping Address1'),
        address2: pick('Shipping Address2'),
        city: pick('Shipping City'),
        province: pick('Shipping Province'),
        // Shopify prefixes zips with ' so spreadsheets keep leading zeros.
        zip: pick('Shipping Zip').replace(/^'/, ''),
        country: pick('Shipping Country'),
        currency: pick('Currency'),
        total: pick('Total'),
        shippingMethod: pick('Shipping Method'),
        cancelled: !!pick('Cancelled at'),
        lines: [],
      };
      orders.set(number, order);
    }
    const name = cell(row, 'Lineitem name');
    if (name) {
      const qty = Number.parseInt(cell(row, 'Lineitem quantity'), 10);
      order.lines.push({ name, qty: Number.isFinite(qty) && qty > 0 ? qty : 1, price: cell(row, 'Lineitem price') });
    }
  }
  // Cancelled orders are not shipped; fulfilment status doesn't matter (every line goes out).
  return [...orders.values()].filter((o) => !o.cancelled);
}

// Name prefixes written with an inner capital (LeBron, McDonald) that are not a name boundary.
const NAME_PARTICLES = /^(?:Le|La|De|Da|Di|Du|Del|Della|Des|Mc|Mac|Van|Von)$/;

/**
 * Shopify exports the shipping name as surname+given name glued together ("NgDesmond",
 * "NagaishiUn Hui"). Split at the lower→upper case boundary and put the given name first:
 * "Desmond Ng", "Un Hui Nagaishi". `ambiguous` when there is no single clear boundary.
 */
export function reorderShopifyName(raw: string): { name: string; ambiguous: boolean } {
  const name = raw.replace(/\s+/g, ' ').trim();
  if (!name) return { name, ambiguous: false };
  const boundaries = [...name.matchAll(/(?<=[a-z])(?=[A-Z])/g)].map((m) => m.index ?? 0);
  if (boundaries.length === 1) {
    const at = boundaries[0];
    // LeBron, DeAndre, McDonald, MacKenzie: the capital is inside one word, not a
    // surname / given-name boundary. Keep the name as typed and flag it.
    const word = name.slice(0, at).split(' ').pop() ?? '';
    if (NAME_PARTICLES.test(word)) return { name, ambiguous: true };
    const surname = name.slice(0, at).trim();
    const given = name.slice(at).trim();
    // The surname part is a single word; anything else (spaces before the boundary) is unclear.
    return { name: `${given} ${surname}`, ambiguous: /\s/.test(surname) };
  }
  return { name, ambiguous: true };
}

/**
 * 구매자전체결제금 per unit: the order total (discounts, shipping, duties included) split over
 * the lines in proportion to price × quantity, 2 decimals, so that Σ unit × qty === total.
 * Rounding leftovers go to a quantity-1 line; `exact` is false if they couldn't be placed.
 */
export function allocateUnitAmounts(qtys: number[], prices: string[], total: string): { units: number[]; exact: boolean } {
  const totalCents = Math.round(Number.parseFloat(total) * 100);
  const n = qtys.length;
  if (!n || !Number.isFinite(totalCents)) return { units: qtys.map(() => 0), exact: false };
  const lineValues = qtys.map((q, i) => (Number.parseFloat(prices[i]) || 0) * q);
  const sum = lineValues.reduce((a, b) => a + b, 0);
  const qtySum = qtys.reduce((a, b) => a + b, 0);
  // Unit share in cents: by line value, or evenly per unit when every price is 0.
  const unitCents = qtys.map((q, i) => (sum > 0
    ? Math.round((totalCents * lineValues[i]) / sum / q)
    : Math.round(totalCents / qtySum)));
  let diff = totalCents - unitCents.reduce((a, c, i) => a + c * qtys[i], 0);
  if (diff !== 0) {
    const single = qtys.findIndex((q) => q === 1);
    const target = single >= 0 ? single : qtys.findIndex((q) => diff % q === 0);
    if (target >= 0) {
      unitCents[target] += diff / qtys[target];
      diff = 0;
    }
  }
  return { units: unitCents.map((c) => c / 100), exact: diff === 0 };
}

export const isB2BShipping = (method: string) => method.trim().toLowerCase() === 'b2b shipping';
