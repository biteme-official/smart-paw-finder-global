import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { fetchBanners, ShopifyBanner } from "@/lib/shopify";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Shopify 헤드라인 필드는 보통 한 줄 텍스트라 실제 Enter 줄바꿈을 못 넣는 경우가 많다.
// CMS에서 원하는 줄바꿈 위치에 문자 그대로 "\n"(백슬래시+n)을 입력하면 실제 줄바꿈으로 치환해
// 화면 폭과 상관없이 항상 같은 지점에서 끊기도록 한다. (whitespace-pre-line과 함께 사용)
function withManualLineBreaks(text: string): string {
  return text.replace(/\\n/g, "\n");
}

// 배지/헤드라인/서브텍스트/CTA 폰트 크기를 화면 폭에 비례해 줄인다(clamp(최소, 화면폭 비례, 최대)).
// 브레이크포인트별 고정값을 여러 개 두는 대신 화면 폭이 좁아질수록 계속 비례해서 작아지므로,
// 좁은 화면에서도 헤드라인이 사진 속 피사체를 침범하지 않는다.
// 최소/화면폭 비례/최대값 모두 이전 크기의 정확히 절반으로 축소(요청: "지금의 50%").
const FLUID_BADGE_TEXT = "text-[clamp(0.25rem,0.8vw,0.375rem)]";
const FLUID_HEADLINE_TEXT = "text-[clamp(0.40625rem,1.8vw,1.125rem)]";
const FLUID_SUBTEXT_TEXT = "text-[clamp(0.3125rem,1vw,0.5rem)]";
const FLUID_BUTTON_TEXT = "text-[clamp(0.34375rem,1.1vw,0.5rem)]";
// 캐러셀 화살표(왼쪽 폭 40px)와 겹치지 않도록 좌우 패딩의 최솟값을 화살표 폭보다 넉넉하게 확보한다.
const FLUID_TEXT_PADDING_X = "px-[clamp(3.5rem,8vw,4rem)]";

