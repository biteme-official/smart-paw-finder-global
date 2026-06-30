import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, Volume2, VolumeX } from "lucide-react";
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
  videoUrl: string | null;
}

const FALLBACK_ADVANCE_MS = 20_000;

const getThumbSrc = (url: string) => {
  if (!url.includes("cdn.shopify.com")) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}width=1080&height=1920&crop=center`;
};

function buildReelList(shopifyReels: Awaited<ReturnType<typeof fetchCuratedReels>>): ReelItem[] {
  if (shopifyReels.length > 0) {
    return shopifyReels.map(r => ({
      shortcode: r.shortcode,
      productHandle: r.productHandle,
      thumbnailUrl: r.thumbnailUrl,
      videoUrl: r.videoUrl,
    }));
  }
  return CURATED_REELS.map(r => ({
    shortcode: r.shortcode,
    productHandle: r.productHandle,
    thumbnailUrl: r.thumbnailUrl ?? null,
    videoUrl: null,
  }));
}

export function InstagramReels() {
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [products, setProducts] = useState<(ProductNode | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [optionDialogOpen, setOptionDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ShopifyProduct | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
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
      .then(r => { const list = buildReelList(r); setReels(list); initProducts(list); })
      .catch(() => { const list = buildReelList([]); setReels(list); initProducts(list); });
  }, [initProducts]);

  const goTo = useCallback((index: number) => {
    setActiveIndex(prev => {
      const len = reels.length;
      if (len === 0) return prev;
      return ((index % len) + len) % len;
    });
  }, [reels.length]);

  // Play active video; fallback timer for thumbnail-only cards
  useEffect(() => {
    if (reels.length === 0) return;

    const hasVideo = !!reels[activeIndex]?.videoUrl;

    if (timerRef.current) clearTimeout(timerRef.current);

    if (!hasVideo) {
      timerRef.current = setTimeout(() => goTo(activeIndex + 1), FALLBACK_ADVANCE_MS);
    }

    const v = videoRef.current;
    if (v) {
      v.muted = muted;
      v.currentTime = 0;
      v.play().catch(() => {});
    }

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [activeIndex, reels, muted, goTo]);

  // Sync muted state to video element
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  // Scroll active card to center
  useEffect(() => {
    cardRefs.current[activeIndex]?.scrollIntoView({
      inline: "center",
      behavior: "smooth",
      block: "nearest",
    });
  }, [activeIndex, reels.length]);

  const handleVideoEnded = useCallback(() => {
    goTo(activeIndex + 1);
  }, [activeIndex, goTo]);

  const handleAddToCart = useCallback((product: ProductNode, e: React.MouseEvent) => {
    e.stopPropagation();
    const variants = product.variants.edges;
    const isSingleVariant = variants.length === 1 && variants[0].node.title === "Default Title";

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
      toast.success("Added to cart", { description: product.title, position: "top-center" });
    } else {
      setSelectedProduct({ node: product } as ShopifyProduct);
      setOptionDialogOpen(true);
    }
  }, [addItem]);

  if (reels.length === 0) return null;

  const activeReel = reels[activeIndex];

  return (
    <section className="mt-6 pb-4">
      <div className="px-4 mb-4">
        <h2 className="text-base font-bold text-foreground">Loved by the Community 🐾</h2>
      </div>

      <div className="relative">
        {/* Scroll container */}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide py-1"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {/* Left spacer to allow first card to center */}
          <div className="flex-shrink-0 w-[calc(50vw-130px)] md:w-[calc(50vw-160px)]" aria-hidden />

          {reels.map(({ shortcode, thumbnailUrl, videoUrl }, i) => {
            const isActive = i === activeIndex;
            const product = products[i];
            const poster = thumbnailUrl ? getThumbSrc(thumbnailUrl) : undefined;

            return (
              <div
                key={shortcode}
                ref={el => { cardRefs.current[i] = el; }}
                style={{ scrollSnapAlign: "center" }}
                className={`flex-shrink-0 flex flex-col transition-all duration-300 ${
                  isActive
                    ? "w-[260px] md:w-[320px] opacity-100"
                    : "w-[200px] md:w-[250px] opacity-55 cursor-pointer"
                }`}
                onClick={() => { if (!isActive) goTo(i); }}
              >
                {/* Media area — 9:16 */}
                <div
                  className={`w-full aspect-[9/16] relative rounded-2xl overflow-hidden bg-black transition-shadow duration-300 ${
                    isActive ? "shadow-xl" : "shadow-sm"
                  }`}
                >
                  {isActive && videoUrl ? (
                    <>
                      <video
                        ref={videoRef}
                        key={`${shortcode}-video`}
                        src={videoUrl}
                        poster={poster}
                        muted={muted}
                        playsInline
                        preload="auto"
                        onEnded={handleVideoEnded}
                        className="w-full h-full object-cover"
                      />
                      {/* Mute toggle */}
                      <button
                        onClick={e => { e.stopPropagation(); setMuted(m => !m); }}
                        className="absolute top-3 right-3 z-10 bg-black/50 hover:bg-black/70 rounded-full p-1.5 transition-colors"
                        aria-label={muted ? "소리 켜기" : "소리 끄기"}
                      >
                        {muted
                          ? <VolumeX className="h-4 w-4 text-white" />
                          : <Volume2 className="h-4 w-4 text-white" />
                        }
                      </button>
                    </>
                  ) : (
                    /* Thumbnail — active(no video) or inactive card */
                    thumbnailUrl ? (
                      <img
                        src={poster}
                        alt={`Reel ${i + 1}`}
                        width={1080}
                        height={1920}
                        className="w-full h-full object-cover"
                        draggable={false}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-orange-50 to-pink-100" />
                    )
                  )}

                  {/* Auto-advance progress bar (thumbnail-only active card) */}
                  {isActive && !videoUrl && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20">
                      <div
                        key={activeIndex}
                        className="h-full bg-white/70"
                        style={{ animation: `reel-progress ${FALLBACK_ADVANCE_MS}ms linear forwards` }}
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
                        onClick={e => handleAddToCart(product, e)}
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

          {/* Right spacer */}
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
