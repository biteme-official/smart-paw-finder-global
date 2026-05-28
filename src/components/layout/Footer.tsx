import { Phone, Mail, MapPin } from "lucide-react";
import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="bg-muted/50 border-t border-border mt-auto">
      <div className="container mx-auto px-4 py-6">
        <div className="space-y-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Customer Support</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="flex items-center gap-1.5">
              <Mail className="h-4 w-4 text-primary" />
              <a href="mailto:mates@biteme.co.kr" className="hover:text-primary transition-colors">
                mates@biteme.co.kr
              </a>
            </span>
            <span className="flex items-center gap-1.5">
              <Phone className="h-4 w-4 text-primary" />
              <a href="tel:+827048886191" className="hover:text-primary transition-colors">
                +82 70-4888-6191
              </a>
            </span>
          </div>
          <div className="flex items-start gap-1.5 text-xs">
            <MapPin className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
            <span>8F, 10 Teheran-ro 20-gil, Gangnam-gu, Seoul, Republic of Korea (Three M Tower)</span>
          </div>
          <div className="flex flex-wrap gap-4 pt-2 border-t border-border/50 text-xs">
            <Link to="/refund-policy" className="hover:text-primary transition-colors">
              Shipping &amp; Returns
            </Link>
            <Link to="/privacy" className="hover:text-primary transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-primary transition-colors">
              Terms of Use
            </Link>
            <Link to="/contact" className="hover:text-primary transition-colors">
              Contact Us
            </Link>
          </div>
          <p className="text-xs text-muted-foreground/60">© 2026 BITE ME. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
