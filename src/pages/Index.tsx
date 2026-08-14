import { useSearchParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { HeroPlaceholder } from "@/components/home/HeroPlaceholder";
import { PopularProducts } from "@/components/home/PopularProducts";
import { InstagramReels } from "@/components/home/InstagramReels";
import { CategoryIcons } from "@/components/home/categories/CategoryIcons";
import { PromoBanner } from "@/components/home/promo/PromoBanner";
import { WhatYouMightLike } from "@/components/home/curated/WhatYouMightLike";
import { HowItWorks } from "@/components/home/how-it-works/HowItWorks";
import { BrandShowcase } from "@/components/home/brand/BrandShowcase";
import { ProductGrid } from "@/components/shop/ProductGrid";
import { useScrollRestoration } from "@/hooks/useScrollRestoration";
import { ScrollToTop } from "@/components/ui/ScrollToTop";

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCollection = searchParams.get("collection");
  const searchQuery = searchParams.get("q") || "";
  const collectionTitle = searchParams.get("collectionTitle");
  useScrollRestoration();

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
          <HeroPlaceholder />
          <div className="max-w-[1600px] mx-auto">
            <CategoryIcons onSelect={handleCollectionSelect} />
            <PopularProducts />
          </div>
          <PromoBanner />
          <div className="max-w-[1600px] mx-auto">
            <InstagramReels />
            <WhatYouMightLike />
            <HowItWorks />
          </div>
          <BrandShowcase />
        </>
      )}
      {!showHeroBanner && (
        <main className="max-w-7xl mx-auto pb-20">
          <ProductGrid
            searchQuery={searchQuery}
            collectionHandle={selectedCollection}
            overrideTitle={collectionTitle}
            defaultBestSelling={false}
          />
        </main>
      )}
      <Footer />
      <ScrollToTop />
    </div>
  );
};

export default Index;
