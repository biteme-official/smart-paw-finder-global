import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { fetchAnnouncements, AnnouncementItem } from "@/lib/shopify";

// "[Title] body" / "【Title】body" → 앞의 괄호 부분을 굵은 제목으로 분리
function splitTitle(message: string): { title: string | null; body: string } {
  const match = message.match(/^\s*(\[[^\]]+\]|【[^】]+】)\s*(.*)$/);
  if (!match) return { title: null, body: message };
  return { title: match[1], body: match[2] };
}

// 롤링 전환 간격 — HeroBanner(메인 배너 캐러셀)와 동일한 5초 간격을 사용한다.
const ROLL_INTERVAL_MS = 5000;

export function AnnouncementBar() {
  const { pathname } = useLocation();
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const itemsLengthRef = useRef(0);

  useEffect(() => {
    fetchAnnouncements()
      .then(setItems)
      .catch(() => {});
  }, []);

  useEffect(() => {
    itemsLengthRef.current = items.length;
  }, [items.length]);

  const startTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (itemsLengthRef.current <= 1) return;
    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % itemsLengthRef.current);
    }, ROLL_INTERVAL_MS);
  }, []);

  // Auto-roll — 노출 대상이 2개 이상일 때만 순차 전환
  useEffect(() => {
    if (items.length <= 1) return;
    startTimer();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [items.length, startTimer]);

  if (pathname.startsWith("/admin") || items.length === 0) return null;

  return (
    <div role="status" className="w-full overflow-hidden border-b border-border">
      <div
        className="flex transition-transform duration-500 ease-in-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {items.map((item) => {
          const { title, body } = splitTitle(item.message);
          return (
            <div
              key={item.id}
              className="w-full flex-shrink-0"
              style={{ backgroundColor: item.backgroundColor ?? undefined }}
            >
              <p
                className="max-w-7xl mx-auto px-4 py-1.5 md:py-2 text-xs md:text-sm leading-snug text-center"
                style={{ color: item.textColor ?? undefined }}
              >
                {title && <span className="font-bold">{title}</span>}
                {title && body && " "}
                {body}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
