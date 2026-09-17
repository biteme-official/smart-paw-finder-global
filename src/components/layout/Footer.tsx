import { useState } from "react";
import { Link } from "react-router-dom";

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
  { label: "B2B Inquiry", to: "/mypage/b2b-apply" },
];

const COMPANY_LINKS = [
  { label: "About Us", to: "/about" },
  { label: "Affiliate Program", to: "/affiliate" },
  { label: "Terms of Use", to: "/terms" },
  { label: "Privacy Policy", to: "/privacy" },
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

function AccordionSection({ title, links }: { title: string; links: { label: string; to: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-zinc-800">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between py-3.5"
      >
        <span className="text-xs font-semibold text-white uppercase tracking-wide">{title}</span>
        <span className="text-white text-base leading-none">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <ul className="pb-3.5 space-y-1.5">
          {links.map(({ label, to }, i) => (
            <li key={`${to}-${i}`}>
              <Link to={to} className="text-xs text-zinc-500 hover:text-white transition-colors">
                {label}
              </Link>
            </li>
          ))}
        </ul>
      )}
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
          CEO: Jaeeun Kwak
          <br />
          Business Registration No.: 210-87-00613
          <br />
          Mail-order Business Report No.: 2019-SeoulGangnam-05372
          <br />
          8F, 10 Teheran-ro 20-gil, Gangnam-gu,
          <br />
          Seoul, Korea
        </p>
      </div>
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-white uppercase tracking-wide">Contact us</p>
        <p className="text-xs text-zinc-500 leading-relaxed">
          Tel: +82 70-4888-6191
          <br />
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

export function Footer() {
  return (
    <footer className="bg-zinc-900 text-white mt-auto">
      <div className="w-full max-w-6xl mx-auto px-6 pt-10 pb-8">
        {/* Desktop/tablet: all sections always expanded, side by side */}
        <div className="hidden md:grid grid-cols-2 lg:grid-cols-[repeat(4,auto)] gap-8">
          <NavColumn title="Shop" links={SHOP_LINKS} />
          <NavColumn title="Support" links={SUPPORT_LINKS} />
          <NavColumn title="Company" links={COMPANY_LINKS} />
          <AboutContactColumn />
        </div>

        {/* Mobile: About us/Contact us stay expanded, link lists collapse into an accordion */}
        <div className="md:hidden space-y-6">
          <AboutContactColumn />
          <div>
            <AccordionSection title="Shop" links={SHOP_LINKS} />
            <AccordionSection title="Support" links={SUPPORT_LINKS} />
            <AccordionSection title="Company" links={COMPANY_LINKS} />
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
