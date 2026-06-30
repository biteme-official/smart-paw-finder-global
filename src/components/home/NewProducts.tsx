import { useEffect, useState, useRef, useCallback } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ShopifyProduct, fetchNewProducts } from "@/lib/shopify";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductOptionDialog } from "@/components/shop/ProductOptionDialog";
import { ProductCard } from "@/components/shop/ProductCard";
import { fetchBatchReviewSummary } from "@/hooks/useProductReview";

export function NewProducts() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewMap, setReviewMap] = useState<Record<string, { avgRating: number; count: number }>>({});
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
    const amount = el.clientWidth * 0.8;
    el.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  };

  useEffect(() => {
    fetchNewProducts(24)
      .then((result) => {
        const available = result.filter(p =>
          p.node.variants.edges.some(e =>
            e.node.availableForSale &&
            (e.node.quantityAvailable === null || e.node.quantityAvailable > 0)
          )
        );
        setProducts(available);
        const ids = available.map(p => p.node.id.split("/").pop()!);
        fetchBatchReviewSummary(ids).then(setReviewMap);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleAddToCart = (e: React.MouseEvent, product: ShopifyProduct) => {
    e.stopPropagation();
    setSelectedProduct(product);
    setOptionDialogOpen(true);
  };

  if (loading) {
    return (
      <section className="mt-6 pb-4">
        <div className="flex items-center justify-between px-4 mb-3">
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="flex gap-3 md:gap-4 px-4 overflow-x-auto pb-2 scrollbar-hide">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex-shrink-0 w-36 md:w-56 bg-card rounded-xl border border-border overflow-hidden">
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
    <section className="mt-6 pb-4 animate-fade-up" style={{ animationDelay: "0.2s" }}>
      <div className="flex items-center justify-between px-4 mb-3">
        <h2 className="text-base font-bold text-foreground">New Arrivals</h2>
        <button
          onClick={() => navigate("/new-products")}
          className="flex items-center gap-0.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          View All
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="relative group">
      <div
        ref={scrollRef}
        className="flex gap-3 md:gap-4 px-4 overflow-x-auto pb-2 scrollbar-hide"
      >
        {products.slice(0, 20).map((product) => {
          const numericId = product.node.id.split("/").pop()!;
          return (
            <div key={product.node.id} className="flex-shrink-0 w-40 md:w-52">
              <ProductCard
                product={product}
                badge={{ label: "NEW", className: "bg-emerald-500 text-white" }}
                onClick={() => navigate(`/product/${product.node.handle}`)}
                onAddToCart={(e) => handleAddToCart(e, product)}
                reviewSummary={reviewMap[numericId]}
              />
            </div>
          );
        })}
      </div>

      {canScrollLeft && (
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 z-10 bg-white/90 shadow-md rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </button>
      )}
      {canScrollRight && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 z-10 bg-white/90 shadow-md rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ChevronRight className="h-5 w-5 text-foreground" />
        </button>
      )}
      </div>

      <ProductOptionDialog
        product={selectedProduct}
        open={optionDialogOpen}
        onOpenChange={setOptionDialogOpen}
      />
    </section>
  );
}
