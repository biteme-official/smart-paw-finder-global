import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PROMO_DEFS } from "./promoData";

const ROTATE_MS = 4000;

export function PromoBannerDesktop() {
  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setIndex((prev) => (prev + 1) % PROMO_DEFS.length);
    }, ROTATE_MS);
  }, []);

  useEffect(() => {
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [startTimer]);

  const goTo = (i: number) => {
    setIndex(((i % PROMO_DEFS.length) + PROMO_DEFS.length) % PROMO_DEFS.length);
    startTimer();
  };

  const promo = PROMO_DEFS[index];

  return (
    <section className="hidden md:block mt-24">
      <div className={cn("relative w-full max-w-[1600px] mx-auto aspect-[5/1] overflow-hidden transition-colors", promo.bgClass)}>
        {promo.imageUrl && (
          <img src={promo.imageUrl} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover" />
        )}

        <div className="relative h-full max-w-7xl mx-auto px-6 md:px-12 flex items-center">
          <div key={index} className="flex flex-col items-start text-left gap-1 md:gap-1.5 z-10 w-full md:w-1/2 animate-fade-up">
            <p className="text-xs font-semibold text-primary tracking-wide">{promo.eyebrow}</p>
            <p className="text-lg md:text-2xl font-bold text-foreground tracking-tight">{promo.title}</p>
            <p className="hidden md:block text-sm text-muted-foreground">{promo.subtitle}</p>
            <Link
              to={promo.href}
              className="mt-1.5 md:mt-2 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {promo.ctaLabel}
            </Link>
          </div>
        </div>

        <button
          onClick={() => goTo(index - 1)}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center hover:bg-background/80 transition-colors"
          aria-label="Previous perk"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => goTo(index + 1)}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center hover:bg-background/80 transition-colors"
          aria-label="Next perk"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {PROMO_DEFS.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Show promo ${i + 1}`}
              className={cn("h-2 w-2 rounded-full transition-all", i === index ? "bg-foreground w-4" : "bg-foreground/40 hover:bg-foreground/60")}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
