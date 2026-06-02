import { useState, useEffect } from "react";
import { ChevronUp, ChevronDown, ArrowUp } from "lucide-react";
import { PublicLayout } from "@/components/layout/public-layout";

// --- Reusable Policy Accordion Component ---
function PolicyCard({ number, title, defaultOpen = false, children }: { number: string, title: string, defaultOpen?: boolean, children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-card border border-primary/20 rounded-2xl overflow-hidden mb-4 shadow-sm transition-all duration-200">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 md:px-6 py-5 hover:bg-primary/5 transition-colors text-left"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full border border-primary text-primary flex items-center justify-center font-medium text-sm shrink-0 bg-primary/5">
            {number}
          </div>
          <span className="font-bold text-base md:text-lg text-foreground">{title}</span>
        </div>
        {open ? (
          <ChevronUp className="h-5 w-5 text-primary shrink-0 ml-2" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0 ml-2" />
        )}
      </button>

      {open && (
        <>
          <div className="h-px bg-primary/10 mx-6" />
          <div className="p-5 md:p-6 text-sm text-muted-foreground leading-relaxed space-y-4">
            {children}
          </div>
        </>
      )}
    </div>
  );
}

export default function TermsAndConditionsPage() {
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <PublicLayout>
      <div className="bg-background min-h-screen py-12 md:py-16">
        <div className="container mx-auto px-4 max-w-6xl space-y-12">
          
          {/* Header Section */}
          <div className="text-center space-y-4">
            <h1 className="text-3xl md:text-5xl font-black text-foreground font-heading">
              Company Policies & Legal Agreements
            </h1>
            <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
              Last updated: May 2026. Please read our terms, conditions, and service refund policies carefully.
            </p>
          </div>

          {/* Title & Description */}
          <div className="space-y-3">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">Terms and Conditions</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              These Terms govern your access to and use of the services, software, websites, and digital platforms provided by CÕRA LABS ("we", "our", "us"). Please read them carefully.
            </p>
          </div>

          {/* Accordions Wrapper */}
          <div className="bg-primary/5 md:bg-primary/10 rounded-[2rem] p-4 md:p-8">
            
            <PolicyCard number="01" title="Introduction & Acceptance of Terms" defaultOpen={true}>
              <p>
                By accessing, registering for, or using any service, product, or platform operated by CÕRA LABS — including custom software deliverables, the AyurPath platform, APIs, and consulting engagements — you ("the User", "the Client") confirm that you have read, understood, and agreed to be bound by these Terms.
              </p>
              <p>
                If you do not agree with any part of these Terms, you must discontinue use of our services immediately. Continued use following any updates constitutes acceptance of the revised Terms.
              </p>
            </PolicyCard>

            <PolicyCard number="02" title="Intellectual Property Rights">
              <ul className="list-disc pl-5 space-y-2">
                <li>All custom software, source code, UI/UX designs, documentation, trademarks, logos, and branding assets created by CÕRA LABS remain the exclusive intellectual property of CÕRA LABS until they are formally handed over to the client in accordance with the signed contract or engagement agreement.</li>
                <li>Ownership transfer occurs only upon full settlement of all invoices and the execution of any required handover documentation.</li>
                <li>Pre-existing tools, frameworks, libraries, internal utilities, and proprietary methodologies developed by CÕRA LABS prior to or independent of the engagement remain the property of CÕRA LABS at all times.</li>
                <li>Users and clients may not copy, redistribute, reverse-engineer, or commercially exploit any CÕRA LABS-owned assets without prior written consent.</li>
              </ul>
            </PolicyCard>

            <PolicyCard number="03" title="User Account Responsibilities">
              <p>Users, clients, platform administrators, and end-users are responsible for:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Maintaining the <strong>confidentiality and security</strong> of login credentials, API keys, and access tokens.</li>
                <li>All activity that occurs under their account, whether authorized or not.</li>
                <li>Promptly notifying CÕRA LABS of any unauthorized access, suspected breach, or compromised credentials.</li>
                <li>Ensuring that all information provided during registration or use is <strong>accurate, current, and complete</strong>.</li>
                <li>Complying with all applicable laws, professional standards, and platform-specific guidelines (including medical and data protection regulations where relevant to AyurPath).</li>
              </ul>
              <p>CÕRA LABS shall not be held liable for losses arising from the User's failure to safeguard account credentials.</p>
            </PolicyCard>

            <PolicyCard number="04" title="Payment Terms & Gateway Integration">
              <ul className="list-disc pl-5 space-y-2">
                <li>All digital payments processed through CÕRA LABS platforms are securely handled via the <strong>PayHere</strong> payment gateway.</li>
                <li>By initiating a payment, Users acknowledge and agree to PayHere's transactional terms, privacy policies, and processing conditions in addition to these Terms.</li>
                <li>CÕRA LABS does not store full card details or sensitive payment credentials; all such data is managed under PCI-DSS compliant infrastructure operated by PayHere.</li>
                <li>Invoices for project-based services must be settled within the timelines specified in the corresponding agreement. Late payments may incur service suspension or additional charges.</li>
                <li>All prices are quoted in the currency specified on the invoice or checkout page and are inclusive or exclusive of taxes as stated.</li>
              </ul>
            </PolicyCard>

            <PolicyCard number="05" title="Limitation of Liability & Termination">
              <div className="space-y-4">
                <div>
                  <h4 className="font-bold text-foreground mb-2">5.1 Limitation of Liability</h4>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>CÕRA LABS shall <strong>not be liable</strong> for any indirect, incidental, consequential, or punitive damages, including loss of profits, business interruption, loss of data, or reputational harm.</li>
                    <li>We are not responsible for temporary platform downtimes, scheduled maintenance, third-party service interruptions, or events arising from circumstances beyond our reasonable control (including force majeure events, ISP failures, or upstream gateway outages).</li>
                    <li>Total aggregate liability arising from any claim shall not exceed the amount paid by the User to CÕRA LABS in the <strong>three (3) months</strong> preceding the event giving rise to the claim.</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-bold text-foreground mb-2">5.2 Termination</h4>
                  <p className="mb-2">CÕRA LABS reserves the right to suspend or terminate services, accounts, or engagements under the following conditions:</p>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>Breach of these Terms or any associated agreement.</li>
                    <li>Non-payment of invoices or chargeback abuse.</li>
                    <li>Misuse of the platform, fraudulent activity, or violation of applicable laws.</li>
                    <li>Conduct that endangers other users, practitioners, patients, or the integrity of our systems.</li>
                  </ul>
                  <p className="mt-2">Upon termination, all outstanding amounts become immediately due, and access to associated services will be revoked. Sections relating to Intellectual Property, Limitation of Liability, and Payment Terms shall survive termination.</p>
                </div>
              </div>
            </PolicyCard>

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