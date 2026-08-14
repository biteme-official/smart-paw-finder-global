import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

// TODO(design): swap this gradient placeholder for the real brand photo once the asset is ready (Issue #107)
export function BrandShowcaseMobile() {
  return (
    <section className="md:hidden mt-8 mb-8">
      <div className="relative w-full h-[240px] overflow-hidden bg-gradient-to-br from-orange-200 via-orange-100 to-amber-50">
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
          <p className="text-2xl font-bold text-foreground tracking-tight">BITE ME</p>
          <p className="text-sm text-muted-foreground mt-2">
            Thoughtfully made goods for every walk, nap, and playtime
          </p>
          <Button asChild size="sm" className="mt-4">
            <Link to="/about">Our Story</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
