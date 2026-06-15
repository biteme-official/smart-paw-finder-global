import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env.local') });

const STORE_DOMAIN = process.env.VITE_SHOPIFY_STORE_DOMAIN!;
const CLIENT_ID = process.env.VITE_SHOPIFY_CLIENT_ID!;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET!;

async function getAccessToken(): Promise<string> {
  const res = await fetch(`https://${STORE_DOMAIN}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  });
  return (await res.json()).access_token;
}

async function gql(token: string, query: string, variables: Record<string, unknown> = {}) {
  const res = await fetch(`https://${STORE_DOMAIN}/admin/api/2025-07/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

function toG(v: number, u: string): number {
  if (u === 'KILOGRAMS') return v * 1000;
  if (u === 'POUNDS') return v * 453.592;
  if (u === 'OUNCES') return v * 28.3495;
  return v;
}

const ORDER_Q = `
  query O($q: String!) {
    orders(first: 1, query: $q) {
      edges { node {
        name
        lineItems(first: 50) { edges { node {
          title quantity sku
          variant {
            title sku
            inventoryItem { measurement { weight { value unit } } }
            product { handle }
          }
        } } }
      } }
    }
  }
`;

// 합배송 보정: #1280 = #1280+#1281+#1282 합산
// #1281/#1282 상품도 포함시켜야 하므로 별도 조회
const EXTRA_ORDERS = [1281, 1282];

interface ProductEntry {
  productTitle: string;
  variantTitle: string;
  key: string; // productTitle + variantTitle
  shopifyG: number;
  totalQtyAcrossOrders: number;
  orderNums: Set<number>;
}

async function main() {
  const wb = XLSX.readFile('C:/Users/User/Desktop/쇼피파이_실중량.xlsx');
  const rawRows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  const seen = new Set<number>();
  const excelRows: { num: number; actual: number; volume: number }[] = [];
  for (const row of rawRows.slice(1)) {
    if (!row[0]) continue;
    const num = Number(row[0]);
    if (seen.has(num)) continue;
    seen.add(num);
    excelRows.push({ num, actual: Number(row[1]), volume: Number(row[2]) });
  }

  const token = await getAccessToken();

  // 모든 주문번호 (엑셀 + 합배송 추가건)
  const allOrderNums = [...excelRows.map(r => r.num), ...EXTRA_ORDERS];

  const products = new Map<string, ProductEntry>();

  console.log(`엑셀 ${excelRows.length}건 + 합배송 ${EXTRA_ORDERS.length}건 = 총 ${allOrderNums.length}건 주문 상품 수집 중...`);

  for (const num of allOrderNums) {
    const data = await gql(token, ORDER_Q, { q: `name:#${num}` });
    const order = data.data?.orders?.edges?.[0]?.node;
    if (!order) continue;

    for (const { node: item } of order.lineItems.edges) {
      const rawVt = item.variant?.title;
      const vt = (rawVt && rawVt !== 'Default Title') ? rawVt : '';
      const key = `${item.title}|||${vt}`;

      const w = item.variant?.inventoryItem?.measurement?.weight;
      let unitG = w ? toG(w.value, w.unit) : 0;

      // Jumping Boogie 품절(삭제) 옵션: 0g → 30g 보정
      if (/jumping.*boogie/i.test(item.title) && unitG === 0) {
        unitG = 30;
      }

      if (products.has(key)) {
        const p = products.get(key)!;
        p.totalQtyAcrossOrders += item.quantity;
        p.orderNums.add(num);
      } else {
        products.set(key, {
          productTitle: item.title,
          variantTitle: vt,
          key,
          shopifyG: unitG,
          totalQtyAcrossOrders: item.quantity,
          orderNums: new Set([num]),
        });
      }
    }

    await new Promise(r => setTimeout(r, 200));
  }

  // TO-BE 배수 규칙
  function getTobeRule(title: string, shopifyG: number, variantTitle?: string): { tobeG: number; multiplier: string; category: string } {
    if (/jumping.*boogie/i.test(title))
      return { tobeG: 1300, multiplier: '고정 1300g', category: '🔴 특수-고정' };
    if (/cooling.*mat/i.test(title))
      return { tobeG: Math.round(shopifyG * 5.0), multiplier: '×5.0', category: '🔴 특수-극대형' };
    if (/life.*vest/i.test(title)) {
      const vt = (variantTitle || '').toUpperCase();
      if (/\bL\b/.test(vt)) return { tobeG: 4000, multiplier: '고정 4000g(L)', category: '🔴 특수-고정' };
      if (/\bM\b/.test(vt)) return { tobeG: 3600, multiplier: '고정 3600g(M)', category: '🔴 특수-고정' };
      return { tobeG: 1920, multiplier: '고정 1920g(S)', category: '🔴 특수-고정' };
    }
    if (/boong.*boong.*float/i.test(title))
      return { tobeG: Math.round(shopifyG * 2.5), multiplier: '×2.5', category: '🟠 특수-대형' };
    if (/braining.*spin/i.test(title))
      return { tobeG: Math.round(shopifyG * 2.0), multiplier: '×2.0', category: '🟡 특수-중형' };
    return { tobeG: Math.round(shopifyG * 3.0), multiplier: '×3.0', category: '⚪ 일반' };
  }

  // 카테고리별 정렬 후 출력
  const sorted = [...products.values()].sort((a, b) => {
    const catA = getTobeRule(a.productTitle, a.shopifyG, a.variantTitle).category;
    const catB = getTobeRule(b.productTitle, b.shopifyG, b.variantTitle).category;
    if (catA !== catB) return catA.localeCompare(catB);
    return b.shopifyG - a.shopifyG;
  });

  console.log(`\n상품 ${sorted.length}종 수집 완료\n`);

  // ═══ 메인 테이블 ═══
  console.log('═'.repeat(140));
  console.log('📋 AS-IS / TO-BE 상품별 과금중량 비교표');
  console.log('═'.repeat(140));

  console.log(
    '  ' +
    '카테고리'.padEnd(16) +
    '상품명'.padEnd(50) +
    '배리언트'.padEnd(22) +
    'AS-IS(g)'.padEnd(10) +
    '배수'.padEnd(12) +
    'TO-BE(g)'.padEnd(10) +
    '차이(g)'.padEnd(10) +
    '주문수'.padEnd(7) +
    '총수량'
  );
  console.log('  ' + '─'.repeat(136));

  let prevCategory = '';

  for (const p of sorted) {
    const { tobeG, multiplier, category } = getTobeRule(p.productTitle, p.shopifyG, p.variantTitle);
    const diff = tobeG - p.shopifyG;

    if (category !== prevCategory) {
      if (prevCategory) console.log('  ' + '─'.repeat(136));
      prevCategory = category;
    }

    const shortTitle = p.productTitle.length > 48 ? p.productTitle.slice(0, 45) + '...' : p.productTitle;
    const shortVar = (p.variantTitle || '').length > 20 ? p.variantTitle.slice(0, 17) + '...' : (p.variantTitle || '');

    console.log(
      '  ' +
      category.padEnd(16) +
      shortTitle.padEnd(50) +
      (shortVar || '-').padEnd(22) +
      `${p.shopifyG}`.padEnd(10) +
      multiplier.padEnd(12) +
      `${tobeG}`.padEnd(10) +
      `${diff >= 0 ? '+' : ''}${diff}`.padEnd(10) +
      `${p.orderNums.size}`.padEnd(7) +
      `${p.totalQtyAcrossOrders}`
    );
  }

  // ═══ 카테고리별 요약 ═══
  console.log(`\n\n${'═'.repeat(100)}`);
  console.log('📊 카테고리별 요약');
  console.log('═'.repeat(100));

  const catMap = new Map<string, { count: number; avgAsIs: number; avgToBe: number; totalAsIs: number; totalToBe: number }>();
  for (const p of sorted) {
    const { tobeG, category } = getTobeRule(p.productTitle, p.shopifyG);
    if (!catMap.has(category)) catMap.set(category, { count: 0, avgAsIs: 0, avgToBe: 0, totalAsIs: 0, totalToBe: 0 });
    const c = catMap.get(category)!;
    c.count++;
    c.totalAsIs += p.shopifyG;
    c.totalToBe += tobeG;
  }

  console.log(`  ${'카테고리'.padEnd(20)}${'상품수'.padEnd(8)}${'평균AS-IS'.padEnd(12)}${'평균TO-BE'.padEnd(12)}${'평균배수'}`);
  console.log(`  ${'─'.repeat(70)}`);

  for (const [cat, c] of catMap) {
    const avgAsIs = Math.round(c.totalAsIs / c.count);
    const avgToBe = Math.round(c.totalToBe / c.count);
    const avgMult = avgAsIs > 0 ? (avgToBe / avgAsIs).toFixed(1) : '-';
    console.log(`  ${cat.padEnd(20)}${String(c.count).padEnd(8)}${(avgAsIs + 'g').padEnd(12)}${(avgToBe + 'g').padEnd(12)}×${avgMult}`);
  }

  // ═══ 주문별 검증 — 합산 비교 ═══
  console.log(`\n\n${'═'.repeat(130)}`);
  console.log('📋 주문별 검증 — TO-BE 합산 vs 엑셀 과금중량');
  console.log('═'.repeat(130));

  console.log(
    '  ' +
    '주문'.padEnd(7) +
    '상품수'.padEnd(7) +
    'AS-IS합(g)'.padEnd(13) +
    'TO-BE합(g)'.padEnd(13) +
    '엑셀과금(g)'.padEnd(13) +
    'TO-BE오차'.padEnd(12) +
    'AS-IS오차'.padEnd(12) +
    '판정'
  );
  console.log('  ' + '─'.repeat(125));

  let matchCount = 0;
  let overCount = 0;
  let underCount = 0;
  let totalToBe = 0;
  let totalExcel = 0;

  for (const row of excelRows) {
    const data = await gql(token, ORDER_Q, { q: `name:#${row.num}` });
    const order = data.data?.orders?.edges?.[0]?.node;
    if (!order) continue;

    const billing = Math.max(row.actual, row.volume);
    let asIsSum = 0;
    let toBeSum = 0;
    let itemCount = 0;

    for (const { node: item } of order.lineItems.edges) {
      const w = item.variant?.inventoryItem?.measurement?.weight;
      let unitG = w ? toG(w.value, w.unit) : 0;
      if (/jumping.*boogie/i.test(item.title) && unitG === 0) unitG = 30;
      const totalG = unitG * item.quantity;
      asIsSum += totalG;

      const rawVt = item.variant?.title;
      const vt = (rawVt && rawVt !== 'Default Title') ? rawVt : '';
      const { tobeG } = getTobeRule(item.title, totalG, vt);
      toBeSum += tobeG;
      itemCount += item.quantity;
    }

    // #1280 합배송 보정: #1281/#1282 상품 추가
    if (row.num === 1280) {
      for (const extraNum of EXTRA_ORDERS) {
        const extraData = await gql(token, ORDER_Q, { q: `name:#${extraNum}` });
        const extraOrder = extraData.data?.orders?.edges?.[0]?.node;
        if (!extraOrder) continue;
        for (const { node: item } of extraOrder.lineItems.edges) {
          const w = item.variant?.inventoryItem?.measurement?.weight;
          let unitG = w ? toG(w.value, w.unit) : 0;
          if (/jumping.*boogie/i.test(item.title) && unitG === 0) unitG = 30;
          const totalG = unitG * item.quantity;
          asIsSum += totalG;
          const rawVt = item.variant?.title;
          const vt = (rawVt && rawVt !== 'Default Title') ? rawVt : '';
          const { tobeG } = getTobeRule(item.title, totalG, vt);
          toBeSum += tobeG;
          itemCount += item.quantity;
        }
      }
    }

    const tobePct = billing > 0 ? ((toBeSum - billing) / billing * 100) : 0;
    const asisPct = billing > 0 ? ((asIsSum - billing) / billing * 100) : 0;

    let verdict: string;
    if (Math.abs(tobePct) <= 20) { verdict = '✅ 적정'; matchCount++; }
    else if (tobePct > 20) { verdict = '⬆️ 과대'; overCount++; }
    else { verdict = '⬇️ 과소'; underCount++; }

    totalToBe += toBeSum;
    totalExcel += billing;

    console.log(
      '  ' +
      `#${String(row.num).padEnd(6)}` +
      `${itemCount}`.padEnd(7) +
      `${asIsSum}`.padEnd(13) +
      `${toBeSum}`.padEnd(13) +
      `${billing}`.padEnd(13) +
      `${tobePct >= 0 ? '+' : ''}${tobePct.toFixed(0)}%`.padEnd(12) +
      `${asisPct >= 0 ? '+' : ''}${asisPct.toFixed(0)}%`.padEnd(12) +
      verdict
    );

    await new Promise(r => setTimeout(r, 200));
  }

  console.log('  ' + '─'.repeat(125));
  console.log(
    '  ' +
    '합계'.padEnd(7) +
    ''.padEnd(7) +
    ''.padEnd(13) +
    `${totalToBe}`.padEnd(13) +
    `${totalExcel}`.padEnd(13) +
    `${((totalToBe - totalExcel) / totalExcel * 100).toFixed(0)}%`.padEnd(12)
  );
  console.log(`\n  판정: 적정(±20%) ${matchCount}건 / 과대(+20%↑) ${overCount}건 / 과소(-20%↓) ${underCount}건`);
  console.log(`  TO-BE 총합 ${totalToBe}g vs 엑셀 총합 ${totalExcel}g → 차이 ${totalToBe > totalExcel ? '+' : ''}${((totalToBe - totalExcel) / totalExcel * 100).toFixed(1)}%`);
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
