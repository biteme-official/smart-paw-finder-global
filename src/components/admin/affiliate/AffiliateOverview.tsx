import type { ReactNode } from 'react';
import {
  Ban, CheckCircle, Clock, Copy, DollarSign, MousePointer, MousePointerClick, Percent, ShoppingBag, UserPlus, type LucideIcon,
} from 'lucide-react';
import {
  AFFILIATE_APPROVAL_DAYS, AFFILIATE_ATTRIBUTION_DAYS, AFFILIATE_COMMISSION_PERCENT,
  approvesOn, formatUsd, inRange, isCountedOrder, orderCommission, orderStatus, round2,
  type AttributedOrder, type DateRange, type LinkCopyDay, type PartnerRow,
} from './affiliateAdminData';

export function ProgramRulesBar() {
  const rules = [
    `${AFFILIATE_COMMISSION_PERCENT}% commission`,
    `${AFFILIATE_ATTRIBUTION_DAYS}-day attribution`,
    `Approved after ${AFFILIATE_APPROVAL_DAYS} days`,
    'B2B & self-purchases excluded',
  ];
  return (
    <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-green-800">
      <span className="flex items-center gap-1.5 font-semibold">
        <span className="h-2 w-2 rounded-full bg-green-600" /> Program rules
      </span>
      {rules.map((r) => <span key={r}>{r}</span>)}
    </div>
  );
}

// Same card as B2BAdmin's StatCard, with a text value so amounts fit.
function StatCard({ icon: Icon, label, value, hint, color }: {
  icon: LucideIcon; label: string; value: ReactNode; hint?: string; color: string;
}) {
  return (
    <div className="bg-white rounded-lg border p-4 flex items-center gap-3">
      <div className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

/**
 * Activity row + money row for the period. Clicks and orders are summed from the
 * partner rows so the cards always match the Partners table.
 */
export function PeriodCards({ orders, partners, linkCopies, today, range, title }: {
  orders: AttributedOrder[];
  /** Built for the same range (buildPartnerRows). */
  partners: PartnerRow[];
  linkCopies: LinkCopyDay[];
  today: string;
  range: DateRange;
  title: string;
}) {
  const newPartners = partners.filter((p) => inRange(p.joinedAt, range)).length;
  const clickingPartners = partners.filter((p) => p.clicks > 0).length;
  const copies = linkCopies.filter((c) => inRange(c.date, range)).reduce((s, c) => s + c.copies, 0);
  const clicks = partners.reduce((s, p) => s + p.clicks, 0);
  const partnerOrders = partners.reduce((s, p) => s + p.orders, 0);
  const conversion = clicks > 0 ? `${((partnerOrders / clicks) * 100).toFixed(1)}%` : '—';

  const placed = orders.filter((o) => inRange(o.orderedAt, range));
  const counted = placed.filter((o) => isCountedOrder(o, today));
  const excluded = placed.filter((o) => o.outcome === 'self-purchase' || o.outcome === 'excluded-b2b');
  const sum = (list: AttributedOrder[], f: (o: AttributedOrder) => number) => round2(list.reduce((s, o) => s + f(o), 0));

  const pending = sum(placed.filter((o) => orderStatus(o, today) === 'pending'), orderCommission);
  const approved = sum(
    orders.filter((o) => orderStatus(o, today) === 'approved' && inRange(approvesOn(o), range)),
    orderCommission,
  );

  return (
    <div>
      <h2 className="text-sm font-semibold mb-2">{title} <span className="font-normal text-muted-foreground">(KST)</span></h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 mb-3">
        <StatCard icon={UserPlus} label="New partners" value={String(newPartners)} hint="Joined (agreed to terms)" color="bg-purple-50 text-purple-600" />
        <StatCard icon={MousePointerClick} label="Clicking partners" value={String(clickingPartners)} hint="1+ link click" color="bg-purple-50 text-purple-600" />
        <StatCard icon={Copy} label="Link copies" value={String(copies)} hint='"Copy link" presses' color="bg-purple-50 text-purple-600" />
        <StatCard icon={MousePointer} label="Clicks" value={String(clicks)} hint="Bots excluded" color="bg-purple-50 text-purple-600" />
        <StatCard icon={Percent} label="Conversion rate" value={conversion} hint={`${partnerOrders} orders ÷ ${clicks} clicks`} color="bg-purple-50 text-purple-600" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard icon={ShoppingBag} label="Attributed orders" value={String(counted.length)} color="bg-blue-50 text-blue-600" />
        <StatCard icon={DollarSign} label="Attributed sales" value={formatUsd(sum(counted, (o) => o.amount))} color="bg-blue-50 text-blue-600" />
        <StatCard icon={Clock} label="Pending commission" value={formatUsd(pending)} hint={`Waiting ${AFFILIATE_APPROVAL_DAYS} days`} color="bg-yellow-50 text-yellow-600" />
        <StatCard icon={CheckCircle} label="Approved commission" value={formatUsd(approved)} hint="Approved in this period" color="bg-green-50 text-green-600" />
        <StatCard
          icon={Ban}
          label="Excluded orders"
          value={<>{excluded.length}<span className="text-sm font-medium text-muted-foreground"> · {formatUsd(sum(excluded, (o) => o.amount))}</span></>}
          hint="B2B · self-purchase"
          color="bg-gray-100 text-gray-500"
        />
      </div>
    </div>
  );
}
