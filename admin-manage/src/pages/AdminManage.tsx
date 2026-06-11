import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import { toast } from 'sonner';

// ─── Types ───

type Range = 'today' | 'thisWeek' | 'thisMonth' | '7d' | '28d' | '90d' | 'custom';

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

interface GAOverview {
  configured: boolean;
  sessions?: number;
  totalUsers?: number;
  newUsers?: number;
  bounceRate?: number;
  avgEngagementTime?: number;
  conversionRate?: number;
  funnelSteps?: { name: string; count: number; rate: number }[];
  topChannels?: { channel: string; sessions: number }[];
  deviceBreakdown?: { device: string; sessions: number; percentage: number }[];
}

interface GAFunnel {
  configured: boolean;
  byDate?: { date: string; views: number; addToCart: number; checkout: number; purchases: number }[];
  bySource?: { source: string; medium: string; sessions: number; conversions: number; rate: number }[];
}

interface GABehavior {
  configured: boolean;
  topPages?: { path: string; views: number; sessions: number; bounceRate: number; avgTime: number }[];
  topEvents?: { name: string; count: number; users: number }[];
  deviceBreakdown?: { device: string; sessions: number; bounceRate: number; avgTime: number; percentage: number }[];
  topLandingPages?: { path: string; sessions: number; bounceRate: number }[];
}


interface MetaOverview {
  configured: boolean;
  error?: boolean;
  spend?: number;
  impressions?: number;
  clicks?: number;
  reach?: number;
  ctr?: number;
  cpc?: number;
  purchases?: number;
  purchaseValue?: number;
  roas?: number;
  pixelFunnel?: { name: string; label: string; count: number; rate: number }[];
}

interface MetaCampaigns {
  configured: boolean;
  campaigns?: {
    name: string; spend: number; impressions: number; clicks: number;
    reach: number; ctr: number; cpc: number;
    purchases: number; purchaseValue: number; roas: number;
  }[];
}

interface GARetention {
  configured: boolean;
  breakdown?: {
    type: string;
    sessions: number;
    users: number;
    conversions: number;
    percentage: number;
    conversionRate: number;
  }[];
  trend?: { date: string; 신규: number; 재방문: number }[];
}

interface WeeklyReview {
  gaConfigured: boolean;
  currentWeek: {
    start: string; end: string; currency: string;
    revenue: number; orders: number;
    sessions: number; newUsers: number; conversions: number; conversionRate: number;
    daily: { date: string; revenue: number; orders: number }[];
  };
  previousWeek: {
    start: string; end: string; currency: string;
    revenue: number; orders: number;
    sessions: number; newUsers: number; conversions: number; conversionRate: number;
  };
  delta: {
    revenue: number | null; orders: number | null;
    sessions: number | null; newUsers: number | null; conversionRate: number | null;
  };
}

// ─── Helpers ───

const BRAND = '#f85a24';
const RANGE_LABELS: Record<Range, string> = {
  today: '오늘', thisWeek: '이번주', thisMonth: '이번달',
  '7d': '7일', '28d': '28일', '90d': '90일', custom: '기간 선택',
};
const DEVICE_COLORS: Record<string, string> = { mobile: BRAND, desktop: '#64748b', tablet: '#fdb997' };

