import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Menu,
  Phone,
  ChevronDown,
  User,
  LogOut,
  MapPin,
  BookOpen,
  ShoppingBag,
  Tag,
  Info,
  Handshake,
  Store,
  type LucideIcon,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { SearchAutocomplete } from "@/components/layout/SearchAutocomplete";
import { GNB_LINKS, GnbBrandLink } from "./gnbLinks";
import biteMeLogo from "@/assets/bite-me-logo.png";
import { cn } from "@/lib/utils";

interface HeaderMobileProps {
  onSearch: (query: string) => void;
  onCollectionSelect?: (handle: string | null) => void;
}

// Icons keyed by the GNB label — mirrors gnbLinks.ts order, mobile just adds icons for the same items.
const GNB_ICONS: Record<string, LucideIcon> = {
  "SHOP ALL": ShoppingBag,
  BRAND: Tag,
  BLOG: BookOpen,
  "POP-UP": MapPin,
  "ABOUT US": Info,
  AFFILIATE: Handshake,
  WHOLESALE: Store,
};

// BRAND expands into its 5 sub-brands in place (same order/links as the desktop dropdown)
// instead of navigating directly.
function BrandAccordionItem({
  brands,
  onSelectBrand,
}: {
  brands: GnbBrandLink[];
  onSelectBrand: (handle: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border-b border-border/50">
      <button
        onClick={() => setIsExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Tag className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">BRAND</span>
        </div>
        <ChevronDown
          className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", isExpanded && "rotate-180")}
        />
      </button>
      {isExpanded && (
        <div className="pb-2">
          {brands.map((brand) => (
            <button
              key={brand.label}
              onClick={() => onSelectBrand(brand.handle)}
              className="w-full text-left pl-11 pr-4 py-2 text-sm text-muted-foreground hover:bg-secondary/50 transition-colors"
            >
              {brand.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function HeaderMobile({ onSearch, onCollectionSelect }: HeaderMobileProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { user, isLoggedIn, logout } = useAuthStore();

  const handleNavClick = (handle: string | null) => {
    setIsMenuOpen(false);
    if (window.location.pathname === '/') {
      onCollectionSelect?.(handle);
    } else {
      navigate(handle ? `/?collection=${encodeURIComponent(handle)}` : '/');
    }
  };

  return (
    <div className="md:hidden">
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

              {/* GNB items — same order/links as the desktop nav */}
              {GNB_LINKS.map((link) => {
                if (link.type === "dropdown") {
                  return <BrandAccordionItem key={link.label} brands={link.children} onSelectBrand={handleNavClick} />;
                }
                const Icon = GNB_ICONS[link.label] ?? Tag;
                return (
                  <div className="border-b border-border/50" key={link.label}>
                    <button
                      onClick={() => {
                        if (link.type === "collection") {
                          handleNavClick(link.handle);
                        } else {
                          setIsMenuOpen(false);
                          navigate(link.path);
                        }
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{link.label}</span>
                    </button>
                  </div>
                );
              })}

              {/* Contact Us */}
              <div className="border-b border-border/50">
                <button
                  onClick={() => { navigate("/contact"); setIsMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors"
                >
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">CONTACT US</span>
                </button>
              </div>

              {/* My Page */}
              <div className="border-b border-border/50">
                <button
                  onClick={() => { navigate("/mypage"); setIsMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors"
                >
                  {isLoggedIn && user?.pictureUrl ? (
                    <img src={user.pictureUrl} alt={user.displayName} className="w-4 h-4 rounded-full object-cover" />
                  ) : (
                    <User className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="font-medium text-sm">{isLoggedIn && user ? user.displayName : "MY PAGE"}</span>
                </button>
              </div>

              {/* Logout — only when signed in */}
              {isLoggedIn && (
                <div className="border-b border-border/50">
                  <button
                    onClick={() => { logout(); setIsMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-muted-foreground hover:bg-secondary/50 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="text-sm">Logout</span>
                  </button>
                </div>
              )}
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
          <SearchAutocomplete onSearch={onSearch} />
        </div>
      </div>
    </div>
  );
}
