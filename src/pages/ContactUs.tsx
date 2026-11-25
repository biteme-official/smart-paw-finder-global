import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Mail, MapPin, Clock, MessageCircle } from "lucide-react";
import { SUPPORT_CHAT_URL, openSupportChat } from "@/lib/support-chat";
import { IS_B2C_SITE } from "@/lib/site";
import contactImage from "@/assets/contact-dog.jpg";

const ContactUs = () => {
  const navigate = useNavigate();

  const handleSearch = (query: string) => {
    navigate(query ? `/?q=${encodeURIComponent(query)}` : "/");
  };

  return (
    <div className="bg-background min-h-screen flex flex-col">
      <Header onSearch={handleSearch} />

      <main className="flex-1 px-6 py-12 md:py-20">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-12 md:gap-16">

          {/* Left — Contact Info */}
          <div className="flex-1 w-full">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-8">
              Let's Chat 💬
            </h1>
            <p className="text-muted-foreground mb-10 leading-relaxed">
              If you have any questions or want to{" "}
              <strong className="text-foreground">get help with your order</strong>, feel
              free to reach out. We will be very happy to help you!
            </p>

            <ul className="space-y-6">

              {/* Chat CTA (Shopify Inbox) — highlighted, B2C 사이트 전용 */}
              {IS_B2C_SITE && (
                <li>
                  <a
                    href={SUPPORT_CHAT_URL}
                    onClick={openSupportChat}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-4 group"
                  >
                    <span className="shrink-0 w-10 h-10 rounded-full bg-foreground flex items-center justify-center text-background shadow-sm group-hover:opacity-80 transition-opacity">
                      <MessageCircle className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="pt-1.5">
                      <p className="font-semibold text-foreground group-hover:underline">
                        Chat with us
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Opens in a new tab · We reply M–F 10am – 7pm KST
                      </p>
                    </div>
                  </a>
                </li>
              )}

              {/* Email */}
              <li className="flex items-start gap-4">
                <span className="shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="h-4 w-4 text-primary" />
                </span>
                <a
                  href="mailto:mates@biteme.co.kr"
                  className="text-foreground hover:text-primary transition-colors leading-relaxed pt-2"
                >
                  mates@biteme.co.kr
                </a>
              </li>

              {/* Address */}
              <li className="flex items-start gap-4">
                <span className="shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <MapPin className="h-4 w-4 text-primary" />
                </span>
                <span className="text-foreground leading-relaxed pt-2">
                  8F, 10 Teheran-ro 20-gil, Gangnam-gu, Seoul, Republic of Korea
                </span>
              </li>

              {/* Hours */}
              <li className="flex items-start gap-4">
                <span className="shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-primary" />
                </span>
                <span className="text-foreground leading-relaxed pt-2">
                  Monday – Friday: 10:00 am – 7:00 pm KST
                </span>
              </li>

            </ul>
          </div>

          {/* Right — Image */}
          <div className="w-full md:w-[420px] shrink-0">
            <div className="overflow-hidden aspect-square shadow-md">
              <img
                src={contactImage}
                alt="BITE ME — cute dog with toys"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ContactUs;
