import { Link } from "react-router-dom";
import { CURATED_PANELS, curatedPanelHref } from "./curatedData";

export function WhatYouMightLikeMobile() {
  return (
    <section className="md:hidden mt-8 px-4">
      <h2 className="text-lg font-bold text-foreground mb-3">What You Might Like!</h2>
      <div className="grid grid-cols-2 gap-3">
        {CURATED_PANELS.map((panel) => (
          <div key={panel.title} className={`flex flex-col items-start justify-end gap-2 rounded-xl ${panel.bgClass} aspect-square p-4`}>
            <p className="text-sm font-bold text-foreground">{panel.title}</p>
            <Link
              to={curatedPanelHref(panel)}
              className="inline-flex items-center rounded-lg bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm"
            >
              Shop the Edit
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
