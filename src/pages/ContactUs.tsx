import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Mail, MapPin, Clock } from "lucide-react";
import contactImage from "@/assets/contact-dog.jpg";

const WHATSAPP_NUMBER = "15559433437";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hi BITE ME! I have a question and would like some help.")}`;

const WhatsAppIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="h-4 w-4"
    aria-hidden="true"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

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
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-8">
              Reach out
            </h1>
            <p className="text-muted-foreground mb-10 leading-relaxed">
              If you have any questions or want to{" "}
              <strong className="text-foreground">get help with your order</strong>, feel
              free to reach out. We will be very happy to help you!
            </p>

            <ul className="space-y-6">

              {/* WhatsApp CTA — highlighted */}
              <li>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-4 group"
                >
                  <span className="shrink-0 w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center text-white shadow-sm group-hover:bg-[#20bd5a] transition-colors">
                    <WhatsAppIcon />
                  </span>
                  <div className="pt-1.5">
                    <p className="font-semibold text-foreground group-hover:text-[#25D366] transition-colors">
                      Message us on WhatsApp
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Fastest response · Usually replies within 1 hour
                    </p>
                  </div>
                </a>
              </li>

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
            <div className="rounded-2xl overflow-hidden aspect-square shadow-md">
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
