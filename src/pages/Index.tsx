import { useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { HeroBanner } from "@/components/home/HeroBanner";
import { NewProducts } from "@/components/home/NewProducts";
import { PopularProducts } from "@/components/home/PopularProducts";
import { CurationSection } from "@/components/home/CurationSection";
import { InstagramReels } from "@/components/home/InstagramReels";
import { ProductGrid } from "@/components/shop/ProductGrid";
import { useScrollRestoration } from "@/hooks/useScrollRestoration";
import { ScrollToTop } from "@/components/ui/ScrollToTop";
import { ShopifyProduct, fetchCollectionProducts, fetchNewProducts } from "@/lib/shopify";
import { fetchBatchReviewSummary } from "@/hooks/useProductReview";

// Generic lazy-fetch hook: fetches when the section enters the viewport
function useLazySection(fetcher: () => Promise<ShopifyProduct[]>) {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewMap, setReviewMap] = useState<Record<string, { avgRating: number; count: number }>>({});
  const sectionRef = useRef<HTMLDivElement>(null);
  const fetchedRef = useRef(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !fetchedRef.current) {
          fetchedRef.current = true;
          fetcherRef.current()
            .then(result => {
              setProducts(result);
              const ids = result.map(p => p.node.id.split("/").pop()!);
              fetchBatchReviewSummary(ids).then(setReviewMap);
            })
            .catch(() => setProducts([]))
            .finally(() => setLoading(false));
          observer.disconnect();
        }
      },
      { rootMargin: '200px', threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { products, loading, reviewMap, sectionRef };
}

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCollection = searchParams.get("collection");
  const searchQuery = searchParams.get("q") || "";
  const collectionTitle = searchParams.get("collectionTitle");
  useScrollRestoration();

  const summerFetcher = useCallback(
    () => fetchCollectionProducts("summer-essentials", 10)
      .then(r => r.products.filter(p => p.node.variants.edges.some(v => v.node.availableForSale))),
    []
  );
  const ourPicksFetcher = useCallback(
    () => fetchCollectionProducts("our-picks", 10)
      .then(r => r.products.filter(p => p.node.variants.edges.some(v => v.node.availableForSale))),
    []
  );
  const justOpenedFetcher = useCallback(
    () => fetchNewProducts(12)
      .then(r => r.filter(p => p.node.variants.edges.some(v => v.node.availableForSale))),
    []
  );

  const summer = useLazySection(summerFetcher);
  const ourPicks = useLazySection(ourPicksFetcher);
  const justOpened = useLazySection(justOpenedFetcher);

  const handleSearch = (query: string) => {
    if (query) {
      setSearchParams({ q: query });
    } else {
      setSearchParams({});
    }
  };

  const handleCollectionSelect = (handle: string | null) => {
    if (handle) {
      setSearchParams({ collection: handle });
    } else {
      setSearchParams({});
    }
  };

  const showHeroBanner = !searchQuery && !selectedCollection;

  return (
    <div className="bg-background min-h-screen">
      <Header
        onSearch={handleSearch}
        onCollectionSelect={handleCollectionSelect}
      />
      {showHeroBanner && (
        <>
          <div className="max-w-7xl mx-auto">
            <HeroBanner />
            <NewProducts />
            <PopularProducts />
            <div ref={summer.sectionRef}>
              <CurationSection
                title="Summer Essentials"
                viewAllHref="/?collection=summer-essentials"
                products={summer.products}
                loading={summer.loading}
                badge="HOT"
                badgeClassName="bg-orange-500 text-white"
                animationDelay="0.4s"
                reviewMap={summer.reviewMap}
              />
            </div>
            <div ref={ourPicks.sectionRef}>
              <CurationSection
                title="Our Picks"
                viewAllHref="/?collection=our-picks"
                products={ourPicks.products}
                loading={ourPicks.loading}
                animationDelay="0.45s"
                reviewMap={ourPicks.reviewMap}
              />
            </div>
            <div ref={justOpened.sectionRef}>
              <CurationSection
                title="Just Opened"
                viewAllHref="/new-products"
                products={justOpened.products}
                loading={justOpened.loading}
                badge="NEW"
                badgeClassName="bg-emerald-500 text-white"
                animationDelay="0.5s"
                reviewMap={justOpened.reviewMap}
              />
            </div>
          </div>
          <InstagramReels />
        </>
      )}
      <main className="max-w-7xl mx-auto pb-20">
        <ProductGrid
          searchQuery={searchQuery}
          collectionHandle={selectedCollection}
          overrideTitle={collectionTitle}
          defaultBestSelling={!searchQuery && !selectedCollection}
        />
      </main>
      <Footer />
      <ScrollToTop />
    </div>
  );
};

export default Index;
