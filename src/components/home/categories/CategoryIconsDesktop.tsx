import { CATEGORY_DEFS } from "./categoryData";

interface CategoryIconsDesktopProps {
  onSelect: (handle: string | null) => void;
  /** undefined = no active-selection concept (home page); null/string = category page nav */
  selectedHandle?: string | null;
  showTitle?: boolean;
  /** Category-page utility nav: fixed small icons centered in the row, instead of
   * the home page's flex-1 icons stretched edge to edge. */
  compact?: boolean;
}

// Gap between items is fixed — each item takes an equal flex-1 share of the
// remaining row width, so the icon (aspect-square, full width of its slot) grows
// to span the same left/right edges as Popular Products below, without the gap
// itself stretching.
export function CategoryIconsDesktop({ onSelect, selectedHandle, showTitle = true, compact = false }: CategoryIconsDesktopProps) {
  return (
    <section className="hidden md:block mt-8 px-4">
      {showTitle && <h2 className="text-xl font-bold text-foreground text-center mb-8">Our Categories</h2>}
      <div className={`flex items-start max-w-7xl mx-auto ${compact ? "justify-center gap-8" : "gap-4"}`}>
        {CATEGORY_DEFS.map(({ label, icon: Icon, bgClass, iconClass, activeBorderClass, handle }) => {
          const isActive = selectedHandle !== undefined && handle === selectedHandle;
          return (
            <button
              key={label}
              onClick={() => onSelect(handle)}
              className={`flex flex-col items-center gap-2 group ${compact ? "" : "flex-1"}`}
            >
              <span
                className={`flex items-center justify-center rounded-full border-2 transition-transform group-hover:scale-105 ${
                  compact ? "w-14 h-14" : "w-full aspect-square"
                } ${bgClass} ${isActive ? activeBorderClass : "border-transparent"}`}
              >
                <Icon className={`${compact ? "h-7 w-7" : "h-11 w-11"} ${iconClass}`} strokeWidth={1.75} />
              </span>
              <span className={`text-sm text-center leading-tight ${isActive ? "font-bold text-foreground" : "font-medium text-foreground"}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
