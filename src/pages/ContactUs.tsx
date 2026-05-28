import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Phone, Mail, MapPin } from "lucide-react";

const ContactUs = () => {
  const navigate = useNavigate();

  const handleSearch = (query: string) => {
    navigate(query ? `/?q=${encodeURIComponent(query)}` : '/');
  };

  return (
    <div className="bg-background min-h-screen flex flex-col">
      <Header onSearch={handleSearch} />

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="text-center space-y-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">
            Contact Us
          </h1>

          <div className="space-y-4 text-lg text-muted-foreground">
            <div className="flex items-center justify-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              <span>Support Phone Number:</span>
              <a
                href="tel:+827048886191"
                className="text-foreground hover:text-primary transition-colors font-medium"
              >
                +82 70-4888-6191
              </a>
            </div>

            <div className="flex items-center justify-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              <span>Support E-mail:</span>
              <a
                href="mailto:mates@biteme.co.kr"
                className="text-foreground hover:text-primary transition-colors font-medium"
              >
                mates@biteme.co.kr
              </a>
            </div>

            <div className="flex items-start justify-center gap-2 text-base">
              <MapPin className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <span className="text-left">
                8F, 10 Teheran-ro 20-gil, Gangnam-gu,<br />
                Seoul, Republic of Korea<br />
                (Three M Tower, Yeoksam-dong)
              </span>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ContactUs;
