import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AFFILIATE_MIN_PAYOUT_USD, addMonths, buildPayPalPayoutsCsv, buildPayouts, formatMonth, formatUsd, maskEmail, monthOf,
  round2, type AffiliateAdminSample, type PayoutRow,
} from './affiliateAdminData';
import { EmptyRow, PAYOUT_STATUS, RowAction, SectionCard, StatusBadge, TABLE_WRAP, TD, TH, TR } from './adminUi';

function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function PayoutsCard({ data, today, onCloseMonth, onMarkPaid }: {
  data: AffiliateAdminSample;
  today: string;
  onCloseMonth: (month: string) => void;
  onMarkPaid: (row: PayoutRow) => void;
}) {
  const { closedMonths } = data;
  // The month that ended last is the one to close; the current month can't be closed yet.
  const lastMonth = addMonths(monthOf(today), -1);
  const nextCutoff = closedMonths.includes(lastMonth) ? monthOf(today) : lastMonth;
  const canClose = nextCutoff < monthOf(today);

  const preview = buildPayouts(data, nextCutoff, today);
  const payable = preview.filter((r) => r.status === 'ready');
  const held = preview.length - payable.length;

  const latestClosed = closedMonths[closedMonths.length - 1];
  const [picked, setPicked] = useState<string | undefined>(latestClosed);
  // Jump to the month that was just closed.
  useEffect(() => { setPicked(latestClosed); }, [latestClosed]);
  const month = picked && closedMonths.includes(picked) ? picked : latestClosed;

  const rows = month ? buildPayouts(data, month, today) : [];
  const ready = rows.filter((r) => r.status === 'ready');

  const exportCsv = () => {
    downloadCsv(`paypal-payouts-${month}.csv`, buildPayPalPayoutsCsv(rows));
  };

  return (
    <SectionCard
      title="Payouts"
      description={`Monthly cutoff · Paid next month via PayPal (USD) · Under $${AFFILIATE_MIN_PAYOUT_USD} carries over`}
      action={
        month && (
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={ready.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Export CSV for PayPal Payouts
          </Button>
        )
      }
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="rounded-lg border px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">{formatMonth(nextCutoff)} payout preview: </span>
          <span className="font-bold">{formatUsd(round2(payable.reduce((s, r) => s + r.amount, 0)))}</span>
          <span className="text-muted-foreground"> · {payable.length} {payable.length === 1 ? 'partner' : 'partners'}</span>
          {held > 0 && <span className="text-muted-foreground"> · {held} held (under ${AFFILIATE_MIN_PAYOUT_USD} or missing PayPal)</span>}
        </div>
        <Button size="sm" onClick={() => onCloseMonth(nextCutoff)} disabled={!canClose}
          title={canClose ? undefined : `Can be finalized after ${formatMonth(nextCutoff)} ends (KST)`}>
          Finalize {formatMonth(nextCutoff)} payouts
        </Button>
      </div>

      {closedMonths.length === 0 ? (
        <EmptyRow>No closed months yet. First approvals start 30 days after the first order.</EmptyRow>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-2 text-sm">
            <span className="text-muted-foreground">Month</span>
            <select
              className="border rounded px-2 py-1 text-sm bg-white"
              value={month}
              onChange={(e) => setPicked(e.target.value)}
            >
              {[...closedMonths].reverse().map((m) => <option key={m} value={m}>{formatMonth(m)}</option>)}
            </select>
          </div>
          {rows.length === 0 ? (
            <EmptyRow>No approved commission in {month && formatMonth(month)}.</EmptyRow>
          ) : (
            <div className={TABLE_WRAP}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50/50">
                    <th className={`${TH} text-left`}>Partner</th>
                    <th className={`${TH} text-left`}>PayPal email</th>
                    <th className={`${TH} text-right`}>Amount</th>
                    <th className={`${TH} text-center`}>Status</th>
                    <th className={TH}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.partnerId} className={TR}>
                      <td className={TD}>
                        <span className="font-medium">{r.partnerName}</span>
                        <span className="ml-2 font-mono text-xs text-muted-foreground">{r.partnerId}</span>
                      </td>
                      <td className={`${TD} text-xs text-muted-foreground`}>{maskEmail(r.paypalEmail)}</td>
                      <td className={`${TD} text-right font-medium`}>
                        {formatUsd(r.amount)}
                        {r.carriedIn > 0 && (
                          <p className="text-[10px] font-normal text-muted-foreground">incl. {formatUsd(r.carriedIn)} carried over</p>
                        )}
                      </td>
                      <td className={`${TD} text-center`}>
                        <StatusBadge config={PAYOUT_STATUS[r.status]} />
                        {r.paidAt && <p className="text-[10px] text-muted-foreground mt-0.5">{r.paidAt}</p>}
                      </td>
                      <td className={`${TD} text-right`}>
                        {r.status === 'ready' && <RowAction onClick={() => onMarkPaid(r)}>Mark as paid</RowAction>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[10px] text-muted-foreground mt-2">
            CSV includes Ready rows only, with full PayPal emails. Carried over and Missing PayPal amounts roll into the next cutoff.
          </p>
        </>
      )}
    </SectionCard>
  );
}
