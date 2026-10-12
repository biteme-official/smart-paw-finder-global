// Sample data for the /manage/affiliate admin tab. There is no affiliate
// backend yet (no link issuance, click tracking, attribution or payout ledger),
// so every number here is placeholder data shaped after the customer-side
// dashboard (PR #157, src/components/affiliate/affiliateDashboardData.ts) and
// the KV ledger in docs/specs/affiliate-program-global.md §6. Shopify data is
// wired in last, once the load-safe API design (§10) is in place.
//
// TODO(#157): once #157 is merged, import the program constants, the link
// builder and AffiliateLinkStat from affiliateDashboardData.ts instead of the
// copies below.
//
// Global program rules: link only (no campaigns, partner codes or customer
// discounts), 10% of the whole order, 30-day last-click attribution (guest
// orders count too), approved 30 days after the order, B2B orders and
// self-purchases excluded, monthly cutoff paid the next month via PayPal in
// USD, balances under $20 carry over. All dates are KST.

export const AFFILIATE_COMMISSION_PERCENT = 10;
export const AFFILIATE_ATTRIBUTION_DAYS = 30;
/** An order's commission is approved this many days after the order. */
export const AFFILIATE_APPROVAL_DAYS = 30;
export const AFFILIATE_MIN_PAYOUT_USD = 20;

const AFFILIATE_LINK_ORIGIN = 'https://www.biteme.one';

/** Partner link: biteme.one/a/{code}, or biteme.one/a/{code}?p=/product/{handle} for one product. */
export function buildAffiliateLink(code: string, productHandle?: string): string {
  const base = `${AFFILIATE_LINK_ORIGIN}/a/${code}`;
  return productHandle ? `${base}?p=/product/${productHandle}` : base;
}

/** Same shape as AffiliateLinkStat in #157 (per shared product link). */
export interface AffiliateLinkStat {
  handle: string;
  title: string;
  image?: string;
  clicks: number;
  orders: number;
  commission: number;
}

// ─── KST dates ────────────────────────────────────────────────────────────────
// Dates are plain 'YYYY-MM-DD' strings in KST; arithmetic runs on UTC midnights
// so it never shifts with the viewer's local time zone.

