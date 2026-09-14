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
                  <>
                    {/* 모바일: 텍스트 블록 위 + 사진 아래 (스택형) */}
                    <div className="md:hidden">
                      <div className="flex flex-col items-center gap-2 px-6 pb-4 pt-8 text-center">
                        {badge && (
                          <span className="text-xs font-bold uppercase tracking-widest text-primary">
                            {badge}
                          </span>
                        )}
                        {headline && (
                          <h2 className="line-clamp-2 whitespace-pre-line text-2xl font-bold leading-snug text-neutral-900">
                            {headline}
                          </h2>
                        )}
                        {subtext && (
                          <p className="whitespace-pre-line text-sm font-light text-neutral-400">
                            {subtext}
                          </p>
                        )}
                        {buttonLabel && banner.linkUrl && (
                          <button
                            type="button"
                            onClick={() => handleBannerClick(banner.linkUrl)}
                            className="mt-2 rounded-full bg-primary px-6 py-2 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
                          >
                            {buttonLabel}
                          </button>
                        )}
                      </div>
                      <img
                        src={banner.image!.url}
                        alt={banner.image!.altText || headline || "Main banner"}
                        onClick={() => handleBannerClick(banner.linkUrl)}
                        className={cn("block h-auto w-full", banner.linkUrl && "cursor-pointer")}
                        loading="lazy"
                      />
                    </div>

                    {/* 데스크톱: 이미지 풀블리드 배경 + 텍스트 오버레이 */}
                    <div className="relative hidden aspect-[2/1] w-full overflow-hidden rounded-lg md:block">
                      <img
                        src={banner.image!.url}
                        alt={banner.image!.altText || headline || "Main banner"}
                        onClick={() => handleBannerClick(banner.linkUrl)}
                        className={cn(
                          "absolute inset-0 h-full w-full object-cover",
                          banner.linkUrl && "cursor-pointer"
                        )}
                        loading="lazy"
                      />
                      <div className="pointer-events-none absolute inset-0 flex items-center">
                        <div className="flex max-w-md flex-col items-start gap-3 px-16">
                          {badge && (
                            <span className="whitespace-nowrap rounded-full bg-neutral-900 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                              {badge}
                            </span>
                          )}
                          {headline && (
                            <h2 className="line-clamp-2 whitespace-pre-line text-4xl font-bold leading-snug text-neutral-900">
                              {headline}
                            </h2>
                          )}
                          {subtext && (
                            <p className="whitespace-pre-line text-base leading-relaxed text-neutral-600">
                              {subtext}
                            </p>
                          )}
                          {buttonLabel && banner.linkUrl && (
                            <button
                              type="button"
                              onClick={() => handleBannerClick(banner.linkUrl)}
                              className="pointer-events-auto mt-2 border-b-2 border-neutral-900 pb-0.5 text-base font-bold text-neutral-900 transition-opacity hover:opacity-60"
                            >
                              {buttonLabel}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  // 텍스트 필드가 모두 비어있으면 이미지 원본 비율 그대로 전체 폭 표시
                  <img
                    src={banner.image!.url}
                    alt={banner.image!.altText || "Main banner"}
                    onClick={() => handleBannerClick(banner.linkUrl)}
                    className={cn("block h-auto w-full", banner.linkUrl && "cursor-pointer")}
                    loading="lazy"
                  />
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
              className="absolute left-0 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center text-neutral-400 transition-colors hover:text-neutral-900 md:flex md:left-1"
            >
              <ChevronLeft className="h-7 w-7" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              aria-label="다음 배너"
              onClick={goNext}
              className="absolute right-0 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center text-neutral-400 transition-colors hover:text-neutral-900 md:flex md:right-1"
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
