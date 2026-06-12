import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from 'recharts';
import { toast } from 'sonner';

// ─── Types ───

type Range = 'today' | '7d' | '28d' | '90d' | 'custom';

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

interface GaData {
  available: boolean;
  sessions: number;
  users: number;
  bounceRate: number;
  avgSessionDuration: number;
  conversionRate: number;
  purchases: number;
  funnel: { step: string; label: string; count: number }[];
  daily: { date: string; sessions: number; users: number }[];
}

interface GaFunnelData {
  available: boolean;
  funnelSteps: { step: string; label: string }[];
  dailyFunnel: Record<string, unknown>[];
  sources: { source: string; sessions: number; purchases: number; revenue: number; conversionRate: number }[];
  pages: { path: string; views: number; bounceRate: number; avgEngagement: number }[];
}

interface GaTrafficData {
  available: boolean;
  sources: { source: string; sessions: number; users: number; bounceRate: number }[];
  devices: { device: string; sessions: number; users: number; bounceRate: number; avgDuration: number }[];
  pages: { path: string; views: number; users: number }[];
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
const RANGE_LABELS: Record<Range, string> = { today: '오늘', '7d': '7일', '28d': '28일', '90d': '90일', custom: '사용자설정' };

function fmtPagePath(path: string) {
  return path === '/' ? 'Home (/)' : path;
}

const FUNNEL_STEP_ORDER = ['view_item', 'add_to_cart', 'begin_checkout', 'add_payment_info', 'purchase'];

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

function TimelineTable({ dailyOrders, currency, ga }: { dailyOrders: DashboardData['dailyOrders']; currency: string; ga?: GaData | null }) {
  const [tab, setTab] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const sorted = [...dailyOrders].sort((a, b) => a.date.localeCompare(b.date));

  const gaMap = new Map<string, { sessions: number; users: number }>();
  if (ga?.available && ga.daily) {
    for (const d of ga.daily) gaMap.set(d.date, { sessions: d.sessions, users: d.users });
  }

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
            {rows.map((row, i) => {
              const g = tab === 'daily' ? gaMap.get(row.sortKey) : undefined;
              return (
                <tr key={i} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-2 font-mono">{row.label}</td>
                  <td className="px-4 py-2 text-right">{g ? g.users.toLocaleString() : <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-2 text-right">{g ? g.sessions.toLocaleString() : <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-2 text-right">{row.orders > 0 ? `${row.orders}건` : '—'}</td>
                  <td className="px-4 py-2 text-right font-medium">{row.revenue > 0 ? fmtMoney(row.revenue, currency) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="sticky bottom-0 bg-white border-t">
            {(() => {
              const gaTotal = ga?.available && ga.daily
                ? ga.daily.reduce((a, d) => ({ u: a.u + d.users, s: a.s + d.sessions }), { u: 0, s: 0 })
                : null;
              return (
                <tr>
                  <td className="px-4 py-2 font-semibold text-xs">합계</td>
                  <td className="px-4 py-2 text-right font-semibold">{gaTotal ? gaTotal.u.toLocaleString() : <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-2 text-right font-semibold">{gaTotal ? gaTotal.s.toLocaleString() : <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-2 text-right font-semibold">{totals.orders}건</td>
                  <td className="px-4 py-2 text-right font-semibold">{fmtMoney(totals.revenue, currency)}</td>
                </tr>
              );
            })()}
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

function FunnelChart({ funnel }: { funnel: GaData['funnel'] }) {
  const maxCount = funnel[0]?.count || 1;
  return (
    <div className="rounded-xl border bg-white border-gray-200 overflow-hidden h-full">
      <div className="px-5 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">EC 퍼널</h3>
        <p className="text-xs text-gray-400">GA4 이커머스 이벤트</p>
      </div>
      <div className="p-4 space-y-2">
        {funnel.map((step, i) => {
          const pct = maxCount > 0 ? (step.count / maxCount) * 100 : 0;
          const dropoff = i > 0 && funnel[i - 1].count > 0
            ? ((1 - step.count / funnel[i - 1].count) * 100).toFixed(1)
            : null;
          return (
            <div key={step.step}>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-gray-600">{step.label}</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{step.count.toLocaleString()}</span>
                  {dropoff && <span className="text-red-400 text-[10px]">-{dropoff}%</span>}
                </div>
              </div>
              <div className="h-5 bg-gray-100 rounded overflow-hidden">
                <div className="h-full rounded transition-all" style={{
                  width: `${Math.max(pct, 1)}%`,
                  backgroundColor: BRAND,
                  opacity: 1 - i * 0.15,
                }} />
              </div>
            </div>
          );
        })}
        {funnel[0]?.count > 0 && funnel[funnel.length - 1] && (
          <div className="pt-2 border-t border-gray-100 text-xs text-center">
            <span className="text-gray-500">전체 전환율: </span>
            <span className="font-bold" style={{ color: BRAND }}>
              {((funnel[funnel.length - 1].count / funnel[0].count) * 100).toFixed(2)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

const DEVICE_LABELS: Record<string, string> = { desktop: '데스크톱', mobile: '모바일', tablet: '태블릿' };
const DEVICE_COLORS: Record<string, string> = { desktop: '#f85a24', mobile: '#fb8c5a', tablet: '#fdb997' };

function TrafficSection({ traffic }: { traffic: GaTrafficData }) {
  const { sources, devices, pages } = traffic;
  const totalDeviceSessions = devices.reduce((s, d) => s + d.sessions, 0);
  const maxPageViews = pages[0]?.views || 1;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* 유입 소스 */}
      <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">유입 소스</h3>
          <p className="text-xs text-gray-400">세션 기준 상위 소스</p>
        </div>
        <div className="overflow-y-auto max-h-64">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white border-b">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-400">소스</th>
                <th className="text-right px-4 py-2 font-medium text-gray-400">세션</th>
                <th className="text-right px-4 py-2 font-medium text-gray-400">이탈률</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((row, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-2 truncate max-w-[140px]">{row.source}</td>
                  <td className="px-4 py-2 text-right font-medium">{row.sessions.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right">{row.bounceRate.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 디바이스 */}
      <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">디바이스</h3>
          <p className="text-xs text-gray-400">디바이스별 세션 분포</p>
        </div>
        <div className="p-4 flex items-center gap-4">
          <PieChart width={120} height={120}>
            <Pie data={devices.map(d => ({ name: d.device, value: d.sessions }))} dataKey="value"
              cx={55} cy={55} innerRadius={32} outerRadius={50} paddingAngle={2}>
              {devices.map((d, i) => <Cell key={i} fill={DEVICE_COLORS[d.device] || '#d4d4d4'} />)}
            </Pie>
          </PieChart>
          <div className="flex-1 space-y-2">
            {devices.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: DEVICE_COLORS[d.device] || '#d4d4d4' }} />
                  <span>{DEVICE_LABELS[d.device] || d.device}</span>
                </div>
                <div className="text-right">
                  <span className="font-medium">{d.sessions.toLocaleString()}</span>
                  <span className="text-gray-400 ml-1.5">{totalDeviceSessions > 0 ? ((d.sessions / totalDeviceSessions) * 100).toFixed(1) : 0}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="px-4 pb-3">
          <table className="w-full text-xs">
            <tbody>
              {devices.map((d, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="py-1.5 text-gray-400">{DEVICE_LABELS[d.device] || d.device}</td>
                  <td className="py-1.5 text-right text-gray-500">이탈 {d.bounceRate.toFixed(1)}%</td>
                  <td className="py-1.5 text-right text-gray-500">{d.avgDuration > 60 ? `${Math.floor(d.avgDuration / 60)}분 ${d.avgDuration % 60}초` : `${d.avgDuration}초`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 상위 페이지 */}
      <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">상위 페이지</h3>
          <p className="text-xs text-gray-400">페이지뷰 기준</p>
        </div>
        <div className="overflow-y-auto max-h-64">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white border-b">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-400">페이지</th>
                <th className="text-right px-4 py-2 font-medium text-gray-400">PV</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((row, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-10 shrink-0 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(row.views / maxPageViews) * 100}%`, backgroundColor: BRAND }} />
                      </div>
                      <span className="font-mono truncate max-w-[140px]" title={row.path}>{fmtPagePath(row.path)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right font-medium">{row.views.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DashboardTab({ data, currency, range, ga, traffic }: { data: DashboardData; currency: string; range: Range; ga: GaData | null; traffic: GaTrafficData | null }) {
  const { summary, b2b, b2c, dailyOrders, topProducts, lowStock } = data;

  const fmtDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    return m > 0 ? `${m}분 ${sec}초` : `${sec}초`;
  };

  return (
    <div className="space-y-5">
      <SectionLabel>핵심 지표</SectionLabel>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="총 매출" value={fmtMoney(summary.totalRevenue, currency)} accent />
        <KpiCard label="주문 수" value={`${summary.totalOrders.toLocaleString()}건`} accent />
        <KpiCard label="평균 주문금액" value={fmtMoney(summary.averageOrderValue, currency)} accent />
        {ga?.available
          ? <KpiCard label="구매 전환율" value={`${ga.conversionRate.toFixed(2)}%`}
              sub={`${ga.purchases}건 / ${ga.sessions.toLocaleString()} 세션`} accent />
          : <GaPlaceholder title="구매 전환율" compact />}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ChannelCard label="도매" badge="B2B" badgeCls="bg-blue-100 text-blue-700" ch={b2b} currency={currency} />
        <ChannelCard label="소매" badge="B2C" badgeCls="bg-orange-100 text-orange-700" ch={b2c} currency={currency} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ga?.available ? (
          <>
            <KpiCard label="세션" value={ga.sessions.toLocaleString()} />
            <KpiCard label="총 사용자" value={ga.users.toLocaleString()} />
            <KpiCard label="이탈률" value={`${(ga.bounceRate * 100).toFixed(1)}%`} />
            <KpiCard label="평균 체류 시간" value={fmtDuration(ga.avgSessionDuration)} />
          </>
        ) : (
          <>
            <GaPlaceholder title="세션" compact />
            <GaPlaceholder title="총 사용자" compact />
            <GaPlaceholder title="이탈률" compact />
            <GaPlaceholder title="평균 체류 시간" compact />
          </>
        )}
      </div>

      {dailyOrders.length > 0 && (
        <>
          <CombinedChart dailyOrders={dailyOrders} currency={currency} />
          <TimelineTable dailyOrders={dailyOrders} currency={currency} ga={ga} />
        </>
      )}

      <SectionLabel>전환 · 상품</SectionLabel>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2">
          {ga?.available && ga.funnel.length > 0
            ? <FunnelChart funnel={ga.funnel} />
            : <GaPlaceholder title="EC 퍼널" />}
        </div>
        <div className="lg:col-span-3">
          <TopProductsTable data={topProducts} currency={currency} />
        </div>
      </div>

      <SectionLabel>트래픽 분석</SectionLabel>
      {traffic?.available
        ? <TrafficSection traffic={traffic} />
        : <GaPlaceholder title="유입 소스 · 디바이스 · 상위 페이지" />}

      <SectionLabel>운영 현황</SectionLabel>
      <OperationsPanel lowStock={lowStock} topProducts={topProducts} currency={currency} />

      <p className="text-center text-xs text-gray-400 pb-4">
        Shopify: biteme-one {ga?.available ? '· GA4' : ''} &middot; {RANGE_LABELS[range]} 데이터
      </p>
    </div>
  );
}

// ─── 퍼널 분석 Tab ───

function SourceConversionTable({ sources, currency }: { sources: GaFunnelData['sources']; currency: string }) {
  return (
    <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">소스 / 매체별 전환</h3>
        <p className="text-xs text-gray-400">세션 수 기준 상위 소스</p>
      </div>
      <div className="overflow-x-auto max-h-80 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-white border-b z-10">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-gray-400">소스 / 매체</th>
              <th className="text-right px-4 py-2 font-medium text-gray-400">세션</th>
              <th className="text-right px-4 py-2 font-medium text-gray-400">구매</th>
              <th className="text-right px-4 py-2 font-medium text-gray-400">전환율</th>
              <th className="text-right px-4 py-2 font-medium text-gray-400">매출</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((row, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-2.5 font-medium">{row.source}</td>
                <td className="px-4 py-2.5 text-right">{row.sessions.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right">{row.purchases > 0 ? row.purchases : '—'}</td>
                <td className="px-4 py-2.5 text-right">
                  {row.conversionRate > 0
                    ? <span style={{ color: BRAND }} className="font-semibold">{row.conversionRate.toFixed(2)}%</span>
                    : <span className="text-gray-300">0%</span>}
                </td>
                <td className="px-4 py-2.5 text-right font-medium">{row.revenue > 0 ? fmtMoney(row.revenue, currency) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PageDropoffTable({ pages }: { pages: GaFunnelData['pages'] }) {
  const maxViews = pages[0]?.views || 1;
  return (
    <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">페이지별 이탈 분석</h3>
        <p className="text-xs text-gray-400">페이지뷰 상위 페이지 · 이탈률</p>
      </div>
      <div className="overflow-x-auto max-h-80 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-white border-b z-10">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-gray-400">페이지</th>
              <th className="text-right px-4 py-2 font-medium text-gray-400">페이지뷰</th>
              <th className="text-right px-4 py-2 font-medium text-gray-400">이탈률</th>
              <th className="text-right px-4 py-2 font-medium text-gray-400">참여 시간</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((row, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-12 shrink-0 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(row.views / maxViews) * 100}%`, backgroundColor: BRAND }} />
                    </div>
                    <span className="font-mono truncate max-w-[240px]" title={row.path}>{fmtPagePath(row.path)}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right">{row.views.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right">
                  <span className={row.bounceRate > 50 ? 'text-red-500 font-semibold' : ''}>{row.bounceRate.toFixed(1)}%</span>
                </td>
                <td className="px-4 py-2.5 text-right">{row.avgEngagement > 60 ? `${Math.floor(row.avgEngagement / 60)}분 ${row.avgEngagement % 60}초` : `${row.avgEngagement}초`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const FIXED_FUNNEL_STEPS = [
  { step: 'view_item',        label: '상품 조회', color: '#f85a24' },
  { step: 'add_to_cart',      label: '장바구니',  color: '#fb8c5a' },
  { step: 'begin_checkout',   label: '결제 시작', color: '#fdb997' },
  { step: 'add_payment_info', label: '결제 정보', color: '#d4d4d4' },
  { step: 'purchase',         label: '구매 완료', color: '#a3a3a3' },
];

function FunnelTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const map = new Map(payload.map(p => [p.dataKey, p]));
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md p-3 text-xs min-w-[160px]">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {FIXED_FUNNEL_STEPS.map(s => {
        const item = map.get(s.label);
        return (
          <div key={s.step} className="flex items-center gap-2 py-0.5">
            <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-gray-600 flex-1">{s.label}</span>
            <span className="font-medium text-gray-900 tabular-nums">{(item?.value ?? 0).toLocaleString()}</span>
          </div>
        );
      })}
    </div>
  );
}

function DailyFunnelChart({ dailyFunnel }: { dailyFunnel: GaFunnelData['dailyFunnel']; funnelSteps: GaFunnelData['funnelSteps'] }) {
  const chartData = dailyFunnel.map((d: Record<string, unknown>) => ({
    date: isoToLabel(d.date as string),
    ...Object.fromEntries(FIXED_FUNNEL_STEPS.map(s => [s.label, (d[s.step] as number) || 0])),
  }));
  const interval = Math.max(0, Math.ceil(chartData.length / 10) - 1);

  return (
    <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">일별 퍼널 이벤트 추이</h3>
        <p className="text-xs text-gray-400">GA4 이커머스 이벤트 일별 발생 건수</p>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={interval} />
            <YAxis tick={{ fontSize: 10 }} width={48} />
            <Tooltip content={<FunnelTooltip />} />
            <Legend
              content={() => (
                <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-2">
                  {FIXED_FUNNEL_STEPS.map(s => (
                    <div key={s.step} className="flex items-center gap-1.5 text-xs text-gray-600">
                      <span className="inline-block w-6 h-0.5 rounded" style={{ backgroundColor: s.color }} />
                      {s.label}
                    </div>
                  ))}
                </div>
              )}
            />
            {FIXED_FUNNEL_STEPS.map(s => (
              <Line key={s.step} type="monotone" dataKey={s.label} stroke={s.color} strokeWidth={2} dot={false} />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function FunnelTab({ secret, range, ga }: { secret: string; range: string; ga: GaData | null }) {
  const { data: funnelData, isLoading } = useQuery<GaFunnelData>({
    queryKey: ['admin-ga-funnel', range],
    queryFn: () => fetchSection<GaFunnelData>('ga-funnel', secret, { range }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const currency = 'KRW';

  if (!ga?.available && !funnelData?.available) {
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

  if (isLoading) {
    return <div className="flex justify-center py-16 text-sm text-gray-400">퍼널 데이터를 불러오는 중...</div>;
  }

  return (
    <div className="space-y-5">
      <SectionLabel>구매 전환 퍼널</SectionLabel>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2">
          {ga?.funnel && ga.funnel.length > 0
            ? <FunnelChart funnel={ga.funnel} />
            : <GaPlaceholder title="EC 퍼널" />}
        </div>
        <div className="lg:col-span-3">
          {funnelData?.dailyFunnel && funnelData.dailyFunnel.length > 0
            ? <DailyFunnelChart dailyFunnel={funnelData.dailyFunnel} funnelSteps={funnelData.funnelSteps} />
            : <GaPlaceholder title="일별 퍼널 추이" />}
        </div>
      </div>

      <SectionLabel>소스 / 매체별 전환</SectionLabel>
      {funnelData?.sources && funnelData.sources.length > 0
        ? <SourceConversionTable sources={funnelData.sources} currency={currency} />
        : <GaPlaceholder title="소스/매체별 전환율" />}

      <SectionLabel>이탈 포인트 분석</SectionLabel>
      {funnelData?.pages && funnelData.pages.length > 0
        ? <PageDropoffTable pages={funnelData.pages} />
        : <GaPlaceholder title="페이지별 이탈 포인트" />}
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

      <SectionLabel>사용자 재방문</SectionLabel>
      <GaPlaceholder title="신규 vs 재방문 사용자" />

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
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [customOpen, setCustomOpen] = useState(false);

  const apiRange =
    range === 'custom' && customStart && customEnd
      ? `custom:${customStart}:${customEnd}`
      : range === 'custom'
      ? '7d'
      : range;

  const { data: dashboard, isLoading, isError, error, refetch } = useQuery<DashboardData>({
    queryKey: ['admin-dashboard', apiRange],
    queryFn: () => fetchSection<DashboardData>('dashboard', secret, { range: apiRange }),
    staleTime: 5 * 60 * 1000,
    retry: (count, err) => {
      if (err instanceof Error && err.message === 'UNAUTHORIZED') return false;
      return count < 2;
    },
  });

  const { data: gaData, refetch: refetchGa } = useQuery<GaData>({
    queryKey: ['admin-ga', apiRange],
    queryFn: () => fetchSection<GaData>('ga-overview', secret, { range: apiRange }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const { data: trafficData, refetch: refetchTraffic } = useQuery<GaTrafficData>({
    queryKey: ['admin-ga-traffic', apiRange],
    queryFn: () => fetchSection<GaTrafficData>('ga-traffic', secret, { range: apiRange }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
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
            <div className="relative">
              <div className="flex rounded-lg border bg-white overflow-hidden text-xs">
                {(['today', '7d', '28d', '90d', 'custom'] as Range[]).map(r => (
                  <button key={r} onClick={() => {
                    setRange(r);
                    if (r === 'custom') setCustomOpen(o => !o);
                    else setCustomOpen(false);
                  }}
                    className={`px-3 py-1.5 transition-colors ${range === r ? 'text-white font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                    style={range === r ? { backgroundColor: BRAND } : {}}>
                    {r === 'custom' && customStart && customEnd
                      ? `${customStart.slice(5).replace('-', '/')}~${customEnd.slice(5).replace('-', '/')}`
                      : RANGE_LABELS[r]}
                  </button>
                ))}
              </div>
              {customOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setCustomOpen(false)} />
                  <div className="absolute top-full right-0 mt-2 z-20 bg-white border rounded-xl shadow-lg p-4 flex flex-col gap-3" style={{ minWidth: 220 }}>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-gray-500">시작일</span>
                      <input type="date" value={customStart} max={customEnd || undefined}
                        onChange={e => setCustomStart(e.target.value)}
                        className="text-xs border rounded-lg px-2 py-1.5 outline-none focus:border-orange-400" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-gray-500">종료일</span>
                      <input type="date" value={customEnd} min={customStart || undefined}
                        onChange={e => setCustomEnd(e.target.value)}
                        className="text-xs border rounded-lg px-2 py-1.5 outline-none focus:border-orange-400" />
                    </div>
                    <button
                      disabled={!customStart || !customEnd}
                      onClick={() => setCustomOpen(false)}
                      className="text-xs py-1.5 rounded-lg font-medium text-white transition-colors disabled:opacity-40"
                      style={{ backgroundColor: BRAND }}>
                      적용
                    </button>
                  </div>
                </>
              )}
            </div>
            <button onClick={() => { refetch(); refetchGa(); refetchTraffic(); }} className="text-xs px-3 py-1.5 rounded-lg border hover:bg-gray-50 transition-colors">새로고침</button>
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
            : <DashboardTab data={dashboard} currency={dashboard.currency} range={range} ga={gaData || null} traffic={trafficData || null} />
        )}
        {activeTab === 'funnel' && <FunnelTab secret={secret} range={apiRange} ga={gaData || null} />}
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
