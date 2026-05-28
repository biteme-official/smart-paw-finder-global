import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ShieldCheck, Sparkles, BadgePercent, Heart } from "lucide-react";

const MISSIONS = [
  {
    icon: ShieldCheck,
    title: "Trustworthy Products",
    desc: "We carefully select every brand and product we carry — only recommending what we would confidently give to our own pets. Transparent processes and quality ingredients, always.",
  },
  {
    icon: Sparkles,
    title: "Personalized Curation",
    desc: "Every pet is unique. From hypoallergenic treats to size-varied accessories, BITE ME offers solutions tailored to each pet's individual needs.",
  },
  {
    icon: BadgePercent,
    title: "Fair Pricing",
    desc: "We believe great quality shouldn't come at an unreasonable price. Every product is priced so you can feel good about what you're getting.",
  },
  {
    icon: Heart,
    title: "Better Future for Animals",
    desc: "Through volunteer programs and adoption campaigns, we work to improve conditions for animals and help normalize pet adoption culture.",
  },
];

export default function About() {
  const navigate = useNavigate();

  const handleSearch = (query: string) => {
    navigate(query ? `/?q=${encodeURIComponent(query)}` : "/");
  };

  return (
    <div className="bg-background min-h-screen flex flex-col">
      <Header onSearch={handleSearch} />

      <main className="flex-1">

        {/* Hero */}
        <section className="max-w-3xl mx-auto px-6 py-14 md:py-20 text-center">
          <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-4">About BITE ME</p>
          <h1 className="text-3xl md:text-5xl font-bold text-foreground leading-loose tracking-wide mb-6">
            Making every day<br />meaningful — together.
          </h1>
          <p className="text-muted-foreground leading-relaxed max-w-xl mx-auto">
            Pets age six times faster than we do. BITE ME exists to make every one of those days count —
            with products designed to bring joy, health, and comfort to dogs and their people around the world.
          </p>
        </section>

        <div className="border-t border-zinc-200 max-w-5xl mx-auto" />

        {/* Mission */}
        <section className="bg-zinc-50 py-10 md:py-14">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center mb-2">Our Missions</h2>
            <p className="text-muted-foreground text-center text-sm mb-10">The four values that guide everything we do.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {MISSIONS.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="bg-card border border-border rounded-2xl p-6 flex gap-4">
                  <span className="shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                    <Icon className="h-5 w-5 text-primary" />
                  </span>
                  <div>
                    <p className="font-semibold text-foreground mb-1">{title}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="border-t border-zinc-200 max-w-5xl mx-auto" />

        {/* Policies */}
        <section className="max-w-4xl mx-auto px-6 py-10 md:py-14 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-8">Our Policies</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-left">
            <a href="/refund-policy" className="border border-border rounded-xl p-5 hover:border-primary/50 transition-colors group">
              <p className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">Shipping & Returns</p>
              <p className="text-muted-foreground">International shipping, return & refund policy.</p>
            </a>
            <a href="/privacy" className="border border-border rounded-xl p-5 hover:border-primary/50 transition-colors group">
              <p className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">Privacy Policy</p>
              <p className="text-muted-foreground">How we collect, use, and protect your data.</p>
            </a>
            <a href="/terms" className="border border-border rounded-xl p-5 hover:border-primary/50 transition-colors group">
              <p className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">Terms of Use</p>
              <p className="text-muted-foreground">Terms governing the use of our service.</p>
            </a>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
