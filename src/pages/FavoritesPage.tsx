import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, Heart, Package, Trash2, Check } from 'lucide-react';
import { fetchProductByHandle, formatPrice } from '@/lib/shopify';
import { useAuthStore } from '@/stores/authStore';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { Checkbox } from '@/components/ui/checkbox';
import { PriceTag } from '@/components/ui/PriceTag';
import { initiateLogin } from '@/lib/customer-auth';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function FavoritesPage() {
  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.user);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const { getFavorites, removeFavorite, clearFavorites } = useFavoritesStore();
  const favoritesData = useFavoritesStore((s) => s.favorites);
  const favoritesKey = authUser?.userId;

  const [products, setProducts] = useState<Array<{ handle: string; title: string; image?: string; price: string; currencyCode: string; soldOut: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allSelected = products.length > 0 && selected.size === products.length;

  const handleToggle = (handle: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(handle) ? next.delete(handle) : next.add(handle);
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    setSelected(checked ? new Set(products.map(p => p.handle)) : new Set());
  };

  const handleDeleteSelected = () => {
    if (!favoritesKey || selected.size === 0) return;
    selected.forEach(handle => removeFavorite(favoritesKey, handle));
    const count = selected.size;
    setSelected(new Set());
    toast.success(`${count} item${count > 1 ? 's' : ''} removed`, { position: 'top-center' });
  };

  useEffect(() => {
    if (!favoritesKey) {
      setProducts([]);
      setLoading(false);
      return;
    }
    const handles = getFavorites(favoritesKey);
    if (handles.length === 0) {
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all(handles.map((h) => fetchProductByHandle(h).catch(() => null)))
      .then((results) => {
        setProducts(
          results.filter(Boolean).map((p: any) => {
            const isSoldOut =
              p.availableForSale === false ||
              p.variants.edges.every((v: any) => !v.node.availableForSale) ||
              (p.variants.edges.length > 0 &&
                p.variants.edges.filter((v: any) => v.node.quantityAvailable !== null).length > 0 &&
                p.variants.edges.filter((v: any) => v.node.quantityAvailable !== null).every((v: any) => v.node.quantityAvailable <= 0));
            return {
              handle: p.handle,
              title: p.title,
              image: p.images.edges[0]?.node.url,
              price: p.priceRange.minVariantPrice.amount,
              currencyCode: p.priceRange.minVariantPrice.currencyCode,
              soldOut: isSoldOut,
            };
          })
        );
      })
      .finally(() => setLoading(false));
  }, [favoritesKey, favoritesData, getFavorites]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <header className="sticky top-[57px] z-40 bg-background border-b border-border">
        <div className="max-w-md mx-auto flex items-center px-4 h-12">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="flex-1 text-center font-semibold text-sm">Favorites</h1>
          <div className="w-9" />
        </div>
      </header>
      <main className="max-w-md mx-auto px-4 py-6 space-y-3 pb-24">
        {!isLoggedIn ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <Heart className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-foreground font-medium mb-1">Login to view favorites</p>
            <p className="text-xs text-muted-foreground mb-4">Save your favorite products by logging in</p>
            <Button onClick={() => initiateLogin('/favorites')} className="w-full max-w-[200px]">
              Log In
            </Button>
          </div>
        ) : loading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ) : products.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <Heart className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No favorites yet</p>
            <p className="text-xs text-muted-foreground mt-1">Tap the heart on a product to save it</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  className="border-primary data-[state=checked]:bg-primary"
                />
                <span className="text-sm text-muted-foreground">
                  {selected.size > 0 ? `${selected.size} selected` : 'Select All'}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
                onClick={handleDeleteSelected}
                disabled={selected.size === 0}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
            {products.map((product) => (
              <div
                key={product.handle}
                className="bg-card rounded-xl border border-border p-3 flex items-center gap-3 cursor-pointer hover:bg-secondary/30 transition-colors"
                onClick={() => navigate(`/product/${product.handle}`)}
              >
                <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selected.has(product.handle)}
                    onCheckedChange={() => handleToggle(product.handle)}
                    className="border-primary data-[state=checked]:bg-primary"
                  />
                </div>
                <div className="relative w-16 h-16 flex-shrink-0">
                  {product.image ? (
                    <img src={product.image} alt={product.title} className={`w-16 h-16 rounded-lg object-cover ${product.soldOut ? 'opacity-50' : ''}`} />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-secondary flex items-center justify-center">
                      <Package className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  {product.soldOut && (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted-foreground/30 rounded-lg">
                      <span className="text-white/90 text-[10px] font-semibold uppercase tracking-wider drop-shadow-sm">
                        Sold Out
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${product.soldOut ? 'text-muted-foreground' : ''}`}>{product.title}</p>
                  <div className="mt-1">
                    <PriceTag amount={product.price} currencyCode={product.currencyCode} className={`text-sm font-bold ${product.soldOut ? 'text-muted-foreground' : 'text-primary'}`} originalClassName="text-xs" />
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFavorite(favoritesKey, product.handle);
                  }}
                  className="p-2 hover:bg-secondary rounded-full"
                >
                  <Heart className="h-4 w-4 fill-red-500 text-red-500" />
                </button>
              </div>
            ))}
          </>
        )}
      </main>
    </div>
  );
}
