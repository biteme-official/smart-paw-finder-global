import { useEffect, useState, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ShopifyProduct, fetchBestSellingProducts } from "@/lib/shopify";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductOptionDialog } from "@/components/shop/ProductOptionDialog";
import { ProductCard, ProductCardBadge } from "@/components/shop/ProductCard";

const BADGES: ProductCardBadge[] = [
  { label: "BEST", className: "bg-red-500 text-white" },
  { label: "HOT",  className: "bg-orange-500 text-white" },
  { label: "PICK", className: "bg-primary text-primary-foreground" },
  { label: "TOP",  className: "bg-amber-500 text-white" },
];

export function PopularProducts() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [optionDialogOpen, setOptionDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ShopifyProduct | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateScrollButtons();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollButtons, { passive: true });
    window.addEventListener("resize", updateScrollButtons);
    return () => {
      el.removeEventListener("scroll", updateScrollButtons);
      window.removeEventListener("resize", updateScrollButtons);
    };
  }, [products, updateScrollButtons]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === "left" ? -el.clientWidth * 0.8 : el.clientWidth * 0.8, behavior: "smooth" });
  };

  useEffect(() => {
    fetchBestSellingProducts(12)
      .then((result) => setProducts(result.filter(p => p.node.variants.edges.some(v => v.node.availableForSale))))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section className="mt-6 pb-4">
        <div className="flex items-center justify-between px-4 mb-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex gap-3 px-4 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex-shrink-0 w-40 md:w-52 bg-card rounded-xl border border-border overflow-hidden">
              <Skeleton className="aspect-square w-full" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (products.length === 0) return null;

  return (
    <section className="mt-6 pb-4 animate-fade-up" style={{ animationDelay: "0.3s" }}>
      <div className="flex items-center justify-between px-4 mb-3">
        <h2 className="text-base font-bold text-foreground">Popular Products</h2>
        <button
          onClick={() => { document.getElementById("product-grid")?.scrollIntoView({ behavior: "smooth" }); }}
          className="flex items-center gap-0.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          View All
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="relative group">
        <div ref={scrollRef} className="flex gap-3 md:gap-4 px-4 overflow-x-auto pb-2 scrollbar-hide">
          {products.map((product, index) => (
            <div key={product.node.id} className="flex-shrink-0 w-40 md:w-52">
              <ProductCard
                product={product}
                badge={BADGES[index % BADGES.length]}
                onClick={() => navigate(`/product/${product.node.handle}`)}
                onAddToCart={() => { setSelectedProduct(product); setOptionDialogOpen(true); }}
              />
            </div>
          ))}
        </div>

        {canScrollLeft && (
          <button onClick={() => scroll("left")} className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 z-10 bg-white/90 shadow-md rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </button>
        )}
        {canScrollRight && (
          <button onClick={() => scroll("right")} className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 z-10 bg-white/90 shadow-md rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronRight className="h-5 w-5 text-foreground" />
          </button>
        )}
      </div>

      <ProductOptionDialog product={selectedProduct} open={optionDialogOpen} onOpenChange={setOptionDialogOpen} />
    </section>
  );
}
