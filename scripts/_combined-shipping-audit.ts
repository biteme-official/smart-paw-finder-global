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
        name createdAt displayFulfillmentStatus
        customer { email displayName }
        shippingAddress { name address1 address2 city province country zip }
        lineItems(first: 50) { edges { node {
          title quantity
          variant { title inventoryItem { measurement { weight { value unit } } } }
        } } }
      } }
    }
  }
`;

const CUSTOMER_ORDERS_Q = `
  query CO($q: String!, $first: Int!, $after: String) {
    orders(first: $first, after: $after, query: $q, sortKey: CREATED_AT) {
      pageInfo { hasNextPage endCursor }
      edges { node {
        name createdAt
        shippingAddress { name address1 address2 city province country zip }
        lineItems(first: 50) { edges { node {
          title quantity
          variant { title inventoryItem { measurement { weight { value unit } } } }
        } } }
      } }
    }
  }
`;

function addrKey(a: any): string {
  if (!a) return '';
  return [a.name, a.address1, a.address2, a.city, a.province, a.country, a.zip]
    .map(s => (s || '').trim().toLowerCase()).join('|');
}

function orderShopifyG(order: any): number {
  let total = 0;
  for (const { node: item } of order.lineItems.edges) {
    const w = item.variant?.inventoryItem?.measurement?.weight;
    total += (w ? toG(w.value, w.unit) : 0) * item.quantity;
  }
  return total;
}

function orderItems(order: any): string[] {
  return order.lineItems.edges.map(({ node: item }: any) => {
    const w = item.variant?.inventoryItem?.measurement?.weight;
    const g = (w ? toG(w.value, w.unit) : 0) * item.quantity;
    const vt = item.variant?.title !== 'Default Title' ? ` (${item.variant?.title})` : '';
    return `${item.title}${vt} ×${item.quantity} [${g}g]`;
  });
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

  // Phase 1: 엑셀 전체 주문 기본 정보 수집
  console.log('Phase 1: 엑셀 29건 주문 정보 수집...');

  interface ExcelOrder {
    num: number;
    date: string;
    email: string;
    customerName: string;
    addrKey: string;
    addrShort: string;
    shopifyG: number;
    actual: number;
    volume: number;
    billing: number;
    hasBoogie: boolean;
    items: string[];
  }

  const orders: ExcelOrder[] = [];

  for (const row of excelRows) {
    const data = await gql(token, ORDER_Q, { q: `name:#${row.num}` });
    const o = data.data?.orders?.edges?.[0]?.node;
    if (!o) continue;

    const hasBoogie = o.lineItems.edges.some(({ node: i }: any) => /jumping.*boogie/i.test(i.title));
    const addr = o.shippingAddress;

    orders.push({
      num: row.num,
      date: o.createdAt?.slice(0, 10) || '',
      email: o.customer?.email || '',
      customerName: o.customer?.displayName || addr?.name || '',
      addrKey: addrKey(addr),
      addrShort: addr ? [addr.name, addr.address1, addr.city, addr.country].filter(Boolean).join(', ') : '-',
      shopifyG: orderShopifyG(o),
      actual: row.actual,
      volume: row.volume,
      billing: Math.max(row.actual, row.volume),
      hasBoogie,
      items: orderItems(o),
    });

    await new Promise(r => setTimeout(r, 200));
  }

  // Phase 2: 각 고객 이메일별로 같은 날짜 ±1일 내 다른 주문 존재하는지 확인
  console.log('Phase 2: 고객별 합배송 가능성 확인...\n');

  interface CombinedGroup {
    excelOrder: ExcelOrder;
    siblingOrders: { num: number; date: string; shopifyG: number; items: string[] }[];
    combinedShopifyG: number;
    combinedRatio: number;
  }

  const combinedGroups: CombinedGroup[] = [];
  const checkedEmails = new Map<string, any[]>();

  for (const eo of orders) {
    if (!eo.email) continue;

    let customerOrders: any[];
    if (checkedEmails.has(eo.email)) {
      customerOrders = checkedEmails.get(eo.email)!;
    } else {
      customerOrders = [];
      let after: string | null = null;
      while (true) {
        const data = await gql(token, CUSTOMER_ORDERS_Q, {
          q: `email:${eo.email}`,
          first: 50,
          after,
        });
        const edges = data.data?.orders?.edges || [];
        for (const { node } of edges) customerOrders.push(node);
        if (!data.data?.orders?.pageInfo?.hasNextPage) break;
        after = data.data.orders.pageInfo.endCursor;
        await new Promise(r => setTimeout(r, 200));
      }
      checkedEmails.set(eo.email, customerOrders);
    }

    // 같은 날짜 ±1일, 같은 배송지
    const eoDate = new Date(eo.date).getTime();
    const siblings: { num: number; date: string; shopifyG: number; items: string[] }[] = [];

    for (const co of customerOrders) {
      const coNum = Number(co.name.replace('#', ''));
      if (coNum === eo.num) continue;
      const coDate = new Date(co.createdAt?.slice(0, 10)).getTime();
      const dayDiff = Math.abs(coDate - eoDate) / 86400000;
      if (dayDiff > 1) continue;

      const coAddrKey = addrKey(co.shippingAddress);
      if (coAddrKey !== eo.addrKey) continue;

      // 엑셀에 이미 있는 주문이면 제외 (각각 실측 있으면 합배송 아님)
      const inExcel = orders.some(x => x.num === coNum);

      siblings.push({
        num: coNum,
        date: co.createdAt?.slice(0, 10) || '',
        shopifyG: orderShopifyG(co),
        items: orderItems(co),
      });
    }

    if (siblings.length > 0) {
      const combinedShopifyG = eo.shopifyG + siblings.reduce((s, x) => s + x.shopifyG, 0);
      const combinedRatio = combinedShopifyG > 0 ? eo.billing / combinedShopifyG : 0;
      combinedGroups.push({ excelOrder: eo, siblingOrders: siblings, combinedShopifyG, combinedRatio });
    }
  }

  // Phase 3: 결과 출력
  console.log('═'.repeat(120));
  console.log('📦 합배송 전수조사 결과');
  console.log('═'.repeat(120));

  if (combinedGroups.length === 0) {
    console.log('\n  합배송 케이스 없음 (엑셀 외 동일 배송지 ±1일 주문 없음)');
  } else {
    for (const g of combinedGroups) {
      const eo = g.excelOrder;
      const oldRatio = eo.shopifyG > 0 ? eo.billing / eo.shopifyG : 0;

      console.log(`\n  ┌─ 엑셀 주문 #${eo.num} — ${eo.date} — ${eo.customerName}`);
      console.log(`  │  배송지: ${eo.addrShort}`);
      console.log(`  │  엑셀: 실${eo.actual}g / 부피${eo.volume}g / 과금 ${eo.billing}g`);
      console.log(`  │  Shopify: ${eo.shopifyG}g — 단독배율 ×${oldRatio.toFixed(2)}`);
      for (const item of eo.items) console.log(`  │    ${item}`);

      for (const sib of g.siblingOrders) {
        const inExcel = orders.some(x => x.num === sib.num);
        console.log(`  │`);
        console.log(`  ├─ 합배송 추정 #${sib.num} — ${sib.date} — Shopify ${sib.shopifyG}g ${inExcel ? '(엑셀 포함)' : '(엑셀 미포함)'}`);
        for (const item of sib.items) console.log(`  │    ${item}`);
      }

      console.log(`  │`);
      console.log(`  └─ 합산: Shopify ${g.combinedShopifyG}g → 과금 ${eo.billing}g → 합산배율 ×${g.combinedRatio.toFixed(2)} (단독 ×${oldRatio.toFixed(2)}에서 보정)`);
    }
  }

  // Phase 4: 보정 후 전체 배율 재계산
  console.log(`\n\n${'═'.repeat(120)}`);
  console.log('📊 합배송 보정 후 — 전체 배율 재계산');
  console.log('═'.repeat(120));

  // 합배송 그룹의 엑셀 주문번호 → 보정 배율 매핑
  const correctedRatios = new Map<number, number>();
  for (const g of combinedGroups) {
    correctedRatios.set(g.excelOrder.num, g.combinedRatio);
  }

  interface FinalRow {
    num: number;
    billing: number;
    shopifyG: number;
    ratio: number;
    correctedRatio: number;
    hasBoogie: boolean;
    isCombined: boolean;
  }

  const finals: FinalRow[] = [];
  for (const eo of orders) {
    const ratio = eo.shopifyG > 0 ? eo.billing / eo.shopifyG : 0;
    // Boogie 보정: hasBoogie인 경우 Shopify에 Boogie 차이만큼 가산
    let corrected = correctedRatios.has(eo.num) ? correctedRatios.get(eo.num)! : ratio;

    finals.push({
      num: eo.num,
      billing: eo.billing,
      shopifyG: eo.shopifyG,
      ratio,
      correctedRatio: corrected,
      hasBoogie: eo.hasBoogie,
      isCombined: correctedRatios.has(eo.num),
    });
  }

  console.log(`\n  ${'주문'.padEnd(7)}${'과금(g)'.padEnd(10)}${'Shopify(g)'.padEnd(12)}${'단독배율'.padEnd(10)}${'보정배율'.padEnd(10)}${'Boogie'.padEnd(8)}${'합배송'.padEnd(8)}비고`);
  console.log(`  ${'─'.repeat(110)}`);

  for (const f of finals.sort((a, b) => a.num - b.num)) {
    const note = f.correctedRatio > 10 ? '⚠ 아웃라이어' : f.correctedRatio < 1 ? '⚠ Shopify>과금' : '';
    console.log(
      `  #${String(f.num).padEnd(6)}` +
      `${(f.billing + 'g').padEnd(10)}` +
      `${(f.shopifyG + 'g').padEnd(12)}` +
      `×${f.ratio.toFixed(2).padEnd(9)}` +
      `×${f.correctedRatio.toFixed(2).padEnd(9)}` +
      `${f.hasBoogie ? 'Y' : '-'}`.padEnd(8) +
      `${f.isCombined ? 'Y' : '-'}`.padEnd(8) +
      note
    );
  }

  // 통계
  const valid = finals.filter(f => f.correctedRatio > 0 && f.correctedRatio < 50);
  const boogieOrders = valid.filter(f => f.hasBoogie);
  const noBoogieOrders = valid.filter(f => !f.hasBoogie);

  const stats = (arr: FinalRow[], label: string) => {
    if (arr.length === 0) return;
    const ratios = arr.map(f => f.correctedRatio).sort((a, b) => a - b);
    const avg = ratios.reduce((s, v) => s + v, 0) / ratios.length;
    const med = ratios[Math.floor(ratios.length / 2)];
    const p75 = ratios[Math.floor(ratios.length * 0.75)];
    const p90 = ratios[Math.floor(ratios.length * 0.90)];
    const min = ratios[0];
    const max = ratios[ratios.length - 1];
    console.log(`  ${label} (${arr.length}건): 평균 ×${avg.toFixed(2)} / 중앙 ×${med.toFixed(2)} / p75 ×${p75.toFixed(2)} / p90 ×${p90.toFixed(2)} / 최소 ×${min.toFixed(2)} / 최대 ×${max.toFixed(2)}`);
  };

  console.log(`\n  ${'═'.repeat(80)}`);
  console.log('  📈 합배송 보정 후 배율 통계');
  console.log(`  ${'═'.repeat(80)}`);
  stats(valid, '전체');
  stats(boogieOrders, 'Boogie 포함');
  stats(noBoogieOrders, 'Boogie 미포함');

  // 커버율
  console.log(`\n  ${'═'.repeat(80)}`);
  console.log('  🔢 합배송 보정 후 — 배율별 커버율 (전체)');
  console.log(`  ${'═'.repeat(80)}`);

  for (const mult of [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0]) {
    let covered = 0;
    for (const f of valid) {
      if (f.correctedRatio <= mult) covered++;
    }
    const pct = ((covered / valid.length) * 100).toFixed(0);
    const bar = '█'.repeat(Math.round(covered / valid.length * 40));
    console.log(`    ×${mult.toFixed(1)} → ${pct.padStart(3)}% (${covered}/${valid.length}) ${bar}`);
  }

  // Boogie 미포함만
  console.log(`\n  🔢 합배송 보정 후 — 배율별 커버율 (Boogie 미포함만)`);
  console.log(`  ${'─'.repeat(80)}`);

  for (const mult of [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0]) {
    let covered = 0;
    for (const f of noBoogieOrders) {
      if (f.correctedRatio <= mult) covered++;
    }
    const pct = ((covered / noBoogieOrders.length) * 100).toFixed(0);
    const bar = '█'.repeat(Math.round(covered / noBoogieOrders.length * 40));
    console.log(`    ×${mult.toFixed(1)} → ${pct.padStart(3)}% (${covered}/${noBoogieOrders.length}) ${bar}`);
  }
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
