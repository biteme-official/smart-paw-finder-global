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
  const [activeModal, setActiveModal] = useState<number | null>(null);
  const [optionDialogOpen, setOptionDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ShopifyProduct | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const hasDragged = useRef(false);
  const dragStartX = useRef(0);
  const scrollStartLeft = useRef(0);

  useEffect(() => {
    CURATED_REELS.forEach(({ productHandle, shortcode }, i) => {
      fetchProductByHandle(productHandle)
        .then((p) => setProducts((prev) => { const n = [...prev]; n[i] = p; return n; }))
        .catch(() => {});

      fetch(`/api/ig-thumbnail?shortcode=${shortcode}`)
        .then((r) => r.json())
        .then((d: { thumbnail_url: string | null }) => {
          if (d.thumbnail_url) {
            setThumbnails((prev) => { const n = [...prev]; n[i] = d.thumbnail_url; return n; });
          }
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
    const cardW = el.querySelector<HTMLElement>("[data-card]")?.offsetWidth ?? 176;
    el.scrollBy({ left: dir === "left" ? -(cardW + 16) * 2 : (cardW + 16) * 2, behavior: "smooth" });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!scrollRef.current) return;
    isDragging.current = true;
    hasDragged.current = false;
    dragStartX.current = e.clientX;
    scrollStartLeft.current = scrollRef.current.scrollLeft;
    scrollRef.current.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current || !scrollRef.current) return;
    const walk = dragStartX.current - e.clientX;
    if (Math.abs(walk) > 6) hasDragged.current = true;
    scrollRef.current.scrollLeft = scrollStartLeft.current + walk;
  };

  const onPointerUp = () => { isDragging.current = false; };

  const openModal = (i: number) => { if (!hasDragged.current) setActiveModal(i); };
  const closeModal = () => setActiveModal(null);
  const modalNav = (delta: number) =>
    setActiveModal((prev) => prev === null ? null : (prev + delta + CURATED_REELS.length) % CURATED_REELS.length);

  return (
    <section className="py-10 bg-[#fafafa]">
      <div className="max-w-7xl mx-auto px-4 mb-6">
        <h2 className="text-xl font-bold text-center">Loved by the Community 🐾</h2>
      </div>

      <div className="relative max-w-7xl mx-auto">
        {canScrollLeft && (
          <button
            onClick={() => scrollByCards("left")}
            className="absolute left-2 top-[38%] -translate-y-1/2 z-10 bg-white/90 shadow-lg rounded-full p-2.5 hover:bg-white transition-colors"
            aria-label="이전"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-scroll scrollbar-hide px-4 pb-2 select-none"
          style={{ WebkitOverflowScrolling: "touch", cursor: isDragging.current ? "grabbing" : "grab" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          {CURATED_REELS.map(({ shortcode }, i) => {
            const product = products[i];
            const thumb = thumbnails[i] ?? product?.images.edges[0]?.node.url ?? null;
            return (
              <div key={shortcode} data-card className="flex-none flex flex-col w-44">
                <button
                  onClick={() => openModal(i)}
                  className="w-full aspect-[9/16] relative rounded-2xl overflow-hidden bg-muted group"
                  draggable={false}
                >
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={product?.title ?? "Reel"}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      draggable={false}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-orange-100 to-pink-100 animate-pulse" />
                  )}
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-black/25 transition-colors" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-white/80 backdrop-blur-sm rounded-full p-3 shadow-lg group-hover:scale-110 transition-transform">
                      <Play className="h-5 w-5 text-black fill-black" />
                    </div>
                  </div>
                </button>

                {product ? (
                  <div className="mt-2 bg-white rounded-xl border border-border p-2.5 shadow-sm">
                    <p className="text-xs font-semibold line-clamp-2 leading-tight">{product.title}</p>
                    <p className="text-xs text-orange-500 font-bold mt-1">
                      {formatPrice(
                        product.priceRange.minVariantPrice.amount,
                        product.priceRange.minVariantPrice.currencyCode
                      )}
                    </p>
                    <Button
                      size="sm"
                      className="w-full mt-2 bg-black text-white hover:bg-black/80 rounded-full h-7 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProduct({ node: product } as ShopifyProduct);
                        setOptionDialogOpen(true);
                      }}
                    >
                      <ShoppingCart className="h-3 w-3 mr-1" />
                      Add to Cart
                    </Button>
                  </div>
                ) : (
                  <div className="mt-2 h-20 bg-muted rounded-xl animate-pulse" />
                )}
              </div>
            );
          })}
        </div>

        {canScrollRight && (
          <button
            onClick={() => scrollByCards("right")}
            className="absolute right-2 top-[38%] -translate-y-1/2 z-10 bg-white/90 shadow-lg rounded-full p-2.5 hover:bg-white transition-colors"
            aria-label="다음"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>

      {activeModal !== null && (
        <div
          className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            className="relative w-full max-w-[340px] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeModal}
              className="absolute -top-9 right-0 text-white/80 hover:text-white transition-colors"
              aria-label="닫기"
            >
              <X className="h-6 w-6" />
            </button>

            <button
              onClick={() => modalNav(-1)}
              className="absolute left-0 top-[45%] -translate-y-1/2 -translate-x-12 bg-white/20 hover:bg-white/40 rounded-full p-2 text-white transition-colors"
              aria-label="이전 릴스"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => modalNav(1)}
              className="absolute right-0 top-[45%] -translate-y-1/2 translate-x-12 bg-white/20 hover:bg-white/40 rounded-full p-2 text-white transition-colors"
              aria-label="다음 릴스"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            <div className="w-full aspect-[9/16] rounded-2xl overflow-hidden bg-black">
              <iframe
                key={CURATED_REELS[activeModal].shortcode}
                src={`https://www.instagram.com/p/${CURATED_REELS[activeModal].shortcode}/embed/?cr=1&v=14`}
                className="w-full h-full border-0"
                allowFullScreen
                allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
                scrolling="no"
                title={`Instagram Reel ${CURATED_REELS[activeModal].shortcode}`}
              />
            </div>

            {products[activeModal] && (
              <div className="mt-3 bg-white rounded-2xl p-3 flex items-center gap-3">
                <img
                  src={products[activeModal]!.images.edges[0]?.node.url}
                  alt={products[activeModal]!.title}
                  className="w-14 h-14 rounded-xl object-cover flex-none"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold line-clamp-2 leading-tight">
                    {products[activeModal]!.title}
                  </p>
                  <p className="text-sm text-orange-500 font-bold mt-0.5">
                    {formatPrice(
                      products[activeModal]!.priceRange.minVariantPrice.amount,
                      products[activeModal]!.priceRange.minVariantPrice.currencyCode
                    )}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="flex-none bg-black text-white hover:bg-black/80 rounded-full"
                  onClick={() => {
                    setSelectedProduct({ node: products[activeModal]! } as ShopifyProduct);
                    setOptionDialogOpen(true);
                  }}
                >
                  <ShoppingCart className="h-3.5 w-3.5 mr-1" />
                  Add
                </Button>
              </div>
            )}

            <div className="flex justify-center gap-1.5 mt-3">
              {CURATED_REELS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveModal(i)}
                  className={`h-1.5 rounded-full transition-all duration-200 ${
                    i === activeModal ? "w-4 bg-white" : "w-1.5 bg-white/40"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

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
