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

// Fetch only when the section's wrapper div enters the viewport (rootMargin: 200px ahead).
// Uses callback ref so the observer re-attaches correctly after showHeroBanner toggles.
function useLazyCurationProducts(collectionHandle: string, count = 10) {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const sectionRef = useCallback((el: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (!el || fetchedRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !fetchedRef.current) {
          fetchedRef.current = true;
          fetchCollectionProducts(collectionHandle, count)
            .then(r => setProducts(r.products.filter(p => p.node.variants.edges.some(v => v.node.availableForSale))))
            .catch(() => setProducts([]))
            .finally(() => setLoading(false));
          observer.disconnect();
          observerRef.current = null;
        }
      },
      { rootMargin: '200px', threshold: 0 }
    );

    observer.observe(el);
    observerRef.current = observer;
  }, [collectionHandle, count]);

  return { products, loading, sectionRef };
}

function useLazyJustOpenedProducts(count = 12) {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const sectionRef = useCallback((el: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (!el || fetchedRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !fetchedRef.current) {
          fetchedRef.current = true;
          fetchNewProducts(count)
            .then(r => setProducts(r.filter(p => p.node.variants.edges.some(v => v.node.availableForSale))))
            .catch(() => setProducts([]))
            .finally(() => setLoading(false));
          observer.disconnect();
          observerRef.current = null;
        }
      },
      { rootMargin: '200px', threshold: 0 }
    );

    observer.observe(el);
    observerRef.current = observer;
  }, [count]);

  return { products, loading, sectionRef };
}

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCollection = searchParams.get("collection");
  const searchQuery = searchParams.get("q") || "";
  const collectionTitle = searchParams.get("collectionTitle");
  useScrollRestoration();

  const summer = useLazyCurationProducts("summer-essentials");
  const ourPicks = useLazyCurationProducts("our-picks");
  const justOpened = useLazyJustOpenedProducts(12);

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
              />
            </div>
            <div ref={ourPicks.sectionRef}>
              <CurationSection
                title="Our Picks"
                viewAllHref="/?collection=our-picks"
                products={ourPicks.products}
                loading={ourPicks.loading}
                animationDelay="0.45s"
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
              />
            </div>
            <InstagramReels />
          </div>
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
