import { Link } from "react-router-dom";
import { Camera, ArrowRight } from "lucide-react";

export function AffiliateBanner() {
  return (
    <section className="mt-4 md:mt-6 px-4">
      <Link
        to="/affiliate"
        className="group flex items-center gap-2.5 md:gap-4 rounded-2xl bg-orange-500 px-3.5 py-2.5 md:px-6 md:py-5 text-white shadow-sm transition-all hover:bg-orange-600 hover:shadow-md"
      >
        <span className="flex h-9 w-9 md:h-12 md:w-12 shrink-0 items-center justify-center rounded-full bg-white/15">
          <Camera className="h-[18px] w-[18px] md:h-6 md:w-6" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="inline-block rounded-full bg-white/20 px-2 py-0.5 text-[10px] md:text-[11px] font-bold tracking-wider">
            FOR CREATORS
          </span>
          <span className="mt-0.5 block text-[13px] leading-tight md:mt-1 md:text-lg font-extrabold">
            Love BITE ME? Earn With <span className="whitespace-nowrap">Us! 🐾</span>
          </span>
          {/* Mobile: compact single-line CTA */}
          <span className="mt-0.5 flex md:hidden items-center gap-1 text-[11px] font-bold leading-tight text-white/95">
            Earn 10% commission <ArrowRight className="h-3 w-3" />
          </span>
          {/* Desktop: full description with pill */}
          <span className="mt-0.5 hidden md:block text-sm leading-snug text-white/90">
            Join our Affiliate Program &amp; earn{" "}
            <span className="inline-block whitespace-nowrap rounded-full bg-white px-2 py-0.5 align-middle text-xs font-extrabold text-orange-600">
              10% commission
            </span>
          </span>
        </span>

        <span className="hidden md:inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-orange-600 transition-transform group-hover:translate-x-0.5">
          Join Now <ArrowRight className="h-4 w-4" />
        </span>
        <span className="md:hidden flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15">
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </Link>
    </section>
  );
}
