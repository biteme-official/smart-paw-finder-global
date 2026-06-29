import { useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
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

function useCurationProducts(collectionHandle: string, count = 10) {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetchCollectionProducts(collectionHandle, count)
      .then(r => setProducts(r.products.filter(p => p.node.variants.edges.some(v => v.node.availableForSale))))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [collectionHandle, count]);
  return { products, loading };
}

function useJustOpenedProducts(count = 12) {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetchNewProducts(count)
      .then(r => setProducts(r.filter(p => p.node.variants.edges.some(v => v.node.availableForSale))))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [count]);
  return { products, loading };
}

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCollection = searchParams.get("collection");
  const searchQuery = searchParams.get("q") || "";
  const collectionTitle = searchParams.get("collectionTitle");
  useScrollRestoration();

  const summer = useCurationProducts("summer-essentials");
  const ourPicks = useCurationProducts("our-picks");
  const justOpened = useJustOpenedProducts(12);

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
            <CurationSection
              title="Summer Essentials"
              viewAllHref="/?collection=summer-essentials"
              products={summer.products}
              loading={summer.loading}
              badge="HOT"
              badgeClassName="bg-orange-500 text-white"
              animationDelay="0.4s"
            />
            <CurationSection
              title="Our Picks"
              viewAllHref="/?collection=our-picks"
              products={ourPicks.products}
              loading={ourPicks.loading}
              animationDelay="0.45s"
            />
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
