import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { fetchAnnouncements, AnnouncementItem } from "@/lib/shopify";
import { TextSegment, stripExplicitLineMarker, applyExplicitLineMarker, parseBoldSegments } from "@/lib/announcement-text";

function renderSegments(segments: TextSegment[], keyPrefix: string) {
  return segments.map((segment, i) =>
    segment.bold ? (
      <span key={`${keyPrefix}-${i}`} className="font-bold">{segment.text}</span>
    ) : (
      <span key={`${keyPrefix}-${i}`}>{segment.text}</span>
    )
  );
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
        {items.map((item) => (
          <div
            key={item.id}
            className="w-full flex-shrink-0"
            style={{ backgroundColor: item.backgroundColor ?? undefined }}
          >
            {/* PC: "\n" 마커는 무시(공백으로 치환)하고 항상 한 줄로 표시 */}
            <p
              className="hidden md:block max-w-7xl mx-auto px-4 py-2 text-sm leading-snug text-center whitespace-nowrap"
              style={{ color: item.textColor ?? undefined }}
            >
              {renderSegments(parseBoldSegments(stripExplicitLineMarker(item.message)), "pc")}
            </p>
            {/* 모바일: "\n" 마커 지점은 반드시 줄바꿈되고, 그 외 구간은 화면 폭에 따라 자동
                줄바꿈 허용(whitespace-pre-line) — 마커 없는 긴 문구가 화면 밖으로 잘리지 않도록. */}
            <p
              className="md:hidden max-w-7xl mx-auto px-4 py-1.5 text-xs leading-snug text-center whitespace-pre-line"
              style={{ color: item.textColor ?? undefined }}
            >
              {renderSegments(parseBoldSegments(applyExplicitLineMarker(item.message)), "mobile")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
