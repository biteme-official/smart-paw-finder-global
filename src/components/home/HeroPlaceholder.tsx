import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import heroWelcome from "@/assets/hero/hero-welcome.jpg";
import heroBestSeller from "@/assets/hero/hero-best-seller.jpg";
import heroNewArrival from "@/assets/hero/hero-new-arrival.jpg";

interface SlideDef {
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  href: string;
  bgClass: string;
  hasImage: boolean;
  /**
   * Full-bleed banner photo — should match the banner's own aspect ratio (~3:1 desktop).
   * Recommended: 1600x533px minimum, 3200x1067px for retina. Falls back to a placeholder icon when unset.
   */
  imageUrl?: string;
}

// Temporary clean placeholder for the campaign hero banner — swap back to <HeroBanner /> once
// high-resolution campaign images are ready (the real Shopify banner images look pixelated full-bleed).
// Layout follows abib.global: full-bleed photo shown as-is, with a left-aligned text block over its empty negative space.
const SLIDES: SlideDef[] = [
  {
    eyebrow: "WELCOME",
    title: "Welcome to BITE ME",
    subtitle: "Get 15% off your first order — sign up and save",
    ctaLabel: "Join & Save",
    href: "/mypage",
    bgClass: "bg-orange-50",
    hasImage: true,
    imageUrl: heroWelcome,
  },
  {
    eyebrow: "BEST SELLER",
    title: "Everyday Essentials for Every Pup",
    subtitle: "Discover the toys and treats our community loves most",
    ctaLabel: "Shop Now",
    href: "/",
    bgClass: "bg-sky-50",
    hasImage: true,
    imageUrl: heroBestSeller,
  },
  {
    eyebrow: "NEW ARRIVAL",
    title: "Fresh Picks, Just Landed",
    subtitle: "Explore what's new this season",
    ctaLabel: "Shop Now",
    href: "/new-products",
    bgClass: "bg-emerald-50",
    hasImage: true,
    imageUrl: heroNewArrival,
  },
];

const ROTATE_MS = 5000;

export function HeroPlaceholder() {
  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setIndex((prev) => (prev + 1) % SLIDES.length);
    }, ROTATE_MS);
  }, []);

  useEffect(() => {
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [startTimer]);

  const goTo = (i: number) => {
    setIndex(((i % SLIDES.length) + SLIDES.length) % SLIDES.length);
    startTimer();
  };

  const slide = SLIDES[index];

  return (
    <div className={cn("relative w-full max-w-[1600px] mx-auto aspect-[21/9] md:aspect-[3/1] overflow-hidden transition-colors", slide.bgClass)}>
      {slide.hasImage && (
        slide.imageUrl ? (
          <img src={slide.imageUrl} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageIcon className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.5} />
          </div>
        )
      )}

      <div className="relative h-full max-w-7xl mx-auto px-6 md:px-12 flex items-center">
        <div className="flex flex-col items-start text-left gap-2 md:gap-3 z-10 w-full md:w-1/2">
          <p className="text-xs md:text-sm font-semibold text-primary tracking-wide">{slide.eyebrow}</p>
          <p className="text-xl md:text-4xl font-bold text-foreground tracking-tight">{slide.title}</p>
          <p className="text-sm md:text-base text-muted-foreground">{slide.subtitle}</p>
          <Button asChild size="lg" className="mt-2 md:mt-4">
            <Link to={slide.href}>{slide.ctaLabel}</Link>
          </Button>
        </div>
      </div>

      {SLIDES.length > 1 && (
        <>
          <button
            onClick={() => goTo(index - 1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center hover:bg-background/80 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => goTo(index + 1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center hover:bg-background/80 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  i === index ? "bg-foreground w-4" : "bg-foreground/40 hover:bg-foreground/60"
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
