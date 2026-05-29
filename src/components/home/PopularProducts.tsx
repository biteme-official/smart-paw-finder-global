import { useEffect, useState } from "react";
import { ShoppingCart, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ShopifyProduct, fetchBestSellingProducts } from "@/lib/shopify";
import { PriceTag } from "@/components/ui/PriceTag";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductOptionDialog } from "@/components/shop/ProductOptionDialog";
import { useFavoriteAction } from "@/hooks/useFavoriteAction";

const BADGES = ["BEST", "POPULAR", "PICK", "TOP", "NEW", "HOT"];

export function PopularProducts() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [optionDialogOpen, setOptionDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ShopifyProduct | null>(null);
  const { toggleFavorite, checkFavorite } = useFavoriteAction();

  useEffect(() => {
    fetchBestSellingProducts(8)
      .then((result) => setProducts(result))
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
        <div className="grid grid-cols-3 gap-3 px-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-card rounded-xl border border-border overflow-hidden">
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

  const availableProducts = products.filter(p => p.node.variants.edges.some(v => v.node.availableForSale));

  if (availableProducts.length === 0) return null;

  return (
    <section className="mt-6 pb-4 animate-fade-up" style={{ animationDelay: "0.3s" }}>
      <div className="px-4 mb-3">
        <h2 className="text-base font-bold text-foreground">Popular Products</h2>
      </div>

      <div className="grid grid-cols-3 gap-3 px-4">
        {availableProducts.slice(0, 6).map((product, index) => {
          const image = product.node.images.edges[0]?.node;
          const price = product.node.priceRange.minVariantPrice;
          const compareAt = product.node.variants.edges[0]?.node.compareAtPrice;

          return (
            <div
              key={product.node.id}
              onClick={() => navigate(`/product/${product.node.handle}`)}
              className="bg-card rounded-xl border border-border overflow-hidden shadow-sm hover:shadow-card transition-all hover:-translate-y-0.5 cursor-pointer"
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
                <span className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                  {BADGES[index] ?? "POPULAR"}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(product.node.handle);
                  }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/70 backdrop-blur-sm flex items-center justify-center hover:bg-background/90 transition-colors z-10"
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
