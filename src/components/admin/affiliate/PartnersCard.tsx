import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { formatUsd, isRestrictedCountry, type PartnerRow, type PartnerStatus } from './affiliateAdminData';
import { EmptyRow, PARTNER_STATUS, RestrictedBadge, SectionCard, StatusBadge, TABLE_WRAP, TD, TH, TR } from './adminUi';

type SortKey = 'id' | 'name' | 'country' | 'joinedAt' | 'clicks' | 'orders' | 'sales' | 'commission' | 'unpaidBalance' | 'paypal' | 'status';

const COLUMNS: { key: SortKey; label: string; align: 'left' | 'right' | 'center'; title?: string }[] = [
  { key: 'id', label: 'Partner ID', align: 'left' },
  { key: 'name', label: 'Name', align: 'left' },
  { key: 'country', label: 'Country', align: 'left', title: 'From the default shipping address' },
  { key: 'joinedAt', label: 'Joined', align: 'left' },
  { key: 'clicks', label: 'Clicks', align: 'right', title: 'Selected period, bot clicks excluded' },
  { key: 'orders', label: 'Orders', align: 'right', title: 'Selected period' },
  { key: 'sales', label: 'Sales', align: 'right', title: 'Selected period' },
  { key: 'commission', label: 'Commission', align: 'right', title: 'Selected period (pending + approved)' },
  { key: 'unpaidBalance', label: 'Unpaid balance', align: 'right', title: 'All time: approved, not paid out yet' },
  { key: 'paypal', label: 'PayPal', align: 'center' },
  { key: 'status', label: 'Status', align: 'center' },
];

const TEXT_SORT: SortKey[] = ['id', 'name', 'country', 'joinedAt', 'status'];
const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;

function sortValue(p: PartnerRow, key: SortKey): string | number {
  if (key === 'paypal') return p.paypalEmail ? 1 : 0;
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

  const toggleSort = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: !TEXT_SORT.includes(key) }));
  };

  return (
    <SectionCard
      title="Partners"
      count={<>{counts.all} total · {counts.active} active</>}
      description="Clicks, orders, sales and commission cover the selected period (bots excluded). Unpaid balance is all time. Click a column to sort, or a row for details."
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-3">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
            <TabsTrigger value="active">Active ({counts.active})</TabsTrigger>
            <TabsTrigger value="suspended">Suspended ({counts.suspended})</TabsTrigger>
            <TabsTrigger value="removed">Removed ({counts.removed})</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input placeholder="Search name or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:max-w-xs" />
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
                      className={cn('inline-flex items-center gap-1 hover:text-foreground', sort.key === c.key && 'text-foreground')}>
                      {c.label}
                      {sort.key === c.key && (sort.desc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className={cn(TR, 'cursor-pointer')} onClick={() => onSelect(p.id)}>
                  <td className={`${TD} font-mono text-xs`}>{p.id}</td>
                  <td className={TD}>
                    <p className="font-medium whitespace-nowrap">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.email}</p>
                  </td>
                  <td className={`${TD} text-xs whitespace-nowrap`}>
                    {p.country}
                    {isRestrictedCountry(p.country) && <RestrictedBadge country={p.country} className="ml-1.5" />}
                  </td>
                  <td className={`${TD} text-xs text-muted-foreground whitespace-nowrap`}>{p.joinedAt}</td>
                  <td className={`${TD} text-right`}>{p.clicks}</td>
                  <td className={`${TD} text-right`}>{p.orders}</td>
                  <td className={`${TD} text-right font-medium`}>{formatUsd(p.sales)}</td>
                  <td className={`${TD} text-right`}>{formatUsd(p.commission)}</td>
                  <td className={`${TD} text-right`}>{formatUsd(p.unpaidBalance)}</td>
                  <td className={`${TD} text-center`}>
                    {p.paypalEmail
                      ? <CheckCircle className="h-4 w-4 text-green-500 inline" aria-label="PayPal email set" />
                      : <StatusBadge config={{ label: 'Missing', color: 'text-red-600 bg-red-50 border-red-200' }} />}
                  </td>
                  <td className={`${TD} text-center`}><StatusBadge config={PARTNER_STATUS[p.status]} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
