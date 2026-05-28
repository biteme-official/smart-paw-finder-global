import { Mail, MapPin, Clock } from "lucide-react";
import { Link } from "react-router-dom";

const WHATSAPP_NUMBER = "15559433437";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hi BITE ME! I have a question and would like some help.")}`;

const WhatsAppIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const NAV_LINKS = [
  { label: "Shop", to: "/" },
  { label: "New Arrivals", to: "/new-products" },
  { label: "B2B Inquiry", to: "/mypage/b2b-apply" },
  { label: "Popup Stores", to: "/popup-offline-stores" },
  { label: "Contact Us", to: "/contact" },
  { label: "Shipping & Returns", to: "/refund-policy" },
  { label: "Privacy Policy", to: "/privacy" },
  { label: "Terms of Use", to: "/terms" },
];

export function Footer() {
  return (
    <footer className="bg-zinc-900 text-white mt-auto">
      <div className="container mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row gap-10 md:gap-16">

          {/* Left — Brand + Contact */}
          <div className="shrink-0 space-y-5">
            <p className="text-lg font-bold tracking-wide">BITE ME</p>

            <ul className="space-y-3 text-sm text-zinc-300">
              <li>
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 hover:text-white transition-colors">
                  <span className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center shrink-0">
                    <WhatsAppIcon />
                  </span>
                  WhatsApp (Fastest response)
                </a>
              </li>
              <li>
                <a href="mailto:mates@biteme.co.kr"
                  className="flex items-center gap-3 hover:text-white transition-colors">
                  <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                    <Mail className="h-4 w-4" />
                  </span>
                  mates@biteme.co.kr
                </a>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="h-4 w-4" />
                </span>
                <span>8F, 10 Teheran-ro 20-gil, Gangnam-gu,<br />Seoul, Republic of Korea</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
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
                  className="text-sm text-zinc-400 hover:text-white transition-colors"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

        </div>

        <div className="mt-8 pt-6 border-t border-white/10 text-xs text-zinc-500">
          © 2026 BITE ME. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
