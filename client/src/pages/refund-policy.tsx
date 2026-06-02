import { useState, useEffect } from "react";
import { ChevronUp, ChevronDown, ArrowUp } from "lucide-react";
import { PublicLayout } from "@/components/layout/public-layout";

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

export default function RefundPolicyPage() {
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
          
          <div className="text-center space-y-4">
            <h1 className="text-3xl md:text-5xl font-black text-foreground font-heading">
              Company Policies & Legal Agreements
            </h1>
            <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
              Last updated: May 2026. Please read our terms, conditions, and service refund policies carefully.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">Refund Policy</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              At CÕRA LABS, we are committed to delivering high-quality software systems, digital services, and custom development work. This policy outlines the conditions under which refunds may be requested and processed across our products, platforms, and client engagements.
            </p>
          </div>

          <div className="bg-primary/5 md:bg-primary/10 rounded-[2rem] p-4 md:p-8">
            
            <PolicyCard number="01" title="Introduction & Eligibility" defaultOpen={true}>
              <p>
                CÕRA LABS provides a range of services, including custom software development, SaaS platforms, API integrations, technical consultancy, and managed digital products such as the AyurPath multi-vendor digital health platform.
              </p>
              <p>Each request is reviewed based on:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Nature</strong> of the service (development work, subscription, transaction-based service, or platform usage).</li>
                <li><strong>Progress</strong> or stage of delivery at the time of the request.</li>
                <li><strong>Type of engagement</strong> (one-time project, recurring service, or end-user transaction).</li>
              </ul>
              <p>Submitting a payment to CÕRA LABS or any CÕRA LABS-operated platform constitutes acceptance of the terms set out in this policy.</p>
            </PolicyCard>

            <PolicyCard number="02" title="Non-Refundable Services">
              <p>The following categories are strictly non-refundable:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Completed custom software development work that has been delivered, accepted, or deployed.</li>
                <li>Consumed API services, including per-request, per-transaction, or metered API usage.</li>
                <li>Fully delivered digital services, such as completed design assets, deployed integrations, training sessions, or finalized deliverables.</li>
                <li>Third-party license fees, hosting costs, domain registrations, and any pass-through charges already incurred on the client's behalf.</li>
                <li>Discounted, promotional, or custom-quoted engagements explicitly marked as non-refundable in the corresponding agreement or invoice.</li>
              </ul>
            </PolicyCard>

            <PolicyCard number="03" title="AyurPath Platform — Appointment Cancellations & Refunds">
              <p>The AyurPath platform facilitates appointments between patients and registered medical practitioners. Refunds for appointment bookings are governed by the following rules:</p>
              <div className="space-y-4 mt-4">
                <div>
                  <h4 className="font-bold text-foreground mb-1">3.1 Doctor-Initiated Cancellations</h4>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>The patient will receive a refund covering the Consultation Fee only. Platform booking charges and applicable taxes are non-refundable.</li>
                    <li>The platform charges and applicable taxes associated with that cancelled transaction will be deducted from the doctor's next scheduled payout.</li>
                    <li>This ensures that patients are never financially disadvantaged by a provider-side cancellation.</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-bold text-foreground mb-1">3.2 No-Shows and Late Cancellations</h4>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>Patient no-shows or cancellations made outside the permitted cancellation window are treated as completed appointments and are non-refundable.</li>
                    <li>Doctor no-shows are treated under Section 3.1 and entitle the patient to a full refund.</li>
                  </ul>
                </div>
              </div>
            </PolicyCard>

            <PolicyCard number="04" title="Refund Processing & PayHere Limitations">
              <p>All eligible refunds are initiated through the PayHere payment gateway.</p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Card payments</strong> may be processed as instant or delayed refunds, depending on the originating bank's transaction timing and settlement cycle.</li>
                <li>Refunds will be credited to the original payment method used at the time of purchase. Refunds cannot be redirected to a different card, account, or wallet.</li>
              </ul>
              <h4 className="font-bold text-foreground mt-4 mb-2">Important Disclaimer</h4>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Refunds</strong> are automated through the PayHere gateway.</li>
                <li>Any <strong>PARTIAL refunds</strong> — including patient-initiated cancellations on AyurPath where platform charges and taxes are deducted — must be processed manually by the CÕRA LABS finance team.</li>
                <li>Manual partial refunds may require additional verification and processing time beyond the standard automated timeline.</li>
              </ul>
            </PolicyCard>

            <PolicyCard number="05" title="Timeline & Process">
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Review period:</strong> Standard refund requests are reviewed within 3–5 business days of submission.</li>
                <li><strong>Processing period:</strong> Once approved, refunds may take an additional 7–14 banking days to reflect in the customer's account, depending on the issuing bank and payment method.</li>
                <li>Customers will receive email confirmation at each stage: request received, request reviewed, and refund processed.</li>
              </ul>
            </PolicyCard>

            <PolicyCard number="06" title="Refund Processing Workflow">
              <ul className="list-disc pl-5 space-y-2">
                <li>When a doctor cancels a booking, the system immediately logs the cancellation details and flags the transaction for financial review.</li>
                <li>The system routes the request to the Admin Refund Screen, displaying the booking reference, payment breakdown, and cancellation timestamp.</li>
                <li>The administrator triggers the refund directly to the original payment instrument. The system automatically sends a confirmation receipt to the user.</li>
              </ul>
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