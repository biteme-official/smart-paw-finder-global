import { Star, ShoppingCart, Heart } from "lucide-react";
import { ShopifyProduct, formatPrice } from "@/lib/shopify";
import { Button } from "@/components/ui/button";
import { useProductReviewSummary } from "@/hooks/useProductReview";
import { useFavoriteAction } from "@/hooks/useFavoriteAction";
import { useAuthStore } from "@/stores/authStore";

export interface ProductCardBadge {
  label: string;
  className: string;
}

interface ProductCardProps {
  product: ShopifyProduct;
  badge?: ProductCardBadge;
  onAddToCart: (e: React.MouseEvent) => void;
  onClick: () => void;
  isSoldOut?: boolean;
}

function StarRow({ avgRating, count }: { avgRating: number; count: number }) {
  const rounded = Math.round(avgRating);
  return (
    <div className="flex items-center gap-1 mb-1">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            className={`h-4 w-4 ${rounded >= s ? "fill-yellow-400 text-yellow-400" : "fill-gray-200 text-gray-200"}`}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground font-medium">({count})</span>
    </div>
  );
}

export function ProductCard({ product, badge, onAddToCart, onClick, isSoldOut = false }: ProductCardProps) {
  const { toggleFavorite, checkFavorite } = useFavoriteAction();
  const numericId = product.node.id.split("/").pop() ?? "";
  const { avgRating, count } = useProductReviewSummary(numericId);
  const isB2B = useAuthStore((s) => s.isB2B);
  const b2bDiscountRate = useAuthStore((s) => s.b2bDiscountRate);

  const image = product.node.images.edges[0]?.node;
  const price = product.node.priceRange.minVariantPrice;
  const originalAmt = parseFloat(price.amount);

  const saleAmt = isB2B
    ? (originalAmt * (1 - b2bDiscountRate)).toFixed(2)
    : (originalAmt * 0.9).toFixed(2);
  const discountLabel = isB2B
    ? `${Math.round(b2bDiscountRate * 100)}% OFF`
    : "10% OFF";
  const firstOrderLabel = isB2B ? null : "10% OFF first order";

  return (
    <div
      onClick={onClick}
      className="bg-card rounded-xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer group"
    >
      {/* Image */}
      <div className="aspect-square bg-secondary relative overflow-hidden">
        {image ? (
          <img
            src={image.url}
            alt={image.altText || product.node.title}
            className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${isSoldOut ? "opacity-50" : ""}`}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
            No Image
          </div>
        )}

        {/* Top-left badge */}
        {badge && (
          <span className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-sm z-10 ${badge.className}`}>
            {badge.label}
          </span>
        )}

        {/* Heart */}
        <button
          onClick={(e) => { e.stopPropagation(); toggleFavorite(product.node.handle); }}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors z-10"
        >
          <Heart className={`h-3.5 w-3.5 ${checkFavorite(product.node.handle) ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
        </button>

        {/* First order pill — bottom-left of image */}
        {!isSoldOut && firstOrderLabel && (
          <div className="absolute bottom-2 left-2 z-10">
            <span className="inline-block bg-orange-500 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full leading-none">
              {firstOrderLabel}
            </span>
          </div>
        )}

        {/* Sold out overlay */}
        {isSoldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
            <span className="bg-foreground text-background px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded">
              Sold Out
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-3">
        {count > 0 && <StarRow avgRating={avgRating} count={count} />}

        <h3 className="text-xs font-medium text-foreground line-clamp-2 mb-2 min-h-[32px]">
          {product.node.title}
        </h3>

        <div className="flex items-center justify-between gap-1">
          <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0.5 min-w-0">
            <span className="text-[11px] text-muted-foreground line-through leading-none" translate="no">
              {formatPrice(price.amount, price.currencyCode)}
            </span>
            <span className="text-sm font-bold text-orange-500 leading-none" translate="no">
              {formatPrice(saleAmt, price.currencyCode)}
            </span>
            <span className="text-[9px] font-semibold bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-sm leading-none whitespace-nowrap">
              {discountLabel}
            </span>
          </div>
          <Button
            size="sm"
            onClick={(e) => { e.stopPropagation(); onAddToCart(e); }}
            disabled={isSoldOut}
            className="h-8 w-8 p-0 flex-shrink-0 rounded-full bg-foreground text-background hover:bg-foreground/80 disabled:opacity-40"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
