import { useState } from 'react';
import {
  approvesOn, formatUsd, isCountedOrder, orderCommission, orderStatus, type AttributedOrder, type PartnerRow,
} from './affiliateAdminData';
import {
  EmptyRow, ORDER_STATUS, Pager, RowAction, SectionCard, StatusBadge, TABLE_WRAP, TD, TEXT_COL, TH, TR, VALUE_COL, paginate,
} from './adminUi';

const PAGE_SIZE = 10;

/**
 * `orders` are already limited to the selected period, newest first. The parent
 * re-mounts this card when the period changes, so paging restarts at page 1.
 */
export function AttributedOrdersCard({ orders, partners, today, onVoid, onSelectPartner }: {
  orders: AttributedOrder[];
  partners: PartnerRow[];
  today: string;
  onVoid: (orderId: string) => void;
  onSelectPartner: (partnerId: string) => void;
}) {
  const [page, setPage] = useState(1);
  const paged = paginate(orders, page, PAGE_SIZE);
  const visible = paged.items;
  // Same exclusions as the "Excluded orders" card.
  const excluded = orders.filter((o) => o.outcome === 'self-purchase' || o.outcome === 'excluded-b2b').length;

  return (
    <SectionCard
      title="Attributed orders"
      count={excluded > 0 ? `${orders.length} · ${excluded} excluded` : orders.length}
      description="Orders placed in the selected period. Rate is locked at the time of order."
    >
      {visible.length === 0 ? (
        <EmptyRow>No attributed orders in this period.</EmptyRow>
      ) : (
        <>
          <div className={TABLE_WRAP}>
            {/* Fixed column shares so the table spans the card evenly (same approach as Payouts). */}
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-[10%]" />{/* Order */}
                <col className="w-[11%]" />{/* Date */}
                <col className="w-[13%]" />{/* Partner */}
                <col className="w-[12%]" />{/* Order amount */}
                <col className="w-[7%]" />{/* Rate */}
                <col className="w-[11%]" />{/* Commission */}
                <col className="w-[13%]" />{/* Status */}
                <col className="w-[13%]" />{/* Approves on */}
                <col className="w-[10%]" />{/* Action */}
              </colgroup>
              <thead>
                <tr className="border-b bg-gray-50/50">
                  <th className={`${TH} ${TEXT_COL}`}>Order</th>
                  <th className={`${TH} ${VALUE_COL}`}>Date</th>
                  <th className={`${TH} ${TEXT_COL}`}>Partner</th>
                  <th className={`${TH} ${VALUE_COL}`}>Order amount</th>
                  <th className={`${TH} ${VALUE_COL}`}>Rate</th>
                  <th className={`${TH} ${VALUE_COL}`}>Commission</th>
                  <th className={`${TH} ${VALUE_COL}`}>Status</th>
                  <th className={`${TH} ${VALUE_COL}`}>Approves on</th>
                  <th className={`${TH} ${VALUE_COL}`}>Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((o) => {
                  const status = orderStatus(o, today);
                  const partner = partners.find((p) => p.id === o.partnerId);
                  return (
                    <tr key={o.id} className={TR}>
                      <td className={`${TD} ${TEXT_COL} font-mono text-xs whitespace-nowrap`}>
                        {o.id}
                        {o.guest && <span className="ml-1.5 font-sans text-[10px] text-muted-foreground">Guest</span>}
                      </td>
                      <td className={`${TD} ${VALUE_COL} text-xs text-muted-foreground whitespace-nowrap`}>{o.orderedAt}</td>
                      <td className={`${TD} ${TEXT_COL} whitespace-nowrap`}>
                        <button type="button" onClick={() => onSelectPartner(o.partnerId)} className="text-left hover:underline">
                          <span className="font-mono text-xs">{o.partnerId}</span>
                          {partner && <span className="block text-xs text-muted-foreground">{partner.name}</span>}
                        </button>
                      </td>
                      <td className={`${TD} ${VALUE_COL}`}>{formatUsd(o.amount)}</td>
                      <td className={`${TD} ${VALUE_COL}`}>{o.ratePercent}%</td>
                      <td className={`${TD} ${VALUE_COL} font-medium`}>{formatUsd(orderCommission(o))}</td>
                      <td className={`${TD} ${VALUE_COL}`}><StatusBadge config={ORDER_STATUS[status]} /></td>
                      <td className={`${TD} ${VALUE_COL} text-xs text-muted-foreground whitespace-nowrap`}>
                        {isCountedOrder(o, today) ? approvesOn(o) : '—'}
                      </td>
                      <td className={`${TD} ${VALUE_COL}`}>
                        {status === 'pending' && <RowAction onClick={() => onVoid(o.id)}>Void</RowAction>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pager page={paged.page} pageCount={paged.pageCount} onChange={setPage} />
        </>
      )}
    </SectionCard>
  );
}
