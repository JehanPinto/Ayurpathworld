import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import {
  Search,
  Video,
  Calendar,
  Shield,
  ArrowRight,
  ArrowUp,
  CheckCircle,
  Users,
  Award,
  Loader2,
  MapPin
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PublicLayout } from "@/components/layout/public-layout";
import { StarRating } from "@/components/ui/star-rating";
import type { DoctorWithDetails } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AnimatedStat } from "@/components/ui/animated-stat";
import HomeAnimation from "@/components/ui/home-animation";
import { toast } from "@/hooks/use-toast";

const testimonials = [
  {
    id: "1",
    name: "Sanduni Wickramasinghe",
    initials: "SW",
    text: "The booking process was so easy! I found an excellent Ayurvedic doctor near me and got an appointment the same day.",
    rating: 5,
  },
  {
    id: "2",
    name: "Mahesh Jayawardena",
    initials: "MJ",
    text: "Online consultations have been a game-changer. I can now get expert Ayurvedic advice from the comfort of my home.",
    rating: 5,
  },
  {
    id: "3",
    name: "Priya Nanayakkara",
    initials: "PN",
    text: "Finally, a platform that makes traditional medicine accessible. The doctors are verified and truly knowledgeable.",
    rating: 5,
  },
];

const stats = [
  { label: "Verified Doctors", value: "500+", icon: Award },
  { label: "Happy Patients", value: "50,000+", icon: Users },
  { label: "Appointments Booked", value: "100,000+", icon: Calendar },
  { label: "Cities Covered", value: "25+", icon: CheckCircle },
];

const steps = [
  {
    step: 1,
    title: "Search & Discover",
    description: "Browse through verified Ayurvedic doctors by specialization, location, or availability.",
    icon: Search,
  },
  {
    step: 2,
    title: "Book Appointment",
    description: "Select your preferred date, time, and consultation type - online or in-person.",
    icon: Calendar,
  },
  {
    step: 3,
    title: "Get Consultation",
    description: "Meet your doctor, receive personalized treatment, and access your prescriptions digitally.",
    icon: Video,
  },
];

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

