import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Phone, Mail, MapPin, Clock } from "lucide-react";
import contactImage from "@/assets/hero-banner-jumping-boogie.jpg";

const CONTACT_ITEMS = [
  {
    icon: Phone,
    label: "+82 70-4888-6191",
    href: "tel:+827048886191",
  },
  {
    icon: Mail,
    label: "mates@biteme.co.kr",
    href: "mailto:mates@biteme.co.kr",
  },
  {
    icon: MapPin,
    label: "8F, 10 Teheran-ro 20-gil, Gangnam-gu, Seoul, Republic of Korea",
    href: null,
  },
  {
    icon: Clock,
    label: "Monday – Friday: 9:00 am – 6:00 pm KST",
    href: null,
  },
];

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
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Contact Us
            </h1>
            <p className="text-muted-foreground mb-10 leading-relaxed">
              If you have any questions or want to{" "}
              <strong className="text-foreground">get help with your order</strong>, feel
              free to reach out via email or phone call. We will be very happy to help
              you!
            </p>

            <ul className="space-y-6">
              {CONTACT_ITEMS.map(({ icon: Icon, label, href }) => (
                <li key={label} className="flex items-start gap-4">
                  <span className="shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-primary" />
                  </span>
                  {href ? (
                    <a
                      href={href}
                      className="text-foreground hover:text-primary transition-colors leading-relaxed pt-2"
                    >
                      {label}
                    </a>
                  ) : (
                    <span className="text-foreground leading-relaxed pt-2">{label}</span>
                  )}
                </li>
              ))}
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
