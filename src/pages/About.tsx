import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ShieldCheck, Sparkles, BadgePercent, Heart } from "lucide-react";

const SOCIAL_LINKS = [
  { label: "Official",  platform: "Instagram", href: "https://www.instagram.com/biteme.co.kr/" },
  { label: "Japan",     platform: "Instagram", href: "https://www.instagram.com/biteme_jp/"    },
  { label: "Global",    platform: "Instagram", href: "https://www.instagram.com/biteme_global/" },
  { label: "TikTok",   platform: "TikTok",    href: "https://www.tiktok.com/@biteme.co.kr"    },
  { label: "YouTube",  platform: "YouTube",   href: "https://www.youtube.com/@biteme.official" },
];

function SocialIcon({ platform }: { platform: string }) {
  if (platform === "Instagram") return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
  if (platform === "TikTok") return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z" />
    </svg>
  );
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 00-1.95 1.96A29 29 0 001 12a29 29 0 00.46 5.58 2.78 2.78 0 001.95 1.95C5.12 20 12 20 12 20s6.88 0 8.59-.47a2.78 2.78 0 001.95-1.95A29 29 0 0023 12a29 29 0 00-.46-5.58z" />
      <polygon points="9.75,15.02 15.5,12 9.75,8.98" fill="white" />
    </svg>
  );
}

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
          <h1 className="text-3xl md:text-5xl font-bold text-foreground tracking-wide mb-6">
            <span className="block mb-3">Making every day</span>
            <span className="block">meaningful — together.</span>
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

        <div className="border-t border-zinc-200 max-w-5xl mx-auto" />

        {/* Social Media */}
        <section className="max-w-4xl mx-auto px-6 py-10 md:py-14 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">Social Media</h2>
          <p className="text-sm text-muted-foreground mb-10">Check out more about our brand</p>
          <div className="flex justify-center items-start gap-8">
            {SOCIAL_LINKS.map(({ label, platform, href }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-2 group"
              >
                <span className="w-12 h-12 rounded-full bg-zinc-400 group-hover:bg-zinc-500 transition-colors flex items-center justify-center text-white">
                  <SocialIcon platform={platform} />
                </span>
                <span className="text-xs text-muted-foreground">{label}</span>
              </a>
            ))}
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
