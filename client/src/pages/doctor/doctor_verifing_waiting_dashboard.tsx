import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  ShieldCheck, 
  Clock, 
  Mail, 
  ArrowLeft, 
  LifeBuoy,
  FileSearch,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Loader2,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DoctorWaitingVerification() {
  const [, setLocation] = useLocation();

  const userEmail = typeof window !== 'undefined' ? localStorage.getItem("pending_doctor_email") : null;

  const [isVerified, setIsVerified] = useState(false);

  const { data: statusData, isFetching } = useQuery<{ status?: string }>({
    queryKey: [`/api/doctors/status/${userEmail}`],
    enabled: !!userEmail && !isVerified,
    refetchInterval: 5000, 
    retry: false,
  });

  useEffect(() => {
    if (statusData?.status === "verified") {
      setIsVerified(true);
    }
  }, [statusData]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 md:p-8 overflow-hidden relative selection:bg-primary/20">
      
      {/* Background Atmospheric Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] md:w-[40vw] md:h-[40vw] rounded-full bg-primary/10 mix-blend-normal blur-[80px] md:blur-[120px] animate-pulse" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[70vw] h-[70vw] md:w-[40vw] md:h-[40vw] rounded-full bg-secondary/10 mix-blend-normal blur-[80px] md:blur-[120px] animate-[pulse_6s_ease-in-out_infinite]" />
      </div>

      {/* Main Glassmorphism Container */}
      <div className={`w-full max-w-[95vw] sm:max-w-[85vw] md:max-w-3xl lg:max-w-4xl glass bg-card/80 border shadow-2xl rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 lg:p-14 relative z-10 transition-all duration-1000 ease-in-out transform flex flex-col ${
        isVerified ? 'border-primary/50 shadow-[0_20px_60px_-15px_rgba(var(--primary),0.2)]' : 'border-border/50'
      }`}>
        
        {/* Header / Logo */}
        <div className="flex justify-center mb-2 relative shrink-0">
          <div className="flex items-center gap-3">
            <img src="/logo-light.png" alt="AyurPath" className="h-8 md:h-10 dark:hidden" />
            <img src="/logo-dark.png" alt="AyurPath" className="h-8 md:h-10 hidden dark:block" />
          </div>
        </div>

        {/* Scrollable Content Area for smaller screens */}
        <div className="flex flex-col items-center text-center w-full flex-1 overflow-y-auto custom-scrollbar scrollbar-hide py-2">
          
          {/* Central Animated Icon Container */}
          <div className="relative mb-8 md:mb-10 group shrink-0 mt-8">
            
            {/* Processing Rings (Hidden when verified) */}
            <div className={`absolute inset-[-15px] rounded-full border-2 border-dashed border-primary/40 animate-[spin_8s_linear_infinite] transition-opacity duration-700 ${isVerified ? 'opacity-0 scale-150' : 'opacity-100'}`} />
            <div className={`absolute inset-[-30px] rounded-full border-2 border-dotted border-secondary/40 animate-[spin_12s_linear_infinite_reverse] transition-opacity duration-700 ${isVerified ? 'opacity-0 scale-150 hidden md:block' : 'opacity-100 hidden md:block'}`} />
            
            {/* Main Icon Circle */}
            <div className={`w-28 h-28 md:w-36 md:h-36 rounded-full flex items-center justify-center transition-all duration-700 relative z-10 ${
              isVerified 
                ? "bg-primary shadow-[0_0_60px_hsl(var(--primary)/0.4)] scale-110" 
                : "bg-card border border-primary/20 shadow-[0_0_40px_hsl(var(--primary)/0.1)]"
            }`}>
              {isVerified ? (
                <CheckCircle2 className="w-14 h-14 md:w-16 md:h-16 text-primary-foreground animate-in zoom-in duration-500" />
              ) : (
                <ShieldCheck className="w-14 h-14 md:w-16 md:h-16 text-primary animate-pulse" />
              )}
            </div>
            
            {/* Floating secondary icon (Hidden when verified) */}
            <div className={`absolute z-[100] -bottom-1 -right-1 md:-bottom-2 md:-right-2 w-12 h-12 md:w-14 md:h-14 bg-card rounded-full p-1 shadow-xl border border-border transition-all duration-500 ${isVerified ? 'scale-0 opacity-0' : 'animate-bounce scale-100 opacity-100'}`}>
              <div className="w-full h-full bg-secondary/15 rounded-full flex items-center justify-center text-secondary">
                <FileSearch className="w-5 h-5 md:w-6 md:h-6" />
              </div>
            </div>

            {/* Sparkles for verified state */}
            {isVerified && (
              <>
                <Sparkles className="absolute -top-4 -left-4 w-6 h-6 md:w-8 md:h-8 text-secondary animate-ping" />
                <Sparkles className="absolute bottom-4 -right-6 w-5 h-5 md:w-6 md:h-6 text-primary animate-pulse" />
              </>
            )}
          </div>

          {/* Status Badge */}
          <div className={`shrink-0 inline-flex items-center justify-center gap-2 md:gap-3 px-4 py-1.5 md:px-5 md:py-2 rounded-full text-xs md:text-sm font-bold mb-6 md:mb-8 shadow-sm transition-colors duration-500 ${
            isVerified
              ? "bg-primary/10 text-primary border border-primary/30"
              : "bg-secondary/10 text-secondary border border-secondary/30"
          }`}>
            <span className="relative flex h-2.5 w-2.5 md:h-3 md:w-3">
              {!isVerified && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 md:h-3 md:w-3 ${isVerified ? 'bg-primary' : 'bg-secondary'}`}></span>
            </span>
            <span className="uppercase tracking-widest text-[10px] md:text-xs">
              {isVerified ? "Verification Complete" : "Verification in progress"}
            </span>
          </div>

          {/* Title & Description */}
          <div className="max-w-2xl mx-auto space-y-3 md:space-y-4 mb-8 md:mb-10 shrink-0">
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-foreground font-heading tracking-tight transition-all duration-500 leading-tight px-2">
              {isVerified ? "Welcome to AyurPath!" : "Reviewing Your Profile"}
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm md:text-base leading-relaxed transition-all duration-500 px-2 sm:px-6">
              {isVerified 
                ? "Your medical credentials have been successfully approved. Your account is fully activated and you can now log in to manage your practice."
                : "Our administration team is currently reviewing your medical credentials. This strict process ensures platform security and patient safety."}
            </p>
          </div>

          {/* Dynamic Bottom Section */}
          <div className="w-full relative min-h-[160px] md:min-h-[180px] flex items-center justify-center mt-auto">
            
            {/* PENDING STATE UI: Timeline & Info */}
            <div className={`absolute inset-0 w-full transition-all duration-700 ease-in-out flex flex-col items-center justify-center ${isVerified ? 'translate-y-[20%] opacity-0 pointer-events-none scale-95' : 'translate-y-0 opacity-100 scale-100'}`}>
              
              {/* Progress Stepper */}
              <div className="flex items-center justify-between w-full max-w-[280px] sm:max-w-md lg:max-w-lg mx-auto mb-6 md:mb-8">
                <div className="flex flex-col items-center gap-1.5 md:gap-2">
                  <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-md">
                    <Check className="w-3 h-3 md:w-4 md:h-4" />
                  </div>
                  <span className="text-[9px] md:text-[10px] font-bold text-foreground uppercase tracking-wide">Registered</span>
                </div>
                <div className="flex-1 h-1 bg-primary/20 mx-2 md:mx-3 rounded-full overflow-hidden">
                  <div className="h-full bg-primary w-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-primary/40 via-primary to-primary/40" style={{ backgroundSize: '200% 100%' }} />
                </div>
                <div className="flex flex-col items-center gap-1.5 md:gap-2">
                  <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-secondary/20 border-2 border-secondary text-secondary flex items-center justify-center shadow-md relative">
                    <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" />
                  </div>
                  <span className="text-[9px] md:text-[10px] font-bold text-secondary uppercase tracking-wide">Reviewing</span>
                </div>
                <div className="flex-1 h-1 bg-muted mx-2 md:mx-3 rounded-full" />
                <div className="flex flex-col items-center gap-1.5 md:gap-2 opacity-50">
                  <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-muted border-2 border-muted-foreground/30 text-muted-foreground flex items-center justify-center">
                    <ShieldCheck className="w-3 h-3 md:w-4 md:h-4" />
                  </div>
                  <span className="text-[9px] md:text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Verified</span>
                </div>
              </div>

              {/* Info Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 w-full max-w-[280px] sm:max-w-2xl mx-auto">
                <div className="flex items-center gap-3 md:gap-4 p-3 md:p-5 rounded-2xl border border-border bg-card/60 backdrop-blur-md shadow-sm hover:shadow-md hover:border-primary/30 transition-all group">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-secondary/15 text-secondary flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Clock className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div className="text-left">
                    <p className="text-[9px] md:text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">Estimated Time</p>
                    <p className="text-sm sm:text-base md:text-lg font-black text-foreground">24–48 Hours</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 md:gap-4 p-3 md:p-5 rounded-2xl border border-border bg-card/60 backdrop-blur-md shadow-sm hover:shadow-md hover:border-primary/30 transition-all group">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Mail className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div className="text-left">
                    <p className="text-[9px] md:text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">Notification</p>
                    <p className="text-sm sm:text-base md:text-lg font-black text-foreground">Via Email</p>
                  </div>
                </div>
              </div>
            </div>

            {/* VERIFIED STATE UI: Login Button */}
            <div className={`absolute inset-0 w-full flex flex-col items-center justify-center transition-all duration-700 ease-in-out ${isVerified ? 'translate-y-0 opacity-100 scale-100 delay-300' : 'translate-y-[-20%] opacity-0 pointer-events-none scale-95'}`}>
              <Button 
                onClick={() => setLocation("/login")}
                size="lg" 
                className="rounded-full px-8 md:px-10 h-12 md:h-14 w-full sm:w-auto max-w-[280px] sm:max-w-none bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm md:text-base shadow-[0_10px_30px_-10px_rgba(var(--primary),0.5)] hover:shadow-[0_15px_35px_-10px_rgba(var(--primary),0.6)] hover:-translate-y-1 transition-all duration-300 group"
              >
                Proceed to Login <ArrowRight className="ml-2 w-4 h-4 md:w-5 md:h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>

          </div>
        </div>

        {/* Footer Actions (Only visible when pending) */}
        <div className={`flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 md:gap-6 w-full pt-6 md:pt-8 mt-4 border-t border-border/40 transition-all duration-500 shrink-0 ${isVerified ? 'opacity-0 pointer-events-none h-0 pt-0 mt-0 border-0 overflow-hidden' : 'opacity-100'}`}>
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/login")} 
            className="rounded-full px-6 h-10 md:h-12 text-muted-foreground hover:text-foreground font-semibold hover:bg-muted/50 transition-colors w-full sm:w-auto text-xs md:text-sm"
          >
            <ArrowLeft className="mr-2 w-4 h-4" /> Back to Login
          </Button>
          
          <Link href="/contact" className="w-full sm:w-auto">
            <Button 
              variant="secondary" 
              className="rounded-full px-6 md:px-8 h-10 md:h-12 bg-primary/10 text-primary hover:bg-primary/20 border-0 font-bold transition-colors w-full text-xs md:text-sm"
            >
              <LifeBuoy className="mr-2 w-4 h-4" /> Contact Support
            </Button>
          </Link>

          {/* SENSOR LIGHT INDICATOR (High-Tech Auto-Updating) */}
          <div className="w-full sm:w-auto flex justify-center mt-4 sm:mt-0 sm:absolute sm:right-0 sm:pr-8 z-20">
            <div className="group flex items-center rounded-full bg-card/40 hover:bg-card/90 border border-border/50 p-1.5 backdrop-blur-md shadow-sm transition-all duration-500 cursor-crosshair overflow-hidden">
              
              {/* LED Sensor Node */}
              <div className="relative flex items-center justify-center w-5 h-5 shrink-0">
                {isFetching ? (
                  <>
                    {/* Active State (Fetching): Fast Ping & Bright Laser Glow */}
                    <span className="absolute inset-0 rounded-full bg-primary/80 animate-ping duration-500" />
                    <div className="absolute inset-0 rounded-full bg-primary/40 blur-[3px]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_12px_3px_hsl(var(--primary))]" />
                  </>
                ) : (
                  <>
                    {/* Idle State: Slow breathe & Dim Glow */}
                    <span className="absolute inset-0 rounded-full bg-primary/40 animate-[ping_3s_ease-in-out_infinite]" />
                    <div className="w-2 h-2 rounded-full bg-primary/70 shadow-[0_0_8px_1px_hsl(var(--primary)/0.6)]" />
                  </>
                )}
              </div>

              {/* Hover Text Reveal (Expands Smoothly like a Laser Gate) */}
              <div className="max-w-0 opacity-0 group-hover:max-w-[120px] group-hover:opacity-100 transition-all duration-500 ease-in-out flex items-center">
                <span className="pl-2 pr-2 text-[9px] md:text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] whitespace-nowrap">
                  {isFetching ? 'Syncing...' : 'Auto-updating'}
                </span>
              </div>
              
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}