export default function HomePage() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Search input Debouncing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch live search results from Backend
  const { data: searchResults = [], isLoading: isSearching } = useQuery<DoctorWithDetails[]>({
    queryKey: ["/api/doctors/search", debouncedQuery],
    queryFn: async () => {
      const res = await fetch(`/api/doctors/search?q=${encodeURIComponent(debouncedQuery)}`);
      if (!res.ok) throw new Error("Failed to search");
      return res.json();
    },
    enabled: debouncedQuery.length >= 2,
  });

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) {
      toast({
        title: "Search Criteria Required",
        description: "Please enter a specialization, doctor name, or location to browse.",
        variant: "destructive",
      });
      return;
    }

    if (searchQuery.trim().length < 2) {
      toast({
        title: "Search Term Too Short",
        description: "Please enter at least 2 characters to search.",
        variant: "destructive",
      });
      return;
    }

    setIsDropdownOpen(false);
    setLocation(`/doctors?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  const handleSeeAllResults = () => {
    setIsDropdownOpen(false);
    setLocation(`/doctors?q=${encodeURIComponent(debouncedQuery)}`);
  };

  return (
    <PublicLayout>
      <section className="relative bg-gradient-to-b from-primary/5 via-background to-background">
        
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] z-0" />
        <div className="absolute inset-0 z-0 hidden lg:block bg-gradient-to-r from-transparent via-background/50 dark:via-background/80 to-background pointer-events-none" />

        <div className="container relative z-10 mx-auto px-4 py-12 sm:py-16 lg:py-20 xl:py-28 flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-8 xl:gap-16 min-h-[calc(100vh-80px)]">
          
          {/* Left Side: Animation */}
          <div className="w-full lg:w-1/2 flex justify-center lg:justify-start items-center max-sm:overflow-hidden max-sm:pb-4">
            <HomeAnimation />
          </div>

          {/* Right Side: Heading, Search, Badges */}
          <div className="w-full lg:w-1/2 flex flex-col items-center lg:items-end text-center lg:text-right mt-4 lg:mt-0">
            
            <h1 className="text-4xl sm:text-[50px] md:text-[60px] lg:text-[70px] xl:text-[80px] font-heading font-extrabold tracking-tight mb-4 text-foreground leading-[1.1]">
              Find & Book <br className="hidden sm:block" />
              <span className="text-primary">Ayurvedic Doctors</span> <br className="block sm:hidden" />
              Near You
            </h1>
            
            <p className="text-muted-foreground text-base sm:text-lg md:text-xl max-w-xl mb-8 lg:ml-auto lg:mr-0">
              Discover trusted Ayurvedic practitioners, book appointments online or via phone in-person, and experience holistic healthcare rooted in ancient wisdom.
            </p>

            <div className="relative mb-6 w-full max-w-xl lg:ml-auto lg:mr-0">
              <form onSubmit={handleSearchSubmit} className="relative z-50 w-full">
                <div className="flex items-center bg-card border border-primary/30 rounded-xl overflow-hidden shadow-lg hover:border-primary/60 transition-colors focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20">
                  <input
                    placeholder="Search doctors, specializations, or locations..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    className="flex-1 h-14 px-5 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-sm sm:text-base"
                    data-testid="input-hero-search"
                    autoComplete="off"
                  />
                  <button
                    type="submit"
                    className="h-12 w-14 sm:w-16 bg-primary hover:bg-primary/90 flex items-center justify-center shrink-0 transition-colors m-1 rounded-lg shadow-sm"
                    data-testid="button-hero-search"
                  >
                    {isSearching ? (
                      <Loader2 className="h-5 w-5 text-primary-foreground animate-spin" />
                    ) : (
                      <Search className="h-5 w-5 text-primary-foreground" />
                    )}
                  </button>
                </div>
              </form>
                
              {/* Search results dropdown */}
              {isDropdownOpen && debouncedQuery.length >= 2 && (
                <>
                  <div 
                    className="fixed inset-0 z-[60]" 
                    onClick={() => setIsDropdownOpen(false)}
                  />
                  
                  <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-card border border-border rounded-xl shadow-2xl z-[100] overflow-hidden max-h-[350px] overflow-y-auto scrollbar-thin text-left">
                    {searchResults.length > 0 ? (
                      <div className="flex flex-col">
                        {searchResults.map((doctor) => (
                          <div
                            key={doctor.id}
                            onClick={() => {
                              setLocation(`/doctors/${doctor.id}`);
                              setIsDropdownOpen(false);
                            }}
                            className="flex items-center gap-3 p-4 hover:bg-muted cursor-pointer border-b border-border last:border-0 transition-colors"
                          >
                            <Avatar className="h-10 w-10 border border-primary/20 shrink-0">
                              <AvatarImage src={doctor.user.profileImage || ""} />
                              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                                {getInitials(doctor.user.fullName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-foreground font-medium text-sm truncate">
                                {doctor.user.fullName.startsWith("Dr") ? doctor.user.fullName : `Dr. ${doctor.user.fullName}`}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                <span className="text-primary/90 font-medium truncate max-w-[120px]">
                                  {doctor.specializations?.[0]?.name || "Ayurvedic Doctor"}
                                </span>
                                {doctor.hospitals?.[0] && (
                                  <>
                                    <span>•</span>
                                    <span className="flex items-center truncate">
                                      <MapPin className="h-3 w-3 mr-1 shrink-0" />
                                      {doctor.hospitals[0].city}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-50" />
                          </div>
                        ))}
                        
                        <button 
                          type="submit"
                          onClick={handleSeeAllResults}
                          className="w-full p-3 text-sm text-primary font-medium hover:bg-muted text-center transition-colors border-t border-border"
                        >
                          See all results for "{debouncedQuery}"
                        </button>
                      </div>
                    ) : !isSearching ? (
                      <div className="p-6 text-center text-muted-foreground text-sm">
                        No doctors found matching "{debouncedQuery}"
                      </div>
                    ) : null}
                  </div>
                </>
              )}
            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap items-center justify-center lg:justify-end gap-4 sm:gap-6 text-xs sm:text-sm text-muted-foreground font-medium w-full lg:ml-auto lg:mr-0">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span>Verified Doctors</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Video className="h-4 w-4 text-primary" />
                <span>Online Consultations</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-primary" />
                <span>Secure Payments</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Stats bar */}
      <div className="bg-primary/20 relative">
        <div className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-center">
            {stats.map((stat) => (
              <AnimatedStat 
                key={stat.label} 
                value={stat.value} 
                label={stat.label} 
                icon={stat.icon} 
              />
            ))}
          </div>
        </div>
      </div>

      {/* How It Works */}
      <section className="py-12 md:py-16 lg:py-24 dark:bg-background/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-heading font-bold mb-3 dark:text-white">
              How It Works
            </h2>
            <p className="dark:text-muted-foreground max-w-2xl mx-auto text-base">
              Book your Ayurvedic consultation in just a few simple steps
            </p>
          </div>

          {/* Desktop: flex row with connectors between cards */}
          <div className="flex flex-col lg:flex-row items-center lg:items-stretch justify-center gap-4 sm:gap-6 lg:gap-0 w-full max-w-6xl mx-auto">
            {steps.map((item, index) => (
              <div key={item.step} className="contents">
                
                {/* Card */}
                <div className="w-full sm:w-[85%] md:w-[75%] lg:w-auto lg:flex-1 relative flex flex-col items-center text-center rounded-3xl p-8 lg:p-10 border border-primary/20 dark:border-white/10 bg-card shadow-sm hover:shadow-xl transition-all duration-500 lg:hover:-translate-y-3 hover:border-primary/50 group">
                  
                  {/* Icon Container */}
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-primary/10 dark:bg-primary/5 flex items-center justify-center mx-auto mb-6 md:mb-8 transition-transform duration-500 group-hover:scale-110 group-hover:bg-primary relative">
                    <item.icon className="h-10 w-10 md:h-12 md:w-12 text-primary group-hover:text-primary-foreground transition-colors duration-500" />
                    
                    {/* Floating Step Number */}
                    <div className="absolute -top-1 -right-2 md:-top-2 md:-right-2 w-8 h-8 md:w-9 md:h-9 rounded-full bg-amber-500 flex items-center justify-center text-white font-black text-sm md:text-base shadow-lg border-4 border-card transition-colors duration-500">
                      {item.step}
                    </div>
                  </div>

                  <h3 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-foreground group-hover:text-primary transition-colors duration-300">
                    {item.title}
                  </h3>
                  <p className="text-muted-foreground text-sm md:text-base leading-relaxed max-w-sm mx-auto">
                    {item.description}
                  </p>
                </div>

                {/* Connectors */}
                {index < steps.length - 1 && (
                  <>
                    {/* Mobile & Tablet: Vertical Arrow (පහළට පෙන්වන ඊතලය) */}
                    <div className="flex lg:hidden justify-center items-center py-3 shrink-0 animate-bounce">
                       <ArrowRight className="h-6 w-6 text-primary/40 rotate-90" />
                    </div>
                    
                    {/* Laptop & Desktop: Horizontal Line with Arrow (හරස් අතට ඊතලය) */}
                    <div className="hidden lg:flex items-center shrink-0 w-8 xl:w-16 relative">
                       <div className="h-[2px] w-full bg-primary/30 dark:bg-white/10" />
                       <ArrowRight className="h-6 w-6 text-primary/50 absolute right-0 translate-x-1/2 bg-background rounded-full" />
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-12 md:py-16 lg:py-24 bg-primary/20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-heading font-bold mb-3 text-foreground">
              What Our Patients Say
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-base">
              Join thousands of satisfied patients who trust AyurvedicDoctor
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial) => (
              <Card
                key={testimonial.id}
                className="rounded-xl border border-white/10 bg-card group cursor-default transition-all duration-300 hover:-translate-y-2 hover:border-primary/50 hover:shadow-[0_8px_32px_rgba(46,158,46,0.2)]"
              >
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="ring-2 ring-primary/30 group-hover:ring-primary transition-all duration-300">
                      <AvatarFallback className="bg-primary/20 text-primary font-semibold group-hover:bg-primary group-hover:text-white transition-all duration-300">
                        {testimonial.initials}
                      </AvatarFallback>
                    </Avatar>
                    <p className="font-semibold text-foreground">{testimonial.name}</p>
                  </div>
                  <div className="flex mb-3">
                    <StarRating rating={testimonial.rating} size="sm" />
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed transition-colors duration-300">"{testimonial.text}"</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA — Are You a Practitioner */}
      <section className="py-12 md:py-16 lg:py-24 bg-primary">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-heading font-bold mb-3 md:mb-4 text-white">
            Are You an Ayurvedic Practitioner?
          </h2>
          <p className="text-white/80 max-w-2xl mx-auto mb-6 md:mb-8 text-sm md:text-base px-2">
            Join our platform to reach thousands of patients, manage your practice efficiently,
            and grow your Ayurvedic practice online.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/doctor/register">
              <Button size="lg" className="bg-sidebar dark:text-white text-black border-none w-full sm:w-auto">
                Register as a Doctor
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/about">
              <Button
                size="lg"
                variant="outline"
                className="border-white/40 text-white bg-transparent hover:bg-white/10 w-full sm:w-auto"
              >
                Learn More
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <button
        onClick={scrollToTop}
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