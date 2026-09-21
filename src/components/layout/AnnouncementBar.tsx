import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { fetchAnnouncements, AnnouncementItem } from "@/lib/shopify";

// "[Title] body" / "【Title】body" → 앞의 괄호 부분을 굵은 제목으로 분리
function splitTitle(message: string): { title: string | null; body: string } {
  const match = message.match(/^\s*(\[[^\]]+\]|【[^】]+】)\s*(.*)$/);
  if (!match) return { title: null, body: message };
  return { title: match[1], body: match[2] };
}

export function AnnouncementBar() {
  const { pathname } = useLocation();
  const [items, setItems] = useState<AnnouncementItem[]>([]);

  useEffect(() => {
    fetchAnnouncements()
      .then(setItems)
      .catch(() => {});
  }, []);

  if (pathname.startsWith("/admin") || items.length === 0) return null;

  return (
    <div role="status" className="w-full bg-accent text-accent-foreground border-b border-accent-foreground/15">
      {items.map((item) => {
        const { title, body } = splitTitle(item.message);
        return (
          <div
            key={item.id}
            className="max-w-7xl mx-auto px-4 py-2 text-xs sm:text-sm leading-relaxed flex flex-col items-center text-center sm:flex-row sm:justify-center sm:gap-x-4"
          >
            {title && <span className="font-bold">{title}</span>}
            {body && <span>{body}</span>}
          </div>
        );
      })}
    </div>
  );
}
