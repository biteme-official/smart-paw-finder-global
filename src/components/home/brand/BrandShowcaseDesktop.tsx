import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

// TODO(design): swap this gradient placeholder for the real brand photo once the asset is ready (Issue #107)
export function BrandShowcaseDesktop() {
  return (
    <section className="hidden md:block mt-24 mb-24">
      <div className="relative w-full h-[360px] overflow-hidden bg-gradient-to-br from-orange-200 via-orange-100 to-amber-50">
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
          <p className="text-3xl font-bold text-foreground tracking-tight">BITE ME</p>
          <p className="text-base text-muted-foreground mt-2 max-w-md">
            Thoughtfully made goods for every walk, nap, and playtime
          </p>
          <Button asChild size="lg" className="mt-6">
            <Link to="/about">Our Story</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
