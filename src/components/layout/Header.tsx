import { useNavigate } from "react-router-dom";
import { HeaderDesktop } from "@/components/layout/header/HeaderDesktop";
import { HeaderMobile } from "@/components/layout/header/HeaderMobile";

interface HeaderProps {
  onSearch?: (query: string) => void;
  onCollectionSelect?: (handle: string | null) => void;
}

export function Header({ onSearch, onCollectionSelect }: HeaderProps) {
  const navigate = useNavigate();

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
      <HeaderMobile onSearch={handleSearch} onCollectionSelect={onCollectionSelect} />
    </header>
  );
}
