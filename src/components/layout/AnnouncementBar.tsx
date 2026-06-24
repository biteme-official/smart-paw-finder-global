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

  const renderBlock = (key: string) => (
    <span key={key} className="inline-flex items-center shrink-0">
      {items.map((item, i) => (
        <span key={`${key}-${i}`} className="inline-flex items-center mx-16">
          <span className="mx-2 text-white/70">★</span>
          {item.linkUrl ? (
            <a href={item.linkUrl} className="hover:underline underline-offset-2">{item.message}</a>
          ) : (
            item.message
          )}
        </span>
      ))}
    </span>
  );

  return (
    <div className="relative bg-[#f85a24] text-white text-xs sm:text-sm overflow-hidden">
      <div className="marquee-track flex items-center whitespace-nowrap py-2">
        {renderBlock("a")}
        {renderBlock("b")}
        {renderBlock("c")}
        {renderBlock("d")}
      </div>
      <button
        onClick={() => {
          setDismissed(true);
          sessionStorage.setItem(DISMISSED_KEY, "1");
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-white/20 rounded transition-colors"
        aria-label="Close announcement"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
