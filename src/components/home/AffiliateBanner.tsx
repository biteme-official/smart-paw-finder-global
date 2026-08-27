import { Link } from "react-router-dom";
import { Camera, ArrowRight } from "lucide-react";

export function AffiliateBanner() {
  return (
    <section className="mt-6 px-4">
      <Link
        to="/affiliate"
        className="group flex items-center gap-2 rounded-2xl bg-orange-500 px-3 py-2.5 text-white shadow-sm transition-all hover:bg-orange-600 hover:shadow-md md:gap-4 md:px-6 md:py-5"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 md:h-12 md:w-12">
          <Camera className="h-4 w-4 md:h-6 md:w-6" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="inline-block rounded-full bg-white/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wider md:px-2 md:text-[11px]">
            FOR CREATORS
          </span>
          <span className="mt-0.5 block text-xs font-extrabold leading-snug md:mt-1 md:text-lg">
            Love BITE ME? Earn With Us! 🐾
          </span>

          {/* Mobile: compact single line */}
          <span className="mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-bold text-white/95 md:hidden">
            Earn 10% commission <ArrowRight className="h-3 w-3" />
          </span>

          {/* Desktop: full copy, unchanged */}
          <span className="mt-0.5 hidden text-xs leading-snug text-white/90 md:mt-0.5 md:block md:text-sm">
            Join our Affiliate Program &amp; earn{" "}
            <span className="inline-block whitespace-nowrap rounded-full bg-white px-2 py-0.5 align-middle text-[11px] font-extrabold text-orange-600 md:text-xs">
              10% commission
            </span>
          </span>
        </span>

        <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-orange-600 transition-transform group-hover:translate-x-0.5 md:inline-flex">
          Join Now <ArrowRight className="h-4 w-4" />
        </span>
      </Link>
    </section>
  );
}
