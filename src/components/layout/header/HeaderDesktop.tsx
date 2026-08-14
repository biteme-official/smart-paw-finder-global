import { useNavigate } from "react-router-dom";
import { Search, User } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { SearchAutocomplete } from "@/components/layout/SearchAutocomplete";
import { NAV_CATEGORIES } from "./navCategories";
import biteMeLogo from "@/assets/bite-me-logo.png";

interface HeaderDesktopProps {
  onSearch: (query: string) => void;
  onCollectionSelect?: (handle: string | null) => void;
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
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-6 px-4 h-12">
          {NAV_CATEGORIES.map(({ label, handle }) => (
            <button
              key={label}
              onClick={() => handleNavClick(handle)}
              className="text-sm font-medium text-foreground hover:text-primary transition-colors whitespace-nowrap"
            >
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
