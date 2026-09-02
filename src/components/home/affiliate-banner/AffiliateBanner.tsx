import { Link } from "react-router-dom";
import { Camera, ArrowRight } from "lucide-react";

export function AffiliateBanner() {
  return (
    <section className="mt-6 px-4">
      <Link
        to="/affiliate"
        className="group flex items-center gap-3 md:gap-4 rounded-2xl bg-orange-500 px-4 py-4 md:px-6 md:py-5 text-white shadow-sm transition-all hover:bg-orange-600 hover:shadow-md"
      >
        <span className="flex h-10 w-10 md:h-12 md:w-12 shrink-0 items-center justify-center rounded-full bg-white/15">
          <Camera className="h-5 w-5 md:h-6 md:w-6" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="inline-block rounded-full bg-white/20 px-2 py-0.5 text-[10px] md:text-[11px] font-bold tracking-wider">
            FOR CREATORS
          </span>
          <span className="mt-1 block text-base md:text-lg font-extrabold leading-snug">
            Love BITE ME? Earn With Us! 🐾
          </span>
          <span className="mt-0.5 block text-xs md:text-sm leading-snug text-white/90">
            Join our Affiliate Program &amp; earn{" "}
            <span className="inline-block whitespace-nowrap rounded-full bg-white px-2 py-0.5 align-middle text-[10px] md:text-xs font-extrabold text-orange-600">
              10% commission
            </span>
          </span>
        </span>

        <span className="hidden sm:inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-orange-600 transition-transform group-hover:translate-x-0.5">
          Join Now <ArrowRight className="h-4 w-4" />
        </span>
        <ArrowRight className="sm:hidden h-5 w-5 shrink-0 text-white/80" />
      </Link>
    </section>
  );
}
