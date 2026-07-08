import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Calendar as CalendarIcon,
  Video,
  Building2,
  AlertCircle,
  Trash2,
  PlusCircle,
  Lock,
  XCircle,
  CalendarPlus,
  User,
  Info,
} from "lucide-react";
import { format, parseISO, isToday, addHours, isBefore } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingPage, LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { AppointmentSlot, DoctorWithDetails } from "@shared/schema";
import { Modal } from "@/components/ui/modal";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const generateTimeSlots = () => {
  const slots = [];
  for (let i = 0; i < 24; i++) {
    for (let j = 0; j < 60; j += 15) {
      const h = i.toString().padStart(2, "0");
      const m = j.toString().padStart(2, "0");
      slots.push(`${h}:${m}`);
    }
  }
  return slots;
};
const timeSlots = generateTimeSlots();

const isTimeOverlap = (s1: string, e1: string, s2: string, e2: string) => {
  // 9:00-9:30 saha 9:30-10:00 overlap wenne nathi wenna check kireema
  return normalizeTime(s1) < normalizeTime(e2) && normalizeTime(s2) < normalizeTime(e1);
};

const formatTimeAMPM = (time24: string) => {
  if (time24 === "24:00") return "12:00 AM";
  
  const [hourStr, min] = time24.split(":");
  let hour = parseInt(hourStr, 10);
  
  // Determine AM or PM
  const ampm = hour >= 12 && hour < 24 ? "PM" : "AM";
  
  // Convert to 12-hour format
  hour = hour % 12 || 12; 
  
  return `${hour.toString()}:${min} ${ampm}`;
};

// Ada dawase time eka check karanna current time eka ganna function eka
const getCurrentTimeStr = () => {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
};

const addMinutesToTime = (time: string, minsToAdd: number) => {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(h, m + minsToAdd, 0, 0);
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
};

