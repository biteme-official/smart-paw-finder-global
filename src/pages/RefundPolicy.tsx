import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export default function RefundPolicy() {
  const navigate = useNavigate();

  return (
    <div className="bg-background min-h-screen flex flex-col">
      <Header onSearch={(q) => navigate(q ? `/?q=${encodeURIComponent(q)}` : "/")} />

      <main className="max-w-6xl mx-auto px-6 py-8 flex-1">
        <h1 className="text-2xl font-bold mb-6">Shipping & Returns</h1>
        <div className="prose prose-sm max-w-none text-muted-foreground space-y-6">

          <p className="text-sm text-muted-foreground">Last updated: June 8, 2026</p>

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
              <li>We accept returns within <strong className="text-foreground">14 days</strong> of the date you receive your package (based on the "Delivered" status of your tracking number) for items that are unused, unopened, and in their original packaging.</li>
              <li>To initiate a return, please contact us at <a href="mailto:mates@biteme.co.kr" className="text-primary hover:underline">mates@biteme.co.kr</a> before sending the item back.</li>
              <li>Return shipping costs for customer-initiated returns are the responsibility of the customer.</li>
              <li>We do not charge any restocking fees for returns.</li>
              <li>Items that have been used, damaged by the customer, or are missing original packaging are not eligible for return.</li>
              <li>
                Please ship returns to our official business address:{" "}
                <strong className="text-foreground">8F, 10 Teheran-ro 20-gil, Gangnam-gu, Seoul, Republic of Korea (Zip: 06234)</strong>.
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
              <li><strong className="text-foreground">Due to the nature of international shipping, we do not offer direct exchanges for change of mind (e.g., size, color, or model changes).</strong></li>
              <li><strong className="text-foreground">If you wish to exchange an item, please follow our return process for a refund and place a new order for the desired item.</strong></li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">Defective or Incorrect Items</h2>
            <p>
              If you receive a defective, damaged, or incorrectly shipped item, please contact us within 14 days of delivery (receipt).
              Please provide your order number along with photos or videos of the issue.
              We will cover all international shipping costs for exchange or refund in such cases.
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