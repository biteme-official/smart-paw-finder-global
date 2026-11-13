import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import {
  Ban, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, Copy, DollarSign, Handshake, Loader2,
  MousePointer2, MousePointerClick, Percent, RefreshCw, ShoppingBag, UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { B2C_SITE_URL } from '@/lib/site';
import { fetchProductsByHandles } from '@/lib/shopify';
import { ManagePageHeader, useManageAuth } from '@/components/admin/ManageLayout';

// B2C 어필리에이트 관리자 (biteme.one /manage/affiliate) — 조이 님 11/4 목업 ①~⑤.
// ⑥ 정산: 주문 + N일 자동 확정 → 지난달 확정분을 이번 달 말 지급(Mark as paid). 날짜는 모두 KST.

// ─── 타입 (api/affiliate-program.ts 응답) ─────────────────────────────────────

type PartnerStatus = 'active' | 'suspended' | 'removed';
type CommissionStatus = 'pending' | 'confirmed' | 'paid' | 'excluded' | 'void';

interface Order {
  orderId: string;
  orderName: string;
  createdAt: string;
  code: string;
  handle: string | null;
  guest?: boolean;
  baseAmount: number;
  rate: number;
  commission: number;
  status: CommissionStatus;
  reason: string | null;
  manualVoid: boolean;
  history: { at: string; change: string }[];
  partnerName?: string;
  confirmedAt?: string | null;
  paidAt?: string | null;
  paidAmount?: number | null;
  clawback?: number;
}

interface PartnerRow {
  code: string;
  name: string;
  email: string;
  country: string | null;
  status: PartnerStatus;
  joinedAt: string;
  paypalEmail: string | null;
  clicks: number;
  copies: number;
  orders: number;
  sales: number;
  commission: number;
}

interface Summary {
  range: { from: string; to: string };
  confirmDays: number;
  totals: {
    gmv: number; orders: number; commission: number; pendingCommission: number; confirmedCommission: number;
    clicks: number; copies: number; conversion: number;
    partners: number; newPartners: number; clickingPartners: number; excluded: number; excludedAmount: number; void: number;
  };
  daily: { date: string; gmv: number; orders: number; commission: number; clicks: number }[];
}

interface PartnerDetail {
  partner: PartnerRow & { consent: { at: string }; statusHistory: { at: string; from: PartnerStatus; to: PartnerStatus }[] };
  performance: { clicks: number; copies: number; orders: number; sales: number; commission: number };
  links: { handle: string; clicks: number; copies: number; orders: number; commission: number }[];
  orders: Order[];
}

// ─── 기간 ─────────────────────────────────────────────────────────────────────

const kstToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
const kstDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
const shiftDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const fmtDay = (date: string, withYear = false) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' });

type Preset = 'this-month' | 'last-month' | '7d' | '30d' | 'custom';
const PRESETS: { key: Exclude<Preset, 'custom'>; label: string }[] = [
  { key: 'this-month', label: 'This month' },
  { key: 'last-month', label: 'Last month' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
];

function presetRange(key: Exclude<Preset, 'custom'>) {
  const today = kstToday();
  const monthStart = `${today.slice(0, 7)}-01`;
  if (key === 'last-month') {
    const end = shiftDays(monthStart, -1);
    return { from: `${end.slice(0, 7)}-01`, to: end };
  }
  if (key === '7d') return { from: shiftDays(today, -6), to: today };
  if (key === '30d') return { from: shiftDays(today, -29), to: today };
  return { from: monthStart, to: today };
}

// ─── 표시 ─────────────────────────────────────────────────────────────────────

const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const approvesOn = (createdAt: string, days: number) => shiftDays(kstDate(createdAt), days);
const maskEmail = (email: string | null) => {
  if (!email) return '';
  const [u, d] = email.split('@');
  return d ? `${u.slice(0, 2)}${'*'.repeat(Math.max(u.length - 2, 3))}@${d}` : email;
};

const REASON_LABEL: Record<string, string> = {
  self: 'Self-purchase', b2b: 'B2B', 'partner-suspended': 'Partner suspended', cancelled: 'Cancelled', manual: 'Voided',
};

// 정산: 지급 대상이 아닌 이유
type PayoutBlock = 'ready' | 'below-min' | 'no-paypal' | 'suspended' | 'removed';
const BLOCK_LABEL: Record<PayoutBlock, string> = {
  ready: 'Ready', 'below-min': '최소 금액 미만 · 이월', 'no-paypal': 'PayPal 없음 · 이월', suspended: '정지 · 보류', removed: '제거 · 보류',
};

interface PayoutRow {
  code: string; name: string; email: string; paypalEmail: string | null; status: PartnerStatus;
  orders: number; adjustments: number; adjustmentAmount: number; amount: number; block: PayoutBlock;
}

interface PayoutsData {
  period: string; payDate: string; minPayout: number; confirmDays: number;
  rows: PayoutRow[];
  payouts: { id: string; code: string; partnerName: string; period: string; amount: number; paypalEmail: string; paidAt: string; orderIds: string[] }[];
}

function StatusBadge({ order }: { order: Order }) {
  if (order.status === 'pending') {
    return <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Pending</span>;
  }
  if (order.status === 'confirmed') {
    return <span className="inline-flex rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700">Confirmed</span>;
  }
  if (order.status === 'paid') {
    return <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">Paid{order.clawback ? ` (차감 ${usd(order.clawback)})` : ''}</span>;
  }
  if (order.status === 'excluded') {
    return <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-semibold text-gray-600">Excluded ({REASON_LABEL[order.reason || ''] || order.reason})</span>;
  }
  return <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600">Void ({REASON_LABEL[order.reason || ''] || order.reason})</span>;
}

const PARTNER_STATUS_CLS: Record<PartnerStatus, string> = {
  active: 'border-green-200 bg-green-50 text-green-700',
  suspended: 'border-amber-200 bg-amber-50 text-amber-700',
  removed: 'border-gray-200 bg-gray-100 text-gray-500',
};
function PartnerBadge({ status }: { status: PartnerStatus }) {
  return (
    <span className={cn('inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize', PARTNER_STATUS_CLS[status])}>{status}</span>
  );
}

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn('rounded-2xl border bg-white p-5 md:p-6', className)}>{children}</section>;
}

