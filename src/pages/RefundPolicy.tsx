import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Footer } from "@/components/layout/Footer";
import biteMeLogo from "@/assets/bite-me-logo.png";

export default function RefundPolicy() {
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
        <h1 className="text-2xl font-bold mb-6">Shipping & Returns</h1>
        <div className="prose prose-sm max-w-none text-muted-foreground space-y-6">

          <p className="text-sm text-muted-foreground">Last updated: June 2, 2026</p>

          <section>
            <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">Shipping</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Orders are typically processed within 1–3 business days after payment confirmation.</li>
              <li>International delivery takes approximately <strong className="text-foreground">7–21 business days</strong> depending on the destination country and customs processing.</li>
              <li>Shipping fees are calculated at checkout based on the destination and order weight.</li>
              <li>You will receive a tracking number by email once your order has shipped.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">Returns</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>We accept returns within <strong className="text-foreground">7 days</strong> of delivery for items that are unused, unopened, and in their original packaging.</li>
              <li>To initiate a return, please contact us at <a href="mailto:mates@biteme.co.kr" className="text-primary hover:underline">mates@biteme.co.kr</a> before sending the item back.</li>
              <li>Return shipping costs for customer-initiated returns are the responsibility of the customer.</li>
              <li>We do not charge any restocking fees for returns.</li>
              <li>Items that have been used, damaged by the customer, or are missing original packaging are not eligible for return.</li>
              <li>
                Please ship returns to our official business address:{" "}
                <strong className="text-foreground">8F, 10 Teheran-ro 20-gil, Gangnam-gu, Seoul, Republic of Korea</strong>.
                Do not send returns to any other address without prior confirmation from our team.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">Refunds</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Once your returned item is received and inspected, we will notify you of the refund approval status within 3 business days.</li>
              <li>Approved refunds are processed to the original payment method within 5–10 business days.</li>
              <li>Shipping fees are non-refundable unless the return is due to our error.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">Defective or Incorrect Items</h2>
            <p>
              If you receive a defective or incorrectly shipped item, please contact us within 7 days of delivery.
              We will cover all costs for exchange or refund in such cases.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">Contact</h2>
            <p>
              For questions about shipping or returns, please visit our{" "}
              <a href="/contact" className="text-primary hover:underline">Contact Us</a> page.
            </p>
          </section>

        </div>
      </main>

      <Footer />
    </div>
  );
}
