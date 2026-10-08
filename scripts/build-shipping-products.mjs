// Rebuilds the product suggestions for /manage/international-shipping from the
// Colosseum product list workbooks. Only "상품명 (영문)" and "HS CODE" are kept —
// barcodes and other columns never enter the repo.
//
// usage: node scripts/build-shipping-products.mjs <상품리스트.xlsx> [more.xlsx ...]
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const OUT = fileURLToPath(new URL('../src/components/admin/shipping/shipping-products.json', import.meta.url));
const NAME_COL = '상품명 (영문)';
const HS_COL = 'HS CODE';

// Names shipped to Colosseum that are not in the product list workbooks.
// Kept here so they survive regenerating the JSON from new workbooks.
const EXTRA_PRODUCTS = [
  { name: 'Biteme Jumping Crab Toy (Cover only)', hs: '' },
];

const files = process.argv.slice(2);
if (!files.length) {
  console.error('usage: node scripts/build-shipping-products.mjs <상품리스트.xlsx> [more.xlsx ...]');
  process.exit(1);
}

const byName = new Map();
for (const file of files) {
  const wb = XLSX.read(readFileSync(file));
  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
    for (const row of rows) {
      const name = String(row[NAME_COL] ?? '').replace(/\s+/g, ' ').trim();
      if (!name || byName.has(name.toLowerCase())) continue;
      byName.set(name.toLowerCase(), { name, hs: String(row[HS_COL] ?? '').trim() });
    }
  }
}

for (const extra of EXTRA_PRODUCTS) {
  if (!byName.has(extra.name.toLowerCase())) byName.set(extra.name.toLowerCase(), extra);
}

const products = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(OUT, `${JSON.stringify(products, null, 2)}\n`);
console.log(`${products.length} products → ${OUT}`);
