import { Navigate, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { IS_B2C_SITE } from "@/lib/site";

// 어필리에이트 이용약관 전문 — 재무·법무 확정본(2026-11-23, 슬랙 확정). B2C 사이트 전용
const H2 = "text-lg font-semibold text-foreground mt-6 mb-3";
const LINK = "text-primary hover:underline";

export default function AffiliateTerms() {
  const navigate = useNavigate();
  if (!IS_B2C_SITE) return <Navigate to="/terms" replace />;

  return (
    <div className="bg-background min-h-screen flex flex-col">
      <Header onSearch={(q) => navigate(q ? `/?q=${encodeURIComponent(q)}` : "/")} />

      <main className="max-w-6xl mx-auto px-5 md:px-6 py-8 flex-1">
        <h1 className="text-2xl font-bold mb-6">BITE ME Affiliate Program Terms</h1>
        <div className="prose prose-sm max-w-none text-muted-foreground space-y-6">
          <p className="text-sm text-muted-foreground">Last updated: November 23, 2026</p>

          <section>
            <h2 className={H2}>1. About the Program</h2>
            <p>
              These Terms govern your participation in the BITE ME Affiliate Program (the "Program") on biteme-us.com,
              operated by BITE ME INC. ("we," "us"). By joining the Program, you agree to these Terms, our{" "}
              <a href="/terms" className={LINK}>Terms of Use</a> and our <a href="/privacy" className={LINK}>Privacy Policy</a>.
            </p>
          </section>

          <section>
            <h2 className={H2}>2. Eligibility and Joining</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You must be 18 or older and have a customer account on biteme-us.com.</li>
              <li>
                To join, you provide your legal name, email address, country of residence and address, and agree to these
                Terms. To receive payouts, you must also register your PayPal email address. There is no approval process.
                Your affiliate link is issued immediately.
              </li>
              <li>You must keep your information accurate and up to date. Each person may hold only one affiliate account.</li>
            </ul>
          </section>

          <section>
            <h2 className={H2}>3. Your Affiliate Link and Tracking</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You receive a unique affiliate link that you can share for any product page or our home page.</li>
              <li>
                A purchase is credited to you if a customer clicks your link and places an order within 30 days of the
                click, on the same browser and device. If the customer later clicks another affiliate's link, the most
                recent link receives the credit.
              </li>
              <li>
                Tracking relies on the customer's browser storage. A purchase may not be tracked if the customer clears
                browser data, uses private browsing, blocks storage, or if their browser limits how long data is stored. We
                are not responsible for purchases that could not be tracked.
              </li>
            </ul>
          </section>

          <section>
            <h2 className={H2}>4. Commission</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                You earn 10% of the eligible order amount. The eligible order amount is the product subtotal after
                discounts, excluding shipping fees, taxes and duties. The commission rate is fixed at the time the order is
                placed.
              </li>
              <li>
                No commission is earned on:
                <ul className="list-disc pl-5 space-y-1 mt-1">
                  <li>your own purchases, including orders placed with your account, email address or address;</li>
                  <li>wholesale (B2B) orders;</li>
                  <li>cancelled orders;</li>
                  <li>orders placed while your affiliate account is suspended.</li>
                </ul>
              </li>
              <li>If an order is partially or fully refunded, the commission is reduced accordingly.</li>
            </ul>
          </section>

          <section>
            <h2 className={H2}>5. Confirmation and Payment</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Commission stays "pending" for 30 days after the order is placed, and is then "confirmed."</li>
              <li>Commissions confirmed by the end of each month are paid on the 15th of the following month (Korea Standard Time).</li>
              <li>
                Payments are made in U.S. dollars (USD) via PayPal to the PayPal email address you register. We are not
                responsible for payments sent to an incorrect email address you provided.
              </li>
              <li>
                The minimum payout is $20. If your confirmed balance is below $20, or if you have not registered a PayPal
                email address, the balance carries over to the next payout.
              </li>
              <li>
                PayPal fees for sending payouts are paid by us. Any fees PayPal charges you to receive the payment or
                convert it into another currency are paid by you.
              </li>
              <li>If an order is refunded or charged back after the commission has been paid, the amount is deducted from your future payouts.</li>
              <li>
                You are responsible for any taxes on your commissions. Where required by law, we may ask you for tax
                information (for example, Form W-9 for U.S. residents) and may hold payments until it is provided.
              </li>
            </ul>
          </section>

          <section>
            <h2 className={H2}>6. Promotion Rules (#ad)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Whenever you share your affiliate link, clearly disclose that you may earn a commission, for example with
                "#ad" or "#affiliate," in line with applicable advertising rules, including the U.S. FTC Endorsement Guides.
              </li>
              <li>Do not make false or misleading claims about our products, prices or promotions.</li>
              <li>Do not send spam, or present yourself as BITE ME or as our employee or official representative.</li>
              <li>Do not generate clicks or orders through fraudulent or artificial means, including clicking your own link to obtain commission.</li>
            </ul>
          </section>

          <section>
            <h2 className={H2}>7. Suspension and Termination</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You may leave the Program at any time by contacting us.</li>
              <li>
                We may suspend or remove your affiliate account if you violate these Terms, provide false information, or
                engage in fraudulent activity. Orders placed while your account is suspended do not earn commission.
              </li>
              <li>
                If you leave the Program, confirmed commissions will be paid in the next payout cycle, even if below the
                minimum payout. If your account is removed for fraud or a violation of these Terms, unpaid commissions are
                forfeited.
              </li>
            </ul>
          </section>

          <section>
            <h2 className={H2}>8. Changes to the Program</h2>
            <p>
              We may change these Terms, including the commission rate, or end the Program. We will notify you by email of
              material changes in advance. Changes do not affect commissions on orders placed before the change takes effect.
            </p>
          </section>

          <section>
            <h2 className={H2}>9. Relationship</h2>
            <p>You participate as an independent party. Nothing in these Terms makes you our employee, agent or partner.</p>
          </section>

          <section>
            <h2 className={H2}>10. Limitation of Liability</h2>
            <p>Our total liability to you under these Terms is limited to the commissions owed to you.</p>
          </section>

          <section>
            <h2 className={H2}>11. Privacy</h2>
            <p>
              We handle your personal information as described in the "Affiliate Program" section of our{" "}
              <a href="/privacy#affiliate-program" className={LINK}>Privacy Policy</a>.
            </p>
          </section>

          <section>
            <h2 className={H2}>12. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the Republic of Korea, and any disputes will be subject to the
              exclusive jurisdiction of the Seoul Central District Court.
            </p>
          </section>

          <section>
            <h2 className={H2}>13. Contact</h2>
            <p>
              If you have questions about the Program, please contact us through our{" "}
              <a href="/contact" className={LINK}>Contact Us</a> page.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
