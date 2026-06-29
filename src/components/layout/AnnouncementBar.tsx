import { useState, useEffect } from "react";
import { X } from "lucide-react";

const DISMISSED_KEY = "announcement-bar-dismissed";

const MESSAGES = [
  "🎁 First Order 10% OFF – Use Code: WELCOME10",
  "🚚 Free Worldwide Shipping on Orders Over $75",
];

export function AnnouncementBar() {
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISSED_KEY) === "1");
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (dismissed) return;
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % MESSAGES.length);
        setVisible(true);
      }, 300);
    }, 2000);
    return () => clearInterval(timer);
  }, [dismissed]);

  if (dismissed) return null;

  return (
    <div className="relative bg-[#f85a24] text-white text-xs sm:text-sm">
      <div className="flex items-center justify-center py-2 px-8 min-h-[36px]">
        <span
          className="transition-opacity duration-300 text-center"
          style={{ opacity: visible ? 1 : 0 }}
        >
          {MESSAGES[index]}
        </span>
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
