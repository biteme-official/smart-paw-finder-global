import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CURATED_PANELS, curatedPanelHref } from "./curatedData";

export function WhatYouMightLikeDesktop() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateScrollButtons();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollButtons, { passive: true });
    window.addEventListener("resize", updateScrollButtons);
    return () => {
      el.removeEventListener("scroll", updateScrollButtons);
      window.removeEventListener("resize", updateScrollButtons);
    };
  }, [updateScrollButtons]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === "left" ? -el.clientWidth : el.clientWidth, behavior: "smooth" });
  };

  return (
    <section className="hidden md:block mt-24 px-4">
      <h2 className="text-xl font-bold text-foreground text-center mb-8">What You Might Like!</h2>

      <div className="relative group">
        <div className="overflow-hidden">
          <div ref={scrollRef} className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {CURATED_PANELS.map((panel) => (
              <div
                key={panel.title}
                className={`relative flex-shrink-0 w-[calc((100%-2rem)/3)] flex flex-col items-start justify-end gap-3 overflow-hidden rounded-xl ${panel.bgClass} aspect-square p-6`}
              >
                {panel.imageUrl && (
                  <img src={panel.imageUrl} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover" />
                )}
                <p className="relative z-10 text-lg font-bold text-foreground">{panel.title}</p>
                <Link
                  to={curatedPanelHref(panel)}
                  className="relative z-10 inline-flex items-center rounded-lg bg-background px-4 py-2 text-sm font-semibold text-foreground shadow-sm hover:bg-background/80 transition-colors"
                >
                  Shop the Edit
                </Link>
              </div>
            ))}
          </div>
        </div>

        {canScrollLeft && (
          <button onClick={() => scroll("left")} className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 bg-white shadow-md rounded-full p-2 opacity-0 group-hover:opacity-100 md:opacity-100 transition-opacity">
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </button>
        )}
        {canScrollRight && (
          <button onClick={() => scroll("right")} className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 bg-white shadow-md rounded-full p-2 opacity-0 group-hover:opacity-100 md:opacity-100 transition-opacity">
            <ChevronRight className="h-5 w-5 text-foreground" />
          </button>
        )}
      </div>
    </section>
  );
}
