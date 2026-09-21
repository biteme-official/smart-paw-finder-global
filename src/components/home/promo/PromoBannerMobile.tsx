import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PROMO_DEFS, isExternalHref } from "./promoData";

const ROTATE_MS = 4000;

export function PromoBannerMobile() {
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

  return (
    <section className="md:hidden px-4">
      <h2 className="text-lg font-bold text-foreground mb-8 text-center">Why Shop With Us</h2>
      <div className="relative overflow-hidden">
        {/* Slides — same flex-row + translateX slide transition as HeroBanner */}
        <div
          className="flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {PROMO_DEFS.map((promo) =>
            isExternalHref(promo.href) ? (
              <a key={promo.title} href={promo.href} target="_blank" rel="noopener noreferrer" className="block w-full flex-shrink-0">
                <img src={promo.mobileImage} alt={promo.title} className="w-full h-auto" />
              </a>
            ) : (
              <Link key={promo.title} to={promo.href} className="block w-full flex-shrink-0">
                <img src={promo.mobileImage} alt={promo.title} className="w-full h-auto" />
              </Link>
            )
          )}
        </div>

        {PROMO_DEFS.length > 1 && (
          <>
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
          </>
        )}
      </div>
    </section>
  );
}
