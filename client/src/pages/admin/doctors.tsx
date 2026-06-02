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
  FileText
} from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const itemsPerPage = 10;
  const [currentPage, setCurrentPage] = useUrlPagination(1);

  const [selectedDoctor, setSelectedDoctor] = useState<DoctorWithDetails | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Reset to page 1 on new search
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

  const verifyMutation = useMutation({
    mutationFn: (doctorId: string) => 
      apiRequest("PATCH", `/api/admin/doctors/${doctorId}/verify`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/doctors"] });
      toast({
        title: "Doctor Verified",
        description: "The doctor has been verified successfully.",
      });
      setShowDetailsDialog(false);
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/doctors"] });
      toast({
        title: "Doctor Rejected",
        description: "The doctor application has been rejected.",
      });
      setShowRejectDialog(false);
      setShowDetailsDialog(false);
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/doctors"] });
      toast({
        title: "Doctor Suspended",
        description: "The doctor account has been suspended.",
      });
      setShowDetailsDialog(false);
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

  if (isLoading) {
    return <LoadingPage message="Loading doctors..." />;
  }

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

      <div className="space-y-4">
        {isLoading || isFetching ? (
          <>
            <DoctorCardSkeleton />
            <DoctorCardSkeleton />
            <DoctorCardSkeleton />
            <DoctorCardSkeleton />
            <DoctorCardSkeleton />
          </>
        ) : doctors.length > 0 ? (
          doctors.map((doctor: any) => (
            <Card 
              key={doctor.id} 
              className="hover-elevate"
              data-testid={`card-doctor-${doctor.id}`}
            >
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <Avatar className="h-16 w-16 shrink-0">
                    <AvatarImage src={doctor.user?.profileImage} />
                    <AvatarFallback className="bg-primary/10 text-primary text-lg">
                      {getInitials(doctor.user?.fullName || "")}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{doctor.user?.fullName}</h3>
                        <StatusBadge status={doctor.status} type="doctor" />
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                        <span className="font-medium">{doctor.averageRating?.toFixed(1)}</span>
                        <span className="text-muted-foreground text-sm">({doctor.totalReviews} reviews)</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm mb-3">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <FileText className="h-3.5 w-3.5" />
                        <span className="truncate">{doctor.registrationNumber}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        <span className="truncate">{doctor.user?.email}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        <span>{doctor.user?.phone}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{doctor.user?.city || "N/A"}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {doctor.specializations?.map((spec: any) => (
                        <Badge key={spec.id} variant="secondary" className="text-xs">
                          {spec.name}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{formatFee(doctor.consultationFee)}/visit</span>
                      <span>|</span>
                      <span>{doctor.totalAppointments} appointments</span>
                    </div>
                  </div>

                  <div className="flex flex-row md:flex-col gap-2 shrink-0">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setSelectedDoctor(doctor);
                        setShowDetailsDialog(true);
                      }}
                      data-testid={`button-view-${doctor.id}`}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-actions-${doctor.id}`}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {doctor.status === DoctorStatus.PENDING && (
                          <>
                            <DropdownMenuItem 
                              onClick={() => verifyMutation.mutate(doctor.id)}
                              className="text-green-600"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Verify
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => {
                                setSelectedDoctor(doctor);
                                setShowRejectDialog(true);
                              }}
                              className="text-red-600"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject
                            </DropdownMenuItem>
                          </>
                        )}
                        {doctor.status === DoctorStatus.VERIFIED && (
                          <DropdownMenuItem 
                            onClick={() => suspendMutation.mutate(doctor.id)}
                            className="text-amber-600"
                          >
                            <Ban className="h-4 w-4 mr-2" />
                            Suspend
                          </DropdownMenuItem>
                        )}
                        {doctor.status === DoctorStatus.SUSPENDED && (
                          <DropdownMenuItem 
                            onClick={() => verifyMutation.mutate(doctor.id)}
                            className="text-green-600"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Reactivate
                          </DropdownMenuItem>
                        )}
                        {doctor.status === DoctorStatus.REJECTED && (
                          <DropdownMenuItem 
                            onClick={() => verifyMutation.mutate(doctor.id)}
                            className="text-green-600"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Verify
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Stethoscope className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-1">No doctors found</h3>
              <p className="text-muted-foreground text-sm">
                {searchQuery ? "Try adjusting your search or filters" : "No doctors registered yet"}
              </p>
            </CardContent>
          </Card>
        )}

        {totalPages > 1 && (
          <div className="pt-6 pb-2">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}

      </div>

      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Doctor Details</DialogTitle>
            <DialogDescription>
              Complete information about the doctor
            </DialogDescription>
          </DialogHeader>
          
          {selectedDoctor && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={selectedDoctor.user?.profileImage} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xl">
                    {getInitials(selectedDoctor.user?.fullName || "")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-semibold">{selectedDoctor.user?.fullName}</h3>
                  <p className="text-muted-foreground">{selectedDoctor.qualifications}</p>
                  <StatusBadge status={selectedDoctor.status} type="doctor" className="mt-1" />
                </div>
              </div>

              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Registration Number</p>
                    <p className="font-medium">{selectedDoctor.registrationNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{selectedDoctor.user?.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{selectedDoctor.user?.phone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">City</p>
                    <p className="font-medium">{selectedDoctor.user?.city || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Consultation Fee</p>
                    <p className="font-medium">{formatFee(selectedDoctor.consultationFee)}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-2">Specializations</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedDoctor.specializations?.map((spec) => (
                      <Badge key={spec.id} variant="secondary">{spec.name}</Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-2">Hospitals</p>
                  <div className="space-y-2">
                    {selectedDoctor.hospitals?.map((hospital) => (
                      <div key={hospital.id} className="p-2 bg-muted rounded-md">
                        <p className="font-medium">{hospital.name}</p>
                        <p className="text-sm text-muted-foreground">{hospital.address}, {hospital.city}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedDoctor.biography && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Biography</p>
                    <p className="text-sm">{selectedDoctor.biography}</p>
                  </div>
                )}

                {selectedDoctor.verificationDocuments && selectedDoctor.verificationDocuments.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Verification Documents</p>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedDoctor.verificationDocuments.map((doc: string, index: number) => {
                        const url = getDocumentUrl(doc);
                        return (
                          <a 
                            key={index}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-2 bg-muted rounded-md hover-elevate"
                            data-testid={`link-document-${index}`}
                          >
                            <FileText className="h-4 w-4 text-primary" />
                            <span className="text-sm">Document {index + 1}</span>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectedDoctor.status === DoctorStatus.REJECTED && selectedDoctor.rejectionReason && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">Rejection Reason</p>
                    <p className="text-sm text-red-700 dark:text-red-300">{selectedDoctor.rejectionReason}</p>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{selectedDoctor.totalAppointments}</p>
                    <p className="text-xs text-muted-foreground">Total Appointments</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{selectedDoctor.averageRating?.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">Average Rating</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{selectedDoctor.totalReviews}</p>
                    <p className="text-xs text-muted-foreground">Total Reviews</p>
                  </div>
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                {selectedDoctor.status === DoctorStatus.PENDING && (
                  <>
                    <Button 
                      variant="outline" 
                      className="text-red-600"
                      onClick={() => setShowRejectDialog(true)}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                    <Button 
                      onClick={() => verifyMutation.mutate(selectedDoctor.id)}
                      disabled={verifyMutation.isPending}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Verify Doctor
                    </Button>
                  </>
                )}
                {selectedDoctor.status === DoctorStatus.VERIFIED && (
                  <Button 
                    variant="outline"
                    className="text-amber-600"
                    onClick={() => suspendMutation.mutate(selectedDoctor.id)}
                    disabled={suspendMutation.isPending}
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Suspend Account
                  </Button>
                )}
                {selectedDoctor.status === DoctorStatus.SUSPENDED && (
                  <Button 
                    onClick={() => verifyMutation.mutate(selectedDoctor.id)}
                    disabled={verifyMutation.isPending}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Reactivate Account
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Doctor Application</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this doctor's application.
            </DialogDescription>
          </DialogHeader>
          
          <Textarea
            placeholder="Enter rejection reason..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
            data-testid="input-reject-reason"
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={() => {
                if (selectedDoctor) {
                  rejectMutation.mutate({ doctorId: selectedDoctor.id, reason: rejectReason });
                }
              }}
              disabled={rejectMutation.isPending}
              data-testid="button-confirm-reject"
            >
              Reject Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}