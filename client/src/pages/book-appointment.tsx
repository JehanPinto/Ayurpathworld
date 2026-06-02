import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ChevronLeft,
  Calendar,
  Clock,
  Video,
  Building2,
  CreditCard,
  User,
  Loader2,
  CheckCircle,
  BookOpen,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { PublicLayout } from "@/components/layout/public-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingPage } from "@/components/ui/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import {
  PaymentMethod,
  Gender,
  type DoctorWithDetails,
  type AppointmentSlot,
  type TaxEntry,
} from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

// ─── Add PayHere Script dynamically ───────────────────────────────────────────
const loadPayHereScript = () => {
  if (!document.getElementById("payhere-js")) {
    const script = document.createElement("script");
    script.id = "payhere-js";
    script.src = "https://www.payhere.lk/lib/payhere.js";
    script.async = true;
    document.body.appendChild(script);
  }
};

// ─── Schema ───────────────────────────────────────────────────────────────────
const bookingSchema = z.object({
  symptoms: z.string().min(10, "Please describe your symptoms in detail (at least 10 characters)"),
  paymentMethod: z.nativeEnum(PaymentMethod).default(PaymentMethod.ONLINE),
  isForDependent: z.boolean().default(false),
  dependentName: z.string().optional(),
  dependentAge: z.string().optional(),
  dependentGender: z.enum([Gender.MALE, Gender.FEMALE, Gender.OTHER]).optional(),
  dependentContact: z.string().optional(),
  agreeTerms: z.boolean().refine((v) => v === true, "You must agree to the terms"),
}).superRefine((data, ctx) => {
  if (data.isForDependent) {
    if (!data.dependentName?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Dependent name is required", path: ["dependentName"] });
    }
    if (!data.dependentAge?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Age is required", path: ["dependentAge"] });
    }
    if (!data.dependentGender) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Gender is required", path: ["dependentGender"] });
    }
    if (!data.dependentContact?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Contact number is required", path: ["dependentContact"] });
    } else if (!/^07[0-9]{8}$/.test(data.dependentContact)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid Sri Lankan number (07XXXXXXXX)", path: ["dependentContact"] });
    }
  }
});
type BookingInput = z.infer<typeof bookingSchema>;

interface BookingSettings {
  bookingCharges: number;
  taxRate: number;
  stampDutyEnabled: boolean;
}

// ─── Shared progress bar ──────────────────────────────────────────────────────
const STEP_ICONS = [
  <svg key="s" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4l7 18 3-7 7-3L4 4z"/></svg>,
  <svg key="p" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>,
  <svg key="pay" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="6" width="20" height="14" rx="3"/><path d="M2 10h20"/><path d="M6 15h4"/></svg>,
  <svg key="c" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg>,
];
const STEPS = ["Select", "Patient Information", "Payment", "Confirmed"];

