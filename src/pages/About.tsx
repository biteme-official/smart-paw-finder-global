import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Mail, MapPin, Clock, ShieldCheck, Sparkles, BadgePercent, Heart } from "lucide-react";

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
          <h1 className="text-3xl md:text-5xl font-bold text-foreground leading-tight mb-6">
            Making every day<br />meaningful — together.
          </h1>
          <p className="text-muted-foreground leading-relaxed max-w-xl mx-auto">
            Pets age six times faster than we do. BITE ME exists to make every one of those days count —
            with products designed to bring joy, health, and comfort to dogs and their people around the world.
          </p>
        </section>

        {/* Mission */}
        <section className="bg-zinc-50 py-14 md:py-20">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center mb-2">Our Missions</h2>
            <p className="text-muted-foreground text-center text-sm mb-12">The four values that guide everything we do.</p>
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

        {/* Policies */}
        <section className="max-w-4xl mx-auto px-6 py-14 md:py-20">
          <h2 className="text-2xl font-bold text-foreground mb-8">Our Policies</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
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

        {/* Business Info */}
        <section className="bg-zinc-50 py-14">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-2xl font-bold text-foreground mb-8">Business Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
              <ul className="space-y-4 text-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <MapPin className="h-4 w-4 text-primary" />
                  </span>
                  <span>
                    <span className="block font-medium text-foreground">BITE ME Co., Ltd.</span>
                    8F, 10 Teheran-ro 20-gil, Gangnam-gu,<br />Seoul, Republic of Korea
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Mail className="h-4 w-4 text-primary" />
                  </span>
                  <a href="mailto:mates@biteme.co.kr" className="hover:text-foreground transition-colors">
                    mates@biteme.co.kr
                  </a>
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Clock className="h-4 w-4 text-primary" />
                  </span>
                  <span>Monday – Friday: 10:00 am – 7:00 pm KST</span>
                </li>
              </ul>

              <dl className="space-y-3 text-muted-foreground">
                <div className="flex gap-2">
                  <dt className="font-medium text-foreground w-44 shrink-0">Founded</dt>
                  <dd>2020</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-medium text-foreground w-44 shrink-0">CEO</dt>
                  <dd>Jaeeun Gwak</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-medium text-foreground w-44 shrink-0">Business Registration</dt>
                  <dd>210-87-00613</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-medium text-foreground w-44 shrink-0">E-Commerce Report</dt>
                  <dd>2019-Seoul Gangnam-05372</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
