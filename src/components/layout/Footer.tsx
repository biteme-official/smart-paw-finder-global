import { Mail, MapPin, Clock } from "lucide-react";
import { Link } from "react-router-dom";

const NAV_LINKS = [
  { label: "Shop", to: "/" },
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
    <footer className="text-white mt-auto" style={{ backgroundColor: "#c84a1a" }}>
      <div className="container mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row gap-10 md:gap-16">

          {/* Left — Brand + Contact */}
          <div className="shrink-0 space-y-5">
            <p className="text-lg font-bold tracking-wide">BITE ME</p>

            <ul className="space-y-3 text-sm text-white/90">
              <li>
                <a href="mailto:mates@biteme.co.kr"
                  className="flex items-center gap-3 hover:text-white transition-colors">
                  <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    <Mail className="h-4 w-4" />
                  </span>
                  mates@biteme.co.kr
                </a>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="h-4 w-4" />
                </span>
                <span>8F, 10 Teheran-ro 20-gil, Gangnam-gu,<br />Seoul, Republic of Korea</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <Clock className="h-4 w-4" />
                </span>
                Mon – Fri: 10:00 am – 7:00 pm KST
              </li>
            </ul>
          </div>

          {/* Right — Nav links grid */}
          <div className="flex-1">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-3">
              {NAV_LINKS.map(({ label, to }) => (
                <Link
                  key={to}
                  to={to}
                  className="text-sm text-white/80 hover:text-white transition-colors"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

        </div>

        <div className="mt-8 pt-6 border-t border-white/20 text-xs text-white/70">
          © 2026 BITE ME. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