function StatCard({ icon: Icon, tone, value, label, sub }: {
  icon: typeof UserPlus; tone: string; value: React.ReactNode; label: string; sub?: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border bg-white p-4">
      <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', tone)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xl font-bold leading-tight md:text-2xl">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}

// ─── API ──────────────────────────────────────────────────────────────────────

function useAdminApi() {
  const { adminKey, logout } = useManageAuth();
  return useCallback(async <T,>(action: string, opts: { query?: Record<string, string>; body?: unknown } = {}): Promise<T> => {
    const qs = new URLSearchParams({ action, ...(opts.query || {}) });
    const res = await fetch(`/api/affiliate-program?${qs}`, {
      method: opts.body !== undefined ? 'POST' : 'GET',
      headers: { 'x-admin-key': adminKey, ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    if (res.status === 401) {
      logout();
      throw new Error('Unauthorized');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
    return data as T;
  }, [adminKey, logout]);
}

// ─── 파트너 상세 ──────────────────────────────────────────────────────────────

function PartnerSheet({ code, range, confirmDays, onClose, onChanged }: {
  code: string | null; range: { from: string; to: string }; confirmDays: number; onClose: () => void; onChanged: () => void;
}) {
  const api = useAdminApi();
  const [confirm, setConfirm] = useState<PartnerStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['aff-admin-partner', code, range.from, range.to],
    queryFn: () => api<PartnerDetail>('admin-partner', { query: { code: code!, ...range } }),
    enabled: !!code,
  });
  const handles = (data?.links || []).map((l) => l.handle).filter((h) => h !== '_home');
  const { data: products } = useQuery({
    queryKey: ['aff-admin-products', handles.join(',')],
    queryFn: () => fetchProductsByHandles(handles),
    enabled: handles.length > 0,
    staleTime: 10 * 60 * 1000,
  });

  const changeStatus = async (status: PartnerStatus) => {
    if (!code) return;
    setSaving(true);
    try {
      await api('admin-partner-status', { body: { code, status } });
      toast.success('저장했습니다.');
      await refetch();
      onChanged();
    } catch (e) {
      toast.error(`저장 실패: ${(e as Error).message}`);
    } finally {
      setSaving(false);
      setConfirm(null);
    }
  };

  const p = data?.partner;
  const link = code ? `${B2C_SITE_URL}/a/${code}` : '';
  const CONFIRM_TEXT: Record<PartnerStatus, { title: string; desc: string; action: string }> = {
    suspended: { title: '파트너를 정지할까요?', desc: '링크 클릭이 집계되지 않고, 정지 이후 새 주문은 커미션 0(Excluded)으로 기록됩니다. 다시 활성화할 수 있어요.', action: 'Suspend' },
    removed: { title: '파트너를 제거할까요?', desc: '파트너 화면이 닫히고 같은 계정으로 다시 가입할 수 없어요. 기존 기록은 남습니다.', action: 'Remove' },
    active: { title: '다시 활성화할까요?', desc: '이후 클릭·주문부터 다시 집계됩니다.', action: 'Activate' },
  };

  return (
    <Sheet open={!!code} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        {isLoading || !p || !data ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-6">
            <SheetHeader className="space-y-1 text-left">
              <SheetTitle className="flex items-center gap-2 text-2xl">{p.name || '(이름 없음)'} <PartnerBadge status={p.status} /></SheetTitle>
              <SheetDescription className="font-mono">{p.code}</SheetDescription>
            </SheetHeader>

            <div className="flex flex-wrap gap-2">
              {p.status === 'active' && <Button variant="outline" disabled={saving} onClick={() => setConfirm('suspended')}>Suspend</Button>}
              {p.status !== 'active' && <Button variant="outline" disabled={saving} onClick={() => setConfirm('active')}>Activate</Button>}
              {p.status !== 'removed' && <Button variant="outline" disabled={saving} onClick={() => setConfirm('removed')}>Remove</Button>}
            </div>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm md:grid-cols-2">
              <div><dt className="text-muted-foreground">Email</dt><dd className="break-all">{p.email}</dd></div>
              <div><dt className="text-muted-foreground">Country (default shipping)</dt><dd>{p.country || '—'}</dd></div>
              <div><dt className="text-muted-foreground">Joined</dt><dd>{kstDate(p.joinedAt)}</dd></div>
              <div><dt className="text-muted-foreground">PayPal email</dt><dd>{p.paypalEmail ? maskEmail(p.paypalEmail) : <span className="text-red-600">Missing</span>}</dd></div>
              <div className="md:col-span-2">
                <dt className="text-muted-foreground">Partner link</dt>
                <dd className="flex items-center gap-2 break-all">
                  {link}
                  <button type="button" aria-label="링크 복사" className="text-muted-foreground hover:text-foreground"
                    onClick={() => navigator.clipboard?.writeText(link).then(() => toast.success('복사했습니다.'))}>
                    <Copy className="h-4 w-4" />
                  </button>
                </dd>
              </div>
            </dl>

            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {[
                { v: data.performance.clicks.toLocaleString(), l: 'Clicks · selected period' },
                { v: data.performance.orders.toLocaleString(), l: 'Orders · selected period' },
                { v: usd(data.performance.sales), l: 'Sales · selected period' },
                { v: usd(data.performance.commission), l: 'Commission · selected period' },
              ].map((s) => (
                <div key={s.l} className="rounded-xl bg-gray-50 p-3">
                  <div className="text-lg font-bold">{s.v}</div>
                  <div className="text-xs text-muted-foreground">{s.l}</div>
                </div>
              ))}
            </div>

            <div>
              <h3 className="font-bold">Shared links · {fmtDay(range.from)} – {fmtDay(range.to, true)}</h3>
              {data.links.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">기간 안에 클릭·복사·주문이 없습니다.</p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-muted-foreground">
                      <tr className="border-b"><th className="py-2 font-medium">Product</th><th className="py-2 text-right font-medium">Copies</th><th className="py-2 text-right font-medium">Clicks</th><th className="py-2 text-right font-medium">Orders</th><th className="py-2 text-right font-medium">Commission</th></tr>
                    </thead>
                    <tbody>
                      {data.links.map((l) => (
                        <tr key={l.handle} className="border-b last:border-0">
                          <td className="py-2">{l.handle === '_home' ? 'Home page' : products?.[l.handle]?.title || l.handle}</td>
                          <td className="py-2 text-right">{l.copies}</td>
                          <td className="py-2 text-right">{l.clicks}</td>
                          <td className="py-2 text-right">{l.orders}</td>
                          <td className="py-2 text-right">{usd(l.commission)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h3 className="font-bold">Orders · all time</h3>
              {data.orders.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">귀속 주문이 없습니다.</p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-muted-foreground">
                      <tr className="border-b"><th className="py-2 font-medium">Order</th><th className="py-2 font-medium">Date</th><th className="py-2 text-right font-medium">Amount</th><th className="py-2 text-right font-medium">Commission</th><th className="py-2 text-center font-medium">Status</th></tr>
                    </thead>
                    <tbody>
                      {data.orders.map((o) => (
                        <tr key={o.orderId} className="border-b last:border-0">
                          <td className="py-2 font-mono">{o.orderName}</td>
                          <td className="py-2 text-muted-foreground">{kstDate(o.createdAt)}</td>
                          <td className="py-2 text-right">{usd(o.baseAmount)}</td>
                          <td className="py-2 text-right">{usd(o.commission)}</td>
                          <td className="py-2 text-center">
                            <StatusBadge order={o} />
                            {o.status === 'pending' && <div className="mt-0.5 text-xs text-muted-foreground">Approves {approvesOn(o.createdAt, confirmDays)}</div>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
          <AlertDialogContent>
            {confirm && (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>{CONFIRM_TEXT[confirm].title}</AlertDialogTitle>
                  <AlertDialogDescription>{CONFIRM_TEXT[confirm].desc}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>취소</AlertDialogCancel>
                  <AlertDialogAction onClick={() => changeStatus(confirm)}>{CONFIRM_TEXT[confirm].action}</AlertDialogAction>
                </AlertDialogFooter>
              </>
            )}
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}

// ─── 파트너 목록 ──────────────────────────────────────────────────────────────

type SortKey = 'clicks' | 'orders' | 'sales' | 'commission' | 'joinedAt';
const PAGE_SIZE = 20;

function PartnersTable({ partners, onOpen }: { partners: PartnerRow[]; onOpen: (code: string) => void }) {
  const [tab, setTab] = useState<'all' | PartnerStatus>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('sales');
  const [page, setPage] = useState(0);

  const counts = useMemo(() => ({
    all: partners.length,
    active: partners.filter((p) => p.status === 'active').length,
    suspended: partners.filter((p) => p.status === 'suspended').length,
    removed: partners.filter((p) => p.status === 'removed').length,
  }), [partners]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return partners
      .filter((p) => tab === 'all' || p.status === tab)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))
      .sort((a, b) => (sort === 'joinedAt' ? b.joinedAt.localeCompare(a.joinedAt) : b[sort] - a[sort]));
  }, [partners, tab, search, sort]);

  useEffect(() => setPage(0), [tab, search, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const shown = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const SortTh = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={cn('px-3 py-3 font-medium', className)}>
      <button type="button" onClick={() => setSort(k)} className={cn('hover:text-foreground', sort === k && 'font-bold text-foreground')}>
        {children}{sort === k && ' ↓'}
      </button>
    </th>
  );

  return (
    <Panel>
      <h2 className="text-lg font-bold">Partners</h2>
      <p className="text-sm text-muted-foreground">클릭·주문·매출·커미션은 선택 기간 기준(봇 제외). 열 이름을 누르면 정렬, 행을 누르면 상세.</p>
      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1">
          {(['all', 'active', 'suspended', 'removed'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={cn('rounded-lg px-3 py-1.5 text-sm capitalize', tab === t ? 'bg-white font-semibold shadow-sm' : 'text-muted-foreground')}>
              {t} ({counts[t]})
            </button>
          ))}
        </div>
        <Input placeholder="Search name, email or ID" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full md:w-72" />
      </div>
      <div className="mt-4 overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-gray-50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-3 font-medium">Partner ID</th>
              <th className="px-3 py-3 font-medium">Name</th>
              <th className="px-3 py-3 font-medium">Country</th>
              <SortTh k="clicks" className="text-right">Clicks</SortTh>
              <SortTh k="orders" className="text-right">Orders</SortTh>
              <SortTh k="sales" className="text-right">Sales</SortTh>
              <SortTh k="commission" className="text-right">Commission</SortTh>
              <SortTh k="joinedAt">Joined</SortTh>
              <th className="px-3 py-3 text-center font-medium">PayPal</th>
              <th className="px-3 py-3 text-center font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr><td colSpan={10} className="px-3 py-10 text-center text-muted-foreground">파트너가 없습니다.</td></tr>
            ) : shown.map((p) => (
              <tr key={p.code} onClick={() => onOpen(p.code)} className="cursor-pointer border-t hover:bg-gray-50">
                <td className="px-3 py-3 font-mono">{p.code}</td>
                <td className="px-3 py-3"><div className="font-medium">{p.name || '—'}</div><div className="text-xs text-muted-foreground">{p.email}</div></td>
                <td className="px-3 py-3">{p.country || '—'}</td>
                <td className="px-3 py-3 text-right">{p.clicks}</td>
                <td className="px-3 py-3 text-right">{p.orders}</td>
                <td className="px-3 py-3 text-right font-semibold">{usd(p.sales)}</td>
                <td className="px-3 py-3 text-right">{usd(p.commission)}</td>
                <td className="px-3 py-3 text-muted-foreground">{kstDate(p.joinedAt)}</td>
                <td className="px-3 py-3 text-center">
                  {p.paypalEmail
                    ? <CheckCircle2 className="mx-auto h-5 w-5 text-green-600" aria-label="등록됨" />
                    : <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">Missing</span>}
                </td>
                <td className="px-3 py-3 text-center"><PartnerBadge status={p.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-3 text-sm text-muted-foreground">
          <button type="button" aria-label="이전" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="disabled:opacity-30"><ChevronLeft className="h-5 w-5" /></button>
          {page + 1} / {pages}
          <button type="button" aria-label="다음" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} className="disabled:opacity-30"><ChevronRight className="h-5 w-5" /></button>
        </div>
      )}
    </Panel>
  );
}

// ─── 정산 ─────────────────────────────────────────────────────────────────────

function PayoutsPanel({ data, onChanged }: { data: PayoutsData; onChanged: () => void }) {
  const api = useAdminApi();
  const [target, setTarget] = useState<PayoutRow | null>(null);
  const [saving, setSaving] = useState(false);
  const ready = data.rows.filter((r) => r.block === 'ready');

  const markPaid = async (row: PayoutRow) => {
    setSaving(true);
    try {
      await api('admin-payout-mark', { body: { code: row.code, amount: row.amount } });
      toast.success(`${row.name || row.code} 지급 완료로 기록했습니다.`);
      onChanged();
    } catch (e) {
      toast.error(`실패: ${(e as Error).message}`);
    } finally {
      setSaving(false);
      setTarget(null);
    }
  };

  return (
    <Panel>
      <h2 className="text-lg font-bold">
        Payouts <span className="font-normal text-muted-foreground">· {data.period} 확정분 · 지급일 {data.payDate}</span>
      </h2>
      <p className="text-sm text-muted-foreground">
        주문 {data.confirmDays}일 뒤 자동 확정 → 지난달 말까지 확정된 커미션(지급 후 환불 차감 포함)을 이번 달 말 지급. {usd(data.minPayout)} 미만·PayPal 없음은 다음 달로 이월.
        PayPal에서 송금한 뒤 Mark as paid를 누르세요. Ready {ready.length}명 · {usd(ready.reduce((t, r) => t + r.amount, 0))}
      </p>
      <div className="mt-4 overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-gray-50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-3 font-medium">Partner</th>
              <th className="px-3 py-3 font-medium">PayPal</th>
              <th className="px-3 py-3 text-right font-medium">Orders</th>
              <th className="px-3 py-3 text-right font-medium">Deductions</th>
              <th className="px-3 py-3 text-right font-medium">Amount</th>
              <th className="px-3 py-3 text-center font-medium">Status</th>
              <th className="px-3 py-3 text-center font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">이번 지급 대상이 없습니다.</td></tr>
            ) : data.rows.map((r) => (
              <tr key={r.code} className="border-t">
                <td className="px-3 py-3"><div className="font-mono text-xs">{r.code}</div><div className="text-muted-foreground">{r.name || '—'}</div></td>
                <td className="px-3 py-3 break-all">{r.paypalEmail || <span className="text-red-600">Missing</span>}</td>
                <td className="px-3 py-3 text-right">{r.orders}</td>
                <td className="px-3 py-3 text-right">{r.adjustments ? `${r.adjustments}건 · ${usd(r.adjustmentAmount)}` : '—'}</td>
                <td className="px-3 py-3 text-right font-semibold">{usd(r.amount)}</td>
                <td className="px-3 py-3 text-center">
                  <span className={cn('inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                    r.block === 'ready' ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 bg-gray-50 text-gray-600')}>
                    {BLOCK_LABEL[r.block]}
                  </span>
                </td>
                <td className="px-3 py-3 text-center">
                  {r.block === 'ready' && (
                    <Button size="sm" variant="outline" disabled={saving} onClick={() => setTarget(r)}>Mark as paid</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.payouts.length > 0 && (
        <div className="mt-6">
          <h3 className="font-bold">최근 지급 기록</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 font-medium">Paid</th><th className="py-2 font-medium">Partner</th><th className="py-2 font-medium">Period</th>
                  <th className="py-2 font-medium">PayPal</th><th className="py-2 text-right font-medium">Orders</th><th className="py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.payouts.map((x) => (
                  <tr key={x.id} className="border-b last:border-0">
                    <td className="py-2 text-muted-foreground">{kstDate(x.paidAt)}</td>
                    <td className="py-2"><span className="font-mono text-xs">{x.code}</span> {x.partnerName}</td>
                    <td className="py-2">{x.period}</td>
                    <td className="py-2 break-all">{x.paypalEmail}</td>
                    <td className="py-2 text-right">{x.orderIds.length}</td>
                    <td className="py-2 text-right font-semibold">{usd(x.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AlertDialog open={!!target} onOpenChange={(open) => !open && setTarget(null)}>
        <AlertDialogContent>
          {target && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{target.name || target.code} · {usd(target.amount)} 지급 완료로 기록할까요?</AlertDialogTitle>
                <AlertDialogDescription>
                  PayPal({target.paypalEmail}) 송금을 먼저 마쳤는지 확인하세요. 확정 주문 {target.orders}건이 Paid로 바뀌고{target.adjustments ? `, 차감 ${target.adjustments}건이 함께 반영됩니다` : '니다'}. 되돌릴 수 없어요.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={() => markPaid(target)}>Mark as paid</AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  );
}

// ─── 페이지 ───────────────────────────────────────────────────────────────────

export default function AffiliateAdmin() {
  const api = useAdminApi();
  const queryClient = useQueryClient();
  const [preset, setPreset] = useState<Preset>('this-month');
  const [custom, setCustom] = useState(() => presetRange('this-month'));
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [voidTarget, setVoidTarget] = useState<Order | null>(null);
  const [syncing, setSyncing] = useState(false);

  const range = preset === 'custom' ? custom : presetRange(preset);
  const q = { from: range.from, to: range.to };

  const summary = useQuery({ queryKey: ['aff-admin-summary', q], queryFn: () => api<Summary>('admin-summary', { query: q }) });
  const orders = useQuery({ queryKey: ['aff-admin-orders', q], queryFn: () => api<{ orders: Order[] }>('admin-orders', { query: q }) });
  const partners = useQuery({ queryKey: ['aff-admin-partners', q], queryFn: () => api<{ partners: PartnerRow[] }>('admin-partners', { query: q }) });
  const payouts = useQuery({ queryKey: ['aff-admin-payouts'], queryFn: () => api<PayoutsData>('admin-payouts') });

  const refreshAll = () => queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith('aff-admin') });

  const runSync = async () => {
    setSyncing(true);
    try {
      const r = await api<{ scanned?: number; new?: number; updated?: number; confirmed?: number; skipped?: string }>('sync', { body: {} });
      toast.success(r.skipped ? '다른 수집이 진행 중입니다.' : `주문 수집 완료 · 확인 ${r.scanned}건, 새 귀속 ${r.new}건, 변경 ${r.updated}건, 확정 ${r.confirmed ?? 0}건`);
      refreshAll();
    } catch (e) {
      toast.error(`수집 실패: ${(e as Error).message}`);
    } finally {
      setSyncing(false);
    }
  };

  const toggleVoid = async (order: Order) => {
    try {
      await api('admin-void', { body: { orderId: order.orderId, void: !order.manualVoid } });
      toast.success(order.manualVoid ? '무효를 취소했습니다.' : '무효 처리했습니다.');
      refreshAll();
    } catch (e) {
      toast.error(`실패: ${(e as Error).message}`);
    } finally {
      setVoidTarget(null);
    }
  };

  const t = summary.data?.totals;
  const confirmDays = summary.data?.confirmDays ?? payouts.data?.confirmDays ?? 30;
  const loading = summary.isLoading || orders.isLoading || partners.isLoading;
  const error = summary.error || orders.error || partners.error;

  return (
    <div>
      <ManagePageHeader icon={Handshake} heading="Affiliate Partners (B2C)" />
      <main className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-muted-foreground">biteme-us.com 파트너 · 주문은 1시간마다 자동 수집</p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap overflow-hidden rounded-full border bg-white">
              {PRESETS.map((p) => (
                <button key={p.key} type="button" onClick={() => setPreset(p.key)}
                  className={cn('px-4 py-2 text-sm', preset === p.key ? 'bg-primary font-semibold text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                  {p.label}
                </button>
              ))}
            </div>
            <Button variant={preset === 'custom' ? 'default' : 'outline'} className="rounded-full" onClick={() => setPreset('custom')}>
              <CalendarDays className="mr-1.5 h-4 w-4" />Custom
            </Button>
            <Button variant="outline" className="rounded-full" onClick={runSync} disabled={syncing}>
              {syncing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}지금 수집
            </Button>
          </div>
        </div>

        {preset === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Input type="date" value={custom.from} max={custom.to} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, from: e.target.value }))} className="w-auto" />
            <span>~</span>
            <Input type="date" value={custom.to} min={custom.from} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, to: e.target.value }))} className="w-auto" />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-2xl border border-green-200 bg-green-50 px-5 py-3 text-sm text-green-800">
          <span className="flex items-center gap-2 font-bold"><span className="h-2 w-2 rounded-full bg-green-600" />Program rules</span>
          <span>10% commission (whole order, after discounts)</span>
          <span>30-day attribution (last click)</span>
          <span>Approved after {confirmDays} days</span>
          <span>B2B &amp; self-purchases excluded</span>
        </div>

        <h2 className="font-bold">
          {fmtDay(range.from)} – {fmtDay(range.to, true)} <span className="font-normal text-muted-foreground">(KST)</span>
        </h2>

        {error ? (
          <Panel><p className="text-sm text-red-600">불러오지 못했습니다: {(error as Error).message}</p></Panel>
        ) : loading || !t || !summary.data || !orders.data || !partners.data ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard icon={UserPlus} tone="bg-purple-50 text-purple-600" value={t.newPartners} label="New partners" sub={`전체 ${t.partners}명 (약관 동의 가입)`} />
              <StatCard icon={MousePointerClick} tone="bg-purple-50 text-purple-600" value={t.clickingPartners} label="Clicking partners" sub="링크 클릭 1회 이상" />
              <StatCard icon={Copy} tone="bg-purple-50 text-purple-600" value={t.copies.toLocaleString()} label="Link copies" sub={'"Copy link" 누른 횟수'} />
              <StatCard icon={MousePointer2} tone="bg-purple-50 text-purple-600" value={t.clicks.toLocaleString()} label="Clicks" sub="봇 제외 · 30분 중복 제외" />
              <StatCard icon={Percent} tone="bg-purple-50 text-purple-600" value={`${t.conversion}%`} label="Conversion rate" sub={`${t.orders} orders ÷ ${t.clicks} clicks`} />
              <StatCard icon={ShoppingBag} tone="bg-blue-50 text-blue-600" value={t.orders} label="Attributed orders" sub="제외·무효 빼고" />
              <StatCard icon={DollarSign} tone="bg-blue-50 text-blue-600" value={usd(t.gmv)} label="Attributed sales" sub="할인 후 상품 금액" />
              <StatCard icon={Clock} tone="bg-amber-50 text-amber-600" value={usd(t.pendingCommission)} label="Pending commission" sub={`주문 후 ${confirmDays}일 대기`} />
              <StatCard icon={CheckCircle2} tone="bg-green-50 text-green-600" value={usd(t.confirmedCommission)} label="Approved commission" sub="확정 + 지급 (기간 주문 기준)" />
              <StatCard icon={Ban} tone="bg-gray-100 text-gray-500" value={<>{t.excluded} <span className="text-base font-normal text-muted-foreground">· {usd(t.excludedAmount)}</span></>} label="Excluded orders" sub={`B2B · 본인 구매 · 무효 ${t.void}건 별도`} />
            </div>

            <Panel>
              <h2 className="text-lg font-bold">Daily sales (GMV)</h2>
              <p className="text-sm text-muted-foreground">주문일(KST) 기준 귀속 매출. B2B·본인 구매·무효 제외.</p>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.data.daily} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#eee" />
                    <XAxis dataKey="date" tickFormatter={(d: string) => fmtDay(d)} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} minTickGap={16} />
                    <YAxis tickFormatter={(v: number) => `$${v}`} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={56} />
                    <ChartTooltip
                      formatter={(v: number, name: string) => (name === 'gmv' ? [usd(v), 'Sales'] : [v, name])}
                      labelFormatter={(d: string) => fmtDay(d, true)}
                    />
                    <Bar dataKey="gmv" fill="#1e3a5f" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel>
              <h2 className="text-lg font-bold">Attributed orders <span className="font-normal text-muted-foreground">· {orders.data.orders.length}</span></h2>
              <p className="text-sm text-muted-foreground">선택 기간에 생긴 주문. 요율은 주문 시점에 고정. 금액 = 할인 후 상품 금액(배송비·세금 제외, 환불 반영).</p>
              <div className="mt-4 overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-gray-50 text-left text-muted-foreground">
                    <tr>
                      <th className="px-3 py-3 font-medium">Order</th>
                      <th className="px-3 py-3 font-medium">Date</th>
                      <th className="px-3 py-3 font-medium">Partner</th>
                      <th className="px-3 py-3 text-right font-medium">Order amount</th>
                      <th className="px-3 py-3 text-right font-medium">Rate</th>
                      <th className="px-3 py-3 text-right font-medium">Commission</th>
                      <th className="px-3 py-3 text-center font-medium">Status</th>
                      <th className="px-3 py-3 text-center font-medium">Approves on</th>
                      <th className="px-3 py-3 text-center font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.data.orders.length === 0 ? (
                      <tr><td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">귀속 주문이 없습니다.</td></tr>
                    ) : orders.data.orders.map((o) => (
                      <tr key={o.orderId} className="border-t" title={o.history.map((h) => `${kstDate(h.at)} ${h.change}`).join('\n')}>
                        <td className="px-3 py-3 font-mono">{o.orderName}{o.guest && <span className="ml-2 font-sans text-xs text-muted-foreground">Guest</span>}</td>
                        <td className="px-3 py-3 text-muted-foreground">{kstDate(o.createdAt)}</td>
                        <td className="px-3 py-3">
                          <button type="button" className="text-left hover:underline" onClick={() => setOpenCode(o.code)}>
                            <div className="font-mono text-xs">{o.code}</div>
                            <div className="text-muted-foreground">{o.partnerName || '—'}</div>
                          </button>
                        </td>
                        <td className="px-3 py-3 text-right">{usd(o.baseAmount)}</td>
                        <td className="px-3 py-3 text-right">{Math.round(o.rate * 100)}%</td>
                        <td className="px-3 py-3 text-right font-semibold">{usd(o.commission)}</td>
                        <td className="px-3 py-3 text-center"><StatusBadge order={o} /></td>
                        <td className="px-3 py-3 text-center text-muted-foreground">{o.status === 'pending' ? approvesOn(o.createdAt, confirmDays) : '—'}</td>
                        <td className="px-3 py-3 text-center">
                          {(o.status === 'pending' || o.status === 'confirmed' || o.status === 'paid' || o.manualVoid) && (
                            <button type="button" className="text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => setVoidTarget(o)}>
                              {o.manualVoid ? 'Restore' : 'Void'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            {payouts.error ? (
              <Panel><p className="text-sm text-red-600">정산을 불러오지 못했습니다: {(payouts.error as Error).message}</p></Panel>
            ) : payouts.data ? (
              <PayoutsPanel data={payouts.data} onChanged={refreshAll} />
            ) : null}

            <PartnersTable partners={partners.data.partners} onOpen={setOpenCode} />
          </>
        )}
      </main>

      <PartnerSheet code={openCode} range={range} confirmDays={confirmDays} onClose={() => setOpenCode(null)} onChanged={refreshAll} />

      <AlertDialog open={!!voidTarget} onOpenChange={(open) => !open && setVoidTarget(null)}>
        <AlertDialogContent>
          {voidTarget && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{voidTarget.manualVoid ? `${voidTarget.orderName} 무효를 취소할까요?` : `${voidTarget.orderName} 커미션을 무효 처리할까요?`}</AlertDialogTitle>
                <AlertDialogDescription>
                  {voidTarget.manualVoid
                    ? 'Shopify 주문을 다시 읽어 상태·금액을 바로 다시 계산합니다.'
                    : voidTarget.status === 'paid'
                      ? `이미 지급된 주문이라 커미션 ${usd(voidTarget.commission)}가 다음 지급분에서 차감됩니다. 이력이 남고 나중에 되돌릴 수 있어요.`
                      : `커미션 ${usd(voidTarget.commission)}가 0이 됩니다. 이력이 남고 나중에 되돌릴 수 있어요.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={() => toggleVoid(voidTarget)}>{voidTarget.manualVoid ? 'Restore' : 'Void'}</AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