export default function DoctorSchedule() {
  const { toast } = useToast();
  const todayDateStr = format(new Date(), "yyyy-MM-dd");

  const { data: profile } = useQuery<DoctorWithDetails>({
    queryKey: ["/api/doctor/profile"],
  });

  const { data: settings } = useQuery<any>({
    queryKey: ["/api/booking-settings"],
  });

  const cancellationFee = settings?.cancellationFee || 300;
  
  const [slotToCancel, setSlotToCancel] = useState<AppointmentSlot | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [slotToDelete, setSlotToDelete] = useState<AppointmentSlot | null>(null);
  const [newSlot, setNewSlot] = useState({
    date: todayDateStr,
    startTime: "09:00",
    endTime: "09:30",
    consultationType: "in_person" as "in_person" | "online",
    clinicLocation: "",
    hospitalId: "",
  });

  const maxDate = useMemo(() => {
    if (!profile) return todayDateStr;
    const allowedDays = Math.min(profile.maxAdvanceBookingDays || 10, 10); // 🟢 Strict Cap at 10 days
    const d = new Date();
    d.setDate(d.getDate() + allowedDays);
    return format(d, "yyyy-MM-dd");
  }, [profile, todayDateStr]);

  const getAvailableStartTimes = (selectedDateStr: string) => {
    if (selectedDateStr !== todayDateStr) {
      return timeSlots;
    }

    const threeHoursFromNow = addHours(new Date(), 3);
    return timeSlots.filter(time => {
      const [hours, minutes] = time.split(':');
      const slotDate = new Date();
      slotDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      return !isBefore(slotDate, threeHoursFromNow);
    });
  };

  const currentAvailableStartTimes = getAvailableStartTimes(newSlot.date);

  // End time must come after the selected start time
  const validEndTimes = timeSlots.filter((time) => time > newSlot.startTime);

  useEffect(() => {
    const availableForDate = getAvailableStartTimes(newSlot.date);
    if (!availableForDate.includes(newSlot.startTime)) {
      const firstAvailable = availableForDate[0] || "";
      setNewSlot(prev => ({
        ...prev,
        startTime: firstAvailable,
        endTime: firstAvailable ? timeSlots[timeSlots.indexOf(firstAvailable) + 1] || firstAvailable : ""
      }));
    }
  }, [newSlot.date]);

  const {
    data: slots = [],
    isLoading,
    isError,
  } = useQuery<AppointmentSlot[]>({
    queryKey: ["/api/doctor/slots"],
    queryFn: async () => {
      const endDateStr = maxDate;
      const res = await fetch(`/api/doctor/slots?startDate=${todayDateStr}&endDate=${endDateStr}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!res.ok) throw new Error("Failed to load slots");
      return res.json();
    },
    enabled: !!profile,
  });

  const createSlotMutation = useMutation({
    mutationFn: (data: typeof newSlot) =>
      apiRequest("POST", "/api/doctor/slots", {
        ...data,
        doctorId: profile?.id,
        clinicLocation: data.consultationType === "in_person" ? data.clinicLocation : undefined,
        hospitalId: data.consultationType === "in_person" && data.hospitalId ? data.hospitalId : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctor/slots"] });
      toast({ title: "Slot created successfully" });
      
      setNewSlot((prev) => ({ 
        ...prev, 
        startTime: prev.endTime
      })); 
      
      setIsModalOpen(false); 
    },
    onError: (err: any) => {
      toast({ title: err?.message || "Failed to create slot", variant: "destructive" });
    },
  });

  // Changed to Deactivate instead of Delete
  const deactivateSlotMutation = useMutation({
    mutationFn: async (slotId: string) => {
      return apiRequest("PATCH", `/api/slots/${slotId}/deactivate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctor/slots"] });
      toast({ title: "Slot deactivated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to deactivate slot", variant: "destructive" });
    },
  });

  // Mutation for cancelling a booked slot
  const cancelBookedSlotMutation = useMutation({
    mutationFn: async ({ slotId, reason }: { slotId: string; reason: string }) => {
      // NOTE: Ensure your backend endpoint for slot cancellation handles the booked status correctly. 
      // It should ideally find the connected appointment and cancel it.
      return apiRequest("PATCH", `/api/slots/${slotId}/cancel-booking`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctor/slots"] });
      toast({ title: "Appointment cancelled successfully" });
      setSlotToCancel(null);
      setCancelReason("");
    },
    onError: (err: any) => {
      toast({ title: err?.message || "Failed to cancel appointment", variant: "destructive" });
    },
  });

  const handleAddSlot = () => {
    if (newSlot.consultationType === "in_person" && !newSlot.clinicLocation) {
      toast({ title: "Please select a location", variant: "destructive" });
      return;
    }

    // Time Logic Validation
    if (newSlot.date === todayDateStr) {
      const [hours, minutes] = newSlot.startTime.split(':');
      const slotDate = new Date();
      slotDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      const threeHoursFromNow = addHours(new Date(), 3);
      
      if (isBefore(slotDate, threeHoursFromNow)) {
        toast({ 
          title: "Too early for today", 
          description: "Appointments for today must be scheduled at least 3 hours in advance.", 
          variant: "destructive" 
        });
        return;
      }
    }

    // 1. PAST TIME CHECK: Ada dawase denata pahu wela thiyena time ekak nam danna ba
    if (newSlot.date === todayDateStr && newSlot.startTime < getCurrentTimeStr()) {
      toast({ 
        title: "Invalid Time", 
        description: "You cannot schedule appointments for past times today.", 
        variant: "destructive" 
      });
      return;
    }

    // 2. OVERLAP CHECK: Normalize karapu time ekka check karanawa
    const existingSlotsOnDate = slots.filter((s) => s.date === newSlot.date && !s.isBlocked);
    
    const overlappingSlot = existingSlotsOnDate.find((existingSlot) => {
       return isTimeOverlap(newSlot.startTime, newSlot.endTime, existingSlot.startTime, existingSlot.endTime);
    });

    if (overlappingSlot) {
      toast({ 
        title: "Time Slot Unavailable", 
        description: `You have an existing schedule overlapping this time: ${formatTimeAMPM(normalizeTime(overlappingSlot.startTime))} - ${formatTimeAMPM(normalizeTime(overlappingSlot.endTime))}.`,
        variant: "destructive" 
      });
      return;
    }

    createSlotMutation.mutate(newSlot);
  };

  const groupedSlots = useMemo(() => {
    return slots.reduce((acc, slot) => {
      if (!acc[slot.date]) acc[slot.date] = [];
      acc[slot.date].push(slot);
      return acc;
    }, {} as Record<string, AppointmentSlot[]>);
  }, [slots]);

  const sortedDates = Object.keys(groupedSlots).sort();

  if (isLoading) return <LoadingPage message="Loading schedule..." />;

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">Failed to load schedule. Please try again.</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  const totalSlots = slots.length;
  const availableSlots = slots.filter((s) => !s.isBooked && !s.isBlocked).length;
  const bookedSlots = slots.filter((s) => s.isBooked).length;
  const canceledSlots = slots.filter((s) => s.isBlocked).length;

  return (
    <div className="space-y-6">
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">
            Schedule Management
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Manage your appointment slots and availability
          </p>
        </div>
      </div>

      {/* Stats Cards (Matched exactly to screenshot style) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Slots This Week", value: totalSlots },
          { label: "Available Slots", value: availableSlots },
          { label: "Booked Slots", value: bookedSlots },
          { label: "Canceled Slots", value: canceledSlots },
        ].map((stat, i) => (
          <Card key={i} className={`border border-primary/50 shadow-sm rounded-2xl border-l-[7px] overflow-hidden`}>
            <CardContent className="p-4 sm:p-6 flex flex-col items-center justify-center text-center h-full">
              <span className="text-3xl sm:text-4xl font-bold text-foreground mb-1">{stat.value}</span>
              <span className="text-xs sm:text-sm text-muted-foreground">{stat.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Current Slots Listing */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between border-b pb-2">
          <h3 className="font-semibold text-lg text-foreground">Current Slots</h3>
          <Button 
            onClick={() => setIsModalOpen(true)} 
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-5 h-9"
          >
            Add Slot <PlusCircle className="w-4 h-4 ml-1.5" />
          </Button>
        </div>
        
        {sortedDates.length === 0 && (
          <div className="text-center py-12 bg-muted/20 border border-dashed rounded-2xl">
            <CalendarIcon className="w-12 h-12 mx-auto text-muted-foreground opacity-20 mb-3" />
            <p className="text-muted-foreground font-medium">No slots created yet.</p>
            <p className="text-sm text-muted-foreground mt-1">Click "Add Slot" to set up your schedule.</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5">
          {sortedDates.map((dateStr) => {
            const dateObj = parseISO(dateStr);
            const formattedDate = format(dateObj, "EEE, MMM dd");
            const daySlots = groupedSlots[dateStr].sort((a, b) => a.startTime.localeCompare(b.startTime));

            return (
              <div key={dateStr} className="border border-emerald-100 dark:border-emerald-900 rounded-2xl overflow-hidden bg-card shadow-sm">
                
                {/* Green Header */}
                <div className="bg-[#e6f4ea] dark:bg-emerald-950/40 px-5 py-3 border-b border-emerald-100 dark:border-emerald-900 flex items-center gap-2">
                  <h4 className="font-semibold text-emerald-900 dark:text-emerald-100">{formattedDate}</h4>
                  {isToday(dateObj) && <Badge className="bg-emerald-500 hover:bg-emerald-600 ml-2 text-[10px]">TODAY</Badge>}
                </div>
                
                <div className="divide-y divide-border/50">
                  {daySlots.map((slot) => (
                    <div key={slot.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:px-5 hover:bg-muted/10 transition-colors gap-4">
                      
                      {/* Left: Info */}
                      <div className="flex items-start gap-4">
                        <div className={`mt-0.5 w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          slot.consultationType === "online" 
                            ? "bg-blue-100 text-blue-500 dark:bg-blue-900/30" 
                            : "bg-[#f3e8ff] text-[#9333ea] dark:bg-purple-900/30 dark:text-purple-400"
                        }`}>
                          {slot.consultationType === "online" ? <Video className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                        </div>
                        
                        <div>
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="font-medium text-foreground text-[15px]">
                              {formatTimeAMPM(slot.startTime)} - {formatTimeAMPM(slot.endTime)}
                            </span>
                            <Badge 
                              variant="secondary" 
                              className={`text-[11px] font-medium px-2 py-0 h-5 ${
                                slot.consultationType === "online" 
                                  ? "bg-blue-100 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300" 
                                  : "bg-[#f3e8ff] text-[#9333ea] hover:bg-[#f3e8ff] dark:bg-purple-900/40 dark:text-purple-300"
                              }`}
                            >
                              {slot.consultationType === "online" ? "Online" : "In Person"}
                            </Badge>
                          </div>
                          
                          <div className="text-sm text-muted-foreground flex items-center gap-2">
                            {slot.consultationType === "in_person" && (slot as any).clinicLocation && (
                              <>
                                <span className="flex items-center text-xs">
                                  <Building2 className="w-3 h-3 mr-1 opacity-70" /> {(slot as any).clinicLocation}
                                </span>
                              </>
                            )}

                            {slot.consultationType === "online" && slot.meetLink && (
                              <a 
                                href={slot.meetLink} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="flex items-center text-xs text-blue-600 hover:text-blue-700 hover:underline mt-0.5"
                              >
                                <Video className="w-3 h-3 mr-1" />
                                Join Meeting
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions & Status */}
                      <div className="flex items-center justify-end gap-3 border-t sm:border-t-0 pt-3 sm:pt-0 mt-2 sm:mt-0">
                        {slot.isBlocked ? (
                          <div className="flex flex-col items-end gap-1.5">
                            <Badge variant="outline" className="border-red-200 text-red-600 bg-red-50 dark:bg-red-900/20 uppercase tracking-wider px-3 py-1 flex items-center gap-1.5">
                              <XCircle className="w-3.5 h-3.5" />
                              CANCELLED
                            </Badge>
                            <span className="text-[11px] font-medium text-red-500/80 flex items-center gap-1 px-1">
                              <AlertCircle className="w-3 h-3" />
                              Rs. {cancellationFee} deducted from payouts
                            </span>
                          </div>
                        ) : slot.isBooked ? (
                          <>
                            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300 uppercase tracking-wider px-3 py-1 flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5" />
                              Booked
                            </Badge>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/20"
                              onClick={() => setSlotToCancel(slot)}
                            >
                              <XCircle className="w-4 h-4 mr-1.5" /> Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Badge variant="outline" className="border-emerald-200 text-emerald-600 uppercase tracking-wider px-3 py-1">
                              NO APPOINTMENT
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-500 border-red-100 hover:bg-red-50 dark:hover:bg-red-950/20"
                              onClick={() => setSlotToDelete(slot)}
                            >
                              <Trash2 className="w-4 h-4 mr-1.5" />
                              Delete
                            </Button>
                          </>
                        )}
                      </div>
                      
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={!!slotToCancel} onOpenChange={(open) => { 
        if (!open) { 
          setSlotToCancel(null); 
          setCancelReason(""); 
        } 
      }}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-red-600 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" /> Cancel Appointment
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground pt-1">
              {slotToCancel && (
                <span className="block font-medium text-foreground mb-2">
                  {format(parseISO(slotToCancel.date), "EEE, MMM d")} {" · "} 
                  {formatTimeAMPM(slotToCancel.startTime)} – {formatTimeAMPM(slotToCancel.endTime)}
                </span>
              )}
              You are about to cancel a confirmed booking. Please provide a reason for the patient.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {/* Cancellation Fee Warning Box */}
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl p-4 flex gap-3 items-start">
              <Info className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-red-800 dark:text-red-300">Cancellation Fee Applies</h4>
                <p className="text-sm text-red-600 dark:text-red-400/80 mt-1 leading-snug">
                  Rs. {cancellationFee} will be deducted from your payouts for cancelling this booked session.
                </p>
              </div>
            </div>

            {/* Reason Textarea */}
            <div className="space-y-2">
              <Label htmlFor="cancel-reason" className="text-foreground">Reason for Cancellation <span className="text-red-500">*</span></Label>
              <Textarea
                id="cancel-reason"
                placeholder="E.g., Unexpected personal emergency, clinic closure..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="resize-none"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => { setSlotToCancel(null); setCancelReason(""); }}>
              Keep Booking
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              disabled={cancelBookedSlotMutation.isPending || cancelReason.trim().length < 5}
              onClick={() => {
                if (slotToCancel) {
                  cancelBookedSlotMutation.mutate({ slotId: slotToCancel.id, reason: cancelReason });
                }
              }}
            >
              {cancelBookedSlotMutation.isPending ? "Cancelling..." : "Confirm Cancellation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!slotToDelete} onOpenChange={(open) => { if (!open) setSlotToDelete(null); }}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Delete this slot?</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground pt-1">
              {slotToDelete && (
                <>
                  <span className="block font-medium text-foreground mb-1">
                    {format(parseISO(slotToDelete.date), "EEE, MMM d")}
                    {" · "}
                    {formatTimeAMPM(slotToDelete.startTime)} – {formatTimeAMPM(slotToDelete.endTime)}
                    {" · "}
                    {slotToDelete.consultationType === "online" ? "Online" : "In Person"}
                  </span>
                  This action cannot be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setSlotToDelete(null)}>
              No, Cancel
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              disabled={deactivateSlotMutation.isPending}
              onClick={() => {
                if (slotToDelete) {
                  deactivateSlotMutation.mutate(slotToDelete.id, {
                    onSuccess: () => setSlotToDelete(null),
                    onError: () => setSlotToDelete(null),
                  });
                }
              }}
            >
              {deactivateSlotMutation.isPending ? "Deleting..." : "Yes, Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add New Schedule Slot"
        description="Set up your availability. Only future dates and valid times can be selected."
        icon={<CalendarPlus className="w-6 h-6 text-primary" />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleAddSlot} disabled={createSlotMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">
              {createSlotMutation.isPending && <LoadingSpinner size="sm" className="mr-2" />}
              Save Slot
            </Button>
          </>
        }
      >
        <div className="grid gap-4 py-2">
          {/* Date Picker */}
          <div className="space-y-2">
            <Label>Date</Label>
            <div className="relative flex items-center">
              <Input
                type="date"
                min={todayDateStr}
                max={maxDate}
                value={newSlot.date}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val >= todayDateStr && val <= maxDate) {
                    setNewSlot({ ...newSlot, date: val });
                  } else if (val > maxDate) {
                    toast({ title: "Booking Limit Reached", description: `You can only schedule up to ${Math.min(profile?.maxAdvanceBookingDays || 10, 10)} days ahead.`, variant: "destructive" });
                  }
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground flex justify-end">
              Max advance limit: {format(parseISO(maxDate), "MMM dd, yyyy")}
            </p>
          </div>

          {/* Time Pickers */}
          {newSlot.date === todayDateStr ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Select 
                  value={newSlot.startTime} 
                  onValueChange={(v) => {
                    setNewSlot(prev => ({ 
                      ...prev, 
                      startTime: v,
                      endTime: prev.endTime <= v ? timeSlots[timeSlots.indexOf(v) + 1] || v : prev.endTime 
                    }));
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {timeSlots.map((time) => {
                      // Ada dawase past time ekak nam option eka disable karanawa
                      const isPastTime = newSlot.date === todayDateStr && time < getCurrentTimeStr();
                      
                      return (
                        <SelectItem key={time} value={time} disabled={isPastTime}>
                          {formatTimeAMPM(time)}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>End Time</Label>
                <Select value={newSlot.endTime} onValueChange={(v) => setNewSlot({ ...newSlot, endTime: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {validEndTimes.map((time) => (
                      <SelectItem key={time} value={time}>{formatTimeAMPM(time)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          {/* Mode Picker */}
          <div className="space-y-2">
            <Label>Consultation Mode</Label>
            <div className="flex bg-muted/50 border rounded-lg p-1">
              <button
                type="button"
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm rounded-md transition-all ${
                  newSlot.consultationType === "in_person" 
                    ? "bg-background shadow-sm text-primary font-medium" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  setNewSlot({ ...newSlot, consultationType: "in_person" });
                }}
              >
                <Building2 className="w-4 h-4" /> In Person
              </button>
              <button
                type="button"
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm rounded-md transition-all ${
                  newSlot.consultationType === "online" 
                    ? "bg-background shadow-sm text-blue-600 font-medium" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  setNewSlot({ ...newSlot, consultationType: "online", clinicLocation: "", hospitalId: "" });
                }}
              >
                <Video className="w-4 h-4" /> Online
              </button>
            </div>
          </div>

          {/* Location Picker (Only for In-Person) */}
          {newSlot.consultationType === "in_person" && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
              <Label>Clinic Location</Label>
              <Select
                value={newSlot.hospitalId}
                onValueChange={(hospitalId) => {
                  const hospital = profile?.hospitals?.find((h) => h.id === hospitalId);
                  setNewSlot({ ...newSlot, hospitalId, clinicLocation: hospital?.name ?? "" });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select where you'll be" />
                </SelectTrigger>
                <SelectContent>
                  {profile?.hospitals?.map((hospital) => (
                    <SelectItem key={hospital.id} value={hospital.id}>
                      {hospital.name}
                    </SelectItem>
                  ))}
                  {(!profile?.hospitals || profile.hospitals.length === 0) && (
                    <SelectItem value="none" disabled>Please add locations in your profile settings first</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}