function HeroBannerSlide({
  banner,
  onNavigate,
}: {
  banner: ShopifyBanner;
  onNavigate: (linkUrl: string | null) => void;
}) {
  const badge = banner.fields.badge?.trim();
  const headline = banner.fields.headline?.trim();
  const subtext = banner.fields.subtext?.trim();
  const buttonLabel = banner.fields.button_label?.trim();
  const hasText = Boolean(badge || headline || subtext || buttonLabel);

  if (!hasText) {
    // 텍스트 필드가 모두 비어있으면 이미지 원본 비율 그대로 전체 폭 표시
    return (
      <div className="w-full flex-shrink-0">
        <img
          src={banner.image!.url}
          alt={banner.image!.altText || "Main banner"}
          onClick={() => onNavigate(banner.linkUrl)}
          className={cn("block h-auto w-full", banner.linkUrl && "cursor-pointer")}
          loading="lazy"
        />
      </div>
    );
  }

  // 이미지 풀블리드 배경 + 텍스트 좌측 정렬 오버레이. PC/모바일 동일 구조이며
  // 폰트 크기만 화면 폭에 비례해 줄어든다.
  return (
    <div className="w-full flex-shrink-0">
      <div className="relative aspect-[2/1] w-full overflow-hidden rounded-lg">
        <img
          src={banner.image!.url}
          alt={banner.image!.altText || headline || "Main banner"}
          onClick={() => onNavigate(banner.linkUrl)}
          className={cn(
            "absolute inset-0 h-full w-full object-cover",
            banner.linkUrl && "cursor-pointer"
          )}
          loading="lazy"
        />
        <div className="pointer-events-none absolute inset-0 flex items-center">
          <div className={cn("flex max-w-md flex-col items-start gap-2 sm:gap-3", FLUID_TEXT_PADDING_X)}>
            {badge && (
              <span
                className={cn(
                  "whitespace-nowrap rounded-full bg-neutral-900 px-3 py-1 font-bold uppercase tracking-wide text-white",
                  FLUID_BADGE_TEXT
                )}
              >
                {badge}
              </span>
            )}
            {headline && (
              <h2
                className={cn(
                  "line-clamp-2 whitespace-pre-line font-bold leading-snug text-neutral-900",
                  FLUID_HEADLINE_TEXT
                )}
              >
                {withManualLineBreaks(headline)}
              </h2>
            )}
            {subtext && (
              <p className={cn("md:hidden whitespace-pre-line leading-relaxed text-neutral-600", FLUID_SUBTEXT_TEXT)}>
                {subtext}
              </p>
            )}
            {buttonLabel && (
              banner.linkUrl ? (
                <button
                  type="button"
                  onClick={() => onNavigate(banner.linkUrl)}
                  className={cn(
                    "pointer-events-auto mt-2 border-b-2 border-neutral-900 pb-0.5 font-bold lowercase text-neutral-900 first-letter:uppercase transition-opacity hover:opacity-60",
                    FLUID_BUTTON_TEXT
                  )}
                >
                  {buttonLabel}
                </button>
              ) : (
                // link 필드가 비어있어 버튼을 노출할 수 없는 배너도, 배지/헤드라인 위치가
                // 다른 슬라이드와 같은 높이에 오도록 버튼 자리만큼 공간을 그대로 유지한다.
                <span
                  aria-hidden="true"
                  className={cn(
                    "invisible mt-2 border-b-2 border-transparent pb-0.5 font-bold",
                    FLUID_BUTTON_TEXT
                  )}
                >
                  {buttonLabel}
                </span>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function HeroBanner() {
  const navigate = useNavigate();
  const [banners, setBanners] = useState<ShopifyBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bannersLengthRef = useRef(0);

  const handleBannerClick = useCallback((linkUrl: string | null) => {
    if (!linkUrl) return;
    try {
      const url = new URL(linkUrl);
      const pathParts = url.pathname.split('/').filter(Boolean);
      if (pathParts[0] === 'collections' && pathParts[1]) {
        navigate(`/?collection=${encodeURIComponent(pathParts[1])}`);
        return;
      }
      if (pathParts[0] === 'products' && pathParts[1]) {
        navigate(`/product/${encodeURIComponent(pathParts[1])}`);
        return;
      }
    } catch {
      /* linkUrl이 절대 URL이 아니면 아래에서 그대로 이동 */
    }
    window.location.href = linkUrl;
  }, [navigate]);

  useEffect(() => {
    fetchBanners(10)
      .then((data) => {
        setBanners(data.filter((b) => b.image));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    bannersLengthRef.current = banners.length;
  }, [banners.length]);

  const startTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (bannersLengthRef.current <= 1) return;
    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % bannersLengthRef.current);
    }, 5000);
  }, []);

  // Auto-slide
  useEffect(() => {
    if (banners.length <= 1) return;
    startTimer();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [banners.length, startTimer]);

  const goTo = useCallback(
    (index: number) => {
      const len = bannersLengthRef.current;
      if (len === 0) return;
      setCurrentIndex(((index % len) + len) % len);
      startTimer();
    },
    [startTimer]
  );

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => {
      const len = bannersLengthRef.current;
      return ((prev - 1) + len) % len;
    });
    startTimer();
  }, [startTimer]);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % bannersLengthRef.current);
    startTimer();
  }, [startTimer]);

  if (loading) {
    return (
      <div className="w-full px-6 py-8 sm:px-10">
        <Skeleton className="w-full aspect-[2/1] rounded-lg" />
      </div>
    );
  }

  if (banners.length === 0) return null;

  return (
    <section className="w-full bg-white">
      {/* Slides */}
      <div className="relative overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {banners.map((banner) => (
            <HeroBannerSlide key={banner.id} banner={banner} onNavigate={handleBannerClick} />
          ))}
        </div>

        {/* Navigation Arrows */}
        {banners.length > 1 && (
          <>
            <button
              type="button"
              aria-label="이전 배너"
              onClick={goPrev}
              className="absolute left-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-neutral-400 transition-colors hover:text-neutral-900 md:left-1"
            >
              <ChevronLeft className="h-7 w-7" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              aria-label="다음 배너"
              onClick={goNext}
              className="absolute right-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-neutral-400 transition-colors hover:text-neutral-900 md:right-1"
            >
              <ChevronRight className="h-7 w-7" strokeWidth={1.5} />
            </button>
          </>
        )}
      </div>

      {/* Dots */}
      {banners.length > 1 && (
        <div className="flex items-center justify-center gap-2 pb-5 pt-1">
          {banners.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`${i + 1}번째 배너로 이동`}
              aria-current={i === currentIndex}
              onClick={() => goTo(i)}
              className={cn(
                "h-1 w-1 rounded-full transition-colors md:h-2 md:w-2",
                i === currentIndex ? "bg-neutral-900" : "bg-neutral-300 hover:bg-neutral-400"
              )}
            />
          ))}
        </div>
      )}
    </section>
  );
}
