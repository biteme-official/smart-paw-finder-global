import type { ReactNode } from 'react';
import { Ban, CheckCircle, Clock, DollarSign, ShoppingBag, type LucideIcon } from 'lucide-react';
import {
  AFFILIATE_APPROVAL_DAYS, AFFILIATE_ATTRIBUTION_DAYS, AFFILIATE_COMMISSION_PERCENT,
  approvesOn, formatUsd, inRange, isCountedOrder, orderCommission, orderStatus, round2,
  type AttributedOrder, type DateRange,
} from './affiliateAdminData';

/** periodLabel: e.g. "This month: Oct 1 – Oct 7, 2026" */
export function ProgramRulesBar({ periodLabel }: { periodLabel: string }) {
  const rules = [
    `${AFFILIATE_COMMISSION_PERCENT}% commission`,
    `${AFFILIATE_ATTRIBUTION_DAYS}-day attribution`,
    `Approved after ${AFFILIATE_APPROVAL_DAYS} days`,
    'B2B & self-purchases excluded',
    `${periodLabel} (KST)`,
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

/** Orders placed in the period; approved commission = approved during the period. */
export function PeriodCards({ orders, today, range, title }: {
  orders: AttributedOrder[]; today: string; range: DateRange; title: string;
}) {
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
      <h2 className="text-sm font-semibold mb-2">{title}</h2>
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
