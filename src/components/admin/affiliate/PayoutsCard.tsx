import { useState } from 'react';
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
  const monthOptions = [nextCutoff, ...[...closedMonths].reverse()];

  // One month drives the summary, the table and the CSV. Starts on the next cutoff
  // and stays on that month after it is finalized.
  const [picked, setPicked] = useState(nextCutoff);
  const month = monthOptions.includes(picked) ? picked : nextCutoff;
  const finalized = closedMonths.includes(month);

  const rows = buildPayouts(data, month, today);
  const ready = rows.filter((r) => r.status === 'ready');
  const held = rows.filter((r) => r.status === 'carried-over' || r.status === 'missing-paypal').length;

  const exportCsv = () => {
    downloadCsv(`paypal-payouts-${month}.csv`, buildPayPalPayoutsCsv(rows));
  };

  return (
    <SectionCard
      title="Payouts"
      description={`Monthly cutoff · Paid next month via PayPal (USD) · Under $${AFFILIATE_MIN_PAYOUT_USD} carries over`}
      action={
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!finalized || ready.length === 0}
          title={finalized ? undefined : `Finalize ${formatMonth(month)} first`}>
          <Download className="h-4 w-4 mr-1" /> Export CSV for PayPal Payouts
        </Button>
      }
    >
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Month</span>
          <select
            className="border rounded px-2 py-1 text-sm bg-white"
            value={month}
            onChange={(e) => setPicked(e.target.value)}
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>{formatMonth(m)}{closedMonths.includes(m) ? '' : ' (preview)'}</option>
            ))}
          </select>
        </div>
        <div className="rounded-lg border px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">{formatMonth(month)} {finalized ? 'payout' : 'payout preview'}: </span>
          <span className="font-bold">{formatUsd(round2(ready.reduce((s, r) => s + r.amount, 0)))}</span>
          <span className="text-muted-foreground"> · {ready.length} {ready.length === 1 ? 'partner' : 'partners'}</span>
          {held > 0 && <span className="text-muted-foreground"> · {held} held (under ${AFFILIATE_MIN_PAYOUT_USD} or missing PayPal)</span>}
        </div>
        {finalized ? (
          <StatusBadge config={{ label: 'Finalized', color: 'text-green-600 bg-green-50 border-green-200' }} className="w-fit" />
        ) : (
          <Button size="sm" onClick={() => onCloseMonth(month)} disabled={!canClose}
            title={canClose ? undefined : `Can be finalized after ${formatMonth(month)} ends (KST)`}>
            Finalize {formatMonth(month)} payouts
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyRow>
          {closedMonths.length === 0
            ? 'No closed months yet. First approvals start 30 days after the first order.'
            : `No approved commission in ${formatMonth(month)}.`}
        </EmptyRow>
      ) : (
        <>
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
                      {finalized && r.status === 'ready' && <RowAction onClick={() => onMarkPaid(r)}>Mark as paid</RowAction>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            {finalized
              ? 'CSV includes Ready rows only, with full PayPal emails. Carried over and Missing PayPal amounts roll into the next cutoff.'
              : 'Preview — amounts can still change until this month is finalized.'}
          </p>
        </>
      )}
    </SectionCard>
  );
}
