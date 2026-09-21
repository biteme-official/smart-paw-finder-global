import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { fetchAnnouncements, AnnouncementItem } from "@/lib/shopify";

// sticky 헤더들이 띠배너 아래에 붙도록 높이를 CSS 변수로 공유
const HEIGHT_VAR = "--announcement-bar-h";

// "[Title] body" / "【Title】body" → 앞의 괄호 부분을 굵은 제목으로 분리
function splitTitle(message: string): { title: string | null; body: string } {
  const match = message.match(/^\s*(\[[^\]]+\]|【[^】]+】)\s*(.*)$/);
  if (!match) return { title: null, body: message };
  return { title: match[1], body: match[2] };
}

export function AnnouncementBar() {
  const { pathname } = useLocation();
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAnnouncements()
      .then(setItems)
      .catch(() => {});
  }, []);

  const hidden = pathname.startsWith("/admin") || items.length === 0;

  useEffect(() => {
    const root = document.documentElement;
    const el = barRef.current;
    if (hidden || !el) {
      root.style.setProperty(HEIGHT_VAR, "0px");
      return;
    }
    const update = () => root.style.setProperty(HEIGHT_VAR, `${el.offsetHeight}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.setProperty(HEIGHT_VAR, "0px");
    };
  }, [hidden]);

  if (hidden) return null;

  return (
    <div
      ref={barRef}
      role="status"
      className="sticky top-0 z-[60] w-full bg-accent text-accent-foreground border-b border-accent-foreground/15"
    >
      {items.map((item) => {
        const { title, body } = splitTitle(item.message);
        return (
          <p
            key={item.id}
            className="max-w-7xl mx-auto px-4 py-1.5 md:py-2 text-xs md:text-sm leading-snug text-center"
          >
            {title && <span className="font-bold">{title}</span>}
            {title && body && " "}
            {body}
          </p>
        );
      })}
    </div>
  );
}
