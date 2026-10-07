import { useMemo, useState } from 'react';
import { Handshake } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ManagePageHeader } from '@/components/admin/ManageLayout';
import {
  RANGE_PRESET_LABELS, buildPartnerRows, formatMonth, formatRange, getSampleAffiliateAdmin, inRange, kstToday,
  payoutKey, presetRange, type AffiliateAdminSample, type PartnerStatus, type PayoutRow,
} from '@/components/admin/affiliate/affiliateAdminData';
import { PeriodCards, ProgramRulesBar } from '@/components/admin/affiliate/AffiliateOverview';
import { DateRangeFilter, type PeriodSelection } from '@/components/admin/affiliate/DateRangeFilter';
import { PayoutsCard } from '@/components/admin/affiliate/PayoutsCard';
import { PartnersCard } from '@/components/admin/affiliate/PartnersCard';
import { PartnerDetailSheet } from '@/components/admin/affiliate/PartnerDetailSheet';
import { RecentOrdersCard } from '@/components/admin/affiliate/RecentOrdersCard';
import { TermsUpdatesCard } from '@/components/admin/affiliate/TermsUpdatesCard';

interface PendingConfirm {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  run: () => void;
}

// Everything below runs on sample data — actions only change this page's state.
const notSaved = (message: string) => toast.success(message, { description: 'Preview only — not saved.', position: 'top-center' });

export default function AffiliateAdmin() {
  const [today] = useState(() => kstToday());
  const [data, setData] = useState<AffiliateAdminSample>(() => getSampleAffiliateAdmin(today));
  const [period, setPeriod] = useState<PeriodSelection>(() => ({ preset: 'this-month', range: presetRange('this-month', today) }));
  const [selectedId, setSelectedId] = useState<string>();
  const [confirm, setConfirm] = useState<PendingConfirm>();

  // Period filter applies to the summary cards, the partner stats and the order list —
  // not to Payouts (monthly close) or the all-time unpaid balance.
  const { range } = period;
  const rangeText = formatRange(range);
  const periodTitle = `${RANGE_PRESET_LABELS[period.preset]}: ${rangeText}`;

  const partners = useMemo(() => buildPartnerRows(data, today, range), [data, today, range]);
  const ordersInPeriod = useMemo(() => data.orders.filter((o) => inRange(o.orderedAt, range)), [data.orders, range]);
  const selected = partners.find((p) => p.id === selectedId);
  const nameOf = (id: string) => partners.find((p) => p.id === id)?.name ?? id;

  const setPartnerStatus = (id: string, status: PartnerStatus) => {
    setData((d) => ({ ...d, partners: d.partners.map((p) => (p.id === id ? { ...p, status } : p)) }));
  };

  const voidOrder = (orderId: string) => setConfirm({
    title: `Void order ${orderId}?`,
    description: 'The partner will earn no commission from this order.',
    confirmLabel: 'Void',
    danger: true,
    run: () => {
      setData((d) => ({ ...d, orders: d.orders.map((o) => (o.id === orderId ? { ...o, outcome: 'voided' } : o)) }));
      notSaved(`Order ${orderId} voided`);
    },
  });

  const suspend = (id: string) => setConfirm({
    title: `Suspend ${nameOf(id)}?`,
    description: 'Their link stops earning commission until reactivated. Existing orders are kept.',
    confirmLabel: 'Suspend',
    danger: true,
    run: () => { setPartnerStatus(id, 'suspended'); notSaved(`${nameOf(id)} suspended`); },
  });

  const reactivate = (id: string) => { setPartnerStatus(id, 'active'); notSaved(`${nameOf(id)} reactivated`); };

  const remove = (id: string) => setConfirm({
    title: `Remove ${nameOf(id)}?`,
    description: 'They leave the program and their link stops working. Order and payout history is kept.',
    confirmLabel: 'Remove',
    danger: true,
    run: () => { setPartnerStatus(id, 'removed'); notSaved(`${nameOf(id)} removed`); },
  });

  const deletePartner = (id: string) => setConfirm({
    title: `Delete ${nameOf(id)}?`,
    description: 'This partner has no orders. The record is deleted permanently.',
    confirmLabel: 'Delete',
    danger: true,
    run: () => {
      const name = nameOf(id);
      setSelectedId(undefined);
      setData((d) => ({ ...d, partners: d.partners.filter((p) => p.id !== id) }));
      notSaved(`${name} deleted`);
    },
  });

  const finalizeMonth = (month: string) => setConfirm({
    title: `Finalize ${formatMonth(month)} payouts?`,
    description: `This locks ${formatMonth(month)} amounts and creates the payout list. Continue?`,
    confirmLabel: 'Continue',
    run: () => {
      setData((d) => ({ ...d, closedMonths: [...d.closedMonths, month] }));
      notSaved(`${formatMonth(month)} payouts finalized`);
    },
  });

  const markPaid = (row: PayoutRow) => {
    setData((d) => ({ ...d, paidAt: { ...d.paidAt, [payoutKey(row)]: today } }));
    notSaved(`${row.partnerName} marked as paid`);
  };

  return (
    <div>
      <ManagePageHeader icon={Handshake} heading="Affiliate Partners" />

      <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <p className="text-xs text-muted-foreground">Sample data — not connected to Shopify yet.</p>
          <DateRangeFilter value={period} today={today} onChange={setPeriod} />
        </div>
        <ProgramRulesBar periodLabel={periodTitle} />
        <PeriodCards orders={data.orders} today={today} range={range} title={periodTitle} />
        <PayoutsCard data={data} today={today} onCloseMonth={finalizeMonth} onMarkPaid={markPaid} />
        <PartnersCard partners={partners} onSelect={setSelectedId} />
        <RecentOrdersCard
          orders={ordersInPeriod} partners={partners} today={today}
          onVoid={voidOrder} onSelectPartner={setSelectedId}
        />
        <TermsUpdatesCard />
      </main>

      <PartnerDetailSheet
        partner={selected} data={data} today={today} periodLabel={rangeText} onClose={() => setSelectedId(undefined)}
        onSuspend={suspend} onReactivate={reactivate} onRemove={remove} onDelete={deletePartner}
      />

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={confirm?.danger ? 'bg-red-600 hover:bg-red-700' : undefined}
              onClick={() => confirm?.run()}
            >
              {confirm?.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
