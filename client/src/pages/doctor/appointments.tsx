import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Calendar,
  Clock,
  Phone,
  AlertCircle,
  Check,
  X,
  Bell,
  User,
  FileText,
  ChevronDown,
  MessageSquare,
  Copy,
} from "lucide-react";
import { format, isToday, isTomorrow, parseISO, isPast } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingPage, LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { AppointmentWithDetails } from "@shared/schema";

export default function DoctorAppointments() {
  const { toast } = useToast();
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithDetails | null>(null);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [consultationNotes, setConsultationNotes] = useState("");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [phoneCopied, setPhoneCopied] = useState(false);

  const { data: appointments = [], isLoading, isError } = useQuery<AppointmentWithDetails[]>({
    queryKey: ["/api/doctor/appointments"],
    staleTime: 60 * 1000,
  });

  // Platform cancellation charge deducted from the doctor's payouts when they cancel.
  const { data: bookingSettings } = useQuery<any>({
    queryKey: ["/api/booking-settings"],
    staleTime: 5 * 60 * 1000,
  });
  const platformCancellationFee = bookingSettings?.cancellationFee ?? 300;

  const completeMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      apiRequest("PATCH", `/api/appointments/${id}/complete`, { consultationNotes: notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctor/appointments"] });
      setCompleteDialogOpen(false);
      setConsultationNotes("");
      setSelectedAppointment(null);
      toast({ title: "Appointment marked as completed" });
    },
    onError: () => toast({ title: "Failed to complete appointment", variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiRequest("PATCH", `/api/appointments/${id}/cancel`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctor/appointments"] });
      setCancelDialogOpen(false);
      setCancelReason("");
      setSelectedAppointment(null);
      toast({ title: "Appointment cancelled" });
    },
    onError: () => toast({ title: "Failed to cancel appointment", variant: "destructive" }),
  });

  const callMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/doctor/appointments/${id}/call`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctor/appointments"] });
      toast({ title: "Patient has been notified", description: "They will receive a notification to proceed" });
    },
    onError: () => toast({ title: "Failed to notify patient", variant: "destructive" }),
  });

  const noShowMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/doctor/appointments/${id}/no-show`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctor/appointments"] });
      toast({ title: "Appointment marked as no-show" });
    },
    onError: () => toast({ title: "Failed to mark as no-show", variant: "destructive" }),
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/doctor/appointments/${id}/confirm`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctor/appointments"] });
      toast({ title: "Appointment confirmed" });
    },
    onError: () => toast({ title: "Failed to confirm appointment", variant: "destructive" }),
  });

  const getInitials = (name: string) => {
    if (!name) return "PT";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const handleCallPatient = (appointment: AppointmentWithDetails) => {
    // Keep existing behaviour: notify patient + show "Called" badge
    callMutation.mutate(appointment.id);
    // Also open the phone number popup so the doctor can copy and dial
    setSelectedAppointment(appointment);
    setPhoneCopied(false);
    setCallDialogOpen(true);
  };

  const handleCopyPhone = async () => {
    const phone = selectedAppointment?.patient?.phone;
    if (!phone) return;
    try {
      await navigator.clipboard.writeText(phone);
      setPhoneCopied(true);
      setTimeout(() => setPhoneCopied(false), 2000);
    } catch {
      toast({ title: "Failed to copy number", variant: "destructive" });
    }
  };

  const formatTime = (timeStr: string | undefined) => {
    if (!timeStr) return "";
    const parts = timeStr.split(":");
    const h = parseInt(parts[0]);
    const m = parts[1] || "00";
    const period = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return `${hour}:${m} ${period}`;
  };

  const formatDateHeader = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "EEE, MMM dd");
  };

  const getTypeBadge = (type: string) => {
    if (type === "in_person") {
      return <Badge className="bg-pink-100 text-pink-600 hover:bg-pink-100 border-0 text-xs font-medium">In Person</Badge>;
    }
    if (type === "online") {
      return <Badge className="bg-violet-100 text-violet-600 hover:bg-violet-100 border-0 text-xs font-medium">Online</Badge>;
    }
    return <Badge className="bg-blue-100 text-blue-600 hover:bg-blue-100 border-0 text-xs font-medium">Home Visit</Badge>;
  };

  const getStatusBadge = (status: string, cancelledBy?: string | null) => {
    switch (status) {
      case "confirmed":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 text-sm font-medium">
            <Check className="h-3.5 w-3.5" /> Confirmed
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-sm font-medium">
            <Clock className="h-3.5 w-3.5" /> Pending
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-sm font-medium">
            <Check className="h-3.5 w-3.5" /> Completed
          </span>
        );
      case "cancelled":
      case "no_show": {
        const label = status === "no_show" ? "No Show" : cancelledBy === "patient" ? "Canceled by Patient" : cancelledBy === "doctor" ? "Canceled by you" : "Cancelled";
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 text-sm font-medium">
            <User className="h-3.5 w-3.5" /> {label}
          </span>
        );
      }
      default:
        return null;
    }
  };

  const filterAppointments = (status: string) => {
    let filtered = appointments;
    if (status === "today") {
      filtered = appointments.filter(a => isToday(parseISO(a.appointmentDate)));
    } else if (status === "upcoming") {
      filtered = appointments.filter(a =>
        !isPast(parseISO(a.appointmentDate)) && ["pending", "confirmed"].includes(a.status)
      );
    } else if (status === "completed") {
      filtered = appointments.filter(a => a.status === "completed");
    } else if (status === "cancelled") {
      filtered = appointments.filter(a => ["cancelled", "no_show"].includes(a.status));
    }
    return filtered.sort((a, b) => {
      if (a.appointmentDate === b.appointmentDate) return a.appointmentTime.localeCompare(b.appointmentTime);
      return a.appointmentDate.localeCompare(b.appointmentDate);
    });
  };

  const groupByDate = (apts: AppointmentWithDetails[]) => {
    const groups: Record<string, AppointmentWithDetails[]> = {};
    apts.forEach(apt => {
      if (!groups[apt.appointmentDate]) groups[apt.appointmentDate] = [];
      groups[apt.appointmentDate].push(apt);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  };

  const todayCount = appointments.filter(a => isToday(parseISO(a.appointmentDate))).length;
  const upcomingCount = appointments.filter(a =>
    !isPast(parseISO(a.appointmentDate)) && ["pending", "confirmed"].includes(a.status)
  ).length;
  const completedCount = appointments.filter(a => a.status === "completed").length;

  if (isLoading) return <LoadingPage message="Loading appointments..." />;

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">Failed to load appointments. Please try again.</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-heading font-bold" data-testid="text-page-title">
          Appointments
        </h1>
        <p className="text-muted-foreground">Manage your patient appointments and consultations</p>
      </div>

      <Tabs defaultValue="today" className="space-y-4">
        <TabsList data-testid="tabs-appointments">
          <TabsTrigger value="today" data-testid="tab-today">Today ({todayCount})</TabsTrigger>
          <TabsTrigger value="upcoming" data-testid="tab-upcoming">Upcoming ({upcomingCount})</TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">Completed ({completedCount})</TabsTrigger>
          <TabsTrigger value="cancelled" data-testid="tab-cancelled">Cancelled</TabsTrigger>
        </TabsList>

        {["today", "upcoming", "completed", "cancelled"].map(tab => {
          const filtered = filterAppointments(tab);
          const grouped = groupByDate(filtered);

          return (
            <TabsContent key={tab} value={tab} className="space-y-4">
              {grouped.length > 0 ? grouped.map(([date, apts]) => (
                <div key={date} className="border border-primary/30 rounded-xl overflow-hidden">
                  {/* Date header */}
                  <div className="bg-primary/10 px-4 py-2.5">
                    <p className="font-semibold text-sm">{formatDateHeader(date)}</p>
                  </div>

                  {/* Appointment rows */}
                  {apts.map((appointment, index) => (
                    <div
                      key={appointment.id}
                      className={`p-4 ${index < apts.length - 1 ? "border-b-2 border-primary/20" : ""}`}
                      data-testid={`row-appointment-${appointment.id}`}
                    >
                      <div className="flex items-start justify-between gap-4">

                        {/* Left: avatar + info */}
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <Avatar className="h-10 w-10 shrink-0">
                            <AvatarImage src={appointment.patient?.profileImage} />
                            <AvatarFallback className="bg-violet-100 text-violet-600 font-semibold text-sm">
                              {getInitials(appointment.patient?.fullName || "")}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            {/* Name + time range */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm">
                                {appointment.patient?.fullName}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {formatTime(appointment.slot?.startTime || appointment.appointmentTime)}
                                {appointment.slot?.endTime && ` - ${formatTime(appointment.slot.endTime)}`}
                              </span>
                              {tab === "today" && index === 0 && (
                                <Badge className="bg-primary text-primary-foreground text-xs shrink-0">Current</Badge>
                              )}
                              {appointment.isCalled && (
                                <Badge variant="outline" className="text-xs shrink-0">
                                  <Bell className="h-3 w-3 mr-1" /> Called
                                </Badge>
                              )}
                            </div>

                            {/* Consultation type badge */}
                            <div className="mt-1">
                              {getTypeBadge(appointment.consultationType)}
                            </div>

                            {/* Reason + Phone */}
                            <div className="mt-2 flex flex-wrap gap-6">
                              <div>
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mb-0.5">
                                  <MessageSquare className="h-3 w-3" /> Reason
                                </p>
                                <p className="text-sm">{appointment.symptoms || "Not specified"}</p>
                              </div>
                              {appointment.patient?.phone && (
                                <div>
                                  <p className="text-xs text-muted-foreground flex items-center gap-1 mb-0.5">
                                    <Phone className="h-3 w-3" /> Phone
                                  </p>
                                  <p className="text-sm">{appointment.patient.phone}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: status + actions */}
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <div className="flex items-center gap-2">
                          {getStatusBadge(appointment.status, appointment.cancelledBy)}

                          {["pending", "confirmed"].includes(appointment.status) && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="border-primary/40 text-sm" data-testid={`button-actions-${appointment.id}`}>
                                  Action <ChevronDown className="h-4 w-4 ml-1" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {appointment.status === "pending" && (
                                  <DropdownMenuItem
                                    onClick={() => confirmMutation.mutate(appointment.id)}
                                    disabled={confirmMutation.isPending}
                                    data-testid={`action-confirm-${appointment.id}`}
                                  >
                                    <Check className="h-4 w-4 mr-2" /> Confirm
                                  </DropdownMenuItem>
                                )}
                                {appointment.status === "confirmed" && !appointment.isCalled && (
                                  <DropdownMenuItem
                                    onClick={() => handleCallPatient(appointment)}
                                    disabled={callMutation.isPending}
                                    data-testid={`action-call-${appointment.id}`}
                                  >
                                    <Bell className="h-4 w-4 mr-2" /> Call Patient
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => { setSelectedAppointment(appointment); setCompleteDialogOpen(true); }}
                                  data-testid={`action-complete-${appointment.id}`}
                                >
                                  <Check className="h-4 w-4 mr-2" /> Mark Complete
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => noShowMutation.mutate(appointment.id)}
                                  disabled={noShowMutation.isPending}
                                  data-testid={`action-noshow-${appointment.id}`}
                                >
                                  <User className="h-4 w-4 mr-2" /> Mark No-Show
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => { setSelectedAppointment(appointment); setCancelDialogOpen(true); }}
                                  data-testid={`action-cancel-${appointment.id}`}
                                >
                                  <X className="h-4 w-4 mr-2" /> Cancel
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                          </div>
                          {["cancelled", "no_show"].includes(appointment.status) && appointment.cancelledBy === "doctor" && (
                            <p className="text-sm font-medium text-red-600">Rs.{platformCancellationFee} deducted from payouts</p>
                          )}
                          {["cancelled", "no_show"].includes(appointment.status) && appointment.cancelledBy === "patient" && (
                            <p className="text-sm font-medium text-amber-600">Rs.{appointment.payment?.cancellationFee ?? 0} was charged from the patient</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )) : (
                <div className="text-center py-12 border border-border/40 rounded-xl">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No {tab} appointments</p>
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Complete Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Appointment</DialogTitle>
            <DialogDescription>
              Mark this appointment as completed. You can optionally add consultation notes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Avatar>
                <AvatarImage src={selectedAppointment?.patient?.profileImage} />
                <AvatarFallback className="bg-violet-100 text-violet-600">
                  {getInitials(selectedAppointment?.patient?.fullName || "")}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{selectedAppointment?.patient?.fullName}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedAppointment?.appointmentDate} at {selectedAppointment?.appointmentTime}
                </p>
              </div>
            </div>
            <Textarea
              placeholder="Add consultation notes (optional)..."
              value={consultationNotes}
              onChange={(e) => setConsultationNotes(e.target.value)}
              rows={4}
              data-testid="input-consultation-notes"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => selectedAppointment && completeMutation.mutate({ id: selectedAppointment.id, notes: consultationNotes || undefined })}
              disabled={completeMutation.isPending}
              data-testid="button-confirm-complete"
            >
              {completeMutation.isPending && <LoadingSpinner size="sm" className="mr-2" />}
              Complete Appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Appointment</DialogTitle>
            <DialogDescription>
              Please provide a reason for cancellation. The patient will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Avatar>
                <AvatarImage src={selectedAppointment?.patient?.profileImage} />
                <AvatarFallback className="bg-violet-100 text-violet-600">
                  {getInitials(selectedAppointment?.patient?.fullName || "")}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{selectedAppointment?.patient?.fullName}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedAppointment?.appointmentDate} at {selectedAppointment?.appointmentTime}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20 p-3">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Cancelling this appointment will charge you a <span className="font-semibold">Rs.{platformCancellationFee}</span> cancellation fee, deducted from your payouts. The patient will receive a full consultation-fee refund.
              </p>
            </div>
            <Textarea
              placeholder="Reason for cancellation..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              data-testid="input-cancel-reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>Back</Button>
            <Button
              variant="destructive"
              onClick={() => selectedAppointment && cancelMutation.mutate({ id: selectedAppointment.id, reason: cancelReason })}
              disabled={cancelMutation.isPending || !cancelReason.trim()}
              data-testid="button-confirm-cancel"
            >
              {cancelMutation.isPending && <LoadingSpinner size="sm" className="mr-2" />}
              Cancel Appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Call Patient — phone number popup */}
      <Dialog open={callDialogOpen} onOpenChange={setCallDialogOpen}>
        <DialogContent className="sm:max-w-sm" data-testid="dialog-call-patient">
          <DialogHeader>
            <DialogTitle>Call Patient</DialogTitle>
            <DialogDescription>
              Copy the patient's phone number and dial it from your phone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-4">
            <Avatar className="h-14 w-14">
              <AvatarImage src={selectedAppointment?.patient?.profileImage} />
              <AvatarFallback className="bg-violet-100 text-violet-600 font-semibold">
                {getInitials(selectedAppointment?.patient?.fullName || "")}
              </AvatarFallback>
            </Avatar>
            <p className="font-medium text-center" data-testid="text-call-patient-name">
              {selectedAppointment?.patient?.fullName}
            </p>
            {selectedAppointment?.patient?.phone ? (
              <p className="text-3xl font-bold tracking-wide tabular-nums" data-testid="text-call-patient-phone">
                {selectedAppointment.patient.phone}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No phone number on file</p>
            )}
          </div>
          <DialogFooter className="flex-row justify-center gap-2 sm:justify-center">
            <Button variant="outline" onClick={() => setCallDialogOpen(false)} data-testid="button-call-close">
              Close
            </Button>
            {selectedAppointment?.patient?.phone && (
              <Button onClick={handleCopyPhone} data-testid="button-call-copy">
                {phoneCopied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" /> Copy Number
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
