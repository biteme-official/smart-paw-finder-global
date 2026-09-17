import { STEP_DEFS } from "./howItWorksData";

export function HowItWorksMobile() {
  return (
    <section className="md:hidden px-4">
      <h2 className="text-lg font-bold text-foreground mb-8 text-center">How It Works</h2>
      <div className="grid grid-cols-2 gap-3">
        {STEP_DEFS.map(({ icon: Icon, lines }) => (
          <div key={lines.join()} className="flex flex-col items-center text-center gap-1 rounded-xl border border-border py-5 px-3">
            <Icon className="h-7 w-7 text-foreground mb-0.5" strokeWidth={1.25} />
            <p className="text-sm font-bold text-foreground">{lines[0]}</p>
            <p className="text-xs text-muted-foreground">{lines[1]}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
