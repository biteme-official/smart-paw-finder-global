import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Archive, PlusCircle, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { fetchBestSellingProducts, type ShopifyProduct } from '@/lib/shopify';
import {
  getMockAffiliateDashboard, withCatalogProducts, type AffiliateDashboardData,
} from '@/components/affiliate/affiliateDashboardData';
import {
  Thumbnail, useAffiliateCustomer, useAffiliateRange, useAffiliateHref, DateRangeFilter,
} from '@/components/affiliate/AffiliateDashboardShared';
import { MyPageSubLayout } from '@/components/layout/MyPageSubLayout';

function LinkChip({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <button
      onClick={onCopy}
      className="flex-none w-fit flex items-center justify-center gap-1.5 h-8 px-3.5 rounded-full bg-primary text-primary-foreground font-semibold text-xs whitespace-nowrap hover:bg-primary/90 transition-colors"
    >
      <span>{label}</span>
      <Copy className="h-3 w-3 flex-shrink-0" />
    </button>
  );
}

function StatColumn({ value, label, withDivider }: { value: string | number; label: string; withDivider?: boolean }) {
  return (
    <div className={`flex-1 text-center ${withDivider ? 'border-l border-border' : ''}`}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function ComingSoon(label: string) {
  toast.info(`${label} — coming soon.`, { position: 'top-center' });
}

export default function AffiliateDashboard() {
  const navigate = useNavigate();
  const { loading, displayName } = useAffiliateCustomer('/mypage/affiliate');
  const { range, setRange } = useAffiliateRange();
  const href = useAffiliateHref();
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  useEffect(() => {
    fetchBestSellingProducts(3)
      .then(setProducts)
      .catch(() => {})
      .finally(() => setProductsLoading(false));
  }, []);

  const data: AffiliateDashboardData = useMemo(() => getMockAffiliateDashboard(displayName), [displayName]);

  // Sample stats (clicks/orders/earnings) have no tracking backend yet, but the
  // thumbnails should still show real catalog products instead of empty boxes.
  const topLinks = useMemo(() => withCatalogProducts(data.topLinks, products), [data.topLinks, products]);
  const sharedProducts = useMemo(() => withCatalogProducts(data.sharedProducts, products), [data.sharedProducts, products]);

  const copy = (value: string) => {
    navigator.clipboard.writeText(value)
      .then(() => toast.success('Copied!', { position: 'top-center' }))
      .catch(() => toast.error('Failed to copy.', { position: 'top-center' }));
  };

  return (
    <MyPageSubLayout title="Affiliate" onBack={() => navigate('/mypage')} className="space-y-4">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        ) : (
          <>
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center justify-center gap-3">
                <LinkChip label="MY LINK" value={data.linkUrl} onCopy={() => copy(data.linkUrl)} />
                <LinkChip label={data.code} value={data.code} onCopy={() => copy(data.code)} />
              </div>
              <p className="text-xs text-muted-foreground text-center mt-3 leading-relaxed">
                Customers who use your code get{' '}
                <span className="font-semibold text-foreground">{data.discountPercent}% off</span>. You earn a{' '}
                <span className="font-semibold text-foreground">{data.commissionPercent}% commission</span> on every
                purchase made through your link or code.
              </p>
            </div>

            <DateRangeFilter range={range} onChange={setRange} />

            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground mb-3">Performance</p>
              <div className="flex items-center">
                <StatColumn value={data.views.toLocaleString()} label="Views" />
                <StatColumn value={data.clicks.toLocaleString()} label="Clicks" withDivider />
                <StatColumn value={data.sales.toLocaleString()} label="Sales" withDivider />
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">This month's commission</p>
                  <p className="text-2xl font-bold">${data.earningsThisMonth.toFixed(2)}</p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-6 px-2.5 border border-border text-[11px] font-medium text-muted-foreground"
                  disabled={data.earningsAvailable <= 0}
                  onClick={() => ComingSoon('Convert to store credit')}
                >
                  Convert Now
                </Button>
              </div>
              <div className="flex items-center pt-3 border-t border-border">
                <div className="flex-1">
                  <p className="text-base font-semibold">${data.earningsAvailable.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Available</p>
                </div>
                <div className="flex-1">
                  <p className="text-base font-semibold">${data.earningsPending.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Pending</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Commission becomes available to convert 30 days after each purchase is confirmed.
              </p>
            </div>

            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-baseline justify-between mb-1">
                <p className="text-sm font-semibold">Your top links</p>
              </div>
              <p className="text-xs text-muted-foreground mb-2">Ranked by clicks</p>
              {topLinks.length === 0 && (
                <p className="text-xs text-muted-foreground py-6 text-center">No links yet. Share a product to get started.</p>
              )}
              <div className="divide-y divide-border">
                {topLinks.map((link) => (
                  <div key={link.handle} className="flex items-center gap-3 py-3">
                    <div className="w-12 h-12 rounded-lg flex-shrink-0 overflow-hidden">
                      <Thumbnail image={link.image} alt={link.title} loading={productsLoading} className="w-12 h-12" />
                    </div>
                    <p className="flex-1 text-sm truncate">{link.title}</p>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold">{link.clicks} clicks</p>
                      <p className="text-[11px] text-muted-foreground">
                        {link.orders} orders · ${link.earningPerOrder.toFixed(2)} each
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => navigate(href('/mypage/affiliate/links'))}
                className="w-full text-center text-sm text-primary font-medium mt-2 pt-2"
              >
                See all links
              </button>
            </div>

            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold">Products you've shared</p>
                <button onClick={() => navigate(href('/mypage/affiliate/shared'))} className="text-xs text-primary font-medium">
                  See all
                </button>
              </div>
              {sharedProducts.length === 0 && (
                <p className="text-xs text-muted-foreground py-6 text-center">No shared products yet. Share a product to get started.</p>
              )}
              <div className="grid grid-cols-3 gap-3">
                {sharedProducts.map((product) => (
                  <div key={product.handle}>
                    <div className="aspect-square rounded-xl relative overflow-hidden">
                      <Thumbnail image={product.image} alt={product.title} loading={productsLoading} className="w-full h-full" />
                      <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-sm z-10 bg-primary text-primary-foreground">
                        Earn ${product.earnAmount.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs mt-1.5 line-clamp-2">{product.title}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border divide-y divide-border px-4">
              <button
                onClick={() => ComingSoon('Commission history')}
                className="w-full flex items-center justify-between py-3.5 hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Archive className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm">Commission history</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
              <button
                onClick={() => ComingSoon('More affiliate programs')}
                className="w-full flex items-center justify-between py-3.5 hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <PlusCircle className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm">Become an affiliate for other products</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </>
        )}
    </MyPageSubLayout>
  );
}
