import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { countryName, formatMonth, formatUsd, type PartnerRow, type PartnerStatus } from './affiliateAdminData';
import { ACTION_COL, CellTooltip, EmptyRow, PARTNER_STATUS, Pager, SectionCard, StatusBadge, TABLE_WRAP, TD, TEXT_COL, TH, TR, VALUE_COL, paginate } from './adminUi';

type SortKey = 'id' | 'name' | 'country' | 'clicks' | 'orders' | 'sales' | 'commission' | 'unpaidBalance' | 'paypal' | 'status';

const COLUMNS: { key: SortKey; label: string; sub?: string; align: 'left' | 'right' | 'center'; title?: string }[] = [
  { key: 'id', label: 'Partner ID', align: 'left' },
  { key: 'name', label: 'Name', align: 'left' },
  { key: 'country', label: 'Country', align: 'center', title: 'From the default shipping address' },
  { key: 'clicks', label: 'Clicks', align: 'center', title: 'Selected period, bot clicks excluded' },
  { key: 'orders', label: 'Orders', align: 'center', title: 'Selected period' },
  { key: 'sales', label: 'Sales', align: 'center', title: 'Selected period' },
  { key: 'commission', label: 'Commission', align: 'center', title: 'Selected period (pending + approved)' },
  { key: 'unpaidBalance', label: 'Unpaid balance', sub: 'Confirmed after 30 days', align: 'center', title: 'All time: approved, not paid out yet' },
  { key: 'paypal', label: 'PayPal', align: 'center' },
  { key: 'status', label: 'Status', align: 'center' },
];

const PAGE_SIZE = 5;
const TEXT_SORT: SortKey[] = ['id', 'name', 'country', 'status'];
const ALIGN = { left: TEXT_COL, right: ACTION_COL, center: VALUE_COL } as const;

function sortValue(p: PartnerRow, key: SortKey): string | number {
  if (key === 'paypal') return p.paypalEmail ? 1 : 0;
  if (key === 'country') return p.countryCode;
  return p[key];
}

export function PartnersCard({ partners, onSelect }: { partners: PartnerRow[]; onSelect: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | PartnerStatus>('all');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'sales', desc: true });

  const counts = {
    all: partners.length,
    active: partners.filter((p) => p.status === 'active').length,
    suspended: partners.filter((p) => p.status === 'suspended').length,
    removed: partners.filter((p) => p.status === 'removed').length,
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = partners.filter((p) =>
      (filter === 'all' || p.status === filter)
      && (!q || p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)));
    return list.sort((a, b) => {
      const av = sortValue(a, sort.key);
      const bv = sortValue(b, sort.key);
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sort.desc ? -cmp : cmp;
    });
  }, [partners, search, filter, sort]);

  const [page, setPage] = useState(1);
  const paged = paginate(rows, page, PAGE_SIZE);

  // Changing the tab, search or sort starts again from page 1.
  const toggleSort = (key: SortKey) => {
    setPage(1);
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: !TEXT_SORT.includes(key) }));
  };

  return (
    <SectionCard
      title="Partners"
      description="Clicks, orders, sales and commission cover the selected period (bots excluded). Unpaid balance is all time. Click a column to sort, or a row for details."
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-3">
        <Tabs value={filter} onValueChange={(v) => { setFilter(v as typeof filter); setPage(1); }}>
          <TabsList>
            <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
            <TabsTrigger value="active">Active ({counts.active})</TabsTrigger>
            <TabsTrigger value="suspended">Suspended ({counts.suspended})</TabsTrigger>
            <TabsTrigger value="removed">Removed ({counts.removed})</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input placeholder="Search name or email..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="w-full sm:max-w-xs" />
      </div>

      {rows.length === 0 ? (
        <EmptyRow>{partners.length === 0 ? 'No partners yet.' : 'No partners found.'}</EmptyRow>
      ) : (
        <div className={TABLE_WRAP}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50/50">
                {COLUMNS.map((c) => (
                  <th key={c.key} className={cn(TH, ALIGN[c.align])} title={c.title}>
                    <button type="button" onClick={() => toggleSort(c.key)}
                      className={cn('relative hover:text-foreground', sort.key === c.key && 'text-foreground')}>
                      {c.label}
                      {/* Hangs off the label so it never shifts a centered heading. */}
                      {sort.key === c.key && (
                        <span className="absolute left-full top-1/2 -translate-y-1/2 pl-0.5">
                          {sort.desc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                        </span>
                      )}
                    </button>
                    {c.sub && <span className="block text-[10px] font-normal">{c.sub}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.items.map((p) => (
                <tr key={p.id} className={cn(TR, 'cursor-pointer')} onClick={() => onSelect(p.id)}>
                  <td className={`${TD} ${TEXT_COL} font-mono text-xs`}>{p.id}</td>
                  <td className={`${TD} ${TEXT_COL}`}>
                    <p className="font-medium whitespace-nowrap">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.email}</p>
                  </td>
                  <td className={`${TD} ${VALUE_COL} text-xs whitespace-nowrap`}>
                    <CellTooltip content={countryName(p.countryCode)}>
                      <span className="font-mono">{p.countryCode}</span>
                    </CellTooltip>
                  </td>
                  <td className={`${TD} ${VALUE_COL}`}>{p.clicks}</td>
                  <td className={`${TD} ${VALUE_COL}`}>{p.orders}</td>
                  <td className={`${TD} ${VALUE_COL} font-medium`}>{formatUsd(p.sales)}</td>
                  <td className={`${TD} ${VALUE_COL}`}>{formatUsd(p.commission)}</td>
                  <td className={`${TD} ${VALUE_COL}`}>
                    {p.unpaidParts.length > 1 ? (
                      <CellTooltip content={p.unpaidParts.map((x) => `${formatMonth(x.month)} ${formatUsd(x.amount)}`).join(' + ')}>
                        <span className="underline decoration-dotted underline-offset-4">{formatUsd(p.unpaidBalance)}</span>
                      </CellTooltip>
                    ) : formatUsd(p.unpaidBalance)}
                    {p.unpaidParts.length === 1 && p.unpaidBalance > 0 && (
                      <p className="text-[10px] text-muted-foreground">{formatMonth(p.unpaidParts[0].month)}</p>
                    )}
                  </td>
                  <td className={`${TD} ${VALUE_COL}`}>
                    {p.paypalEmail
                      ? <CheckCircle className="h-4 w-4 text-green-500 inline" aria-label="PayPal email set" />
                      : <StatusBadge config={{ label: 'Missing', color: 'text-red-600 bg-red-50 border-red-200' }} />}
                  </td>
                  <td className={`${TD} ${VALUE_COL}`}><StatusBadge config={PARTNER_STATUS[p.status]} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={paged.page} pageCount={paged.pageCount} onChange={setPage} />
    </SectionCard>
  );
}
