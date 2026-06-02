import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, isAfter, isBefore } from "date-fns";
import {
  Calendar,
  Search,
  Filter,
  AlertCircle,
  Video,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

export default function PatientAppointmentsPage() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithDetails | null>(null);

  const { data: appointments = [], isLoading, isError } = useQuery<AppointmentWithDetails[]>({
    queryKey: ["/api/appointments"],
    staleTime: 60 * 1000,
  });

  const getInitials = (name: string) => {
    if (!name) return "DR";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const now = new Date();
  const today = format(now, "yyyy-MM-dd");

  const upcomingAppointments = appointments.filter((apt) => {
    const aptDate = parseISO(apt.appointmentDate);
    return (
      isAfter(aptDate, now) || apt.appointmentDate === today
    ) && !["cancelled", "completed", "no_show"].includes(apt.status);
  });

  // useEffect(() => {
  //   // Request Permission
  //   if ("Notification" in window && Notification.permission !== "granted") {
  //     Notification.requestPermission();
  //   }

  //   const timeouts: NodeJS.Timeout[] = [];

  //   upcomingAppointments.forEach((apt) => {
  //     if (apt.consultationType === "online" && apt.meetingLink && apt.appointmentDate === today) {
  //       const meetTime = new Date(`${apt.appointmentDate}T${apt.appointmentTime}`).getTime();
  //       const now = Date.now();
        
  //       // විනාඩි 10 කට කලින්
  //       const timeToAlert = meetTime - (10 * 60 * 1000) - now;

  //       if (timeToAlert > 0) {
  //         const timer = setTimeout(() => {
  //           if (Notification.permission === "granted") {
  //             const notification = new Notification("Upcoming Online Consultation", {
  //               body: `Your meeting with Dr. ${apt.doctor.user.fullName} starts in 10 minutes. Click to join.`,
  //               icon: "/logo-light.png",
  //             });
  //             notification.onclick = () => {
  //               window.open(apt.meetingLink!, "_blank");
  //             };
  //           }
  //         }, timeToAlert);
  //         timeouts.push(timer);
  //       }
  //     }
  //   });

  //   return () => timeouts.forEach(clearTimeout);
  // }, [upcomingAppointments]);

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
              <SelectItem value="pending">Pending</SelectItem>
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
              <SelectItem value="home_visit">Home Visit</SelectItem>
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
                  onDetailsClick={setSelectedAppointment}
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
                  onDetailsClick={setSelectedAppointment}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* --- CUSTOM MODAL --- */}
      <Modal
        isOpen={!!selectedAppointment}
        onClose={() => setSelectedAppointment(null)}
        title="Appointment Details"
        description="View your full booking information"
        icon={<Calendar className="w-5 h-5 text-primary" />}
        footer={
          <>
            <Button variant="outline" className="rounded-full font-bold px-6 border-border" onClick={() => setSelectedAppointment(null)}>
              Close
            </Button>
            {selectedAppointment?.status === AppointmentStatus.CONFIRMED && 
             selectedAppointment?.consultationType === ConsultationType.ONLINE && (
              <Button className="rounded-full font-bold px-6 bg-primary text-primary-foreground hover:bg-primary/90">
                <Video className="h-4 w-4 mr-2" />
                Join Video Call
              </Button>
            )}
          </>
        }
      >
        {selectedAppointment && (
          <div className="space-y-6">
            
            {/* Doctor Info Section */}
            <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-2xl border border-border">
              <Avatar className="h-16 w-16 border-2 border-background shadow-sm">
                <AvatarImage src={selectedAppointment.doctor?.user?.profileImage || ""} />
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                  {getInitials(selectedAppointment.doctor?.user?.fullName || "")}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-extrabold text-foreground text-lg">
                  {selectedAppointment.doctor?.user?.fullName}
                </h3>
                <p className="text-sm font-medium text-muted-foreground">
                  {selectedAppointment.doctor?.qualifications}
                </p>
                <div className="mt-2">
                  <StatusBadge status={selectedAppointment.status} type="appointment" />
                </div>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid gap-3 text-sm">
              <div className="flex items-center gap-3 p-4 bg-muted/40 rounded-xl border border-border">
                <div className="bg-background p-2 rounded-lg shadow-sm border border-border"><Calendar className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="font-bold text-foreground">
                    {format(parseISO(selectedAppointment.appointmentDate), "EEEE, MMMM d, yyyy")}
                  </p>
                  <p className="font-semibold text-muted-foreground mt-0.5">
                    {selectedAppointment.appointmentTime}
                  </p>
                </div>
              </div>

              {selectedAppointment.queueNumber && (
                <div className="flex items-center gap-3 p-4 bg-muted/40 rounded-xl border border-border">
                  <div className="h-9 w-9 flex items-center justify-center font-black bg-primary text-primary-foreground rounded-lg shadow-sm">
                    #
                  </div>
                  <div>
                    <p className="font-bold text-foreground">Queue Number</p>
                    <p className="font-semibold text-muted-foreground mt-0.5">{selectedAppointment.queueNumber}</p>
                  </div>
                </div>
              )}

              <div className="p-4 bg-muted/40 rounded-xl border border-border">
                <p className="font-bold text-foreground mb-1.5">Symptoms</p>
                <p className="font-medium text-muted-foreground leading-relaxed">{selectedAppointment.symptoms}</p>
              </div>

              {selectedAppointment.consultationNotes && (
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
                  <p className="font-bold text-primary mb-1.5">Doctor's Notes</p>
                  <p className="font-medium text-primary/80 leading-relaxed">{selectedAppointment.consultationNotes}</p>
                </div>
              )}

              {selectedAppointment.cancelReason && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl">
                  <p className="font-bold text-destructive mb-1.5">Cancellation Reason</p>
                  <p className="font-medium text-destructive/80 leading-relaxed">{selectedAppointment.cancelReason}</p>
                </div>
              )}

              {/* Online Consultation Link Section */}
              {selectedAppointment?.consultationType === ConsultationType.ONLINE && selectedAppointment.slot?.meetLink && (
                <div className="flex items-center gap-3 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
                    <Video className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between w-full">
                    <p className="font-bold text-indigo-900 dark:text-indigo-100 text-sm">Online Consultation</p>
                    <Button 
                      variant="outline"
                      className="px-3 py-1 h-auto text-sm font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
                      onClick={() => {
                        if (selectedAppointment.slot?.meetLink) {
                          window.open(selectedAppointment.slot.meetLink, "_blank", "noopener,noreferrer");
                        }
                      }}
                    >
                      Join Google Meet
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}