import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchBestSellingProducts, type ShopifyProduct } from '@/lib/shopify';
import { getMockAffiliateDashboard, withCatalogProducts } from '@/components/affiliate/affiliateDashboardData';
import {
  Thumbnail, useAffiliateCustomer, useAffiliateHref, EmptyState,
} from '@/components/affiliate/AffiliateDashboardShared';
import { MyPageSubLayout } from '@/components/layout/MyPageSubLayout';

export default function AffiliateSharedProducts() {
  const navigate = useNavigate();
  const { loading, displayName } = useAffiliateCustomer('/mypage/affiliate/shared');
  const href = useAffiliateHref();
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  const data = useMemo(() => getMockAffiliateDashboard(displayName), [displayName]);

  useEffect(() => {
    fetchBestSellingProducts(data.allSharedProducts.length || 1)
      .then(setProducts)
      .catch(() => {})
      .finally(() => setProductsLoading(false));
  }, [data.allSharedProducts.length]);

  const shared = useMemo(() => withCatalogProducts(data.allSharedProducts, products), [data.allSharedProducts, products]);

  return (
    <MyPageSubLayout title="Products you've shared" onBack={() => navigate(href('/mypage/affiliate'))}>
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-xl" />
          ))}
        </div>
      ) : shared.length === 0 ? (
        <EmptyState message="No shared products yet. Share a product to get started." />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {shared.map((product) => (
            <button
              key={product.handle}
              onClick={() => navigate(`/product/${product.handle}`)}
              className="text-left group"
            >
              <div className="aspect-square rounded-xl relative overflow-hidden">
                <Thumbnail image={product.image} alt={product.title} loading={productsLoading} className="w-full h-full" />
                <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-sm z-10 bg-primary text-primary-foreground">
                  Earn ${product.earnAmount.toFixed(2)}
                </span>
              </div>
              <p className="text-xs mt-1.5 line-clamp-2 group-hover:underline">{product.title}</p>
            </button>
          ))}
        </div>
      )}
    </MyPageSubLayout>
  );
}
