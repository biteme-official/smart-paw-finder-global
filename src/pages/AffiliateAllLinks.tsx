import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchBestSellingProducts, type ShopifyProduct } from '@/lib/shopify';
import { getMockAffiliateDashboard, withCatalogProducts } from '@/components/affiliate/affiliateDashboardData';
import {
  Thumbnail, useAffiliateCustomer, useAffiliateRange, useAffiliateHref, DateRangeFilter, EmptyState,
} from '@/components/affiliate/AffiliateDashboardShared';
import { MyPageSubLayout } from '@/components/layout/MyPageSubLayout';

type SortKey = 'clicks' | 'orders' | 'commission';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'clicks', label: 'Clicks' },
  { key: 'orders', label: 'Orders' },
  { key: 'commission', label: 'Commission' },
];

export default function AffiliateAllLinks() {
  const navigate = useNavigate();
  const { loading, displayName } = useAffiliateCustomer('/mypage/affiliate/links');
  const { range, setRange } = useAffiliateRange();
  const href = useAffiliateHref();
  const [sort, setSort] = useState<SortKey>('clicks');
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  const data = useMemo(() => getMockAffiliateDashboard(displayName), [displayName]);

  useEffect(() => {
    fetchBestSellingProducts(data.allLinks.length || 1)
      .then(setProducts)
      .catch(() => {})
      .finally(() => setProductsLoading(false));
  }, [data.allLinks.length]);

  const links = useMemo(() => {
    const rows = withCatalogProducts(data.allLinks, products);
    const value = (l: (typeof rows)[number]) =>
      sort === 'clicks' ? l.clicks : sort === 'orders' ? l.orders : l.orders * l.earningPerOrder;
    return [...rows].sort((a, b) => value(b) - value(a));
  }, [data.allLinks, products, sort]);

  return (
    <MyPageSubLayout title="All links" onBack={() => navigate(href('/mypage/affiliate'))} className="space-y-4">
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-full" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : (
        <>
          <DateRangeFilter range={range} onChange={setRange} />

          {links.length === 0 ? (
            <EmptyState message="No links yet. Share a product to get started." />
          ) : (
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">{links.length} links</p>
                <div className="flex items-center gap-1" role="group" aria-label="Sort links">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setSort(opt.key)}
                      aria-pressed={sort === opt.key}
                      className={`h-7 px-2.5 rounded-full text-[11px] font-medium transition-colors ${
                        sort === opt.key
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-muted-foreground hover:bg-secondary/70'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="divide-y divide-border">
                {links.map((link) => (
                  <button
                    key={link.handle}
                    onClick={() => navigate(`/product/${link.handle}`)}
                    className="w-full flex items-center gap-3 py-3 text-left hover:bg-secondary/30 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-lg flex-shrink-0 overflow-hidden">
                      <Thumbnail image={link.image} alt={link.title} loading={productsLoading} className="w-12 h-12" />
                    </div>
                    <p className="flex-1 min-w-0 text-sm truncate">{link.title}</p>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold">{link.clicks} clicks</p>
                      <p className="text-[11px] text-muted-foreground">
                        {link.orders} orders · ${link.earningPerOrder.toFixed(2)} each
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </MyPageSubLayout>
  );
}
