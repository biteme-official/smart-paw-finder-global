import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Menu, Phone, ChevronRight, ChevronDown, Package, User, LogOut, MapPin, BookOpen } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { SearchAutocomplete } from "@/components/layout/SearchAutocomplete";
import { CategoryNav } from "@/components/shop/CategoryNav";
import { fetchMenu, fetchCollections, ShopifyMenuItem, ShopifyMenu, ShopifyCollection, extractHandleFromUrl } from "@/lib/shopify";
import biteMeLogo from "@/assets/bite-me-logo.png";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onSearch?: (query: string) => void;
  onCollectionSelect?: (handle: string | null) => void;
}

// Recursive menu item component for nested categories
function MenuItemComponent({
  item,
  depth = 0,
  onNavigate,
  ancestorHandles = [],
}: {
  item: ShopifyMenuItem;
  depth?: number;
  onNavigate: (item: ShopifyMenuItem, ancestorHandles: string[]) => void;
  ancestorHandles?: string[];
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = item.items && item.items.length > 0;
  const currentHandle = extractHandleFromUrl(item.url) ?? item.title.toLowerCase().replace(/\s+/g, '-');

  return (
    <div>
      <div
        className={cn(
          "w-full flex items-center justify-between hover:bg-secondary/50 transition-colors",
          depth === 0 && "px-4",
          depth === 1 && "pl-8 pr-4",
          depth === 2 && "pl-12 pr-4",
          depth >= 3 && "pl-16 pr-4",
        )}
      >
        {/* Title - navigates to the collection */}
        <button
          onClick={() => onNavigate(item, ancestorHandles)}
          className={cn(
            "flex-1 text-left py-3",
            "text-sm",
            depth === 0 && "font-medium",
            depth > 0 && "text-muted-foreground",
          )}
        >
          {item.title}
        </button>

        {/* Expand/collapse toggle for items with children */}
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
            className="p-2 -mr-2 hover:bg-secondary rounded-md"
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-200",
                isExpanded && "rotate-180"
              )}
            />
          </button>
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Children — pass current handle as part of ancestor path */}
      {hasChildren && isExpanded && (
        <div className="border-l-2 border-border/40 ml-6">
          {item.items.map((child) => (
            <MenuItemComponent
              key={child.id}
              item={child}
              depth={depth + 1}
              onNavigate={onNavigate}
              ancestorHandles={[...ancestorHandles, currentHandle]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function Header({ onSearch, onCollectionSelect }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menu, setMenu] = useState<ShopifyMenu | null>(null);
  const [collections, setCollections] = useState<ShopifyCollection[]>([]);
  const navigate = useNavigate();
  const { user, isLoggedIn, logout } = useAuthStore();

  useEffect(() => {
    fetchMenu("category")
      .then((menuData) => {
        if (menuData && menuData.items.length > 0) {
          setMenu(menuData);
        } else {
          fetchCollections(20).then(setCollections).catch(console.error);
        }
      })
      .catch(() => {
        fetchCollections(20).then(setCollections).catch(console.error);
      });
  }, []);

  const handleSearch = (query: string) => {
    if (onSearch) {
      onSearch(query);
    } else {
      navigate(query ? `/?q=${encodeURIComponent(query)}` : '/');
    }
  };

  const handleMenuItemNavigate = (item: ShopifyMenuItem, ancestorHandles: string[]) => {
    const handle = extractHandleFromUrl(item.url);
    setIsMenuOpen(false);

    if (ancestorHandles.length > 0 && handle) {
      onCollectionSelect?.(handle);
      if (window.location.pathname !== '/') navigate('/');
      return;
    }


    if (item.type === 'COLLECTION' || item.url.includes('/collections/')) {
      if (window.location.pathname === '/') {
        onCollectionSelect?.(handle);
      } else {
        navigate(handle ? `/?collection=${encodeURIComponent(handle)}` : '/');
      }
    } else if (item.type === 'PRODUCT' || item.url.includes('/products/')) {
      if (handle) navigate(`/product/${handle}`);
    } else if (item.url.includes('/pages/wishlist') || item.url.includes('/wishlist')) {
      navigate('/wishlist');
    } else if (item.url.includes('/pages/contact') || item.url.includes('/contact')) {
      navigate('/contact');
    } else if (item.type === 'FRONTPAGE') {
      if (window.location.pathname === '/') {
        onCollectionSelect?.(null);
      } else {
        navigate('/');
      }
    } else {
      if (handle) {
        if (window.location.pathname === '/') {
          onCollectionSelect?.(handle);
        } else {
          navigate(`/?collection=${encodeURIComponent(handle)}`);
        }
      }
    }
  };

  const handleCollectionClick = (handle: string | null) => {
    setIsMenuOpen(false);
    if (window.location.pathname === '/') {
      onCollectionSelect?.(handle);
    } else {
      navigate(handle ? `/?collection=${encodeURIComponent(handle)}` : '/');
    }
  };

  // Filter out the default "frontpage" collection
  const menuCollections = collections.filter(c => c.handle !== 'frontpage');
  const hasMenu = menu && menu.items.length > 0;

  return (
    <header className="sticky top-0 z-50 bg-background">
      {/* Main Header Row */}
      <div className="border-b border-border">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 h-14">
        {/* Left: Hamburger Menu + Logo */}
        <div className="flex items-center gap-2">
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-foreground">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-0 overflow-y-auto">
              <SheetHeader className="p-4 border-b border-border">
                <SheetTitle className="text-left">
                  <button onClick={() => { navigate("/"); setIsMenuOpen(false); onCollectionSelect?.(null); }}>
                    <img src={biteMeLogo} alt="BITE ME" className="h-[19px] hover:opacity-80 transition-opacity" />
                  </button>
                </SheetTitle>
              </SheetHeader>

              {/* All Products */}
              <div className="border-b border-border/50">
                <button
                  onClick={() => handleCollectionClick(null)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">All Products</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              {/* Navigation Menu (from Shopify theme) */}
              {hasMenu && (
                <div className="border-b border-border/50">
                  <p className="px-4 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Categories
                  </p>
                  {menu.items.map((item) => (
                    <MenuItemComponent
                      key={item.id}
                      item={item}
                      depth={0}
                      onNavigate={handleMenuItemNavigate}
                      ancestorHandles={[]}
                    />
                  ))}
                </div>
              )}

              {/* Fallback: Collections (flat list) */}
              {!hasMenu && menuCollections.length > 0 && (
                <div className="border-b border-border/50">
                  <p className="px-4 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Categories
                  </p>
                  {menuCollections.map((collection) => (
                    <button
                      key={collection.id}
                      onClick={() => handleCollectionClick(collection.handle)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {collection.image ? (
                          <img
                            src={collection.image.url}
                            alt={collection.image.altText || collection.title}
                            className="h-8 w-8 rounded-md object-cover"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="text-left">
                          <span className="font-medium text-sm">{collection.title}</span>
                          {collection.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">{collection.description}</p>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {/* Pop-up & Offline */}
              <div className="border-b border-border/50">
                <button
                  onClick={() => { navigate("/popup-offline-stores"); setIsMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors"
                >
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Pop-up & Offline Stores</span>
                </button>
              </div>

              {/* Blog */}
              <div className="border-b border-border/50">
                <button
                  onClick={() => { navigate("/blog"); setIsMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors"
                >
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Blog</span>
                </button>
              </div>

              {/* Contact Us */}
              <div className="border-b border-border/50">
                <button
                  onClick={() => { navigate("/contact"); setIsMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors"
                >
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Contact Us</span>
                </button>
              </div>

              {/* Auth Section */}
              <div className="p-4">
                {isLoggedIn && user ? (
                  <div className="space-y-3">
                    <button
                      onClick={() => { navigate("/mypage"); setIsMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-0 py-1 hover:opacity-80 transition-opacity"
                    >
                      {user.pictureUrl ? (
                        <img
                          src={user.pictureUrl}
                          alt={user.displayName}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <span className="font-medium text-sm">{user.displayName}</span>
                    </button>
                    <button
                      onClick={() => { logout(); setIsMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-0 py-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      <span className="text-sm">Logout</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { navigate("/mypage"); setIsMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-0 py-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <User className="h-4 w-4" />
                    <span className="text-sm font-medium">My Page</span>
                  </button>
                )}
              </div>
            </SheetContent>
          </Sheet>

          <button
            onClick={() => {
              if (window.location.pathname === '/') {
                onCollectionSelect?.(null);
                window.location.reload();
              } else {
                navigate("/");
              }
            }}
            className="hover:opacity-80 transition-opacity"
          >
            <img src={biteMeLogo} alt="BITE ME" className="h-[19px]" />
          </button>
        </div>

        {/* Right: Icons */}
        <div className="flex items-center gap-1">
          {/* MyPage icon */}
          <Button
            variant="ghost"
            size="icon"
            className="text-foreground"
            onClick={() => navigate("/mypage")}
          >
            {isLoggedIn && user?.pictureUrl ? (
              <img
                src={user.pictureUrl}
                alt={user.displayName}
                className="w-7 h-7 rounded-full object-cover"
              />
            ) : (
              <User className="h-6 w-6" />
            )}
          </Button>
          <CartDrawer />
        </div>
      </div>
      </div>

      {/* Search Bar */}
      <div className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <SearchAutocomplete onSearch={handleSearch} />
        </div>
      </div>

      {/* Category chips (hamburger top-level) */}
      <CategoryChips onCollectionSelect={onCollectionSelect} />
    </header>
  );
}

function CategoryChips({ onCollectionSelect }: { onCollectionSelect?: (handle: string | null) => void }) {
  const [searchParams] = useSearchParams();
  const selectedCollection = searchParams.get("collection");
  const searchQuery = searchParams.get("q");

  if (searchQuery) return null;
  if (!onCollectionSelect) return null;

  return (
    <CategoryNav selectedCollection={selectedCollection} onSelect={onCollectionSelect} />
  );
}
