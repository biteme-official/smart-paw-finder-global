import { useEffect, useState, useRef, useCallback } from "react";
import { ShoppingCart, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ShopifyProduct, fetchProductRecommendations } from "@/lib/shopify";
import { PriceTag } from "@/components/ui/PriceTag";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductOptionDialog } from "@/components/shop/ProductOptionDialog";
import { useFavoriteAction } from "@/hooks/useFavoriteAction";

interface RecommendedProductsProps {
  productId: string;
  currentHandle: string;
}

export function RecommendedProducts({ productId, currentHandle }: RecommendedProductsProps) {
  const navigate = useNavigate();
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [optionDialogOpen, setOptionDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ShopifyProduct | null>(null);
  const { toggleFavorite, checkFavorite } = useFavoriteAction();

  const scrollRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const hasDragged = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    isDragging.current = true;
    hasDragged.current = false;
    startX.current = e.clientX;
    scrollLeft.current = el.scrollLeft;
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current || !scrollRef.current) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > 5) hasDragged.current = true;
    scrollRef.current.scrollLeft = scrollLeft.current - dx;
  }, []);

  const onPointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handleCardClick = useCallback((e: React.MouseEvent, handle: string) => {
    if (hasDragged.current) {
      e.preventDefault();
      return;
    }
    navigate(`/product/${handle}`);
  }, [navigate]);

  useEffect(() => {
    if (!productId) return;
    setLoading(true);
    fetchProductRecommendations(productId)
      .then((result) => {
        const filtered = result.filter(
          (p) => p.node.handle !== currentHandle && p.node.variants.edges.some((v) => v.node.availableForSale)
        );
        setProducts(filtered);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [productId, currentHandle]);

  const handleAddToCart = (e: React.MouseEvent, product: ShopifyProduct) => {
    e.stopPropagation();
    setSelectedProduct(product);
    setOptionDialogOpen(true);
  };

  if (loading) {
    return (
      <section className="mb-6">
        <Skeleton className="h-5 w-40 mb-3 mx-4" />
        <div className="flex gap-3 px-4 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-32 flex-shrink-0 bg-card rounded-xl border border-border overflow-hidden">
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
    <section className="mb-6">
      <h2 className="text-base font-bold text-foreground mb-3 px-4">Recommend Products</h2>

      <div
        ref={scrollRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="flex gap-3 px-4 overflow-x-auto scrollbar-hide select-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {products.slice(0, 10).map((product) => {
          const image = product.node.images.edges[0]?.node;
          const price = product.node.priceRange.minVariantPrice;
          const compareAt = product.node.variants.edges[0]?.node.compareAtPrice;

          return (
            <div
              key={product.node.id}
              onClick={(e) => handleCardClick(e, product.node.handle)}
              className="w-32 flex-shrink-0 bg-card rounded-xl border border-border overflow-hidden shadow-sm hover:shadow-card transition-all cursor-pointer"
            >
              <div className="aspect-square bg-secondary relative overflow-hidden">
                {image ? (
                  <img
                    src={image.url}
                    alt={image.altText || product.node.title}
                    className="w-full h-full object-cover pointer-events-none"
                    loading="lazy"
                    draggable={false}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                    No Image
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(product.node.handle);
                  }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/70 backdrop-blur-sm flex items-center justify-center hover:bg-background/90 transition-colors"
                >
                  <Heart
                    className={`h-3.5 w-3.5 ${checkFavorite(product.node.handle) ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`}
                  />
                </button>
              </div>
              <div className="p-3">
                <h3 className="text-xs font-medium text-foreground line-clamp-2 mb-2 min-h-[32px]">
                  {product.node.title}
                </h3>
                <div className="flex items-start justify-between gap-1">
                  <PriceTag amount={price.amount} currencyCode={price.currencyCode} compareAtAmount={compareAt?.amount} className="text-sm font-bold text-primary" originalClassName="text-xs" />
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

      <ProductOptionDialog
        product={selectedProduct}
        open={optionDialogOpen}
        onOpenChange={setOptionDialogOpen}
      />
    </section>
  );
}
