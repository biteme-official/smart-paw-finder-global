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
  /** Total minus Refunded Amount: what the shipped lines are worth (구매자전체결제금 base). */
  total: string;
  shippingMethod: string;
  cancelled: boolean;
  /** Units of pending lines left out of a fulfilled order (refunded / sold out). */
  cancelledQty: number;
  /** Order not fulfilled yet: pending lines can't be told apart from refunded ones. */
  preShipment: boolean;
  lines: ShopifyOrderLine[];
}

type Row = Record<string, string>;

// Order-level columns are only filled on an order's first line; later lines inherit them.
const ORDER_COLUMNS = [
  'Email', 'Shipping Name', 'Shipping Phone', 'Shipping Address1', 'Shipping Address2', 'Shipping City',
  'Shipping Province', 'Shipping Zip', 'Shipping Country', 'Currency', 'Total', 'Shipping Method', 'Cancelled at',
  'Fulfillment Status', 'Refunded Amount',
] as const;

const cell = (row: Row, col: string) => String(row[col] ?? '').trim();

/** "79.01" - "16.00" → "63.01"; the total as exported when nothing was refunded. */
function netTotal(total: string, refunded: string): string {
  const t = Number.parseFloat(total);
  const r = Number.parseFloat(refunded);
  if (!Number.isFinite(t) || !Number.isFinite(r) || r <= 0) return total;
  return (Math.round(t * 100 - r * 100) / 100).toFixed(2);
}

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
  // Orders that had lines left out because they don't ship or were refunded.
  const skippedLines = new Set<string>();
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
        total: netTotal(pick('Total'), pick('Refunded Amount')),
        shippingMethod: pick('Shipping Method'),
        cancelled: !!pick('Cancelled at'),
        cancelledQty: 0,
        preShipment: pick('Fulfillment Status').toLowerCase() !== 'fulfilled',
        lines: [],
      };
      orders.set(number, order);
    }
    const name = cell(row, 'Lineitem name');
    // Shipping protection, gift cards, ...: not packed, so not a product line and no share of the amount.
    if (name && cell(row, 'Lineitem requires shipping').toLowerCase() === 'false') {
      skippedLines.add(number);
      continue;
    }
    if (name) {
      const parsed = Number.parseInt(cell(row, 'Lineitem quantity'), 10);
      const qty = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
      // Orders are exported after fulfilment: a line still pending in a fulfilled order was
      // refunded (sold out), so it isn't packed and gets no share of the amount.
      if (!order.preShipment && cell(row, 'Lineitem fulfillment status').toLowerCase() === 'pending') {
        order.cancelledQty += qty;
        skippedLines.add(number);
        continue;
      }
      order.lines.push({ name, qty, price: cell(row, 'Lineitem price') });
    }
  }
  // Cancelled orders are not shipped; fulfilment status doesn't matter (every line goes out).
  // An order with nothing left to ship (only a gift card, every line refunded, ...) has no shipment either.
  return [...orders.values()].filter((o) => !o.cancelled && !(o.lines.length === 0 && skippedLines.has(o.number)));
}

// Name prefixes written with an inner capital (LeBron, McDonald) that are not a name boundary.
const NAME_PARTICLES = /^(?:Le|La|De|Da|Di|Du|Del|Della|Des|Mc|Mac|Van|Von)$/;

/**
 * Shopify exports the shipping name as surname+given name glued together ("NgDesmond").
 * Only a single word with one lower→upper case boundary is reordered ("Desmond Ng").
 * A name with spaces is never reordered ("JoAnn Smith", "NagaishiUn Hui"): when it has a
 * glued part it is flagged `ambiguous` for the user to check, otherwise kept as written.
 */
export function reorderShopifyName(raw: string): { name: string; ambiguous: boolean } {
  const name = raw.replace(/\s+/g, ' ').trim();
  if (!name) return { name, ambiguous: false };
  const boundaries = [...name.matchAll(/(?<=[a-z])(?=[A-Z])/g)].map((m) => m.index ?? 0);
  if (/\s/.test(name)) return { name, ambiguous: boundaries.length > 0 };
  if (boundaries.length === 1) {
    const at = boundaries[0];
    // LeBron, DeAndre, McDonald, MacKenzie: the capital is inside one word, not a
    // surname / given-name boundary. Keep the name as typed and flag it.
    if (NAME_PARTICLES.test(name.slice(0, at))) return { name, ambiguous: true };
    return { name: `${name.slice(at)} ${name.slice(0, at)}`, ambiguous: false };
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
