import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Search, 
  Filter, 
  MoreVertical, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Clock,
  Eye,
  Ban,
  Star,
  Stethoscope,
  MapPin,
  Phone,
  Mail,
  Calendar,
  FileText,
  Building2,
  GraduationCap,
  Loader2,
  Activity,
  Wallet,
  User,
  Download,
  Map,
  CalendarOff,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { LoadingPage } from "@/components/ui/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { StatusBadge } from "@/components/ui/status-badge";
import type { DoctorWithDetails } from "@shared/schema";
import { DoctorStatus } from "@shared/schema";
import { useUrlPagination } from "@/hooks/use-url-pagination";
import { Pagination } from "@/components/ui/pagination";
import { Modal } from "@/components/ui/modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const getDocumentUrl = (docUrl: string) => {
  // If it's already a Cloudinary URL, use it directly
  if (docUrl && docUrl.includes('cloudinary.com')) {
    return docUrl;
  }
  // Otherwise, use the API endpoint for legacy local files
  if (!docUrl) return "#";
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  return token ? `/api/documents/${docUrl}?token=${token}` : `/api/documents/${docUrl}`;
};

const DoctorCardSkeleton = () => (
  <Card className="bg-card border-border shadow-sm mb-4">
    <CardContent className="p-4">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="h-16 w-16 rounded-full bg-muted animate-pulse shrink-0 border border-border" />
        <div className="flex-1 min-w-0 py-1 space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-5 w-1/3 bg-muted rounded animate-pulse" />
            <div className="h-5 w-20 bg-muted rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="h-4 w-full bg-muted rounded animate-pulse" />
            <div className="h-4 w-full bg-muted rounded animate-pulse" />
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
);

export default function AdminDoctorsPage() {
  const { toast } = useToast();
  
  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // Client-side Pagination States
  const [currentPage, setCurrentPage] = useUrlPagination(1);

  const [selectedDoctor, setSelectedDoctor] = useState<DoctorWithDetails | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: response, isLoading, isError, isFetching } = useQuery({
    queryKey: ["/api/admin/doctors/paginated", currentPage, statusFilter, debouncedSearch],
    queryFn: async () => {
      const url = `/api/admin/doctors/paginated?page=${currentPage}&limit=10&status=${statusFilter}&search=${encodeURIComponent(debouncedSearch)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    }
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/doctors/paginated"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/doctors/paginated"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/doctors/paginated"] });
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

  // if (isLoading) {
  //   return <LoadingPage message="Loading doctors..." />;
  // }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">Failed to load doctors. Please try again.</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  const doctors = response?.data || [];
  const totalPages = response?.totalPages || 1;
  const statusCounts = response?.stats || { all: 0, pending: 0, verified: 0, rejected: 0, suspended: 0 };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold">Doctors Management</h1>
          <p className="text-muted-foreground">Manage and verify doctor registrations</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card 
          className={`cursor-pointer hover-elevate ${statusFilter === "all" ? "ring-2 ring-primary" : ""}`}
          onClick={() => setStatusFilter("all")}
          data-testid="filter-all"
        >
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{statusCounts.all}</p>
            <p className="text-xs text-muted-foreground">All Doctors</p>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer hover-elevate ${statusFilter === "pending" ? "ring-2 ring-primary" : ""}`}
          onClick={() => setStatusFilter("pending")}
          data-testid="filter-pending"
        >
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-amber-600">{statusCounts.pending}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer hover-elevate ${statusFilter === "verified" ? "ring-2 ring-primary" : ""}`}
          onClick={() => setStatusFilter("verified")}
          data-testid="filter-verified"
        >
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{statusCounts.verified}</p>
            <p className="text-xs text-muted-foreground">Verified</p>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer hover-elevate ${statusFilter === "rejected" ? "ring-2 ring-primary" : ""}`}
          onClick={() => setStatusFilter("rejected")}
          data-testid="filter-rejected"
        >
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-red-600">{statusCounts.rejected}</p>
            <p className="text-xs text-muted-foreground">Rejected</p>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer hover-elevate ${statusFilter === "suspended" ? "ring-2 ring-primary" : ""}`}
          onClick={() => setStatusFilter("suspended")}
          data-testid="filter-suspended"
        >
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-gray-600">{statusCounts.suspended}</p>
            <p className="text-xs text-muted-foreground">Suspended</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or registration number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search"
          />
        </div>
      </div>

      {/* 🚀 Table View for Doctors List */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {isLoading || isFetching ? (
          <div className="w-full overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50 border-b-border/50">
                  <TableHead className="w-[50px]">#</TableHead>
                  <TableHead className="w-[250px]">Doctor</TableHead>
                  <TableHead>Contact Info</TableHead>
                  <TableHead className="w-[150px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                  <TableRow key={i} className="border-b-border/40 hover:bg-transparent">
                    <TableCell>
                      <div className="h-4 w-4 bg-muted rounded animate-pulse" />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-muted animate-pulse shrink-0" />
                        <div className="space-y-2 flex-1">
                          <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                          <div className="h-3 w-20 bg-muted/70 rounded animate-pulse" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <div className="h-3 w-40 bg-muted rounded animate-pulse" />
                        <div className="h-3 w-28 bg-muted/70 rounded animate-pulse" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="h-6 w-24 bg-muted rounded-full animate-pulse" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : doctors.length > 0 ? (
          <div className="w-full overflow-auto custom-scrollbar">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30 border-b-border/50">
                  <TableHead className="w-[50px] font-bold text-muted-foreground sticky left-0 bg-popover z-20 border-r border-border">#</TableHead>
                  <TableHead className="min-w-[220px] font-bold text-muted-foreground">Doctor</TableHead>
                  <TableHead className="min-w-[200px] font-bold text-muted-foreground">Contact Info</TableHead>
                  <TableHead className="w-[140px] font-bold text-muted-foreground">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {doctors.map((doctor: DoctorWithDetails, index: number) => (
                  <TableRow 
                    key={doctor.id} 
                    className="cursor-pointer hover:bg-primary/5 transition-colors border-b-border/40 group"
                    onClick={() => {
                      setSelectedDoctor(doctor);
                      setShowDetailsModal(true);
                    }}
                    data-testid={`row-doctor-${doctor.id}`}
                  >
                    <TableCell className="text-muted-foreground font-medium text-xs sticky left-0 z-10 border-r border-border bg-popover">
                      {(currentPage - 1) * 10 + index + 1}
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border-2 border-background shadow-sm shrink-0 group-hover:border-primary/20 transition-all">
                          <AvatarImage src={doctor.user?.profileImage} className="object-cover" />
                          <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                            {getInitials(doctor.user?.fullName || "")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-foreground text-sm truncate group-hover:text-primary transition-colors">
                            {doctor.user?.fullName}
                          </span>
                          <span className="text-[11px] text-muted-foreground truncate font-medium flex items-center gap-1 mt-0.5">
                            <FileText className="w-3 h-3" /> {doctor.registrationNumber}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="text-xs text-foreground flex items-center gap-1.5 truncate">
                          <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> {doctor.user?.email}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                          <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> {doctor.user?.phone}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center justify-between">
                        <StatusBadge status={doctor.status} type="doctor" />
                        <Eye className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <Stethoscope className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="font-semibold text-lg text-foreground mb-1">No doctors found</h3>
            <p className="text-muted-foreground text-sm">
              {searchQuery ? "Try adjusting your search or filters" : "No doctors registered yet"}
            </p>
          </div>
        )}

        {totalPages > 1 && (
          <div className="pt-2 pb-2">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
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