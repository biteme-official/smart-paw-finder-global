import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { resolve } from 'path';
import type * as XLSXNS from 'xlsx';
import { SHEET_TTL_SECONDS, sheetFileName, type SheetKind, type StoredSheet } from '../api/shipping-sheets';
import { sheetRecipients } from '../src/components/admin/shipping/sheetRecipients';
import {
  assignOrderNumbers, buildRows, buildWorkbook, orderFullAddress, readCountries, type Recipient, type ShopifyOrderInfo,
} from '../src/components/admin/shipping/colosseum';

// ─────────────────────────────────────────────────────────────────────────────
// LOCAL DEV ONLY: sample 출고시트 for checking the 출고시트 tab.
// Imported by server/shipping-sheets-proxy.ts (vite dev server) only — never by api/, so nothing
// here reaches KV or a deployment. Every name / address / phone / email is fake.
// To remove the samples: delete this file and its import + call in shipping-sheets-proxy.ts.
// ─────────────────────────────────────────────────────────────────────────────

// The CommonJS build: the ESM one loaded in Node has no CFB (used by buildWorkbook).
const XLSX = createRequire(import.meta.url)('xlsx') as typeof XLSXNS;
const DAY = 24 * 60 * 60 * 1000;
const PRODUCTS = ['[Bite Me X Paldo] Paldo BibimMen Nosework Toy', '[Bite Me X Samjin Amook] Fish Cake Soup Toy',
  '[Bite Me X Choigosim] Lucky Squirrel Key Ring Toy'];

let n = 0;
const fakeContact = () => {
  n += 1;
  // Fake tracking numbers, written with hyphens to check that search ignores them.
  return {
    id: `sample-${n}`, name: `Test User ${n}`, phone: `+1 55501000${String(n).padStart(2, '0')}`,
    tracking: `TEST-${String(1000 + n)}-${String(n).padStart(4, '0')}`,
  };
};

/** Seeding card (survey address in one line). */
function seeding(products = 1): Recipient {
  const c = fakeContact();
  return {
    ...c, countryCode: 'US', address: `${n}00 Test St, Testville, CA 90001, USA`, city: 'Testville', state: 'CA', zip: '90001',
    products: PRODUCTS.slice(0, products), email: `test${n}@example.com`,
  };
}

/** Seeding card in Singapore. */
function seedingSg(): Recipient {
  const c = fakeContact();
  return {
    ...c, countryCode: 'SG', address: `Blk ${n} Example Road, #01-01, Singapore 123456`, city: 'Singapore', state: 'Singapore',
    zip: '123456', products: PRODUCTS.slice(1, 2), email: `test${n}@example.com`,
  };
}

/** Shopify order card, B2B or B2C (일반 주문). */
function order(number: string, b2b: boolean, products = 2): Recipient {
  const c = fakeContact();
  const place = { city: 'Sampleton', state: 'NY', zip: '10001', countryCode: 'US' };
  const info: ShopifyOrderInfo = {
    number, currency: 'USD', total: (20 * products).toFixed(2), b2b, email: `test${n}@example.com`,
    qtys: PRODUCTS.slice(0, products).map(() => (b2b ? 10 : 1)), prices: PRODUCTS.slice(0, products).map(() => '20.00'),
    hasAddress2: false,
  };
  return { ...c, ...place, address: orderFullAddress(`${n}0 Example Ave`, place), products: PRODUCTS.slice(0, products), order: info };
}

interface Sample { shipDate: string; startNo: number; savedDaysAgo: number; recipients: Recipient[] }

const SAMPLES = (): Sample[] => [
  { shipDate: '2026-10-28', startNo: 160, savedDaysAgo: 2, recipients: [seeding(), seeding(2), seeding()] },
  { shipDate: '2026-10-27', startNo: 160, savedDaysAgo: 3, recipients: [order('#1801', true, 3), order('#1802', true)] },
  {
    shipDate: '2026-10-24', startNo: 160, savedDaysAgo: 6,
    recipients: ['#1811', '#1812', '#1813', '#1814', '#1815'].map((no) => order(no, false, 1)),
  },
  {
    shipDate: '2026-10-20', startNo: 160, savedDaysAgo: 10,
    recipients: [order('#1820', true, 3), order('#1821', false), order('#1822', false, 1), order('#1823', false)],
  },
  { shipDate: '2026-10-10', startNo: 170, savedDaysAgo: 20, recipients: [seeding(), seedingSg(), order('#1830', false)] },
  // Saved 87 days ago: deleted in 3 days.
  { shipDate: '2026-08-04', startNo: 160, savedDaysAgo: 87, recipients: [seeding()] },
];

const kindOf = (r: Recipient): SheetKind => (r.order ? (r.order.b2b ? 'B2B' : '주문') : '시딩');

/** The sample sheets as the proxy stores them, each with a real .xlsx built from the template. */
export function buildSampleSheets(): StoredSheet[] {
  const template = readFileSync(resolve(process.cwd(), 'public/templates/colosseum-shipping-template.xlsx'));
  const buffer = template.buffer.slice(template.byteOffset, template.byteOffset + template.length) as ArrayBuffer;
  const countries = readCountries(XLSX, buffer);
  return SAMPLES().map((s, i) => {
    const orders = assignOrderNumbers(s.recipients, s.shipDate, s.startNo, countries);
    const seedingNos = [...new Set(s.recipients.filter((r) => !r.order).map((r) => orders.get(r.id) ?? ''))].filter(Boolean);
    const rows = buildRows(s.recipients, s.shipDate, countries, s.startNo);
    const savedAt = new Date(Date.now() - s.savedDaysAgo * DAY);
    const meta: StoredSheet['meta'] = {
      id: `sh_sample_${i + 1}`,
      savedAt: savedAt.toISOString(),
      expiresAt: new Date(savedAt.getTime() + SHEET_TTL_SECONDS * 1000).toISOString(),
      shipDate: s.shipDate,
      startNo: s.startNo,
      firstOrder: seedingNos[0] ?? '',
      lastOrder: seedingNos[seedingNos.length - 1] ?? '',
      orderNumbers: s.recipients.flatMap((r) => (r.order ? [r.order.number] : [])),
      kinds: [...new Set(s.recipients.map(kindOf))],
      recipients: s.recipients.length,
      lines: rows.length,
      fileName: sheetFileName(s.shipDate),
    };
    return {
      meta,
      recipients: sheetRecipients(s.recipients, rows, orders),
      file: Buffer.from(buildWorkbook(XLSX, buffer, rows)).toString('base64'),
    };
  });
}
