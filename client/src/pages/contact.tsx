import { useState, useEffect } from "react";
import {
  Mail,
  Phone,
  MapPin,
  Send,
  ArrowUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PublicLayout } from "@/components/layout/public-layout";
import { useToast } from "@/hooks/use-toast";

const contactInfo = [
  {
    icon: Phone,
    title: "Phone",
    details: ["+94 11 234 5678", "+94 77 123 4567"],
    description: "Mon-Fri, 8am-6pm",
  },
  {
    icon: Mail,
    title: "Email",
    details: ["support@ayurvedicdoctor.lk", "info@ayurvedicdoctor.lk"],
    description: "We reply within 24 hours",
  },
  {
    icon: MapPin,
    title: "Office",
    details: ["123 Galle Road", "Colombo 03, Sri Lanka"],
    description: "Visit us in person",
  },
];

const faqs = [
  {
    question: "How do I book an appointment?",
    answer: "You can book an appointment by searching for a doctor on our platform, selecting your preferred date and time, and completing the booking process. You'll need to create an account or log in to complete your booking.",
  },
  {
    question: "Are all doctors on the platform verified?",
    answer: "Yes, all doctors on AyurvedicDoctor are thoroughly verified. We check their qualifications, certifications, and professional experience before they can join our platform. Look for the verified badge on doctor profiles.",
  },
  {
    question: "Can I get online consultations?",
    answer: "Yes, many of our doctors offer online video consultations. You can filter doctors by consultation type when searching. Online consultations are convenient and allow you to receive care from anywhere.",
  },
  {
    question: "How do I cancel or reschedule an appointment?",
    answer: "You can cancel or reschedule appointments from your patient dashboard. Go to 'My Appointments', find the appointment you want to modify, and select the appropriate option. Please note our cancellation policy for any applicable fees.",
  },
  {
    question: "What payment methods are accepted?",
    answer: "We accept various payment methods including credit/debit cards, online banking, and cash payment at the clinic. Payment options may vary depending on the doctor and consultation type.",
  },
  {
    question: "How can I leave a review for a doctor?",
    answer: "After your appointment is completed, you'll receive an option to rate and review your experience. You can also leave reviews from your patient dashboard under 'My Reviews'. Your feedback helps other patients find the right doctor.",
  },
  {
    question: "Is my personal information secure?",
    answer: "Absolutely. We take data privacy seriously and use industry-standard encryption to protect your personal and medical information. We comply with all applicable data protection regulations.",
  },
  {
    question: "How do I become a doctor on this platform?",
    answer: "If you're a qualified Ayurvedic practitioner, you can register through our 'Register as Doctor' page. You'll need to submit your qualifications and certifications for verification. Our team will review your application and get back to you.",
  },
];

const inquiryTypes = [
  { value: "general", label: "General Inquiry" },
  { value: "booking", label: "Booking Help" },
  { value: "technical", label: "Technical Support" },
  { value: "feedback", label: "Feedback" },
  { value: "partnership", label: "Partnership" },
  { value: "doctor_registration", label: "Doctor Registration" },
  { value: "other", label: "Other" },
];

