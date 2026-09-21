import { useSearchParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { HeroBanner } from "@/components/home/HeroBanner";
import { PopularProducts } from "@/components/home/PopularProducts";
import { JustOpened } from "@/components/home/JustOpened";
import { InstagramReels } from "@/components/home/InstagramReels";
import { CategoryIcons } from "@/components/home/categories/CategoryIcons";
import { PromoBanner } from "@/components/home/promo/PromoBanner";
import { WhatYouMightLike } from "@/components/home/curated/WhatYouMightLike";
import { HowItWorks } from "@/components/home/how-it-works/HowItWorks";
import { TopSellersGrid } from "@/components/home/bestsellers/TopSellersGrid";
import { ProductGrid } from "@/components/shop/ProductGrid";
import { useScrollRestoration } from "@/hooks/useScrollRestoration";
import { ScrollToTop } from "@/components/ui/ScrollToTop";

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCollection = searchParams.get("collection");
  const searchQuery = searchParams.get("q") || "";
  const collectionTitle = searchParams.get("collectionTitle");
  useScrollRestoration();

  // "all" is the Shop All sentinel — a real listing page (not the home page) that fetches
  // every product with no collection filter. `null` is reserved for "no selection at all",
  // which is what sends the page back to the home hero-banner layout.
  const isShopAll = selectedCollection === "all";
  const collectionHandleForGrid = isShopAll ? null : selectedCollection;

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
    <div className="bg-background min-h-screen max-w-[1600px] mx-auto md:border-x md:border-border">
      <Header
        onSearch={handleSearch}
        onCollectionSelect={handleCollectionSelect}
      />
      {showHeroBanner && (
        <div className="flex flex-col gap-9 md:gap-0">
          <HeroBanner />
          <CategoryIcons onSelect={handleCollectionSelect} />
          <PopularProducts />
          <JustOpened />
          <PromoBanner />
          <InstagramReels />
          <WhatYouMightLike />
          <HowItWorks />
          <TopSellersGrid />
        </div>
      )}
      {!showHeroBanner && (
        <>
          <CategoryIcons onSelect={handleCollectionSelect} selectedHandle={selectedCollection} showTitle={false} compact />
          <div className="max-w-7xl mx-auto px-4">
            <hr className="mt-6 border-t border-neutral-200 md:mt-8" />
          </div>
          <main className="max-w-7xl mx-auto">
            <ProductGrid
              searchQuery={searchQuery}
              collectionHandle={collectionHandleForGrid}
              overrideTitle={isShopAll ? "All Items" : collectionTitle}
              defaultBestSelling={false}
            />
          </main>
        </>
      )}
      <Footer />
      <ScrollToTop />
    </div>
  );
};

export default Index;
