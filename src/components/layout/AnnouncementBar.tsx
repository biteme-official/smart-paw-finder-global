import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { fetchAnnouncements, AnnouncementItem } from "@/lib/shopify";

const DISMISSED_KEY = "announcement-bar-dismissed";

export function AnnouncementBar() {
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISSED_KEY) === "1");

  useEffect(() => {
    if (dismissed) return;
    fetchAnnouncements()
      .then(setItems)
      .catch(() => {});
  }, [dismissed]);

  if (dismissed || items.length === 0) return null;

  const repeated = [...items, ...items];

  return (
    <div className="relative bg-[#1a1a1a] text-white text-xs sm:text-sm overflow-hidden">
      <div className="marquee-track flex items-center whitespace-nowrap py-2">
        {repeated.map((item, i) => (
          <span key={`${item.id}-${i}`} className="inline-flex items-center mx-8 shrink-0">
            {item.linkUrl ? (
              <a
                href={item.linkUrl}
                className="hover:underline underline-offset-2"
              >
                {item.message}
              </a>
            ) : (
              item.message
            )}
          </span>
        ))}
      </div>
      <button
        onClick={() => {
          setDismissed(true);
          sessionStorage.setItem(DISMISSED_KEY, "1");
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded transition-colors"
        aria-label="Close announcement"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
