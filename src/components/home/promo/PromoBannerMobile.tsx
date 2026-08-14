import { Link } from "react-router-dom";
import { PROMO_DEFS } from "./promoData";

export function PromoBannerMobile() {
  return (
    <section className="md:hidden mt-8 px-4">
      <h2 className="text-lg font-bold text-foreground mb-3">Perks</h2>
      <div className="space-y-3">
        {PROMO_DEFS.map(({ title, href }) => {
          const content = (
            <div className="rounded-xl bg-orange-100 px-5 py-5">
              <p className="text-sm font-bold text-foreground">{title}</p>
            </div>
          );
          return href ? (
            <Link key={title} to={href} className="block">{content}</Link>
          ) : (
            <div key={title}>{content}</div>
          );
        })}
      </div>
    </section>
  );
}
