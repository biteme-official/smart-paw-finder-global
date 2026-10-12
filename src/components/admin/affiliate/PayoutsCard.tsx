import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AFFILIATE_MIN_PAYOUT_USD, addMonths, buildPayPalPayoutsCsv, buildPayouts, formatMonth, formatUsd, maskEmail, monthOf,
  round2, type AffiliateAdminSample, type PayoutRow, type PayoutStatus,
} from './affiliateAdminData';
import {
  CellTooltip, EmptyRow, PAYOUT_STATUS, RowAction, SectionCard, StatusBadge, TABLE_WRAP, TD, TEXT_COL, TH, TR, VALUE_COL,
} from './adminUi';

const STATUS_REASON: Partial<Record<PayoutStatus, string>> = {
  ready: `$${AFFILIATE_MIN_PAYOUT_USD}+ · Ready to pay`,
  'carried-over': `Under $${AFFILIATE_MIN_PAYOUT_USD} · Rolls into next month`,
  'missing-paypal': 'Add PayPal to get paid',
};

function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** 'Nov 1' — the day a month auto-closes (00:00 KST). */
function closeDay(month: string): string {
  return new Date(`${addMonths(month, 1)}-01T00:00:00Z`).toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** 'Nov 30' — payouts for `month` go out by the end of the month after it closes. */
function payByDay(month: string): string {
  const [y, m] = addMonths(month, 1).split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function PayoutStatusBadge({ status }: { status: PayoutStatus }) {
  const reason = STATUS_REASON[status];
  const badge = <StatusBadge config={PAYOUT_STATUS[status]} />;
  if (!reason) return badge;
  return <CellTooltip content={reason}>{badge}</CellTooltip>;
}

/** '2026-10-08' → '10/08' */
const monthDay = (date: string) => `${date.slice(5, 7)}/${date.slice(8, 10)}`;

export function PayoutsCard({ data, today, onMarkPaid, onRemind }: {
  data: AffiliateAdminSample;
  today: string;
  onMarkPaid: (row: PayoutRow) => void;
  /** Ask a partner without a PayPal email to add one (shown on their next login). */
  onRemind: (row: PayoutRow) => void;
}) {
  const { closedMonths } = data;
  // Each month auto-closes on the 1st of the next month, 00:00 KST. The current month
  // is a running preview; a past month that isn't closed means the auto-close is overdue.
  const currentMonth = monthOf(today);
  const lastMonth = addMonths(currentMonth, -1);
  const overdue = closedMonths.length > 0 && !closedMonths.includes(lastMonth) ? [lastMonth] : [];
  const monthOptions = [currentMonth, ...overdue, ...[...closedMonths].reverse()];

  // One month drives the status line, the table and the CSV.
  const [picked, setPicked] = useState(currentMonth);
  const month = monthOptions.includes(picked) ? picked : currentMonth;
  const closed = closedMonths.includes(month);

  const rows = buildPayouts(data, month, today);
  const ready = rows.filter((r) => r.status === 'ready');
  const heldRows = rows.filter((r) => r.status === 'carried-over' || r.status === 'missing-paypal');
  const held = heldRows.length;
  const sumOf = (list: PayoutRow[]) => round2(list.reduce((s, r) => s + r.amount, 0));
  const paidSum = sumOf(rows.filter((r) => r.status === 'paid'));

  const exportCsv = () => {
    downloadCsv(`paypal-payouts-${month}.csv`, buildPayPalPayoutsCsv(rows));
  };

  // Ready payouts of earlier closed months that aren't marked paid yet. They still count
  // in the Partners table's Unpaid balance, so point to them from any other month.
  const earlierUnpaid = closedMonths
    .filter((m) => m !== month)
    .map((m) => ({ month: m, rows: buildPayouts(data, m, today).filter((r) => r.status === 'ready') }))
    .filter((x) => x.rows.length > 0);

  const optionLabel = (m: string) => {
    if (m === currentMonth) return `${formatMonth(m)} (in progress)`;
    if (!closedMonths.includes(m)) return `${formatMonth(m)} (not closed)`;
    return formatMonth(m);
  };

  return (
    <SectionCard
      title="Payouts"
      description={`Not affected by the date filter · Auto-closes on the 1st (00:00 KST) · Paid next month via PayPal (USD) · Under $${AFFILIATE_MIN_PAYOUT_USD} carries over`}
      action={
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!closed || ready.length === 0}
          title={closed ? undefined : `Available after ${formatMonth(month)} closes`}>
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
            {monthOptions.map((m) => <option key={m} value={m}>{optionLabel(m)}</option>)}
          </select>
        </div>
        <div className="rounded-lg border px-4 py-2.5 text-sm">
          <span className="font-medium">{formatMonth(month)}</span>
          {closed ? (
            <span className="text-muted-foreground"> · Closed on {closeDay(month)} · Pays by {payByDay(month)}: </span>
          ) : month === currentMonth ? (
            <span className="text-muted-foreground"> · Auto-closes on {closeDay(month)} · Pays by {payByDay(month)} · So far: </span>
          ) : (
            <span className="text-red-600"> · Auto-close didn't run on {closeDay(month)}: </span>
          )}
          <span className="font-bold">{formatUsd(round2(ready.reduce((s, r) => s + r.amount, 0)))}</span>
          <span className="text-muted-foreground"> · {ready.length} {ready.length === 1 ? 'partner' : 'partners'}</span>
          {held > 0 && <span className="text-muted-foreground"> · {held} held</span>}
        </div>
      </div>

      {earlierUnpaid.map((x) => (
        <p key={x.month} className="mb-3 text-xs text-muted-foreground">
          {formatMonth(x.month)} still has {x.rows.length} unpaid Ready {x.rows.length === 1 ? 'payout' : 'payouts'} (
          {formatUsd(round2(x.rows.reduce((s, r) => s + r.amount, 0)))}: {x.rows.map((r) => r.partnerName).join(', ')}).{' '}
          <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => setPicked(x.month)}>
            View {formatMonth(x.month)}
          </button>
        </p>
      ))}

      {rows.length === 0 ? (
        <EmptyRow>
          {closedMonths.length === 0
            ? 'No closed months yet. First approvals start 30 days after the first order.'
            : `No approved commission in ${formatMonth(month)}${closed ? '' : ' yet'}.`}
        </EmptyRow>
      ) : (
        <>
          <div className={TABLE_WRAP}>
            {/* Fixed column shares so the table always spans the card: 25 / 25 / 20 / 20 / 10. */}
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-1/4" />
                <col className="w-1/4" />
                <col className="w-1/5" />
                <col className="w-1/5" />
                <col className="w-[10%]" />
              </colgroup>
              <thead>
                <tr className="border-b bg-gray-50/50">
                  <th className={`${TH} ${TEXT_COL}`}>Partner</th>
                  <th className={`${TH} ${TEXT_COL}`}>PayPal email</th>
                  <th className={`${TH} ${VALUE_COL}`}>Amount</th>
                  <th className={`${TH} ${VALUE_COL}`}>Status</th>
                  <th className={`${TH} ${VALUE_COL}`}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.partnerId} className={TR}>
                    <td className={`${TD} ${TEXT_COL} truncate`}>
                      <span className="font-medium">{r.partnerName}</span>
                      <span className="ml-2 font-mono text-xs text-muted-foreground">{r.partnerId}</span>
                    </td>
                    <td className={`${TD} ${TEXT_COL} truncate text-xs text-muted-foreground`}>{maskEmail(r.paypalEmail)}</td>
                    <td className={`${TD} ${VALUE_COL} font-medium`}>
                      {formatUsd(r.amount)}
                      {r.carriedIn > 0 && (
                        <p className="text-[10px] font-normal text-muted-foreground">incl. {formatUsd(r.carriedIn)} carried over</p>
                      )}
                    </td>
                    <td className={`${TD} ${VALUE_COL}`}>
                      <PayoutStatusBadge status={r.status} />
                      {r.status === 'carried-over' && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatUsd(round2(AFFILIATE_MIN_PAYOUT_USD - r.amount))} to ${AFFILIATE_MIN_PAYOUT_USD}
                        </p>
                      )}
                      {r.paidAt && <p className="text-[10px] text-muted-foreground mt-0.5">{r.paidAt}</p>}
                    </td>
                    <td className={`${TD} ${VALUE_COL}`}>
                      {closed && r.status === 'ready' && <RowAction onClick={() => onMarkPaid(r)}>Mark as paid</RowAction>}
                      {r.status === 'missing-paypal' && (
                        <span className="inline-flex flex-col items-center gap-0.5">
                          {data.remindedAt[r.partnerId] && (
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">Sent {monthDay(data.remindedAt[r.partnerId])}</span>
                          )}
                          <RowAction onClick={() => onRemind(r)}>Remind</RowAction>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-gray-50/50">
                  <td className={`${TD} ${TEXT_COL} font-medium`} colSpan={2}>Total</td>
                  <td className={`${TD} ${VALUE_COL}`}>
                    <p className="font-bold">{formatUsd(sumOf(rows))}</p>
                    <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                      Ready {formatUsd(sumOf(ready))} · Held {formatUsd(sumOf(heldRows))}
                      {paidSum > 0 && <> · Paid {formatUsd(paidSum)}</>}
                    </p>
                  </td>
                  <td className={TD} colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            Paid when ${AFFILIATE_MIN_PAYOUT_USD}+ with PayPal on file. Under ${AFFILIATE_MIN_PAYOUT_USD} or missing PayPal rolls into next month. CSV includes Ready rows only.
          </p>
        </>
      )}
    </SectionCard>
  );
}
