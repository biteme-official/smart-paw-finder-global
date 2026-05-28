import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Mail, MapPin, Clock } from "lucide-react";

export default function About() {
  const navigate = useNavigate();

  const handleSearch = (query: string) => {
    navigate(query ? `/?q=${encodeURIComponent(query)}` : "/");
  };

  return (
    <div className="bg-background min-h-screen flex flex-col">
      <Header onSearch={handleSearch} />

      <main className="flex-1 max-w-3xl mx-auto px-6 py-12 md:py-20">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">About BITE ME</h1>
        <p className="text-muted-foreground mb-12 leading-relaxed">
          BITE ME is a premium K-Pet lifestyle brand based in Seoul, South Korea, dedicated to bringing joy to dogs and their owners around the world.
        </p>

        <section className="mb-12">
          <h2 className="text-xl font-semibold text-foreground mb-4">Our Story</h2>
          <div className="space-y-4 text-muted-foreground leading-relaxed">
            <p>
              Founded by a team of passionate pet lovers, BITE ME was born from a simple belief: pets deserve the best. We design and curate premium dog toys, healthy treats, and stylish pet supplies that combine Korean craftsmanship with modern sensibility.
            </p>
            <p>
              Every product in our collection is thoughtfully developed with the health, safety, and happiness of your pet in mind. From our bestselling nose-work playbooks to our signature treat lines, each item reflects our commitment to quality and fun.
            </p>
            <p>
              Today, BITE ME ships worldwide, bringing a piece of Seoul's vibrant pet culture to dog lovers everywhere.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-xl font-semibold text-foreground mb-4">Our Policies</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <a href="/refund-policy" className="border border-border rounded-xl p-4 hover:border-primary/50 transition-colors">
              <p className="font-semibold text-foreground mb-1">Shipping & Returns</p>
              <p className="text-muted-foreground">International shipping, return & refund policy.</p>
            </a>
            <a href="/privacy" className="border border-border rounded-xl p-4 hover:border-primary/50 transition-colors">
              <p className="font-semibold text-foreground mb-1">Privacy Policy</p>
              <p className="text-muted-foreground">How we collect, use, and protect your data.</p>
            </a>
            <a href="/terms" className="border border-border rounded-xl p-4 hover:border-primary/50 transition-colors">
              <p className="font-semibold text-foreground mb-1">Terms of Use</p>
              <p className="text-muted-foreground">Terms governing the use of our service.</p>
            </a>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Business Information</h2>
          <ul className="space-y-4 text-sm text-muted-foreground">
            <li className="flex items-start gap-3">
              <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <MapPin className="h-4 w-4 text-primary" />
              </span>
              <span>
                <span className="block font-medium text-foreground">BITE ME</span>
                8F, 10 Teheran-ro 20-gil, Gangnam-gu, Seoul, Republic of Korea
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
        </section>
      </main>

      <Footer />
    </div>
  );
}
