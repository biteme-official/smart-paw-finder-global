import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CURATED_REELS } from "@/data/curated-reels";
import { fetchCuratedReels, fetchProductByHandle, ShopifyProduct, formatPrice } from "@/lib/shopify";
import { useCartStore } from "@/stores/cartStore";
import { Button } from "@/components/ui/button";
import { ProductOptionDialog } from "@/components/shop/ProductOptionDialog";
import { toast } from "sonner";

type ProductNode = ShopifyProduct["node"];

interface ReelItem {
  shortcode: string;
  productHandle: string;
  thumbnailUrl: string | null;
}

const AUTO_ADVANCE_MS = 20_000;

const getThumbSrc = (url: string) => {
  if (!url.includes("cdn.shopify.com")) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}width=1080&height=1920&crop=center`;
};

function loadReels(shopifyReels: Awaited<ReturnType<typeof fetchCuratedReels>>): ReelItem[] {
  if (shopifyReels.length > 0) {
    return shopifyReels.map(r => ({
      shortcode: r.shortcode,
      productHandle: r.productHandle,
      thumbnailUrl: r.thumbnailUrl,
    }));
  }
  return CURATED_REELS.map(r => ({
    shortcode: r.shortcode,
    productHandle: r.productHandle,
    thumbnailUrl: r.thumbnailUrl ?? null,
  }));
}

export function InstagramReels() {
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [products, setProducts] = useState<(ProductNode | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [optionDialogOpen, setOptionDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ShopifyProduct | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addItem = useCartStore(state => state.addItem);

  const initProducts = useCallback((list: ReelItem[]) => {
    setProducts(Array(list.length).fill(null));
    list.forEach(({ productHandle }, i) => {
      fetchProductByHandle(productHandle)
        .then(p => setProducts(prev => { const n = [...prev]; n[i] = p; return n; }))
        .catch(() => {});
    });
  }, []);

  useEffect(() => {
    fetchCuratedReels(20)
      .then(shopifyReels => {
        const list = loadReels(shopifyReels);
        setReels(list);
        initProducts(list);
      })
      .catch(() => {
        const list = loadReels([]);
        setReels(list);
        initProducts(list);
      });
  }, [initProducts]);

  // Auto-advance timer — resets whenever activeIndex or reels.length changes
  useEffect(() => {
    if (reels.length === 0) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setActiveIndex(prev => (prev + 1) % reels.length);
    }, AUTO_ADVANCE_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [activeIndex, reels.length]);

  // Scroll active card to center of viewport
  useEffect(() => {
    cardRefs.current[activeIndex]?.scrollIntoView({
      inline: "center",
      behavior: "smooth",
      block: "nearest",
    });
  }, [activeIndex, reels.length]);

  const goTo = useCallback((index: number) => {
    setActiveIndex(prev => {
      const len = reels.length;
      if (len === 0) return prev;
      return ((index % len) + len) % len;
    });
  }, [reels.length]);

  const handleAddToCart = useCallback((product: ProductNode, e: React.MouseEvent) => {
    e.stopPropagation();
    const variants = product.variants.edges;
    const isSingleVariant =
      variants.length === 1 && variants[0].node.title === "Default Title";

    if (isSingleVariant) {
      const variant = variants[0].node;
      addItem({
        product: { node: product } as ShopifyProduct,
        variantId: variant.id,
        variantTitle: variant.title,
        price: variant.price,
        quantity: 1,
        quantityAvailable: null,
        selectedOptions: variant.selectedOptions,
      });
      toast.success("Added to cart", {
        description: product.title,
        position: "top-center",
      });
    } else {
      setSelectedProduct({ node: product } as ShopifyProduct);
      setOptionDialogOpen(true);
    }
  }, [addItem]);

  if (reels.length === 0) return null;

  return (
    <section className="mt-6 pb-4">
      <div className="flex items-center justify-between px-4 mb-4">
        <h2 className="text-base font-bold text-foreground">Loved by the Community 🐾</h2>
      </div>

      <div className="relative">
        {/* Carousel scroll container */}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide py-1"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {/* Left spacer — centers first card */}
          <div className="flex-shrink-0 w-[calc(50vw-130px)] md:w-[calc(50vw-160px)]" aria-hidden />

          {reels.map(({ shortcode, thumbnailUrl }, i) => {
            const isActive = i === activeIndex;
            const product = products[i];

            return (
              <div
                key={shortcode}
                ref={el => { cardRefs.current[i] = el; }}
                style={{ scrollSnapAlign: "center" }}
                className={`flex-shrink-0 flex flex-col transition-all duration-400 ${
                  isActive
                    ? "w-[260px] md:w-[320px] opacity-100"
                    : "w-[200px] md:w-[250px] opacity-55 cursor-pointer"
                }`}
                onClick={() => { if (!isActive) goTo(i); }}
              >
                {/* Video / Thumbnail */}
                <div
                  className={`w-full aspect-[9/16] relative rounded-2xl overflow-hidden bg-muted transition-shadow duration-300 ${
                    isActive ? "shadow-xl" : "shadow-sm"
                  }`}
                >
                  {isActive ? (
                    <iframe
                      key={shortcode}
                      src={`https://www.instagram.com/p/${shortcode}/embed/?cr=1&v=14`}
                      className="w-full h-full border-0"
                      allowFullScreen
                      allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
                      scrolling="no"
                      title={`Instagram Reel ${shortcode}`}
                    />
                  ) : thumbnailUrl ? (
                    <img
                      src={getThumbSrc(thumbnailUrl)}
                      alt={`Reel ${i + 1}`}
                      width={1080}
                      height={1920}
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-orange-50 to-pink-100" />
                  )}

                  {/* Auto-advance progress bar */}
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20">
                      <div
                        key={activeIndex}
                        className="h-full bg-white/70"
                        style={{
                          animation: `reel-progress ${AUTO_ADVANCE_MS}ms linear forwards`,
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Product info */}
                <div className="mt-2 px-0.5">
                  {product ? (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <img
                          src={product.images.edges[0]?.node.url}
                          alt={product.title}
                          className="w-10 h-10 rounded-lg object-cover flex-none border border-border"
                          draggable={false}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground line-clamp-2 leading-tight mb-0.5">
                            {product.title}
                          </p>
                          <span className="text-sm font-bold text-orange-500" translate="no">
                            {formatPrice(
                              product.priceRange.minVariantPrice.amount,
                              product.priceRange.minVariantPrice.currencyCode,
                            )}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full rounded-full text-xs h-8 font-medium"
                        onClick={(e) => handleAddToCart(product, e)}
                      >
                        Add to cart
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="h-10 bg-muted rounded-lg animate-pulse mb-2" />
                      <div className="h-8 bg-muted rounded-full animate-pulse" />
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* Right spacer — centers last card */}
          <div className="flex-shrink-0 w-[calc(50vw-130px)] md:w-[calc(50vw-160px)]" aria-hidden />
        </div>

        {/* Left arrow */}
        <button
          onClick={() => goTo(activeIndex - 1)}
          className="absolute left-2 top-[38%] -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-md rounded-full p-2 transition-colors"
          aria-label="이전"
        >
          <ChevronLeft className="h-4 w-4 text-foreground" />
        </button>

        {/* Right arrow */}
        <button
          onClick={() => goTo(activeIndex + 1)}
          className="absolute right-2 top-[38%] -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-md rounded-full p-2 transition-colors"
          aria-label="다음"
        >
          <ChevronRight className="h-4 w-4 text-foreground" />
        </button>
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-1.5 mt-3">
        {reels.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`rounded-full transition-all duration-300 ${
              i === activeIndex
                ? "w-4 h-1.5 bg-foreground"
                : "w-1.5 h-1.5 bg-foreground/25 hover:bg-foreground/50"
            }`}
            aria-label={`릴스 ${i + 1}`}
          />
        ))}
      </div>

      {selectedProduct && (
        <ProductOptionDialog
          open={optionDialogOpen}
          onOpenChange={setOptionDialogOpen}
          product={selectedProduct}
        />
      )}
    </section>
  );
}
