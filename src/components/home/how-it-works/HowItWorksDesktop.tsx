import { STEP_DEFS } from "./howItWorksData";

export function HowItWorksDesktop() {
  return (
    <section className="hidden md:block mt-16 px-4">
      <h2 className="text-xl font-bold text-foreground text-center mb-10">How It Works</h2>
      <div className="flex items-stretch gap-3 max-w-7xl mx-auto">
        {STEP_DEFS.map(({ icon: Icon, lines }) => (
          <div key={lines.join()} className="flex flex-col items-center text-center gap-1.5 flex-1 rounded-xl border border-border py-8 px-4">
            <Icon className="h-8 w-8 text-foreground mb-1" strokeWidth={1.25} />
            <p className="text-base font-bold text-foreground">{lines[0]}</p>
            <p className="text-sm text-muted-foreground">{lines[1]}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
