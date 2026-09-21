import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShopifyProduct, CollectionSortKey, ProductListSortKey, fetchProducts, fetchBestSellingProductsPaginated, fetchCollectionProducts, fetchCollectionIntersection, fetchProductCount, fetchCollectionProductCount } from '@/lib/shopify';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';
import { ProductCard } from '@/components/shop/ProductCard';
import { saveScrollPosition } from '@/hooks/useScrollRestoration';
import { ProductFilters, SortOption } from './ProductFilters';
import { ProductOptionDialog } from './ProductOptionDialog';
import { trackViewItemList, shopifyToGA4Item } from '@/lib/ga4-ecommerce';

// Product skeleton component
const ProductSkeleton = () => (
  <div className="bg-card rounded-xl overflow-hidden border border-border">
    <Skeleton className="aspect-square w-full" />
    <div className="p-4 space-y-3">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <div className="flex items-center justify-between pt-1">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
    </div>
  </div>
);

interface ProductGridProps {
  searchQuery?: string;
  collectionHandle?: string | null;
  multiCollections?: string[] | null;  // e.g. ["ssfw", "toy"] → intersection
  overrideTitle?: string | null;
  defaultBestSelling?: boolean;
}

const PRODUCTS_PER_PAGE = 12;
const BEST_SELLING_INITIAL = 12;

