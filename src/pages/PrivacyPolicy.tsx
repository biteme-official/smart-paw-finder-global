import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { IS_B2C_SITE } from "@/lib/site";

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="bg-background min-h-screen flex flex-col">
      <Header onSearch={(q) => navigate(q ? `/?q=${encodeURIComponent(q)}` : "/")} />

      <main className="max-w-6xl mx-auto px-6 py-8 flex-1">
        <h1 className="text-2xl font-bold mb-6">Privacy Policy</h1>
        <div className="prose prose-sm max-w-none text-muted-foreground space-y-6">

          <p className="text-sm text-muted-foreground">Last updated: {IS_B2C_SITE ? "November 23, 2026" : "June 8, 2026"}</p>

          <section>
            <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">1. Introduction</h2>
            <p>
              BITE ME ("Company") is committed to protecting your personal information.
              This Privacy Policy describes how we collect, use, and safeguard your data
              when you use our website and services ("Service").
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">2. Information We Collect</h2>
            <h3 className="text-base font-medium text-foreground mt-4 mb-2">2.1 Information you provide directly</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Name</li>
              <li>Email address</li>
              <li>Shipping address</li>
              <li>Phone number</li>
              <li>Payment information</li>
            </ul>
            <h3 className="text-base font-medium text-foreground mt-4 mb-2">2.2 Automatically collected information</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>IP address</li>
              <li>Browser type</li>
              <li>Access date and time</li>
              <li>Pages visited</li>
              <li>Cookie data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Processing and delivering orders</li>
              <li>Managing your account</li>
              <li>Providing customer support</li>
              <li>Sending product updates and promotions (with your consent)</li>
              <li>Improving and analyzing the Service</li>
              <li>Preventing fraud and misuse</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">4. Sharing Your Information</h2>
            <p>We do not sell your personal information. We may share it only in the following cases:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>With your consent</li>
              <li>With shipping carriers to fulfill delivery</li>
              <li>With payment processors to complete transactions</li>
              <li>As required by law</li>
              <li>With service providers necessary to operate the Service (e.g., Shopify)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">5. Cookies</h2>
            <p>
              We use cookies to enhance your experience and analyze site traffic.
              You may disable cookies in your browser settings, though some features may not function properly.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">6. Data Security</h2>
            <p>
              We implement appropriate technical and organizational measures — including SSL encryption
              and access controls — to protect your personal information from loss, misuse, or unauthorized access.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">7. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Request access to, correction of, or deletion of your personal data</li>
              <li>Request restriction of processing</li>
              <li>Opt out of marketing communications</li>
            </ul>
            <p className="mt-2">To exercise these rights, please contact us using the details below.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">8. Children's Privacy</h2>
            <p>
              We do not knowingly collect personal information from children under 16.
              If you believe a child has provided us with their data, please contact us and we will promptly delete it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy as needed. Significant changes will be communicated via the Service.
            </p>
          </section>

          {/* 어필리에이트 프로그램 — B2C 사이트만 (재무·법무 확정 문구, 2026-11-23) */}
          {IS_B2C_SITE && (
            <section id="affiliate-program">
              <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">10. Affiliate Program</h2>
              <p>
                When you visit our site through an affiliate link, we store the affiliate's referral ID in your browser using
                cookies or similar technologies (such as local storage) for up to 30 days so that qualifying purchases can be
                attributed to that affiliate. Affiliates see only limited order information needed to verify commissions
                (such as order date and amount) and do not receive your contact or payment details.
              </p>
              <p className="mt-2">
                If you join our Affiliate Program, we collect your name, email address, country of residence, postal address,
                PayPal account and, where required, tax information. We use this information to manage your participation,
                calculate and pay commissions, and meet our legal and tax obligations. We process it to perform our agreement
                with you and to comply with legal obligations.
              </p>
              <p className="mt-2">
                Your information is stored on our own systems and processed by service providers that help us operate our
                website and store records (such as hosting and cloud storage providers), and payment details are shared with
                PayPal to process payouts. Because we are based in the Republic of Korea, your information may be transferred
                to and processed in Korea and other countries where these providers operate, with appropriate safeguards in place.
              </p>
              <p className="mt-2">
                We retain this information for 5 years after your last payout, or, if you never received a payout, for 1 year
                after you leave the program, unless a longer period is required by law. You can exercise your rights as
                described in the "Your Rights" section of this policy.
              </p>
            </section>
          )}

          <section>
            <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">{IS_B2C_SITE ? 11 : 10}. Contact</h2>
            <p>
              For questions about this Privacy Policy, please visit our{" "}
              <a href="/contact" className="text-primary hover:underline">Contact Us</a> page.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
