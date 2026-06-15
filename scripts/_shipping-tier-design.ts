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

// 특수 상품 과금중량 오버라이드 (g)
const WEIGHT_OVERRIDES: Record<string, number> = {
  'jumping boogie': 1300,
};

// 부피 대형 상품 — 별도 배수 적용 대상
const BULKY_PATTERNS = [
  { pattern: /jumping.*boogie/i, fixedG: 1300 },
  { pattern: /braining.*spin.*bunny/i, multiplier: 2.0 },
  { pattern: /braining.*spin.*squirrel/i, multiplier: 2.0 },
  { pattern: /cooling.*mat/i, multiplier: 5.0 },
  { pattern: /life.*vest/i, multiplier: 4.0 },
  { pattern: /boong.*boong.*float/i, multiplier: 2.5 },
];

function getItemBillingWeight(title: string, shopifyG: number): { billingG: number; rule: string } {
  for (const b of BULKY_PATTERNS) {
    if (b.pattern.test(title)) {
      if (b.fixedG) return { billingG: b.fixedG, rule: `고정 ${b.fixedG}g` };
      return { billingG: Math.round(shopifyG * b.multiplier), rule: `×${b.multiplier}` };
    }
  }
  return { billingG: Math.round(shopifyG * 3.0), rule: '기본 ×3.0' };
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

  // ═══════════════════════════════════════════════════════
  // PART 1: 배율 시뮬레이션 — 다양한 배수 전략 비교
  // ═══════════════════════════════════════════════════════
  console.log('═'.repeat(130));
  console.log('📐 배송비 티어 설계 — 배율 전략 시뮬레이션');
  console.log('═'.repeat(130));

  // 합배송 보정: #1280은 #1281+#1282 포함 시 Shopify 합산 3324g
  const COMBINED_SHOPIFY: Record<number, number> = { 1280: 3324 };

  interface OrderSim {
    num: number;
    excelBilling: number;
    shopifyG: number;
    hasBoogie: boolean;
    boogieCorrectedG: number;
    items: { title: string; qty: number; unitG: number; isBulky: boolean; rule: string; billingG: number }[];
    strategyResults: Record<string, { estimatedG: number; diff: number; pct: number }>;
  }

  const sims: OrderSim[] = [];

  for (const row of excelRows) {
    const data = await gql(token, ORDER_Q, { q: `name:#${row.num}` });
    const order = data.data?.orders?.edges?.[0]?.node;
    if (!order) continue;

    const excelBilling = Math.max(row.actual, row.volume);
    let shopifyG = COMBINED_SHOPIFY[row.num] || 0;
    let hasBoogie = false;

    const items: OrderSim['items'] = [];

    for (const { node: item } of order.lineItems.edges) {
      const w = item.variant?.inventoryItem?.measurement?.weight;
      const unitG = w ? toG(w.value, w.unit) : 0;
      const totalG = unitG * item.quantity;
      if (!COMBINED_SHOPIFY[row.num]) shopifyG += totalG;

      if (/jumping.*boogie/i.test(item.title)) hasBoogie = true;

      const { billingG, rule } = getItemBillingWeight(item.title, totalG);
      const isBulky = BULKY_PATTERNS.some(b => b.pattern.test(item.title));

      items.push({
        title: `${item.title}${item.variant?.title !== 'Default Title' ? ` (${item.variant?.title})` : ''}`,
        qty: item.quantity,
        unitG,
        isBulky,
        rule,
        billingG: billingG * (isBulky && BULKY_PATTERNS.some(b => b.fixedG && b.pattern.test(item.title)) ? 1 : 1),
      });
    }

    // Boogie 보정 Shopify 중량
    let boogieCorrectedG = 0;
    for (const { node: item } of order.lineItems.edges) {
      const w = item.variant?.inventoryItem?.measurement?.weight;
      const unitG = w ? toG(w.value, w.unit) : 0;
      if (/jumping.*boogie/i.test(item.title)) {
        boogieCorrectedG += 1300 * item.quantity;
      } else {
        boogieCorrectedG += unitG * item.quantity;
      }
    }
    if (COMBINED_SHOPIFY[row.num]) boogieCorrectedG = COMBINED_SHOPIFY[row.num];

    // 전략별 추정치 계산
    const strategies: Record<string, number> = {};

    // A: 균일 배수 (Boogie 1300g 고정 후)
    strategies['A_균일×2.5'] = Math.round(boogieCorrectedG * 2.5);
    strategies['A_균일×3.0'] = Math.round(boogieCorrectedG * 3.0);
    strategies['A_균일×3.5'] = Math.round(boogieCorrectedG * 3.5);

    // B: 상품별 차등 배수 (bulky 별도)
    let bEstimate = 0;
    for (const { node: item } of order.lineItems.edges) {
      const w = item.variant?.inventoryItem?.measurement?.weight;
      const unitG = w ? toG(w.value, w.unit) : 0;
      const totalG = unitG * item.quantity;
      const { billingG } = getItemBillingWeight(item.title, totalG);
      bEstimate += billingG;
    }
    if (COMBINED_SHOPIFY[row.num]) {
      bEstimate = Math.round(COMBINED_SHOPIFY[row.num] * 3.0);
    }
    strategies['B_차등배수'] = bEstimate;

    // C: 구간별 차등 (1kg 미만 ×3.5, 1-5kg ×3.0, 5kg+ ×2.5)
    const baseG = boogieCorrectedG;
    let cEstimate: number;
    if (baseG < 1000) cEstimate = Math.round(baseG * 3.5);
    else if (baseG < 5000) cEstimate = Math.round(baseG * 3.0);
    else cEstimate = Math.round(baseG * 2.5);
    strategies['C_구간차등'] = cEstimate;

    const strategyResults: OrderSim['strategyResults'] = {};
    for (const [name, est] of Object.entries(strategies)) {
      const diff = est - excelBilling;
      const pct = excelBilling > 0 ? ((diff / excelBilling) * 100) : 0;
      strategyResults[name] = { estimatedG: est, diff, pct };
    }

    sims.push({ num: row.num, excelBilling, shopifyG, hasBoogie, boogieCorrectedG, items, strategyResults });
    await new Promise(r => setTimeout(r, 200));
  }

  // 전략별 비교표
  const stratNames = ['A_균일×2.5', 'A_균일×3.0', 'A_균일×3.5', 'B_차등배수', 'C_구간차등'];

  console.log(`\n  ${'주문'.padEnd(7)}${'엑셀과금'.padEnd(10)}${'Boogie보정'.padEnd(10)}` +
    stratNames.map(s => s.padEnd(14)).join(''));
  console.log(`  ${'─'.repeat(7 + 10 + 10 + 14 * stratNames.length)}`);

  for (const sim of sims.sort((a, b) => a.num - b.num)) {
    let line = `  #${String(sim.num).padEnd(6)}${(sim.excelBilling + 'g').padEnd(10)}${(sim.boogieCorrectedG + 'g').padEnd(10)}`;
    for (const name of stratNames) {
      const r = sim.strategyResults[name];
      const sign = r.diff >= 0 ? '+' : '';
      line += `${sign}${r.pct.toFixed(0)}%`.padEnd(14);
    }
    console.log(line);
  }

  // 전략별 통계
  console.log(`\n\n${'═'.repeat(130)}`);
  console.log('📊 전략별 성능 비교');
  console.log('═'.repeat(130));

  for (const name of stratNames) {
    const diffs = sims.map(s => s.strategyResults[name].pct);
    const overEstimate = diffs.filter(d => d > 0);
    const underEstimate = diffs.filter(d => d < 0);
    const avgOver = overEstimate.length > 0 ? overEstimate.reduce((s, v) => s + v, 0) / overEstimate.length : 0;
    const avgUnder = underEstimate.length > 0 ? underEstimate.reduce((s, v) => s + v, 0) / underEstimate.length : 0;
    const maxOver = overEstimate.length > 0 ? Math.max(...overEstimate) : 0;
    const maxUnder = underEstimate.length > 0 ? Math.min(...underEstimate) : 0;
    const withinRange = diffs.filter(d => d >= -20 && d <= 50);

    // 과소추정 건수 (배송비 손실 리스크)
    const lossOrders = sims.filter(s => s.strategyResults[name].pct < -10);

    console.log(`\n  📌 ${name}`);
    console.log(`    과대추정: ${overEstimate.length}건 (평균 +${avgOver.toFixed(0)}%, 최대 +${maxOver.toFixed(0)}%)`);
    console.log(`    과소추정: ${underEstimate.length}건 (평균 ${avgUnder.toFixed(0)}%, 최대 ${maxUnder.toFixed(0)}%)`);
    console.log(`    ±20%~+50% 적중: ${withinRange.length}/${sims.length}건 (${((withinRange.length / sims.length) * 100).toFixed(0)}%)`);
    console.log(`    손실리스크(-10% 이하): ${lossOrders.length}건 → ${lossOrders.map(o => '#' + o.num).join(', ') || '없음'}`);
  }

  // ═══════════════════════════════════════════════════════
  // PART 2: 최종 배송비 티어 설계
  // ═══════════════════════════════════════════════════════
  console.log(`\n\n${'═'.repeat(130)}`);
  console.log('🏷️ 배송비 티어 설계안');
  console.log('═'.repeat(130));

  // 국제배송 단가 기준 (예: EMS/DHL 아시아 기준 개략)
  // 실제 단가는 계약에 따라 다르지만, 구간 설계 목적으로 가정
  const SHIPPING_RATES_USD = [
    { maxG: 500, label: '~500g', rate: 8 },
    { maxG: 1000, label: '~1kg', rate: 12 },
    { maxG: 2000, label: '~2kg', rate: 18 },
    { maxG: 3000, label: '~3kg', rate: 22 },
    { maxG: 5000, label: '~5kg', rate: 28 },
    { maxG: 10000, label: '~10kg', rate: 40 },
    { maxG: 20000, label: '~20kg', rate: 65 },
    { maxG: Infinity, label: '20kg+', rate: 90 },
  ];

  console.log('\n  ■ 과금중량 추정 공식:');
  console.log('    1. 상품별 Shopify 등록 중량 합산');
  console.log('    2. 특수 상품 오버라이드:');
  console.log('       - Jumping Boogie Auto-Ball Toy → 고정 1,300g');
  console.log('       - Braining Spin (Bunny/Squirrel) → 실중량 ×2.0');
  console.log('       - All Day Cooling Mat → 실중량 ×5.0');
  console.log('       - Aqua Bear Life Vest → 실중량 ×4.0');
  console.log('       - Boong Boong Squirrel Float → 실중량 ×2.5');
  console.log('    3. 일반 상품 → 실중량 ×3.0');
  console.log('    4. 합산 후 배송 구간 매핑');

  console.log('\n  ■ 배송비 구간 (안):');
  console.log(`    ${'과금중량'.padEnd(15)}${'배송비(USD)'.padEnd(15)}비고`);
  console.log(`    ${'─'.repeat(60)}`);
  for (const tier of SHIPPING_RATES_USD) {
    console.log(`    ${tier.label.padEnd(15)}$${String(tier.rate).padEnd(14)}${tier.maxG <= 500 ? '소형 토이 1-3개' : tier.maxG <= 1000 ? '소형 토이 다수/의류 1개' : tier.maxG <= 2000 ? '중형 주문' : tier.maxG <= 5000 ? '일반 주문' : tier.maxG <= 10000 ? '대형 주문' : tier.maxG <= 20000 ? '도매급 주문' : '초대형'}`);
  }

  // PART 3: 엑셀 29건에 대해 차등배수 전략(B) 적용 + 티어 매핑
  console.log(`\n\n${'═'.repeat(130)}`);
  console.log('📋 엑셀 29건 — 차등배수(B) 전략 + 배송비 티어 매핑');
  console.log('═'.repeat(130));

  console.log(`\n  ${'주문'.padEnd(7)}${'Boogie'.padEnd(7)}${'Shopify'.padEnd(10)}${'추정과금'.padEnd(10)}${'엑셀과금'.padEnd(10)}${'오차'.padEnd(8)}${'추정티어'.padEnd(10)}${'실제티어'.padEnd(10)}${'티어일치'}`);
  console.log(`  ${'─'.repeat(110)}`);

  function getTier(g: number): string {
    for (const t of SHIPPING_RATES_USD) {
      if (g <= t.maxG) return t.label;
    }
    return '20kg+';
  }

  function getTierRate(g: number): number {
    for (const t of SHIPPING_RATES_USD) {
      if (g <= t.maxG) return t.rate;
    }
    return 90;
  }

  let tierMatch = 0;
  let tierOver = 0;
  let tierUnder = 0;
  let totalEstRate = 0;
  let totalActualRate = 0;

  for (const sim of sims.sort((a, b) => a.num - b.num)) {
    const estG = sim.strategyResults['B_차등배수'].estimatedG;
    const pct = sim.strategyResults['B_차등배수'].pct;
    const estTier = getTier(estG);
    const actTier = getTier(sim.excelBilling);
    const match = estTier === actTier ? '✅' : estG > sim.excelBilling ? '⬆️ 과대' : '⬇️ 과소';
    if (estTier === actTier) tierMatch++;
    else if (estG > sim.excelBilling) tierOver++;
    else tierUnder++;

    totalEstRate += getTierRate(estG);
    totalActualRate += getTierRate(sim.excelBilling);

    console.log(
      `  #${String(sim.num).padEnd(6)}` +
      `${sim.hasBoogie ? 'Y' : '-'}`.padEnd(7) +
      `${(sim.boogieCorrectedG + 'g').padEnd(10)}` +
      `${(estG + 'g').padEnd(10)}` +
      `${(sim.excelBilling + 'g').padEnd(10)}` +
      `${(pct >= 0 ? '+' : '') + pct.toFixed(0) + '%'}`.padEnd(8) +
      `${estTier.padEnd(10)}` +
      `${actTier.padEnd(10)}` +
      match
    );
  }

  console.log(`\n  ${'─'.repeat(110)}`);
  console.log(`  티어 일치: ${tierMatch}건 (${((tierMatch / sims.length) * 100).toFixed(0)}%) / 과대: ${tierOver}건 / 과소: ${tierUnder}건`);
  console.log(`  추정 배송비 합계: $${totalEstRate} / 실제 배송비 합계: $${totalActualRate} / 차이: $${totalEstRate - totalActualRate} (${((totalEstRate - totalActualRate) / totalActualRate * 100).toFixed(1)}%)`);

  // PART 4: 최종 추천안 요약
  console.log(`\n\n${'═'.repeat(130)}`);
  console.log('🎯 최종 추천: 배송비 부과 체계');
  console.log('═'.repeat(130));

  console.log(`
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  과금중량 추정 = Σ(상품별 Shopify 중량 × 상품별 배수)                      │
  │                                                                          │
  │  상품 유형별 배수:                                                         │
  │  ┌──────────────────────────────────────┬──────────┬─────────────────┐   │
  │  │ 상품 유형                             │ 배수     │ 근거             │   │
  │  ├──────────────────────────────────────┼──────────┼─────────────────┤   │
  │  │ Jumping Boogie Auto-Ball Toy         │ 고정1300g│ 실측 기반 고정    │   │
  │  │ All Day Cooling Mat (S/M/L)          │ ×5.0     │ 부피 극대형       │   │
  │  │ Aqua Bear Life Vest                  │ ×4.0     │ 부피 대형         │   │
  │  │ Boong Boong Squirrel Float           │ ×2.5     │ 부피 대형         │   │
  │  │ Braining Spin (Bunny/Squirrel)       │ ×2.0     │ 부피 중형         │   │
  │  │ 일반 상품 (기타 전체)                  │ ×3.0     │ 중앙값 기반 보수적 │   │
  │  └──────────────────────────────────────┴──────────┴─────────────────┘   │
  │                                                                          │
  │  배송비 구간 (USD):                                                       │
  │  ~500g → $8 / ~1kg → $12 / ~2kg → $18 / ~3kg → $22                     │
  │  ~5kg → $28 / ~10kg → $40 / ~20kg → $65 / 20kg+ → $90                  │
  └──────────────────────────────────────────────────────────────────────────┘
  `);
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
