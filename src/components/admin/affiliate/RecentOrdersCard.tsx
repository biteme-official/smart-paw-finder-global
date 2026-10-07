import {
  approvesOn, formatUsd, isRestrictedCountry, orderCommission, orderStatus, type AttributedOrder, type PartnerRow,
} from './affiliateAdminData';
import {
  EmptyRow, ORDER_STATUS, RestrictedBadge, RowAction, SectionCard, StatusBadge, TABLE_WRAP, TD, TH, TR,
} from './adminUi';

const RECENT_LIMIT = 50;

/** `orders` are already limited to the selected period, newest first. */
export function RecentOrdersCard({ orders, partners, today, onVoid, onSelectPartner }: {
  orders: AttributedOrder[];
  partners: PartnerRow[];
  today: string;
  onVoid: (orderId: string) => void;
  onSelectPartner: (partnerId: string) => void;
}) {
  const recent = orders.slice(0, RECENT_LIMIT);
  return (
    <SectionCard
      title="Recent attributed orders"
      count={orders.length > RECENT_LIMIT ? `latest ${RECENT_LIMIT} of ${orders.length}` : orders.length}
      description="Orders placed in the selected period. Rate is locked at the time of order."
    >
      {recent.length === 0 ? (
        <EmptyRow>No attributed orders in this period.</EmptyRow>
      ) : (
        <div className={TABLE_WRAP}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50/50">
                <th className={`${TH} text-left`}>Order</th>
                <th className={`${TH} text-left`}>Date</th>
                <th className={`${TH} text-left`}>Partner</th>
                <th className={`${TH} text-right`}>Order amount</th>
                <th className={`${TH} text-right`}>Rate</th>
                <th className={`${TH} text-right`}>Commission</th>
                <th className={`${TH} text-center`}>Status</th>
                <th className={`${TH} text-left`}>Approves on</th>
                <th className={TH}></th>
              </tr>
            </thead>
            <tbody>
              {recent.map((o) => {
                const status = orderStatus(o, today);
                const partner = partners.find((p) => p.id === o.partnerId);
                return (
                  <tr key={o.id} className={TR}>
                    <td className={`${TD} font-mono text-xs whitespace-nowrap`}>
                      {o.id}
                      {o.guest && <span className="ml-1.5 font-sans text-[10px] text-muted-foreground">Guest</span>}
                      {isRestrictedCountry(o.shippingCountry) && (
                        <div className="mt-1 font-sans"><RestrictedBadge country={o.shippingCountry} /></div>
                      )}
                    </td>
                    <td className={`${TD} text-xs text-muted-foreground whitespace-nowrap`}>{o.orderedAt}</td>
                    <td className={TD}>
                      <button type="button" onClick={() => onSelectPartner(o.partnerId)} className="text-left hover:underline">
                        <span className="font-mono text-xs">{o.partnerId}</span>
                        {partner && <span className="ml-1.5 text-xs text-muted-foreground">{partner.name}</span>}
                      </button>
                    </td>
                    <td className={`${TD} text-right`}>{formatUsd(o.amount)}</td>
                    <td className={`${TD} text-right`}>{o.ratePercent}%</td>
                    <td className={`${TD} text-right font-medium`}>{formatUsd(orderCommission(o))}</td>
                    <td className={`${TD} text-center`}><StatusBadge config={ORDER_STATUS[status]} /></td>
                    <td className={`${TD} text-xs text-muted-foreground whitespace-nowrap`}>{approvesOn(o)}</td>
                    <td className={`${TD} text-right`}>
                      {status === 'pending' && <RowAction onClick={() => onVoid(o.id)}>Void</RowAction>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
