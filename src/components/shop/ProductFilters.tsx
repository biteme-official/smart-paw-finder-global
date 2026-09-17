import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SortOption = "most-viewed" | "best-selling" | "newest";

interface ProductFiltersProps {
  sortOption: SortOption;
  onSortChange: (sort: SortOption) => void;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "most-viewed", label: "Most Viewed" },
  { value: "best-selling", label: "Best Selling" },
  { value: "newest", label: "Newest" },
];

export function ProductFilters({ sortOption, onSortChange }: ProductFiltersProps) {
  return (
    <Select value={sortOption} onValueChange={(value) => onSortChange(value as SortOption)}>
      <SelectTrigger className="w-[140px] h-9 text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
