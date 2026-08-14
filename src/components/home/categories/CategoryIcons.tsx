import { CategoryIconsDesktop } from "./CategoryIconsDesktop";
import { CategoryIconsMobile } from "./CategoryIconsMobile";

interface CategoryIconsProps {
  onSelect: (handle: string | null) => void;
}

export function CategoryIcons({ onSelect }: CategoryIconsProps) {
  return (
    <>
      <CategoryIconsDesktop onSelect={onSelect} />
      <CategoryIconsMobile onSelect={onSelect} />
    </>
  );
}
