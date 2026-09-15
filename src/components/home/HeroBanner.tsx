import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { fetchBanners, ShopifyBanner } from "@/lib/shopify";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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
        setBanners(data.filter((b) => b.pcImage && b.mobileImage));
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
        <Skeleton className="w-full aspect-[16/10] md:aspect-[2/1] rounded-lg" />
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
          {banners.map((banner) => {
            const badge = banner.fields.badge?.trim();
            const headline = banner.fields.headline?.trim();
            const subtext = banner.fields.subtext?.trim();
            const buttonLabel = banner.fields.button_label?.trim();
            const hasText = Boolean(badge || headline || subtext || buttonLabel);

            return (
              <div key={banner.id} className="w-full flex-shrink-0">
                {hasText ? (
                  <div className="relative aspect-[9/10] w-full overflow-hidden rounded-lg md:aspect-[2/1]">
                    {/* 모바일: Mobile_image(9:10, 세로형) 풀블리드 */}
                    <img
                      src={banner.mobileImage!.url}
                      alt={banner.mobileImage!.altText || headline || "Main banner"}
                      onClick={() => handleBannerClick(banner.linkUrl)}
                      className={cn(
                        "absolute inset-0 h-full w-full object-cover md:hidden",
                        banner.linkUrl && "cursor-pointer"
                      )}
                      loading="lazy"
                    />
                    {/* PC/태블릿: PC_image(2:1) 풀블리드 */}
                    <img
                      src={banner.pcImage!.url}
                      alt={banner.pcImage!.altText || headline || "Main banner"}
                      onClick={() => handleBannerClick(banner.linkUrl)}
                      className={cn(
                        "absolute inset-0 hidden h-full w-full object-cover md:block",
                        banner.linkUrl && "cursor-pointer"
                      )}
                      loading="lazy"
                    />
                    {/*
                      텍스트 오버레이 위치는 PC/모바일 공통(Mobile_image는 상단 여백 구도라 상단,
                      PC_image는 세로 중앙)이지만, 텍스트 스타일 자체는 모바일 전용 세트로 완전히
                      분리한다 — PC 스타일(좌측 정렬/검은 배지/밑줄 링크)을 그대로 축소 복사하지 않음.
                      모바일: 전체 가운데 정렬, 배지는 배경 없이 주황 텍스트, 서브텍스트는 브라운 톤,
                      CTA는 주황 알약형 버튼. PC(md 이상): 기존 좌측 정렬 오버레이 스타일 그대로 유지.
                    */}
                    <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-10 text-center sm:pt-12 md:items-center md:justify-start md:pt-0 md:text-left">
                      <div className="flex w-full max-w-[85%] flex-col items-center gap-2 px-6 sm:px-10 md:w-auto md:max-w-md md:items-start md:gap-3 md:px-16">
                        {badge && (
                          <span className="text-xs font-bold uppercase tracking-widest text-orange-500 md:whitespace-nowrap md:rounded-full md:bg-neutral-900 md:px-3 md:py-1 md:tracking-wide md:text-white">
                            {badge}
                          </span>
                        )}
                        {headline && (
                          <h2 className="line-clamp-2 whitespace-pre-line text-2xl font-bold leading-snug text-neutral-900 md:text-4xl">
                            {headline}
                          </h2>
                        )}
                        {subtext && (
                          <p className="whitespace-pre-line text-sm leading-relaxed text-amber-700 md:text-base md:text-neutral-600">
                            {subtext}
                          </p>
                        )}
                        {buttonLabel && banner.linkUrl && (
                          <button
                            type="button"
                            onClick={() => handleBannerClick(banner.linkUrl)}
                            className="pointer-events-auto mt-2 rounded-full bg-orange-500 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-orange-600 md:rounded-none md:border-b-2 md:border-neutral-900 md:bg-transparent md:px-0 md:py-0 md:text-base md:text-neutral-900 md:opacity-100 md:transition-opacity md:hover:bg-transparent md:hover:opacity-60 md:pb-0.5"
                          >
                            {buttonLabel}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  // 텍스트 필드가 모두 비어있으면 이미지 원본 비율 그대로 전체 폭 표시
                  <>
                    <img
                      src={banner.mobileImage!.url}
                      alt={banner.mobileImage!.altText || "Main banner"}
                      onClick={() => handleBannerClick(banner.linkUrl)}
                      className={cn("block h-auto w-full md:hidden", banner.linkUrl && "cursor-pointer")}
                      loading="lazy"
                    />
                    <img
                      src={banner.pcImage!.url}
                      alt={banner.pcImage!.altText || "Main banner"}
                      onClick={() => handleBannerClick(banner.linkUrl)}
                      className={cn("hidden h-auto w-full md:block", banner.linkUrl && "cursor-pointer")}
                      loading="lazy"
                    />
                  </>
                )}
              </div>
            );
          })}
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
                "h-2 w-2 rounded-full transition-colors",
                i === currentIndex ? "bg-neutral-900" : "bg-neutral-300 hover:bg-neutral-400"
              )}
            />
          ))}
        </div>
      )}
    </section>
  );
}
