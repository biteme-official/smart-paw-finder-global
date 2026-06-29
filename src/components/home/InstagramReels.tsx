import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, Play, ShoppingCart } from "lucide-react";
import { CURATED_REELS } from "@/data/curated-reels";
import { fetchProductByHandle, ShopifyProduct, formatPrice } from "@/lib/shopify";
import { Button } from "@/components/ui/button";
import { ProductOptionDialog } from "@/components/shop/ProductOptionDialog";

type ProductNode = ShopifyProduct["node"];

export function InstagramReels() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [products, setProducts] = useState<(ProductNode | null)[]>(
    Array(CURATED_REELS.length).fill(null)
  );
  const [optionDialogOpen, setOptionDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ShopifyProduct | null>(null);
  const dragStartX = useRef<number | null>(null);

  useEffect(() => {
    CURATED_REELS.forEach(({ productHandle }, i) => {
      fetchProductByHandle(productHandle)
        .then((p) => {
          setProducts((prev) => {
            const next = [...prev];
            next[i] = p;
            return next;
          });
        })
        .catch(() => {});
    });
  }, []);

  const goTo = useCallback((index: number) => {
    setActiveIndex(((index % CURATED_REELS.length) + CURATED_REELS.length) % CURATED_REELS.length);
  }, []);

  const prev = () => goTo(activeIndex - 1);
  const next = () => goTo(activeIndex + 1);

  const onDragStart = (clientX: number) => { dragStartX.current = clientX; };
  const onDragEnd = (clientX: number) => {
    if (dragStartX.current === null) return;
    const diff = dragStartX.current - clientX;
    if (Math.abs(diff) > 50) diff > 0 ? next() : prev();
    dragStartX.current = null;
  };

  const activeReel = CURATED_REELS[activeIndex];
  const activeProduct = products[activeIndex];

  return (
    <section className="py-10 px-4 bg-[#fafafa]">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-xl font-bold text-center mb-8">Loved by the Community 🐾</h2>

        <div className="flex items-start gap-3 justify-center">
          <button
            onClick={prev}
            className="mt-28 p-2 rounded-full bg-white shadow-md hover:bg-gray-100 transition-colors flex-none"
            aria-label="이전 릴스"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div
            className="flex flex-col items-center w-full max-w-[300px]"
            onMouseDown={(e) => onDragStart(e.clientX)}
            onMouseUp={(e) => onDragEnd(e.clientX)}
            onTouchStart={(e) => onDragStart(e.touches[0].clientX)}
            onTouchEnd={(e) => onDragEnd(e.changedTouches[0].clientX)}
          >
            <div className="w-full aspect-[9/16] rounded-2xl overflow-hidden bg-black shadow-xl">
              <iframe
                key={activeReel.shortcode}
                src={`https://www.instagram.com/p/${activeReel.shortcode}/embed/?cr=1&v=14`}
                className="w-full h-full border-0"
                allowFullScreen
                allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
                scrolling="no"
                title={`Instagram Reel ${activeReel.shortcode}`}
              />
            </div>

            {activeProduct && (
              <div className="mt-3 w-full bg-white rounded-2xl shadow-sm border border-border p-3 flex items-center gap-3">
                <img
                  src={activeProduct.images.edges[0]?.node.url}
                  alt={activeProduct.title}
                  className="w-14 h-14 rounded-xl object-cover flex-none"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-tight line-clamp-2">{activeProduct.title}</p>
                  <p className="text-sm text-orange-500 font-bold mt-1">
                    {formatPrice(
                      activeProduct.priceRange.minVariantPrice.amount,
                      activeProduct.priceRange.minVariantPrice.currencyCode
                    )}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="flex-none bg-black text-white hover:bg-black/80 rounded-full px-3"
                  onClick={() => {
                    setSelectedProduct({ node: activeProduct } as ShopifyProduct);
                    setOptionDialogOpen(true);
                  }}
                >
                  <ShoppingCart className="h-3.5 w-3.5 mr-1" />
                  Add
                </Button>
              </div>
            )}

            <div className="flex items-center gap-2 mt-4">
              {CURATED_REELS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === activeIndex ? "w-5 bg-black" : "w-2 bg-gray-300 hover:bg-gray-400"
                  }`}
                  aria-label={`${i + 1}번 릴스로 이동`}
                />
              ))}
            </div>
          </div>

          <button
            onClick={next}
            className="mt-28 p-2 rounded-full bg-white shadow-md hover:bg-gray-100 transition-colors flex-none"
            aria-label="다음 릴스"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-2 justify-center mt-5 overflow-x-auto pb-1 scrollbar-hide">
          {CURATED_REELS.map(({ shortcode }, i) => {
            const product = products[i];
            const isActive = i === activeIndex;
            return (
              <button
                key={shortcode}
                onClick={() => goTo(i)}
                className={`flex-none w-16 aspect-[9/16] rounded-xl overflow-hidden relative transition-all duration-200 ${
                  isActive ? "ring-2 ring-black scale-105" : "opacity-50 hover:opacity-75"
                }`}
                aria-label={`${i + 1}번 릴스 선택`}
              >
                {product?.images.edges[0]?.node.url ? (
                  <img
                    src={product.images.edges[0].node.url}
                    alt={product.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-orange-100 to-pink-100" />
                )}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className={`rounded-full p-1 ${isActive ? "bg-black/60" : "bg-black/40"}`}>
                    <Play className="h-2.5 w-2.5 text-white fill-white" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
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
