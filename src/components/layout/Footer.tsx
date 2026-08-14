import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

const WHATSAPP_URL = "https://wa.me/15559433437";

const SHOP_LINKS = [
  { label: "Shop All", to: "/" },
  { label: "Best Sellers", to: "/" },
  { label: "New Arrivals", to: "/new-products" },
];

const SUPPORT_LINKS = [
  { label: "Shipping", to: "/refund-policy" },
  { label: "Returns", to: "/refund-policy" },
  { label: "FAQ", to: "/contact" },
];

const COMPANY_LINKS = [
  { label: "About Us", to: "/about" },
  { label: "Affiliate", to: "/contact" },
  { label: "Contact", to: "/contact" },
];

function NavColumn({ title, links }: { title: string; links: { label: string; to: string }[] }) {
  return (
    <div className="space-y-2.5">
      <p className="text-xs font-semibold text-white uppercase tracking-wide">{title}</p>
      <ul className="space-y-1.5">
        {links.map(({ label, to }, i) => (
          <li key={`${to}-${i}`}>
            <Link to={to} className="text-xs text-zinc-500 hover:text-white transition-colors">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AboutContactColumn() {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-white uppercase tracking-wide">About us</p>
        <p className="text-xs text-zinc-500 leading-relaxed">
          © BITE ME Co., Ltd.
          <br />
          8F, 10 Teheran-ro 20-gil, Gangnam-gu,
          <br />
          Seoul, Korea
        </p>
      </div>
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-white uppercase tracking-wide">Contact us</p>
        <p className="text-xs text-zinc-500 leading-relaxed">
          Business Inquiry: mates@biteme.co.kr
          <br />
          Consumer Inquiry:{" "}
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-white transition-colors">
            Chat with us on Whatsapp
          </a>
          <br />
          We're here M–F 10am – 7pm KST
        </p>
      </div>
    </div>
  );
}

function NewsletterSignup() {
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    toast.success("Thanks for subscribing! Stay tuned for updates.");
    setEmail("");
  };

  return (
    <div className="rounded-xl bg-zinc-800 p-4 md:w-64 shrink-0">
      <p className="text-xs font-semibold text-white mb-2.5">Sign up for 15% off your first order</p>
      <form onSubmit={handleSubmit} className="flex items-center gap-2 rounded-lg bg-zinc-900 pr-1">
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          className="h-9 text-xs border-0 bg-transparent text-white placeholder:text-zinc-500 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <button
          type="submit"
          aria-label="Sign up"
          className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Sign Up
        </button>
      </form>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="bg-zinc-900 text-white mt-auto">
      <div className="w-full max-w-6xl mx-auto px-6 pt-10 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(4,auto)_1fr] gap-8">
          <NavColumn title="Shop" links={SHOP_LINKS} />
          <NavColumn title="Support" links={SUPPORT_LINKS} />
          <NavColumn title="Company" links={COMPANY_LINKS} />
          <AboutContactColumn />
          <div className="lg:justify-self-end">
            <NewsletterSignup />
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-800">
        <div className="w-full max-w-6xl mx-auto px-6 py-4 text-center">
          <p className="text-xs text-zinc-500">© 2026 BITE ME. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
