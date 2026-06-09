import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from 'recharts';
import { toast } from 'sonner';

// ─── Types ───

type Range = 'today' | '7d' | '28d' | '90d';

interface ChannelSummary {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
}

interface DashboardData {
  summary: { totalOrders: number; totalRevenue: number; averageOrderValue: number; totalItemsSold: number };
  b2b: ChannelSummary;
  b2c: ChannelSummary;
  dailyOrders: { date: string; orders: number; revenue: number }[];
  topProducts: { title: string; quantity: number; revenue: number }[];
  lowStock: { title: string; variant: string; quantity: number }[];
  currency: string;
}

interface Customer {
  id: string; name: string; email: string;
  orders: number; spent: string; currency: string;
  createdAt: string; country: string; city: string; tags: string[];
}

interface CustomerSummary {
  summary: { total: number; noOrders: number; oneOrder: number; twoThree: number; fourPlus: number };
  topCustomers: Customer[];
  recentCustomers: Customer[];
}

// ─── Helpers ───

const BRAND = '#f85a24';
const RANGE_LABELS: Record<Range, string> = { today: '오늘', '7d': '7일', '28d': '28일', '90d': '90일' };

function fmtMoney(v: number, currency = 'USD') {
  if (currency === 'JPY') return `¥${Math.round(v).toLocaleString('ja-JP')}`;
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function isoToLabel(iso: string) {
  return `${iso.slice(5, 7)}/${iso.slice(8, 10)}`;
}

function localISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getMondayISO(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
  d.setDate(d.getDate() + diff);
  return localISO(d);
}

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function shopifyUrl(gid: string, type: 'orders' | 'products' | 'customers') {
  const numId = gid.split('/').pop();
  return `https://admin.shopify.com/store/biteme-one/${type}/${numId}`;
}

async function fetchSection<T>(section: string, secret: string, params?: Record<string, string>): Promise<T> {
  const sp = new URLSearchParams({ section, ...params });
  const res = await fetch(`/api/admin-manage?${sp}`, { headers: { Authorization: `Bearer ${secret}` } });
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (!res.ok) throw new Error(`API error (${res.status})`);
  return res.json();
}

// ─── Login ───

function PasswordGate({ onAuth }: { onAuth: (s: string) => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) { setError(true); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/admin-manage?section=overview', { headers: { Authorization: `Bearer ${value}` } });
      if (res.ok) { sessionStorage.setItem('admin-manage-key', value); onAuth(value); }
      else toast.error('인증 실패', { position: 'top-center' });
    } catch { toast.error('연결 오류', { position: 'top-center' }); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm px-6">
        <div className="mb-8 text-center">
          <div className="text-2xl font-bold" style={{ color: BRAND }}>BITEME</div>
          <p className="text-sm text-gray-500 mt-1">Admin Dashboard</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <input type="password" placeholder="관리자 시크릿 키" value={value}
              onChange={e => { setValue(e.target.value); setError(false); }} autoFocus
              className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 transition-all ${error ? 'border-red-400 focus:ring-red-200' : 'border-gray-200 focus:ring-orange-200'}`} />
            {error && <p className="text-xs text-red-500 mt-1">키를 입력해주세요</p>}
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-2 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: BRAND }}>
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Common Components ───

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-gray-200" />
      <span className="text-[11px] font-semibold text-gray-400 tracking-widest uppercase">{children}</span>
      <div className="h-px flex-1 bg-gray-200" />
    </div>
  );
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? 'border-orange-200 bg-orange-50/40' : 'bg-white border-gray-200'}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold tracking-tight ${accent ? 'text-orange-600' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function GaPlaceholder({ title, compact }: { title?: string; compact?: boolean }) {
  if (compact) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-4">
        <p className="text-xs text-gray-500 mb-1">{title}</p>
        <p className="text-sm font-medium text-gray-400">GA 데이터 연동필요</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 flex flex-col items-center justify-center py-16">
      {title && <h3 className="text-sm font-semibold text-gray-500 mb-2">{title}</h3>}
      <p className="text-sm text-gray-400">GA 데이터 연동필요</p>
      <p className="text-xs mt-2 text-gray-300">Google Analytics 서비스 계정 연동 후 데이터가 표시됩니다</p>
    </div>
  );
}

// ─── Dashboard: Combined Chart ───

function CombinedChart({ dailyOrders, currency }: { dailyOrders: DashboardData['dailyOrders']; currency: string }) {
  const chartData = dailyOrders.map(d => ({
    date: isoToLabel(d.date),
    revenue: Math.round(d.revenue * 100) / 100,
    orders: d.orders,
  }));
  const interval = Math.max(0, Math.ceil(chartData.length / 10) - 1);

  return (
    <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">주문 · 매출 추이</h3>
        <p className="text-xs text-gray-400">매출(막대) / 주문수(선)</p>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={interval} />
            <YAxis yAxisId="rev" tick={{ fontSize: 10 }}
              tickFormatter={v => currency === 'JPY' ? `¥${(v / 1000).toFixed(0)}k` : `$${v.toFixed(0)}`} width={48} />
            <YAxis yAxisId="orders" orientation="right" tick={{ fontSize: 10 }} width={36} />
            <Tooltip formatter={(value, name) => {
              if (name === 'revenue') return [fmtMoney(Number(value), currency), '매출'];
              return [Number(value), '주문 수'];
            }} />
            <Legend formatter={v => v === 'revenue' ? '매출' : '주문 수'} wrapperStyle={{ fontSize: 11 }} />
            <Bar yAxisId="rev" dataKey="revenue" fill={BRAND} opacity={0.25} radius={[2, 2, 0, 0]} />
            <Line yAxisId="orders" type="monotone" dataKey="orders" stroke={BRAND} strokeWidth={2.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Dashboard: Timeline Table ───

type AggRow = { label: string; sortKey: string; orders: number; revenue: number };

function TimelineTable({ dailyOrders, currency }: { dailyOrders: DashboardData['dailyOrders']; currency: string }) {
  const [tab, setTab] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const sorted = [...dailyOrders].sort((a, b) => a.date.localeCompare(b.date));

  function groupBy(keyFn: (iso: string) => string, labelFn: (iso: string, key: string) => string): AggRow[] {
    const map = new Map<string, AggRow>();
    for (const row of sorted) {
      const key = keyFn(row.date);
      const ex = map.get(key) ?? { label: '', sortKey: key, orders: 0, revenue: 0 };
      ex.label = labelFn(row.date, key);
      ex.orders += row.orders;
      ex.revenue += row.revenue;
      map.set(key, ex);
    }
    return Array.from(map.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }

  const rows: AggRow[] = (() => {
    if (tab === 'daily') return sorted.map(r => ({ label: r.date, sortKey: r.date, orders: r.orders, revenue: r.revenue }));
    if (tab === 'weekly') return groupBy(getMondayISO, (_iso, key) => {
      const sun = new Date(key + 'T00:00:00');
      sun.setDate(sun.getDate() + 6);
      return `${isoToLabel(key)}~${isoToLabel(localISO(sun))}`;
    });
    return groupBy(iso => iso.slice(0, 7), (_iso, key) => `${key.slice(0, 4)}/${key.slice(5, 7)}`);
  })();

  const totals = rows.reduce((acc, r) => ({ orders: acc.orders + r.orders, revenue: acc.revenue + r.revenue }), { orders: 0, revenue: 0 });

  return (
    <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">상세 데이터</h3>
        <div className="flex rounded-md border overflow-hidden text-xs">
          {(['daily', 'weekly', 'monthly'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1 transition-colors ${tab === t ? 'text-white font-medium' : 'text-gray-500 hover:text-gray-700'}`}
              style={tab === t ? { backgroundColor: BRAND } : {}}>
              {t === 'daily' ? '일간' : t === 'weekly' ? '주간' : '월간'}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto max-h-72 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-white border-b z-10">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-gray-400">날짜</th>
              <th className="text-right px-4 py-2 font-medium text-gray-400">총 사용자</th>
              <th className="text-right px-4 py-2 font-medium text-gray-400">세션</th>
              <th className="text-right px-4 py-2 font-medium text-gray-400">주문 수</th>
              <th className="text-right px-4 py-2 font-medium text-gray-400">매출</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-2 font-mono">{row.label}</td>
                <td className="px-4 py-2 text-right text-gray-300">—</td>
                <td className="px-4 py-2 text-right text-gray-300">—</td>
                <td className="px-4 py-2 text-right">{row.orders > 0 ? `${row.orders}건` : '—'}</td>
                <td className="px-4 py-2 text-right font-medium">{row.revenue > 0 ? fmtMoney(row.revenue, currency) : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0 bg-white border-t">
            <tr>
              <td className="px-4 py-2 font-semibold text-xs">합계</td>
              <td className="px-4 py-2 text-right text-gray-300">—</td>
              <td className="px-4 py-2 text-right text-gray-300">—</td>
              <td className="px-4 py-2 text-right font-semibold">{totals.orders}건</td>
              <td className="px-4 py-2 text-right font-semibold">{fmtMoney(totals.revenue, currency)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── Dashboard: Top Products ───

function TopProductsTable({ data, currency }: { data: DashboardData['topProducts']; currency: string }) {
  const maxRev = data[0]?.revenue || 1;
  return (
    <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">상위 판매 상품</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b">
              <th className="text-left px-4 py-2 font-medium text-gray-400">상품명</th>
              <th className="text-right px-4 py-2 font-medium text-gray-400">수량</th>
              <th className="text-right px-4 py-2 font-medium text-gray-400">매출</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-14 shrink-0 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(row.revenue / maxRev) * 100}%`, backgroundColor: BRAND }} />
                    </div>
                    <span className="truncate max-w-[200px]">{row.title}</span>
                  </div>
                </td>
                <td className="px-4 py-2 text-right">{row.quantity}개</td>
                <td className="px-4 py-2 text-right font-medium">{fmtMoney(row.revenue, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Dashboard: Operations Panel ───

function OperationsPanel({ lowStock, topProducts, currency }: {
  lowStock: DashboardData['lowStock'];
  topProducts: DashboardData['topProducts'];
  currency: string;
}) {
  const [tab, setTab] = useState<'lowstock' | 'popular'>('lowstock');
  const maxRev = topProducts[0]?.revenue || 1;

  return (
    <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">운영 현황</h3>
        <div className="flex rounded-md border overflow-hidden text-xs">
          <button onClick={() => setTab('lowstock')}
            className={`px-3 py-1 transition-colors flex items-center gap-1.5 ${tab === 'lowstock' ? 'text-white font-medium' : 'text-gray-500 hover:text-gray-700'}`}
            style={tab === 'lowstock' ? { backgroundColor: BRAND } : {}}>
            재고 부족
            {lowStock.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-medium">{lowStock.length}</span>
            )}
          </button>
          <button onClick={() => setTab('popular')}
            className={`px-3 py-1 transition-colors ${tab === 'popular' ? 'text-white font-medium' : 'text-gray-500 hover:text-gray-700'}`}
            style={tab === 'popular' ? { backgroundColor: BRAND } : {}}>
            인기 아이템
          </button>
        </div>
      </div>

      {tab === 'lowstock' ? (
        lowStock.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">재고 부족 상품 없음</p>
        ) : (
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-400">상품</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-400">잔여 재고</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.map((row, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-2.5">
                      {row.title}
                      {row.variant && <span className="text-gray-400 ml-1">({row.variant})</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`font-semibold ${row.quantity <= 0 ? 'text-red-600' : 'text-orange-500'}`}>
                        {row.quantity <= 0 ? '품절' : `${row.quantity}개`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white border-b">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-400">상품명</th>
                <th className="text-right px-4 py-2 font-medium text-gray-400">조회</th>
                <th className="text-right px-4 py-2 font-medium text-gray-400">판매</th>
                <th className="text-right px-4 py-2 font-medium text-gray-400">매출</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((row, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 w-4 shrink-0 text-right">{i + 1}</span>
                      <div className="h-1 w-12 shrink-0 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(row.revenue / maxRev) * 100}%`, backgroundColor: BRAND }} />
                      </div>
                      <span className="truncate max-w-[160px]">{row.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-300">—</td>
                  <td className="px-4 py-2.5 text-right">{row.quantity}개</td>
                  <td className="px-4 py-2.5 text-right font-medium">{fmtMoney(row.revenue, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── 대시보드 Tab ───

function ChannelCard({ label, badge, badgeCls, ch, currency }: {
  label: string; badge: string; badgeCls: string; ch: ChannelSummary; currency: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${badgeCls}`}>{badge}</span>
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-[11px] text-gray-400">매출</p>
          <p className="text-lg font-bold text-gray-900">{fmtMoney(ch.totalRevenue, currency)}</p>
        </div>
        <div>
          <p className="text-[11px] text-gray-400">주문</p>
          <p className="text-lg font-bold text-gray-900">{ch.totalOrders}건</p>
        </div>
        <div>
          <p className="text-[11px] text-gray-400">AOV</p>
          <p className="text-lg font-bold text-gray-900">{ch.totalOrders > 0 ? fmtMoney(ch.averageOrderValue, currency) : '—'}</p>
        </div>
      </div>
    </div>
  );
}

function DashboardTab({ data, currency, range }: { data: DashboardData; currency: string; range: Range }) {
  const { summary, b2b, b2c, dailyOrders, topProducts, lowStock } = data;

  return (
    <div className="space-y-5">
      <SectionLabel>핵심 지표</SectionLabel>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="총 매출" value={fmtMoney(summary.totalRevenue, currency)} accent />
        <KpiCard label="주문 수" value={`${summary.totalOrders.toLocaleString()}건`} accent />
        <KpiCard label="평균 주문금액" value={fmtMoney(summary.averageOrderValue, currency)} accent />
        <GaPlaceholder title="구매 전환율" compact />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ChannelCard label="도매" badge="B2B" badgeCls="bg-blue-100 text-blue-700" ch={b2b} currency={currency} />
        <ChannelCard label="소매" badge="B2C" badgeCls="bg-orange-100 text-orange-700" ch={b2c} currency={currency} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <GaPlaceholder title="세션" compact />
        <GaPlaceholder title="유저" compact />
        <GaPlaceholder title="이탈률" compact />
        <GaPlaceholder title="평균 체류 시간" compact />
      </div>

      {dailyOrders.length > 0 && (
        <>
          <CombinedChart dailyOrders={dailyOrders} currency={currency} />
          <TimelineTable dailyOrders={dailyOrders} currency={currency} />
        </>
      )}

      <SectionLabel>전환 · 상품</SectionLabel>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2">
          <GaPlaceholder title="EC 퍼널" />
        </div>
        <div className="lg:col-span-3">
          <TopProductsTable data={topProducts} currency={currency} />
        </div>
      </div>

      <SectionLabel>트래픽 분석</SectionLabel>
      <GaPlaceholder title="유입 소스 · 디바이스 · 상위 페이지" />

      <SectionLabel>운영 현황</SectionLabel>
      <OperationsPanel lowStock={lowStock} topProducts={topProducts} currency={currency} />

      <p className="text-center text-xs text-gray-400 pb-4">
        Shopify: biteme-one &middot; {RANGE_LABELS[range]} 데이터
      </p>
    </div>
  );
}

// ─── 퍼널 분석 Tab ───

function FunnelTab() {
  return (
    <div className="space-y-5">
      <SectionLabel>구매 전환 퍼널</SectionLabel>
      <GaPlaceholder title="구매 전환 퍼널" />
      <SectionLabel>소스 / 매체별 전환</SectionLabel>
      <GaPlaceholder title="소스/매체별 전환율" />
      <SectionLabel>이탈 포인트 분석</SectionLabel>
      <GaPlaceholder title="페이지별 이탈 포인트" />
    </div>
  );
}

// ─── 행동 분석 Tab ───

function BehaviorTab() {
  return (
    <div className="space-y-5">
      <SectionLabel>페이지 분석</SectionLabel>
      <GaPlaceholder title="상위 페이지 · 페이지뷰" />
      <SectionLabel>사용자 행동</SectionLabel>
      <GaPlaceholder title="이벤트 분석 · 사용자 흐름" />
      <SectionLabel>디바이스 분석</SectionLabel>
      <GaPlaceholder title="디바이스별 세션 · 전환율" />
    </div>
  );
}

// ─── 회원 분석 Tab ───

function CustomerTab({ secret }: { secret: string }) {
  const [tab, setTab] = useState('top');

  const { data, isLoading } = useQuery<CustomerSummary>({
    queryKey: ['admin-customers'],
    queryFn: () => fetchSection<CustomerSummary>('customers', secret, { view: 'all' }),
    staleTime: 60_000,
  });

  if (isLoading || !data) {
    return <div className="flex justify-center py-16 text-sm text-gray-400">회원 데이터를 불러오는 중...</div>;
  }

  const { summary } = data;
  const purchasedTotal = summary.oneOrder + summary.twoThree + summary.fourPlus;
  const repeatCount = summary.twoThree + summary.fourPlus;
  const repeatRate = purchasedTotal > 0 ? ((repeatCount / purchasedTotal) * 100).toFixed(1) : '0';

  const segmentItems = [
    { name: '4회 이상', value: summary.fourPlus, color: BRAND },
    { name: '2~3회', value: summary.twoThree, color: '#fb8c5a' },
    { name: '1회 구매', value: summary.oneOrder, color: '#fdb997' },
    { name: '미구매', value: summary.noOrders, color: '#e2e8f0' },
  ].filter(d => d.value > 0);
  const segTotal = segmentItems.reduce((s, d) => s + d.value, 0);
  const customers = tab === 'top' ? data.topCustomers : data.recentCustomers;

  return (
    <div className="space-y-5">
      <SectionLabel>회원 핵심 지표</SectionLabel>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="총 회원 수" value={`${summary.total.toLocaleString()}명`} accent />
        <KpiCard label="구매 회원" value={`${purchasedTotal.toLocaleString()}명`}
          sub={`전체 회원의 ${Math.round(purchasedTotal / Math.max(summary.total, 1) * 100)}%`} accent />
        <KpiCard label="재구매율" value={`${repeatRate}%`}
          sub={`${repeatCount.toLocaleString()}명 (2회 이상 구매)`} />
        <KpiCard label="미구매 회원" value={`${summary.noOrders.toLocaleString()}명`} sub="가입만 한 회원" />
      </div>

      <SectionLabel>가입 · 세그먼트</SectionLabel>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">고객 구매 횟수 분포</h3>
            <p className="text-xs text-gray-400">전체 회원 세그먼트</p>
          </div>
          <div className="p-4 flex items-center gap-4">
            <PieChart width={140} height={140}>
              <Pie data={segmentItems} dataKey="value" cx={65} cy={65} innerRadius={38} outerRadius={60} paddingAngle={2}>
                {segmentItems.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
            </PieChart>
            <div className="flex-1 space-y-2">
              {segmentItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span>{item.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-medium">{item.value.toLocaleString()}명</span>
                    <span className="text-gray-400 ml-1.5">{segTotal > 0 ? ((item.value / segTotal) * 100).toFixed(1) : 0}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 rounded-xl border bg-white border-gray-200 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
            <div className="flex rounded-lg border bg-white overflow-hidden text-xs">
              <button onClick={() => setTab('top')}
                className={`px-3 py-1.5 transition-colors ${tab === 'top' ? 'text-white font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                style={tab === 'top' ? { backgroundColor: BRAND } : {}}>Top Spenders</button>
              <button onClick={() => setTab('recent')}
                className={`px-3 py-1.5 transition-colors ${tab === 'recent' ? 'text-white font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                style={tab === 'recent' ? { backgroundColor: BRAND } : {}}>최근 가입 (30일)</button>
            </div>
          </div>
          {customers.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">해당 회원 없음</div>
          ) : (
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white border-b">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-400">#</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-400">고객</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-400">국가</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-400">주문</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-400">총 구매</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-400">가입일</th>
                    <th className="px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c, i) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{c.name}</div>
                        <div className="text-gray-400 text-[11px]">{c.email}</div>
                      </td>
                      <td className="px-4 py-2.5">{c.country}{c.city ? `, ${c.city}` : ''}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{c.orders}</td>
                      <td className="px-4 py-2.5 text-right font-medium">{fmtMoney(parseFloat(c.spent), c.currency)}</td>
                      <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">{fmtDateShort(c.createdAt)}</td>
                      <td className="px-2 py-2.5">
                        <a href={shopifyUrl(c.id, 'customers')} target="_blank" rel="noopener noreferrer"
                          className="text-gray-400 hover:text-orange-500 transition-colors">{'↗'}</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <SectionLabel>유저 재방문</SectionLabel>
      <GaPlaceholder title="신규 vs 재방문 유저" />

      <p className="text-center text-xs text-gray-400 pb-4">
        Shopify: biteme-one &middot; 회원 데이터
      </p>
    </div>
  );
}

// ─── 주간회고 Tab ───

function WeeklyReviewTab() {
  return (
    <div className="space-y-5">
      <SectionLabel>주간 회고</SectionLabel>
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 flex flex-col items-center justify-center py-20">
        <h3 className="text-sm font-semibold text-gray-500 mb-2">주간 회고</h3>
        <p className="text-sm text-gray-400">추후 업데이트 예정</p>
        <p className="text-xs mt-2 text-gray-300">주간 주요 지표 변동 요약 및 액션 리뷰가 자동 생성됩니다</p>
      </div>
    </div>
  );
}

// ─── Main Dashboard View ───

const TABS = [
  { id: 'dashboard', label: '대시보드' },
  { id: 'funnel', label: '퍼널 분석' },
  { id: 'behavior', label: '행동 분석' },
  { id: 'members', label: '회원 분석' },
  { id: 'review', label: '주간회고' },
];

function DashboardView({ secret, onLogout }: { secret: string; onLogout: () => void }) {
  const [range, setRange] = useState<Range>('7d');
  const [activeTab, setActiveTab] = useState('dashboard');

  const { data: dashboard, isLoading, isError, error, refetch } = useQuery<DashboardData>({
    queryKey: ['admin-dashboard', range],
    queryFn: () => fetchSection<DashboardData>('dashboard', secret, { range }),
    staleTime: 5 * 60 * 1000,
    retry: (count, err) => {
      if (err instanceof Error && err.message === 'UNAUTHORIZED') return false;
      return count < 2;
    },
  });

  useEffect(() => {
    if (isError && error instanceof Error && error.message === 'UNAUTHORIZED') onLogout();
  }, [isError, error, onLogout]);

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm" style={{ color: BRAND }}>BITEME</span>
            <span className="text-xs text-gray-400">Analytics</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border bg-white overflow-hidden text-xs">
              {(['today', '7d', '28d', '90d'] as Range[]).map(r => (
                <button key={r} onClick={() => setRange(r)}
                  className={`px-3 py-1.5 transition-colors ${range === r ? 'text-white font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                  style={range === r ? { backgroundColor: BRAND } : {}}>
                  {RANGE_LABELS[r]}
                </button>
              ))}
            </div>
            <button onClick={() => refetch()} className="text-xs px-3 py-1.5 rounded-lg border hover:bg-gray-50 transition-colors">새로고침</button>
            <button onClick={onLogout} className="text-xs text-gray-400 hover:text-gray-700 transition-colors">로그아웃</button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Tab Bar */}
        <div className="flex rounded-lg border bg-white overflow-hidden text-xs w-fit">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 transition-colors ${activeTab === t.id ? 'text-white font-medium' : 'text-gray-500 hover:text-gray-700'}`}
              style={activeTab === t.id ? { backgroundColor: BRAND } : {}}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {isError && !(error instanceof Error && error.message === 'UNAUTHORIZED') && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            데이터 오류: {error instanceof Error ? error.message : '알 수 없는 오류'}
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'dashboard' && (
          isLoading || !dashboard
            ? <div className="flex items-center justify-center h-64 text-sm text-gray-400">데이터를 불러오는 중...</div>
            : <DashboardTab data={dashboard} currency={dashboard.currency} range={range} />
        )}
        {activeTab === 'funnel' && <FunnelTab />}
        {activeTab === 'behavior' && <BehaviorTab />}
        {activeTab === 'members' && <CustomerTab secret={secret} />}
        {activeTab === 'review' && <WeeklyReviewTab />}
      </div>
    </div>
  );
}

// ─── Entry Point ───

export default function AdminManage() {
  const [secret, setSecret] = useState(() => sessionStorage.getItem('admin-manage-key') || '');

  if (!secret) {
    return <PasswordGate onAuth={s => { sessionStorage.setItem('admin-manage-key', s); setSecret(s); }} />;
  }

  return (
    <DashboardView
      secret={secret}
      onLogout={() => { sessionStorage.removeItem('admin-manage-key'); setSecret(''); }}
    />
  );
}
