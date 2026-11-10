import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ShopifyProduct, fetchNewProducts } from "@/lib/shopify";
import { Skeleton } from "@/components/ui/skeleton";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ScrollToTop } from "@/components/ui/ScrollToTop";
import { ProductCard, ProductCardBadge } from "@/components/shop/ProductCard";
import { ProductOptionDialog } from "@/components/shop/ProductOptionDialog";
import { ArrowLeft } from "lucide-react";

const NEW_BADGE: ProductCardBadge = { label: "NEW", className: "bg-emerald-500 text-white" };

const NewProductsPage = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [optionDialogOpen, setOptionDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ShopifyProduct | null>(null);

  useEffect(() => {
    fetchNewProducts(50, 90)
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
            {products.map((product) => (
              <ProductCard
                key={product.node.id}
                product={product}
                badge={NEW_BADGE}
                onClick={() => navigate(`/product/${product.node.handle}`)}
                onAddToCart={(e) => handleAddToCart(e, product)}
              />
            ))}
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
