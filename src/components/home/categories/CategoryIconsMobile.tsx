import { CATEGORY_DEFS } from "./categoryData";

interface CategoryIconsMobileProps {
  onSelect: (handle: string | null) => void;
}

export function CategoryIconsMobile({ onSelect }: CategoryIconsMobileProps) {
  return (
    <section className="md:hidden mt-5 px-4">
      <h2 className="text-base font-bold text-foreground mb-3">Our Categories</h2>
      <div className="grid grid-cols-4 gap-y-4 gap-x-2">
        {CATEGORY_DEFS.map(({ label, icon: Icon, bgClass, iconClass, handle }) => (
          <button
            key={label}
            onClick={() => onSelect(handle)}
            className="flex flex-col items-center gap-1.5"
          >
            <span className={`flex items-center justify-center h-14 w-14 rounded-full ${bgClass}`}>
              <Icon className={`h-6 w-6 ${iconClass}`} strokeWidth={1.75} />
            </span>
            <span className="text-xs font-medium text-foreground text-center leading-tight">{label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
