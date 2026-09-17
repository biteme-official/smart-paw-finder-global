import { Link } from "react-router-dom";
import { CURATED_PANELS, curatedPanelHref } from "./curatedData";

export function WhatYouMightLikeMobile() {
  return (
    <section className="md:hidden px-4">
      <h2 className="text-lg font-bold text-foreground mb-8 text-center">What You Might Like!</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
        {CURATED_PANELS.map((panel) => (
          <div key={panel.title} className="flex-shrink-0 w-[62vw] snap-start flex flex-col gap-2">
            <div className={`relative overflow-hidden rounded-xl ${panel.bgClass} aspect-square`}>
              <Link to={curatedPanelHref(panel)} aria-label={panel.title} className="absolute inset-0 z-0">
                {panel.imageUrl && (
                  <img src={panel.imageUrl} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover" />
                )}
              </Link>
              <Link
                to={curatedPanelHref(panel)}
                className="absolute bottom-5 left-1/2 -translate-x-1/2 inline-flex items-center rounded-xl bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm"
              >
                Shop the Edit
              </Link>
            </div>
            <p className="text-sm font-bold text-foreground text-center">{panel.title}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
