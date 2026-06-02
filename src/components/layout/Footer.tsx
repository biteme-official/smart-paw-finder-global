import { Link } from "react-router-dom";

function MastercardIcon() {
  return (
    <svg viewBox="0 0 38 24" className="h-4 w-auto" aria-label="Mastercard">
      <circle cx="14" cy="12" r="9" fill="#555" />
      <circle cx="24" cy="12" r="9" fill="#888" />
      <path d="M19 5.3a9 9 0 0 1 0 13.4A9 9 0 0 1 19 5.3z" fill="#666" />
    </svg>
  );
}

function PayPalIcon() {
  return (
    <svg viewBox="0 0 40 16" className="h-4 w-auto" aria-label="PayPal">
      <text x="1" y="13" fontSize="12" fontStyle="italic" fontWeight="700" fill="#444" fontFamily="Arial, sans-serif">PayPal</text>
    </svg>
  );
}

const BRAND_LINKS = [
  { label: "About Us", to: "/about" },
  { label: "Popup Stores", to: "/popup-offline-stores" },
  { label: "Blog", to: "/blog" },
];

const POLICY_LINKS = [
  { label: "Terms of Use", to: "/terms" },
  { label: "Shipping & Returns", to: "/refund-policy" },
  { label: "Privacy Policy", to: "/privacy" },
];

const HELP_LINKS = [
  { label: "Contact Us", to: "/contact" },
  { label: "B2B Inquiry", to: "/mypage/b2b-apply" },
];

const TEXT_PAYMENT_METHODS = [
  { name: "VISA",      style: "font-black italic tracking-widest text-sm"  },
  { name: "AMEX",      style: "font-bold text-xs tracking-wide"            },
  { name: "JCB",       style: "font-bold text-xs"                          },
  { name: "UnionPay",  style: "font-semibold text-xs"                      },
  { name: "Discover",  style: "font-semibold text-xs"                      },
];

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z" />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 00-1.95 1.96A29 29 0 001 12a29 29 0 00.46 5.58 2.78 2.78 0 001.95 1.95C5.12 20 12 20 12 20s6.88 0 8.59-.47a2.78 2.78 0 001.95-1.95A29 29 0 0023 12a29 29 0 00-.46-5.58z" />
      <polygon points="9.75,15.02 15.5,12 9.75,8.98" fill="white" />
    </svg>
  );
}

const SOCIAL_LINKS = [
  { label: "Official",  icon: <InstagramIcon />, href: "https://www.instagram.com/biteme.co.kr/" },
  { label: "Japan",     icon: <InstagramIcon />, href: "https://www.instagram.com/biteme_jp/"   },
  { label: "Global",    icon: <InstagramIcon />, href: "https://www.instagram.com/biteme_global/" },
  { label: "TikTok",   icon: <TikTokIcon />,    href: "https://www.tiktok.com/@biteme.co.kr"    },
  { label: "YouTube",  icon: <YouTubeIcon />,   href: "https://www.youtube.com/@biteme.official" },
];

function NavColumn({ title, links }: { title: string; links: { label: string; to: string }[] }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <ul className="space-y-2">
        {links.map(({ label, to }) => (
          <li key={to}>
            <Link to={to} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="bg-zinc-100 text-foreground mt-auto">

      {/* Main nav section */}
      <div className="w-full max-w-6xl mx-auto px-6 pt-10 pb-8">
        <div className="grid grid-cols-3 gap-8">

          {/* Brand column */}
          <div className="space-y-3">
            <p className="text-sm font-bold tracking-wide text-foreground">BITE ME</p>
            <ul className="space-y-2">
              {BRAND_LINKS.map(({ label, to }) => (
                <li key={to}>
                  <Link to={to} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <NavColumn title="Terms & Policies" links={POLICY_LINKS} />
          <NavColumn title="Help" links={HELP_LINKS} />
        </div>
      </div>

      {/* Social Media section */}
      <div className="w-full max-w-6xl mx-auto px-6 py-6 border-t border-border">
        <p className="text-xs font-semibold text-muted-foreground mb-0.5">Social Media</p>
        <p className="text-xs text-muted-foreground mb-4">Check out more about our brand</p>
        <div className="flex items-start gap-5">
          {SOCIAL_LINKS.map(({ label, icon, href }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 group"
            >
              <span className="w-10 h-10 rounded-full bg-zinc-400 group-hover:bg-zinc-500 transition-colors flex items-center justify-center text-white">
                {icon}
              </span>
              <span className="text-xs text-muted-foreground">{label}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Company info section */}
      <div className="w-full max-w-6xl mx-auto px-6 py-6 border-t border-border">
        <p className="text-sm font-semibold text-foreground mb-2">BITE ME</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Tel: +82 70-4888-6191{" "}
          <span className="mx-1 text-zinc-300">|</span>
          E-mail: mates@biteme.co.kr{" "}
          <span className="mx-1 text-zinc-300">|</span>
          Mon – Fri: 10:00 am – 7:00 pm KST
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          8F, 10 Teheran-ro 20-gil, Gangnam-gu, Seoul, Republic of Korea
        </p>
      </div>

      {/* Payment methods + Copyright */}
      <div className="border-t border-border bg-zinc-200/50">
        <div className="w-full max-w-6xl mx-auto px-6 py-4">
          <div className="flex flex-wrap items-center gap-2.5 mb-3">
            <span className="text-xs font-medium text-muted-foreground mr-2 shrink-0">Payment Method</span>

            {/* PayPal */}
            <span className="inline-flex items-center h-5">
              <PayPalIcon />
            </span>

            {/* Mastercard */}
            <span className="inline-flex items-center h-5">
              <MastercardIcon />
            </span>

            {/* Text-based logos */}
            {TEXT_PAYMENT_METHODS.map(({ name, style }) => (
              <span
                key={name}
                className={`inline-flex items-center justify-center text-zinc-600 ${style}`}
              >
                {name}
              </span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">© 2026 BITE ME. All rights reserved.</p>
        </div>
      </div>

    </footer>
  );
}
