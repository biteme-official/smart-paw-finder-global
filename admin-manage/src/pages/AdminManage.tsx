import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell, LabelList,
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
  countryOrders: { country: string; orders: number }[];
  currency: string;
  brandSales?: { brand: string; quantity: number; revenue: number }[];
  countryRevenue?: { country: string; revenue: number }[];
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
  newVsRetFunnel?: {
    new: { step: string; label: string; count: number; pct: number }[];
    returning: { step: string; label: string; count: number; pct: number }[];
  };
  hourly?: { hour: number; sessions: number; purchases: number; cvr: number }[];
  cohort?: {
    data: { cohortWeek: string; retention: (number | null)[] }[];
    maxWeeks: number;
  };
}

interface GaTrafficData {
  available: boolean;
  sources: { source: string; sessions: number; users: number; bounceRate: number; avgSessionDuration: number; revenue: number }[];
  countries: { countryId: string; country: string; sessions: number; users: number }[];
  pages: { path: string; views: number; users: number }[];
}

interface GaBehaviorData {
  available: boolean;
  pages: { path: string; title: string; views: number; users: number; avgDuration: number; bounceRate: number }[];
  events: { name: string; count: number; users: number }[];
  devices: { device: string; sessions: number; users: number; transactions: number; revenue: number }[];
  newVsReturning: { type: string; sessions: number; users: number; transactions: number }[];
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

function fmtDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m > 0 ? `${m}분 ${sec}초` : `${sec}초`;
}

function pageLabel(path: string, title: string) {
  const map: Record<string, string> = { '/': 'Home (/)', '/checkout': 'Order Summary', '/checkout-return': 'Order Complete' };
  return map[path] || title || path;
}

function deviceLabel(d: string) {
  return d === 'mobile' ? '모바일' : d === 'desktop' ? '데스크톱' : d === 'tablet' ? '태블릿' : d;
}

function classifyChannel(sourceMedium: string): 'Paid' | 'Direct' | 'Organic' {
  const parts = sourceMedium.split(' / ');
  const source = parts[0] || '';
  const medium = parts[1] || '';
  if (!medium || medium === '(none)') return source === '(direct)' ? 'Direct' : 'Organic';
  const paidKeywords = ['cpc', 'cpm', 'paid', 'ppc', 'ad', 'ads', 'display', 'social_paid'];
  if (paidKeywords.some(k => medium.toLowerCase().includes(k))) return 'Paid';
  return 'Organic';
}

