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
  lines: ShopifyOrderLine[];
}

type Row = Record<string, string>;

// Order-level columns are only filled on an order's first line; later lines inherit them.
const ORDER_COLUMNS = [
  'Shipping Name', 'Shipping Phone', 'Shipping Address1', 'Shipping Address2', 'Shipping City',
  'Shipping Province', 'Shipping Zip', 'Shipping Country', 'Currency', 'Total', 'Shipping Method',
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
  return [...orders.values()];
}

export const isB2BShipping = (method: string) => method.trim().toLowerCase() === 'b2b shipping';