export default function ContactPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    inquiryType: "",
    subject: "",
    message: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const { [field]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?\d{10,15}$/;
    const nameRegex = /^[a-zA-Z\s]+$/;

    if (!formData.name.trim()) newErrors.name = "Full Name is required.";
    if (!formData.subject.trim()) newErrors.subject = "Subject is required.";
    if (!formData.message.trim()) newErrors.message = "Message cannot be empty.";
    if (!formData.inquiryType) newErrors.inquiryType = "Please select an inquiry type.";

    if (!formData.phone.trim()) {
      newErrors.phone = "Phone Number is required.";
    } else if (!phoneRegex.test(formData.phone.trim())) {
      newErrors.phone = "Please enter a valid phone number.";
    }
    
    if (!formData.email.trim()) {
      newErrors.email = "Email Address is required.";
    } else if (!emailRegex.test(formData.email.trim())) {
      newErrors.email = "Please enter a valid email address.";
    }

    if (!formData.name.trim()) {
      newErrors.name = "Full Name is required.";
    } else if (!nameRegex.test(formData.name.trim())) {
      newErrors.name = "Please enter a valid full name.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    toast({
      title: "Message Sent!",
      description: "Thank you for contacting us. We'll get back to you within 24 hours.",
    });
    setFormData({ name: "", email: "", phone: "", inquiryType: "", subject: "", message: "" });
    setIsSubmitting(false);
  };

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="py-12 md:py-16 bg-background">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-heading font-bold tracking-tight mb-4 text-foreground">
            Contact Us
          </h1>
          <p className="text-muted-foreground text-base md:text-lg">
            Have questions or need assistance? Our support team is ready to help you with any inquiries about our platform or services.
          </p>
        </div>
      </section>

      {/* 3 Contact Info Cards — centered */}
      <section className="pt-4 pb-10 bg-background">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row gap-6 justify-center max-w-3xl mx-auto">
            {contactInfo.map((info) => (
              <Card
                key={info.title}
                className="flex-1 text-center border border-primary/40 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lg cursor-default"
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 shrink-0">
                      <info.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold">{info.title}</h3>
                  </div>
                  {info.details.map((detail, i) => (
                    <p key={i} className="text-sm text-foreground text-center">{detail}</p>
                  ))}
                  <p className="text-xs text-muted-foreground mt-2 text-center">{info.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Send a Message — centered, light green bg */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-heading font-bold mb-2">Send us a Message</h2>
            <p className="text-muted-foreground">Fill out the form below and we'll get back to you as soon as possible.</p>
          </div>

          <div className="bg-primary/10 rounded-2xl p-6 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              
              
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  placeholder="Your full name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  className={errors.name ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {errors.name && <p className="text-xs font-medium text-destructive mt-1">{errors.name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  className={errors.email ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {errors.email && <p className="text-xs font-medium text-destructive mt-1">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  placeholder="+94 77 123 4567"
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  className={errors.phone ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {errors.phone && <p className="text-xs font-medium text-destructive mt-1">{errors.phone}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="inquiryType">Inquiry Type *</Label>
                <Select
                  value={formData.inquiryType}
                  onValueChange={(value) => handleInputChange("inquiryType", value)}
                >
                  <SelectTrigger className={errors.inquiryType ? "border-destructive focus:ring-destructive" : ""}>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border">
                    {inquiryTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.inquiryType && <p className="text-xs font-medium text-destructive mt-1">{errors.inquiryType}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject *</Label>
                <Input
                  id="subject"
                  placeholder="Brief subject of your inquiry"
                  value={formData.subject}
                  onChange={(e) => handleInputChange("subject", e.target.value)}
                  className={errors.subject ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {errors.subject && <p className="text-xs font-medium text-destructive mt-1">{errors.subject}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message *</Label>
                <Textarea
                  id="message"
                  placeholder="Please describe your inquiry in detail..."
                  rows={5}
                  value={formData.message}
                  onChange={(e) => handleInputChange("message", e.target.value)}
                  className={errors.message ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {errors.message && <p className="text-xs font-medium text-destructive mt-1">{errors.message}</p>}
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Sending..." : (
                  <>
                    Send Message
                    <Send className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-12 md:py-16 bg-primary/10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Find quick answers to common questions about our platform and services
            </p>
          </div>
          <div className="max-w-3xl mx-auto">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{faq.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* Still Have Questions CTA */}
      <section className="py-12 md:py-16 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">
            Still Have Questions?
          </h2>
          <p className="text-primary-foreground/80 max-w-3xl mx-auto mb-8 text-sm md:text-base">
            Our dedicated support team is always ready to help you with any questions or concerns. Don't hesitate to reach out!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="tel:+94112345678">
              <Button
                size="lg"
                className="bg-black hover:bg-black/80 text-white transition-all duration-200 hover:scale-105 hover:shadow-lg"
              >
                <Phone className="mr-2 h-4 w-4" />
                Call Us Now
              </Button>
            </a>
            <a href="mailto:support@ayurvedicdoctor.lk">
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-white text-white bg-white/10 hover:bg-white/20 transition-all duration-200 hover:scale-105"
              >
                <Mail className="mr-2 h-4 w-4" />
                Email Support
              </Button>
            </a>
          </div>
        </div>
      </section>
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
