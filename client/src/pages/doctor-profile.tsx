import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Video,
  Building2,
  MapPin,
  BookOpen,
  Check,
} from "lucide-react";
import { format, addDays, isSameDay, startOfToday } from "date-fns";
import { PublicLayout } from "@/components/layout/public-layout";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LoadingPage } from "@/components/ui/loading-spinner";
import type { DoctorWithDetails, AppointmentSlot } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";

// ─── Step icons ───────────────────────────────────────────────────────────────
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
            <div
              className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-colors ${
                i === current
                  ? "bg-primary border-primary text-primary-foreground"
                  : i < current
                  ? "bg-background border-primary text-primary"
                  : "bg-background border-border text-muted-foreground"
              }`}
            >
              {STEP_ICONS[i]}
            </div>
            <span className={`text-xs font-medium whitespace-nowrap ${i <= current ? "text-primary" : "text-muted-foreground"}`}>
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
const VISIBLE_COUNT = 9;

export default function DoctorProfilePage() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const [selectedDate, setSelectedDate] = useState(startOfToday());
  const [selectedConsultationType, setSelectedConsultationType] = useState<"all" | "in_person" | "online">("all");
  const [dateOffset, setDateOffset] = useState(0);

  const selectedDateString = format(selectedDate, "yyyy-MM-dd");

  const { data: doctor, isLoading: doctorLoading } = useQuery<DoctorWithDetails>({
    queryKey: [`/api/doctors/${id}`],
    enabled: Boolean(id),
  });

  const { data: slots = [], isLoading: slotsLoading } = useQuery<AppointmentSlot[]>({
    queryKey: ["/api/doctors", id, "slots", selectedDateString],
    queryFn: () => apiRequest("GET", `/api/doctors/${id}/slots?date=${selectedDateString}`),
    enabled: Boolean(id),
    staleTime: 60_000,
  });

  const maxAdvanceDays = Math.max(Math.min(doctor?.maxAdvanceBookingDays ?? 14, 30), 1);
  const allDates = Array.from({ length: maxAdvanceDays }, (_, i) => addDays(startOfToday(), i));
  const visibleDates = allDates.slice(dateOffset, dateOffset + VISIBLE_COUNT);

  // Fetch slots for all visible dates so we can show availability dots
  const { data: allSlotsByDate = {} } = useQuery<Record<string, AppointmentSlot[]>>({
    queryKey: ["/api/doctors", id, "all-slots", dateOffset],
    queryFn: async () => {
      const results: Record<string, AppointmentSlot[]> = {};
      await Promise.all(
        visibleDates.map(async (d) => {
          const ds = format(d, "yyyy-MM-dd");
          try {
            results[ds] = await apiRequest("GET", `/api/doctors/${id}/slots?date=${ds}`);
          } catch {
            results[ds] = [];
          }
        })
      );
      return results;
    },
    enabled: Boolean(id) && Boolean(doctor),
    staleTime: 120_000,
  });

  const filteredSlots = slots.filter(
    (s) => selectedConsultationType === "all" || s.consultationType === selectedConsultationType
  );

  const formatFee = (fee: number) =>
    new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", minimumFractionDigits: 0 }).format(fee);

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const getSlotsForDate = (date: Date) => allSlotsByDate[format(date, "yyyy-MM-dd")] ?? [];

  if (doctorLoading) {
    return (
      <PublicLayout showHeader={false}>
        <LoadingPage message="Loading doctor profile..." />
      </PublicLayout>
    );
  }

  if (!doctor) {
    return (
      <PublicLayout showHeader={false}>
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">Doctor not found</h1>
          <Link href="/patient/doctors"><button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg">Back to Doctors</button></Link>
        </div>
      </PublicLayout>
    );
  }

  const consultationTypes = doctor.consultationTypes ?? [];

  return (
    <PublicLayout showHeader={false}>
      <div className="min-h-screen bg-background">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-8">
            <Link href="/patient/find-doctors">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex items-center gap-1.5 text-sm font-medium rounded-lg px-3 py-1.5 hover:bg-muted transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
            {/* Real logo — light/dark aware */}
            <img src="/logo-light.png" alt="AyurPath" className="h-8 w-auto dark:hidden" />
            <img src="/logo-dark.png" alt="AyurPath" className="h-8 w-auto hidden dark:block" />
          </div>

          {/* ── Doctor info + About Doctor — no boxes, free layout ── */}
          <div className="flex flex-col md:flex-row gap-10 mb-8">

            {/* Left: doctor info */}
            <div className="flex-1">
              <div className="flex items-start gap-4 mb-4">
                <Avatar className="h-16 w-16 rounded-full shrink-0">
                  <AvatarImage src={doctor.user.profileImage} alt={doctor.user.fullName} />
                  <AvatarFallback className="rounded-full bg-primary/10 text-primary text-xl font-bold">
                    {getInitials(doctor.user.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                    <h1 className="text-xl font-bold text-foreground">
                      {doctor.user.fullName.startsWith("Dr") ? doctor.user.fullName : `Dr. ${doctor.user.fullName}`}
                    </h1>
                    {doctor.status === "verified" && (
                      <span className="flex items-center gap-1 text-xs text-primary font-medium">
                        <Check className="h-3.5 w-3.5" />
                        Verified Doctor
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {doctor.specializations.map((s) => s.name).join(", ")}
                  </p>
                  {/* Stars */}
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <svg key={star} width="15" height="15" viewBox="0 0 24 24"
                        fill={star <= Math.round(doctor.averageRating) ? "currentColor" : "none"}
                        stroke="currentColor" strokeWidth="2"
                        className={star <= Math.round(doctor.averageRating) ? "text-amber-400" : "text-amber-300"}
                      >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    ))}
                    <span className="text-sm font-semibold text-foreground ml-1">
                      {doctor.averageRating > 0 ? doctor.averageRating.toFixed(1) : "0.0"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Consultation type toggle — pill style */}
              <div className="inline-flex items-center gap-0.5 bg-primary/10 border border-primary/20 rounded-full p-1">
                <button
                  onClick={() => setSelectedConsultationType("all")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    selectedConsultationType === "all"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Building2 className="h-3.5 w-3.5" />
                  <Video className="h-3.5 w-3.5" />
                  All
                </button>
                {consultationTypes.includes("in_person") && (
                  <button
                    onClick={() => setSelectedConsultationType("in_person")}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      selectedConsultationType === "in_person"
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Building2 className="h-3.5 w-3.5" />
                    In Person
                  </button>
                )}
                {consultationTypes.includes("online") && (
                  <button
                    onClick={() => setSelectedConsultationType("online")}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      selectedConsultationType === "online"
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Video className="h-3.5 w-3.5" />
                    Online
                  </button>
                )}
              </div>
            </div>

            {/* Right: About Doctor — no box */}
            <div className="md:w-72">
              <h2 className="font-bold text-foreground mb-3">About Doctor</h2>
              <div className="space-y-2 text-sm text-muted-foreground">
                {doctor.qualifications && (
                  <p>
                    <span className="font-medium text-foreground">Qualifications:</span>{" "}
                    {doctor.qualifications}
                  </p>
                )}
                {doctor.registrationNumber && (
                  <p>
                    <span className="font-medium text-foreground">Registration:</span>{" "}
                    {doctor.registrationNumber}
                  </p>
                )}
                {doctor.user.gender && (
                  <p>
                    <span className="font-medium text-foreground">Gender:</span>{" "}
                    <span className="capitalize">{doctor.user.gender}</span>
                  </p>
                )}
                {doctor.biography && (
                  <p className="leading-relaxed pt-2 border-t border-border">
                    {doctor.biography.length > 140 ? doctor.biography.slice(0, 140) + "…" : doctor.biography}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── Progress bar ── */}
          <div className="bg-card border border-border rounded-2xl px-8 py-5 mb-5">
            <ProgressBar current={0} />
          </div>

          {/* ── Date picker ── */}
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 mb-6">
            <h2 className="font-bold text-foreground mb-4">Select Date</h2>
            <div className="flex items-center gap-2">
              {/* Left arrow */}
              <button
                onClick={() => {
                  const newOffset = Math.max(0, dateOffset - 1);
                  setDateOffset(newOffset);
                }}
                disabled={dateOffset === 0}
                className="w-9 h-9 rounded-full border border-border bg-background flex items-center justify-center disabled:opacity-30 hover:bg-muted transition-colors shrink-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {/* Date tiles */}
              <div className="flex gap-2 flex-1 overflow-hidden">
                {visibleDates.map((date) => {
                  const isSelected = isSameDay(date, selectedDate);
                  const daySlots = getSlotsForDate(date);
                  const hasInPerson = daySlots.some((s) => s.consultationType === "in_person" && !s.isBooked && !s.isBlocked);
                  const hasOnline = daySlots.some((s) => s.consultationType === "online" && !s.isBooked && !s.isBlocked);

                  return (
                    <button
                      key={date.toISOString()}
                      onClick={() => setSelectedDate(date)}
                      className={`flex flex-col items-center py-2 px-1 rounded-xl border transition-all flex-1 min-w-0 ${
                        isSelected
                          ? "bg-primary border-primary text-primary-foreground"
                          : "bg-background border-primary/30 text-foreground hover:border-primary"
                      }`}
                    >
                      <span className="text-xs font-medium uppercase">{format(date, "EEE")}</span>
                      <span className="text-xl font-bold leading-tight">{format(date, "d")}</span>
                      <span className="text-xs">{format(date, "MMM")}</span>
                      {/* Availability dots */}
                      <div className="flex gap-1 mt-1 h-2 items-center">
                        {hasInPerson && <span className="w-1.5 h-1.5 rounded-full bg-violet-500 inline-block" />}
                        {hasOnline && <span className="w-1.5 h-1.5 rounded-full bg-blue-700 inline-block" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Right arrow */}
              <button
                onClick={() => {
                  const newOffset = Math.min(allDates.length - VISIBLE_COUNT, dateOffset + 1);
                  setDateOffset(newOffset);
                  // If the selected date is no longer visible, move it forward too
                }}
                disabled={dateOffset + VISIBLE_COUNT >= allDates.length}
                className="w-9 h-9 rounded-full border border-border bg-background flex items-center justify-center disabled:opacity-30 hover:bg-muted transition-colors shrink-0"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* ── Available Times ── */}
          <div className="mb-10">
            <h2 className="font-bold text-foreground mb-3">Available Times</h2>
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              {/* Date header row */}
              <div className="px-5 py-3 bg-primary/5 border-b border-border">
                <span className="font-semibold text-foreground">{format(selectedDate, "EEE, MMM dd")}</span>
              </div>

              {slotsLoading ? (
                <div className="px-5 py-8 text-center text-muted-foreground text-sm">Loading slots…</div>
              ) : filteredSlots.length === 0 ? (
                <div className="px-5 py-8 text-center text-muted-foreground text-sm">
                  No available slots for this date
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredSlots.map((slot) => {
                    const isInPerson = slot.consultationType === "in_person";
                    const fee = isInPerson
                      ? doctor.consultationFee
                      : (doctor.onlineConsultationFee ?? doctor.consultationFee);

                    const isUnavailable = slot.isBooked || slot.isBlocked;

                    return (
                      <div key={slot.id} className={`flex items-center gap-2 px-5 py-4 ${isUnavailable ? "opacity-70" : ""}`}>
                        {/* LEFT — icon + time + badge + sub-info */}
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            isUnavailable
                              ? "bg-muted text-muted-foreground"
                              : isInPerson
                                ? "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
                                : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          }`}>
                            {isInPerson ? <Building2 className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-foreground text-sm">
                                {slot.startTime} - {slot.endTime}
                              </span>
                              <Badge className={`text-xs px-2 py-0 h-5 font-medium border-0 ${
                                isUnavailable
                                  ? "bg-muted text-muted-foreground"
                                  : isInPerson
                                    ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                              }`}>
                                {isInPerson ? "In Person" : "Online"}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {isUnavailable ? (
                                <span className="text-muted-foreground">Booked</span>
                              ) : isInPerson ? (
                                <span className="flex items-center gap-1">
                                  location:
                                  <button className="flex items-center gap-1 bg-primary text-primary-foreground text-xs font-medium px-2 py-0.5 rounded-md ml-1">
                                    <MapPin className="h-3 w-3" />
                                    View on Map
                                  </button>
                                </span>
                              ) : (
                                "View meeting link: Not available"
                              )}
                            </div>
                          </div>
                        </div>

                        {/* MIDDLE — fee, truly centered */}
                        <div className="flex-1 flex justify-center">
                          <div className={`text-sm px-4 py-1.5 rounded-lg font-medium whitespace-nowrap border ${
                            isUnavailable
                              ? "text-muted-foreground bg-muted border-border"
                              : "text-primary bg-primary/10 border-primary/20"
                          }`}>
                            Consultation Fee: {formatFee(fee)}
                          </div>
                        </div>

                        {/* RIGHT — CTA or Booked state */}
                        <div className="flex-1 flex justify-end">
                          {isUnavailable ? (
                            <div className="flex items-center gap-2 bg-muted text-muted-foreground text-sm font-semibold px-4 py-2 rounded-xl whitespace-nowrap cursor-not-allowed">
                              Continue to Book
                              <BookOpen className="h-4 w-4" />
                            </div>
                          ) : (
                            <button
                              onClick={() => navigate(`/book/${doctor.id}?slot=${slot.id}`)}
                              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold px-4 py-2 rounded-xl transition-colors whitespace-nowrap"
                            >
                              Continue to Book
                              <BookOpen className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </PublicLayout>
  );
}
