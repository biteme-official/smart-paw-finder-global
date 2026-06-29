import { useRef, useCallback, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, ShoppingCart, Heart, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ShopifyProduct } from "@/lib/shopify";
import { PriceTag } from "@/components/ui/PriceTag";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductOptionDialog } from "@/components/shop/ProductOptionDialog";
import { useFavoriteAction } from "@/hooks/useFavoriteAction";
import { useProductReviewSummary } from "@/hooks/useProductReview";

interface CurationSectionProps {
  title: string;
  viewAllHref: string;
  products: ShopifyProduct[];
  loading: boolean;
  badge?: string;
  badgeClassName?: string;
  animationDelay?: string;
}

type BadgeDef = { label: string; className: string };
const DEFAULT_BADGES: BadgeDef[] = [
  { label: "BEST", className: "bg-primary text-primary-foreground" },
  { label: "HOT", className: "bg-red-500 text-white" },
  { label: "NEW", className: "bg-emerald-500 text-white" },
  { label: "PICK", className: "bg-amber-500 text-white" },
];

function ReviewRow({ productId }: { productId: string }) {
  const numericId = productId.split("/").pop() ?? "";
  const { avgRating, count } = useProductReviewSummary(numericId);
  if (!count) return null;
  return (
    <div className="flex items-center gap-0.5 mt-1">
      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
      <span className="text-[11px] text-muted-foreground">
        {avgRating.toFixed(1)} ({count})
      </span>
    </div>
  );
}

export function CurationSection({
  title,
  viewAllHref,
  products,
  loading,
  badge,
  badgeClassName = "bg-primary text-primary-foreground",
  animationDelay = "0s",
}: CurationSectionProps) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [optionDialogOpen, setOptionDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ShopifyProduct | null>(null);
  const { toggleFavorite, checkFavorite } = useFavoriteAction();

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

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -el.clientWidth * 0.8 : el.clientWidth * 0.8, behavior: "smooth" });
  };

  const handleAddToCart = (e: React.MouseEvent, product: ShopifyProduct) => {
    e.stopPropagation();
    setSelectedProduct(product);
    setOptionDialogOpen(true);
  };

  const handleViewAll = () => {
    if (viewAllHref.startsWith("/") && !viewAllHref.startsWith("/?")) {
      navigate(viewAllHref);
    } else if (viewAllHref.startsWith("/?")) {
      navigate(viewAllHref);
    } else {
      navigate(viewAllHref);
    }
  };

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

  if (!products.length) return null;

  return (
    <section className="mt-6 pb-4 animate-fade-up" style={{ animationDelay }}>
      <div className="flex items-center justify-between px-4 mb-3">
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        <button
          onClick={handleViewAll}
          className="flex items-center gap-0.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          View All
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="relative group">
        <div ref={scrollRef} className="flex gap-3 md:gap-4 px-4 overflow-x-auto pb-2 scrollbar-hide">
          {products.map((product, index) => {
            const image = product.node.images.edges[0]?.node;
            const price = product.node.priceRange.minVariantPrice;
            const badgeDef = badge
              ? { label: badge, className: badgeClassName }
              : DEFAULT_BADGES[index % DEFAULT_BADGES.length];

            return (
              <div
                key={product.node.id}
                onClick={() => navigate(`/product/${product.node.handle}`)}
                className="flex-shrink-0 w-40 md:w-52 bg-card rounded-xl border border-border overflow-hidden shadow-sm hover:shadow-card transition-all cursor-pointer"
              >
                <div className="aspect-square bg-secondary relative overflow-hidden">
                  {image ? (
                    <img
                      src={image.url}
                      alt={image.altText || product.node.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                      No Image
                    </div>
                  )}
                  <span className={`absolute top-2 left-2 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${badgeDef.className}`}>
                    {badgeDef.label}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(product.node.handle); }}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/70 backdrop-blur-sm flex items-center justify-center hover:bg-background/90 transition-colors z-10"
                  >
                    <Heart className={`h-3.5 w-3.5 ${checkFavorite(product.node.handle) ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
                  </button>
                </div>
                <div className="p-3">
                  <h3 className="text-xs font-medium text-foreground line-clamp-2 mb-1 min-h-[32px]">
                    {product.node.title}
                  </h3>
                  <ReviewRow productId={product.node.id} />
                  <div className="flex items-center justify-between gap-1 mt-1.5">
                    <PriceTag amount={price.amount} currencyCode={price.currencyCode} className="text-sm font-bold text-primary" originalClassName="text-xs" />
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(e) => handleAddToCart(e, product)}
                      className="h-7 w-7 p-0 flex-shrink-0"
                    >
                      <ShoppingCart className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
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
