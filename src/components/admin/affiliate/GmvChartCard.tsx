import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';
import {
  addDays, formatUsd, inRange, isCountedOrder, round2, type AttributedOrder, type DateRange,
} from './affiliateAdminData';
import { EmptyRow, SectionCard } from './adminUi';

// Same blue as the "Attributed sales" card icon (blue-600).
const BAR_COLOR = '#2563eb';

interface DayPoint {
  date: string;
  label: string;
  sales: number;
  orders: number;
}

const shortDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** One point per day in the range (0 on days without orders). */
function buildDays(orders: AttributedOrder[], range: DateRange, today: string): DayPoint[] {
  const counted = orders.filter((o) => inRange(o.orderedAt, range) && isCountedOrder(o, today));
  const days: DayPoint[] = [];
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) {
    const dayOrders = counted.filter((o) => o.orderedAt === d);
    days.push({
      date: d,
      label: shortDate(d),
      sales: round2(dayOrders.reduce((s, o) => s + o.amount, 0)),
      orders: dayOrders.length,
    });
  }
  return days;
}

function DayTooltip({ active, payload }: TooltipProps<number, string>) {
  const point = active ? (payload?.[0]?.payload as DayPoint | undefined) : undefined;
  if (!point) return null;
  return (
    <div className="rounded-md border bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-medium">{point.date}</p>
      <p>Sales <span className="font-semibold">{formatUsd(point.sales)}</span></p>
      <p className="text-muted-foreground">{point.orders} {point.orders === 1 ? 'order' : 'orders'}</p>
    </div>
  );
}

/**
 * Daily affiliate GMV. Uses the same orders as the "Attributed sales" card
 * (B2B, self-purchase, voided and refunded left out), so the bars add up to it.
 */
export function GmvChartCard({ orders, range, today }: { orders: AttributedOrder[]; range: DateRange; today: string }) {
  const singleDay = range.from === range.to;
  const days = singleDay ? [] : buildDays(orders, range, today);
  const total = round2(days.reduce((s, d) => s + d.sales, 0));

  return (
    <SectionCard
      title="Affiliate GMV by day"
      count={singleDay ? undefined : formatUsd(total)}
      description="Attributed sales per order date (KST). B2B and self-purchases excluded."
    >
      {singleDay ? (
        <EmptyRow>Select 2+ days to see the trend.</EmptyRow>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={days} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
              <CartesianGrid vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }}
                interval="preserveStartEnd" minTickGap={16} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={48}
                tickFormatter={(v: number) => `$${v.toLocaleString('en-US')}`} />
              <Tooltip content={<DayTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Bar dataKey="sales" fill={BAR_COLOR} radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </SectionCard>
  );
}
