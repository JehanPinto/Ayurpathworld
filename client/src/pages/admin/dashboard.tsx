import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Users, 
  Stethoscope, 
  Calendar, 
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  ArrowRight,
  Activity,
  FileText,
  Mail,
  Phone,
  MapPin,
  Languages,
  Building2,
  LayoutDashboard
} from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LoadingPage } from "@/components/ui/loading-spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import type { AdminDashboardStats, DoctorWithDetails } from "@shared/schema";
import { DoctorStatus } from "@shared/schema";

// Custom hook to animate numbers counting up
function useCountUp(endValue: number, duration: number = 1500) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    let animationFrameId: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      // Ease-out function for smooth stopping
      const easeOut = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      
      setCount(Math.round(easeOut * endValue));

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    if (endValue > 0) {
      animationFrameId = requestAnimationFrame(animate);
    } else {
      setCount(0);
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [endValue, duration]);

  return count;
}

const getDocumentUrl = (filename: string) => {
  if (!filename) return "#";
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  return token ? `/api/documents/${filename}?token=${token}` : `/api/documents/${filename}`;
};

interface DashboardData {
  stats: AdminDashboardStats;
  pendingDoctors: DoctorWithDetails[];
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorWithDetails | null>(null);
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const { data: dashboardData, isLoading, isError } = useQuery<DashboardData>({
    queryKey: ["/api/admin/dashboard"],
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const verifyMutation = useMutation({
    mutationFn: (doctorId: string) => 
      apiRequest("PATCH", `/api/admin/doctors/${doctorId}/verify`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/doctors"] });
      toast({
        title: "Doctor verified",
        description: "The doctor has been moved to the verified list.",
      });
      setShowVerificationDialog(false);
      setSelectedDoctor(null);
    },
    onError: () => {
      toast({
        title: "Verification failed",
        description: "Could not verify the doctor. Please try again.",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ doctorId, reason }: { doctorId: string; reason: string }) =>
      apiRequest("PATCH", `/api/admin/doctors/${doctorId}/reject`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/doctors"] });
      toast({ title: "Doctor Rejected", description: "The doctor application has been rejected." });
      setShowRejectDialog(false);
      setShowVerificationDialog(false);
      setSelectedDoctor(null);
      setRejectReason("");
    },
    onError: () => {
      toast({ title: "Rejection failed", description: "Could not reject the doctor. Please try again.", variant: "destructive" });
    },
  });

  const formatFee = (fee: number) => {
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(fee);
  };

  const getInitials = (name: string) => {
    if (!name) return "DR";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  // Prepare stats safely before early returns for hooks
  const stats = dashboardData?.stats || {
    totalPatients: 0,
    totalDoctors: 0,
    verifiedDoctors: 0,
    pendingDoctors: 0,
    totalAppointments: 0,
    todayAppointments: 0,
    totalRevenue: 0,
    platformEarnings: 0,
  };

  const pendingDoctors = dashboardData?.pendingDoctors || [];

  const verificationRate = stats.totalDoctors > 0
    ? Math.round((stats.verifiedDoctors / stats.totalDoctors) * 100) 
    : 0;

  // Apply number counting animations
  const animTotalPatients = useCountUp(stats.totalPatients);
  const animTotalDoctors = useCountUp(stats.totalDoctors);
  const animVerifiedDoctors = useCountUp(stats.verifiedDoctors);
  const animPendingDoctors = useCountUp(stats.pendingDoctors);
  const animTodayAppointments = useCountUp(stats.todayAppointments);
  const animTotalAppointments = useCountUp(stats.totalAppointments);
  const animPlatformEarnings = useCountUp(stats.platformEarnings);
  const animTotalRevenue = useCountUp(stats.totalRevenue);
  const animVerificationRate = useCountUp(verificationRate);

  // SVG parameters and animation for Donut Chart
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference - (verificationRate / 100) * circumference;
  
  // Start with empty chart (full circumference offset)
  const [animatedOffset, setAnimatedOffset] = useState(circumference);

  // Trigger chart draw animation once loading is done
  useEffect(() => {
    if (!isLoading && !isError) {
      const timer = setTimeout(() => {
        setAnimatedOffset(targetOffset);
      }, 150); // slight delay ensures the CSS transition catches it
      return () => clearTimeout(timer);
    }
  }, [isLoading, isError, targetOffset]);

  if (isLoading) {
    return <LoadingPage message="Loading dashboard..." />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 px-4 text-center">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">Failed to load dashboard. Please try again.</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  const handleOpenDoctor = (doctor: DoctorWithDetails) => {
    setSelectedDoctor(doctor);
    setShowVerificationDialog(true);
  };

  const handleCloseDialog = () => {
    setShowVerificationDialog(false);
    setSelectedDoctor(null);
  };

  const getDocumentLink = (doc: string) => {
    const filename = doc.split("/").pop() || "";
    return doc.startsWith("http") ? doc : getDocumentUrl(filename);
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-[22px] md:text-[24px] font-heading font-bold text-foreground">
            Admin Dashboard
          </h1>
          <p className="text-xs sm:text-[14px] text-muted-foreground">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        </div>
        <div className="flex gap-2 sm:gap-3 flex-wrap">
          <Link href="/admin/doctors/pending">
            <Button variant="outline" className="rounded-full text-foreground bg-background hover:bg-muted h-9 sm:h-10 px-4 sm:px-5 shadow-sm text-xs sm:text-sm border-border">
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 shrink-0" />
              Pending: {animPendingDoctors}
            </Button>
          </Link>
          <Link href="/admin/reports">
            <Button className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground h-9 sm:h-10 px-4 sm:px-6 shadow-sm text-xs sm:text-sm">
              <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 shrink-0" />
              View Reports
            </Button>
          </Link>
        </div>
      </div>

      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Patients */}
        <Card className="border border-primary/30 shadow-sm rounded-2xl bg-card">
          <CardContent className="p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-background dark:bg-blue-900/30 flex items-center justify-center shrink-0">
              <Users className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-foreground mb-1 truncate font-bold">Total Patients</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground leading-none mb-1 truncate">{animTotalPatients.toLocaleString()}</p>
              <p className="text-[10px] sm:text-xs text-primary flex items-center gap-1 font-medium truncate">
                <TrendingUp className="h-3 w-3 shrink-0" />
                Registered Users
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Doctors */}
        <Card className="border border-primary/30 shadow-sm rounded-2xl bg-card">
          <CardContent className="p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Stethoscope className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-foreground font-bold mb-1 truncate">Total Doctors</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground leading-none mb-1 truncate">{animTotalDoctors}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">
                {animVerifiedDoctors} verified
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Appointments */}
        <Card className="border border-primary/30 shadow-sm rounded-2xl bg-card">
          <CardContent className="p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
              <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-foreground font-bold mb-1 truncate">Today's Appointments</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground leading-none mb-1 truncate">{animTodayAppointments}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">
                {animTotalAppointments.toLocaleString()} total
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Revenue */}
        <Card className="border border-primary/30 shadow-sm rounded-2xl bg-card">
          <CardContent className="p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-secondary/20 dark:bg-secondary/30 flex items-center justify-center shrink-0">
              <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-secondary dark:text-secondary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-foreground font-bold mb-1 truncate">Platform Revenue</p>
              <p className="text-lg sm:text-[22px] font-bold text-foreground leading-none mb-1 truncate">{formatFee(animPlatformEarnings)}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">
                Total: {formatFee(animTotalRevenue)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Column: Pending Doctors */}
        <Card className="xl:col-span-2 border border-primary/30 shadow-sm rounded-2xl flex flex-col h-[480px] sm:h-[540px] bg-card pb-5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-base sm:text-[18px] text-foreground">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500 shrink-0" />
              <span className="truncate">Pending Doctor Verifications</span>
            </CardTitle>
            <Badge className="bg-secondary hover:bg-secondary/90 text-secondary-foreground px-2 sm:px-3 py-1 rounded-md text-[10px] sm:text-xs font-medium shrink-0 ml-2">
              {animPendingDoctors} pending
            </Badge>
          </CardHeader>
          
          <CardContent className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-6 space-y-3 sm:space-y-4">
            {pendingDoctors.length > 0 ? (
              pendingDoctors.map((doctor) => (
                <div 
                  key={doctor.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-xl bg-accent/80 transition-all hover:bg-accent dark:bg-primary/10 border border-border"
                >
                  <div className="flex items-start sm:items-center gap-3 sm:gap-4 w-full sm:w-auto min-w-0">
                    <Avatar className="h-12 w-12 sm:h-14 sm:w-14 border-2 border-background shadow-sm shrink-0">
                      <AvatarImage src={doctor.user?.profileImage} />
                      <AvatarFallback className="bg-secondary/20 text-secondary font-bold text-sm sm:text-lg">
                        {getInitials(doctor.user?.fullName || "")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-foreground text-sm sm:text-base truncate">{doctor.user?.fullName}</h4>
                      <p className="text-[11px] sm:text-sm text-muted-foreground mb-1.5 truncate">
                        {doctor.specializations?.map(s => s.name).join(", ") || "General Physician"}
                      </p>
                      <Badge variant="outline" className="bg-background text-[10px] sm:text-xs border-border text-foreground rounded-md px-1.5 sm:px-2 py-0 sm:py-0.5">
                        {doctor.registrationNumber}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center w-full sm:w-auto mt-3 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-primary/10 shrink-0 gap-2 sm:gap-1.5">
                    <span className="text-[10px] sm:text-[11px] text-muted-foreground font-medium whitespace-nowrap">
                      Applied: {format(new Date(doctor.createdAt), "MMM dd, yyyy")}
                    </span>
                    <Button
                      onClick={() => handleOpenDoctor(doctor)}
                      variant="outline"
                      className="rounded-md px-4 sm:px-5 h-8 sm:h-9 shadow-sm text-xs sm:text-sm"
                    >
                      <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                      View More
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-8 px-4">
                <CheckCircle className="h-12 w-12 sm:h-16 sm:w-16 text-primary/40 mb-3 sm:mb-4" />
                <h3 className="text-base sm:text-lg font-semibold text-foreground">All Caught Up!</h3>
                <p className="text-xs sm:text-sm text-muted-foreground max-w-xs mt-1">
                  There are no pending doctor verifications at the moment.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column */}
        <div className="grid grid-cols-1 xl:grid-cols-1 gap-6">
          
          {/* Verification Rate Donut Chart */}
          <Card className="border border-primary/30 shadow-sm rounded-2xl bg-card">
            <CardHeader className="pb-0 sm:pb-2">
              <CardTitle className="flex items-center gap-2 text-base sm:text-[17px] text-foreground">
                <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                Doctor Verification Rate
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row items-center justify-center py-5 sm:py-6 gap-5 sm:gap-6">
              
              <div className="relative flex items-center justify-center shrink-0">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle 
                    cx="50%" cy="50%" r={radius} 
                    stroke="hsl(var(--secondary))" strokeWidth="16" fill="none" 
                    className="opacity-90"
                  />
                  <circle 
                    cx="50%" cy="50%" r={radius} 
                    stroke="hsl(var(--primary))" strokeWidth="16" fill="none" 
                    strokeDasharray={circumference} 
                    strokeDashoffset={animatedOffset} 
                    className="transition-all duration-1000 ease-in-out"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-2xl sm:text-3xl font-bold text-foreground">{animVerificationRate}%</span>
                  <span className="text-[9px] sm:text-[10px] text-muted-foreground font-medium leading-none mt-1 text-center">doctors<br/>verified</span>
                </div>
              </div>

              <div className="flex flex-row sm:flex-col flex-wrap justify-center gap-3 sm:gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-primary shrink-0"></div>
                  <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">{animVerifiedDoctors} Verified Doctors</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-secondary shrink-0"></div>
                  <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">{animPendingDoctors} Pending Doctors</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Platform Overview */}
          <Card className="border border-primary/30 shadow-sm rounded-2xl flex flex-col bg-card">
            <CardHeader className="pb-3 sm:pb-4">
              <CardTitle className="flex items-center gap-2 text-base sm:text-[17px] text-foreground">
                <LayoutDashboard className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
                <span className="truncate">Platform Overview</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="space-y-3.5 sm:space-y-4">
                
                <div className="flex items-center w-full">
                  <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-gray-500 mr-2 sm:mr-3 shrink-0" />
                  <span className="text-xs sm:text-sm text-muted-foreground shrink-0 truncate">Verified Doctors</span>
                  <div className="flex-grow border-b border-border mx-2 sm:mx-3 min-w-[10px]" />
                  <span className="text-sm sm:text-base font-semibold text-foreground shrink-0">{animVerifiedDoctors}</span>
                </div>

                <div className="flex items-center w-full">
                  <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-blue-500 mr-2 sm:mr-3 shrink-0" />
                  <span className="text-xs sm:text-sm text-muted-foreground shrink-0 truncate">Total Patients</span>
                  <div className="flex-grow border-b border-border mx-2 sm:mx-3 min-w-[10px]" />
                  <span className="text-sm sm:text-base font-semibold text-foreground shrink-0">{animTotalPatients}</span>
                </div>

                <div className="flex items-center w-full">
                  <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-secondary mr-2 sm:mr-3 shrink-0" />
                  <span className="text-xs sm:text-sm text-muted-foreground shrink-0 truncate">Pending Verifications</span>
                  <div className="flex-grow border-b border-border mx-2 sm:mx-3 min-w-[10px]" />
                  <span className="text-sm sm:text-base font-semibold text-foreground shrink-0">{animPendingDoctors}</span>
                </div>

                <div className="flex items-center w-full">
                  <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-amber-400 mr-2 sm:mr-3 shrink-0" />
                  <span className="text-xs sm:text-sm text-muted-foreground shrink-0 truncate">Revenue (LKR)</span>
                  <div className="flex-grow border-b border-border mx-2 sm:mx-3 min-w-[10px]" />
                  <span className="text-sm sm:text-base font-semibold text-foreground shrink-0">{animPlatformEarnings.toLocaleString()}</span>
                </div>

                <div className="flex items-center w-full">
                  <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-purple-500 mr-2 sm:mr-3 shrink-0" />
                  <span className="text-xs sm:text-sm text-muted-foreground shrink-0 truncate">Appointments</span>
                  <div className="flex-grow border-b border-border mx-2 sm:mx-3 min-w-[10px]" />
                  <span className="text-sm sm:text-base font-semibold text-foreground shrink-0">{animTotalAppointments}</span>
                </div>

              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Verification Dialog */}
      <Dialog 
        open={showVerificationDialog} 
        onOpenChange={(open) => open ? setShowVerificationDialog(true) : handleCloseDialog()}
      >
        <DialogContent className="max-w-4xl w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto bg-background rounded-xl p-4 sm:p-6 border border-border shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl text-foreground">Review Doctor Application</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
              Verify the doctor's submitted details and documents before approving.
            </DialogDescription>
          </DialogHeader>

          {selectedDoctor && (
            <div className="space-y-4 sm:space-y-6 mt-2 sm:mt-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
                <Avatar className="h-16 w-16 sm:h-20 sm:w-20 border shadow-sm">
                  <AvatarImage src={selectedDoctor.user?.profileImage} />
                  <AvatarFallback className="bg-primary/10 text-primary text-lg sm:text-xl font-bold">
                    {getInitials(selectedDoctor.user?.fullName || "")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1.5 sm:space-y-2">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <h3 className="text-xl sm:text-2xl font-bold text-foreground">{selectedDoctor.user?.fullName}</h3>
                    <StatusBadge status={selectedDoctor.status || DoctorStatus.PENDING} type="doctor" />
                    <Badge variant="outline" className="bg-muted text-muted-foreground text-[10px] sm:text-xs">
                      {selectedDoctor.registrationNumber}
                    </Badge>
                  </div>
                  <p className="text-sm sm:text-base text-muted-foreground font-medium">{selectedDoctor.qualifications}</p>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                    <span>Applied: {format(new Date(selectedDoctor.createdAt), "PPP")}</span>
                    <span className="hidden sm:inline">•</span>
                    <span>{selectedDoctor.totalAppointments} appointments</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2 pt-1">
                    {selectedDoctor.specializations?.map((spec) => (
                      <Badge key={spec.id} variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 text-[10px] sm:text-xs">
                        {spec.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
                <div className="p-4 sm:p-5 rounded-xl border border-border bg-muted/50 space-y-3 sm:space-y-4">
                  <p className="text-xs sm:text-sm font-bold text-foreground uppercase tracking-wider">Identity & Contact</p>
                  <div className="space-y-2.5 sm:space-y-3 text-xs sm:text-sm text-muted-foreground break-all sm:break-normal">
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4 opacity-70 shrink-0" />
                      <span>{selectedDoctor.user?.email}</span>
                    </div>
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4 opacity-70 shrink-0" />
                      <span>{selectedDoctor.user?.phone}</span>
                    </div>
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 opacity-70 shrink-0" />
                      <span>{selectedDoctor.user?.city || "City not provided"}</span>
                    </div>
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <Languages className="h-3.5 w-3.5 sm:h-4 sm:w-4 opacity-70 shrink-0" />
                      <div className="flex flex-wrap gap-1">
                        {(selectedDoctor.languagesSpoken || []).map((lang) => (
                          <Badge key={lang} variant="outline" className="text-[9px] sm:text-[10px] uppercase bg-background px-1 sm:px-1.5">
                            {lang.replace("_", " ")}
                          </Badge>
                        ))}
                        {(selectedDoctor.languagesSpoken || []).length === 0 && (
                          <span className="italic opacity-70">No languages provided</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-5 rounded-xl border border-border bg-muted/50 space-y-3 sm:space-y-4">
                  <p className="text-xs sm:text-sm font-bold text-foreground uppercase tracking-wider">Professional Profile</p>
                  <div className="space-y-2.5 sm:space-y-3 text-xs sm:text-sm text-muted-foreground">
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <Stethoscope className="h-3.5 w-3.5 sm:h-4 sm:w-4 opacity-70 shrink-0" />
                      <span className="capitalize">{selectedDoctor.consultationTypes?.map(t => t.replace("_", " ")).join(", ") || "Consultation types not provided"}</span>
                    </div>
                    <div className="flex items-start gap-2.5 sm:gap-3">
                      <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 mt-0.5 opacity-70 shrink-0" />
                      <span className="flex flex-col gap-0.5 sm:gap-1">
                        <span>In-person: {formatFee(selectedDoctor.consultationFee)}</span>
                        {selectedDoctor.onlineConsultationFee && <span>Online: {formatFee(selectedDoctor.onlineConsultationFee)}</span>}
                        {selectedDoctor.homeVisitFee && <span>Home visit: {formatFee(selectedDoctor.homeVisitFee)}</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 opacity-70 shrink-0" />
                      <span>Max advance booking: {selectedDoctor.maxAdvanceBookingDays} days</span>
                    </div>
                    {selectedDoctor.biography && (
                      <div className="pt-1.5 sm:pt-2">
                        <p className="text-[10px] sm:text-xs opacity-70 mb-1">Biography</p>
                        <p className="text-xs sm:text-sm leading-relaxed bg-background p-2.5 sm:p-3 rounded border border-border">
                          {selectedDoctor.biography}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-5 rounded-xl border border-border bg-muted/50 space-y-3 sm:space-y-4">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 sm:h-5 sm:w-5 opacity-70" />
                  <p className="text-xs sm:text-sm font-bold text-foreground uppercase tracking-wider">Hospital Affiliations</p>
                </div>
                {selectedDoctor.hospitals?.length ? (
                  <div className="grid gap-2 sm:gap-3 md:grid-cols-2">
                    {selectedDoctor.hospitals.map((hospital) => (
                      <div key={hospital.id} className="p-2.5 sm:p-3 rounded-lg bg-background border border-border shadow-sm">
                        <p className="font-semibold text-foreground text-sm">{hospital.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 sm:mt-1">
                          {hospital.address}, {hospital.city}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs sm:text-sm text-muted-foreground bg-background p-2.5 sm:p-3 rounded border border-dashed border-border">No hospitals provided</p>
                )}
              </div>

              <div className="p-4 sm:p-5 rounded-xl border border-border bg-muted/50 space-y-3 sm:space-y-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 opacity-70" />
                  <p className="text-xs sm:text-sm font-bold text-foreground uppercase tracking-wider">Verification Documents</p>
                </div>
                {selectedDoctor.verificationDocuments && selectedDoctor.verificationDocuments.length > 0 ? (
                  <div className="grid gap-2 sm:gap-3 sm:grid-cols-2">
                    {selectedDoctor.verificationDocuments.map((doc: string, index: number) => (
                      <a
                        key={index}
                        href={getDocumentLink(doc)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-lg bg-background border border-border shadow-sm hover:border-primary hover:shadow-md transition-all group overflow-hidden"
                      >
                        <div className="p-1.5 sm:p-2 rounded bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0">
                          <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm font-semibold text-foreground truncate">Document {index + 1}</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground truncate mt-0.5">
                            {doc.split("/").pop() || doc}
                          </p>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs sm:text-sm text-muted-foreground bg-background p-2.5 sm:p-3 rounded border border-dashed border-border">No documents uploaded</p>
                )}
              </div>

              {(selectedDoctor.bankName || selectedDoctor.bankAccountNumber || selectedDoctor.bankBranch) && (
                <div className="p-4 sm:p-5 rounded-xl border border-border bg-muted/50 space-y-3 sm:space-y-4">
                  <p className="text-xs sm:text-sm font-bold text-foreground uppercase tracking-wider">Banking Details</p>
                  <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3 bg-background p-3 sm:p-4 rounded-lg border border-border">
                    <div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground opacity-70 mb-0.5 sm:mb-1">BANK NAME</p>
                      <p className="text-sm font-semibold text-foreground truncate">{selectedDoctor.bankName || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground opacity-70 mb-0.5 sm:mb-1">ACCOUNT NO</p>
                      <p className="text-sm font-semibold text-foreground truncate">{selectedDoctor.bankAccountNumber || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground opacity-70 mb-0.5 sm:mb-1">BRANCH</p>
                      <p className="text-sm font-semibold text-foreground truncate">{selectedDoctor.bankBranch || "N/A"}</p>
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-border mt-4 sm:mt-6 w-full">
                <Button variant="outline" onClick={handleCloseDialog} className="rounded-full px-6 w-full sm:w-auto order-1 sm:order-none">
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowRejectDialog(true)}
                  disabled={rejectMutation.isPending}
                  className="rounded-full px-6 sm:px-8 w-full sm:w-auto"
                >
                  Reject
                </Button>
                <Button
                  onClick={() => selectedDoctor && verifyMutation.mutate(selectedDoctor.id)}
                  disabled={verifyMutation.isPending}
                  className="rounded-full px-6 sm:px-8 bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {verifyMutation.isPending ? "Verifying..." : "Approve & Verify Doctor"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Reason Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="max-w-md bg-background rounded-xl">
          <DialogHeader>
            <DialogTitle>Reject Doctor Application</DialogTitle>
            <DialogDescription>Please provide a reason for rejecting this application.</DialogDescription>
          </DialogHeader>
          <textarea
            className="w-full border border-border rounded-lg p-3 text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            rows={4}
            placeholder="Enter rejection reason..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowRejectDialog(false)} className="rounded-full">
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || rejectMutation.isPending}
              onClick={() => selectedDoctor && rejectMutation.mutate({ doctorId: selectedDoctor.id, reason: rejectReason })}
              className="rounded-full"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Confirm Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}