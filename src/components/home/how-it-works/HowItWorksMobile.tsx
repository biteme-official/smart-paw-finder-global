import { STEP_DEFS } from "./howItWorksData";

export function HowItWorksMobile() {
  return (
    <section className="md:hidden mt-8 px-4">
      <h2 className="text-lg font-bold text-foreground mb-4">How It Works</h2>
      <div className="space-y-3">
        {STEP_DEFS.map(({ lines }, index) => (
          <div key={lines.join()} className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3">
            <span className="flex items-center justify-center h-9 w-9 shrink-0 rounded-full bg-orange-100 text-primary font-bold text-sm">
              {index + 1}
            </span>
            <p className="text-sm font-semibold text-foreground">
              {lines[0]} {lines[1]}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
