import { Mail, MapPin, Clock } from "lucide-react";
import { Link } from "react-router-dom";

const NAV_LINKS = [
  { label: "Shop", to: "/" },
  { label: "About", to: "/about" },
  { label: "B2B Inquiry", to: "/mypage/b2b-apply" },
  { label: "Popup Stores", to: "/popup-offline-stores" },
  { label: "Contact Us", to: "/contact" },
  { label: "New Arrivals", to: "/new-products" },
  { label: "Shipping & Returns", to: "/refund-policy" },
  { label: "Privacy Policy", to: "/privacy" },
  { label: "Terms of Use", to: "/terms" },
];

export function Footer() {
  return (
    <footer className="bg-zinc-100 text-foreground mt-auto">
      <div className="w-full max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-col lg:flex-row gap-10 lg:gap-20">

          {/* Left — Brand + Contact */}
          <div className="shrink-0 space-y-5">
            <p className="text-lg font-bold tracking-wide text-foreground">BITE ME</p>

            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>
                <a href="mailto:mates@biteme.co.kr"
                  className="flex items-center gap-3 hover:text-foreground transition-colors">
                  <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Mail className="h-4 w-4 text-primary" />
                  </span>
                  mates@biteme.co.kr
                </a>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="h-4 w-4 text-primary" />
                </span>
                <span>8F, 10 Teheran-ro 20-gil, Gangnam-gu,<br />Seoul, Republic of Korea</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Clock className="h-4 w-4 text-primary" />
                </span>
                Mon – Fri: 10:00 am – 7:00 pm KST
              </li>
            </ul>
          </div>

          {/* Right — Nav links grid */}
          <div className="flex-1 min-w-0">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
              {NAV_LINKS.map(({ label, to }) => (
                <Link
                  key={to}
                  to={to}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

        </div>

        <div className="mt-8 pt-6 border-t border-border text-xs text-muted-foreground">
          © 2026 BITE ME. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
