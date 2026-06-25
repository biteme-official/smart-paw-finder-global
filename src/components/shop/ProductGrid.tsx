import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShopifyProduct, fetchProducts, fetchCollectionProducts, fetchCollectionIntersection, fetchProductCount, fetchCollectionProductCount } from '@/lib/shopify';
import { PriceTag } from '@/components/ui/PriceTag';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ShoppingCart, Loader2, Heart } from 'lucide-react';
import { saveScrollPosition } from '@/hooks/useScrollRestoration';
import { useFavoriteAction } from '@/hooks/useFavoriteAction';
import { ProductFilters, SortOption, FilterState } from './ProductFilters';
import { ProductOptionDialog } from './ProductOptionDialog';
import { useTranslation } from '@/hooks/useTranslation';
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
}

const PRODUCTS_PER_PAGE = 12;
const DEFAULT_MAX_PRICE = 100;

export const ProductGrid = ({ searchQuery = "", collectionHandle = null, multiCollections = null, overrideTitle = null }: ProductGridProps) => {
  const [allProducts, setAllProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const { toggleFavorite, checkFavorite } = useFavoriteAction();
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [totalProductCount, setTotalProductCount] = useState<number | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Option dialog state
  const [optionDialogOpen, setOptionDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ShopifyProduct | null>(null);

  // Filter and sort state
  const [sortOption, setSortOption] = useState<SortOption>("default");
  const [filters, setFilters] = useState<FilterState>({
    priceRange: [0, DEFAULT_MAX_PRICE],
  });

  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const { minPrice, maxPrice } = useMemo(() => {
    if (allProducts.length === 0) return { minPrice: 0, maxPrice: DEFAULT_MAX_PRICE };
    const prices = allProducts.map(p => parseFloat(p.node.priceRange.minVariantPrice.amount));
    return { minPrice: Math.min(...prices), maxPrice: Math.max(...prices) };
  }, [allProducts]);

  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      priceRange: [minPrice, maxPrice],
    }));
  }, [minPrice, maxPrice]);

  const isProductSoldOut = useCallback((product: ShopifyProduct) => {
    if (product.node.availableForSale === false) return true;
    const variants = product.node.variants.edges;
    if (variants.every(v => !v.node.availableForSale)) return true;
    const tracked = variants.filter(v => v.node.quantityAvailable !== null);
    if (tracked.length > 0 && tracked.every(v => v.node.quantityAvailable! <= 0)) return true;
    return false;
  }, []);

  // Apply filters and sorting to products
  const filteredAndSortedProducts = useMemo(() => {
    let result = [...allProducts];

    // Apply price filter
    result = result.filter(product => {
      const price = parseFloat(product.node.priceRange.minVariantPrice.amount);
      return price >= filters.priceRange[0] && price <= filters.priceRange[1];
    });

    // Apply sorting
    switch (sortOption) {
      case "price-asc":
        result.sort((a, b) =>
          parseFloat(a.node.priceRange.minVariantPrice.amount) -
          parseFloat(b.node.priceRange.minVariantPrice.amount)
        );
        break;
      case "price-desc":
        result.sort((a, b) =>
          parseFloat(b.node.priceRange.minVariantPrice.amount) -
          parseFloat(a.node.priceRange.minVariantPrice.amount)
        );
        break;
      case "title-asc":
        result.sort((a, b) => a.node.title.localeCompare(b.node.title));
        break;
      case "title-desc":
        result.sort((a, b) => b.node.title.localeCompare(a.node.title));
        break;
      default:
        break;
    }

    // While more pages remain, hide sold-out to prevent shifting.
    // Once all pages are loaded, show them at the bottom.
    if (hasNextPage) {
      return result.filter(p => !isProductSoldOut(p));
    }
    const notSoldOut = result.filter(p => !isProductSoldOut(p));
    const soldOut = result.filter(p => isProductSoldOut(p));
    return [...notSoldOut, ...soldOut];
  }, [allProducts, sortOption, filters, hasNextPage, isProductSoldOut]);

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

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.priceRange[0] > minPrice || filters.priceRange[1] < maxPrice) count++;
    return count;
  }, [filters, minPrice, maxPrice]);

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
    setSortOption("default");
  }, [searchQuery, collectionHandle, multiCollections]);

  // Initial load
  useEffect(() => {
    const loadProducts = async () => {
      setLoading(true);
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
          const collectionResponse = await fetchCollectionProducts(collectionHandle, PRODUCTS_PER_PAGE);
          response = collectionResponse;
          setCollectionTitle(collectionResponse.collectionTitle);
        } else {
          const query = getQuery();
          countPromise = fetchProductCount(query);
          response = await fetchProducts(PRODUCTS_PER_PAGE, query, undefined);
        }

        setAllProducts(response.products);
        setHasNextPage(response.pageInfo.hasNextPage);
        setEndCursor(response.pageInfo.endCursor);
        countPromise.then(c => setTotalProductCount(c));
      } catch (error) {
        console.error('Failed to fetch products:', error);
      } finally {
        setLoading(false);
      }
    };
    loadProducts();
  }, [searchQuery, collectionHandle, multiCollections, overrideTitle, getQuery]);

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
        response = await fetchCollectionProducts(collectionHandle, PRODUCTS_PER_PAGE, endCursor);
      } else {
        const query = getQuery();
        response = await fetchProducts(PRODUCTS_PER_PAGE, query, endCursor);
      }
      setAllProducts(prev => [...prev, ...response.products]);
      setHasNextPage(response.pageInfo.hasNextPage);
      setEndCursor(response.pageInfo.endCursor);
    } catch (error) {
      console.error('Failed to load more products:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasNextPage, endCursor, multiCollections, collectionHandle, getQuery]);

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
  const getProductCountText = (count: number) => `${count} products`;
  const getNoSearchResultsText = () => 'No results found';
  const getTryDifferentSearchText = () => 'Try a different search term.';
  const getNoFilterResultsText = () => 'No products match the selected filters';

  const [collectionTitle, setCollectionTitle] = useState<string | null>(null);

  // Fetch collection title when collection changes
  useEffect(() => {
    if (!collectionHandle) {
      setCollectionTitle(null);
    }
  }, [collectionHandle]);

  const displayTitle = searchQuery ? getSearchText() : overrideTitle || collectionTitle || "ALL";

  if (loading) {
    return (
      <section className="py-8 px-4">
        <h2 className="text-2xl font-bold mb-4">{displayTitle}</h2>
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
        <h2 className="text-2xl font-bold mb-6">{displayTitle}</h2>
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
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">{displayTitle}</h2>
        {totalProductCount !== null && (
          <span className="text-sm text-muted-foreground">
            {totalProductCount} products
          </span>
        )}
      </div>

      {/* Filters and Sort */}
      <ProductFilters
        sortOption={sortOption}
        onSortChange={setSortOption}
        filters={filters}
        onFiltersChange={setFilters}
        minPrice={minPrice}
        maxPrice={maxPrice}
        activeFilterCount={activeFilterCount}
      />

      {filteredAndSortedProducts.length === 0 ? (
        <div className="bg-muted/50 rounded-xl p-12 text-center">
          <p className="text-muted-foreground text-lg mb-4">
            {getNoFilterResultsText()}
          </p>
          <Button
            variant="outline"
            onClick={() => setFilters({ priceRange: [minPrice, maxPrice] })}
          >
            {t('filters.clearFilters')}
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredAndSortedProducts.map((product) => {
              const image = product.node.images.edges[0]?.node;
              const price = product.node.priceRange.minVariantPrice;
              const isCompletelyOutOfStock = isProductSoldOut(product);

              return (
                <div
                  key={product.node.id}
                  className="bg-card rounded-xl overflow-hidden border border-border hover:shadow-lg transition-shadow cursor-pointer group"
                  onClick={() => handleProductClick(product.node.handle)}
                >
                  <div className="aspect-square bg-muted relative overflow-hidden">
                    {image ? (
                      <img
                        src={image.url}
                        alt={image.altText || product.node.title}
                        className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${isCompletelyOutOfStock ? 'opacity-50' : ''}`}
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        No Image
                      </div>
                    )}
                    {/* Favorite Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(product.node.handle);
                      }}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-background/70 backdrop-blur-sm flex items-center justify-center hover:bg-background/90 transition-colors z-10"
                    >
                      <Heart
                        className={`h-4 w-4 ${checkFavorite(product.node.handle) ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`}
                      />
                    </button>
                    {/* Sold Out Overlay */}
                    {isCompletelyOutOfStock && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                        <span className="bg-foreground text-background px-4 py-2 text-sm font-bold uppercase tracking-wider">
                          Sold Out
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-medium text-sm line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                      {product.node.title}
                    </h3>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <PriceTag
                          amount={price.amount}
                          currencyCode={price.currencyCode}
                          className={`font-bold text-sm ${isCompletelyOutOfStock ? 'text-muted-foreground' : 'text-primary'}`}
                          originalClassName="text-xs"
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => handleAddToCart(e, product)}
                        className="h-8 w-8 p-0 flex-shrink-0"
                        disabled={isCompletelyOutOfStock}
                      >
                        <ShoppingCart className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Infinite scroll trigger */}
          <div ref={loadMoreRef} className="h-20 flex items-center justify-center">
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
