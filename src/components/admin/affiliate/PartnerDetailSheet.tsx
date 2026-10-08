import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  approvesOn, buildAffiliateLink, countryName, buildPayouts, formatMonth, formatUsd, maskEmail, orderCommission, orderStatus,
  type AffiliateAdminSample, type PartnerRow,
} from './affiliateAdminData';
import { EmptyRow, ORDER_STATUS, PARTNER_STATUS, PAYOUT_STATUS, StatusBadge, TEXT_COL, VALUE_COL } from './adminUi';

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm break-all">{children}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

const MINI_TH = 'py-2 pr-2 font-medium text-muted-foreground text-xs whitespace-nowrap';
const MINI_TD = 'py-2 pr-2 text-xs';

export function PartnerDetailSheet({ partner, data, today, periodLabel, onClose, onSuspend, onReactivate, onRemove, onDelete }: {
  partner: PartnerRow | undefined;
  /** Short label of the selected period, e.g. "Sep 1 – Sep 30, 2026". */
  periodLabel: string;
  data: AffiliateAdminSample;
  today: string;
  onClose: () => void;
  onSuspend: (id: string) => void;
  onReactivate: (id: string) => void;
  onRemove: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const orders = partner ? data.orders.filter((o) => o.partnerId === partner.id) : [];
  const payouts = partner
    ? data.closedMonths
      .map((m) => buildPayouts(data, m, today).find((r) => r.partnerId === partner.id))
      .filter((r) => r !== undefined)
      .reverse()
    : [];

  return (
    <Sheet open={!!partner} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        {partner && (
          <div className="space-y-5">
            <SheetHeader className="text-left">
              <div className="flex items-center gap-2">
                <SheetTitle>{partner.name}</SheetTitle>
                <StatusBadge config={PARTNER_STATUS[partner.status]} />
              </div>
              <SheetDescription className="font-mono">{partner.id}</SheetDescription>
            </SheetHeader>

            <div className="flex flex-wrap gap-2">
              {partner.status === 'active' && (
                <Button variant="outline" size="sm" onClick={() => onSuspend(partner.id)}>Suspend</Button>
              )}
              {partner.status === 'suspended' && (
                <Button variant="outline" size="sm" onClick={() => onReactivate(partner.id)}>Reactivate</Button>
              )}
              {partner.status !== 'removed' && (
                <Button variant="outline" size="sm" onClick={() => onRemove(partner.id)}>Remove</Button>
              )}
              {partner.totalOrders === 0 && (
                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={() => onDelete(partner.id)}>
                  Delete
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Info label="Email">{partner.email}</Info>
              <Info label="Country (default shipping)">{countryName(partner.countryCode)} ({partner.countryCode})</Info>
              <Info label="Joined">{partner.joinedAt}</Info>
              <Info label="PayPal email">
                {partner.paypalEmail ? maskEmail(partner.paypalEmail) : <span className="text-red-600">Missing</span>}
              </Info>
              <div className="sm:col-span-2">
                <Info label="Partner link">{buildAffiliateLink(partner.id)}</Info>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                ['Clicks', String(partner.clicks)],
                ['Orders', String(partner.orders)],
                ['Sales', formatUsd(partner.sales)],
                ['Unpaid', formatUsd(partner.unpaidBalance)],
              ].map(([label, value]) => (
                <div key={label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-lg font-bold">{value}</p>
                  <p className="text-[10px] text-muted-foreground">{label !== 'Unpaid' ? `${label} · selected period` : 'Unpaid · all time'}</p>
                </div>
              ))}
            </div>

            <Separator />

            <Section title={`Shared links · ${periodLabel}`}>
              {partner.links.length === 0 ? (
                <EmptyRow>No link clicks in this period.</EmptyRow>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className={`${MINI_TH} ${TEXT_COL}`}>Product</th>
                      <th className={`${MINI_TH} ${VALUE_COL}`}>Clicks</th>
                      <th className={`${MINI_TH} ${VALUE_COL}`}>Orders</th>
                      <th className={`${MINI_TH} ${VALUE_COL}`}>Commission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partner.links.map((l) => (
                      <tr key={l.handle} className="border-b last:border-0">
                        <td className={`${MINI_TD} ${TEXT_COL}`}>
                          <a href={`/product/${l.handle}`} target="_blank" rel="noreferrer" className="hover:underline">{l.title}</a>
                        </td>
                        <td className={`${MINI_TD} ${VALUE_COL}`}>{l.clicks}</td>
                        <td className={`${MINI_TD} ${VALUE_COL}`}>{l.orders}</td>
                        <td className={`${MINI_TD} ${VALUE_COL}`}>{formatUsd(l.commission)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>

            <Section title="Orders · all time">
              {orders.length === 0 ? (
                <EmptyRow>No attributed orders.</EmptyRow>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className={`${MINI_TH} ${TEXT_COL}`}>Order</th>
                      <th className={`${MINI_TH} ${VALUE_COL}`}>Date</th>
                      <th className={`${MINI_TH} ${VALUE_COL}`}>Amount</th>
                      <th className={`${MINI_TH} ${VALUE_COL}`}>Commission</th>
                      <th className={`${MINI_TH} ${VALUE_COL}`}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => {
                      const status = orderStatus(o, today);
                      return (
                        <tr key={o.id} className="border-b last:border-0">
                          <td className={`${MINI_TD} ${TEXT_COL} font-mono`}>{o.id}</td>
                          <td className={`${MINI_TD} ${VALUE_COL} text-muted-foreground whitespace-nowrap`}>{o.orderedAt}</td>
                          <td className={`${MINI_TD} ${VALUE_COL}`}>{formatUsd(o.amount)}</td>
                          <td className={`${MINI_TD} ${VALUE_COL}`}>{formatUsd(orderCommission(o))}</td>
                          <td className={`${MINI_TD} ${VALUE_COL}`}>
                            <StatusBadge config={ORDER_STATUS[status]} />
                            {status === 'pending' && <p className="text-[10px] text-muted-foreground mt-0.5">Approves {approvesOn(o)}</p>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </Section>

            <Section title="Payouts · all time">
              {payouts.length === 0 ? (
                <EmptyRow>No payouts yet.</EmptyRow>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className={`${MINI_TH} ${VALUE_COL}`}>Month</th>
                      <th className={`${MINI_TH} ${VALUE_COL}`}>Amount</th>
                      <th className={`${MINI_TH} ${VALUE_COL}`}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.map((r) => (
                      <tr key={r.month} className="border-b last:border-0">
                        <td className={`${MINI_TD} ${VALUE_COL}`}>{formatMonth(r.month)}</td>
                        <td className={`${MINI_TD} ${VALUE_COL}`}>{formatUsd(r.amount)}</td>
                        <td className={`${MINI_TD} ${VALUE_COL}`}>
                          <StatusBadge config={PAYOUT_STATUS[r.status]} />
                          {r.paidAt && <span className="ml-2 text-[10px] text-muted-foreground">{r.paidAt}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
