import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { fetchAnnouncements, AnnouncementItem } from "@/lib/shopify";

// "*텍스트*"로 감싼 구간만 볼드 처리(별표 자체는 노출하지 않음). 한 메시지에 여러 구간 가능.
export function parseBoldSegments(text: string): { text: string; bold: boolean }[] {
  const segments: { text: string; bold: boolean }[] = [];
  const regex = /\*(.+?)\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) segments.push({ text: text.slice(lastIndex, match.index), bold: false });
    segments.push({ text: match[1], bold: true });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex), bold: false });
  return segments;
}

// 기본적으로 띠배너 텍스트는 자동 줄바꿈 없이 한 줄로 표시한다. Message 필드(Shopify 단일행
// 텍스트)에 리터럴 "\n"(백슬래시+n 두 글자)을 넣은 경우에만 그 지점에서 줄바꿈한다 — 자동
// 줄바꿈 로직이 아니라 운영자가 명시적으로 지정한 지점에서만 끊는 방식.
export function splitExplicitLines(message: string): string[] {
  return message.split(/\\n/);
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
            <p
              className="max-w-7xl mx-auto px-4 py-1.5 md:py-2 text-xs md:text-sm leading-snug text-center"
              style={{ color: item.textColor ?? undefined }}
            >
              {splitExplicitLines(item.message).map((line, li) => (
                <span key={li} className="block whitespace-nowrap">
                  {parseBoldSegments(line).map((segment, i) =>
                    segment.bold ? (
                      <span key={i} className="font-bold">{segment.text}</span>
                    ) : (
                      <span key={i}>{segment.text}</span>
                    )
                  )}
                </span>
              ))}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
