import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Archive, CalendarDays, Check, ChevronLeft, ChevronRight, Copy, Info, Loader2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { initiateLogin, isLoggedIn as isCustomerLoggedIn } from '@/lib/customer-auth';
import { IS_B2C_SITE } from '@/lib/site';
import { fetchProductsByHandles } from '@/lib/shopify';
import {
  AffiliateApiError, buildAffiliateLink, displayAffiliateLink, estimateCommission,
  fetchAffiliateDashboard, formatUsd, recordLinkCopy, savePaypalEmail, type AffiliateLinkRow,
} from '@/lib/affiliate';
import { AffiliateJoinSheet, AffiliateStats } from '@/components/affiliate/AffiliateJoinSheet';
import type { AffiliateJoinProfile } from '@/components/affiliate/joinProfile';
import { copyText } from '@/components/affiliate/copy-text';
import { useAffiliatePartner } from '@/components/affiliate/useAffiliatePartner';

const JOIN_PARAM = 'join';

// ─── 기간 (KST 기준 — 서버 집계와 같은 날짜) ─────────────────────────────────

const kstToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
const shiftDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

type RangeKey = 'this-month' | 'last-month' | '7d' | '30d';
function rangeFor(key: RangeKey): { from: string; to: string } {
  const today = kstToday();
  const monthStart = `${today.slice(0, 7)}-01`;
  if (key === 'last-month') {
    const lastEnd = shiftDays(monthStart, -1);
    return { from: `${lastEnd.slice(0, 7)}-01`, to: lastEnd };
  }
  if (key === '7d') return { from: shiftDays(today, -6), to: today };
  if (key === '30d') return { from: shiftDays(today, -29), to: today };
  return { from: monthStart, to: today };
}

const shortDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

// Shopify 이미지 크기 줄이기
const thumb = (url: string, width: number) => `${url}${url.includes('?') ? '&' : '?'}width=${width}`;

const RANGE_LABELS: Record<RangeKey, string> = {
  'this-month': 'This month',
  'last-month': 'Last month',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
};

// ─── 공통 블록 ────────────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-border bg-card p-5 ${className}`}>{children}</section>;
}

function BackToMyPage() {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate('/mypage')} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
      <ChevronLeft className="h-4 w-4" />
      My Page
    </button>
  );
}

// ─── 가입 안내 (파트너 아님) ──────────────────────────────────────────────────

function JoinIntro({ onStart }: { onStart: () => void }) {
  const steps = [
    { title: 'Join in seconds', desc: 'No review, link right away' },
    { title: 'Share your link', desc: 'Stories, bio, blog, anywhere' },
    { title: 'Get paid monthly', desc: 'In USD via PayPal' },
  ];
  return (
    <div className="pt-4">
      <h1 className="text-center text-3xl font-bold text-foreground">Share &amp; earn</h1>
      <p className="mt-1 text-balance text-center text-base text-muted-foreground">Share products you love. Earn from every order.</p>
      <AffiliateStats className="mt-6" />
      <Card className="mt-4">
        <h2 className="text-base font-bold text-foreground">How it works</h2>
        <ol className="mt-3 space-y-3">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-primary">{i + 1}</span>
              <div>
                <p className="font-semibold text-foreground">{s.title}</p>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>
      <Button onClick={onStart} className="mt-6 h-12 w-full rounded-2xl text-base font-bold">Start now</Button>
      <p className="mt-3 text-center text-xs text-muted-foreground">Free · No review</p>
    </div>
  );
}

// ─── PayPal ───────────────────────────────────────────────────────────────────

function PaypalDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const [email, setEmail] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setEmail('');
      setConfirm('');
    }
  }, [open]);

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const matches = email.trim().toLowerCase() === confirm.trim().toLowerCase();
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || !matches) return;
    setSaving(true);
    try {
      await savePaypalEmail(email.trim());
      toast.success('PayPal email saved', { position: 'top-center' });
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error('Could not save. Please check the email and try again.', { position: 'top-center' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-32px)] rounded-3xl sm:max-w-sm">
        <form onSubmit={save}>
          <DialogHeader>
            <DialogTitle>PayPal email</DialogTitle>
            <DialogDescription>We send your monthly commission to this PayPal account.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-3">
            <div className="space-y-1">
              <label htmlFor="paypal-email" className="text-sm font-medium">Email</label>
              <Input id="paypal-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label htmlFor="paypal-email-confirm" className="text-sm font-medium">Confirm email</label>
              <Input id="paypal-email-confirm" type="email" autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                onPaste={(e) => e.preventDefault()} />
              {confirm && !matches && <p className="text-xs text-destructive">Emails don&apos;t match.</p>}
            </div>
          </div>
          <DialogFooter className="mt-5">
            <Button type="submit" disabled={!valid || !matches || saving} className="h-11 w-full rounded-xl">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── 대시보드 ─────────────────────────────────────────────────────────────────

function Dashboard({ code }: { code: string }) {
  const [rangeKey, setRangeKey] = useState<RangeKey>('this-month');
  const [paypalOpen, setPaypalOpen] = useState(false);
  const [showAllLinks, setShowAllLinks] = useState(false);
  const [copied, setCopied] = useState(false);
  const range = useMemo(() => rangeFor(rangeKey), [rangeKey]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['affiliate-dashboard', code, range.from, range.to],
    queryFn: () => fetchAffiliateDashboard(range),
    staleTime: 60 * 1000,
  });

  const productLinks = (data?.links || []).filter((l) => l.handle !== '_home');
  const handles = productLinks.map((l) => l.handle);
  const { data: products } = useQuery({
    queryKey: ['affiliate-products', handles.join(',')],
    queryFn: () => fetchProductsByHandles(handles),
    enabled: handles.length > 0,
    staleTime: 10 * 60 * 1000,
  });

  const copyMyLink = async () => {
    try {
      await copyText(buildAffiliateLink(code));
      recordLinkCopy(null);
      setCopied(true);
      toast.success('Link copied', { position: 'top-center' });
      window.setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error('Could not copy the link.', { position: 'top-center' });
    }
  };

  const titleOf = (l: AffiliateLinkRow) => (l.handle === '_home' ? 'Home page' : products?.[l.handle]?.title || l.handle);
  const imageOf = (handle: string) => products?.[handle]?.images?.edges?.[0]?.node?.url;
  const priceOf = (handle: string) => parseFloat(products?.[handle]?.priceRange?.minVariantPrice?.amount || '0');
  const linksShown = showAllLinks ? data?.links || [] : (data?.links || []).slice(0, 3);
  const paused = data?.partner.status === 'suspended';

  return (
    <div className="space-y-4">
      {paused && (
        <div className="rounded-2xl bg-muted px-4 py-3 text-sm text-foreground">
          Your affiliate account is paused. New orders won&apos;t earn commission. Please contact us.
        </div>
      )}

      <Card>
        <h2 className="text-base font-bold text-foreground">Your affiliate link</h2>
        <div className="mt-3 flex items-center gap-2">
          <div className="flex h-12 min-w-0 flex-1 items-center rounded-2xl bg-muted px-4 text-[15px] font-semibold text-foreground">
            <span className="truncate">{displayAffiliateLink(code)}</span>
          </div>
          <button type="button" onClick={copyMyLink} aria-label="Copy your affiliate link"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground transition-colors hover:bg-primary/90">
            {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">10% on the whole order · 30 days after a click</p>
      </Card>

      <Select value={rangeKey} onValueChange={(v) => setRangeKey(v as RangeKey)}>
        <SelectTrigger className="h-12 w-full justify-center gap-2 rounded-full bg-card text-[15px] font-medium" aria-label="Date range">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <SelectValue>{`${shortDate(range.from)} – ${shortDate(range.to)}`}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(RANGE_LABELS) as RangeKey[]).map((k) => (
            <SelectItem key={k} value={k}>{RANGE_LABELS[k]}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isError ? (
        <Card className="text-center">
          <p className="text-sm text-muted-foreground">Couldn&apos;t load your stats.</p>
          <Button variant="outline" className="mt-3" onClick={() => refetch()}>Try again</Button>
        </Card>
      ) : isLoading || !data ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-3xl" />
          <Skeleton className="h-48 w-full rounded-3xl" />
        </div>
      ) : (
        <>
          <Card>
            <h2 className="text-sm text-muted-foreground">Performance</h2>
            <div className="mt-3 grid grid-cols-3 divide-x divide-border text-center">
              {[
                { v: data.performance.clicks.toLocaleString('en-US'), l: 'Clicks' },
                { v: data.performance.orders.toLocaleString('en-US'), l: 'Orders' },
                { v: `$${Math.round(data.performance.sales).toLocaleString('en-US')}`, l: 'Sales' },
              ].map((s) => (
                <div key={s.l}>
                  <div className="text-2xl font-bold text-foreground">{s.v}</div>
                  <div className="text-sm text-muted-foreground">{s.l}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              Your commission
              <Tooltip>
                <TooltipTrigger aria-label="About commission"><Info className="h-4 w-4" /></TooltipTrigger>
                <TooltipContent className="max-w-[260px] text-xs">
                  Commission is pending for {data.confirmDays} days after each order, then confirmed. Confirmed amounts are paid at the end of the next month once they reach ${data.minPayout}. Refunds after payout are deducted from your next payout.
                </TooltipContent>
              </Tooltip>
            </div>
            <p className="mt-1">
              <span className="text-3xl font-bold text-foreground">{formatUsd(data.month.pending)}</span>
              <span className="ml-2 text-base text-muted-foreground">pending</span>
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4">
              <div><div className="text-lg font-bold">{formatUsd(data.month.confirmed)}</div><div className="text-sm text-muted-foreground">Confirmed</div></div>
              <div><div className="text-lg font-bold">{formatUsd(data.month.paid)}</div><div className="text-sm text-muted-foreground">Paid</div></div>
              <div><div className="text-lg font-bold">{shortDate(data.month.nextPayout)}</div><div className="text-sm text-muted-foreground">Next payout</div></div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-accent px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{data.partner.paypalEmail ? `PayPal · ${data.partner.paypalEmail}` : 'PayPal not added'}</p>
                <p className="text-xs text-muted-foreground">{data.partner.paypalEmail ? 'Payouts go to this account' : 'Add it to get paid'}</p>
              </div>
              <Button size="sm" className="shrink-0 rounded-full px-4 font-bold" onClick={() => setPaypalOpen(true)}>
                {data.partner.paypalEmail ? 'Change' : 'Add'}
              </Button>
            </div>
          </Card>

          <Card>
            <h2 className="text-base font-bold text-foreground">Your top links</h2>
            <p className="text-sm text-muted-foreground">Ranked by clicks</p>
            {linksShown.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No clicks yet. Tap “Copy link” on any product page to share it.</p>
            ) : (
              <ul className="mt-2 divide-y divide-border">
                {linksShown.map((l) => (
                  <li key={l.handle} className="flex items-center gap-3 py-3">
                    {imageOf(l.handle) ? (
                      <img src={thumb(imageOf(l.handle)!, 96)} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <div className="h-11 w-11 shrink-0 rounded-xl bg-muted" aria-hidden="true" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-[15px] text-foreground">{titleOf(l)}</span>
                    <div className="shrink-0 text-right">
                      <div className="font-bold text-foreground">{l.clicks} clicks</div>
                      <div className="text-xs text-muted-foreground">{l.orders} orders · {formatUsd(l.commission)} earned</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {(data.links.length > 3) && (
              <button type="button" onClick={() => setShowAllLinks((v) => !v)} className="mt-2 w-full py-2 text-center font-medium text-primary">
                {showAllLinks ? 'Show less' : 'See all links'}
              </button>
            )}
          </Card>

          {productLinks.length > 0 && (
            <Card>
              <h2 className="text-base font-bold text-foreground">Products you&apos;ve shared</h2>
              <div className="-mx-1 mt-3 flex gap-3 overflow-x-auto px-1 pb-1 scrollbar-hide">
                {productLinks.map((l) => (
                  <Link key={l.handle} to={`/product/${l.handle}`} className="w-28 shrink-0">
                    <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
                      {imageOf(l.handle) && <img src={thumb(imageOf(l.handle)!, 240)} alt="" className="h-full w-full object-cover" loading="lazy" />}
                      {priceOf(l.handle) > 0 && (
                        <span className="absolute left-1.5 top-1.5 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
                          Earn {formatUsd(estimateCommission(priceOf(l.handle)))}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm text-foreground">{titleOf(l)}</p>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          <div className="flex items-center justify-between rounded-3xl border border-border bg-card px-5 py-4 text-muted-foreground">
            <span className="flex items-center gap-3"><Archive className="h-5 w-5" />Commission history</span>
            <span className="flex items-center gap-1 text-xs">After first payout<ChevronRight className="h-4 w-4" /></span>
          </div>
        </>
      )}

      <PaypalDialog open={paypalOpen} onOpenChange={setPaypalOpen} onSaved={() => refetch()} />
    </div>
  );
}

// ─── 페이지 ───────────────────────────────────────────────────────────────────

export default function MyAffiliate() {
  const loggedIn = isCustomerLoggedIn();
  const { partner, removed, ready, isLoading, isError, join } = useAffiliatePartner();
  const [joinOpen, setJoinOpen] = useState(false);
  const [params, setParams] = useSearchParams();

  // 로그인 전에 Start now를 누르고 돌아온 경우(?join=1): 내 정보를 받아온 뒤, 미가입자면 가입 시트를 연다
  useEffect(() => {
    if (params.get(JOIN_PARAM) !== '1' || !loggedIn || !ready) return;
    const next = new URLSearchParams(params);
    next.delete(JOIN_PARAM);
    setParams(next, { replace: true });
    if (!partner && !removed) setJoinOpen(true);
  }, [params, setParams, loggedIn, ready, partner, removed]);

  if (!IS_B2C_SITE) return <Navigate to="/mypage" replace />;

  const onJoinConfirm = async (profile: AffiliateJoinProfile, w9: File | null) => {
    const joined = join(profile, w9);
    const copied = await copyText(joined.then((p) => buildAffiliateLink(p.code))).then(() => true, () => false);
    try {
      await joined;
    } catch (e) {
      const removed = e instanceof AffiliateApiError && e.status === 403;
      toast.error(removed ? 'This account can’t join the program. Please contact us.' : 'Something went wrong. Please try again.', { position: 'top-center' });
      return;
    }
    setJoinOpen(false);
    toast.success(copied ? 'Link copied' : "You're in! Copy your link below.", { position: 'top-center' });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-md px-4 py-6 pb-24">
        <BackToMyPage />
        {!loggedIn ? (
          // 로그인 전에도 안내는 보여주고, Start now에서 로그인 → 이 화면으로 복귀
          <JoinIntro onStart={() => initiateLogin(`/mypage/affiliate?${JOIN_PARAM}=1`)} />
        ) : isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-3xl" />
            <Skeleton className="h-48 w-full rounded-3xl" />
          </div>
        ) : isError ? (
          <p className="pt-10 text-center text-sm text-muted-foreground">Couldn&apos;t load the affiliate program. Please refresh.</p>
        ) : partner ? (
          <Dashboard code={partner.code} />
        ) : removed ? (
          <p className="pt-10 text-center text-sm text-muted-foreground">This account can&apos;t join the program. Please contact us.</p>
        ) : (
          <JoinIntro onStart={() => setJoinOpen(true)} />
        )}
      </main>
      <AffiliateJoinSheet open={joinOpen} onOpenChange={setJoinOpen} variant="mypage" onConfirm={onJoinConfirm} />
    </div>
  );
}