function ProgressBar({ current }: { current: number }) {
  return (
    <div className="flex items-start w-full">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-colors ${
              i === current
                ? "bg-primary border-primary text-primary-foreground"
                : i < current
                ? "bg-primary border-primary text-primary-foreground"
                : "bg-background border-border text-muted-foreground"
            }`}>
              {i < current
                ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg>
                : STEP_ICONS[i]}
            </div>
            <span className={`text-xs font-medium whitespace-nowrap ${i <= current ? "text-primary font-semibold" : "text-muted-foreground"}`}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-px mt-[-18px] mx-1 ${i < current ? "bg-primary" : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function BookAppointmentPage() {
  const { doctorId } = useParams();
  const [,] = useLocation();
  const search = typeof window !== "undefined" ? window.location.search : "";
  const params = new URLSearchParams(search);
  const slotId = params.get("slot");
  const { user } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<"details" | "payment" | "confirmation">("details");
  const [bookingComplete, setBookingComplete] = useState(false);

  // Load PayHere script on mount
  useEffect(() => {
    loadPayHereScript();
  }, []);

  const { data: bookingSettings } = useQuery<BookingSettings>({
    queryKey: ["/api/booking-settings"],
    queryFn: async () => {
      const res = await fetch("/api/booking-settings");
      if (!res.ok) throw new Error("Failed to fetch booking settings");
      return res.json();
    },
    staleTime: 0,
  });

  const { data: customTaxes = [] } = useQuery<TaxEntry[]>({
    queryKey: ["/api/tax-entries"],
    queryFn: async () => {
      const res = await fetch("/api/tax-entries");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: doctor, isLoading: doctorLoading } = useQuery<DoctorWithDetails>({
    queryKey: [`/api/doctors/${doctorId}`],
    queryFn: () => apiRequest("GET", `/api/doctors/${doctorId}`),
    enabled: Boolean(doctorId),
  });

  const { data: slot, isLoading: slotLoading, isError: slotError } = useQuery<AppointmentSlot>({
    queryKey: ["/api/slots", slotId],
    queryFn: () => apiRequest("GET", `/api/slots/${slotId}`),
    enabled: Boolean(slotId),
  });

  const form = useForm<BookingInput>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      symptoms: "",
      paymentMethod: PaymentMethod.ONLINE,
      isForDependent: false,
      agreeTerms: false,
    },
  });

  const isForDependent = form.watch("isForDependent");

  // Calculations
  const consultationFee = slot?.consultationType === "online" && doctor?.onlineConsultationFee
    ? doctor.onlineConsultationFee
    : doctor?.consultationFee || 0;

  const bookingCharges = bookingSettings?.bookingCharges ?? 100;
  const taxRate = bookingSettings?.taxRate ?? 4;
  const stampDutyEnabled = bookingSettings?.stampDutyEnabled ?? false;
  const stampDutyAmount = stampDutyEnabled ? Math.round(consultationFee * 0.01) : 0;
  const tax = Math.round(consultationFee * (taxRate / 100));
  const customTaxAmounts = customTaxes.map((t) => ({
    ...t,
    amount: Math.round(consultationFee * (t.rate / 100)),
  }));
  const customTaxTotal = customTaxAmounts.reduce((sum, t) => sum + t.amount, 0);
  const totalAmount = consultationFee + bookingCharges + tax + stampDutyAmount + customTaxTotal;

  const bookingMutation = useMutation({
    mutationFn: async (data: BookingInput) => {
      if (!doctor || !slot || !doctorId) throw new Error("Missing booking information");
      return apiRequest("POST", "/api/appointments", {
        doctorId,
        slotId: slot.id,
        hospitalId: slot.hospitalId ?? undefined,
        consultationType: slot.consultationType,
        symptoms: data.symptoms,
        paymentMethod: data.paymentMethod,
        isForDependent: data.isForDependent,
        dependentName: data.dependentName,
        dependentAge: data.dependentAge ? Number(data.dependentAge) : undefined,
        dependentGender: data.dependentGender,
        dependentContact: data.dependentContact,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Booking Failed", description: error.message || "Unable to complete booking.", variant: "destructive" });
    },
  });

  const onSubmit = async (data: BookingInput) => {
    if (step === "details") {
      setStep("payment");
    } else if (step === "payment") {
      
      // 1. First, create the appointment & payment record in our DB
      bookingMutation.mutate(data, {
        onSuccess: async (appointmentData: any) => {
          
          if (data.paymentMethod === PaymentMethod.AT_CLINIC) {
             setBookingComplete(true);
             setStep("confirmation");
             return;
          }

          try {
          const hashData = (await apiRequest("POST", "/api/payhere/hash", {
            order_id: `booking-${appointmentData.id}`,
            amount: totalAmount, // Pass the raw number, backend will format it
            currency: "LKR",
          })) as { merchant_id: string; hash: string; formattedAmount: string };

          console.log("Hash Data received:", hashData);

          // 3. Configure PayHere Object
          const paymentObj = {
            sandbox: true,
            merchant_id: hashData.merchant_id,
            return_url: window.location.href,
            cancel_url: window.location.href,
            notify_url: "https://localhost:5000/api/payhere/notify",
            order_id: `booking-${appointmentData.id}`,
            items: "AyurPath Consultation",
            amount: hashData.formattedAmount,
            currency: "LKR",
            hash: hashData.hash,
            first_name: user?.fullName?.split(" ")[0] || "Patient",
            last_name: user?.fullName?.split(" ")[1] || "",
            email: user?.email || "",
            phone: user?.phone || "",
            address: user?.address || "Sri Lanka",
            city: user?.city || "Colombo",
            country: "Sri Lanka",
          };

            // 4. Define PayHere Callbacks (Moved OUTSIDE of onSubmit is better, but this works for now)
            (window as any).payhere.onCompleted = function onCompleted(orderId: string) {
              console.log("Payment completed. OrderID:" + orderId);
              setBookingComplete(true);
              setStep("confirmation");
              queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
              queryClient.invalidateQueries({ queryKey: ["/api/patient/dashboard"] });
              toast({ title: "Booking Confirmed!", description: "Payment was successful." });
            };

            (window as any).payhere.onDismissed = async function onDismissed() {
              try {
                await apiRequest("PATCH", `/api/appointments/${appointmentData.id}/payment-failed`, {});
              } catch(e) {
                console.error("Failed to release slot", e);
              }
              
              toast({
                title: "Payment Cancelled",
                description: "You closed the payment window. Your reserved slot has been released.",
                variant: "destructive",
              });
              
              setStep("details");
              queryClient.invalidateQueries({ queryKey: ["/api/slots", slotId] });
            };

            (window as any).payhere.onError = async function onError(error: any) {
              console.error("PayHere Error:", error);
              try {
                await apiRequest("PATCH", `/api/appointments/${appointmentData.id}/payment-failed`, {});
              } catch(e) {
                console.error("Failed to release slot", e);
              }

              toast({ 
                title: "Payment Failed", 
                description: "Your payment was declined. The slot has been released.", 
                variant: "destructive" 
              });
              
              setStep("details");
              queryClient.invalidateQueries({ queryKey: ["/api/slots", slotId] });
            };

            // 5. Trigger the popup!
            (window as any).payhere.startPayment(paymentObj);

          } catch (error) {
            console.error("Failed to initiate PayHere:", error);
            toast({
              title: "Gateway Error",
              description: "Failed to connect to payment gateway.",
              variant: "destructive",
            });
          }
        },
      });
    }
  };

  const formatFee = (fee: number) =>
    new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", minimumFractionDigits: 0 }).format(fee);

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const stepIndex = step === "details" ? 1 : step === "payment" ? 2 : 3;

  if (doctorLoading || slotLoading) {
    return (
      <PublicLayout showHeader={false}>
        <LoadingPage message="Loading booking details..." />
      </PublicLayout>
    );
  }

  if (!doctor || !slot || slotError) {
    return (
      <PublicLayout showHeader={false}>
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">Booking not found</h1>
          <Link href="/patient/find-doctors"><Button>Find Doctors</Button></Link>
        </div>
      </PublicLayout>
    );
  }

  // ── Confirmation screen ──────────────────────────────────────────────────
  if (bookingComplete) {
    const drName = doctor.user.fullName.startsWith("Dr") ? doctor.user.fullName : `Dr. ${doctor.user.fullName}`;
    return (
      <PublicLayout showHeader={false} showFooter={false}>
        <div className="min-h-screen bg-background">
          <div className="max-w-5xl mx-auto px-4 py-6">

            {/* Top bar */}
            <div className="flex items-center justify-between mb-8">
              <Link href={`/doctors/${doctorId}`}>
                <button className="flex items-center gap-1.5 text-sm font-medium border border-border bg-background text-foreground rounded-lg px-3 py-1.5 hover:bg-muted transition-colors">
                  <ChevronLeft className="h-4 w-4" />
                  Back to Doctors
                </button>
              </Link>
              <img src="/logo-light.png" alt="AyurPath" className="h-8 w-auto dark:hidden" />
              <img src="/logo-dark.png" alt="AyurPath" className="h-8 w-auto hidden dark:block" />
            </div>

            {/* Progress bar — all 4 steps complete */}
            <div className="bg-card border border-border rounded-2xl px-8 py-5 mb-8">
              <ProgressBar current={3} />
            </div>

            {/* Confirmation card — centered */}
            <div className="flex justify-center">
              <div className="w-full max-w-xl bg-primary/5 border border-primary/20 rounded-2xl p-8 text-center">

                {/* Big checkmark */}
                <div className="w-24 h-24 rounded-full border-4 border-primary flex items-center justify-center mx-auto mb-6 bg-primary/10">
                  <CheckCircle className="h-12 w-12 text-primary" />
                </div>

                <h1 className="text-2xl font-bold mb-2 text-foreground">Booking Confirmed!</h1>
                <p className="text-muted-foreground mb-6 text-sm">
                  your appointment has been successfully booked.<br />
                  You will receive a confirmation via SMS and email.
                </p>

                {/* Appointment details card */}
                <div className="bg-background rounded-xl border border-border p-5 mb-6 text-left shadow-sm">
                  {/* Doctor row */}
                  <div className="flex items-center gap-3 mb-4">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={doctor.user.profileImage} />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                        {getInitials(doctor.user.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          <p className="font-semibold text-sm text-foreground">{drName}</p>
                          <p className="text-xs text-muted-foreground">{doctor.specializations[0]?.name}</p>
                        </div>
                        {doctor.status === "verified" && (
                          <span className="flex items-center gap-1 text-xs text-primary font-medium">
                            <User className="h-3 w-3" />
                            Verified Doctor
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border pt-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium text-foreground">{format(new Date(slot.date), "EEEE, MMMM d, yyyy")}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium text-foreground">{slot.startTime} - {slot.endTime}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {slot.consultationType === "online"
                        ? <><Video className="h-4 w-4 text-muted-foreground shrink-0" /><span className="font-medium text-foreground">Online Consultation</span></>
                        : <><Building2 className="h-4 w-4 text-muted-foreground shrink-0" /><span className="font-medium text-foreground">In-Person Consultation</span></>}
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col gap-3">
                  <Link href="/patient/appointments">
                    <button className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 rounded-xl transition-colors shadow-sm">
                      View My Appointments
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7M17 7H7M17 7v10"/></svg>
                    </button>
                  </Link>
                  <Link href="/patient/find-doctors">
                    <button className="w-full flex items-center justify-center gap-2 border border-border bg-background text-foreground font-semibold py-3 rounded-xl hover:bg-muted transition-colors">
                      Find More Doctors
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7M17 7H7M17 7v10"/></svg>
                    </button>
                  </Link>
                </div>
              </div>
            </div>

          </div>
        </div>
      </PublicLayout>
    );
  }

  // ── Booking summary sidebar (shared between steps) ───────────────────────
  const BookingSummary = () => (
    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 h-fit shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-foreground">
          <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/>
        </svg>
        <h2 className="font-bold text-foreground">Booking Summary</h2>
      </div>

      {/* Doctor info */}
      <div className="flex items-start gap-3 mb-4">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={doctor.user.profileImage} />
          <AvatarFallback className="bg-primary/20 text-primary text-sm font-bold">
            {getInitials(doctor.user.fullName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <p className="font-semibold text-sm text-foreground">
                {doctor.user.fullName.startsWith("Dr") ? doctor.user.fullName : `Dr. ${doctor.user.fullName}`}
              </p>
              <p className="text-xs text-muted-foreground">{doctor.specializations[0]?.name}</p>
            </div>
            {doctor.status === "verified" && (
              <span className="flex items-center gap-1 text-xs text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                <User className="h-3 w-3" />
                Verified Doctor
              </span>
            )}
          </div>
          {/* Stars */}
          <div className="flex items-center gap-1 mt-1">
            {[1,2,3,4,5].map((star) => (
              <svg key={star} width="12" height="12" viewBox="0 0 24 24"
                fill={star <= Math.round(doctor.averageRating) ? "currentColor" : "none"}
                stroke="currentColor" strokeWidth="2"
                className={star <= Math.round(doctor.averageRating) ? "text-amber-400" : "text-amber-300"}
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            ))}
            <span className="text-xs font-semibold ml-1">{doctor.averageRating.toFixed(1)}</span>
          </div>
        </div>
      </div>

      {/* Date / Time / Type */}
      <div className="space-y-2 py-4 border-t border-primary/20 border-b">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Calendar className="h-4 w-4 text-primary shrink-0" />
          <span>{format(new Date(slot.date), "EEEE, MMMM d, yyyy")}</span>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Clock className="h-4 w-4 text-primary shrink-0" />
          <span>{slot.startTime} - {slot.endTime}</span>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          {slot.consultationType === "online"
            ? <><Video className="h-4 w-4 text-primary shrink-0" /><span>Online Consultation</span></>
            : <><Building2 className="h-4 w-4 text-primary shrink-0" /><span>In-Person Consultation</span></>}
        </div>
      </div>

      {/* Fees */}
      <div className="space-y-2 py-4 border-b border-primary/20">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Consultation Fee</span>
          <span className="font-medium text-foreground">{formatFee(consultationFee)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Booking Charges</span>
          <span className="font-medium text-foreground">{formatFee(bookingCharges)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Tax ({taxRate}%)</span>
          <span className="font-medium text-foreground">{formatFee(tax)}</span>
        </div>
        {stampDutyEnabled && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Stamp Duty (1%)</span>
            <span className="font-medium text-foreground">{formatFee(stampDutyAmount)}</span>
          </div>
        )}
        {customTaxAmounts.map((t) => (
          <div key={t.id} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t.title} ({t.rate}%)</span>
            <span className="font-medium text-foreground">{formatFee(t.amount)}</span>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="flex justify-between items-center pt-4">
        <span className="font-black text-lg text-foreground">Total</span>
        <span className="font-black text-2xl text-primary">{formatFee(totalAmount)}</span>
      </div>
    </div>
  );

  return (
    <PublicLayout showHeader={false} showFooter={false}>
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">

          {/* ── Top bar ── */}
          <div className="flex items-center justify-between mb-8">
            <Link href={`/doctors/${doctorId}`}>
              <button className="flex items-center gap-1.5 text-sm font-medium border border-border bg-background text-foreground rounded-lg px-3 py-1.5 hover:bg-muted transition-colors shadow-sm">
                <ChevronLeft className="h-4 w-4" />
                Back to Doctors
              </button>
            </Link>
            <img src="/logo-light.png" alt="AyurPath" className="h-8 w-auto dark:hidden" />
            <img src="/logo-dark.png" alt="AyurPath" className="h-8 w-auto hidden dark:block" />
          </div>

          {/* ── Progress bar ── */}
          <div className="bg-card border border-border rounded-2xl px-8 py-5 mb-6 shadow-sm">
            <ProgressBar current={stepIndex} />
          </div>

          {/* ── Form ── */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>

              {step === "details" && (
                <div className="grid md:grid-cols-[1fr_400px] gap-6">

                  {/* LEFT — Patient Information */}
                  <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-6 pb-4 border-b border-border">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <h2 className="font-bold text-lg text-foreground">Patient Information</h2>
                    </div>

                    {/* Patient details */}
                    {user && (
                      <div className="mb-6 p-4 bg-muted/40 rounded-xl border border-border">
                        <p className="font-bold text-foreground text-lg mb-1">{user.fullName}</p>
                        <div className="flex gap-4 text-sm text-muted-foreground font-medium">
                           <p>{user.email}</p>
                           <p>•</p>
                           <p>{user.phone}</p>
                        </div>
                      </div>
                    )}

                    {/* Dependent checkbox */}
                    <FormField
                      control={form.control}
                      name="isForDependent"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-3 space-y-0 mb-5 bg-primary/5 p-4 rounded-xl border border-primary/10">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              className="border-primary data-[state=checked]:bg-primary h-5 w-5 rounded"
                            />
                          </FormControl>
                          <FormLabel className="font-semibold cursor-pointer text-sm m-0">
                            I am booking this appointment for a family member or dependent
                          </FormLabel>
                        </FormItem>
                      )}
                    />

                    {/* Dependent fields */}
                    {isForDependent && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 p-5 bg-muted/20 rounded-xl border border-border">
                        <FormField control={form.control} name="dependentName" render={({ field }) => (
                          <FormItem className="sm:col-span-2">
                            <FormLabel className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Dependent Name *</FormLabel>
                            <FormControl><Input placeholder="Full Name" className="bg-background h-11 rounded-xl" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="dependentAge" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Age *</FormLabel>
                            <FormControl><Input type="number" placeholder="Age" className="bg-background h-11 rounded-xl" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="dependentGender" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Gender *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="bg-background h-11 rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value={Gender.MALE}>Male</SelectItem>
                                <SelectItem value={Gender.FEMALE}>Female</SelectItem>
                                <SelectItem value={Gender.OTHER}>Other</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="dependentContact" render={({ field }) => (
                          <FormItem className="sm:col-span-2">
                            <FormLabel className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Contact Number (Optional)</FormLabel>
                            <FormControl><Input placeholder="07XXXXXXXX" className="bg-background h-11 rounded-xl" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                    )}

                    {/* Symptoms */}
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 bg-rose-100 dark:bg-rose-900/30 rounded-lg text-rose-600 dark:text-rose-400">
                           <AlertCircle className="w-4 h-4" />
                        </div>
                        <h3 className="font-bold text-foreground">Chief Complaint / Symptoms *</h3>
                      </div>
                      <FormField
                        control={form.control}
                        name="symptoms"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea
                                placeholder="Please describe your symptoms or reason for visit in detail..."
                                className="min-h-[140px] bg-background border-border focus:border-primary rounded-xl resize-none text-sm p-4"
                                data-testid="textarea-symptoms"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Terms */}
                    <FormField
                      control={form.control}
                      name="agreeTerms"
                      render={({ field }) => (
                        <FormItem className="flex items-start gap-3 space-y-0 bg-muted/40 p-4 rounded-xl border border-border">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              className="border-primary data-[state=checked]:bg-primary mt-0.5 rounded"
                              data-testid="checkbox-terms"
                            />
                          </FormControl>
                          <div className="space-y-1">
                            <label className="font-medium cursor-pointer text-sm leading-relaxed text-muted-foreground">
                              I agree to the{" "}
                              <Link href="/terms" className="text-primary font-bold hover:underline">Terms of Service</Link>,{" "}
                              <Link href="/privacy" className="text-primary font-bold hover:underline">Privacy Policy</Link>, and{" "}
                              <Link href="/cancellation" className="text-primary font-bold hover:underline">Cancellation Policy</Link>.
                            </label>
                            <FormMessage />
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* RIGHT — Booking Summary */}
                  <div>
                    <BookingSummary />
                    
                    {/* Bottom CTA — Details step */}
                    <div className="mt-4">
                      <button
                        type="submit"
                        disabled={bookingMutation.isPending}
                        data-testid="button-book"
                        className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base py-4 rounded-2xl shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
                      >
                        <span>Continue to Payment</span>
                        <BookOpen className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {step === "payment" && (
                <div className="grid md:grid-cols-[1fr_400px] gap-6">
                  {/* LEFT — PayHere integration */}
                  <div className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-sm h-fit">
                    <div className="flex items-center gap-3 mb-8 pb-4 border-b border-border">
                      <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
                        <CreditCard className="h-6 w-6" />
                      </div>
                      <div>
                        <h2 className="font-extrabold text-xl text-foreground">Secure Checkout</h2>
                        <p className="text-sm font-medium text-muted-foreground">Complete your payment via PayHere</p>
                      </div>
                    </div>
                    
                    <div className="bg-muted/30 p-8 rounded-2xl border border-border text-center mb-8">
                       <img src="https://www.payhere.lk/downloads/images/payhere_square_banner.png" alt="PayHere Secure Checkout" className="h-20 mx-auto mb-6 drop-shadow-sm rounded-lg" />
                       <h3 className="font-bold text-foreground text-lg mb-2">Ready to complete your booking?</h3>
                       <p className="text-sm font-medium text-muted-foreground max-w-md mx-auto leading-relaxed">
                         You will be redirected to the secure PayHere payment gateway to process your card payment. No card details are saved on our servers.
                       </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <button
                        type="button"
                        onClick={() => setStep("details")}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 border-2 border-border bg-background text-foreground text-sm font-bold px-6 py-3.5 rounded-xl hover:bg-muted transition-colors"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Go Back
                      </button>
                      <button
                        type="button"
                        onClick={() => onSubmit(form.getValues())}
                        disabled={bookingMutation.isPending}
                        className="w-full flex-1 flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-base py-3.5 rounded-xl transition-all shadow-lg shadow-blue-500/20 disabled:opacity-60"
                      >
                        {bookingMutation.isPending ? (
                          <><Loader2 className="h-5 w-5 animate-spin" /> Preparing Checkout…</>
                        ) : (
                          <>Pay securely with PayHere <ChevronRight className="h-5 w-5" /></>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* RIGHT — Booking Summary */}
                  <div>
                    <BookingSummary />
                  </div>
                </div>
              )}

            </form>
          </Form>
        </div>
      </div>
    </PublicLayout>
  );
}