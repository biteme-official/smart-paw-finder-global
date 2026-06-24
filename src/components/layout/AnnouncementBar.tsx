import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { fetchAnnouncements, AnnouncementItem } from "@/lib/shopify";

const DISMISSED_KEY = "announcement-bar-dismissed";
const FILL_COUNT = 8;

function MessageSet({ items }: { items: AnnouncementItem[] }) {
  return (
    <>
      {Array.from({ length: FILL_COUNT }).map((_, ri) =>
        items.map((item, ii) => (
          <span key={`${ri}-${ii}`} className="inline-flex items-center shrink-0 mx-10">
            <span className="text-white/60 mr-6">★</span>
            {item.linkUrl ? (
              <a href={item.linkUrl} className="hover:underline underline-offset-2">{item.message}</a>
            ) : (
              item.message
            )}
          </span>
        ))
      )}
    </>
  );
}

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

  return (
    <div className="relative bg-[#f85a24] text-white text-xs sm:text-sm overflow-hidden">
      <div className="marquee-track flex items-center whitespace-nowrap py-2">
        <div className="marquee-half flex items-center shrink-0">
          <MessageSet items={items} />
        </div>
        <div className="marquee-half flex items-center shrink-0">
          <MessageSet items={items} />
        </div>
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
