import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import {
  ChevronLeft, ChevronDown, Calendar as CalendarIcon, Copy, Archive, PlusCircle,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { isLoggedIn as isCustomerLoggedIn } from '@/lib/customer-auth';
import { fetchCustomerAccount } from '@/lib/customer-account';
import { fetchBestSellingProducts, type ShopifyProduct } from '@/lib/shopify';
import { isDevPreviewActive, DEV_PREVIEW_CUSTOMER } from '@/lib/dev-preview';
import { getMockAffiliateDashboard, type AffiliateDashboardData } from '@/components/affiliate/affiliateDashboardData';

function Thumbnail({ image, alt, loading, className }: { image?: string; alt: string; loading: boolean; className?: string }) {
  if (loading) return <Skeleton className={className} />;
  if (image) return <img src={image} alt={alt} className={`${className} object-cover`} />;
  return (
    <div className={`${className} flex items-center justify-center bg-secondary text-muted-foreground text-[10px]`}>
      No Image
    </div>
  );
}

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
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string | undefined>();
  const [range, setRange] = useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });
  const [calOpen, setCalOpen] = useState(false);
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  useEffect(() => {
    fetchBestSellingProducts(3)
      .then(setProducts)
      .catch(() => {})
      .finally(() => setProductsLoading(false));
  }, []);

  useEffect(() => {
    if (isDevPreviewActive()) {
      setDisplayName(DEV_PREVIEW_CUSTOMER.displayName);
      setLoading(false);
      return;
    }
    if (!isCustomerLoggedIn()) {
      navigate('/mypage', { state: { returnTo: '/mypage/affiliate' } });
      return;
    }
    fetchCustomerAccount()
      .then((data) => {
        if (!data) {
          navigate('/mypage', { state: { returnTo: '/mypage/affiliate' } });
          return;
        }
        setDisplayName(data.displayName);
      })
      .catch(() => toast.error('Failed to load your affiliate info.', { position: 'top-center' }))
      .finally(() => setLoading(false));
  }, [navigate]);

  const data: AffiliateDashboardData = useMemo(() => getMockAffiliateDashboard(displayName), [displayName]);

  // Sample stats (clicks/orders/earnings) have no tracking backend yet, but the
  // thumbnails should still show real catalog products instead of empty boxes.
  const topLinks = useMemo(() => data.topLinks.map((link, i) => {
    const p = products[i]?.node;
    return { ...link, title: p?.title ?? link.title, handle: p?.handle ?? link.handle, image: p?.images.edges[0]?.node.url };
  }), [data.topLinks, products]);

  const sharedProducts = useMemo(() => data.sharedProducts.map((product, i) => {
    const p = products[i]?.node;
    return { ...product, title: p?.title ?? product.title, handle: p?.handle ?? product.handle, image: p?.images.edges[0]?.node.url };
  }), [data.sharedProducts, products]);

  const copy = (value: string) => {
    navigator.clipboard.writeText(value)
      .then(() => toast.success('Copied!', { position: 'top-center' }))
      .catch(() => toast.error('Failed to copy.', { position: 'top-center' }));
  };

  const rangeLabel = range?.from
    ? range.to
      ? `${format(range.from, 'MMM d')} – ${format(range.to, 'MMM d')}`
      : format(range.from, 'MMM d')
    : 'Select dates';

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <header className="sticky top-[57px] z-40 bg-background border-b border-border">
        <div className="max-w-md mx-auto flex items-center gap-1 px-4 h-12">
          <button onClick={() => navigate('/mypage')} className="p-2 -ml-2">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="font-bold text-base">Affiliate</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-4 pb-24">
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
                Payments made through this link or code get{' '}
                <span className="font-semibold text-foreground">{data.discountPercent}% off</span>, and you earn a{' '}
                <span className="font-semibold text-foreground">{data.commissionPercent}% commission</span>.
              </p>
            </div>

            <Popover open={calOpen} onOpenChange={setCalOpen}>
              <PopoverTrigger asChild>
                <button className="w-full flex items-center justify-center gap-2 h-10 rounded-full border border-border text-sm font-medium hover:bg-secondary/50 transition-colors">
                  <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  {rangeLabel}
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  mode="range"
                  selected={range}
                  onSelect={(val) => { setRange(val); if (val?.from && val?.to) setCalOpen(false); }}
                  disabled={{ after: new Date() }}
                  defaultMonth={range?.from ?? new Date()}
                />
              </PopoverContent>
            </Popover>

            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground mb-3">Performance</p>
              <div className="flex items-center">
                <StatColumn value={data.views.toLocaleString()} label="Views" />
                <StatColumn value={data.clicks.toLocaleString()} label="Clicks" withDivider />
                <StatColumn value={data.sales.toLocaleString()} label="Sales" withDivider />
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground mb-1">This month's commission</p>
              <div className="flex items-center justify-between mb-3">
                <p className="text-2xl font-bold leading-none">${data.earningsThisMonth.toFixed(2)}</p>
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
                onClick={() => ComingSoon('Link history')}
                className="w-full text-center text-sm text-primary font-medium mt-2 pt-2"
              >
                See all links
              </button>
            </div>

            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold">Products you've shared</p>
                <button onClick={() => ComingSoon('Shared products')} className="text-xs text-primary font-medium">
                  See all
                </button>
              </div>
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
                onClick={() => ComingSoon('Reward history')}
                className="w-full flex items-center justify-between py-3.5 hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Archive className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm">Reward history</span>
                </div>
                <ChevronLeft className="h-4 w-4 text-muted-foreground rotate-180" />
              </button>
              <button
                onClick={() => ComingSoon('More affiliate programs')}
                className="w-full flex items-center justify-between py-3.5 hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <PlusCircle className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm">Become an affiliate for other products</span>
                </div>
                <ChevronLeft className="h-4 w-4 text-muted-foreground rotate-180" />
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
