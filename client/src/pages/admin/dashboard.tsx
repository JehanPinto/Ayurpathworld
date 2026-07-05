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
  LayoutDashboard,
  GraduationCap,
  Loader2,
  Wallet,
  User,
  Download,
  Map,
  CalendarOff,
  ExternalLink,
  XCircle,
  Ban,
  Star,
  Eye,
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
import { Modal } from "@/components/ui/modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { DoctorStatus } from "@shared/schema";
import { Textarea } from "@/components/ui/textarea";

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
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const { data: dashboardData, isLoading, isError } = useQuery<DashboardData>({
    queryKey: ["/api/admin/dashboard"],
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const { data: analyticsData, isLoading: analyticsLoading } = useQuery({
      queryKey: ["/api/admin/doctors/analytics", selectedDoctor?.id],
      queryFn: async () => {
        const res = await fetch(`/api/admin/doctors/${selectedDoctor?.id}/analytics`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        if (!res.ok) throw new Error("Failed to fetch analytics");
        return res.json();
      },
      enabled: !!selectedDoctor && showDetailsModal, // Only runs when modal is open
    });

  const verifyMutation = useMutation({
      mutationFn: (doctorId: string) => 
        apiRequest("PATCH", `/api/admin/doctors/${doctorId}/verify`),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard"] });
        toast({
          title: "Doctor Verified",
          description: "The doctor has been verified successfully.",
        });
        setShowDetailsModal(false);
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to verify doctor. Please try again.",
          variant: "destructive",
        });
      },
    });

  const rejectMutation = useMutation({
      mutationFn: ({ doctorId, reason }: { doctorId: string; reason: string }) => 
        apiRequest("PATCH", `/api/admin/doctors/${doctorId}/reject`, { reason }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard"] });
        toast({
          title: "Doctor Rejected",
          description: "The doctor application has been rejected.",
        });
        setShowRejectDialog(false);
        setShowDetailsModal(false);
        setRejectReason("");
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to reject doctor. Please try again.",
          variant: "destructive",
        });
      },
    });

  const suspendMutation = useMutation({
      mutationFn: (doctorId: string) => 
        apiRequest("PATCH", `/api/admin/doctors/${doctorId}/suspend`),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard"] });
        toast({
          title: "Doctor Suspended",
          description: "The doctor account has been suspended.",
        });
        setShowDetailsModal(false);
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to suspend doctor. Please try again.",
          variant: "destructive",
        });
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
    setShowDetailsModal(true);
  };

  const handleCloseDialog = () => {
    setShowDetailsModal(false);
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

      <Modal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        title="Doctor Profile Details"
        description="Review credentials, analytics, and manage doctor status."
        icon={<Stethoscope className="w-5 h-5 text-primary" />}
        className="max-w-5xl w-[95vw] flex flex-col" // Fixed height for proper scrolling
        footer={
          selectedDoctor ? (
            <div className="flex w-full flex-col sm:flex-row justify-between items-center gap-4">
              <div className="w-full sm:w-auto flex justify-center sm:justify-start shrink-0">
                <StatusBadge status={selectedDoctor.status} type="doctor" />
              </div>
              <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 w-full sm:w-auto">
                <Button variant="outline" className="w-full sm:w-auto rounded-full" onClick={() => setShowDetailsModal(false)}>Close</Button>
                
                {selectedDoctor.status === DoctorStatus.PENDING && (
                  <>
                    <Button variant="destructive" className="w-full sm:w-auto rounded-full bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border-red-200" onClick={() => setShowRejectDialog(true)}>
                      <XCircle className="w-4 h-4 mr-2" /> Reject
                    </Button>
                    <Button onClick={() => verifyMutation.mutate(selectedDoctor.id)} disabled={verifyMutation.isPending} className="w-full sm:w-auto rounded-full bg-green-600 hover:bg-green-700 text-white">
                      {verifyMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <CheckCircle className="w-4 h-4 mr-2" />}
                      Approve & Verify
                    </Button>
                  </>
                )}
                
                {selectedDoctor.status === DoctorStatus.VERIFIED && (
                  <Button variant="outline" className="w-full sm:w-auto rounded-full text-amber-600 border-amber-200 hover:bg-amber-50" onClick={() => suspendMutation.mutate(selectedDoctor.id)} disabled={suspendMutation.isPending}>
                    {suspendMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Ban className="w-4 h-4 mr-2" />} Suspend Account
                  </Button>
                )}
                
                {(selectedDoctor.status === DoctorStatus.SUSPENDED || selectedDoctor.status === DoctorStatus.REJECTED) && (
                  <Button onClick={() => verifyMutation.mutate(selectedDoctor.id)} disabled={verifyMutation.isPending} className="w-full sm:w-auto rounded-full bg-green-600 hover:bg-green-700 text-white">
                    <CheckCircle className="w-4 h-4 mr-2" /> Reactivate & Verify
                  </Button>
                )}
              </div>
            </div>
          ) : null
        }
      >
        {selectedDoctor && (
          // Fixed structure: flex-col with min-h-0 allows the inner div to scroll properly
          <Tabs defaultValue="overview" className="w-full h-full flex flex-col min-h-0">
            <TabsList className="grid grid-cols-2 md:grid-cols-5 bg-muted/50 p-1 mb-2 h-auto md:h-12 rounded-xl shrink-0">
              <TabsTrigger value="overview" className="py-2 rounded-lg">Overview</TabsTrigger>
              <TabsTrigger value="professional" className="py-2 rounded-lg">Professional</TabsTrigger>
              <TabsTrigger value="locations" className="py-2 rounded-lg">Locations</TabsTrigger>
              <TabsTrigger value="documents" className="py-2 rounded-lg relative">
                  Documents
                  {selectedDoctor.status === DoctorStatus.PENDING && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  )}
              </TabsTrigger>
              <TabsTrigger value="analytics" className="py-2 rounded-lg relative">
                Analytics
                {!analyticsData && !analyticsLoading && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary animate-pulse" />}
              </TabsTrigger>
            </TabsList>

            {/* Scrollable Container for Tab Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-1 pr-3 pb-6">
              
              {/* 1. OVERVIEW TAB */}
              <TabsContent value="overview" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 mt-2">
                <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start text-center sm:text-left">
                  <Avatar className="w-24 h-24 sm:w-28 sm:h-28 border-4 border-background shadow-xl ring-2 ring-primary/20 shrink-0">
                    <AvatarImage src={selectedDoctor.user?.profileImage} />
                    <AvatarFallback className="bg-primary/10 text-primary text-3xl font-bold">{getInitials(selectedDoctor.user?.fullName)}</AvatarFallback>
                  </Avatar>
                  <div className="space-y-3 flex-1 w-full min-w-0">
                    <div>
                      <h2 className="text-2xl sm:text-3xl font-bold text-foreground truncate">{selectedDoctor.user?.fullName}</h2>
                      <p className="text-muted-foreground font-medium text-sm sm:text-base leading-snug mt-1">{selectedDoctor.qualifications}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 bg-muted/30 p-4 rounded-xl border border-border">
                      <div className="flex items-center justify-center sm:justify-start gap-2 text-sm"><Mail className="w-4 h-4 text-primary shrink-0"/> <span className="truncate">{selectedDoctor.user?.email}</span></div>
                      <div className="flex items-center justify-center sm:justify-start gap-2 text-sm"><Phone className="w-4 h-4 text-primary shrink-0"/> {selectedDoctor.user?.phone}</div>
                      <div className="flex items-center justify-center sm:justify-start gap-2 text-sm"><FileText className="w-4 h-4 text-primary shrink-0"/> SLAMC: {selectedDoctor.registrationNumber}</div>
                      <div className="flex items-center justify-center sm:justify-start gap-2 text-sm"><MapPin className="w-4 h-4 text-primary shrink-0"/> <span className="truncate">{selectedDoctor.user?.city || 'City not provided'}</span></div>
                    </div>
                  </div>
                </div>

                <div className="bg-primary/5 border border-primary/10 rounded-2xl p-5 sm:p-6">
                  <h4 className="font-bold text-primary mb-3 flex items-center gap-2"><User className="w-4 h-4"/> Professional Biography</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">{selectedDoctor.biography || "No biography provided by the doctor."}</p>
                </div>
                
                {selectedDoctor.status === DoctorStatus.REJECTED && selectedDoctor.rejectionReason && (
                  <div className="p-4 sm:p-5 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-800">
                    <p className="text-sm font-bold text-red-800 dark:text-red-200 mb-2 flex items-center gap-2"><Ban className="w-4 h-4"/> Rejection Reason</p>
                    <p className="text-sm text-red-700 dark:text-red-300 leading-relaxed">{selectedDoctor.rejectionReason}</p>
                  </div>
                )}
              </TabsContent>

              {/* 2. PROFESSIONAL TAB */}
              <TabsContent value="professional" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 mt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <Card className="shadow-sm border-border bg-card/50 rounded-2xl">
                    <CardContent className="p-5 sm:p-6">
                      <h4 className="font-bold mb-4 flex items-center gap-2 text-foreground"><Star className="w-5 h-5 text-amber-500"/> Specializations</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedDoctor.specializations?.map(s => (
                          <Badge key={s.id} variant="secondary" className="bg-secondary/10 text-secondary border-secondary/20 hover:bg-secondary/20 px-3 py-1 text-xs">{s.name}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm border-border bg-card/50 rounded-2xl">
                    <CardContent className="p-5 sm:p-6">
                      <h4 className="font-bold mb-4 flex items-center gap-2 text-foreground"><Activity className="w-5 h-5 text-blue-500"/> Languages Spoken</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedDoctor.languagesSpoken?.map(l => (
                          <Badge key={l} variant="outline" className="capitalize border-border/50 px-3 py-1 text-xs">{l}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm border-border md:col-span-2 bg-card/50 rounded-2xl">
                    <CardContent className="p-5 sm:p-6">
                      <h4 className="font-bold mb-5 flex items-center gap-2 text-foreground"><Wallet className="w-5 h-5 text-emerald-500"/> Consultation Fees</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="p-5 rounded-xl border border-border bg-background text-center flex flex-col justify-center shadow-sm">
                          <p className="text-[11px] text-muted-foreground mb-1.5 uppercase font-bold tracking-widest">In-Person</p>
                          <p className="text-2xl font-black text-primary">{selectedDoctor.consultationTypes?.includes('in_person') ? formatFee(selectedDoctor.consultationFee) : 'N/A'}</p>
                        </div>
                        <div className="p-5 rounded-xl border border-border bg-background text-center flex flex-col justify-center shadow-sm">
                          <p className="text-[11px] text-muted-foreground mb-1.5 uppercase font-bold tracking-widest">Online</p>
                          <p className="text-2xl font-black text-primary">{selectedDoctor.consultationTypes?.includes('online') ? formatFee(selectedDoctor.onlineConsultationFee || 0) : 'N/A'}</p>
                        </div>
                        <div className="p-5 rounded-xl border border-border bg-background text-center flex flex-col justify-center shadow-sm">
                          <p className="text-[11px] text-muted-foreground mb-1.5 uppercase font-bold tracking-widest">Home Visit</p>
                          <p className="text-2xl font-black text-primary">{selectedDoctor.consultationTypes?.includes('home_visit') ? formatFee(selectedDoctor.homeVisitFee || 0) : 'N/A'}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* 3. LOCATIONS TAB */}
              {/* <TabsContent value="locations" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 mt-2">
                <h4 className="font-bold mb-4 flex items-center gap-2 text-foreground px-1"><Map className="w-5 h-5 text-primary"/> Physical Consultation Locations</h4>
                {selectedDoctor.hospitals?.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {selectedDoctor.hospitals.map(h => (
                      <div key={h.id} className="p-5 rounded-2xl border border-border bg-card/50 shadow-sm flex flex-col gap-3 transition-all hover:shadow-md hover:border-primary/30">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                              <Building2 className="w-6 h-6 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-foreground text-base truncate">{h.name}</p>
                              <p className="text-xs text-muted-foreground flex items-start gap-1.5 mt-1.5 leading-snug"><MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary/70"/> {h.address}, {h.city}</p>
                            </div>
                        </div>
                        {h.contactNumber && (
                          <div className="mt-2 pt-3 border-t border-border/50">
                            <p className="text-xs font-semibold text-foreground flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-muted-foreground"/> {h.contactNumber}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center bg-muted/20 rounded-2xl border border-dashed border-border">
                    <MapPin className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
                    <p className="text-muted-foreground font-medium">No physical locations registered.</p>
                  </div>
                )}
              </TabsContent> */}

              {/* 3. LOCATIONS TAB */}
              <TabsContent value="locations" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 mt-2">
                <h4 className="font-bold mb-4 flex items-center gap-2 text-foreground px-1">
                  <Map className="w-5 h-5 text-primary"/> Physical Consultation Locations
                </h4>
                
                {selectedDoctor.hospitals?.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {selectedDoctor.hospitals.map(h => {
                      const mapUrl = h.latitude && h.longitude 
                        ? `https://www.google.com/maps/search/?api=1&query=${h.latitude},${h.longitude}`
                        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${h.name}, ${h.address}, ${h.city}`)}`;

                      return (
                        <div key={h.id} className="p-5 rounded-2xl border border-border bg-card/50 shadow-sm flex flex-col gap-3 transition-all hover:shadow-md hover:border-primary/30 relative group">
                          <div className="flex items-start gap-4 pr-8">
                              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                <Building2 className="w-6 h-6 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-foreground text-base truncate pr-2">{h.name}</p>
                                <p className="text-xs text-muted-foreground flex items-start gap-1.5 mt-1.5 leading-snug">
                                  <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary/70"/> 
                                  {h.address}, {h.city}
                                </p>
                              </div>
                          </div>

                          {/* 🌍 View on Map Button */}
                          <a 
                            href={mapUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors tooltip-trigger"
                            title="Open in Google Maps"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>

                          {h.contactNumber && (
                            <div className="mt-2 pt-3 border-t border-border/50">
                              <p className="text-xs font-semibold text-foreground flex items-center gap-2">
                                <Phone className="w-3.5 h-3.5 text-muted-foreground"/> {h.contactNumber}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-12 text-center bg-muted/20 rounded-2xl border border-dashed border-border">
                    <MapPin className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
                    <p className="text-muted-foreground font-medium">No physical locations registered.</p>
                  </div>
                )}
              </TabsContent>

              {/* 4. DOCUMENTS & BANK TAB */}
              <TabsContent value="documents" className="space-y-8 animate-in fade-in slide-in-from-bottom-2 mt-2">
                
                {/* Documents Section */}
                <div>
                  <h4 className="font-bold mb-4 flex items-center gap-2 text-foreground px-1"><FileText className="w-5 h-5 text-primary"/> Verification Documents</h4>
                  {selectedDoctor.verificationDocuments && selectedDoctor.verificationDocuments.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {selectedDoctor.verificationDocuments.map((doc: string, index: number) => {
                        const url = getDocumentUrl(doc);
                        let categoryName = "Other Document";
                        let Icon = FileText;
                        
                        if (index === 0) {
                          categoryName = "Medical Council Certificate";
                          Icon = Building2;
                        } else if (index === 1) {
                          categoryName = "Degree Certificate";
                          Icon = GraduationCap;
                        }

                        const isImage = url.toLowerCase().match(/\.(jpeg|jpg|gif|png|webp)$/) != null;

                        return (
                          <a 
                            key={index}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-4 p-4 bg-card border border-border rounded-2xl hover:border-primary/50 hover:bg-primary/5 hover:shadow-md transition-all group shadow-sm"
                          >
                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                <Icon className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-sm font-bold text-foreground truncate">{categoryName}</span>
                                <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1 font-medium">
                                  <Eye className="w-3.5 h-3.5" /> Click to view {isImage ? 'image' : 'document'} securely
                                </span>
                            </div>
                            <Download className="w-5 h-5 text-muted-foreground group-hover:text-primary shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" />
                          </a>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-10 text-center bg-muted/20 rounded-2xl border border-dashed border-border">
                      <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                      <p className="text-muted-foreground font-medium">No verification documents uploaded.</p>
                    </div>
                  )}
                </div>

                {/* Bank Details Section */}
                <div className="pt-6 border-t border-border">
                  <h4 className="font-bold mb-5 flex items-center gap-2 text-foreground px-1"><Building2 className="w-5 h-5 text-primary"/> Bank & Payout Details</h4>
                  {selectedDoctor.bankName ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="p-5 bg-card/50 rounded-2xl border border-border shadow-sm">
                        <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-widest font-bold">Bank Name</p>
                        <p className="font-bold text-sm truncate">{selectedDoctor.bankName}</p>
                      </div>
                      <div className="p-5 bg-card/50 rounded-2xl border border-border shadow-sm">
                        <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-widest font-bold">Branch</p>
                        <p className="font-bold text-sm truncate">{selectedDoctor.bankBranch}</p>
                      </div>
                      <div className="p-5 bg-card/50 rounded-2xl border border-border shadow-sm">
                        <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-widest font-bold">Account Number</p>
                        <p className="font-mono font-bold text-primary tracking-widest truncate">{selectedDoctor.bankAccountNumber}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 text-center bg-amber-50 dark:bg-amber-500/10 rounded-2xl border border-amber-200 dark:border-amber-500/20">
                      <p className="text-sm text-amber-800 dark:text-amber-400 font-semibold">Bank details not provided. Doctor will only accept cash payments at physical locations.</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* 5. ANALYTICS TAB (LAZY LOADED) */}
              <TabsContent value="analytics" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 mt-2">
                {analyticsLoading ? (
                  <div className="py-24 flex flex-col items-center justify-center">
                    <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                    <p className="text-muted-foreground font-medium">Compiling doctor analytics...</p>
                  </div>
                ) : analyticsData ? (
                  <>
                    {/* Top Stats Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="p-6 rounded-2xl border border-border bg-gradient-to-br from-card to-primary/5 shadow-sm relative overflow-hidden group">
                          <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-primary/10 group-hover:scale-150 transition-transform duration-500" />
                          <p className="text-[10px] text-muted-foreground uppercase font-bold mb-2 tracking-widest relative z-10">Total Revenue</p>
                          <p className="text-3xl font-black text-foreground relative z-10">{formatFee(analyticsData.totals.revenue)}</p>
                      </div>
                      <div className="p-6 rounded-2xl border border-border bg-card shadow-sm">
                          <p className="text-[10px] text-muted-foreground uppercase font-bold mb-2 tracking-widest">Total Appointments</p>
                          <p className="text-3xl font-black text-foreground">{analyticsData.totals.appointments}</p>
                      </div>
                      <div className="p-6 rounded-2xl border border-border bg-card shadow-sm">
                          <p className="text-[10px] text-muted-foreground uppercase font-bold mb-2 tracking-widest">Cancellation Rate</p>
                          <p className="text-3xl font-black text-destructive">
                            {analyticsData.totals.appointments > 0 
                              ? Math.round((analyticsData.totals.cancelled / analyticsData.totals.appointments) * 100) 
                              : 0}%
                          </p>
                      </div>
                    </div>

                    {/* Charts Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                        
                        {/* Pie Chart: Appointment Status */}
                        <Card className="shadow-sm border-border bg-card/50 rounded-2xl">
                          <CardContent className="p-6">
                            <h4 className="font-bold text-sm mb-6 text-foreground flex items-center gap-2"><CalendarOff className="w-4 h-4 text-primary"/> Appointment Status</h4>
                            <div className="h-[250px] w-full min-h-[250px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie data={analyticsData.appointmentStats} cx="50%" cy="50%" innerRadius={70} outerRadius={90} paddingAngle={5} dataKey="value">
                                    {analyticsData.appointmentStats.map((entry: any, index: number) => (
                                      <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                  </Pie>
                                  <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} itemStyle={{ fontWeight: 'bold' }} />
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                            <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mt-4">
                              {analyticsData.appointmentStats.map((entry: any, i: number) => (
                                <div key={i} className="flex items-center gap-2 text-xs font-semibold">
                                  <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: entry.color }} />
                                  <span className="text-muted-foreground">{entry.name}</span>
                                  <span className="text-foreground">({entry.value})</span>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Bar Chart: Revenue Over Time */}
                        <Card className="shadow-sm border-border bg-card/50 rounded-2xl">
                          <CardContent className="p-6 flex flex-col h-full">
                            <h4 className="font-bold text-sm mb-6 text-foreground flex items-center gap-2"><Activity className="w-4 h-4 text-primary"/> Revenue (Last 6 Months)</h4>
                            <div className="flex-1 w-full min-h-[250px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={analyticsData.revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                  <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} tick={{fill: 'hsl(var(--muted-foreground))'}} dy={10} />
                                  <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `Rs.${val/1000}k`} tick={{fill: 'hsl(var(--muted-foreground))'}} />
                                  <RechartsTooltip cursor={{ fill: 'hsl(var(--muted)/0.5)' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} formatter={(val: number) => [formatFee(val), 'Revenue']} labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }} />
                                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={36} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </CardContent>
                        </Card>

                    </div>
                  </>
                ) : (
                  <div className="p-12 text-center bg-muted/20 rounded-2xl border border-dashed text-muted-foreground flex flex-col items-center justify-center">
                    <AlertCircle className="w-10 h-10 mb-3 opacity-50" />
                    <p className="font-medium">Could not load analytics.</p>
                  </div>
                )}
              </TabsContent>

            </div>
          </Tabs>
        )}
      </Modal>

      <Modal
        isOpen={showRejectDialog}
        onClose={() => setShowRejectDialog(false)}
        title="Reject Application"
        description="Provide a clear reason for rejecting this doctor's application. This will be sent to the doctor."
        icon={<Ban className="w-5 h-5 text-destructive" />}
        footer={
          <div className="flex gap-2 w-full justify-end">
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
            <Button 
              variant="destructive"
              onClick={() => { if (selectedDoctor) rejectMutation.mutate({ doctorId: selectedDoctor.id, reason: rejectReason }); }}
              disabled={rejectMutation.isPending || !rejectReason.trim()}
            >
              {rejectMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : null}
              Confirm Rejection
            </Button>
          </div>
        }
      >
        <div className="py-4">
          <Textarea placeholder="e.g. Invalid SLAMC Registration number..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={4} className="resize-none" />
        </div>
      </Modal>
    </div>
  );
}