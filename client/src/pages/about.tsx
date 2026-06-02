import { useState, useEffect } from "react";
import {
  Heart,
  Leaf,
  Shield,
  Award,
  Target,
  Globe,
  ArrowUp
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PublicLayout } from "@/components/layout/public-layout";

const values = [
  {
    icon: Heart,
    title: "Patient-Centered Care",
    description: "We prioritize the well-being of every patient, ensuring personalized treatment plans that address individual health needs.",
  },
  {
    icon: Leaf,
    title: "Traditional Wisdom",
    description: "We preserve and promote the ancient knowledge of Ayurveda, passed down through generations of Sri Lankan healers.",
  },
  {
    icon: Shield,
    title: "Trust & Safety",
    description: "All doctors on our platform are verified professionals with proper certifications and credentials.",
  },
  {
    icon: Globe,
    title: "Accessibility",
    description: "Making quality Ayurvedic healthcare accessible to everyone, anywhere in Sri Lanka through online consultations.",
  },
];

export default function AboutPage() {
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
        
        <div className="container mx-auto px-4 py-8 md:py-10 lg:pt-14 relative">
          <div className="max-w-3xl mx-auto text-center">
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold tracking-tight mb-4">
              About <span className="text-primary">Ayurvedic Doctor</span>
            </h1>
            
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              Bridging ancient Ayurvedic wisdom with modern healthcare accessibility. 
              <br />
              We connect patients with verified Ayurvedic practitioners across Sri Lanka.
            </p>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="mb-10">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12">
            <Card className="border-primary/20 bg-primary/20 dark:bg-card">
              <CardContent className="p-8 flex flex-col items-center text-center">
                <div className="flex items-center gap-5">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full border border-primary/50 mb-6">
                    <Target className="h-7 w-7 text-primary" />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-heading font-bold mb-4">Our Mission</h2>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  To make quality Ayurvedic healthcare accessible to every Sri Lankan by connecting 
                  them with verified practitioners through a seamless digital platform. We believe 
                  in preserving the rich heritage of traditional medicine while embracing technology 
                  to serve patients better.
                </p>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-primary/20 dark:bg-card">
              <CardContent className="p-8 flex flex-col items-center text-center">
                <div className="flex items-center gap-5">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full border border-primary/50 mb-6">
                    <Award className="h-7 w-7 text-primary" />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-heading font-bold mb-4">Our Vision</h2>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  To become Sri Lanka's most trusted platform for Ayurvedic healthcare, where 
                  patients can find the right practitioner for their needs and doctors can grow 
                  their practice while delivering exceptional care. We envision a future where 
                  traditional medicine thrives alongside modern healthcare.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-10 bg-primary/20 dark:bg-card">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">Our Story</h2>
            <p className="text-muted-foreground">
              How we started and where we're heading
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <p className="text-muted-foreground leading-relaxed mb-6">
              AyurvedicDoctor was born from a simple observation: while Sri Lanka has a rich 
              tradition of Ayurvedic medicine with thousands of skilled practitioners, patients 
              often struggled to find the right doctor for their specific needs. The gap between 
              traditional healers and modern patients was growing.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-6">
              In 2020, our founder Dr. Anura Jayasinghe, with over three decades of experience in 
              Ayurvedic medicine, partnered with technology experts to create a platform that would 
              bridge this gap. The goal was simple: make it easy for anyone in Sri Lanka to find, 
              book, and consult with verified Ayurvedic practitioners.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Today, AyurvedicDoctor serves over 50,000 patients with a network of 500+ verified 
              doctors across 25+ cities. We've facilitated over 100,000 appointments and continue 
              to grow, driven by our commitment to making traditional healthcare accessible to all.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">
              Our Values
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              The principles that guide everything we do
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value) => (
              <Card key={value.title} className="text-center dark:bg-card border-primary/50 bg-primary/20">
                <CardContent className="p-6">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full border border-primary/50 mb-4">
                    <value.icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{value.title}</h3>
                  <p className="text-sm text-muted-foreground">{value.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-10 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">
              Impact in Numbers
            </h2>
            <p className="text-primary-foreground/80 max-w-2xl mx-auto">
              The difference we're making in Sri Lankan healthcare
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            {[
              { value: "500+", label: "Verified Doctors" },
              { value: "50,000+", label: "Happy Patients" },
              { value: "100,000+", label: "Appointments" },
              { value: "25+", label: "Cities Covered" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl md:text-4xl font-bold mb-2">{stat.value}</p>
                <p className="text-primary-foreground/80 text-sm">{stat.label}</p>
              </div>
            ))}
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