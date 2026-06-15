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
const API_VERSION = '2025-07';

async function getAccessToken(): Promise<string> {
  const res = await fetch(`https://${STORE_DOMAIN}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  });
  return (await res.json()).access_token;
}

async function adminGraphQL(token: string, query: string, variables: Record<string, unknown> = {}) {
  const res = await fetch(`https://${STORE_DOMAIN}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

const ORDER_QUERY = `
  query OrderByNumber($query: String!) {
    orders(first: 1, query: $query) {
      edges {
        node {
          id name
          lineItems(first: 50) {
            edges {
              node {
                title quantity
                variant {
                  title
                  inventoryItem {
                    measurement { weight { value unit } }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

function toGrams(value: number, unit: string): number {
  switch (unit) {
    case 'KILOGRAMS': return value * 1000;
    case 'POUNDS': return value * 453.592;
    case 'OUNCES': return value * 28.3495;
    default: return value;
  }
}

interface Row {
  orderNumber: number;
  excelActual: number;
  excelVolume: number;
  shopify: number;
  ratioActual: number;    // 실중량 ÷ Shopify
  ratioVolume: number;    // 부피중량 ÷ Shopify
  missingCount: number;
}

async function main() {
  const wb = XLSX.readFile('C:/Users/User/Desktop/쇼피파이_실중량.xlsx');
  const rawRows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  const dataRows = rawRows.slice(1).filter((r: any[]) => r[0]);

  const token = await getAccessToken();
  const results: Row[] = [];

  for (const row of dataRows) {
    const orderNum = Number(row[0]);
    const excelActual = Number(row[1]);
    const excelVolume = Number(row[2]);

    const data = await adminGraphQL(token, ORDER_QUERY, { query: `name:#${orderNum}` });
    const order = data.data?.orders?.edges?.[0]?.node;

    let shopify = 0;
    let missingCount = 0;

    if (order) {
      for (const { node: item } of order.lineItems.edges) {
        const w = item.variant?.inventoryItem?.measurement?.weight;
        if (w && w.value > 0) {
          shopify += toGrams(w.value, w.unit) * item.quantity;
        } else {
          missingCount++;
        }
      }
    }

    shopify = Math.round(shopify);
    results.push({
      orderNumber: orderNum, excelActual, excelVolume, shopify,
      ratioActual: shopify > 0 ? excelActual / shopify : 0,
      ratioVolume: shopify > 0 ? excelVolume / shopify : 0,
      missingCount,
    });

    await new Promise(r => setTimeout(r, 200));
  }

  // ── 이상치 분리 (Shopify=0 or 배율 10 이상) ──
  const clean = results.filter(r => r.shopify > 0 && r.ratioVolume < 10);
  const outliers = results.filter(r => r.shopify === 0 || r.ratioVolume >= 10);

  // ═══════════════════════════════════════════════
  // 1) 메인 비교 테이블
  // ═══════════════════════════════════════════════
  console.log('\n' + '═'.repeat(105));
  console.log('📊 Shopify 제품중량 vs 엑셀 실중량 vs 엑셀 부피중량 (과금기준)');
  console.log('═'.repeat(105));
  const hdr = [
    '주문'.padEnd(7),
    'Shopify(g)'.padEnd(12),
    '실중량(g)'.padEnd(11),
    '실÷Shopify'.padEnd(12),
    '부피중량(g)'.padEnd(12),
    '부피÷Shopify'.padEnd(13),
    '비고',
  ].join('');
  console.log(hdr);
  console.log('─'.repeat(105));

  for (const r of results) {
    let note = '';
    if (r.shopify === 0) note = '❌ 조회불가';
    else if (r.ratioVolume >= 10) note = '⚠ 이상치';
    else if (r.missingCount > 0) note = `⚠ 미등록${r.missingCount}`;

    console.log([
      `#${String(r.orderNumber).padEnd(6)}`,
      `${String(r.shopify).padEnd(12)}`,
      `${String(r.excelActual).padEnd(11)}`,
      r.ratioActual > 0 ? `×${r.ratioActual.toFixed(2)}`.padEnd(12) : 'N/A'.padEnd(12),
      `${String(r.excelVolume).padEnd(12)}`,
      r.ratioVolume > 0 ? `×${r.ratioVolume.toFixed(2)}`.padEnd(13) : 'N/A'.padEnd(13),
      note,
    ].join(''));
  }

  // ═══════════════════════════════════════════════
  // 2) 실중량 vs 부피중량 배율 통계
  // ═══════════════════════════════════════════════
  const actualRatios = clean.map(r => r.ratioActual).sort((a, b) => a - b);
  const volumeRatios = clean.map(r => r.ratioVolume).sort((a, b) => a - b);

  function stats(arr: number[]) {
    const n = arr.length;
    const avg = arr.reduce((s, v) => s + v, 0) / n;
    const med = n % 2 ? arr[Math.floor(n / 2)] : (arr[n / 2 - 1] + arr[n / 2]) / 2;
    const p75 = arr[Math.floor(n * 0.75)];
    const p90 = arr[Math.floor(n * 0.90)];
    const min = arr[0];
    const max = arr[n - 1];
    return { avg, med, p75, p90, min, max };
  }

  const sa = stats(actualRatios);
  const sv = stats(volumeRatios);

  console.log('\n' + '═'.repeat(70));
  console.log('📈 배율 통계 (이상치 제외 ' + clean.length + '건)');
  console.log('═'.repeat(70));
  console.log(`${''.padEnd(14)}${'실중량÷Shopify'.padEnd(20)}${'부피중량÷Shopify'.padEnd(20)}`);
  console.log('─'.repeat(70));
  console.log(`${'최소'.padEnd(14)}×${sa.min.toFixed(2).padEnd(19)}×${sv.min.toFixed(2)}`);
  console.log(`${'평균'.padEnd(14)}×${sa.avg.toFixed(2).padEnd(19)}×${sv.avg.toFixed(2)}`);
  console.log(`${'중앙값(p50)'.padEnd(14)}×${sa.med.toFixed(2).padEnd(19)}×${sv.med.toFixed(2)}`);
  console.log(`${'p75'.padEnd(14)}×${sa.p75.toFixed(2).padEnd(19)}×${sv.p75.toFixed(2)}`);
  console.log(`${'p90'.padEnd(14)}×${sa.p90.toFixed(2).padEnd(19)}×${sv.p90.toFixed(2)}`);
  console.log(`${'최대'.padEnd(14)}×${sa.max.toFixed(2).padEnd(19)}×${sv.max.toFixed(2)}`);

  console.log(`\n  💡 부피중량은 평균적으로 Shopify 제품중량의 ×${sv.avg.toFixed(1)}배`);
  console.log(`     → 실중량은 ×${sa.avg.toFixed(1)}배 (포장재 포함)`);
  console.log(`     → 부피가 실중량의 평균 ×${(sv.avg / sa.avg).toFixed(1)}배 더 큼 → 항상 부피중량이 과금기준`);

  // ═══════════════════════════════════════════════
  // 3) 부피중량 보정 계수별 커버율
  // ═══════════════════════════════════════════════
  console.log('\n' + '═'.repeat(70));
  console.log('🔢 부피중량 보정 계수별 커버율 (Shopify × 계수 ≥ 부피중량?)');
  console.log('═'.repeat(70));
  for (const mult of [1.5, 2.0, 2.5, 3.0, 3.2, 3.5, 4.0, 4.5]) {
    let covered = 0;
    for (const r of clean) {
      if (r.shopify * mult >= r.excelVolume) covered++;
    }
    const pct = ((covered / clean.length) * 100).toFixed(0);
    const bar = '█'.repeat(Math.round(covered / clean.length * 30));
    const tag = mult === 3.5 ? ' ← p90 기준' : mult === 4.5 ? ' ← 최대 커버' : '';
    console.log(`  ×${mult.toFixed(1)} → ${pct.padStart(3)}% (${covered}/${clean.length}) ${bar}${tag}`);
  }

  // ═══════════════════════════════════════════════
  // 4) 보수적 보정(×3.5) 시뮬레이션
  // ═══════════════════════════════════════════════
  const factor = Math.ceil(sv.p90 * 10) / 10;
  console.log('\n' + '═'.repeat(90));
  console.log(`📦 보정 ×${factor.toFixed(1)} 적용 시뮬레이션 (과금기준 = 부피중량)`);
  console.log('═'.repeat(90));
  console.log([
    '주문'.padEnd(7),
    '부피중량(g)'.padEnd(13),
    'Shopify(g)'.padEnd(12),
    `보정×${factor.toFixed(1)}(g)`.padEnd(14),
    '차이'.padEnd(18),
    '판정',
  ].join(''));
  console.log('─'.repeat(90));

  let safe = 0, under = 0;
  for (const r of clean) {
    const corrected = Math.round(r.shopify * factor);
    const diff = corrected - r.excelVolume;
    const diffPct = ((diff / r.excelVolume) * 100).toFixed(1);
    const ok = diff >= 0;
    if (ok) safe++; else under++;

    console.log([
      `#${String(r.orderNumber).padEnd(6)}`,
      `${String(r.excelVolume).padEnd(13)}`,
      `${String(r.shopify).padEnd(12)}`,
      `${String(corrected).padEnd(14)}`,
      `${(diff >= 0 ? '+' : '') + diff}g (${diffPct}%)`.padEnd(18),
      ok ? '✅' : '❌',
    ].join(''));
  }

  console.log('─'.repeat(90));
  console.log(`\n  ✅ 안전: ${safe}건  /  ❌ 부족: ${under}건  →  커버율 ${((safe / clean.length) * 100).toFixed(0)}%`);

  if (outliers.length > 0) {
    console.log(`\n  ⚠ 이상치 ${outliers.length}건 (분석 제외): ${outliers.map(r => '#' + r.orderNumber).join(', ')}`);
  }
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
