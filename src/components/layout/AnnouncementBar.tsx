import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { fetchAnnouncements, AnnouncementItem } from "@/lib/shopify";

const DISMISSED_KEY = "announcement-bar-dismissed";
const SEPARATOR = "   ★   ";

export function AnnouncementBar() {
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISSED_KEY) === "1");
  const trackRef = useRef<HTMLDivElement>(null);
  const [repeatCount, setRepeatCount] = useState(6);

  useEffect(() => {
    if (dismissed) return;
    fetchAnnouncements()
      .then(setItems)
      .catch(() => {});
  }, [dismissed]);

  useEffect(() => {
    if (!trackRef.current || items.length === 0) return;
    const trackWidth = trackRef.current.scrollWidth / 2;
    const viewWidth = trackRef.current.parentElement?.clientWidth || window.innerWidth;
    if (trackWidth < viewWidth * 2) {
      setRepeatCount((prev) => Math.min(prev * 2, 24));
    }
  }, [items, repeatCount]);

  if (dismissed || items.length === 0) return null;

  const baseText = items.map((item) => item.message).join(SEPARATOR);
  const linkUrl = items[0]?.linkUrl || null;
  const repeatedText = Array.from({ length: repeatCount }, () => baseText).join(SEPARATOR);

  const renderContent = (key: string) => (
    <span key={key} className="inline-flex items-center shrink-0 px-4">
      {linkUrl ? (
        <a href={linkUrl} className="hover:underline underline-offset-2">{repeatedText}</a>
      ) : (
        repeatedText
      )}
    </span>
  );

  return (
    <div className="relative bg-[#f85a24] text-white text-xs sm:text-sm overflow-hidden">
      <div ref={trackRef} className="marquee-track flex items-center whitespace-nowrap py-2">
        {renderContent("a")}
        {renderContent("b")}
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