export const ProductGrid = ({ searchQuery = "", collectionHandle = null, multiCollections = null, overrideTitle = null, defaultBestSelling = false }: ProductGridProps) => {
  const [allProducts, setAllProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [totalProductCount, setTotalProductCount] = useState<number | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Option dialog state
  const [optionDialogOpen, setOptionDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ShopifyProduct | null>(null);

  const [sortOption, setSortOption] = useState<SortOption>("best-selling");

  const navigate = useNavigate();
  const location = useLocation();

  const sortKey: CollectionSortKey =
    sortOption === "best-selling" ? "BEST_SELLING"
    : sortOption === "newest" ? "CREATED"
    : sortOption === "price-asc" ? "PRICE_ASC"
    : "PRICE_DESC";
  const productListSortKey: ProductListSortKey =
    sortOption === "best-selling" ? "BEST_SELLING"
    : sortOption === "newest" ? "CREATED_AT"
    : sortOption === "price-asc" ? "PRICE_ASC"
    : "PRICE_DESC";

  const isProductSoldOut = useCallback((product: ShopifyProduct) => {
    if (product.node.availableForSale === false) return true;
    const variants = product.node.variants.edges;
    if (variants.every(v => !v.node.availableForSale)) return true;
    const tracked = variants.filter(v => v.node.quantityAvailable !== null);
    if (tracked.length > 0 && tracked.every(v => v.node.quantityAvailable! <= 0)) return true;
    return false;
  }, []);

  // Products arrive already sorted server-side. Sold-out items are always pinned to the bottom.
  const filteredAndSortedProducts = useMemo(() => {
    if (hasNextPage) {
      return allProducts.filter(p => !isProductSoldOut(p));
    }
    const notSoldOut = allProducts.filter(p => !isProductSoldOut(p));
    const soldOut = allProducts.filter(p => isProductSoldOut(p));
    return [...notSoldOut, ...soldOut];
  }, [allProducts, hasNextPage, isProductSoldOut]);

  // GA4: view_item_list — fire once per search/collection change
  useEffect(() => {
    if (!loading && filteredAndSortedProducts.length > 0 && totalProductCount === null) {
      setTotalProductCount(filteredAndSortedProducts.length);
      const ga4Items = filteredAndSortedProducts.slice(0, 20).map(p =>
        shopifyToGA4Item(p.node, p.node.variants.edges[0]?.node)
      );
      trackViewItemList(ga4Items, 'All Products');
    }
  }, [loading, totalProductCount, filteredAndSortedProducts]);

  const handleProductClick = (handle: string) => {
    saveScrollPosition(location.pathname);
    navigate(`/product/${handle}`);
  };

  const getQuery = useCallback(() => {
    if (searchQuery) {
      const sanitized = searchQuery.replace(/[\\"`${}]/g, '');
      return `title:${sanitized} OR body:${sanitized}`;
    }
    return undefined;
  }, [searchQuery]);

  useEffect(() => {
    setSortOption("best-selling");
  }, [searchQuery, collectionHandle, multiCollections]);

  // Initial load
  useEffect(() => {
    const loadProducts = async () => {
      setLoading(true);
      setLoadError(false);
      setAllProducts([]);
      setEndCursor(null);
      setHasNextPage(false);
      setTotalProductCount(null);

      try {
        let response;
        let countPromise: Promise<number>;

        if (multiCollections && multiCollections.length > 0) {
          response = await fetchCollectionIntersection(multiCollections, PRODUCTS_PER_PAGE);
          setCollectionTitle(overrideTitle ?? null);
          setTotalProductCount(response.products.length);
          countPromise = Promise.resolve(response.products.length);
        } else if (collectionHandle) {
          countPromise = fetchCollectionProductCount(collectionHandle);
          const collectionResponse = await fetchCollectionProducts(collectionHandle, PRODUCTS_PER_PAGE, undefined, sortKey);
          response = collectionResponse;
          setCollectionTitle(collectionResponse.collectionTitle);
        } else if (defaultBestSelling && !searchQuery) {
          countPromise = fetchProductCount(undefined);
          response = await fetchBestSellingProductsPaginated(BEST_SELLING_INITIAL);
        } else {
          const query = getQuery();
          countPromise = fetchProductCount(query);
          response = await fetchProducts(PRODUCTS_PER_PAGE, query, undefined, productListSortKey);
        }

        setAllProducts(response.products);
        setHasNextPage(response.pageInfo.hasNextPage);
        setEndCursor(response.pageInfo.endCursor);
        countPromise.then(c => setTotalProductCount(c));
      } catch (error) {
        console.error('Failed to fetch products:', error);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    };
    loadProducts();
  }, [searchQuery, collectionHandle, multiCollections, overrideTitle, getQuery, retryKey, sortKey, productListSortKey]);

  // Load more products
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasNextPage || !endCursor) return;

    setLoadingMore(true);
    try {
      let response;
      if (multiCollections && multiCollections.length > 0) {
        // Intersection results are fetched all at once; no cursor-based load more
        return;
      } else if (collectionHandle) {
        response = await fetchCollectionProducts(collectionHandle, PRODUCTS_PER_PAGE, endCursor, sortKey);
      } else if (defaultBestSelling && !searchQuery) {
        response = await fetchBestSellingProductsPaginated(PRODUCTS_PER_PAGE, endCursor);
      } else {
        const query = getQuery();
        response = await fetchProducts(PRODUCTS_PER_PAGE, query, endCursor, productListSortKey);
      }
      setAllProducts(prev => [...prev, ...response.products]);
      setHasNextPage(response.pageInfo.hasNextPage);
      setEndCursor(response.pageInfo.endCursor);
    } catch (error) {
      console.error('Failed to load more products:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasNextPage, endCursor, multiCollections, collectionHandle, defaultBestSelling, searchQuery, getQuery, sortKey, productListSortKey]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !loadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasNextPage, loadingMore, loadMore]);

  const handleAddToCart = (e: React.MouseEvent, product: ShopifyProduct) => {
    e.stopPropagation();
    setSelectedProduct(product);
    setOptionDialogOpen(true);
  };

  const getSearchText = () => `Search: "${searchQuery}"`;
  const getNoSearchResultsText = () => 'No results found';
  const getTryDifferentSearchText = () => 'Try a different search term.';

  const [collectionTitle, setCollectionTitle] = useState<string | null>(null);

  // Fetch collection title when collection changes
  useEffect(() => {
    if (!collectionHandle) {
      setCollectionTitle(null);
    }
  }, [collectionHandle]);

  const displayTitle = searchQuery ? getSearchText() : overrideTitle || collectionTitle || "ALL";

  if (loadError) {
    return (
      <section className="py-8 px-4">
        <h2 className="text-2xl font-bold text-center mb-6">{displayTitle}</h2>
        <div className="bg-muted/50 rounded-xl p-12 text-center">
          <p className="text-muted-foreground text-lg mb-4">Failed to load products.</p>
          <Button variant="outline" onClick={() => setRetryKey(k => k + 1)}>
            Retry
          </Button>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="py-8 px-4">
        <h2 className="text-2xl font-bold text-center mb-4">{displayTitle}</h2>
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-9 w-[140px]" />
          <Skeleton className="h-9 w-20" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductSkeleton key={i} />
          ))}
        </div>
      </section>
    );
  }

  if (allProducts.length === 0) {
    return (
      <section className="py-8 px-4">
        <h2 className="text-2xl font-bold text-center mb-6">{displayTitle}</h2>
        <div className="bg-muted/50 rounded-xl p-12 text-center">
          <p className="text-muted-foreground text-lg mb-4">
            {getNoSearchResultsText()}
          </p>
          <p className="text-sm text-muted-foreground">
            {getTryDifferentSearchText()}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="product-grid" className="py-8 px-4">
      <h2 className="text-2xl font-bold text-center mb-4">{displayTitle}</h2>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted-foreground">
          {totalProductCount !== null ? `${totalProductCount} products` : ""}
        </span>
        <ProductFilters sortOption={sortOption} onSortChange={setSortOption} />
      </div>

      {filteredAndSortedProducts.length === 0 ? (
        <div className="bg-muted/50 rounded-xl p-12 text-center">
          <p className="text-muted-foreground text-lg">
            No products found.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredAndSortedProducts.map((product) => {
              const isCompletelyOutOfStock = isProductSoldOut(product);
              return (
                <ProductCard
                  key={product.node.id}
                  product={product}
                  isSoldOut={isCompletelyOutOfStock}
                  onClick={() => handleProductClick(product.node.handle)}
                  onAddToCart={(e) => handleAddToCart(e, product)}
                />
              );
            })}
          </div>

          {/* Infinite scroll trigger — collapses to a hairline sentinel when idle so it
              doesn't reserve empty space between the last product row and the footer. */}
          <div ref={loadMoreRef} className={`flex items-center justify-center ${loadingMore ? "h-20" : "h-px"}`}>
            {loadingMore && (
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            )}
          </div>

          {/* Product Option Dialog */}
          <ProductOptionDialog
            product={selectedProduct}
            open={optionDialogOpen}
            onOpenChange={setOptionDialogOpen}
          />
        </>
      )}
    </section>
  );
};
