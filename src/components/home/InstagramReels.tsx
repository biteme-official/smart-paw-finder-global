import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight, Volume2, VolumeX } from "lucide-react";
import { CURATED_REELS } from "@/data/curated-reels";
import { fetchCuratedReels, fetchProductByHandle, ShopifyProduct, formatPrice } from "@/lib/shopify";
import { useCartStore } from "@/stores/cartStore";
import { Button } from "@/components/ui/button";
import { ProductOptionDialog } from "@/components/shop/ProductOptionDialog";
import { toast } from "sonner";

type ProductNode = ShopifyProduct["node"];

interface ReelItem {
  id: string;
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
      id: r.id,
      productHandle: r.productHandle,
      thumbnailUrl: r.thumbnailUrl,
      videoUrl: r.videoUrl,
    }));
  }
  return CURATED_REELS.map((r, i) => ({
    id: `static-${i}`,
    productHandle: r.productHandle,
    thumbnailUrl: r.thumbnailUrl ?? null,
    videoUrl: null,
  }));
}

export function InstagramReels() {
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [products, setProducts] = useState<(ProductNode | null)[]>([]);
  // activeIndex: virtual index into the triple-cloned array [copy0, copy1, copy2]
  // Always normalized into copy1 (range [n, 2n-1]) after any scroll/navigation.
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [videoFailed, setVideoFailed] = useState(false);
  const [optionDialogOpen, setOptionDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ShopifyProduct | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Prevents the scrollToCard effect from firing a second smooth scroll after a silent jump
  const isNormalizingRef = useRef(false);

  const n = reels.length;

  // Triple the reels for infinite illusion: [copy0][copy1][copy2]
  // copy1 (indices n..2n-1) is the "active" window we always normalize back to.
  const virtualReels = useMemo(
    () => (n > 0 ? [...reels, ...reels, ...reels] : []),
    [reels, n]
  );

  // Real index into the original reels array (0..n-1)
  const realActiveIndex = n > 0 ? ((activeIndex % n) + n) % n : 0;

  const addItem = useCartStore(state => state.addItem);

  // React's muted prop is buggy — set el.muted directly on mount, then call play()
  const videoCallbackRef = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (!el) return;
    el.muted = true;
    setVideoFailed(false);
    // If already buffered (fast network / cached), show immediately
    if (el.readyState >= 3) el.style.opacity = '1';
    el.play().catch(err => console.warn('[InstagramReels] autoplay blocked:', err));
  }, []);

  const initProducts = useCallback((list: ReelItem[]) => {
    setProducts(Array(list.length).fill(null));
    list.forEach(({ productHandle }, i) => {
      fetchProductByHandle(productHandle)
        .then(p => setProducts(prev => { const next = [...prev]; next[i] = p; return next; }))
        .catch(() => {});
    });
  }, []);

  useEffect(() => {
    fetchCuratedReels(20)
      .then(r => {
        const list = buildReelList(r);
        setReels(list);
        initProducts(list);
        setActiveIndex(list.length); // Start at first card of copy1 (real index 0)
      })
      .catch(() => {
        const list = buildReelList([]);
        setReels(list);
        initProducts(list);
        setActiveIndex(list.length);
      });
  }, [initProducts]);

  // Scroll to a virtual card index.
  // instant=true: no animation (used for silent boundary jumps)
  const scrollToCard = useCallback((index: number, instant = false) => {
    const container = scrollRef.current;
    const card = cardRefs.current[index];
    if (!container || !card) return;
    const target = card.offsetLeft + card.offsetWidth / 2 - container.clientWidth / 2;
    if (instant) {
      // Temporarily disable scroll-snap so the browser doesn't fight the instant jump
      container.style.scrollSnapType = 'none';
      container.scrollLeft = Math.max(0, target);
      requestAnimationFrame(() => {
        container.style.scrollSnapType = 'x mandatory';
      });
    } else {
      container.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
    }
  }, []);

  // Navigate to a virtual index (arrow clicks, card clicks).
  // No modulo — let normalizeAfterScroll handle boundary wrapping.
  const goTo = useCallback((index: number) => {
    if (n === 0) return;
    setActiveIndex(index);
  }, [n]);

  // After user scroll lands on a card, normalize virtual index back to copy1
  // if we've drifted into copy0 or copy2. The instant jump is invisible because
  // copy0/copy2 content is identical to copy1 at the equivalent position.
  const normalizeAfterScroll = useCallback((newActive: number) => {
    if (n === 0) return;
    let targetIdx = newActive;
    if (newActive < n) targetIdx = newActive + n;          // copy0 → copy1
    else if (newActive >= 2 * n) targetIdx = newActive - n; // copy2 → copy1

    if (targetIdx !== newActive) {
      isNormalizingRef.current = true;
      scrollToCard(targetIdx, true); // silent instant jump
    }
    setActiveIndex(targetIdx);
  }, [n, scrollToCard]);

  // Detect which card is centered after user swipe.
  // touchend + 350ms: waits for iOS scroll-snap animation before reading position.
  // scrollend: modern-browser complement.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || n === 0) return;

    const detectCenter = () => {
      const center = container.scrollLeft + container.clientWidth / 2;
      let closest = 0, minDist = Infinity;
      cardRefs.current.forEach((card, i) => {
        if (!card) return;
        const d = Math.abs(card.offsetLeft + card.offsetWidth / 2 - center);
        if (d < minDist) { minDist = d; closest = i; }
      });
      normalizeAfterScroll(closest);
    };

    let t: ReturnType<typeof setTimeout>;
    const onTouchEnd = () => { t = setTimeout(detectCenter, 350); };

    container.addEventListener('touchend', onTouchEnd, { passive: true });
    container.addEventListener('scrollend', detectCenter);

    return () => {
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('scrollend', detectCenter);
      clearTimeout(t);
    };
  }, [n, normalizeAfterScroll]);

  // Fallback timer: auto-advance when there's no video
  useEffect(() => {
    if (n === 0) return;
    const hasVideo = !!reels[realActiveIndex]?.videoUrl && !videoFailed;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!hasVideo) {
      timerRef.current = setTimeout(() => goTo(activeIndex + 1), FALLBACK_ADVANCE_MS);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [realActiveIndex, reels, goTo, videoFailed, activeIndex, n]);

  // Reset video failure state when the real card changes
  useEffect(() => { setVideoFailed(false); }, [realActiveIndex]);

  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setMuted(m => {
      const next = !m;
      if (videoRef.current) videoRef.current.muted = next;
      return next;
    });
  }, []);

  // Scroll active card to center on arrow/dot navigation.
  // Skip if we just did a silent normalization jump (isNormalizingRef).
  // Use instant scroll on first load (scrollLeft === 0) to avoid a visible animation.
  useEffect(() => {
    if (isNormalizingRef.current) {
      isNormalizingRef.current = false;
      return;
    }
    const id = requestAnimationFrame(() => {
      const container = scrollRef.current;
      const isInitialPosition = !container || container.scrollLeft === 0;
      scrollToCard(activeIndex, isInitialPosition);
    });
    return () => cancelAnimationFrame(id);
  }, [activeIndex, virtualReels.length, scrollToCard]);

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

  if (n === 0) return null;

  return (
    <section className="mt-6 pb-4">
      <div className="px-4 mb-4">
        <h2 className="text-base font-bold text-foreground">Loved by the Community 🐾</h2>
      </div>

      <div className="relative">
        <div
          ref={scrollRef}
          className="flex gap-2 md:gap-3 overflow-x-auto scrollbar-hide py-4"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {/* Left spacer — centers the first active card in copy1 */}
          <div className="flex-shrink-0 w-[24vw] md:w-16" aria-hidden />

          {virtualReels.map(({ id, thumbnailUrl, videoUrl }, i) => {
            const isActive = i === activeIndex;
            const realIdx = i % n;
            const product = products[realIdx];
            const poster = thumbnailUrl ? getThumbSrc(thumbnailUrl) : undefined;

            return (
              <div
                key={`${realIdx}-${Math.floor(i / n)}`}
                ref={el => { cardRefs.current[i] = el; }}
                className={`flex-shrink-0 flex flex-col w-[52vw] md:w-[175px] rounded-2xl overflow-hidden bg-secondary shadow-sm transition-[opacity,transform] duration-300 ${
                  isActive ? "opacity-100" : "opacity-60 cursor-pointer"
                }`}
                style={{
                  scrollSnapAlign: "center",
                  transform: isActive ? "scale(1)" : "scale(0.88)",
                  transformOrigin: "center",
                }}
                onClick={() => { if (!isActive) goTo(i); }}
              >
                {/* 9:16 media area */}
                <div className="w-full aspect-[9/16] relative bg-black">
                  {isActive && videoUrl && !videoFailed ? (
                    <>
                      {/* Thumbnail shown while video buffers — prevents black flash */}
                      {thumbnailUrl && (
                        <img
                          src={poster}
                          alt=""
                          aria-hidden
                          width={1080}
                          height={1920}
                          className="absolute inset-0 w-full h-full object-cover"
                          draggable={false}
                        />
                      )}
                      {/* Video starts invisible; fades in once canplay fires */}
                      <video
                        ref={videoCallbackRef}
                        key={`video-${realActiveIndex}`}
                        src={videoUrl}
                        autoPlay
                        playsInline
                        preload="auto"
                        onCanPlay={e => { (e.target as HTMLVideoElement).style.opacity = '1'; }}
                        onEnded={handleVideoEnded}
                        onError={() => {
                          console.error('[InstagramReels] video load failed. URL:', videoUrl);
                          setVideoFailed(true);
                        }}
                        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
                        style={{ opacity: 0 }}
                      />
                      <button
                        onClick={toggleMute}
                        className="absolute top-3 right-3 z-10 bg-black/50 hover:bg-black/70 rounded-full p-2 transition-colors"
                        aria-label={muted ? "소리 켜기" : "소리 끄기"}
                      >
                        {muted
                          ? <VolumeX className="h-4 w-4 text-white" />
                          : <Volume2 className="h-4 w-4 text-white" />
                        }
                      </button>
                    </>
                  ) : thumbnailUrl ? (
                    <img
                      src={poster}
                      alt={`Reel ${realIdx + 1}`}
                      width={1080}
                      height={1920}
                      className="absolute inset-0 w-full h-full object-cover"
                      draggable={false}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-50 to-pink-100" />
                  )}

                  {/* Progress bar — thumbnail-only active card */}
                  {isActive && !videoUrl && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20">
                      <div
                        key={realActiveIndex}
                        className="h-full bg-white/70"
                        style={{ animation: `reel-progress ${FALLBACK_ADVANCE_MS}ms linear forwards` }}
                      />
                    </div>
                  )}
                </div>

                {/* Product info */}
                <div className="p-2 pb-3">
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
          <div className="flex-shrink-0 w-[24vw] md:w-16" aria-hidden />
        </div>

        <button
          onClick={() => goTo(activeIndex - 1)}
          className="absolute left-2 top-[38%] -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-md rounded-full p-2 transition-colors"
          aria-label="이전"
        >
          <ChevronLeft className="h-4 w-4 text-foreground" />
        </button>
        <button
          onClick={() => goTo(activeIndex + 1)}
          className="absolute right-2 top-[38%] -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-md rounded-full p-2 transition-colors"
          aria-label="다음"
        >
          <ChevronRight className="h-4 w-4 text-foreground" />
        </button>
      </div>

      {/* Dot indicators — based on real index */}
      <div className="flex justify-center gap-1.5 mt-3">
        {reels.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(n + i)} // Always jump to copy1 equivalent
            className={`rounded-full transition-all duration-300 ${
              i === realActiveIndex
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