export function kstToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(now);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** 'YYYY-MM' of a date. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function addMonths(month: string, n: number): string {
  const d = new Date(`${month}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
}

/** 'Oct 2026' */
export function formatMonth(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Inclusive KST date range. */
export interface DateRange {
  from: string;
  to: string;
}

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

/** 'US' → 'United States' (falls back to the code). */
export function countryName(code: string): string {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

export function inRange(date: string, range: DateRange): boolean {
  return date >= range.from && date <= range.to;
}

export type RangePreset = 'this-month' | 'last-month' | 'last-7' | 'last-30' | 'custom';

export const RANGE_PRESET_LABELS: Record<RangePreset, string> = {
  'this-month': 'This month',
  'last-month': 'Last month',
  'last-7': 'Last 7 days',
  'last-30': 'Last 30 days',
  custom: 'Custom',
};

/** Date range of a preset as of today (KST); "last N days" includes today. */
export function presetRange(preset: Exclude<RangePreset, 'custom'>, today: string): DateRange {
  const month = monthOf(today);
  switch (preset) {
    case 'this-month': return { from: `${month}-01`, to: today };
    case 'last-month': {
      const last = addMonths(month, -1);
      return { from: `${last}-01`, to: addDays(`${month}-01`, -1) };
    }
    case 'last-7': return { from: addDays(today, -6), to: today };
    case 'last-30': return { from: addDays(today, -29), to: today };
  }
}

const dayFormat = (date: string, withYear: boolean) => new Date(`${date}T00:00:00Z`).toLocaleString('en-US', {
  month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC',
});

/** 'Sep 1 – Sep 30, 2026', 'Dec 20, 2025 – Jan 5, 2026', or 'Oct 7, 2026' for one day. */
export function formatRange({ from, to }: DateRange): string {
  if (from === to) return dayFormat(from, true);
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${dayFormat(from, !sameYear)} – ${dayFormat(to, true)}`;
}

// ─── Records ──────────────────────────────────────────────────────────────────

export type PartnerStatus = 'active' | 'suspended' | 'removed';

export interface AffiliatePartner {
  /** Partner code — 6 chars, no look-alikes (same rule as #157). */
  id: string;
  name: string;
  email: string;
  /**
   * ISO 3166-1 alpha-2 code from the default shipping address (Shopify countryCodeV2) —
   * no country is asked at sign-up. Show the full name with countryName().
   */
  countryCode: string;
  joinedAt: string;
  status: PartnerStatus;
  paypalEmail?: string;
  /** Product links the partner has shared. */
  sharedLinks: { handle: string; title: string }[];
}

/** Link clicks per partner, product and KST day — bots already excluded. */
export interface LinkClickDay {
  date: string;
  partnerId: string;
  handle: string;
  clicks: number;
}

/** "Copy link" presses per partner, product and KST day (PDP box and partner dashboard). */
export interface LinkCopyDay {
  date: string;
  partnerId: string;
  handle: string;
  copies: number;
}

/** Ways an order drops out of commission; undefined = counted (pending/approved by age). */
export type OrderOutcome = 'voided' | 'refunded' | 'self-purchase' | 'excluded-b2b';
export type OrderStatus = 'pending' | 'approved' | OrderOutcome;

export interface AttributedOrder {
  id: string;
  orderedAt: string;
  partnerId: string;
  /** Product link the buyer clicked last. */
  landingHandle: string;
  /** Order total in shop currency (USD) — the commission base. */
  amount: number;
  /** Locked at order time. */
  ratePercent: number;
  shippingCountry: string;
  guest: boolean;
  outcome?: OrderOutcome;
}

export function orderStatus(order: AttributedOrder, today: string): OrderStatus {
  if (order.outcome) return order.outcome;
  return daysBetween(order.orderedAt, today) >= AFFILIATE_APPROVAL_DAYS ? 'approved' : 'pending';
}

export function approvesOn(order: AttributedOrder): string {
  return addDays(order.orderedAt, AFFILIATE_APPROVAL_DAYS);
}

/** Commission the partner earns from this order (0 once it drops out). */
export function orderCommission(order: AttributedOrder): number {
  if (order.outcome) return 0;
  return round2((order.amount * order.ratePercent) / 100);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Sample data ──────────────────────────────────────────────────────────────
// Dates are offsets from today (KST) so the sample stays realistic whenever
// it's opened: some orders still pending, some approved, a closed month behind.

const PRODUCTS = [
  { handle: 'biteme-jumping-boogie-auto-ball-toy', title: 'Jumping Boogie Auto Ball Toy' },
  { handle: 'koala-rope-ball-toy', title: 'Koala Rope Ball Toy' },
  { handle: 'comfort-harness-v2', title: 'Comfort Harness v2' },
  { handle: 'hate-me-band-3-types', title: 'Hate Me Band (3 types)' },
  { handle: 'zero-guard-mat', title: 'Zero Guard Mat' },
];

/** Rough clicks per 30 days for each product link (PRODUCTS order); 0 = not shared. */
function clicks(...counts: number[]) {
  return counts.map((c, i) => ({ ...PRODUCTS[i], clicks: c })).filter((l) => l.clicks > 0);
}

interface SamplePartner extends Omit<AffiliatePartner, 'joinedAt' | 'sharedLinks'> {
  joinedDaysAgo: number;
  linkClicks: { handle: string; title: string; clicks: number }[];
}

/** Spreads each link's 30-day volume over the days since joining, with a stable wobble. */
function sampleClickDays(partner: SamplePartner, today: string): LinkClickDay[] {
  const days: LinkClickDay[] = [];
  let seed = [...partner.id].reduce((s, ch) => (s * 31 + ch.charCodeAt(0)) >>> 0, 7);
  for (const link of partner.linkClicks) {
    for (let ago = partner.joinedDaysAgo; ago >= 0; ago--) {
      seed = (seed * 1103515245 + 12345) >>> 0;
      const clicks = Math.round((link.clicks / 30) * (0.3 + ((seed >>> 16) % 1000) / 714));
      if (clicks > 0) days.push({ date: addDays(today, -ago), partnerId: partner.id, handle: link.handle, clicks });
    }
  }
  return days;
}
interface SampleOrder extends Omit<AttributedOrder, 'orderedAt' | 'ratePercent' | 'landingHandle'> {
  daysAgo: number;
  product: number;
}

const SAMPLE_PARTNERS: SamplePartner[] = [
  { id: 'K7MXQ2', name: 'Emily Carter', email: 'emily.carter@gmail.com', countryCode: 'US', joinedDaysAgo: 96, status: 'active', paypalEmail: 'emily.carter@gmail.com', linkClicks: clicks(184, 96, 41) },
  { id: 'R4TWNB', name: 'Grace Tan', email: 'gracetan.sg@gmail.com', countryCode: 'SG', joinedDaysAgo: 88, status: 'active', paypalEmail: 'grace.tan@outlook.com', linkClicks: clicks(52, 0, 120, 18) },
  { id: 'HZ8CPV', name: 'Olivia Brown', email: 'olivia.b@yahoo.com', countryCode: 'AU', joinedDaysAgo: 81, status: 'active', linkClicks: clicks(23, 61) },
  { id: 'W3JDKE', name: 'Chloe Wong', email: 'chloe.wong@gmail.com', countryCode: 'HK', joinedDaysAgo: 74, status: 'active', paypalEmail: 'chloe.wong@gmail.com', linkClicks: clicks(12, 9, 0, 0, 30) },
  { id: 'P9GYSA', name: 'Mia Johnson', email: 'mia.johnson@icloud.com', countryCode: 'CA', joinedDaysAgo: 69, status: 'active', paypalEmail: 'mia.j@icloud.com', linkClicks: clicks(8, 4) },
  { id: 'D2LQUF', name: 'Hannah Lee', email: 'hannah.lee@gmail.com', countryCode: 'US', joinedDaysAgo: 41, status: 'suspended', paypalEmail: 'hannah.lee@gmail.com', linkClicks: clicks(3) },
  { id: 'B6NVRT', name: 'Jasmine Lin', email: 'jasmine.lin@gmail.com', countryCode: 'SG', joinedDaysAgo: 22, status: 'active', linkClicks: clicks(15, 7) },
  { id: 'M5EHXC', name: 'Sophie Martin', email: 'sophie.martin@gmail.com', countryCode: 'GB', joinedDaysAgo: 6, status: 'active', paypalEmail: 'sophie.martin@gmail.com', linkClicks: clicks(37, 0, 14) },
  { id: 'T8ZKWP', name: 'Aria Kim', email: 'aria.kim@naver.com', countryCode: 'US', joinedDaysAgo: 3, status: 'active', paypalEmail: 'aria.kim@naver.com', linkClicks: clicks(5) },
  { id: 'Q3RUMY', name: 'Lucas Silva', email: 'lucas.silva@gmail.com', countryCode: 'BR', joinedDaysAgo: 2, status: 'active', linkClicks: [] },
  { id: 'N7FAGJ', name: 'Ella Davis', email: 'ella.davis@gmail.com', countryCode: 'US', joinedDaysAgo: 58, status: 'removed', linkClicks: [] },
];

const SAMPLE_ORDERS: SampleOrder[] = [
  // Approved in the month before last (closed, paid)
  { id: '#1502', daysAgo: 92, partnerId: 'K7MXQ2', product: 0, amount: 128.4, shippingCountry: 'United States', guest: false },
  { id: '#1517', daysAgo: 88, partnerId: 'K7MXQ2', product: 1, amount: 96.0, shippingCountry: 'United States', guest: true },
  { id: '#1523', daysAgo: 85, partnerId: 'R4TWNB', product: 2, amount: 154.9, shippingCountry: 'Singapore', guest: false },
  { id: '#1531', daysAgo: 79, partnerId: 'HZ8CPV', product: 1, amount: 64.5, shippingCountry: 'Australia', guest: false },
  { id: '#1540', daysAgo: 72, partnerId: 'W3JDKE', product: 4, amount: 88.0, shippingCountry: 'Hong Kong', guest: true },
  // Approved last month (to be closed now)
  { id: '#1561', daysAgo: 61, partnerId: 'K7MXQ2', product: 0, amount: 212.3, shippingCountry: 'United States', guest: false },
  { id: '#1566', daysAgo: 58, partnerId: 'R4TWNB', product: 2, amount: 176.0, shippingCountry: 'Singapore', guest: false },
  { id: '#1570', daysAgo: 55, partnerId: 'P9GYSA', product: 0, amount: 74.9, shippingCountry: 'Canada', guest: true },
  { id: '#1574', daysAgo: 52, partnerId: 'HZ8CPV', product: 1, amount: 119.0, shippingCountry: 'Australia', guest: false },
  { id: '#1579', daysAgo: 49, partnerId: 'W3JDKE', product: 4, amount: 59.5, shippingCountry: 'Hong Kong', guest: false, outcome: 'refunded' },
  { id: '#1588', daysAgo: 45, partnerId: 'D2LQUF', product: 0, amount: 86.0, shippingCountry: 'United States', guest: false, outcome: 'self-purchase' },
  { id: '#1593', daysAgo: 40, partnerId: 'K7MXQ2', product: 2, amount: 1240.0, shippingCountry: 'United States', guest: false, outcome: 'excluded-b2b' },
  // Approved earlier this month
  { id: '#1601', daysAgo: 33, partnerId: 'R4TWNB', product: 2, amount: 131.5, shippingCountry: 'Singapore', guest: true },
  // This month / still pending
  { id: '#1612', daysAgo: 24, partnerId: 'R4TWNB', product: 2, amount: 142.6, shippingCountry: 'Singapore', guest: false },
  { id: '#1618', daysAgo: 20, partnerId: 'B6NVRT', product: 0, amount: 79.0, shippingCountry: 'Singapore', guest: false },
  { id: '#1627', daysAgo: 15, partnerId: 'K7MXQ2', product: 1, amount: 168.2, shippingCountry: 'United States', guest: true },
  { id: '#1633', daysAgo: 11, partnerId: 'HZ8CPV', product: 1, amount: 92.4, shippingCountry: 'Australia', guest: false },
  { id: '#1641', daysAgo: 6, partnerId: 'K7MXQ2', product: 0, amount: 236.8, shippingCountry: 'United States', guest: false },
  { id: '#1644', daysAgo: 5, partnerId: 'M5EHXC', product: 0, amount: 104.5, shippingCountry: 'United Kingdom', guest: true },
  { id: '#1646', daysAgo: 4, partnerId: 'P9GYSA', product: 1, amount: 58.0, shippingCountry: 'Canada', guest: false },
  { id: '#1648', daysAgo: 3, partnerId: 'W3JDKE', product: 4, amount: 71.3, shippingCountry: 'Hong Kong', guest: false },
  { id: '#1650', daysAgo: 2, partnerId: 'M5EHXC', product: 2, amount: 63.9, shippingCountry: 'United Kingdom', guest: false, outcome: 'self-purchase' },
  { id: '#1652', daysAgo: 1, partnerId: 'T8ZKWP', product: 0, amount: 48.0, shippingCountry: 'United States', guest: true },
  { id: '#1655', daysAgo: 0, partnerId: 'R4TWNB', product: 3, amount: 1580.0, shippingCountry: 'Singapore', guest: false, outcome: 'excluded-b2b' },
];

/**
 * Dev-only: append ?devEmpty=1 locally to preview the empty states (same flag
 * as the #157 dashboard). Statically false in production builds.
 */
function isDevEmptyPreview(): boolean {
  if (!import.meta.env.DEV) return false;
  return new URLSearchParams(window.location.search).get('devEmpty') === '1';
}

export interface AffiliateAdminSample {
  partners: AffiliatePartner[];
  orders: AttributedOrder[];
  clicks: LinkClickDay[];
  linkCopies: LinkCopyDay[];
  /** Months already auto-closed (each closes on the 1st of the next month, 00:00 KST). */
  closedMonths: string[];
  /** Payout rows already marked paid, by payoutKey(). */
  paidAt: Record<string, string>;
  /** Last "Add your PayPal" reminder per partner ID (KST date). */
  remindedAt: Record<string, string>;
}

export function getSampleAffiliateAdmin(today = kstToday()): AffiliateAdminSample {
  if (isDevEmptyPreview()) return { partners: [], orders: [], clicks: [], linkCopies: [], closedMonths: [], paidAt: {}, remindedAt: {} };

  const partners = SAMPLE_PARTNERS.map(({ joinedDaysAgo, linkClicks, ...p }) => ({
    ...p,
    joinedAt: addDays(today, -joinedDaysAgo),
    sharedLinks: linkClicks.map(({ handle, title }) => ({ handle, title })),
  }));
  const clicks = SAMPLE_PARTNERS.flatMap((p) => sampleClickDays(p, today));
  // Roughly one copy per six clicks on the same day — enough to look plausible.
  const linkCopies = clicks
    .map(({ clicks: n, ...c }) => ({ ...c, copies: Math.round(n / 6) }))
    .filter((c) => c.copies > 0);
  const orders = SAMPLE_ORDERS
    .map(({ daysAgo, product, ...o }) => ({
      ...o,
      orderedAt: addDays(today, -daysAgo),
      landingHandle: PRODUCTS[product].handle,
      ratePercent: AFFILIATE_COMMISSION_PERCENT,
    }))
    .sort((a, b) => b.orderedAt.localeCompare(a.orderedAt));

  // Every month up to last month was auto-closed on the 1st (KST). Last month's
  // payouts are still to be paid; earlier months went out on the 25th.
  const lastMonth = addMonths(monthOf(today), -1);
  const firstMonth = monthOf(orders[orders.length - 1]?.orderedAt ?? today);
  const closedMonths: string[] = [];
  for (let m = firstMonth; m <= lastMonth; m = addMonths(m, 1)) closedMonths.push(m);

  const sample: AffiliateAdminSample = { partners, orders, clicks, linkCopies, closedMonths, paidAt: {}, remindedAt: {} };
  for (const month of closedMonths.filter((m) => m < lastMonth)) {
    for (const row of buildPayouts(sample, month, today)) {
      if (row.status === 'ready') sample.paidAt[payoutKey(row)] = `${addMonths(month, 1)}-25`;
    }
  }
  return sample;
}

// ─── Payouts ──────────────────────────────────────────────────────────────────

export type PayoutStatus = 'ready' | 'carried-over' | 'paid' | 'missing-paypal';

export interface PayoutRow {
  month: string;
  partnerId: string;
  partnerName: string;
  paypalEmail?: string;
  /** Approved in this month + balance carried over from earlier months. */
  amount: number;
  carriedIn: number;
  status: PayoutStatus;
  paidAt?: string;
}

export function payoutKey(row: { month: string; partnerId: string }): string {
  return `${row.month}:${row.partnerId}`;
}

/** Commission approved per partner within a month (by approval date). */
function approvedInMonth(orders: AttributedOrder[], month: string, today: string): Map<string, number> {
  const totals = new Map<string, number>();
  for (const o of orders) {
    if (orderStatus(o, today) !== 'approved' || monthOf(approvesOn(o)) !== month) continue;
    totals.set(o.partnerId, round2((totals.get(o.partnerId) ?? 0) + orderCommission(o)));
  }
  return totals;
}

/**
 * Payout rows for one month, walking every earlier month so balances under
 * $20 (or with no PayPal email) carry into the next cutoff. `paidAt` marks
 * rows already paid.
 */
export function buildPayouts(
  data: Pick<AffiliateAdminSample, 'partners' | 'orders' | 'paidAt'>,
  month: string,
  today: string,
): PayoutRow[] {
  const firstMonth = data.orders.reduce((m, o) => (monthOf(approvesOn(o)) < m ? monthOf(approvesOn(o)) : m), month);
  const carry = new Map<string, number>();
  let rows: PayoutRow[] = [];

  for (let m = firstMonth; m <= month; m = addMonths(m, 1)) {
    const approved = approvedInMonth(data.orders, m, today);
    const ids = new Set([...approved.keys(), ...carry.keys()]);
    rows = [];
    for (const id of ids) {
      const partner = data.partners.find((p) => p.id === id);
      const carriedIn = carry.get(id) ?? 0;
      const amount = round2(carriedIn + (approved.get(id) ?? 0));
      if (amount <= 0) continue;
      const key = payoutKey({ month: m, partnerId: id });
      const status: PayoutStatus = data.paidAt[key]
        ? 'paid'
        : !partner?.paypalEmail
          ? 'missing-paypal'
          : amount < AFFILIATE_MIN_PAYOUT_USD ? 'carried-over' : 'ready';
      rows.push({
        month: m, partnerId: id, partnerName: partner?.name ?? id, paypalEmail: partner?.paypalEmail,
        amount, carriedIn, status, paidAt: data.paidAt[key],
      });
    }
    carry.clear();
    for (const r of rows) if (r.status === 'carried-over' || r.status === 'missing-paypal') carry.set(r.partnerId, r.amount);
  }
  return rows.sort((a, b) => b.amount - a.amount);
}

/**
 * PayPal Payouts bulk file: one row per recipient, no header —
 * email, amount, currency, reference ID, note. Only "Ready" rows go in.
 */
export function buildPayPalPayoutsCsv(rows: PayoutRow[]): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return rows
    .filter((r) => r.status === 'ready' && r.paypalEmail)
    .map((r) => [
      r.paypalEmail!, r.amount.toFixed(2), 'USD', `${r.month}-${r.partnerId}`,
      `BITE ME affiliate commission ${formatMonth(r.month)}`,
    ].map(esc).join(','))
    .join('\n');
}

// ─── Per-partner stats ────────────────────────────────────────────────────────

/** Orders that earn commission (pending or approved). */
export function isCountedOrder(order: AttributedOrder, today: string): boolean {
  const s = orderStatus(order, today);
  return s === 'pending' || s === 'approved';
}

export interface PartnerRow extends AffiliatePartner {
  clicks: number;
  orders: number;
  sales: number;
  commission: number;
  /** Approved commission not paid out yet (incl. carried over) = sum of unpaidParts. */
  unpaidBalance: number;
  /** Where the unpaid balance sits in Payouts, month by month. */
  unpaidParts: UnpaidPart[];
  /** Attributed orders of any status, all time — Delete is only offered at 0. */
  totalOrders: number;
  links: AffiliateLinkStat[];
}

export interface UnpaidPart {
  month: string;
  amount: number;
  status: PayoutStatus;
}

/**
 * The partner's unpaid money exactly as Payouts lists it: Ready rows of past months
 * not marked paid yet, plus the current month's row (which already includes anything
 * carried over). Partners table and Payouts both read from here, so they always match.
 */
export function unpaidParts(
  data: Pick<AffiliateAdminSample, 'partners' | 'orders' | 'paidAt'>,
  partnerId: string,
  today: string,
): UnpaidPart[] {
  const current = monthOf(today);
  const firstMonth = data.orders.reduce((m, o) => (monthOf(approvesOn(o)) < m ? monthOf(approvesOn(o)) : m), current);
  const parts: UnpaidPart[] = [];
  for (let m = firstMonth; m < current; m = addMonths(m, 1)) {
    const row = buildPayouts(data, m, today).find((x) => x.partnerId === partnerId);
    if (row?.status === 'ready') parts.push({ month: m, amount: row.amount, status: row.status });
  }
  const now = buildPayouts(data, current, today).find((x) => x.partnerId === partnerId);
  if (now && now.status !== 'paid') parts.push({ month: current, amount: now.amount, status: now.status });
  return parts;
}

/**
 * Clicks, orders, sales, commission and per-link stats cover `range` (orders by
 * order date); the unpaid balance is all-time.
 */
export function buildPartnerRows(
  data: Pick<AffiliateAdminSample, 'partners' | 'orders' | 'clicks' | 'paidAt'>,
  today: string,
  range: DateRange,
): PartnerRow[] {
  return data.partners.map((p) => {
    const all = data.orders.filter((o) => o.partnerId === p.id);
    const inPeriod = all.filter((o) => inRange(o.orderedAt, range) && isCountedOrder(o, today));
    const clicksInPeriod = data.clicks.filter((c) => c.partnerId === p.id && inRange(c.date, range));
    const parts = unpaidParts(data, p.id, today);

    const links: AffiliateLinkStat[] = p.sharedLinks
      .map((l) => {
        const linkOrders = inPeriod.filter((o) => o.landingHandle === l.handle);
        return {
          handle: l.handle,
          title: l.title,
          clicks: clicksInPeriod.filter((c) => c.handle === l.handle).reduce((s, c) => s + c.clicks, 0),
          orders: linkOrders.length,
          commission: round2(linkOrders.reduce((s, o) => s + orderCommission(o), 0)),
        };
      })
      .filter((l) => l.clicks > 0 || l.orders > 0)
      .sort((a, b) => b.clicks - a.clicks);

    return {
      ...p,
      clicks: clicksInPeriod.reduce((s, c) => s + c.clicks, 0),
      orders: inPeriod.length,
      sales: round2(inPeriod.reduce((s, o) => s + o.amount, 0)),
      commission: round2(inPeriod.reduce((s, o) => s + orderCommission(o), 0)),
      unpaidBalance: round2(parts.reduce((s, x) => s + x.amount, 0)),
      unpaidParts: parts,
      totalOrders: all.length,
      links,
    };
  });
}

// ─── Formatting ───────────────────────────────────────────────────────────────

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
export const formatUsd = (n: number) => usd.format(n);

/** em***@gmail.com — full PayPal addresses only go into the payout CSV. */
export function maskEmail(email?: string): string {
  if (!email) return '—';
  const [user, domain] = email.split('@');
  return `${user.slice(0, 2)}${'*'.repeat(Math.max(3, user.length - 2))}@${domain}`;
}
