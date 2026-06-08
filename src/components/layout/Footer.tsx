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

      {/* Company info section */}
      <div className="w-full max-w-6xl mx-auto px-6 py-6 border-t border-border">
        <p className="text-sm font-semibold text-foreground mb-2">BITE ME</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          CEO: Jaeeun Kwak{" "}
          <span className="mx-1 text-zinc-300">|</span>
          Business Registration No.: 210-87-00613{" "}
          <span className="mx-1 text-zinc-300">|</span>
          Mail-order Business Report No.: 2019-SeoulGangnam-05372
        </p>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
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
