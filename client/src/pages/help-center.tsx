import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  Search,
  Shield,
  Code,
  Droplet,
  Receipt,
  Calendar,
  UserCircle,
  LifeBuoy,
  FileText,
  Phone,
  Mail,
  ChevronDown,
  ArrowUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PublicLayout } from "@/components/layout/public-layout";

// Quick filter tags
const QUICK_LINKS = [
  "Billing & plans",
  "Account setup",
  "API access",
  "Security",
  "Integrations",
];

// Categories data
const CATEGORIES = [
  { icon: Shield, title: "Account &\nSecurity" },
  { icon: Code, title: "API &\nIntegrations" },
  { icon: Droplet, title: "Treatments &\nServices" },
  { icon: Receipt, title: "Payments &\nBillings" },
  { icon: Calendar, title: "Appointments" },
  { icon: UserCircle, title: "Doctor\nProfiles" },
  { icon: LifeBuoy, title: "Technical\nSupport" },
  { icon: FileText, title: "Your\nAccount" },
];

// FAQ Data
const FAQS = [
  {
    q: "How do I book an appointment?",
    a: "You can book an appointment by searching for a doctor on our homepage, selecting an available time slot, and confirming your details. You will receive a confirmation email once booked.",
  },
  {
    q: "Are all doctors on the platform verified?",
    a: "Yes, every doctor undergoes a strict verification process where we check their SLAMC registration, educational qualifications, and professional background before they can accept appointments.",
  },
  {
    q: "Can I get online consultations?",
    a: "Absolutely! Many of our doctors offer video consultations. You can filter your search results by 'Online Consultations' to find doctors providing this service.",
  },
  {
    q: "How do I cancel or reschedule an appointment?",
    a: "Go to 'Your Account' > 'Appointments'. Select the appointment you wish to change and click either 'Cancel' or 'Reschedule'. Please note our 24-hour cancellation policy.",
  },
  {
    q: "What payment methods are accepted?",
    a: "We accept all major credit/debit cards (Visa, Mastercard), popular mobile wallets, and direct bank transfers for your convenience.",
  },
  {
    q: "How can I leave a review for a doctor?",
    a: "After your consultation is marked as completed, you will receive an email prompt to leave a review. You can also do this from your patient dashboard.",
  },
  {
    q: "Is my personal information secure?",
    a: "Yes, we use industry-standard encryption protocols. Your medical records and personal data are strictly confidential and only shared with your treating physician.",
  },
  {
    q: "How do I become a doctor on this platform?",
    a: "Click on 'Register as a Doctor' on the homepage. You will need to complete a 4-step registration process, including uploading your SLAMC registration and other credentials for verification.",
  },
];

