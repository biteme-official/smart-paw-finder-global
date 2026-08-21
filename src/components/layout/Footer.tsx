import { Link } from "react-router-dom";

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
  { label: "Affiliate Program", to: "/affiliate" },
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

      {/* Copyright */}
      <div className="border-t border-border bg-zinc-200/50">
        <div className="w-full max-w-6xl mx-auto px-6 py-3">
          <p className="text-xs text-muted-foreground">© 2026 BITE ME. All rights reserved.</p>
        </div>
      </div>

    </footer>
  );
}
