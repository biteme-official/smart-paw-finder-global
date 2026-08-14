import { useState, useEffect } from "react";
import { X } from "lucide-react";

const DISMISSED_KEY = "announcement-bar-dismissed";

const MESSAGES = [
  { text: "🎁 First Order 10% OFF – Use Code: WELCOME10", bg: "#f85a24", textClass: "text-white", closeHover: "hover:bg-white/20" },
  { text: "🚚 Free Worldwide Shipping on Orders Over $75", bg: "#FFD600", textClass: "text-[#f85a24]", closeHover: "hover:bg-black/10" },
  { text: "💬 Chat with Us on WhatsApp for 10% Off", bg: "#25D366", textClass: "text-white", closeHover: "hover:bg-white/20" },
  { text: "🐾 Join & Save — Sign Up for 15% Off", bg: "#f85a24", textClass: "text-white", closeHover: "hover:bg-white/20" },
];

export function AnnouncementBar() {
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISSED_KEY) === "1");
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (dismissed) return;
    let fadeTimer: ReturnType<typeof setTimeout>;
    const timer = setInterval(() => {
      setVisible(false);
      fadeTimer = setTimeout(() => {
        setIndex((prev) => (prev + 1) % MESSAGES.length);
        setVisible(true);
      }, 300);
    }, 4000);
    return () => { clearInterval(timer); clearTimeout(fadeTimer); };
  }, [dismissed]);

  if (dismissed) return null;

  return (
    <div className="relative text-xs sm:text-sm transition-colors duration-300" style={{ backgroundColor: MESSAGES[index].bg }}>
      <div className="flex items-center justify-center py-2 px-8 min-h-[36px]">
        <span
          className={`transition-opacity duration-300 text-center font-medium ${MESSAGES[index].textClass}`}
          style={{ opacity: visible ? 1 : 0 }}
        >
          {MESSAGES[index].text}
        </span>
      </div>
      <button
        onClick={() => {
          setDismissed(true);
          sessionStorage.setItem(DISMISSED_KEY, "1");
        }}
        className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-colors ${MESSAGES[index].closeHover}`}
        aria-label="Close announcement"
      >
        <X className={`h-3.5 w-3.5 ${MESSAGES[index].textClass}`} />
      </button>
    </div>
  );
}
