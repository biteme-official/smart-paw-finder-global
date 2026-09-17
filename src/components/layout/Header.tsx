import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchMenu, fetchCollections, ShopifyMenu, ShopifyCollection } from "@/lib/shopify";
import { HeaderDesktop } from "@/components/layout/header/HeaderDesktop";
import { HeaderMobile } from "@/components/layout/header/HeaderMobile";

interface HeaderProps {
  onSearch?: (query: string) => void;
  onCollectionSelect?: (handle: string | null) => void;
}

export function Header({ onSearch, onCollectionSelect }: HeaderProps) {
  const [menu, setMenu] = useState<ShopifyMenu | null>(null);
  const [collections, setCollections] = useState<ShopifyCollection[]>([]);
  const navigate = useNavigate();

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

  return (
    <header className="sticky top-0 z-50 bg-background">
      <HeaderDesktop onSearch={handleSearch} onCollectionSelect={onCollectionSelect} />
      <HeaderMobile menu={menu} collections={collections} onSearch={handleSearch} onCollectionSelect={onCollectionSelect} />
    </header>
  );
}
