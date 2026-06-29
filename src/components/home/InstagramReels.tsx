import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, Play, X, ShoppingCart } from "lucide-react";
import { CURATED_REELS } from "@/data/curated-reels";
import { fetchProductByHandle, ShopifyProduct, formatPrice } from "@/lib/shopify";
import { Button } from "@/components/ui/button";
import { ProductOptionDialog } from "@/components/shop/ProductOptionDialog";

type ProductNode = ShopifyProduct["node"];

export function InstagramReels() {
  const [products, setProducts] = useState<(ProductNode | null)[]>(
    Array(CURATED_REELS.length).fill(null)
  );
  const [thumbnails, setThumbnails] = useState<(string | null)[]>(
    Array(CURATED_REELS.length).fill(null)
  );
  const [activeCard, setActiveCard] = useState<number | null>(null);
  const [optionDialogOpen, setOptionDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ShopifyProduct | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef(0);
  const scrollStartLeft = useRef(0);
  const hasDragged = useRef(false);
  const isPointerDown = useRef(false);

  useEffect(() => {
    CURATED_REELS.forEach(({ productHandle, shortcode }, i) => {
      fetchProductByHandle(productHandle)
        .then((p) => setProducts((prev) => { const n = [...prev]; n[i] = p; return n; }))
        .catch(() => {});

      fetch(`/api/ig-thumbnail?shortcode=${shortcode}`)
        .then((r) => r.json())
        .then((d: { thumbnail_url: string | null }) => {
          if (d.thumbnail_url) setThumbnails((prev) => { const n = [...prev]; n[i] = d.thumbnail_url; return n; });
        })
        .catch(() => {});
    });
  }, []);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [products, updateScrollState]);

  const scrollByCards = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const cardW = (el.querySelector<HTMLElement>("[data-card]")?.offsetWidth ?? 208) + 12;
    el.scrollBy({ left: dir === "left" ? -cardW * 2 : cardW * 2, behavior: "smooth" });
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!scrollRef.current) return;
    isPointerDown.current = true;
    hasDragged.current = false;
    dragStartX.current = e.clientX;
    scrollStartLeft.current = scrollRef.current.scrollLeft;
    scrollRef.current.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDown.current || !scrollRef.current) return;
    const walk = dragStartX.current - e.clientX;
    if (Math.abs(walk) > 6) hasDragged.current = true;
    scrollRef.current.scrollLeft = scrollStartLeft.current + walk;
  };

  const onPointerUp = () => { isPointerDown.current = false; };

  const handleThumbClick = (i: number) => {
    if (!hasDragged.current) setActiveCard(i);
  };

  return (
    // mt-6 pb-4 matches CurationSection's outer section classes exactly
    <section className="mt-6 pb-4">
      <div className="flex items-center justify-between px-4 mb-3">
        <h2 className="text-base font-bold text-foreground">Loved by the Community 🐾</h2>
      </div>

      <div className="relative group">
        {canScrollLeft && (
          <button
            onClick={() => scrollByCards("left")}
            className="absolute left-0 top-[40%] -translate-y-1/2 -translate-x-1 z-10 bg-white/90 shadow-md rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="이전"
          >
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </button>
        )}

        <div
          ref={scrollRef}
          className="flex gap-3 md:gap-4 px-4 overflow-x-auto pb-2 scrollbar-hide select-none"
          style={{ WebkitOverflowScrolling: "touch" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          {CURATED_REELS.map(({ shortcode }, i) => {
            const product = products[i];
            const reelThumb = thumbnails[i];
            const isActive = activeCard === i;

            return (
              <div key={shortcode} data-card className="flex-shrink-0 flex flex-col w-40 md:w-52">
                {/* 상단: 릴스 썸네일 (9:16) */}
                <div className="w-full aspect-[9/16] relative rounded-xl overflow-hidden bg-muted">
                  {isActive ? (
                    <>
                      <iframe
                        key={shortcode}
                        src={`https://www.instagram.com/p/${shortcode}/embed/?cr=1&v=14`}
                        className="w-full h-full border-0"
                        allowFullScreen
                        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
                        scrolling="no"
                        title={`Instagram Reel ${shortcode}`}
                      />
                      <button
                        onClick={() => setActiveCard(null)}
                        className="absolute top-2 right-2 z-10 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors"
                        aria-label="닫기"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <button
                      className="w-full h-full relative group/card"
                      onClick={() => handleThumbClick(i)}
                      draggable={false}
                    >
                      {reelThumb ? (
                        <img
                          src={reelThumb}
                          alt={`Reel ${i + 1}`}
                          className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-300"
                          draggable={false}
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-orange-50 to-pink-100 flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-black/10 animate-pulse" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/10 group-hover/card:bg-black/25 transition-colors" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-white/80 backdrop-blur-sm rounded-full p-2.5 shadow-lg group-hover/card:scale-110 transition-transform">
                          <Play className="h-4 w-4 text-black fill-black" />
                        </div>
                      </div>
                    </button>
                  )}
                </div>

                {/* 하단: 상품 카드 */}
                {product ? (
                  <div className="mt-1.5 bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                    <div className="p-2.5">
                      <div className="flex items-center gap-2 mb-1.5">
                        <img
                          src={product.images.edges[0]?.node.url}
                          alt={product.title}
                          className="w-8 h-8 rounded-lg object-cover flex-none"
                          draggable={false}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium text-foreground line-clamp-2 leading-tight">
                            {product.title}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-sm font-bold text-orange-500 leading-none" translate="no">
                          {formatPrice(
                            product.priceRange.minVariantPrice.amount,
                            product.priceRange.minVariantPrice.currencyCode
                          )}
                        </span>
                        <Button
                          size="sm"
                          className="h-8 w-8 p-0 flex-shrink-0 rounded-full bg-secondary text-foreground hover:bg-secondary/80"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProduct({ node: product } as ShopifyProduct);
                            setOptionDialogOpen(true);
                          }}
                        >
                          <ShoppingCart className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1.5 h-20 bg-muted rounded-xl animate-pulse" />
                )}
              </div>
            );
          })}
        </div>

        {canScrollRight && (
          <button
            onClick={() => scrollByCards("right")}
            className="absolute right-0 top-[40%] -translate-y-1/2 translate-x-1 z-10 bg-white/90 shadow-md rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="다음"
          >
            <ChevronRight className="h-5 w-5 text-foreground" />
          </button>
        )}
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
