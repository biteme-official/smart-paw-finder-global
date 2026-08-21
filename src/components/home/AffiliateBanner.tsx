import { Link } from "react-router-dom";
import { Camera, ArrowRight } from "lucide-react";

export function AffiliateBanner() {
  return (
    <section className="mt-6 px-4">
      <Link
        to="/affiliate"
        className="group flex items-center gap-3 rounded-2xl bg-orange-500 px-4 py-4 text-white shadow-sm transition-all hover:bg-orange-600 hover:shadow-md md:gap-4 md:px-6 md:py-5"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 md:h-12 md:w-12">
          <Camera className="h-5 w-5 md:h-6 md:w-6" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="inline-block rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold tracking-wider md:text-[11px]">
            FOR CREATORS
          </span>
          <span className="mt-1 block text-sm font-extrabold leading-snug md:text-lg">
            Love BITE ME? Earn With Us! 🐾
          </span>
          <span className="mt-0.5 block text-xs leading-snug text-white/90 md:text-sm">
            Join our Affiliate Program &amp; earn{" "}
            <span className="inline-block whitespace-nowrap rounded-full bg-white px-2 py-0.5 align-middle text-[11px] font-extrabold text-orange-600 md:text-xs">
              10% commission
            </span>
          </span>
        </span>

        <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-orange-600 transition-transform group-hover:translate-x-0.5 md:inline-flex">
          Join Now <ArrowRight className="h-4 w-4" />
        </span>
        <ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5 md:hidden" />
      </Link>
    </section>
  );
}
