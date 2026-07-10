import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, parseISO, isAfter, isBefore, isToday } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { SRI_LANKAN_BANKS } from "@/lib/banks";
import {
  Calendar,
  Search,
  Filter,
  AlertCircle,
  AlertTriangle,
  Video,
  FileText,
  Copy,
  Stethoscope,
  Building2,
  MapPin,
  Clock,
  Receipt,
  User,
  CreditCard,
  XCircle,
  RotateCcw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LoadingPage } from "@/components/ui/loading-spinner";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Update path to where your Modal component is located
import { Modal } from "@/components/ui/modal"; 
import { AppointmentCard } from "@/components/ui/appointment-card";
import type { AppointmentWithDetails } from "@shared/schema";
import { ConsultationType, AppointmentStatus } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function PatientAppointmentsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithDetails | null>(null);

  const { data: appointments = [], isLoading, isError } = useQuery<AppointmentWithDetails[]>({
    queryKey: ["/api/appointments"],
    staleTime: 60 * 1000,
  });

  // Outstanding cancellation charges owed to AyurPath; drives the notice banner.
  const { data: owedCharges } = useQuery<{ count: number; totalOwed: number }>({
    queryKey: ["/api/patient/owed-charges"],
    staleTime: 60 * 1000,
  });
  const hasOwedCharges = (owedCharges?.totalOwed ?? 0) > 0;

  // --- Cancellation flow ---
  const PATIENT_DAILY_CANCEL_LIMIT = 5;
  const [cancelTarget, setCancelTarget] = useState<AppointmentWithDetails | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankBranch, setBankBranch] = useState("");

  const cancellationsToday = appointments.filter(
    (a) =>
      a.cancelledBy === "patient" &&
      a.status === "cancelled" &&
      a.updatedAt &&
      isToday(parseISO(a.updatedAt)),
  ).length;
  const cancellationsLeft = Math.max(0, PATIENT_DAILY_CANCEL_LIMIT - cancellationsToday);

  // Human-readable cancellation charge for the confirmation dialog.
  const getCancellationCharge = (apt: AppointmentWithDetails | null): string => {
    const doc = apt?.doctor as any;
    if (!doc?.cancellationFeeEnabled || !doc?.cancellationFeeAmount) return "Rs.0";
    if (doc.cancellationFeeType === "percentage") return `${doc.cancellationFeeAmount}% of the consultation fee`;
    return `Rs.${doc.cancellationFeeAmount}`;
  };

  const openCancelDialog = (apt: AppointmentWithDetails) => {
    setCancelTarget(apt);
    setCancelReason("");
    setBankName("");
    setBankAccountNumber("");
    setBankBranch("");
  };
  const closeCancelDialog = () => setCancelTarget(null);

  const cancelMutation = useMutation({
    mutationFn: (vars: { id: string; reason: string; bankName: string; bankAccountNumber: string; bankBranch: string }) =>
      apiRequest("PATCH", `/api/appointments/${vars.id}/cancel`, {
        reason: vars.reason,
        bankName: vars.bankName,
        bankAccountNumber: vars.bankAccountNumber,
        bankBranch: vars.bankBranch,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patient/owed-charges"] });
      toast({ title: "Appointment cancelled", description: "Your refund is now processing." });
      closeCancelDialog();
    },
    onError: (err: any) => {
      toast({ title: "Could not cancel", description: err?.message || "Please try again.", variant: "destructive" });
    },
  });

  const submitCancel = () => {
    if (!cancelTarget) return;
    cancelMutation.mutate({ id: cancelTarget.id, reason: cancelReason, bankName, bankAccountNumber, bankBranch });
  };

  // --- Refund detail popup ---
  const [refundTarget, setRefundTarget] = useState<AppointmentWithDetails | null>(null);

  // Route "View Details" / card clicks: cancelled + completed refund -> refund popup; otherwise the summary.
  const handleDetails = (apt: AppointmentWithDetails) => {
    const isCancelled = ["cancelled", "no_show"].includes(apt.status);
    const refundCompleted = apt.payment?.refundStatus === "completed";
    if (isCancelled) {
      if (refundCompleted) setRefundTarget(apt);
      // while the refund is still processing there are no details to show yet
    } else {
      setSelectedAppointment(apt);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "DR";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
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

  const formatFee = (fee: number | undefined | null) => {
    if (fee === undefined || fee === null) return "N/A";
    return new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', minimumFractionDigits: 2 }).format(fee);
  };

  const formatLKRWhole = (amount: number) =>
    new Intl.NumberFormat("en-LK", { maximumFractionDigits: 0 }).format(amount);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard", description: `${label} has been copied.` });
  };

  const now = new Date();
  const today = format(now, "yyyy-MM-dd");

  const upcomingAppointments = appointments.filter((apt) => {
    const aptDate = parseISO(apt.appointmentDate);
    return (
      isAfter(aptDate, now) || apt.appointmentDate === today
    ) && !["cancelled", "completed", "no_show"].includes(apt.status);
  });

  const pastAppointments = appointments.filter((apt) => {
    const aptDate = parseISO(apt.appointmentDate);
    return (
      isBefore(aptDate, now) && apt.appointmentDate !== today
    ) || ["completed", "cancelled", "no_show"].includes(apt.status);
  });

  const filterAppointments = (appointmentList: AppointmentWithDetails[]) => {
    return appointmentList.filter((apt) => {
      const matchesSearch =
        searchQuery === "" ||
        apt.doctor?.user?.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        apt.hospital?.name?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === "all" || apt.status === statusFilter;
      const matchesType = typeFilter === "all" || apt.consultationType === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  };

  const filteredUpcoming = filterAppointments(upcomingAppointments);
  const filteredPast = filterAppointments(pastAppointments);

  if (isLoading) return <LoadingPage message="Loading appointments..." />;

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground font-medium">Failed to load appointments. Please try again.</p>
        <Button onClick={() => window.location.reload()} variant="outline">Retry</Button>
      </div>
    );
  }

  const EmptyState = ({ message }: { message: string }) => (
    <Card className="border-border bg-card shadow-sm rounded-2xl">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
          <Calendar className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground text-center font-medium">{message}</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      
      {/* Header Section */}
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-foreground tracking-tight">My Appointments</h1>
        <p className="text-sm md:text-base text-muted-foreground font-medium">View and manage your appointments</p>
      </div>

      {/* Owed to AyurPath notice — always shown as a standing cancellation-charge notice */}
      <div
        className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20 p-4 md:p-5"
        data-testid="banner-owed-to-ayurpath"
      >
        <AlertTriangle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold text-red-700 dark:text-red-300">Owed to AyurPath</p>
          <p className="text-sm text-red-600/90 dark:text-red-300/80">
            When you cancel an appointment, the cancellation charge is billed back to you. The cancellation charge determined by doctor.
          </p>
        </div>
      </div>

      {/* Filters Section */}
      <div className="flex flex-col sm:flex-row gap-3 md:gap-4 items-center bg-card p-3 md:p-4 rounded-2xl border border-border shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by doctor or hospital..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-background border-border rounded-xl h-10 w-full"
          />
        </div>
        
        <div className="flex gap-3 w-full sm:w-auto">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[150px] bg-background border-border rounded-xl h-10 font-semibold">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[150px] bg-background border-border rounded-xl h-10 font-semibold">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border">
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="in_person">In-Person</SelectItem>
              <SelectItem value="online">Online</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs & List Section */}
      <Tabs defaultValue="upcoming" className="w-full animate-in fade-in duration-500">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px] bg-muted/50 p-1.5 rounded-xl border border-border">
          <TabsTrigger value="upcoming" className="rounded-lg font-bold data-[state=active]:bg-card data-[state=active]:shadow-sm">
            Current ({upcomingAppointments.length})
          </TabsTrigger>
          <TabsTrigger value="past" className="rounded-lg font-bold data-[state=active]:bg-card data-[state=active]:shadow-sm">
            Past ({pastAppointments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-6 focus-visible:outline-none">
          {filteredUpcoming.length === 0 ? (
            <EmptyState message="No current appointments found." />
          ) : (
            <div className="space-y-4">
              {filteredUpcoming.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  onFeedbackClick={() => setLocation("/patient/reviews")}
                  onDetailsClick={handleDetails}
                  onCancelClick={openCancelDialog}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="past" className="mt-6 focus-visible:outline-none">
          {filteredPast.length === 0 ? (
            <EmptyState message="No past appointments found." />
          ) : (
            <div className="space-y-4">
              {filteredPast.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  onFeedbackClick={() => setLocation("/patient/reviews")}
                  onDetailsClick={handleDetails}
                  onCancelClick={openCancelDialog}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Modal
        isOpen={!!selectedAppointment}
        onClose={() => setSelectedAppointment(null)}
        title="Appointment Summary"
        description="Complete details of your booking and payment record."
        icon={<FileText className="w-5 h-5 text-primary" />}
        className="max-w-5xl w-[95vw] flex flex-col"
        footer={
          <div className="flex w-full justify-between items-center flex-wrap gap-4">
            <p className="text-xs text-muted-foreground hidden sm:block">Need help? Quote your Appointment ID to support.</p>
            <div className="flex gap-3 w-full sm:w-auto">
              <Button variant="outline" className="rounded-full px-6 w-full sm:w-auto border-border" onClick={() => setSelectedAppointment(null)}>
                Close
              </Button>
              {selectedAppointment?.status === AppointmentStatus.CONFIRMED && 
               selectedAppointment?.consultationType === ConsultationType.ONLINE && 
               selectedAppointment?.slot?.meetLink && (
                <Button className="rounded-full px-6 w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold" onClick={() => window.open(selectedAppointment.slot?.meetLink!, "_blank")}>
                  <Video className="w-4 h-4 mr-2" /> Join Video Call
                </Button>
              )}
            </div>
          </div>
        }
      >
        {selectedAppointment && (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-1 pr-3 pb-6">
            
            {/* Top IDs Banner */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 p-4 sm:p-5 bg-muted/30 rounded-2xl border border-border">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Appointment Record ID</p>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm sm:text-base font-bold text-foreground">{selectedAppointment.id}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 bg-background shadow-sm hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => copyToClipboard(selectedAppointment.id, "Appointment ID")}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="shrink-0">
                <StatusBadge status={selectedAppointment.status} type="appointment" />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Column 1: Doctor Info */}
              <div className="space-y-6">
                <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5 h-full">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                    <Stethoscope className="w-4 h-4" /> Medical Provider
                  </h3>
                  <div className="flex items-center gap-4 mb-5">
                    <Avatar className="h-16 w-16 shadow-sm border-2 border-primary/10">
                      <AvatarImage src={selectedAppointment.doctor?.user?.profileImage} className="object-cover" />
                      <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">{getInitials(selectedAppointment.doctor?.user?.fullName || "")}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-lg text-foreground leading-tight truncate">{selectedAppointment.doctor?.user?.fullName}</p>
                      <p className="text-sm font-medium text-muted-foreground mt-0.5 line-clamp-2">{selectedAppointment.doctor?.qualifications}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4 pt-5 border-t border-border/50">
                    <div>
                      <p className="text-muted-foreground mb-2 font-bold text-[10px] uppercase tracking-widest">Consultation Venue</p>
                      {selectedAppointment.consultationType === "in_person" && selectedAppointment.hospital ? (
                        <div className="flex items-start gap-3 bg-muted/40 p-3.5 rounded-xl border border-border/50">
                          <Building2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-foreground truncate">{selectedAppointment.hospital.name}</p>
                            <p className="text-xs text-muted-foreground mt-1 leading-snug">{selectedAppointment.hospital.address}, {selectedAppointment.hospital.city}</p>
                          </div>
                        </div>
                      ) : selectedAppointment.consultationType === "online" ? (
                        <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/10 p-3.5 rounded-xl border border-blue-100 dark:border-blue-800/30">
                          <Video className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold text-sm text-blue-900 dark:text-blue-100">Digital Consultation</p>
                            <p className="text-xs text-blue-700/80 dark:text-blue-300 mt-1 leading-snug">A secure Google Meet link has been generated for this session.</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3 bg-purple-50 dark:bg-purple-900/10 p-3.5 rounded-xl border border-purple-100 dark:border-purple-800/30">
                          <MapPin className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold text-sm text-purple-900 dark:text-purple-100">Home Visit Request</p>
                            <p className="text-xs text-purple-700/80 dark:text-purple-300 mt-1 leading-snug">The doctor will visit the address provided in your profile.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Column 2: Session Details & Notes */}
              <div className="space-y-6">
                <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5 h-full">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> Booking Details
                  </h3>
                  
                  <div className="flex items-center gap-4 mb-5 p-4 bg-primary/5 rounded-xl border border-primary/10">
                    <div className="w-14 h-14 rounded-xl bg-background flex flex-col items-center justify-center border border-border shadow-sm shrink-0">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">{format(parseISO(selectedAppointment.appointmentDate), "MMM")}</span>
                      <span className="text-xl font-black text-primary leading-none">{format(parseISO(selectedAppointment.appointmentDate), "dd")}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-base truncate">{format(parseISO(selectedAppointment.appointmentDate), "EEEE, yyyy")}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5 font-medium mt-1 truncate">
                        <Clock className="w-3.5 h-3.5 text-primary/70 shrink-0" /> 
                        {formatTime(selectedAppointment.slot?.startTime || selectedAppointment.appointmentTime)} - {formatTime(selectedAppointment.slot?.endTime || "")}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className="p-3.5 bg-muted/30 rounded-xl border border-border/50 text-center flex flex-col justify-center">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1 tracking-wider">Queue Number</p>
                      <p className="font-black text-xl text-primary">{selectedAppointment.queueNumber ? `#${selectedAppointment.queueNumber}` : "N/A"}</p>
                    </div>
                    <div className="p-3.5 bg-muted/30 rounded-xl border border-border/50 text-center flex flex-col justify-center">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1 tracking-wider">Consultation Type</p>
                      <p className="font-bold text-sm text-foreground capitalize mt-1">{selectedAppointment.consultationType.replace("_", " ")}</p>
                    </div>
                  </div>

                  {selectedAppointment.isForDependent && (
                    <div className="mb-5 p-3.5 bg-orange-50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30 rounded-xl">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-orange-800 dark:text-orange-400 mb-2 flex items-center gap-1.5"><User className="w-3 h-3"/> Dependent Booking</h4>
                      <p className="text-sm font-semibold text-foreground">{selectedAppointment.dependentName} <span className="font-medium text-muted-foreground">({selectedAppointment.dependentAge}y, {selectedAppointment.dependentGender})</span></p>
                    </div>
                  )}

                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2 tracking-wider">Symptoms / Medical Notes</p>
                    <div className="p-3.5 bg-muted/20 rounded-xl text-sm leading-relaxed border border-border/50 min-h-[70px]">
                      {selectedAppointment.symptoms || <span className="italic text-muted-foreground/60">No specific symptoms were provided during booking.</span>}
                    </div>
                  </div>

                  {selectedAppointment.cancelReason && (
                    <div className="mt-5 p-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30">
                      <p className="text-xs font-bold text-red-800 dark:text-red-300 uppercase mb-1.5 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5"/> Cancellation Reason</p>
                      <p className="text-sm text-red-700 dark:text-red-400 font-medium leading-snug">{selectedAppointment.cancelReason}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Column 3: Payment Ledger */}
              <div className="space-y-6">
                <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <Receipt className="w-4 h-4" /> Financial Ledger
                    </h3>
                    {selectedAppointment.payment && (
                      <Badge variant={selectedAppointment.payment.status === "completed" ? "default" : "secondary"} className={selectedAppointment.payment.status === "completed" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0" : ""}>
                        {selectedAppointment.payment.status.toUpperCase()}
                      </Badge>
                    )}
                  </div>

                  {selectedAppointment.payment ? (
                    <div className="flex flex-col flex-1">
                      <div className="space-y-3.5 mb-6 flex-1">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground font-medium">Consultation Fee</span>
                          <span className="font-bold">{formatFee(selectedAppointment.payment.consultationFee)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground font-medium">Platform Charges</span>
                          <span className="font-bold">{formatFee(selectedAppointment.payment.bookingCharges)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground font-medium">Taxes & Levies</span>
                          <span className="font-bold">{formatFee(selectedAppointment.payment.tax)}</span>
                        </div>
                      </div>
                      
                      <div className="p-5 bg-primary/5 rounded-xl border border-primary/20 mb-6 flex justify-between items-center">
                        <span className="font-bold text-sm text-primary uppercase tracking-wider">Total Paid</span>
                        <span className="font-black text-2xl text-primary">{formatFee(selectedAppointment.payment.totalAmount)}</span>
                      </div>

                      <div className="space-y-3 pt-5 border-t border-border">
                        <div className="flex items-center justify-between text-xs text-muted-foreground font-mono bg-muted/40 p-2.5 rounded-lg border border-border/50">
                          <span className="flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5"/> Method</span>
                          <span className="uppercase font-bold text-foreground">{selectedAppointment.payment.method.replace("_", " ")}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground font-mono bg-muted/40 p-2.5 rounded-lg border border-border/50">
                          <span>Pay Ref:</span>
                          <span className="flex items-center gap-1.5 font-bold text-foreground truncate pl-2">
                            {selectedAppointment.payment.id.split('-')[0]} 
                            <Copy className="w-3.5 h-3.5 cursor-pointer hover:text-primary transition-colors shrink-0" onClick={() => copyToClipboard(selectedAppointment.payment!.id, "Payment ID")} />
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground py-10 bg-muted/20 rounded-xl border border-dashed border-border">
                      <AlertCircle className="w-10 h-10 mb-3 opacity-30" />
                      <p className="text-sm font-bold text-foreground">No payment record found</p>
                      <p className="text-xs mt-1 max-w-[200px]">This could be a direct clinic payment or pending transaction.</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}
      </Modal>

      {/* Cancel appointment dialog */}
      <Modal
        isOpen={!!cancelTarget}
        onClose={closeCancelDialog}
        title="Cancel This Appointment?"
        description="Do you want to permanently cancel this appointment?"
        icon={<XCircle className="w-5 h-5 text-destructive" />}
        className="max-w-lg w-[95vw]"
        footer={
          <div className="flex w-full gap-3 justify-end flex-wrap">
            <Button
              variant="destructive"
              className="rounded-full px-6 gap-1.5"
              onClick={submitCancel}
              disabled={
                cancelMutation.isPending ||
                !cancelReason.trim() ||
                !bankName.trim() ||
                !bankAccountNumber.trim() ||
                !bankBranch.trim() ||
                cancellationsLeft <= 0
              }
              data-testid="button-confirm-cancel"
            >
              {cancelMutation.isPending && <LoadingSpinner size="sm" className="mr-1" />}
              Reject <XCircle className="w-4 h-4" />
            </Button>
            <Button variant="outline" className="rounded-full px-6 border-border" onClick={closeCancelDialog}>
              Back to Appointment
            </Button>
          </div>
        }
      >
        {cancelTarget && (
          <div className="space-y-4">
            {/* Owed to AyurPath warning */}
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20 p-4">
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold text-red-700 dark:text-red-300">Owed to AyurPath</p>
                <p className="text-sm text-red-600/90 dark:text-red-300/80">
                  When you cancel an appointment, the cancellation charge is billed back to you. The cancellation charge is {getCancellationCharge(cancelTarget)}.
                </p>
              </div>
            </div>

            {(() => {
              const danger = cancellationsLeft === 0;
              const warn = cancellationsLeft > 0 && cancellationsLeft <= 2;
              const wrap = danger
                ? "border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20"
                : warn
                ? "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20"
                : "border-primary/20 bg-primary/5";
              const iconWrap = danger
                ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300"
                : warn
                ? "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300"
                : "bg-primary/10 text-primary";
              const dotOn = danger ? "bg-red-500" : warn ? "bg-amber-500" : "bg-primary";
              const title = danger
                ? "text-red-700 dark:text-red-300"
                : warn
                ? "text-amber-700 dark:text-amber-300"
                : "text-foreground";
              return (
                <div
                  className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${wrap}`}
                  data-testid="text-cancellations-left"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${iconWrap}`}>
                      <RotateCcw className="h-4 w-4" />
                    </div>
                    <div className="leading-tight min-w-0">
                      <p className={`text-sm font-bold ${title}`}>
                        {danger
                          ? "No cancellations left today"
                          : `${cancellationsLeft} of ${PATIENT_DAILY_CANCEL_LIMIT} cancellations left today`}
                      </p>
                      <p className="text-[11px] text-muted-foreground">Your daily limit resets tomorrow.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {Array.from({ length: PATIENT_DAILY_CANCEL_LIMIT }).map((_, i) => (
                      <span
                        key={i}
                        className={`h-2.5 w-2.5 rounded-full transition-colors ${i < cancellationsLeft ? dotOn : "bg-muted-foreground/20"}`}
                      />
                    ))}
                  </div>
                </div>
              );
            })()}

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tell Why you cancel this appointment</label>
              <Textarea
                placeholder="Enter the reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                data-testid="input-cancel-reason"
              />
            </div>

            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Enter your bank details for refund</p>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Bank Name <span className="text-red-500">*</span></label>
                <Select value={bankName} onValueChange={setBankName}>
                  <SelectTrigger data-testid="select-bank-name">
                    <SelectValue placeholder="Select your bank" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[260px]">
                    {SRI_LANKAN_BANKS.map((b) => (
                      <SelectItem key={b.name} value={b.name}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Account Number <span className="text-red-500">*</span></label>
                <Input placeholder="10066655578" value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} data-testid="input-bank-account" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Branch <span className="text-red-500">*</span></label>
                <Input placeholder="Galle main" value={bankBranch} onChange={(e) => setBankBranch(e.target.value)} data-testid="input-bank-branch" />
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Cancellation refund detail popup */}
      <Modal
        isOpen={!!refundTarget}
        onClose={() => setRefundTarget(null)}
        title="Cancellation refund"
        description="Review and confirm refund details"
        icon={<Receipt className="w-5 h-5 text-primary" />}
        className="max-w-lg w-[95vw]"
        footer={
          <div className="flex w-full justify-end">
            <Button variant="outline" className="rounded-full px-6 border-border" onClick={() => setRefundTarget(null)}>
              Close
            </Button>
          </div>
        }
      >
        {refundTarget && (() => {
          const p = refundTarget.payment;
          const amountPaid = p?.totalAmount ?? 0;
          const booking = p?.bookingCharges ?? 0;
          const tax = p?.tax ?? 0;
          const cancellationFee = p?.cancellationFee ?? 0;
          const refundAmount = p?.refundAmount ?? Math.max(0, amountPaid - booking - tax - cancellationFee);
          const byDoctor = refundTarget.cancelledBy === "doctor";
          const typeLabel = refundTarget.consultationType === "online" ? "Online Consultation"
            : refundTarget.consultationType === "home_visit" ? "Home Visit" : "In Person Consultation";
          return (
            <div className="space-y-4">
              {/* Patient + type */}
              <div className="flex items-start justify-between gap-3 rounded-2xl bg-muted/40 border border-border p-4">
                <div>
                  <p className="font-bold text-foreground">{refundTarget.patient?.fullName}</p>
                  <p className="text-sm text-muted-foreground">
                    Ayurvedic consultation · {format(parseISO(refundTarget.appointmentDate), "MMM d, yyyy")}
                  </p>
                </div>
                <Badge className={`shrink-0 border-0 ${
                  refundTarget.consultationType === "online" ? "bg-indigo-100 text-indigo-700"
                  : refundTarget.consultationType === "home_visit" ? "bg-blue-100 text-blue-700"
                  : "bg-purple-100 text-purple-700"
                }`}>
                  {typeLabel}
                </Badge>
              </div>

              {/* Eligibility banner */}
              <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 px-4 py-2.5">
                <Stethoscope className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-sm font-medium text-red-600 dark:text-red-300">
                  {byDoctor ? "Doctor cancelled" : "Patient cancelled"} — Only consultation fee refund eligible
                </p>
              </div>

              {/* Breakdown */}
              <div className="rounded-2xl border border-border overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <span className="text-foreground">Amount Paid</span>
                  <span className="font-bold text-foreground">LKR {formatLKRWhole(amountPaid)}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <span className="text-foreground flex items-center gap-2">
                    Booking Charges
                    <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded">Non-refundable</span>
                  </span>
                  <span className="font-semibold text-red-600">− LKR {formatLKRWhole(booking)}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <span className="text-foreground flex items-center gap-2">
                    Tax
                    <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded">Non-refundable</span>
                  </span>
                  <span className="font-semibold text-red-600">− LKR {formatLKRWhole(tax)}</span>
                </div>
                {!byDoctor && cancellationFee > 0 && (
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <span className="text-foreground">Cancellation fee</span>
                    <span className="font-semibold text-red-600">− LKR {formatLKRWhole(cancellationFee)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between px-4 py-3.5 bg-emerald-50/60 dark:bg-emerald-950/20">
                  <span className="font-bold text-foreground">Total refunded to patient</span>
                  <span className="font-black text-lg text-emerald-700 dark:text-emerald-400">LKR {formatLKRWhole(refundAmount)}</span>
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 px-4 py-3">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Refund will be credited to your provided bank account within 3–5 business days.
                </p>
              </div>
            </div>
          );
        })()}
      </Modal>

    </div>
  );
}