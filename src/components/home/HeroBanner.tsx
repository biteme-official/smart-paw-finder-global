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

// 배너 원본(가로로 넓은 PC용 사진)은 피사체가 오른쪽에 몰려있는 구도가 많아 모바일 컨테이너에
// object-fit:cover로 확대할 때 가로 기준 65% 지점을 중심으로 크롭한다.
export const MOBILE_IMAGE_FOCAL_X = 0.65;

// object-fit:cover의 기본 커버 배율만으로는(원본이 가로로 넓어) 확대가 부족해서
// 위 focal point를 기준으로 추가로 더 확대한다.
export const MOBILE_IMAGE_EXTRA_ZOOM = 2;

// object-fit: cover + 위 focal point + 추가 확대(zoom) 기준으로 실제 화면에 노출되는
// 크롭 영역 상단 가장자리 색상을 추출한다. 텍스트 블록 배경을 사진 가장자리 색상에
// 맞춰 이음새를 없앤다.
function sampleTopEdgeColor(
  img: HTMLImageElement,
  containerWidth: number,
  containerHeight: number,
  focalX = 0.5,
  focalY = 0.5,
  extraZoom = 1
): string | null {
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  if (!containerWidth || !containerHeight || !nw || !nh) return null;

  const scale = Math.max(containerWidth / nw, containerHeight / nh) * extraZoom;
  const displayedWidth = nw * scale;
  const displayedHeight = nh * scale;

  const visibleLeft = Math.max(0, ((displayedWidth - containerWidth) * focalX) / scale);
  const visibleTop = Math.max(0, ((displayedHeight - containerHeight) * focalY) / scale);
  const visibleWidth = Math.max(1, Math.min(nw - visibleLeft, containerWidth / scale));
  const stripHeight = Math.max(1, Math.min(8, nh - visibleTop));

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(visibleWidth));
  canvas.height = stripHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  try {
    ctx.drawImage(img, visibleLeft, visibleTop, visibleWidth, stripHeight, 0, 0, canvas.width, stripHeight);
    const { data } = ctx.getImageData(0, 0, canvas.width, stripHeight);
    let r = 0, g = 0, b = 0;
    const pixelCount = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    return `rgb(${Math.round(r / pixelCount)}, ${Math.round(g / pixelCount)}, ${Math.round(b / pixelCount)})`;
  } catch {
    // 이미지 CORS 정책 등으로 픽셀 접근이 막히면 기본 배경(흰색)을 유지한다.
    return null;
  }
}

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

  const mobileImageWrapRef = useRef<HTMLDivElement>(null);
  const [mobileTextBg, setMobileTextBg] = useState<string | null>(null);

  const handleMobileImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const container = mobileImageWrapRef.current;
    if (!container) return;
    const color = sampleTopEdgeColor(
      img,
      container.clientWidth,
      container.clientHeight,
      MOBILE_IMAGE_FOCAL_X,
      0.5,
      MOBILE_IMAGE_EXTRA_ZOOM
    );
    if (color) setMobileTextBg(color);
  }, []);

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

  return (
    <div className="w-full flex-shrink-0">
      {/* 모바일: 텍스트 블록 위 + 사진 아래 (스택형) */}
      <div className="md:hidden">
        <div
          className="flex min-h-[150px] flex-col items-center justify-center gap-2 px-6 pb-4 pt-6 text-center transition-colors duration-300"
          style={mobileTextBg ? { backgroundColor: mobileTextBg } : undefined}
        >
          {badge && (
            <span className="text-xs font-bold uppercase tracking-widest text-primary">
              {badge}
            </span>
          )}
          {headline && (
            <h2 className="line-clamp-2 whitespace-pre-line text-2xl font-bold leading-snug text-neutral-900">
              {withManualLineBreaks(headline)}
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
              onClick={() => onNavigate(banner.linkUrl)}
              className="mt-2 rounded-full bg-primary px-6 py-2 text-sm font-bold lowercase text-primary-foreground first-letter:uppercase transition-opacity hover:opacity-90"
            >
              {buttonLabel}
            </button>
          )}
        </div>
        <div ref={mobileImageWrapRef} className="relative aspect-[6/5] w-full overflow-hidden">
          <img
            src={banner.image!.url}
            alt={banner.image!.altText || headline || "Main banner"}
            crossOrigin="anonymous"
            onLoad={handleMobileImageLoad}
            onClick={() => onNavigate(banner.linkUrl)}
            className={cn(
              "absolute inset-0 h-full w-full object-cover",
              banner.linkUrl && "cursor-pointer"
            )}
            style={{
              objectPosition: `${MOBILE_IMAGE_FOCAL_X * 100}% center`,
              transform: `scale(${MOBILE_IMAGE_EXTRA_ZOOM})`,
              transformOrigin: `${MOBILE_IMAGE_FOCAL_X * 100}% 50%`,
            }}
            loading="lazy"
          />
        </div>
      </div>

      {/* 데스크톱: 이미지 풀블리드 배경 + 텍스트 오버레이 */}
      <div className="relative hidden aspect-[2/1] w-full overflow-hidden rounded-lg md:block">
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
          <div className="flex max-w-md flex-col items-start gap-3 px-16">
            {badge && (
              <span className="whitespace-nowrap rounded-full bg-neutral-900 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                {badge}
              </span>
            )}
            {headline && (
              <h2 className="line-clamp-2 whitespace-pre-line text-4xl font-bold leading-snug text-neutral-900">
                {withManualLineBreaks(headline)}
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
                onClick={() => onNavigate(banner.linkUrl)}
                className="pointer-events-auto mt-2 border-b-2 border-neutral-900 pb-0.5 text-base font-bold lowercase text-neutral-900 first-letter:uppercase transition-opacity hover:opacity-60"
              >
                {buttonLabel}
              </button>
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
