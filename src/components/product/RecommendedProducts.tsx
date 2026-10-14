import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ShopifyProduct, fetchProductRecommendations } from "@/lib/shopify";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductCard } from "@/components/shop/ProductCard";
import { ProductOptionDialog } from "@/components/shop/ProductOptionDialog";

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

  const handleCardClick = useCallback((handle: string) => {
    if (hasDragged.current) return;
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
        {products.slice(0, 10).map((product) => (
          // onDragStart blocks native image drag so pointer-drag scrolling keeps working over the card image
          <div key={product.node.id} className="w-32 flex-shrink-0" onDragStart={(e) => e.preventDefault()}>
            <ProductCard
              product={product}
              onClick={() => handleCardClick(product.node.handle)}
              onAddToCart={(e) => handleAddToCart(e, product)}
            />
          </div>
        ))}
      </div>

      <ProductOptionDialog
        product={selectedProduct}
        open={optionDialogOpen}
        onOpenChange={setOptionDialogOpen}
      />
    </section>
  );
}
