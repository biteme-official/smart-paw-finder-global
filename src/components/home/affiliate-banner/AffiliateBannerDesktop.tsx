import { Link } from "react-router-dom";
import { Camera, ArrowRight } from "lucide-react";

export function AffiliateBannerDesktop() {
  return (
    <section className="mt-6 px-4">
      <Link
        to="/affiliate"
        className="group flex items-center gap-4 rounded-2xl bg-orange-500 px-6 py-5 text-white shadow-sm transition-all hover:bg-orange-600 hover:shadow-md"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15">
          <Camera className="h-6 w-6" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="inline-block rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold tracking-wider">
            FOR CREATORS
          </span>
          <span className="mt-1 block text-lg font-extrabold leading-snug">
            Love BITE ME? Earn With Us! 🐾
          </span>
          <span className="mt-0.5 block text-sm leading-snug text-white/90">
            Join our Affiliate Program &amp; earn{" "}
            <span className="inline-block whitespace-nowrap rounded-full bg-white px-2 py-0.5 align-middle text-xs font-extrabold text-orange-600">
              10% commission
            </span>
          </span>
        </span>

        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-orange-600 transition-transform group-hover:translate-x-0.5">
          Join Now <ArrowRight className="h-4 w-4" />
        </span>
      </Link>
    </section>
  );
}
