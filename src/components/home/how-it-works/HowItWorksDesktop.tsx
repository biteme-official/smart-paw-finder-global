import { ArrowRight } from "lucide-react";
import { STEP_DEFS } from "./howItWorksData";

export function HowItWorksDesktop() {
  return (
    <section className="hidden md:block mt-24 px-4">
      <h2 className="text-xl font-bold text-foreground text-center mb-10">How It Works</h2>
      <div className="flex items-stretch gap-3">
        {STEP_DEFS.map(({ icon: Icon, lines }, index) => (
          <div key={lines.join()} className="flex items-stretch flex-1 gap-3">
            <div className="flex flex-col items-center text-center gap-3 flex-1 rounded-xl border border-border py-8 px-4">
              <Icon className="h-8 w-8 text-foreground" strokeWidth={1.5} />
              <p className="text-base font-bold text-foreground">{lines[0]}</p>
              <p className="text-sm text-muted-foreground">{lines[1]}</p>
            </div>
            {index < STEP_DEFS.length - 1 && (
              <ArrowRight className="h-5 w-5 text-muted-foreground self-center shrink-0" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
