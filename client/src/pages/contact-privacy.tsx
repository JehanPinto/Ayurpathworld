import { useState, useEffect } from "react";
import { Mail, ArrowUp } from "lucide-react";
import { PublicLayout } from "@/components/layout/public-layout";

export default function ContactPage() {
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <PublicLayout>
      <div className="bg-background min-h-[80vh] py-12 md:py-16">
        <div className="container mx-auto px-4 max-w-6xl space-y-12">
          
          <div className="text-center space-y-4">
            <h1 className="text-3xl md:text-5xl font-black text-foreground font-heading">
              Company Policies & Legal Agreements
            </h1>
            <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
              Last updated: May 2026. Please read our terms, conditions, and service refund policies carefully.
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">Need Help?</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                For legal inquiries, dispute resolutions, or manual refund requests, please contact our compliance team directly. We respond to all merchant and customer correspondence within two business days.
              </p>
            </div>

            {/* Contact Card */}
            <div className="bg-card border border-primary/30 rounded-2xl p-6 md:p-8 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow max-w-2xl mx-auto">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold tracking-wider text-foreground uppercase">Email</h3>
                <a 
                  href="mailto:hr.coralabs@gmail.com" 
                  className="text-lg md:text-xl font-bold text-primary hover:underline block"
                >
                  hr.coralabs@gmail.com
                </a>
                <p className="text-sm text-muted-foreground pt-1">
                  Compliance, billing, and refund disputes.
                </p>
              </div>
            </div>
            
          </div>
        </div>
      </div>
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Scroll to top"
        className={`fixed bottom-6 right-6 z-50 w-11 h-11 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-xl hover:brightness-110 ${
          showScrollTop ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        <ArrowUp className="h-5 w-5" />
      </button>
    </PublicLayout>
  );
}