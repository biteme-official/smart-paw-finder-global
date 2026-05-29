import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ShopifyProduct, fetchNewProducts } from "@/lib/shopify";
import { PriceTag } from "@/components/ui/PriceTag";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ScrollToTop } from "@/components/ui/ScrollToTop";
import { ProductOptionDialog } from "@/components/shop/ProductOptionDialog";
import { useFavoriteAction } from "@/hooks/useFavoriteAction";
import { ShoppingCart, Heart, ArrowLeft } from "lucide-react";

const NewProductsPage = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [optionDialogOpen, setOptionDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ShopifyProduct | null>(null);
  const { toggleFavorite, checkFavorite } = useFavoriteAction();

  useEffect(() => {
    fetchNewProducts(100)
      .then((result) => {
        const available = result.filter(p =>
          p.node.variants.edges.some(e =>
            e.node.availableForSale &&
            (e.node.quantityAvailable === null || e.node.quantityAvailable > 0)
          )
        );
        setProducts(available);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleAddToCart = (e: React.MouseEvent, product: ShopifyProduct) => {
    e.stopPropagation();
    setSelectedProduct(product);
    setOptionDialogOpen(true);
  };

  return (
    <div className="bg-background min-h-screen">
      <Header onSearch={() => {}} onCollectionSelect={() => {}} />
      <main className="max-w-7xl mx-auto py-8 px-4 pb-20">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-full hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold">New Products</h1>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
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
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product) => {
              const image = product.node.images.edges[0]?.node;
              const price = product.node.priceRange.minVariantPrice;
              const compareAt = product.node.variants.edges[0]?.node.compareAtPrice;

              return (
                <div
                  key={product.node.id}
                  onClick={() => navigate(`/product/${product.node.handle}`)}
                  className="bg-card rounded-xl border border-border overflow-hidden shadow-sm hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer group"
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
                    <span className="absolute top-2 left-2 bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                      NEW
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
        )}
      </main>
      <Footer />
      <ScrollToTop />

      <ProductOptionDialog
        product={selectedProduct}
        open={optionDialogOpen}
        onOpenChange={setOptionDialogOpen}
      />
    </div>
  );
};

export default NewProductsPage;
