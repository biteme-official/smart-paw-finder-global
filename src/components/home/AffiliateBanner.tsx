import { Link } from "react-router-dom";
import { Megaphone, ChevronRight } from "lucide-react";

export function AffiliateBanner() {
  return (
    <section className="mt-6 px-4">
      <Link
        to="/affiliate"
        className="group flex items-center gap-4 rounded-2xl bg-orange-500 px-5 py-4 text-white shadow-sm transition-colors hover:bg-orange-600"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
          <Megaphone className="h-5 w-5" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="mb-1 inline-block rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium tracking-wide">
            Launch Campaign
          </span>
          <span className="block truncate text-sm font-bold md:text-base">
            Affiliate Program&nbsp;|&nbsp;10% Commission
          </span>
          <span className="hidden truncate text-xs text-white/85 md:block">
            Share BITE ME on Instagram and earn together
          </span>
        </span>

        <ChevronRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </section>
  );
}
