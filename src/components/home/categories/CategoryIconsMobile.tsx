import { CATEGORY_DEFS } from "./categoryData";

interface CategoryIconsMobileProps {
  onSelect: (handle: string | null) => void;
  /** undefined = no active-selection concept (home page); null/string = category page nav */
  selectedHandle?: string | null;
  showTitle?: boolean;
  compact?: boolean;
}

export function CategoryIconsMobile({ onSelect, selectedHandle, showTitle = true, compact = false }: CategoryIconsMobileProps) {
  return (
    <section className={`md:hidden px-4 ${compact ? "mt-4" : ""}`}>
      {showTitle && <h2 className="text-base font-bold text-foreground mb-8 text-center">Our Categories</h2>}
      <div className="grid grid-cols-4 gap-y-4 gap-x-2">
        {CATEGORY_DEFS.map(({ label, icon: Icon, bgClass, iconClass, activeBorderClass, handle }) => {
          const isActive = selectedHandle !== undefined && handle === selectedHandle;
          return (
            <button
              key={label}
              onClick={() => onSelect(handle)}
              className="flex flex-col items-center gap-1.5"
            >
              <span
                className={`flex items-center justify-center h-14 w-14 rounded-full border-2 ${bgClass} ${isActive ? activeBorderClass : "border-transparent"}`}
              >
                <Icon className={`${compact ? "h-7 w-7" : "h-9 w-9"} ${iconClass}`} strokeWidth={1.75} />
              </span>
              <span className={`text-xs text-center leading-tight ${isActive ? "font-bold text-foreground" : "font-medium text-foreground"}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
