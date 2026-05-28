import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Footer } from "@/components/layout/Footer";
import biteMeLogo from "@/assets/bite-me-logo.png";

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="bg-background min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="flex items-center gap-2 px-4 h-14">
          <button onClick={() => navigate(-1)} className="p-1 text-foreground">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={() => navigate("/")} className="hover:opacity-80 transition-opacity">
            <img src={biteMeLogo} alt="BITE ME" className="h-[17px]" />
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 flex-1">
        <h1 className="text-2xl font-bold mb-6">Privacy Policy</h1>
        <div className="prose prose-sm max-w-none text-muted-foreground space-y-6">

          <p className="text-sm text-muted-foreground">Last updated: March 18, 2026</p>

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

          <section>
            <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">10. Contact</h2>
            <p>For questions about this Privacy Policy, please contact us:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Email: <a href="mailto:mates@biteme.co.kr" className="text-primary hover:underline">mates@biteme.co.kr</a></li>
              <li>Phone: <a href="tel:+827048886191" className="text-primary hover:underline">+82 70-4888-6191</a></li>
              <li>Address: 8F, 10 Teheran-ro 20-gil, Gangnam-gu, Seoul, Republic of Korea (Three M Tower, Yeoksam-dong)</li>
            </ul>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