function fmtMoney(v: number, currency = 'USD') {
  if (currency === 'JPY') return `¥${Math.round(v).toLocaleString('ja-JP')}`;
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtSec(s: number) {
  if (s < 60) return `${s}초`;
  return `${Math.floor(s / 60)}분 ${s % 60}초`;
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
          <p className="text-sm text-gray-500 mt-1">Admin Dashboard · Global</p>
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

function KpiSkeleton({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 animate-pulse">
      <p className="text-xs text-gray-500 mb-2">{label}</p>
      <div className="h-8 bg-gray-100 rounded-md w-3/4" />
    </div>
  );
}

function GANotConfigured({ title }: { title?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 flex flex-col items-center justify-center py-10">
      {title && <p className="text-xs font-semibold text-gray-400 mb-1">{title}</p>}
      <p className="text-xs text-gray-400">GA4 미연동 — <code className="bg-gray-100 px-1 py-0.5 rounded text-[11px]">GA4_PROPERTY_ID</code> · <code className="bg-gray-100 px-1 py-0.5 rounded text-[11px]">GA_SERVICE_ACCOUNT_JSON</code> 환경변수 설정 필요</p>
    </div>
  );
}

const META_BLUE = '#1877F2';

function MetaNotConfigured({ title }: { title?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 flex flex-col items-center justify-center py-10">
      {title && <p className="text-xs font-semibold text-gray-400 mb-1">{title}</p>}
      <p className="text-xs text-gray-400">Meta 미연동 — <code className="bg-gray-100 px-1 py-0.5 rounded text-[11px]">META_ACCESS_TOKEN</code> · <code className="bg-gray-100 px-1 py-0.5 rounded text-[11px]">META_AD_ACCOUNT_ID</code> · <code className="bg-gray-100 px-1 py-0.5 rounded text-[11px]">META_PIXEL_ID</code> 환경변수 설정 필요</p>
    </div>
  );
}

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="text-gray-400 text-xs">—</span>;
  const isPos = value > 0;
  const isNeg = value < 0;
  return (
    <span className={`text-xs font-semibold ${isPos ? 'text-emerald-600' : isNeg ? 'text-red-500' : 'text-gray-400'}`}>
      {isPos ? '↑' : isNeg ? '↓' : '→'} {Math.abs(value)}%
    </span>
  );
}

// ─── Meta: KPI Section ───

function MetaKpiSection({ secret, dateParams }: { secret: string; dateParams: Record<string, string> }) {
  const { data, isLoading } = useQuery<MetaOverview>({
    queryKey: ['meta-overview', dateParams],
    queryFn: () => fetchSection<MetaOverview>('meta-overview', secret, dateParams),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {['광고비', '노출', '클릭', '구매', 'ROAS'].map(l => <KpiSkeleton key={l} label={l} />)}
      </div>
    );
  }

  if (!data?.configured) return <MetaNotConfigured title="Meta 광고 지표" />;
  if (data.error) return <MetaNotConfigured title="Meta API 오류 — 토큰 만료 여부 확인 필요" />;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
          <p className="text-xs text-gray-500 mb-1">총 광고비</p>
          <p className="text-2xl font-bold tracking-tight" style={{ color: META_BLUE }}>
            ${(data.spend ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <KpiCard label="노출" value={(data.impressions ?? 0).toLocaleString()} sub={`도달 ${(data.reach ?? 0).toLocaleString()}`} />
        <KpiCard label="클릭" value={(data.clicks ?? 0).toLocaleString()} sub={`CTR ${data.ctr ?? 0}%`} />
        <KpiCard label="구매 전환" value={`${data.purchases ?? 0}건`} sub={`$${(data.purchaseValue ?? 0).toFixed(2)}`} />
        <KpiCard label="ROAS" value={`${data.roas ?? 0}x`} sub={`CPC $${data.cpc ?? 0}`} accent />
      </div>
    </div>
  );
}

// ─── Meta: Pixel Funnel ───

function MetaPixelFunnel({ secret, dateParams }: { secret: string; dateParams: Record<string, string> }) {
  const { data, isLoading } = useQuery<MetaOverview>({
    queryKey: ['meta-overview', dateParams],
    queryFn: () => fetchSection<MetaOverview>('meta-overview', secret, dateParams),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <div className="rounded-xl border border-gray-200 bg-white animate-pulse h-48" />;
  if (!data?.configured || data.error) return <MetaNotConfigured title="Meta Pixel 퍼널" />;

  const steps = data.pixelFunnel || [];
  const maxCount = steps[0]?.count || 1;

  return (
    <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: META_BLUE }} />
        <h3 className="text-sm font-semibold text-gray-900">Meta Pixel 퍼널</h3>
        <p className="text-xs text-gray-400 ml-1">Pixel 이벤트 기반</p>
      </div>
      <div className="p-4 space-y-2.5">
        {steps.map((step, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-700 font-medium">{step.label}</span>
              <div className="flex items-center gap-2">
                {i > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 font-medium" style={{ color: META_BLUE }}>
                    {step.rate}%
                  </span>
                )}
                <span className="font-semibold text-gray-900">{step.count.toLocaleString()}</span>
              </div>
            </div>
            <div className="h-5 bg-gray-100 rounded-md overflow-hidden">
              <div
                className="h-full rounded-md transition-all duration-700"
                style={{
                  width: `${maxCount > 0 ? (step.count / maxCount) * 100 : 0}%`,
                  backgroundColor: META_BLUE,
                  opacity: 1 - i * 0.15,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Meta: Campaigns Table ───

function MetaCampaignsTable({ secret, dateParams }: { secret: string; dateParams: Record<string, string> }) {
  const { data, isLoading } = useQuery<MetaCampaigns>({
    queryKey: ['meta-campaigns', dateParams],
    queryFn: () => fetchSection<MetaCampaigns>('meta-campaigns', secret, dateParams),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <div className="rounded-xl border border-gray-200 bg-white animate-pulse h-40" />;
  if (!data?.configured) return <MetaNotConfigured title="Meta 캠페인 데이터" />;

  const campaigns = data.campaigns || [];
  if (campaigns.length === 0) return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-xs text-gray-400">집계된 캠페인 없음</div>
  );

  return (
    <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: META_BLUE }} />
        <h3 className="text-sm font-semibold text-gray-900">캠페인별 성과</h3>
      </div>
      <div className="overflow-x-auto max-h-72 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-white border-b">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-gray-400">캠페인</th>
              <th className="text-right px-4 py-2 font-medium text-gray-400">광고비</th>
              <th className="text-right px-4 py-2 font-medium text-gray-400">노출</th>
              <th className="text-right px-4 py-2 font-medium text-gray-400">클릭</th>
              <th className="text-right px-4 py-2 font-medium text-gray-400">CTR</th>
              <th className="text-right px-4 py-2 font-medium text-gray-400">구매</th>
              <th className="text-right px-4 py-2 font-medium text-gray-400">ROAS</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-2.5 max-w-[200px] truncate font-medium">{c.name}</td>
                <td className="px-4 py-2.5 text-right">${c.spend.toFixed(2)}</td>
                <td className="px-4 py-2.5 text-right">{c.impressions.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right">{c.clicks.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right">{c.ctr}%</td>
                <td className="px-4 py-2.5 text-right">{c.purchases}건</td>
                <td className="px-4 py-2.5 text-right">
                  <span className={`font-semibold ${c.roas >= 3 ? 'text-emerald-600' : c.roas >= 1 ? 'text-orange-500' : 'text-gray-500'}`}>
                    {c.roas}x
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

function TimelineTable({ dailyOrders, currency, gaData }: {
  dailyOrders: DashboardData['dailyOrders'];
  currency: string;
  gaData?: GAOverview | null;
}) {
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

  const gaAvailableSessions = gaData?.configured && gaData.sessions != null;
  const gaAvailableUsers = gaData?.configured && gaData.totalUsers != null;

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
              <th className="text-right px-4 py-2 font-medium text-gray-400">총 유저</th>
              <th className="text-right px-4 py-2 font-medium text-gray-400">세션</th>
              <th className="text-right px-4 py-2 font-medium text-gray-400">주문 수</th>
              <th className="text-right px-4 py-2 font-medium text-gray-400">매출</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-2 font-mono">{row.label}</td>
                <td className="px-4 py-2 text-right text-gray-300">
                  {i === 0 && gaAvailableUsers ? gaData!.totalUsers!.toLocaleString() : '—'}
                </td>
                <td className="px-4 py-2 text-right text-gray-300">
                  {i === 0 && gaAvailableSessions ? gaData!.sessions!.toLocaleString() : '—'}
                </td>
                <td className="px-4 py-2 text-right">{row.orders > 0 ? `${row.orders}건` : '—'}</td>
                <td className="px-4 py-2 text-right font-medium">{row.revenue > 0 ? fmtMoney(row.revenue, currency) : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0 bg-white border-t">
            <tr>
              <td className="px-4 py-2 font-semibold text-xs">합계</td>
              <td className="px-4 py-2 text-right font-semibold">
                {gaAvailableUsers ? gaData!.totalUsers!.toLocaleString() : '—'}
              </td>
              <td className="px-4 py-2 text-right font-semibold">
                {gaAvailableSessions ? gaData!.sessions!.toLocaleString() : '—'}
              </td>
              <td className="px-4 py-2 text-right font-semibold">{totals.orders}건</td>
              <td className="px-4 py-2 text-right font-semibold">{fmtMoney(totals.revenue, currency)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── GA: Funnel Mini Chart ───

function GAFunnelMini({ steps }: { steps: GAOverview['funnelSteps'] }) {
  if (!steps || steps.length === 0) return null;
  const maxCount = steps[0].count || 1;

  return (
    <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">EC 구매 퍼널</h3>
        <p className="text-xs text-gray-400">GA4 이벤트 기반</p>
      </div>
      <div className="p-4 space-y-2.5">
        {steps.map((step, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-700 font-medium">{step.name}</span>
              <div className="flex items-center gap-2">
                {i > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-600 font-medium">
                    {(step.rate * 100).toFixed(1)}%
                  </span>
                )}
                <span className="font-semibold text-gray-900">{step.count.toLocaleString()}</span>
              </div>
            </div>
            <div className="h-5 bg-gray-100 rounded-md overflow-hidden">
              <div
                className="h-full rounded-md transition-all duration-700"
                style={{
                  width: `${(step.count / maxCount) * 100}%`,
                  backgroundColor: BRAND,
                  opacity: 1 - i * 0.18,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── GA: Top Channels ───

function GAChannelsBar({ channels }: { channels: GAOverview['topChannels'] }) {
  if (!channels || channels.length === 0) return null;
  const max = channels[0].sessions || 1;

  return (
    <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">유입 채널</h3>
      </div>
      <div className="p-4 space-y-2.5">
        {channels.map((ch, i) => (
          <div key={i} className="flex items-center gap-3 text-xs">
            <span className="w-28 truncate text-gray-600 shrink-0">{ch.channel}</span>
            <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${(ch.sessions / max) * 100}%`, backgroundColor: BRAND, opacity: 0.7 }}
              />
            </div>
            <span className="font-medium text-right w-14">{ch.sessions.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── GA: Device Pie ───

function GADevicePie({ devices }: { devices: GAOverview['deviceBreakdown'] }) {
  if (!devices || devices.length === 0) return null;
  const getColor = (d: string) => DEVICE_COLORS[d.toLowerCase()] || '#94a3b8';

  return (
    <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">디바이스</h3>
      </div>
      <div className="p-4 flex items-center gap-4">
        <PieChart width={120} height={120}>
          <Pie data={devices} dataKey="sessions" cx={55} cy={55} innerRadius={28} outerRadius={50} paddingAngle={2}>
            {devices.map((d, i) => <Cell key={i} fill={getColor(d.device)} />)}
          </Pie>
        </PieChart>
        <div className="flex-1 space-y-2">
          {devices.map((d, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getColor(d.device) }} />
                <span className="capitalize">{d.device}</span>
              </div>
              <div className="text-right">
                <span className="font-medium">{d.sessions.toLocaleString()}</span>
                <span className="text-gray-400 ml-1">{d.percentage}%</span>
              </div>
            </div>
          ))}
        </div>
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

function DashboardTab({ data, currency, rangeLabel, secret, dateParams }: {
  data: DashboardData; currency: string; rangeLabel: string; secret: string;
  dateParams: Record<string, string>;
}) {
  const { summary, b2b, b2c, dailyOrders, topProducts, lowStock } = data;

  const { data: gaData, isLoading: gaLoading } = useQuery<GAOverview>({
    queryKey: ['ga-overview', dateParams],
    queryFn: () => fetchSection<GAOverview>('ga-overview', secret, dateParams),
    staleTime: 5 * 60 * 1000,
  });

  const gaOk = gaData?.configured;

  return (
    <div className="space-y-5">
      <SectionLabel>핵심 지표</SectionLabel>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="총 매출" value={fmtMoney(summary.totalRevenue, currency)} accent />
        <KpiCard label="주문 수" value={`${summary.totalOrders.toLocaleString()}건`} accent />
        <KpiCard label="평균 주문금액" value={fmtMoney(summary.averageOrderValue, currency)} accent />
        {gaLoading
          ? <KpiSkeleton label="구매 전환율" />
          : gaOk
            ? <KpiCard label="구매 전환율" value={`${gaData!.conversionRate}%`} sub={`${gaData!.sessions!.toLocaleString()} 세션`} />
            : <GANotConfigured title="구매 전환율" />
        }
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ChannelCard label="도매" badge="B2B" badgeCls="bg-blue-100 text-blue-700" ch={b2b} currency={currency} />
        <ChannelCard label="소매" badge="B2C" badgeCls="bg-orange-100 text-orange-700" ch={b2c} currency={currency} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {gaLoading ? (
          <>
            <KpiSkeleton label="세션" />
            <KpiSkeleton label="유저" />
            <KpiSkeleton label="이탈률" />
            <KpiSkeleton label="평균 체류 시간" />
          </>
        ) : gaOk ? (
          <>
            <KpiCard label="세션" value={gaData!.sessions!.toLocaleString()} sub={`신규 ${gaData!.newUsers!.toLocaleString()}명`} />
            <KpiCard label="유저" value={gaData!.totalUsers!.toLocaleString()} />
            <KpiCard label="이탈률" value={`${gaData!.bounceRate}%`} />
            <KpiCard label="평균 체류 시간" value={fmtSec(gaData!.avgEngagementTime!)} />
          </>
        ) : (
          <div className="col-span-4">
            <GANotConfigured title="세션 · 유저 · 이탈률 · 체류시간 (GA4 미연동)" />
          </div>
        )}
      </div>

      {dailyOrders.length > 0 && (
        <>
          <CombinedChart dailyOrders={dailyOrders} currency={currency} />
          <TimelineTable dailyOrders={dailyOrders} currency={currency} gaData={gaData} />
        </>
      )}

      <SectionLabel>전환 · 상품</SectionLabel>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2">
          {gaLoading ? (
            <div className="rounded-xl border border-gray-200 bg-white p-4 animate-pulse h-48" />
          ) : gaOk && gaData!.funnelSteps?.length ? (
            <GAFunnelMini steps={gaData!.funnelSteps!} />
          ) : (
            <GANotConfigured title="EC 퍼널" />
          )}
        </div>
        <div className="lg:col-span-3">
          <TopProductsTable data={topProducts} currency={currency} />
        </div>
      </div>

      <SectionLabel>트래픽 · 디바이스</SectionLabel>
      {gaLoading ? (
        <div className="rounded-xl border border-gray-200 bg-white animate-pulse h-32" />
      ) : gaOk ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <GAChannelsBar channels={gaData!.topChannels!} />
          <GADevicePie devices={gaData!.deviceBreakdown!} />
        </div>
      ) : (
        <GANotConfigured title="유입 채널 · 디바이스 분석" />
      )}

      <SectionLabel>운영 현황</SectionLabel>
      <OperationsPanel lowStock={lowStock} topProducts={topProducts} currency={currency} />

      <p className="text-center text-xs text-gray-400 pb-4">
        Shopify: biteme-one &middot; {rangeLabel} 데이터
        {gaOk && ' · GA4 연동'}
      </p>
    </div>
  );
}

// ─── 퍼널 분석 Tab ───

function FunnelTab({ secret, dateParams }: { secret: string; dateParams: Record<string, string> }) {
  const { data, isLoading } = useQuery<GAFunnel>({
    queryKey: ['ga-funnel', dateParams],
    queryFn: () => fetchSection<GAFunnel>('ga-funnel', secret, dateParams),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="space-y-5">
      <SectionLabel>퍼널 이벤트 추이 (GA4)</SectionLabel>
      {isLoading ? (
        <div className="rounded-xl border border-gray-200 bg-white animate-pulse h-48" />
      ) : !data?.configured ? (
        <GANotConfigured title="GA4 이벤트 기반 퍼널 분석" />
      ) : data.byDate && data.byDate.length > 0 ? (
        <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">일자별 퍼널 이벤트</h3>
            <p className="text-xs text-gray-400">view_item → add_to_cart → begin_checkout → purchase</p>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data.byDate} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={40} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="views" name="PDP 조회" stroke="#e2e8f0" fill="#e2e8f0" strokeWidth={1.5} />
                <Area type="monotone" dataKey="addToCart" name="장바구니" stroke="#fdb997" fill="#fdb997" strokeWidth={1.5} />
                <Area type="monotone" dataKey="checkout" name="결제 시작" stroke="#fb8c5a" fill="#fb8c5a" strokeWidth={1.5} />
                <Area type="monotone" dataKey="purchases" name="구매 완료" stroke={BRAND} fill={BRAND} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <GANotConfigured title="퍼널 이벤트 데이터 없음" />
      )}

      <SectionLabel>소스 · 매체별 전환율 (GA4)</SectionLabel>
      {data?.bySource && data.bySource.length > 0 ? (
        <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">소스 / 매체별 전환율</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-400">소스</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-400">매체</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-400">세션</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-400">전환</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-400">전환율</th>
                </tr>
              </thead>
              <tbody>
                {data.bySource.map((row, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-2.5 font-medium">{row.source || '(direct)'}</td>
                    <td className="px-4 py-2.5 text-gray-500">{row.medium || '(none)'}</td>
                    <td className="px-4 py-2.5 text-right">{row.sessions.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right">{row.conversions.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`font-semibold ${row.rate > 3 ? 'text-emerald-600' : row.rate > 1 ? 'text-orange-500' : 'text-gray-500'}`}>
                        {row.rate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <GANotConfigured title="소스/매체 전환 데이터 없음" />
      )}

      <SectionLabel>Meta Pixel 퍼널 · 광고 성과</SectionLabel>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MetaPixelFunnel secret={secret} dateParams={dateParams} />
        <MetaCampaignsTable secret={secret} dateParams={dateParams} />
      </div>
    </div>
  );
}

// ─── 행동 분석 Tab ───

function BehaviorTab({ secret, dateParams }: { secret: string; dateParams: Record<string, string> }) {
  const { data, isLoading } = useQuery<GABehavior>({
    queryKey: ['ga-behavior', dateParams],
    queryFn: () => fetchSection<GABehavior>('ga-behavior', secret, dateParams),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return <div className="flex justify-center py-16 text-sm text-gray-400">행동 데이터 로딩 중...</div>;
  }

  if (!data?.configured) {
    return (
      <div className="space-y-5">
        <SectionLabel>행동 분석</SectionLabel>
        <GANotConfigured title="GA4 행동 분석" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SectionLabel>페이지 분석</SectionLabel>
      {data.topPages && data.topPages.length > 0 ? (
        <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">상위 페이지</h3>
          </div>
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-400">페이지 경로</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-400">조회수</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-400">세션</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-400">이탈률</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-400">체류시간</th>
                </tr>
              </thead>
              <tbody>
                {data.topPages.map((row, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-[11px] max-w-[280px] truncate">{row.path}</td>
                    <td className="px-4 py-2.5 text-right">{row.views.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right">{row.sessions.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={row.bounceRate > 60 ? 'text-red-500' : row.bounceRate > 40 ? 'text-orange-400' : 'text-emerald-600'}>
                        {row.bounceRate}%
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{fmtSec(row.avgTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : <GANotConfigured title="페이지 데이터 없음" />}

      <SectionLabel>이벤트 · 디바이스</SectionLabel>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data.topEvents && data.topEvents.length > 0 ? (
          <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">상위 이벤트</h3>
            </div>
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white border-b">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-400">이벤트</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-400">횟수</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-400">유저</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topEvents.map((ev, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-[11px]">{ev.name}</td>
                      <td className="px-4 py-2.5 text-right font-medium">{ev.count.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{ev.users.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : <GANotConfigured title="이벤트 데이터 없음" />}

        {data.deviceBreakdown && data.deviceBreakdown.length > 0 ? (
          <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">디바이스별 세션</h3>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-4">
                <PieChart width={130} height={130}>
                  <Pie data={data.deviceBreakdown} dataKey="sessions" cx={60} cy={60} innerRadius={32} outerRadius={55} paddingAngle={2}>
                    {data.deviceBreakdown.map((d, i) => (
                      <Cell key={i} fill={DEVICE_COLORS[d.device.toLowerCase()] || '#94a3b8'} />
                    ))}
                  </Pie>
                </PieChart>
                <div className="flex-1 space-y-2.5 text-xs">
                  {data.deviceBreakdown.map((d, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: DEVICE_COLORS[d.device.toLowerCase()] || '#94a3b8' }} />
                          <span className="capitalize font-medium">{d.device}</span>
                        </div>
                        <span>{d.sessions.toLocaleString()} ({d.percentage}%)</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-gray-400">
                        <span>이탈 {d.bounceRate}%</span>
                        <span>·</span>
                        <span>체류 {fmtSec(d.avgTime)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : <GANotConfigured title="디바이스 데이터 없음" />}
      </div>

      <SectionLabel>랜딩 페이지</SectionLabel>
      {data.topLandingPages && data.topLandingPages.length > 0 ? (
        <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">상위 랜딩 페이지</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-400">경로</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-400">세션</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-400">이탈률</th>
                </tr>
              </thead>
              <tbody>
                {data.topLandingPages.map((row, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-[11px] max-w-[320px] truncate">{row.path}</td>
                    <td className="px-4 py-2.5 text-right">{row.sessions.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={row.bounceRate > 60 ? 'text-red-500' : row.bounceRate > 40 ? 'text-orange-400' : 'text-emerald-600'}>
                        {row.bounceRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : <GANotConfigured title="랜딩 페이지 데이터 없음" />}
    </div>
  );
}

// ─── 회원 분석 Tab ───

function CustomerTab({ secret, dateParams }: { secret: string; dateParams: Record<string, string> }) {
  const [tab, setTab] = useState('top');

  const { data, isLoading } = useQuery<CustomerSummary>({
    queryKey: ['admin-customers'],
    queryFn: () => fetchSection<CustomerSummary>('customers', secret, { view: 'all' }),
    staleTime: 60_000,
  });

  const { data: retentionData } = useQuery<GARetention>({
    queryKey: ['ga-retention', dateParams],
    queryFn: () => fetchSection<GARetention>('ga-retention', secret, dateParams),
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
      {retentionData?.configured ? (
        <div className="space-y-4">
          {retentionData.breakdown && retentionData.breakdown.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900">신규 vs 재방문</h3>
                  <p className="text-xs text-gray-400">세션 기준 비율</p>
                </div>
                <div className="p-4 flex items-center gap-4">
                  <PieChart width={130} height={130}>
                    <Pie data={retentionData.breakdown} dataKey="sessions" cx={60} cy={60} innerRadius={34} outerRadius={56} paddingAngle={2}>
                      {retentionData.breakdown.map((d, i) => (
                        <Cell key={i} fill={d.type === '신규' ? BRAND : '#64748b'} />
                      ))}
                    </Pie>
                  </PieChart>
                  <div className="flex-1 space-y-3 text-xs">
                    {retentionData.breakdown.map((d, i) => (
                      <div key={i} className="space-y-0.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.type === '신규' ? BRAND : '#64748b' }} />
                            <span className="font-medium">{d.type}</span>
                          </div>
                          <span className="font-semibold">{d.percentage}%</span>
                        </div>
                        <div className="flex justify-between text-gray-400 text-[11px] pl-4">
                          <span>세션 {d.sessions.toLocaleString()}</span>
                          <span>전환율 {d.conversionRate}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 rounded-xl border bg-white border-gray-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900">신규 · 재방문 세션 추이</h3>
                </div>
                <div className="p-4">
                  <ResponsiveContainer width="100%" height={160}>
                    <ComposedChart data={retentionData.trend} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} width={36} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="신규" stackId="a" fill={BRAND} opacity={0.85} radius={[0, 0, 0, 0]} />
                      <Bar dataKey="재방문" stackId="a" fill="#64748b" opacity={0.7} radius={[3, 3, 0, 0]} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {retentionData.breakdown && retentionData.breakdown.length > 0 && (
            <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">신규 vs 재방문 상세</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left px-5 py-2.5 font-medium text-gray-400">유형</th>
                      <th className="text-right px-5 py-2.5 font-medium text-gray-400">세션</th>
                      <th className="text-right px-5 py-2.5 font-medium text-gray-400">유저</th>
                      <th className="text-right px-5 py-2.5 font-medium text-gray-400">전환</th>
                      <th className="text-right px-5 py-2.5 font-medium text-gray-400">전환율</th>
                      <th className="text-right px-5 py-2.5 font-medium text-gray-400">비율</th>
                    </tr>
                  </thead>
                  <tbody>
                    {retentionData.breakdown.map((d, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.type === '신규' ? BRAND : '#64748b' }} />
                            <span className="font-medium">{d.type} 유저</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right">{d.sessions.toLocaleString()}</td>
                        <td className="px-5 py-3 text-right">{d.users.toLocaleString()}</td>
                        <td className="px-5 py-3 text-right">{d.conversions.toLocaleString()}</td>
                        <td className="px-5 py-3 text-right">
                          <span className={`font-semibold ${d.conversionRate > 3 ? 'text-emerald-600' : d.conversionRate > 1 ? 'text-orange-500' : 'text-gray-500'}`}>
                            {d.conversionRate}%
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right font-medium">{d.percentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <GANotConfigured title="신규 vs 재방문 유저 — GA4 연동 후 활성화" />
      )}

      <p className="text-center text-xs text-gray-400 pb-4">
        Shopify: biteme-one &middot; 회원 데이터
      </p>
    </div>
  );
}

// ─── 주간회고 Tab ───

function WeeklyReviewTab({ secret }: { secret: string }) {
  const { data, isLoading, isError } = useQuery<WeeklyReview>({
    queryKey: ['ga-weekly'],
    queryFn: () => fetchSection<WeeklyReview>('ga-weekly', secret),
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading) {
    return <div className="flex justify-center py-16 text-sm text-gray-400">주간 데이터 집계 중...</div>;
  }

  if (isError || !data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        주간 데이터를 불러오지 못했습니다.
      </div>
    );
  }

  const { currentWeek: cw, previousWeek: pw, delta } = data;

  const kpis = [
    { label: '매출', cur: fmtMoney(cw.revenue, cw.currency), prev: fmtMoney(pw.revenue, pw.currency), delta: delta.revenue },
    { label: '주문 수', cur: `${cw.orders}건`, prev: `${pw.orders}건`, delta: delta.orders },
    { label: '세션', cur: cw.sessions > 0 ? cw.sessions.toLocaleString() : '—', prev: pw.sessions > 0 ? pw.sessions.toLocaleString() : '—', delta: delta.sessions },
    { label: '신규 유저', cur: cw.newUsers > 0 ? `${cw.newUsers.toLocaleString()}명` : '—', prev: pw.newUsers > 0 ? `${pw.newUsers.toLocaleString()}명` : '—', delta: delta.newUsers },
    { label: '전환율', cur: cw.conversionRate > 0 ? `${cw.conversionRate}%` : '—', prev: pw.conversionRate > 0 ? `${pw.conversionRate}%` : '—', delta: delta.conversionRate },
  ];

  return (
    <div className="space-y-5">
      <SectionLabel>주간 비교</SectionLabel>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-orange-200 bg-orange-50/30 p-4">
          <p className="text-xs font-semibold text-orange-600 mb-1">이번 주</p>
          <p className="text-[11px] text-gray-500">{cw.start} ~ {cw.end}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold text-gray-500 mb-1">지난 주</p>
          <p className="text-[11px] text-gray-400">{pw.start} ~ {pw.end}</p>
        </div>
      </div>

      <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">KPI 비교</h3>
          {!data.gaConfigured && (
            <p className="text-[11px] text-orange-500 mt-0.5">GA4 미연동 — 세션·유저·전환율은 Shopify 데이터만 표시</p>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-400">지표</th>
                <th className="text-right px-5 py-3 font-medium" style={{ color: BRAND }}>이번 주</th>
                <th className="text-right px-5 py-3 font-medium text-gray-400">지난 주</th>
                <th className="text-right px-5 py-3 font-medium text-gray-400">증감</th>
              </tr>
            </thead>
            <tbody>
              {kpis.map((kpi, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-700">{kpi.label}</td>
                  <td className="px-5 py-3.5 text-right font-bold text-gray-900">{kpi.cur}</td>
                  <td className="px-5 py-3.5 text-right text-gray-400">{kpi.prev}</td>
                  <td className="px-5 py-3.5 text-right"><Delta value={kpi.delta} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {cw.daily && cw.daily.length > 0 && (
        <>
          <SectionLabel>이번 주 일별 매출</SectionLabel>
          <div className="rounded-xl border bg-white border-gray-200 overflow-hidden">
            <div className="p-4">
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart
                  data={cw.daily.map(d => ({ date: isoToLabel(d.date), revenue: d.revenue, orders: d.orders }))}
                  margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="rev" tick={{ fontSize: 10 }}
                    tickFormatter={v => `$${v.toFixed(0)}`} width={48} />
                  <YAxis yAxisId="orders" orientation="right" tick={{ fontSize: 10 }} width={32} />
                  <Tooltip formatter={(value, name) => {
                    if (name === 'revenue') return [fmtMoney(Number(value), cw.currency), '매출'];
                    return [Number(value), '주문'];
                  }} />
                  <Bar yAxisId="rev" dataKey="revenue" fill={BRAND} opacity={0.3} radius={[3, 3, 0, 0]} />
                  <Line yAxisId="orders" type="monotone" dataKey="orders" stroke={BRAND} strokeWidth={2.5} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      <p className="text-center text-xs text-gray-400 pb-4">
        Shopify: biteme-one · 주간 회고 데이터
        {data.gaConfigured && ' · GA4 연동'}
      </p>
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
  const [showDatePicker, setShowDatePicker] = useState(false);

  const todayISO = localISO(new Date());
  const rangeLabel = range === 'custom' && customStart && customEnd
    ? `${customStart} ~ ${customEnd}`
    : RANGE_LABELS[range];

  const dateParams: Record<string, string> = range === 'custom'
    ? { start: customStart, end: customEnd }
    : { range };

  const { data: dashboard, isLoading, isError, error, refetch } = useQuery<DashboardData>({
    queryKey: ['admin-dashboard', dateParams],
    queryFn: () => fetchSection<DashboardData>('dashboard', secret, dateParams),
    staleTime: 5 * 60 * 1000,
    enabled: range !== 'custom' || (customStart !== '' && customEnd !== ''),
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
            <span className="text-xs text-gray-400">Analytics · Global</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-lg border bg-white overflow-hidden text-xs">
              {(['today', 'thisWeek', 'thisMonth', '7d', '28d', '90d'] as Range[]).map(r => (
                <button key={r} onClick={() => { setRange(r); setShowDatePicker(false); }}
                  className={`px-3 py-1.5 transition-colors ${range === r ? 'text-white font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                  style={range === r ? { backgroundColor: BRAND } : {}}>
                  {RANGE_LABELS[r]}
                </button>
              ))}
            </div>
            <div className="relative">
              <button onClick={() => setShowDatePicker(!showDatePicker)}
                className={`px-3 py-1.5 rounded-lg border text-xs transition-colors flex items-center gap-1 ${range === 'custom' ? 'text-white font-medium border-transparent' : 'text-gray-500 hover:text-gray-700'}`}
                style={range === 'custom' ? { backgroundColor: BRAND } : {}}>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                {range === 'custom' && customStart && customEnd
                  ? `${customStart.slice(5)} ~ ${customEnd.slice(5)}`
                  : '기간 선택'}
              </button>
              {showDatePicker && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowDatePicker(false)} />
                  <div className="absolute right-0 top-full mt-2 bg-white border rounded-xl shadow-lg p-4 z-20 w-72">
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">시작일</label>
                        <input type="date" value={customStart} max={customEnd || todayISO}
                          onChange={e => setCustomStart(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">종료일</label>
                        <input type="date" value={customEnd} min={customStart} max={todayISO}
                          onChange={e => setCustomEnd(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200" />
                      </div>
                      <button onClick={() => {
                        if (customStart && customEnd && customStart <= customEnd) {
                          setRange('custom');
                          setShowDatePicker(false);
                        }
                      }}
                        disabled={!customStart || !customEnd || customStart > customEnd}
                        className="w-full py-2 rounded-lg text-xs font-medium text-white transition-opacity disabled:opacity-40"
                        style={{ backgroundColor: BRAND }}>
                        적용
                      </button>
                    </div>
                  </div>
                </>
              )}
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
            : <DashboardTab data={dashboard} currency={dashboard.currency} rangeLabel={rangeLabel} secret={secret} dateParams={dateParams} />
        )}
        {activeTab === 'funnel' && <FunnelTab secret={secret} dateParams={dateParams} />}
        {activeTab === 'behavior' && <BehaviorTab secret={secret} dateParams={dateParams} />}
        {activeTab === 'members' && <CustomerTab secret={secret} dateParams={dateParams} />}
        {activeTab === 'review' && <WeeklyReviewTab secret={secret} />}
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