function fmtMoney(v: number, currency = 'USD') {
  if (currency === 'JPY') return `¥${Math.round(v).toLocaleString('ja-JP')}`;
  if (currency === 'KRW') return `₩${Math.round(v).toLocaleString('ko-KR')}`;
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

const USERS_COLOR = '#6366f1';
const AOV_COLOR = '#8b5cf6';

const CVR_COLOR = '#f59e0b';

function TrafficTrendChart({ ga, dailyOrders }: { ga?: GaData | null; dailyOrders?: DashboardData['dailyOrders'] }) {
  if (!ga?.available || !ga.daily || ga.daily.length === 0) {
    return <GaPlaceholder title="유입 및 전환 추이" />;
  }
  const orderMap = new Map<string, number>((dailyOrders ?? []).map(d => [d.date, d.orders]));
  const chartData = [...ga.daily]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(d => {
      const orders = orderMap.get(d.date) ?? 0;
      const cvr = d.sessions > 0 ? parseFloat((orders / d.sessions * 100).toFixed(2)) : 0;
      return { date: isoToLabel(d.date), users: d.users, cvr };
    });
  const interval = Math.max(0, Math.ceil(chartData.length / 10) - 1);

  return (
    <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">유입 및 전환 추이</h3>
        <p className="text-xs text-gray-400">총 사용자 · 전환율(CVR) 일별 추이</p>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 40, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={interval} />
            <YAxis yAxisId="users" tick={{ fontSize: 10 }} width={40} />
            <YAxis yAxisId="cvr" orientation="right" tick={{ fontSize: 10 }} width={36}
              tickFormatter={v => `${v}%`} />
            <Tooltip content={({ active, payload, label }) => {
              if (!active || !payload || !payload.length) return null;
              const map = new Map(payload.map(p => [p.dataKey as string, p]));
              return (
                <div className="bg-white border border-gray-200 rounded-lg shadow-md p-3 text-xs min-w-[140px]">
                  <p className="font-semibold text-gray-700 mb-2">{label}</p>
                  {[
                    { key: 'users', label: '총 사용자', color: USERS_COLOR, fmt: (v: number) => v.toLocaleString() },
                    { key: 'cvr', label: '전환율 (CVR)', color: CVR_COLOR, fmt: (v: number) => `${v}%` },
                  ].map(({ key, label: lbl, color, fmt }) => {
                    const item = map.get(key);
                    return item ? (
                      <div key={key} className="flex justify-between gap-4 py-0.5">
                        <span className="flex items-center gap-1.5 text-gray-600">
                          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                          {lbl}
                        </span>
                        <span className="font-medium">{fmt(Number(item.value))}</span>
                      </div>
                    ) : null;
                  })}
                </div>
              );
            }} />
            <Legend content={() => (
              <div className="flex gap-4 justify-center mt-2">
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: USERS_COLOR }} />
                  총 사용자
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span className="inline-block w-6 h-0.5 rounded" style={{ backgroundColor: CVR_COLOR }} />
                  전환율 (CVR)
                </div>
              </div>
            )} />
            <Bar yAxisId="users" dataKey="users" fill={USERS_COLOR} opacity={0.8} radius={[2, 2, 0, 0]} />
            <Line yAxisId="cvr" type="monotone" dataKey="cvr" stroke={CVR_COLOR} strokeWidth={2.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CombinedChart({ dailyOrders, currency }: { dailyOrders: DashboardData['dailyOrders']; currency: string }) {
  const chartData = [...dailyOrders]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(d => ({
      date: isoToLabel(d.date),
      revenue: Math.round(d.revenue * 100) / 100,
      orders: d.orders,
    }));
  const interval = Math.max(0, Math.ceil(chartData.length / 10) - 1);

  return (
    <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">주문 · 매출 추이</h3>
        <p className="text-xs text-gray-400">매출(막대) / 주문 수(선)</p>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={interval} />
            <YAxis yAxisId="rev" tick={{ fontSize: 10 }}
              tickFormatter={v => currency === 'JPY' ? `¥${(v / 1000).toFixed(0)}k` : `$${v.toFixed(0)}`} width={48} />
            <YAxis yAxisId="orders" orientation="right" tick={{ fontSize: 10 }} width={36} />
            <Tooltip content={({ active, payload, label }) => {
              if (!active || !payload || !payload.length) return null;
              const map = new Map(payload.map(p => [p.dataKey as string, p]));
              return (
                <div className="bg-white border border-gray-200 rounded-lg shadow-md p-3 text-xs min-w-[160px]">
                  <p className="font-semibold text-gray-700 mb-2">{label}</p>
                  {map.get('orders') && (
                    <div className="flex justify-between gap-4 py-0.5">
                      <span className="flex items-center gap-1.5 text-gray-600">
                        <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: BRAND }} />
                        주문 수
                      </span>
                      <span className="font-medium">{Number(map.get('orders')!.value).toLocaleString()}</span>
                    </div>
                  )}
                  {map.get('revenue') && (
                    <div className="flex justify-between gap-4 py-0.5">
                      <span className="flex items-center gap-1.5 text-gray-600">
                        <span className="inline-block w-3 h-3 rounded-sm opacity-40" style={{ backgroundColor: BRAND }} />
                        매출
                      </span>
                      <span className="font-medium">{fmtMoney(Number(map.get('revenue')!.value), currency)}</span>
                    </div>
                  )}
                </div>
              );
            }} />
            <Legend content={() => (
              <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-2">
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span className="inline-block w-6 h-0.5 rounded" style={{ backgroundColor: BRAND }} />
                  주문 수
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span className="inline-block w-4 h-3 rounded-sm opacity-40" style={{ backgroundColor: BRAND }} />
                  매출
                </div>
              </div>
            )} />
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

function TimelineTable({ dailyOrders, currency, ga, funnel }: { dailyOrders: DashboardData['dailyOrders']; currency: string; ga?: GaData | null; funnel?: GaFunnelData | null }) {
  const [tab, setTab] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const sorted = [...dailyOrders].sort((a, b) => a.date.localeCompare(b.date));

  const gaMap = new Map<string, { sessions: number; users: number }>();
  if (ga?.available && ga.daily) {
    for (const d of ga.daily) gaMap.set(d.date, { sessions: d.sessions, users: d.users });
  }

  const funnelMap = new Map<string, { addToCart: number; beginCheckout: number }>();
  if (funnel?.available && funnel.dailyFunnel) {
    for (const d of funnel.dailyFunnel) {
      funnelMap.set(d.date as string, {
        addToCart: (d.add_to_cart as number) || 0,
        beginCheckout: (d.begin_checkout as number) || 0,
      });
    }
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

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalOrders = rows.reduce((s, r) => s + r.orders, 0);

  const dash = <span className="text-gray-300">—</span>;

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
              <th className="text-left px-4 py-2 font-medium text-gray-400 whitespace-nowrap">날짜</th>
              <th className="text-right px-4 py-2 font-medium text-gray-400 whitespace-nowrap">총 사용자</th>
              <th className="text-right px-4 py-2 font-medium text-gray-400 whitespace-nowrap">장바구니</th>
              <th className="text-right px-4 py-2 font-medium text-gray-400 whitespace-nowrap">결제 시작</th>
              <th className="text-right px-4 py-2 font-medium text-gray-400 whitespace-nowrap">구매 수</th>
              <th className="text-right px-4 py-2 font-medium text-gray-400 whitespace-nowrap">CVR</th>
              <th className="text-right px-4 py-2 font-medium text-gray-400 whitespace-nowrap">AOV</th>
              <th className="text-right px-4 py-2 font-medium text-gray-400 whitespace-nowrap">매출</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const g = tab === 'daily' ? gaMap.get(row.sortKey) : undefined;
              const f = tab === 'daily' ? funnelMap.get(row.sortKey) : undefined;
              // CVR/AOV: 주문 수·매출 모두 DB(Net) 기준 사용
              const cvr = g && g.sessions > 0 && row.orders > 0 ? (row.orders / g.sessions * 100).toFixed(2) + '%' : null;
              const aov = row.orders > 0 ? fmtMoney(row.revenue / row.orders, currency) : null;
              return (
                <tr key={i} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-2 font-mono whitespace-nowrap">{row.label}</td>
                  <td className="px-4 py-2 text-right">{g ? g.users.toLocaleString() : dash}</td>
                  <td className="px-4 py-2 text-right">{f ? f.addToCart.toLocaleString() : dash}</td>
                  <td className="px-4 py-2 text-right">{f ? f.beginCheckout.toLocaleString() : dash}</td>
                  <td className="px-4 py-2 text-right">{row.orders > 0 ? row.orders.toLocaleString() : '—'}</td>
                  <td className="px-4 py-2 text-right">{cvr ?? dash}</td>
                  <td className="px-4 py-2 text-right">{aov ?? dash}</td>
                  <td className="px-4 py-2 text-right font-medium">{row.revenue > 0 ? fmtMoney(row.revenue, currency) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="sticky bottom-0 bg-white border-t">
            {(() => {
              const gaAvail = ga?.available && ga.daily;
              const periodUsers = gaAvail ? ga!.users : null;
              const periodSessions = gaAvail ? ga!.sessions : null;
              const funnelAvail = funnel?.available && funnel.dailyFunnel;
              const ftAddToCart = funnelAvail ? funnel!.dailyFunnel.reduce((s, d) => s + ((d.add_to_cart as number) || 0), 0) : null;
              const ftBeginCheckout = funnelAvail ? funnel!.dailyFunnel.reduce((s, d) => s + ((d.begin_checkout as number) || 0), 0) : null;
              // 구매 수·CVR·AOV: DB Net 기준, CVR = 주문 수 / 총 세션 수
              const ftCvr = periodSessions && periodSessions > 0 && totalOrders > 0 ? (totalOrders / periodSessions * 100).toFixed(2) + '%' : null;
              const ftAov = totalOrders > 0 ? fmtMoney(totalRevenue / totalOrders, currency) : null;
              return (
                <tr className="font-semibold">
                  <td className="px-4 py-2 text-xs">합계</td>
                  <td className="px-4 py-2 text-right">{periodUsers !== null ? periodUsers.toLocaleString() : dash}</td>
                  <td className="px-4 py-2 text-right">{ftAddToCart !== null ? ftAddToCart.toLocaleString() : dash}</td>
                  <td className="px-4 py-2 text-right">{ftBeginCheckout !== null ? ftBeginCheckout.toLocaleString() : dash}</td>
                  <td className="px-4 py-2 text-right">{totalOrders > 0 ? totalOrders.toLocaleString() : dash}</td>
                  <td className="px-4 py-2 text-right">{ftCvr ?? dash}</td>
                  <td className="px-4 py-2 text-right">{ftAov ?? dash}</td>
                  <td className="px-4 py-2 text-right">{fmtMoney(totalRevenue, currency)}</td>
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

  const data = funnel.map((step, i) => {
    const prev = funnel[i - 1];
    const dropRate = i > 0 && prev && prev.count > 0
      ? parseFloat(((1 - step.count / prev.count) * 100).toFixed(1))
      : null;
    const convRate = i > 0 && prev && prev.count > 0
      ? parseFloat(((step.count / prev.count) * 100).toFixed(1))
      : null;
    return { ...step, dropRate, convRate };
  });

  const maxDropIdx = data.reduce((maxI, s, i) => {
    if (i < 1 || s.dropRate === null) return maxI;
    return (s.dropRate ?? 0) > (data[maxI]?.dropRate ?? 0) ? i : maxI;
  }, 1);

  return (
    <div className="rounded-xl border bg-white border-gray-200 overflow-hidden h-full">
      <div className="px-5 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">EC 퍼널</h3>
        <p className="text-xs text-gray-400">GA4 이커머스 이벤트</p>
      </div>
      <div className="px-4 pt-3 pb-4">
        {data.map((step, i) => {
          const pct = maxCount > 0 ? (step.count / maxCount) * 100 : 0;
          return (
            <div key={step.step}>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 shrink-0 w-14 text-right">{step.label}</span>
                <div className="flex-1 h-7 bg-gray-100 rounded overflow-hidden">
                  <div className="h-full rounded transition-all flex items-center" style={{
                    width: `${i === 0 ? 100 : Math.max(pct, 1)}%`,
                    backgroundColor: BRAND,
                  }}>
                    {i === 0 && (
                      <span className="px-2 text-white text-xs font-bold">{step.count.toLocaleString()}</span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 w-16 text-right">
                  {i > 0 && <p className="text-xs font-bold text-gray-900">{step.count.toLocaleString()}</p>}
                  {i === 0
                    ? <p className="text-[10px] text-gray-400">기준값</p>
                    : <p className="text-[10px] text-red-400">-{step.dropRate}%</p>}
                </div>
              </div>
              {i < data.length - 1 && data[i + 1].dropRate !== null && (
                <div className="flex items-center gap-1 ml-16 py-1">
                  <span className="text-[10px] text-gray-400">▼</span>
                  <span className={`text-[10px] font-medium ${i + 1 === maxDropIdx ? 'text-red-500' : 'text-amber-500'}`}>
                    이탈 {data[i + 1].dropRate}%
                  </span>
                  <span className="text-[10px] text-gray-300 mx-0.5">·</span>
                  <span className="text-[10px] text-gray-400">전환 {data[i + 1].convRate}%</span>
                </div>
              )}
            </div>
          );
        })}
        {funnel[0]?.count > 0 && funnel[funnel.length - 1] && (
          <div className="flex items-center justify-between pt-3 mt-1 border-t border-gray-100">
            <span className="text-xs text-gray-500">전체 전환율</span>
            <span className="text-sm font-bold" style={{ color: BRAND }}>
              {((funnel[funnel.length - 1].count / funnel[0].count) * 100).toFixed(2)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}



function countryFlag(code: string) {
  if (!code || code.length !== 2) return '';
  return code.toUpperCase().split('').map(c => String.fromCodePoint(0x1F1E0 + c.charCodeAt(0) - 65)).join('');
}

const COUNTRY_COLORS = ['#f85a24', '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#9ca3af'];
const MEDALS = ['🥇', '🥈', '🥉'];

function TrafficSection({ traffic, countryOrders, funnel }: { traffic: GaTrafficData; countryOrders: { country: string; orders: number }[]; funnel?: GaFunnelData | null }) {
  const { sources, countries, pages } = traffic;
  const totalUsers = countries.reduce((s, c) => s + c.users, 0);
  const totalSourceUsers = sources.reduce((s, r) => s + r.users, 0);
  const funnelSourceMap = new Map((funnel?.sources ?? []).map(s => [s.source, s]));
  const totalOrderCount = countryOrders.reduce((s, c) => s + c.orders, 0);
  const orderMap = new Map(countryOrders.map(c => [c.country.toUpperCase(), c.orders]));
  const maxPageViews = pages[0]?.views || 1;

  const sortedByUsers = [...countries].sort((a, b) => b.users - a.users);
  const top5 = sortedByUsers.slice(0, 5);
  const otherUsers = sortedByUsers.slice(5).reduce((s, c) => s + c.users, 0);
  const top5OrdersTotal = top5.reduce((s, c) => s + (orderMap.get(c.countryId.toUpperCase()) ?? 0), 0);
  const otherOrders = totalOrderCount - top5OrdersTotal;

  const trafficPie = [
    ...top5.map((c, i) => ({ name: c.country, countryId: c.countryId, value: c.users, color: COUNTRY_COLORS[i] })),
    ...(otherUsers > 0 ? [{ name: '기타', countryId: '', value: otherUsers, color: COUNTRY_COLORS[5] }] : []),
  ];
  const conversionPie = [
    ...top5.map((c, i) => ({ name: c.country, countryId: c.countryId, value: orderMap.get(c.countryId.toUpperCase()) ?? 0, color: COUNTRY_COLORS[i] })),
    ...(otherOrders > 0 ? [{ name: '기타', countryId: '', value: otherOrders, color: COUNTRY_COLORS[5] }] : []),
  ].filter(d => d.value > 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* 유입 소스 */}
      <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">유입 소스</h3>
          <p className="text-xs text-gray-400">사용자 기준 상위 소스</p>
        </div>
        <div className="overflow-y-auto max-h-64">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white border-b">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-400">소스</th>
                <th className="text-right px-4 py-2 font-medium text-gray-400">사용자 수</th>
                <th className="text-right px-4 py-2 font-medium text-gray-400">비중</th>
                <th className="text-right px-4 py-2 font-medium text-gray-400">CVR</th>
              </tr>
            </thead>
            <tbody>
              {[...sources].sort((a, b) => b.users - a.users).map((row, i) => {
                const share = totalSourceUsers > 0 ? (row.users / totalSourceUsers * 100).toFixed(1) : '0.0';
                const fs = funnelSourceMap.get(row.source);
                const cvr = fs && row.sessions > 0 ? (fs.purchases / row.sessions * 100).toFixed(2) : null;
                return (
                  <tr key={i} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-2 truncate max-w-[120px]">{row.source}</td>
                    <td className="px-4 py-2 text-right font-medium">{row.users.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-gray-500">{share}%</td>
                    <td className="px-4 py-2 text-right">{cvr !== null ? `${cvr}%` : <span className="text-gray-300">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 국가별 유입 및 전환 */}
      <div className="rounded-xl border bg-white border-gray-200 overflow-hidden flex flex-col">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">국가별 유입 및 전환</h3>
          <p className="text-xs text-gray-400">GA4 사용자 기준 유입 · Shopify 주문 기준 전환</p>
        </div>

        <div className="px-4 py-3 flex gap-3">
          {/* 유입 비중 */}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-gray-400 mb-2">유입 비중</p>
            <div className="flex justify-center mb-2">
              <PieChart width={90} height={90}>
                <Pie data={trafficPie.length ? trafficPie : [{ name: '-', value: 1, color: '#e5e7eb' }]}
                  dataKey="value" cx={43} cy={43} innerRadius={26} outerRadius={43} paddingAngle={2}>
                  {(trafficPie.length ? trafficPie : [{ color: '#e5e7eb' }]).map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
              </PieChart>
            </div>
            <div className="space-y-1">
              {trafficPie.map(d => (
                <div key={d.name} className="flex items-center gap-1 text-[10px] leading-4">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-gray-700 truncate flex-1 min-w-0">{d.name}</span>
                  <span className="text-gray-500 shrink-0">{d.value.toLocaleString()}</span>
                  <span className="text-gray-400 shrink-0 w-9 text-right">
                    {totalUsers > 0 ? (d.value / totalUsers * 100).toFixed(1) : 0}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="w-px bg-gray-100 self-stretch" />

          {/* 전환 비중 */}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-gray-400 mb-2">전환 비중</p>
            <div className="flex justify-center mb-2">
              <PieChart width={90} height={90}>
                <Pie data={conversionPie.length ? conversionPie : [{ name: '-', value: 1, color: '#e5e7eb' }]}
                  dataKey="value" cx={43} cy={43} innerRadius={26} outerRadius={43} paddingAngle={2}>
                  {(conversionPie.length ? conversionPie : [{ color: '#e5e7eb' }]).map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
              </PieChart>
            </div>
            <div className="space-y-1">
              {trafficPie.map(d => {
                const orders = d.countryId
                  ? (orderMap.get(d.countryId.toUpperCase()) ?? 0)
                  : otherOrders;
                return (
                  <div key={d.name} className="flex items-center gap-1 text-[10px] leading-4">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-gray-700 truncate flex-1 min-w-0">{d.name}</span>
                    <span className={`shrink-0 ${orders > 0 ? 'text-gray-500' : 'text-gray-300'}`}>
                      {orders > 0 ? `${orders}건` : '—'}
                    </span>
                    <span className="text-gray-400 shrink-0 w-9 text-right">
                      {totalOrderCount > 0 && orders > 0 ? `${(orders / totalOrderCount * 100).toFixed(1)}%` : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
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

function DashboardTab({ data, currency, range, ga, traffic, funnel }: { data: DashboardData; currency: string; range: Range; ga: GaData | null; traffic: GaTrafficData | null; funnel: GaFunnelData | null }) {
  const { summary, b2b, b2c, dailyOrders, topProducts, lowStock } = data;

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <TrafficTrendChart ga={ga} dailyOrders={dailyOrders} />
        {dailyOrders.length > 0
          ? <CombinedChart dailyOrders={dailyOrders} currency={currency} />
          : <GaPlaceholder title="주문 · 매출 추이" />}
      </div>

      {dailyOrders.length > 0 && (
        <TimelineTable dailyOrders={dailyOrders} currency={currency} ga={ga} funnel={funnel} />
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
        ? <TrafficSection traffic={traffic} countryOrders={data.countryOrders ?? []} funnel={funnel} />
        : <GaPlaceholder title="유입 소스 · 국가별 유입·전환 · 상위 페이지" />}

      <SectionLabel>운영 현황</SectionLabel>
      <OperationsPanel lowStock={lowStock} topProducts={topProducts} currency={currency} />

      <p className="text-center text-xs text-gray-400 pb-4">
        Shopify: biteme-one {ga?.available ? '· GA4' : ''} &middot; {RANGE_LABELS[range]} 데이터
      </p>
    </div>
  );
}

// ─── 유입 분석 Tab ───

function TrafficAnalysisTab({ ga, traffic }: { ga: GaData | null; traffic: GaTrafficData | null }) {
  if (!ga?.available && !traffic?.available) return <GaPlaceholder title="유입 분석 데이터 없음" />;

  const sources = traffic?.sources ?? [];
  const maxUsers = Math.max(...sources.map(s => s.users), 1);

  const channelMap = new Map<string, number>();
  for (const s of sources) {
    const ch = classifyChannel(s.source);
    channelMap.set(ch, (channelMap.get(ch) || 0) + s.users);
  }
  const channelData = [
    { name: 'Paid', value: channelMap.get('Paid') || 0, color: BRAND },
    { name: 'Direct', value: channelMap.get('Direct') || 0, color: '#94a3b8' },
    { name: 'Organic', value: channelMap.get('Organic') || 0, color: '#3b82f6' },
  ].filter(d => d.value > 0);
  const totalChannelUsers = channelData.reduce((s, d) => s + d.value, 0);

  const CHANNEL_BADGE: Record<string, string> = {
    Paid: 'bg-orange-100 text-orange-700',
    Direct: 'bg-gray-100 text-gray-600',
    Organic: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ga?.available ? (
          <>
            <KpiCard label="총 세션 수" value={ga.sessions.toLocaleString()} />
            <KpiCard label="총 사용자" value={ga.users.toLocaleString()} />
            <KpiCard label="이탈률" value={`${(ga.bounceRate * 100).toFixed(1)}%`} />
            <KpiCard label="평균 세션 시간" value={fmtDuration(ga.avgSessionDuration)} />
          </>
        ) : (
          ['총 세션 수', '총 사용자', '이탈률', '평균 세션 시간'].map(t => (
            <GaPlaceholder key={t} title={t} compact />
          ))
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">소스 / 매체별 사용자</h3>
            <p className="text-xs text-gray-400">사용자 수 기준 상위 소스</p>
          </div>
          <div className="px-5 py-4 space-y-2.5">
            {sources.slice(0, 7).map((s, i) => (
              <div key={i} className="flex items-center gap-3 text-xs">
                <div className="w-28 truncate text-gray-700 font-medium">{s.source.replace(' / ', '/')}</div>
                <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                  <div className="h-full rounded transition-all" style={{ width: `${(s.users / maxUsers) * 100}%`, backgroundColor: BRAND }} />
                </div>
                <div className="w-10 text-right font-semibold text-gray-800">{s.users.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">채널 그룹별 비중</h3>
            <p className="text-xs text-gray-400">Paid / Direct / Organic</p>
          </div>
          <div className="flex items-center justify-center gap-8 p-4 h-[calc(100%-53px)]">
            <PieChart width={130} height={130}>
              <Pie
                data={channelData.length ? channelData : [{ name: '-', value: 1, color: '#e5e7eb' }]}
                dataKey="value" cx={63} cy={63} innerRadius={38} outerRadius={60} paddingAngle={2}>
                {(channelData.length ? channelData : [{ color: '#e5e7eb' }]).map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
            </PieChart>
            <div className="space-y-2">
              {channelData.map(d => (
                <div key={d.name} className="flex items-center gap-2 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-gray-700 w-16">{d.name}</span>
                  <span className="font-bold text-gray-900">
                    {totalChannelUsers > 0 ? `${(d.value / totalChannelUsers * 100).toFixed(0)}%` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">소스 / 매체별 상세 지표</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-gray-400">소스 / 매체</th>
                <th className="text-center px-4 py-2.5 font-medium text-gray-400">채널</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-400">사용자</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-400">세션</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-400">이탈률</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-400">평균 세션 시간</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-400">총 수익</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((row, i) => {
                const ch = classifyChannel(row.source);
                return (
                  <tr key={i} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-gray-800">{row.source}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${CHANNEL_BADGE[ch]}`}>{ch}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{row.users.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{row.sessions.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{row.bounceRate.toFixed(1)}%</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtDuration(row.avgSessionDuration ?? 0)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {(row.revenue ?? 0) > 0
                        ? `$${(row.revenue ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                        : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── 전환 분석 Tab ───

function ConversionAnalysisTab({ ga }: { ga: GaData | null }) {
  if (!ga?.available || !ga.funnel || ga.funnel.length === 0) {
    return <GaPlaceholder title="전환 분석 데이터 없음" />;
  }

  const funnel = ga.funnel;
  const first = funnel[0];
  const last = funnel[funnel.length - 1];
  const maxCount = first.count || 1;

  const steps = funnel.map((s, i) => {
    const prev = funnel[i - 1];
    const dropRate = i > 0 && prev && prev.count > 0
      ? Math.round((1 - s.count / prev.count) * 1000) / 10
      : null;
    return { ...s, dropRate };
  });

  const overallCvr = first.count > 0 ? ((last.count / first.count) * 100).toFixed(2) : '0.00';
  const addPayInfo = funnel.find(s => s.step === 'add_payment_info');
  const paymentInfoCvr = addPayInfo && addPayInfo.count > 0
    ? ((last.count / addPayInfo.count) * 100).toFixed(1)
    : '0.0';

  const maxDropStep = steps.reduce<typeof steps[0] | null>((m, s, i) => {
    if (i < 2 || s.dropRate === null) return m;
    return !m || (s.dropRate ?? 0) > (m.dropRate ?? 0) ? s : m;
  }, null);

  const top3Drop = [...steps]
    .filter((s, i) => i >= 1 && s.dropRate !== null)
    .sort((a, b) => (b.dropRate ?? 0) - (a.dropRate ?? 0))
    .slice(0, 3);

  const RANKS = ['1위', '2위', '3위'];
  const RANK_STYLES = [
    { wrap: 'bg-orange-50 border-orange-200', rate: 'text-orange-600', desc: 'text-orange-500' },
    { wrap: 'bg-orange-50/50 border-orange-100', rate: 'text-orange-500', desc: 'text-orange-400' },
    { wrap: 'bg-gray-50 border-gray-200', rate: 'text-gray-700', desc: 'text-gray-500' },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500 mb-1">전체 전환율</p>
          <p className="text-2xl font-bold" style={{ color: BRAND }}>{overallCvr}%</p>
          <p className="text-xs text-gray-400 mt-1">상품 조회 → 구매</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500 mb-1">구매 완료</p>
          <p className="text-2xl font-bold text-gray-900">{last.count.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500 mb-1">결제정보 전환율</p>
          <p className="text-2xl font-bold text-gray-900">{paymentInfoCvr}%</p>
          <p className="text-xs text-gray-400 mt-1">결제정보→구매완료</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500 mb-1">최대 이탈 구간</p>
          <p className="text-sm font-bold leading-snug text-gray-900">{maxDropStep ? maxDropStep.label : '—'}</p>
          {maxDropStep && <p className="text-xs text-red-500 mt-1">-{maxDropStep.dropRate}% 이탈</p>}
        </div>
      </div>

      <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">EC 퍼널 전환율</h3>
          <p className="text-xs text-gray-400">GA4 이커머스 이벤트</p>
        </div>
        <div className="px-6 pt-4 pb-2">
          <div className="flex items-end justify-around gap-2" style={{ height: 180 }}>
            {steps.map((s, i) => {
              const heightPct = maxCount > 0 ? Math.max((s.count / maxCount) * 100, 3) : 3;
              const opacity = 1 - i * 0.13;
              return (
                <div key={s.step} className="flex flex-col items-center flex-1 gap-1" style={{ height: '100%', justifyContent: 'flex-end' }}>
                  <span className="text-xs font-bold text-gray-800 tabular-nums">{s.count.toLocaleString()}</span>
                  <div className="w-full rounded-t-md transition-all"
                    style={{ height: `${heightPct}%`, backgroundColor: BRAND, opacity }} />
                </div>
              );
            })}
          </div>
          <div className="flex justify-around gap-2 mt-2 pb-4">
            {steps.map((s, i) => (
              <div key={s.step} className="flex flex-col items-center flex-1 text-center gap-0.5">
                <span className="text-[11px] text-gray-600 font-medium leading-tight">{s.label}</span>
                {i > 0 && s.dropRate !== null
                  ? <span className="text-[10px] text-red-500 font-semibold">-{s.dropRate}%</span>
                  : <span className="text-[10px] text-gray-400">—</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-500 mb-3">이탈 구간 Top 3 <span className="font-normal text-gray-400">이탈률이 높은 순서</span></p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {top3Drop.map((s, i) => {
            const st = RANK_STYLES[i];
            const fIdx = funnel.findIndex(f => f.step === s.step);
            const prev = fIdx > 0 ? funnel[fIdx - 1] : null;
            const dropCount = prev ? prev.count - s.count : 0;
            return (
              <div key={s.step} className={`rounded-xl border p-4 ${st.wrap}`}>
                <p className="text-[10px] font-semibold text-gray-400 mb-1">{RANKS[i]} · {s.label} 단계</p>
                <p className={`text-2xl font-bold ${st.rate}`}>-{s.dropRate}%</p>
                {prev && (
                  <p className={`text-[11px] mt-1 ${st.desc}`}>
                    {prev.label} {prev.count.toLocaleString()}명 중 {dropCount.toLocaleString()}명 이탈
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── 판매 분석 Tab ───

function SalesAnalysisTab({ data, currency, traffic }: { data: DashboardData; currency: string; traffic: GaTrafficData | null }) {
  const [productSort, setProductSort] = useState<'quantity' | 'revenue'>('revenue');
  const [brandSort, setBrandSort] = useState<'quantity' | 'revenue'>('revenue');

  const { b2b, b2c, topProducts, brandSales = [], countryRevenue = [] } = data;
  const countries = [...(traffic?.countries ?? [])].sort((a, b) => b.users - a.users);
  const totalUsers = countries.reduce((s, c) => s + c.users, 0);
  const totalRevenue = countryRevenue.reduce((s, c) => s + c.revenue, 0);

  const sortedProducts = [...topProducts].sort((a, b) =>
    productSort === 'revenue' ? b.revenue - a.revenue : b.quantity - a.quantity
  );
  const sortedBrands = [...brandSales].sort((a, b) =>
    brandSort === 'revenue' ? b.revenue - a.revenue : b.quantity - a.quantity
  );

  const totalBrandRevenue = sortedBrands.reduce((s, b) => s + b.revenue, 0);
  const top3Brands = sortedBrands.slice(0, 3);
  const otherBrandRevenue = sortedBrands.slice(3).reduce((s, b) => s + b.revenue, 0);

  function ColHeader({ field, label, active, onSort }: {
    field: 'quantity' | 'revenue'; label: string;
    active: 'quantity' | 'revenue'; onSort: (k: 'quantity' | 'revenue') => void;
  }) {
    return (
      <th className="text-right px-4 py-2.5 font-medium text-gray-400 cursor-pointer select-none hover:text-gray-600 whitespace-nowrap"
        onClick={() => onSort(field)}>
        {label}{active === field ? ' ↓' : ''}
      </th>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ChannelCard label="소매" badge="B2C" badgeCls="bg-orange-100 text-orange-700" ch={b2c} currency={currency} />
        <ChannelCard label="도매" badge="B2B" badgeCls="bg-blue-100 text-blue-700" ch={b2b} currency={currency} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">상품별 매출</h3>
            <p className="text-xs text-gray-400">매출 기준 상위 상품 · 헤더 클릭으로 정렬</p>
          </div>
          <div className="overflow-y-auto max-h-72">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-400">상품명</th>
                  <ColHeader field="quantity" label="판매수량" active={productSort} onSort={setProductSort} />
                  <ColHeader field="revenue" label="매출액" active={productSort} onSort={setProductSort} />
                </tr>
              </thead>
              <tbody>
                {sortedProducts.map((row, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 truncate max-w-[180px]">{row.title}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{row.quantity.toLocaleString()}개</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">{fmtMoney(row.revenue, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">브랜드별 매출 비중</h3>
            <p className="text-xs text-gray-400">브랜드 기준 매출액 · 헤더 클릭으로 정렬</p>
          </div>
          {sortedBrands.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">브랜드 데이터 없음</p>
          ) : (
            <>
              <div className="overflow-y-auto max-h-60">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-400">브랜드</th>
                      <ColHeader field="quantity" label="판매수량" active={brandSort} onSort={setBrandSort} />
                      <ColHeader field="revenue" label="매출액" active={brandSort} onSort={setBrandSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedBrands.map((row, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-gray-50/50">
                        <td className="px-4 py-2.5 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COUNTRY_COLORS[i] || COUNTRY_COLORS[5] }} />
                          {row.brand}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{row.quantity.toLocaleString()}개</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-medium">{fmtMoney(row.revenue, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalBrandRevenue > 0 && (
                <div className="px-4 py-2.5 border-t border-gray-100 flex flex-wrap gap-x-3 gap-y-1">
                  {[...top3Brands, ...(otherBrandRevenue > 0 ? [{ brand: '기타', revenue: otherBrandRevenue, quantity: 0 }] : [])].map((b, i) => (
                    <div key={b.brand} className="flex items-center gap-1 text-[10px]">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COUNTRY_COLORS[i] || COUNTRY_COLORS[5] }} />
                      <span className="text-gray-600">{b.brand} {Math.round(b.revenue / totalBrandRevenue * 100)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">국가별 유입 비중</h3>
            <p className="text-xs text-gray-400">사용자 수 기준</p>
          </div>
          <div className="overflow-y-auto max-h-64">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-400">국가</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-400">사용자 수</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-400">비중</th>
                </tr>
              </thead>
              <tbody>
                {countries.slice(0, 10).map((c, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-gray-50/50">
                    <td className="px-4 py-2.5">
                      <span className="mr-1">{countryFlag(c.countryId)}</span>
                      {c.countryId} {c.country}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{c.users.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-500">
                      {totalUsers > 0 ? `${(c.users / totalUsers * 100).toFixed(0)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">국가별 매출 비중</h3>
            <p className="text-xs text-gray-400">주문 기준 매출액</p>
          </div>
          <div className="overflow-y-auto max-h-64">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-400">국가</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-400">매출액</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-400">비중</th>
                </tr>
              </thead>
              <tbody>
                {countryRevenue.slice(0, 10).map((c, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-gray-50/50">
                    <td className="px-4 py-2.5">
                      <span className="mr-1">{countryFlag(c.country)}</span>
                      {c.country}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">{fmtMoney(c.revenue, currency)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-500">
                      {totalRevenue > 0 ? `${(c.revenue / totalRevenue * 100).toFixed(0)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── (구) 퍼널 분석 Tab ───

function SourceConversionCard({ sources, fmtRevenue }: { sources: GaFunnelData['sources']; fmtRevenue: (v: number) => string }) {
  const totalRevenue = sources.reduce((s, r) => s + r.revenue, 0);
  const totalUsers = sources.reduce((s, r) => s + r.sessions, 0);
  const totalPurchases = sources.reduce((s, r) => s + r.purchases, 0);
  const totalCvr = totalUsers > 0 ? (totalPurchases / totalUsers) * 100 : 0;
  const bestSource = sources.reduce<typeof sources[0] | null>((best, r) =>
    !best || r.revenue > best.revenue ? r : best, null);
  const bestShare = bestSource && totalRevenue > 0 ? (bestSource.revenue / totalRevenue) * 100 : 0;
  return (
    <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
      <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-300">02</span>
            <h3 className="text-sm font-bold text-gray-900">소스/매체별 전환 성과</h3>
          </div>
          <p className="text-xs text-gray-400 mt-0.5 ml-5">어떤 채널이 실제 구매로 이어지는지 파악</p>
        </div>
      </div>
      <div className="overflow-x-auto overflow-y-auto max-h-72">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-white border-b border-gray-100 z-10">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-gray-400">소스</th>
              <th className="text-right px-4 py-2.5 font-medium text-gray-400">유입 사용자</th>
              <th className="text-right px-4 py-2.5 font-medium text-gray-400">구매 전환율</th>
              <th className="text-right px-4 py-2.5 font-medium text-gray-400">구매 완료</th>
              <th className="text-right px-4 py-2.5 font-medium text-gray-400">매출액</th>
              <th className="text-right px-4 py-2.5 font-medium text-gray-400">매출 비중</th>
              <th className="text-center px-4 py-2.5 font-medium text-gray-400">성과</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((row, i) => {
              const cvr = row.conversionRate;
              const badge = cvr >= 2
                ? { text: '우수', cls: 'bg-green-100 text-green-700' }
                : cvr >= 0.5
                  ? { text: '개선필요', cls: 'bg-orange-100 text-orange-600' }
                  : { text: '주의', cls: 'bg-gray-100 text-gray-500' };
              const cvrColor = cvr >= 1.5 ? '#10b981' : cvr > 0 ? BRAND : undefined;
              const revenueShare = totalRevenue > 0 ? (row.revenue / totalRevenue) * 100 : 0;
              return (
                <tr key={i} className="border-b last:border-0 hover:bg-gray-50/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">{row.source}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.sessions.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums" style={{ color: cvrColor }}>
                    {cvr > 0 ? `${cvr.toFixed(2)}%` : <span className="text-gray-300">0%</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.purchases > 0 ? row.purchases : <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.revenue > 0 ? fmtRevenue(row.revenue) : <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {revenueShare > 0
                      ? <span className="font-semibold" style={{ color: BRAND }}>{revenueShare.toFixed(1)}%</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.text}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="border-t border-gray-100 px-5 py-4">
        <p className="text-[11px] font-semibold text-gray-400 mb-3">종합 지표</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg bg-gray-50 px-4 py-3">
            <p className="text-xs text-gray-400 mb-0.5">총 유입 사용자</p>
            <p className="text-base font-bold text-gray-900">{totalUsers.toLocaleString()}명</p>
            <p className="text-[10px] text-gray-400 mt-0.5">전체 소스 합산</p>
          </div>
          <div className="rounded-lg bg-gray-50 px-4 py-3">
            <p className="text-xs text-gray-400 mb-0.5">전체 구매 전환율</p>
            <p className="text-base font-bold" style={{ color: totalCvr >= 1.5 ? '#10b981' : BRAND }}>{totalCvr.toFixed(2)}%</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{totalPurchases}건 / {totalUsers.toLocaleString()}명</p>
          </div>
          <div className="rounded-lg bg-gray-50 px-4 py-3">
            <p className="text-xs text-gray-400 mb-0.5">우수 소스/매체</p>
            <p className="text-sm font-bold text-gray-900 truncate">{bestSource ? bestSource.source : '—'}</p>
            {bestSource && <p className="text-[10px] text-gray-400 mt-0.5">매출 비중 {bestShare.toFixed(1)}%</p>}
          </div>
          <div className="rounded-lg bg-gray-50 px-4 py-3">
            <p className="text-xs text-gray-400 mb-0.5">총 매출액</p>
            <p className="text-base font-bold text-gray-900">{fmtRevenue(totalRevenue)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function NewVsRetFunnelCard({ data }: { data: NonNullable<GaFunnelData['newVsRetFunnel']> }) {
  const newColor = BRAND;
  const retColor = '#10b981';
  return (
    <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
      <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-300">03</span>
            <h3 className="text-sm font-bold text-gray-900">신규 vs 재방문 유저 퍼널 비교</h3>
          </div>
          <p className="text-xs text-gray-400 mt-0.5 ml-5">리텐션과 신규 유입 중 어디에 집중할지 판단</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 p-4">
        {([['신규 유저', data.new, newColor], ['재방문 유저', data.returning, retColor]] as const).map(([title, steps, color]) => (
          <div key={title} className="border border-gray-100 rounded-lg p-4">
            <p className="text-xs font-semibold text-gray-700 mb-3">{title}</p>
            <div className="space-y-2.5">
              {steps.map((s) => (
                <div key={s.step} className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-500 w-14 shrink-0">{s.label}</span>
                  <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                    <div className="h-full rounded transition-all" style={{ width: `${Math.max(s.pct, 0.5)}%`, backgroundColor: color, opacity: 0.85 }} />
                  </div>
                  <span className="text-[11px] font-semibold w-10 text-right tabular-nums" style={{ color }}>{s.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CohortCard({ cohort }: { cohort: NonNullable<GaFunnelData['cohort']> }) {
  const headers = Array.from({ length: cohort.maxWeeks }, (_, i) => `${i}주차`);
  const getStyle = (val: number | null): React.CSSProperties => {
    if (val === null) return {};
    const opacity = 0.12 + (val / 100) * 0.88;
    return { backgroundColor: `rgba(248,90,36,${opacity})`, color: val > 50 ? '#fff' : '#7c2d12' };
  };
  return (
    <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
      <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-300">04</span>
            <h3 className="text-sm font-bold text-gray-900">구매 후 재방문 코호트</h3>
          </div>
          <p className="text-xs text-gray-400 mt-0.5 ml-5">구매 경험 후 얼마나 돌아오는지 확인</p>
        </div>
      </div>
      <div className="p-4 overflow-x-auto">
        <table className="w-full text-xs border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="text-left px-2 py-1.5 font-medium text-gray-400 w-20"></th>
              {headers.map(h => <th key={h} className="text-center px-1 py-1.5 font-medium text-gray-400 min-w-[56px]">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {cohort.data.map(row => (
              <tr key={row.cohortWeek}>
                <td className="text-gray-500 font-medium px-2 py-1">{row.cohortWeek}</td>
                {row.retention.map((val, i) => (
                  <td key={i} className="text-center px-1 py-1 rounded font-semibold text-[11px]" style={getStyle(val)}>
                    {val !== null ? `${val}%` : <span className="text-gray-200">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center gap-2 mt-3 text-[10px] text-gray-400">
          <span>낮음</span>
          {[0.12, 0.35, 0.58, 0.8].map((op, i) => (
            <div key={i} className="w-4 h-4 rounded" style={{ backgroundColor: `rgba(248,90,36,${op})` }} />
          ))}
          <span>높음</span>
        </div>
      </div>
    </div>
  );
}

function HourlyTooltip({ active, payload }: { active?: boolean; payload?: { payload: { hour: number; sessions: number; purchases: number; cvr: number } }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md p-3 text-xs min-w-[150px]">
      <p className="font-semibold text-gray-700 mb-2">{d.hour}시</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">사용자 수</span>
          <span className="font-medium text-gray-700">{d.sessions.toLocaleString()}명</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">구매 수</span>
          <span className="font-medium text-gray-700">{d.purchases}건</span>
        </div>
        <div className="flex justify-between gap-4 pt-1 border-t border-gray-100">
          <span className="text-gray-400">전환율</span>
          <span className="font-bold" style={{ color: d.cvr >= 1.5 ? '#10b981' : BRAND }}>{d.cvr.toFixed(2)}%</span>
        </div>
      </div>
    </div>
  );
}

function HourlyConversionCard({ hourly }: { hourly: NonNullable<GaFunnelData['hourly']> }) {
  const THRESHOLD = 1.5;
  const withData = hourly.filter(h => h.sessions > 0);
  const peak = withData.length > 0 ? withData.reduce((m, h) => h.cvr > m.cvr ? h : m, withData[0]) : null;
  const trough = withData.length > 0 ? withData.reduce((m, h) => h.cvr < m.cvr ? h : m, withData[0]) : null;
  const avgSessions = withData.length > 0 ? Math.round(withData.reduce((s, h) => s + h.sessions, 0) / withData.length) : 0;
  return (
    <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
      <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-300">05</span>
            <h3 className="text-sm font-bold text-gray-900">시간대별 전환율</h3>
          </div>
          <p className="text-xs text-gray-400 mt-0.5 ml-5">광고 집행 및 프로모션 최적 타이밍 파악</p>
        </div>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
          <div className="bg-gray-50 rounded-lg px-3 py-2.5">
            <p className="text-[10px] text-gray-400 mb-0.5">피크 시간대</p>
            <p className="text-base font-bold text-gray-900">{peak ? `${peak.hour}시-${peak.hour + 2}시` : '—'}</p>
            {peak && <p className="text-[10px] text-gray-400 mt-0.5">{peak.sessions.toLocaleString()}명 방문</p>}
          </div>
          <div className="bg-gray-50 rounded-lg px-3 py-2.5">
            <p className="text-[10px] text-gray-400 mb-0.5">최고 전환율</p>
            <p className="text-base font-bold text-green-600">{peak ? `${peak.cvr.toFixed(1)}%` : '—'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg px-3 py-2.5">
            <p className="text-[10px] text-gray-400 mb-0.5">시간당 평균 방문자</p>
            <p className="text-base font-bold text-gray-900">{avgSessions > 0 ? `${avgSessions.toLocaleString()}명` : '—'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg px-3 py-2.5">
            <p className="text-[10px] text-gray-400 mb-0.5">최저 시간대</p>
            <p className="text-base font-bold text-gray-900">{trough ? `${trough.hour}시-${trough.hour + 2}시` : '—'}</p>
            {trough && <p className="text-[10px] text-gray-400 mt-0.5">{trough.sessions.toLocaleString()}명 방문</p>}
          </div>
          <div className="bg-gray-50 rounded-lg px-3 py-2.5">
            <p className="text-[10px] text-gray-400 mb-0.5">최저 전환율</p>
            <p className="text-base font-bold text-red-500">{trough ? `${trough.cvr.toFixed(1)}%` : '—'}</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <ComposedChart data={hourly} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickFormatter={(v: number) => String(v)} interval={2} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${v}%`} width={36} />
            <Tooltip content={<HourlyTooltip />} />
            <Bar dataKey="cvr" radius={[2, 2, 0, 0]}>
              {hourly.map((h, i) => <Cell key={i} fill={h.cvr >= THRESHOLD ? BRAND : '#fcd4c2'} />)}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-500">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: BRAND }} />
            <span>전환율 높음 (1.5%+)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[#fcd4c2]" />
            <span>전환율 낮음</span>
          </div>
        </div>
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

function DailyFunnelChart({ dailyFunnel, gaFunnel, range }: { dailyFunnel: GaFunnelData['dailyFunnel']; funnelSteps: GaFunnelData['funnelSteps']; gaFunnel?: GaData['funnel'] | null; range?: string }) {
  const stageData = (() => {
    if (gaFunnel && gaFunnel.length > 0) {
      return gaFunnel.map((s, i) => {
        const prev = gaFunnel[i - 1];
        return {
          stage: s.label,
          count: s.count,
          convRate: prev && prev.count > 0 ? Math.round((s.count / prev.count) * 1000) / 10 : null,
          dropRate: prev && prev.count > 0 ? Math.round((1 - s.count / prev.count) * 1000) / 10 : null,
        };
      });
    }
    const totals: Record<string, number> = {};
    dailyFunnel.forEach((d: Record<string, unknown>) => {
      FIXED_FUNNEL_STEPS.forEach(s => {
        totals[s.step] = (totals[s.step] || 0) + ((d[s.step] as number) || 0);
      });
    });
    return FIXED_FUNNEL_STEPS.map((s, i) => {
      const prev = i > 0 ? totals[FIXED_FUNNEL_STEPS[i - 1].step] : 0;
      return {
        stage: s.label,
        count: totals[s.step] || 0,
        convRate: prev > 0 ? Math.round((totals[s.step] / prev) * 1000) / 10 : null,
        dropRate: prev > 0 ? Math.round((1 - totals[s.step] / prev) * 1000) / 10 : null,
      };
    });
  })();

  const first = stageData[0];
  const last = stageData[stageData.length - 1];
  const totalConv = first && last && first.count > 0
    ? ((last.count / first.count) * 100).toFixed(2) : null;
  const maxDrop = stageData.reduce<{ from: string; to: string; dr: number } | null>((m, s, i) => {
    if (i < 1 || s.dropRate === null) return m;
    const dr = s.dropRate ?? 0;
    return !m || dr > m.dr ? { from: stageData[i - 1].stage, to: s.stage, dr } : m;
  }, null);

  const convSteps = stageData.slice(0, -1)
    .map(s => ({ label: s.stage, cvr: s.count > 0 && last ? parseFloat(((last.count / s.count) * 100).toFixed(2)) : 0 }))
    .filter(s => s.cvr > 0);
  const maxCvr = Math.max(...convSteps.map(s => s.cvr), 0.01);

  const rangeLabel = (() => {
    if (!range) return '';
    if (range === 'today') return '오늘';
    if (/^\d+d$/.test(range)) return `최근 ${range.replace('d', '')}일`;
    if (range.startsWith('custom:')) {
      const [, s, e] = range.split(':');
      const fmt = (d: string) => d.slice(5).replace('-', '/');
      return `${fmt(s)} ~ ${fmt(e)}`;
    }
    return range;
  })();

  return (
    <div className="rounded-xl border bg-white border-gray-200 overflow-hidden h-full">
      <div className="px-5 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">KPI 요약</h3>
        <p className="text-xs text-gray-400">핵심 전환 지표 한눈에 보기</p>
      </div>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-gray-50 px-4 py-3">
            <p className="text-xs text-gray-400 mb-0.5">전체 전환율</p>
            <p className="text-xl font-bold" style={{ color: BRAND }}>{totalConv !== null ? `${totalConv}%` : '—'}</p>
            {first && last && <p className="text-[10px] text-gray-400 mt-0.5">{last.count}건 / {first.count.toLocaleString()}명</p>}
          </div>
          <div className="rounded-lg bg-gray-50 px-4 py-3">
            <p className="text-xs text-gray-400 mb-0.5">최대 이탈 구간</p>
            <p className="text-sm font-bold leading-snug" style={{ color: BRAND }}>
              {maxDrop ? `${maxDrop.from} → ${maxDrop.to}` : '—'}
            </p>
            {maxDrop && <p className="text-[10px] text-gray-400 mt-0.5">{maxDrop.dr}% 이탈</p>}
          </div>
          <div className="rounded-lg bg-gray-50 px-4 py-3">
            <p className="text-xs text-gray-400 mb-0.5">상품 조회 수</p>
            <p className="text-xl font-bold text-gray-900">{first ? first.count.toLocaleString() : '—'}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">전체 유입 기준</p>
          </div>
          <div className="rounded-lg bg-gray-50 px-4 py-3">
            <p className="text-xs text-gray-400 mb-0.5">구매 완료 수</p>
            <p className="text-xl font-bold text-gray-900">{last ? last.count.toLocaleString() : '—'}</p>
            {rangeLabel && <p className="text-[10px] text-gray-400 mt-0.5">{rangeLabel}</p>}
          </div>
        </div>
        {convSteps.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">단계별 → 구매완료 전환율</p>
            <div className="space-y-2">
              {convSteps.map(s => (
                <div key={s.label} className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-500 shrink-0 w-28 truncate">{s.label} → 구매</span>
                  <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                    <div className="h-full rounded transition-all" style={{
                      width: `${(s.cvr / maxCvr) * 100}%`,
                      backgroundColor: BRAND,
                      opacity: 0.6 + (s.cvr / maxCvr) * 0.4,
                    }} />
                  </div>
                  <span className="text-[11px] font-semibold text-gray-700 w-10 text-right tabular-nums">{s.cvr}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FunnelTab({ secret, range, ga, dashboardCurrency }: { secret: string; range: string; ga: GaData | null; dashboardCurrency: string }) {
  const { data: funnelData, isLoading } = useQuery<GaFunnelData>({
    queryKey: ['admin-ga-funnel', range],
    queryFn: () => fetchSection<GaFunnelData>('ga-funnel', secret, { range }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const needsConversion = dashboardCurrency !== 'KRW';

  const { data: fxData } = useQuery<{ rates: Record<string, number> }>({
    queryKey: ['fx-rate', dashboardCurrency],
    queryFn: () => fetch(`https://open.er-api.com/v6/latest/${dashboardCurrency}`).then(r => r.json()),
    enabled: needsConversion,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });

  const krwRate = needsConversion ? (fxData?.rates?.KRW ?? null) : null;

  function fmtGaRevenue(v: number): string {
    if (!needsConversion) return `₩${Math.round(v).toLocaleString('ko-KR')}`;
    if (krwRate === null) return '—';
    return `₩${Math.round(v * krwRate).toLocaleString('ko-KR')}`;
  }

  if (!ga?.available && !funnelData?.available) {
    return (
      <div className="space-y-5">
        <GaPlaceholder title="구매 전환 퍼널" />
        <GaPlaceholder title="소스/매체별 전환 성과" />
        <GaPlaceholder title="신규 vs 재방문 유저 퍼널 비교" />
        <GaPlaceholder title="구매 후 재방문 코호트" />
        <GaPlaceholder title="시간대별 전환율" />
      </div>
    );
  }

  if (isLoading) {
    return <div className="flex justify-center py-16 text-sm text-gray-400">퍼널 데이터를 불러오는 중...</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-bold text-gray-900">구매 전환 퍼널</h2>
        <p className="text-xs text-gray-400 mt-0.5">GA4 이커머스 이벤트 · {range}</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          {ga?.funnel && ga.funnel.length > 0
            ? <FunnelChart funnel={ga.funnel} />
            : <GaPlaceholder title="EC 퍼널" />}
        </div>
        <div>
          {funnelData?.dailyFunnel && funnelData.dailyFunnel.length > 0
            ? <DailyFunnelChart dailyFunnel={funnelData.dailyFunnel} funnelSteps={funnelData.funnelSteps} gaFunnel={ga?.funnel ?? null} range={range} />
            : <GaPlaceholder title="KPI 요약" />}
        </div>
      </div>


      {funnelData?.sources && funnelData.sources.length > 0
        ? <SourceConversionCard sources={funnelData.sources} fmtRevenue={fmtGaRevenue} />
        : <GaPlaceholder title="소스/매체별 전환 성과" />}

      {funnelData?.newVsRetFunnel
        ? <NewVsRetFunnelCard data={funnelData.newVsRetFunnel} />
        : <GaPlaceholder title="신규 vs 재방문 유저 퍼널 비교" />}

      {funnelData?.cohort
        ? <CohortCard cohort={funnelData.cohort} />
        : <GaPlaceholder title="구매 후 재방문 코호트" />}

      {funnelData?.hourly
        ? <HourlyConversionCard hourly={funnelData.hourly} />
        : <GaPlaceholder title="시간대별 전환율" />}
    </div>
  );
}

// ─── 행동 분석 Tab ───

function BehaviorTab({ secret, range }: { secret: string; range: string }) {
  const { data: ga, isLoading } = useQuery<GaBehaviorData>({
    queryKey: ['ga-behavior', range],
    queryFn: () => fetchSection<GaBehaviorData>('ga-behavior', secret, { range }),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  if (isLoading) return <div className="flex justify-center py-16 text-sm text-gray-400">행동 분석 데이터를 불러오는 중...</div>;
  if (!ga?.available) return <GaPlaceholder title="GA4 행동 분석 데이터 없음" />;

  const maxViews = Math.max(...ga.pages.map(p => p.views), 1);
  const maxCount = Math.max(...ga.events.map(e => e.count), 1);
  const totalDevSessions = ga.devices.reduce((s, d) => s + d.sessions, 0) || 1;

  return (
    <div className="space-y-5">
      <SectionLabel>상위 페이지</SectionLabel>
      <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-gray-400">페이지</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-400">페이지뷰</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-400">사용자</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-400">평균 체류</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-400">이탈률</th>
              </tr>
            </thead>
            <tbody>
              {ga.pages.map((p, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-gray-50/50">
                  <td className="px-4 py-2.5 max-w-[220px]">
                    <div className="font-medium truncate">{pageLabel(p.path, p.title)}</div>
                    <div className="relative h-1 mt-1 rounded bg-gray-100 overflow-hidden">
                      <div className="absolute inset-y-0 left-0 rounded bg-orange-400" style={{ width: `${(p.views / maxViews) * 100}%` }} />
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold">{p.views.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{p.users.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{fmtDuration(p.avgDuration)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`font-medium ${p.bounceRate >= 60 ? 'text-red-500' : p.bounceRate >= 40 ? 'text-amber-500' : 'text-green-600'}`}>
                      {p.bounceRate.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <SectionLabel>이벤트 분석</SectionLabel>
      <div className="rounded-xl border bg-white border-gray-200 p-4 space-y-2">
        {ga.events.map((e, i) => (
          <div key={i} className="flex items-center gap-3 text-xs">
            <div className="w-36 truncate text-gray-700 font-medium">{e.name}</div>
            <div className="flex-1 relative h-4 rounded bg-gray-100 overflow-hidden">
              <div className="absolute inset-y-0 left-0 rounded bg-orange-300" style={{ width: `${(e.count / maxCount) * 100}%` }} />
            </div>
            <div className="w-16 text-right font-semibold">{e.count.toLocaleString()}</div>
            <div className="w-20 text-right text-gray-400">{e.users.toLocaleString()}명</div>
          </div>
        ))}
      </div>

      <SectionLabel>디바이스별 현황</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {ga.devices.map((d, i) => {
          const cvr = d.sessions > 0 ? ((d.transactions / d.sessions) * 100).toFixed(1) : '0.0';
          const share = ((d.sessions / totalDevSessions) * 100).toFixed(0);
          return (
            <div key={i} className="rounded-xl border bg-white border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold">{deviceLabel(d.device)}</span>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{share}%</span>
              </div>
              <div className="space-y-1 text-xs text-gray-600">
                <div className="flex justify-between"><span>세션</span><span className="font-medium">{d.sessions.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>사용자</span><span className="font-medium">{d.users.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>전환 수</span><span className="font-medium">{d.transactions.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>CVR</span><span className="font-semibold text-orange-500">{cvr}%</span></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 회원 분석 Tab ───

function CustomerTab({ secret, range }: { secret: string; range: string }) {
  const [tab, setTab] = useState('top');

  const { data, isLoading } = useQuery<CustomerSummary>({
    queryKey: ['admin-customers'],
    queryFn: () => fetchSection<CustomerSummary>('customers', secret, { view: 'all' }),
    staleTime: 60_000,
  });

  const { data: gaData } = useQuery<GaBehaviorData>({
    queryKey: ['ga-behavior', range],
    queryFn: () => fetchSection<GaBehaviorData>('ga-behavior', secret, { range }),
    staleTime: 5 * 60 * 1000,
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
      {!gaData?.available ? (
        <GaPlaceholder title="신규 vs 재방문 유저" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(['new', 'returning'] as const).map((type) => {
            const row = gaData.newVsReturning.find(r => r.type === type) || { sessions: 0, users: 0, transactions: 0 };
            const totalSess = gaData.newVsReturning.reduce((s, r) => s + r.sessions, 0) || 1;
            const pct = Math.round((row.sessions / totalSess) * 100);
            const cvr = row.sessions > 0 ? ((row.transactions / row.sessions) * 100).toFixed(2) : '0.00';
            const label = type === 'new' ? '신규 방문자' : '재방문자';
            const color = type === 'new' ? BRAND : '#6366f1';
            return (
              <div key={type} className="rounded-xl border bg-white border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold text-gray-800">{label}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium" style={{ backgroundColor: color }}>{pct}%</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-gray-400">세션 수</span><span className="text-lg font-bold text-gray-900">{row.sessions.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">사용자</span><span className="font-medium">{row.users.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">구매</span><span className="font-medium">{row.transactions}</span></div>
                  <div className="flex justify-between border-t pt-2 mt-1"><span className="text-gray-400">전환율</span>
                    <span className="font-bold text-sm" style={{ color }}>{cvr}%</span>
                  </div>
                </div>
                <div className="mt-3 h-1.5 bg-gray-100 rounded overflow-hidden">
                  <div className="h-full rounded" style={{ width: `${pct}%`, backgroundColor: color }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

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
  { id: 'traffic', label: '유입 분석' },
  { id: 'conversion', label: '전환 분석' },
  { id: 'sales', label: '판매 분석' },
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

  const { data: funnelData } = useQuery<GaFunnelData>({
    queryKey: ['admin-ga-funnel', apiRange],
    queryFn: () => fetchSection<GaFunnelData>('ga-funnel', secret, { range: apiRange }),
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
            : <DashboardTab data={dashboard} currency={dashboard.currency} range={range} ga={gaData || null} traffic={trafficData || null} funnel={funnelData || null} />
        )}
        {activeTab === 'traffic' && (
          <TrafficAnalysisTab ga={gaData || null} traffic={trafficData || null} />
        )}
        {activeTab === 'conversion' && (
          <ConversionAnalysisTab ga={gaData || null} />
        )}
        {activeTab === 'sales' && (
          isLoading || !dashboard
            ? <div className="flex items-center justify-center h-64 text-sm text-gray-400">데이터를 불러오는 중...</div>
            : <SalesAnalysisTab data={dashboard} currency={dashboard.currency} traffic={trafficData || null} />
        )}
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
