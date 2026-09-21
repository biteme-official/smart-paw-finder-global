import { useNavigate } from "react-router-dom";
import { useRef, useState } from "react";
import { Search, User } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { SearchAutocomplete } from "@/components/layout/SearchAutocomplete";
import { GNB_LINKS, GnbBrandLink } from "./gnbLinks";
import biteMeLogo from "@/assets/bite-me-logo.png";

interface HeaderDesktopProps {
  onSearch: (query: string) => void;
  onCollectionSelect?: (handle: string | null) => void;
}

// Hover-intent delay before closing, so moving the cursor from the trigger down
// to the dropdown content doesn't cause a flicker-close in the gap between them.
const CLOSE_DELAY_MS = 150;

// Plain CSS positioning (left: 50% + translateX(-50%)) anchored to this own trigger's
// wrapping box, deliberately NOT Radix Popper/Popover — Popper's collision-aware placement
// kept re-centering against the whole viewport instead of just BRAND, reading as "shifted
// right". The wrapping div is the sole positioning parent, so the dropdown always centers
// under BRAND itself regardless of viewport width or where BRAND sits in the GNB row.
function BrandNavItem({ brands, onSelectBrand }: { brands: GnbBrandLink[]; onSelectBrand: (handle: string) => void }) {
  const [open, setOpen] = useState(false);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const openMenu = () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    setOpen(true);
  };
  const scheduleClose = () => {
    closeTimeoutRef.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };

  return (
    // h-full so this box's bottom edge is the GNB row's own bottom border — the dropdown's
    // top:100% then sits flush against it, no gap. Trigger + dropdown share this one hover
    // region so moving the cursor down into the dropdown never closes it.
    <div className="relative h-full flex items-center" onMouseEnter={openMenu} onMouseLeave={scheduleClose}>
      <button
        onClick={() => (open ? scheduleClose() : openMenu())}
        aria-expanded={open}
        className="h-full flex items-center text-sm font-medium text-foreground hover:text-primary transition-colors whitespace-nowrap"
      >
        BRAND
      </button>
      {open && (
        <div className="absolute left-1/2 top-full -translate-x-1/2 z-50 rounded-b-md border border-t-0 bg-background py-2 shadow-lg">
          <ul className="flex flex-col">
            {brands.map((brand) => (
              <li key={brand.label}>
                <button
                  onClick={() => { onSelectBrand(brand.handle); setOpen(false); }}
                  className="block w-full whitespace-nowrap px-6 py-2 text-center text-sm text-foreground outline-none transition-colors hover:bg-secondary/50 focus-visible:bg-secondary/50"
                >
                  {brand.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function HeaderDesktop({ onSearch, onCollectionSelect }: HeaderDesktopProps) {
  const navigate = useNavigate();
  const { user, isLoggedIn } = useAuthStore();

  const handleNavClick = (handle: string | null) => {
    if (window.location.pathname === '/') {
      onCollectionSelect?.(handle);
    } else {
      navigate(handle ? `/?collection=${encodeURIComponent(handle)}` : '/');
    }
  };

  return (
    <div className="hidden md:block border-b border-border">
      {/* Row 1: logo centered, icons pinned right */}
      <div className="max-w-7xl mx-auto grid grid-cols-3 items-center px-4 h-16">
        <div />

        <button
          onClick={() => {
            if (window.location.pathname === '/') {
              onCollectionSelect?.(null);
            } else {
              navigate("/");
            }
          }}
          className="hover:opacity-80 transition-opacity justify-self-center"
        >
          <img src={biteMeLogo} alt="BITE ME" className="h-[22px]" />
        </button>

        <div className="flex items-center gap-1 justify-self-end">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="text-foreground">
                <Search className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-96 p-3">
              <SearchAutocomplete onSearch={onSearch} />
            </PopoverContent>
          </Popover>

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
              <User className="h-5 w-5" />
            )}
          </Button>
          <CartDrawer />
        </div>
      </div>

      {/* Row 2: nav centered */}
      <nav className="border-t border-border">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-9 px-4 h-12">
          {GNB_LINKS.map((link) =>
            link.type === "dropdown" ? (
              <BrandNavItem key={link.label} brands={link.children} onSelectBrand={handleNavClick} />
            ) : (
              <button
                key={link.label}
                onClick={() =>
                  link.type === "collection" ? handleNavClick(link.handle) : navigate(link.path)
                }
                className="text-sm font-medium text-foreground hover:text-primary transition-colors whitespace-nowrap"
              >
                {link.label}
              </button>
            ),
          )}
        </div>
      </nav>
    </div>
  );
}
