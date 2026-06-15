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
          title quantity
          variant {
            title
            inventoryItem { measurement { weight { value unit } } }
          }
        } } }
      } }
    }
  }
`;

function getTobeRule(title: string, asIsG: number, variantTitle?: string): { tobeG: number; rule: string; cat: string } {
  if (/jumping.*boogie/i.test(title))
    return { tobeG: 1300, rule: '고정1300g', cat: '특수' };
  if (/cooling.*mat/i.test(title))
    return { tobeG: Math.round(asIsG * 5.0), rule: '×5.0', cat: '특수' };
  if (/life.*vest/i.test(title)) {
    const vt = (variantTitle || '').toUpperCase();
    if (/\bL\b/.test(vt)) return { tobeG: 4000, rule: '고정4000g(L)', cat: '특수' };
    if (/\bM\b/.test(vt)) return { tobeG: 3600, rule: '고정3600g(M)', cat: '특수' };
    return { tobeG: 1920, rule: '고정1920g(S)', cat: '특수' };
  }
  if (/boong.*boong.*float/i.test(title))
    return { tobeG: Math.round(asIsG * 2.5), rule: '×2.5', cat: '특수' };
  if (/braining.*spin/i.test(title))
    return { tobeG: Math.round(asIsG * 2.0), rule: '×2.0', cat: '특수' };
  return { tobeG: Math.round(asIsG * 3.0), rule: '×3.0', cat: '일반' };
}

const EXTRA_ORDERS = [1281, 1282];

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

  console.log('═'.repeat(140));
  console.log('📋 주문번호별 AS-IS / TO-BE 상세 비교');
  console.log('═'.repeat(140));

  let grandAsIs = 0;
  let grandToBe = 0;
  let grandExcel = 0;

  for (const row of excelRows.sort((a, b) => a.num - b.num)) {
    const billing = Math.max(row.actual, row.volume);

    // 주문 상품 수집
    interface LineItem {
      title: string;
      varTitle: string;
      qty: number;
      asIsUnit: number;
      asIsTotal: number;
      tobeUnit: number;
      tobeTotal: number;
      rule: string;
      cat: string;
      orderNum: number;
    }

    const items: LineItem[] = [];

    const data = await gql(token, ORDER_Q, { q: `name:#${row.num}` });
    const order = data.data?.orders?.edges?.[0]?.node;
    if (!order) continue;

    for (const { node: item } of order.lineItems.edges) {
      const w = item.variant?.inventoryItem?.measurement?.weight;
      let unitG = w ? toG(w.value, w.unit) : 0;
      if (/jumping.*boogie/i.test(item.title) && unitG === 0) unitG = 30;

      const rawVt = item.variant?.title;
      const vt = (rawVt && rawVt !== 'Default Title') ? rawVt : '';
      const { tobeG, rule, cat } = getTobeRule(item.title, unitG * item.quantity, vt);

      items.push({
        title: item.title,
        varTitle: vt,
        qty: item.quantity,
        asIsUnit: unitG,
        asIsTotal: unitG * item.quantity,
        tobeUnit: Math.round(tobeG / item.quantity),
        tobeTotal: tobeG,
        rule,
        cat,
        orderNum: row.num,
      });
    }

    // #1280 합배송: #1281/#1282 추가
    if (row.num === 1280) {
      for (const extraNum of EXTRA_ORDERS) {
        const extraData = await gql(token, ORDER_Q, { q: `name:#${extraNum}` });
        const extraOrder = extraData.data?.orders?.edges?.[0]?.node;
        if (!extraOrder) continue;
        for (const { node: item } of extraOrder.lineItems.edges) {
          const w = item.variant?.inventoryItem?.measurement?.weight;
          let unitG = w ? toG(w.value, w.unit) : 0;
          if (/jumping.*boogie/i.test(item.title) && unitG === 0) unitG = 30;

          const rawVt = item.variant?.title;
          const vt = (rawVt && rawVt !== 'Default Title') ? rawVt : '';
          const { tobeG, rule, cat } = getTobeRule(item.title, unitG * item.quantity, vt);

          items.push({
            title: item.title,
            varTitle: vt,
            qty: item.quantity,
            asIsUnit: unitG,
            asIsTotal: unitG * item.quantity,
            tobeUnit: Math.round(tobeG / item.quantity),
            tobeTotal: tobeG,
            rule,
            cat,
            orderNum: extraNum,
          });
        }
      }
    }

    const asIsSum = items.reduce((s, i) => s + i.asIsTotal, 0);
    const toBeSum = items.reduce((s, i) => s + i.tobeTotal, 0);
    const tobePct = billing > 0 ? ((toBeSum - billing) / billing * 100) : 0;
    const asisPct = billing > 0 ? ((asIsSum - billing) / billing * 100) : 0;

    let verdict: string;
    if (Math.abs(tobePct) <= 20) verdict = '✅ 적정';
    else if (tobePct > 20) verdict = '⬆️ 과대';
    else verdict = '⬇️ 과소';

    const hasBoogie = items.some(i => /jumping.*boogie/i.test(i.title));

    grandAsIs += asIsSum;
    grandToBe += toBeSum;
    grandExcel += billing;

    // 주문 헤더
    console.log(`\n${'━'.repeat(140)}`);
    console.log(`  #${row.num}${hasBoogie ? ' [Boogie]' : ''}${row.num === 1280 ? ' [합배송 #1280+#1281+#1282]' : ''}  │  엑셀: 실${row.actual}g / 부피${row.volume}g / 과금 ${billing}g  │  ${verdict}`);
    console.log(`  AS-IS 합산: ${asIsSum}g (${asisPct >= 0 ? '+' : ''}${asisPct.toFixed(0)}%)  │  TO-BE 합산: ${toBeSum}g (${tobePct >= 0 ? '+' : ''}${tobePct.toFixed(0)}%)`);
    console.log(`  ${'─'.repeat(136)}`);
    console.log(
      '  ' +
      '상품명'.padEnd(48) +
      '배리언트'.padEnd(20) +
      '수량'.padEnd(5) +
      'AS-IS단가'.padEnd(10) +
      'AS-IS소계'.padEnd(10) +
      '배수'.padEnd(11) +
      'TO-BE단가'.padEnd(10) +
      'TO-BE소계'.padEnd(10) +
      '비고'
    );
    console.log(`  ${'─'.repeat(136)}`);

    for (const item of items) {
      const shortTitle = item.title.length > 46 ? item.title.slice(0, 43) + '...' : item.title;
      const shortVar = (item.varTitle || '-').length > 18 ? item.varTitle.slice(0, 15) + '...' : (item.varTitle || '-');
      const note = item.cat === '특수' ? '★' : '';
      const extra = item.orderNum !== row.num ? ` (#${item.orderNum})` : '';

      console.log(
        '  ' +
        shortTitle.padEnd(48) +
        shortVar.padEnd(20) +
        `×${item.qty}`.padEnd(5) +
        `${item.asIsUnit}g`.padEnd(10) +
        `${item.asIsTotal}g`.padEnd(10) +
        item.rule.padEnd(11) +
        `${item.tobeUnit}g`.padEnd(10) +
        `${item.tobeTotal}g`.padEnd(10) +
        note + extra
      );
    }

    console.log(`  ${'─'.repeat(136)}`);
    console.log(
      '  ' +
      '합계'.padEnd(48) +
      ''.padEnd(20) +
      ''.padEnd(5) +
      ''.padEnd(10) +
      `${asIsSum}g`.padEnd(10) +
      ''.padEnd(11) +
      ''.padEnd(10) +
      `${toBeSum}g`.padEnd(10) +
      `엑셀 ${billing}g`
    );

    await new Promise(r => setTimeout(r, 200));
  }

  // 최종 요약
  console.log(`\n\n${'═'.repeat(140)}`);
  console.log('📊 전체 요약');
  console.log('═'.repeat(140));
  console.log(`  총 ${excelRows.length}건 주문`);
  console.log(`  AS-IS 총합: ${grandAsIs.toLocaleString()}g (엑셀 대비 ${((grandAsIs - grandExcel) / grandExcel * 100).toFixed(1)}%)`);
  console.log(`  TO-BE 총합: ${grandToBe.toLocaleString()}g (엑셀 대비 +${((grandToBe - grandExcel) / grandExcel * 100).toFixed(1)}%)`);
  console.log(`  엑셀 총합:  ${grandExcel.toLocaleString()}g`);
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
