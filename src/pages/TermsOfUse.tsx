import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Footer } from "@/components/layout/Footer";
import biteMeLogo from "@/assets/bite-me-logo.png";

export default function TermsOfUse() {
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
        <h1 className="text-2xl font-bold mb-6">Terms of Use</h1>
        <div className="prose prose-sm max-w-none text-muted-foreground space-y-6">

          <p className="text-sm text-muted-foreground">Last updated: June 2, 2026</p>

          <section>
            <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">Applicability</h2>
            <p>
              These Terms of Use ("Terms") govern the use of the online shopping service ("Service")
              provided by BITE ME ("Company"). By using the Service, you agree to these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">Account Registration</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>Some features of the Service require account registration.</li>
              <li>You are responsible for keeping your account information accurate and up to date.</li>
              <li>The Company may refuse or revoke registration if false information is provided, these Terms are violated, or the Company deems it otherwise inappropriate.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">Purchases</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>You may purchase products by following the prescribed procedures on the Service.</li>
              <li>A purchase contract is formed when the Company confirms your order and sends an order confirmation.</li>
              <li>Prices displayed on the Service are inclusive of applicable taxes.</li>
              <li>Shipping fees vary by order content and destination and are displayed at the time of checkout.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">Payment</h2>
            <p className="mb-3">We accept the following payment methods:</p>
            <ul className="list-disc pl-5 space-y-2 mb-3">
              <li>
                <strong className="text-foreground">PayPal</strong> — Pay securely with your PayPal account or linked card.
              </li>
              <li>
                <strong className="text-foreground">Eximbay (Global Payment Gateway)</strong> — Supports major international credit and debit cards including Visa, Mastercard, JCB, American Express, UnionPay, and Discover, as well as global digital wallets such as Grab Pay and LINE Pay.
              </li>
              <li>
                <strong className="text-foreground">Bank Deposit</strong> — Direct bank transfer. Order details and account information will be provided upon checkout. Orders are processed once payment is confirmed.
              </li>
            </ul>
            <p>All transactions are secure and encrypted. Any disputes related to payment are subject to the terms of the relevant payment provider.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">Prohibited Activities</h2>
            <p>The following activities are prohibited when using the Service:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Actions that violate applicable laws or public order</li>
              <li>Infringement of the Company's or third parties' rights</li>
              <li>Unauthorized access or placing excessive load on the system</li>
              <li>Registering false information</li>
              <li>Bulk purchasing for the purpose of resale</li>
              <li>Any other actions the Company deems inappropriate</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">Intellectual Property</h2>
            <p>
              All content on the Service (images, text, logos, designs, etc.) is owned by the Company
              or its licensors. Reproduction, redistribution, or reuse without prior written consent is prohibited.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">Disclaimer</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>The Company makes no warranties regarding the accuracy, completeness, or usefulness of the Service content.</li>
              <li>The Company is not liable for temporary service interruptions due to system maintenance or failures.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">Changes to Terms</h2>
            <p>
              The Company may update these Terms as needed. Updated Terms take effect upon publication on the Service.
              Users will be notified of significant changes via appropriate means.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">Contact</h2>
            <p>
              For inquiries regarding these Terms, please visit our{" "}
              <a href="/contact" className="text-primary hover:underline">Contact Us</a> page.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
