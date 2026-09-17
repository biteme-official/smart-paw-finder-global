import { CategoryIconsDesktop } from "./CategoryIconsDesktop";
import { CategoryIconsMobile } from "./CategoryIconsMobile";

interface CategoryIconsProps {
  onSelect: (handle: string | null) => void;
  /** undefined = no active-selection concept (home page); null/string = category page nav */
  selectedHandle?: string | null;
  showTitle?: boolean;
  compact?: boolean;
}

export function CategoryIcons({ onSelect, selectedHandle, showTitle = true, compact = false }: CategoryIconsProps) {
  return (
    <>
      <CategoryIconsDesktop onSelect={onSelect} selectedHandle={selectedHandle} showTitle={showTitle} compact={compact} />
      <CategoryIconsMobile onSelect={onSelect} selectedHandle={selectedHandle} showTitle={showTitle} compact={compact} />
    </>
  );
}