export default function HelpCenterPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showQuickLinks, setShowQuickLinks] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <PublicLayout>
      <div className="min-h-screen bg-background flex flex-col">
        
        {/* --- HERO SECTION --- */}
        <section className="mt-4 container mx-auto max-w-5xl text-center">
          <h1 className="lg:text-[52px] md:text-[40px] sm:text-[32px] text-[24px] font-extrabold text-foreground font-heading">
            How can we help you today?
          </h1>
          <p className="lg:text-[20px] md:text-[18px] sm:text-[16px] text-[14px] text-muted-foreground mb-4">
            Search our knowledge base or browse help topics below
          </p>

          {/* Search Bar */}
          <div className="relative max-w-3xl mx-auto mb-3 shadow-sm">
            <Input
              type="text"
              placeholder="Search for answers, guides or topics ..."
              className="h-14 pl-6 pr-16 rounded-2xl border-primary/70 bg-card text-base focus-visible:ring-primary"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button 
              className="absolute right-0 top-0 h-14 w-14 rounded-xl bg-primary hover:bg-primary/90 flex items-center justify-center"
            >
              <Search className="h-5 w-5 text-white" />
            </button>
          </div>

          {/* Quick Links Section */}
          <div className="max-w-3xl mx-auto">
            
            {/* 👉 Tablet & Mobile View Toggle Button (Desktop වලදි මේක පේන්නේ නෑ) */}
            <div className="lg:hidden flex justify-center mb-4">
              <button
                onClick={() => setShowQuickLinks(!showQuickLinks)}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-muted-foreground hover:text-primary bg-card border border-border/60 rounded-full transition-colors shadow-sm"
              >
                {showQuickLinks ? "Hide Topics" : "Popular Topics"}
                <ChevronDown 
                  className={`h-4 w-4 transition-transform duration-300 ${
                    showQuickLinks ? "rotate-180" : ""
                  }`} 
                />
              </button>
            </div>

            {/* 👉 Links Container - Desktop (lg) වලදි හැමතිස්සෙම පේනවා, අනිත් ඒවගේදි Button එක එබුවම පේනවා */}
            <div 
              className={`flex-wrap justify-center gap-3 transition-all duration-300 ${
                showQuickLinks ? "flex animate-in fade-in slide-in-from-top-2" : "hidden lg:flex"
              }`}
            >
              {QUICK_LINKS.map((link, idx) => (
                <button
                  key={idx}
                  className="px-4 py-2 rounded-lg border border-primary/70 bg-card lg:text-[18px] md:text-[16px] sm:text-[14px] text-[12px] text-foreground/70 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all shadow-sm"
                >
                  {link}
                </button>
              ))}
            </div>
            
          </div>
        </section>

        {/* --- CATEGORIES GRID --- */}
        <section className="mt-12 container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {CATEGORIES.map((category, idx) => (
              <div
                key={idx}
                className="flex items-center gap-4 p-5 rounded-2xl border border-primary/70 bg-primary/10 dark:bg-primary/5 cursor-pointer hover:-translate-y-1 hover:shadow-md transition-all duration-300 group"
              >
                <div className="w-14 h-14 rounded-full border border-primary/70 bg-primary/0 flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                  <category.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground lg:text-[20px] md:text-[18px] sm:text-[16px] text-[14px]">
                  {category.title}
                </h3>
              </div>
            ))}
          </div>
        </section>

        {/* --- FAQ SECTION --- */}
        <section className="bg-[#eef6f1] dark:bg-primary/5 mt-6 pt-9">
          <div className="container mx-auto max-w-4xl">
            <div className="text-center mb-12">
              <h2 className="lg:text-[56px] md:text-[48px] sm:text-[40px] text-[32px] font-bold text-foreground font-heading">
                Frequently Asked Questions
              </h2>
              <p className="text-muted-foreground lg:text-[20px] md:text-[18px] sm:text-[16px] text-[14px]">
                Find quick answers to common questions about our platform and services
              </p>
            </div>

            <div className="space-y-1 bg-transparent">
              {FAQS.map((faq, index) => (
                <div 
                  key={index} 
                  className="border-b border-border/60 last:border-0"
                >
                  <button
                    onClick={() => toggleFaq(index)}
                    className="flex justify-between items-center w-full py-5 text-left focus:outline-none group"
                  >
                    <span className="font-semibold lg:text-[20px] md:text-[18px] sm:text-[16px] text-[14px] text-foreground group-hover:text-primary transition-colors pr-6">
                      {faq.q}
                    </span>
                    <ChevronDown 
                      className={`h-5 w-5 text-muted-foreground shrink-0 transition-transform duration-300 ease-in-out ${
                        openFaq === index ? "rotate-180 text-primary" : ""
                      }`} 
                    />
                  </button>
                  
                  {/* Smooth Accordion Animation */}
                  <div 
                    className={`grid transition-all duration-300 ease-in-out ${
                      openFaq === index 
                        ? "grid-rows-[1fr] opacity-100 pb-5" 
                        : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden text-muted-foreground lg:text-[16px] md:text-[14px] sm:text-[12px] text-[10px] leading-relaxed pr-8">
                      {faq.a}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* --- CTA SECTION --- */}
        <section className="bg-[#2a9d5c] dark:bg-primary mt-2">
          <div className="container mx-auto max-w-4xl text-center mt-6">
            <h2 className="lg:text-[56px] md:text-[48px] sm:text-[40px] text-[32px] font-bold text-white font-heading">
              Still Have Questions?
            </h2>
            <p className="text-white/90 mb-9 max-w-2xl mx-auto lg:text-[20px] md:text-[18px] sm:text-[16px] text-[14px]">
              Our dedicated support team is always ready to help you with any questions or concerns. Don't hesitate to reach out!
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
              <Button 
                size="lg" 
                className="bg-[#1a1a1a] hover:bg-black text-white border-0 w-full sm:w-auto h-12 rounded-lg px-8"
              >
                Call Us Now
                <Phone className="h-4 w-4 ml-2 fill-current opacity-80" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="bg-transparent border-white/40 text-white hover:bg-white/10 hover:text-white hover:border-white w-full sm:w-auto h-12 rounded-lg px-8"
              >
                Email Support
                <Mail className="h-4 w-4 ml-2 opacity-80" />
              </Button>
            </div>
          </div>
        </section>

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