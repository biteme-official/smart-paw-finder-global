import { CATEGORY_DEFS } from "./categoryData";

interface CategoryIconsDesktopProps {
  onSelect: (handle: string | null) => void;
}

// Each item takes an equal flex-1 share of the row, so the icon (w-full of its slot)
// always spans edge-to-edge with the container below — no fixed icon size to fall out of sync.
export function CategoryIconsDesktop({ onSelect }: CategoryIconsDesktopProps) {
  return (
    <section className="hidden md:block mt-24 px-4">
      <h2 className="text-xl font-bold text-foreground text-center mb-8">Our Categories</h2>
      <div className="flex items-start gap-6">
        {CATEGORY_DEFS.map(({ label, icon: Icon, bgClass, iconClass, handle }) => (
          <button
            key={label}
            onClick={() => onSelect(handle)}
            className="flex-1 flex flex-col items-center gap-3 group"
          >
            <span className={`flex items-center justify-center w-full aspect-square rounded-full ${bgClass} transition-transform group-hover:scale-105`}>
              <Icon className={`h-11 w-11 ${iconClass}`} strokeWidth={1.75} />
            </span>
            <span className="text-base font-medium text-foreground">{label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
