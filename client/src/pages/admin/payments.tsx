import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Search, 
  AlertCircle,
  Eye,
  DollarSign,
  CreditCard,
  Building2,
  RefreshCcw,
  TrendingUp,
  Calendar,
  Copy,
  User,
  Clock,
  Loader2,
  ArrowRightLeft,
} from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoadingPage } from "@/components/ui/loading-spinner";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Payment, AppointmentWithDetails } from "@shared/schema";
import { PaymentStatus, PaymentMethod } from "@shared/schema";
import { Pagination } from "@/components/ui/pagination";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Modal } from "@/components/ui/modal";

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "N/A";

interface PaymentWithAppointment extends Payment {
  appointment?: AppointmentWithDetails;
}

const PaymentRowSkeleton = () => (
  <TableRow className="animate-pulse">
    <TableCell><div className="h-4 w-4 bg-muted rounded" /></TableCell>
    <TableCell><div className="h-10 w-48 bg-muted rounded" /></TableCell>
    <TableCell><div className="h-4 w-24 bg-muted rounded" /></TableCell>
    <TableCell><div className="h-6 w-32 bg-muted rounded-full" /></TableCell>
    <TableCell><div className="h-4 w-20 bg-muted rounded" /></TableCell>
    <TableCell className="text-right"><div className="h-8 w-24 bg-muted rounded-full inline-block" /></TableCell>
  </TableRow>
);

export default function AdminPaymentsPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [selectedPayment, setSelectedPayment] = useState<PaymentWithAppointment | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReasonType, setRefundReasonType] = useState("");
  const [refundReasonNotes, setRefundReasonNotes] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const { data: response, isLoading, isError, isFetching } = useQuery({
    queryKey: ["/api/admin/payments", currentPage],
    queryFn: async () => {
      const res = await fetch(`/api/admin/payments?page=${currentPage}&limit=10`);
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    }
  });

  const payments = response?.data || [];
  const totalPages = response?.totalPages || 1;

  console.log("Fetched payments:", payments);
  console.log("Current page:", currentPage, "Total pages:", totalPages);

  const requestRefundMutation = useMutation({
    mutationFn: (data: { paymentId: string; refundAmount: number; refundReason: string }) => 
      apiRequest("POST", `/api/admin/refund-requests/create`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] });
      toast({
        title: "Refund Request Initiated",
        description: "The request has been sent to the Refunds section for approval.",
      });
      setShowRefundDialog(false);
      setShowDetailsDialog(false);
      setRefundAmount("");
      setRefundReasonType("");
      setRefundReasonNotes("");
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message || "Failed to initiate refund.",
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

  const getStats = () => {
    const completed = payments.filter((p: any) => p.status === PaymentStatus.COMPLETED);
    const pending = payments.filter((p: any) => p.status === PaymentStatus.PENDING);
    const refunded = payments.filter((p: any) => p.status === PaymentStatus.REFUNDED);
    
    return {
      totalRevenue: completed.reduce((sum: number, p: any) => sum + p.totalAmount, 0),
      platformEarnings: completed.reduce((sum: number, p: any) => sum + (p.platformCommission || 0), 0),
      pendingAmount: pending.reduce((sum: number, p: any) => sum + p.totalAmount, 0),
      refundedAmount: refunded.reduce((sum: number, p: any) => sum + (p.refundAmount || 0), 0),
    };
  };

  const stats = getStats();

  if (isLoading) {
    return <LoadingPage message="Loading payments..." />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">Failed to load payments. Please try again.</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  const filteredPayments = payments.filter((payment: any) => {
    const matchesSearch = 
      payment.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.transactionId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.appointment?.patient?.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.appointment?.doctor?.user?.fullName?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || payment.status === statusFilter;
    const matchesMethod = methodFilter === "all" || payment.method === methodFilter;
    
    return matchesSearch && matchesStatus && matchesMethod;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold">Payments Management</h1>
          <p className="text-muted-foreground">View and manage all payments</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">{formatFee(stats.totalRevenue)}</p>
              </div>
              <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
                <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Platform Earnings</p>
                <p className="text-2xl font-bold">{formatFee(stats.platformEarnings)}</p>
              </div>
              <div className="p-3 rounded-full bg-primary/10">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{formatFee(stats.pendingAmount)}</p>
              </div>
              <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900/30">
                <CreditCard className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Refunded</p>
                <p className="text-2xl font-bold">{formatFee(stats.refundedAmount)}</p>
              </div>
              <div className="p-3 rounded-full bg-red-100 dark:bg-red-900/30">
                <RefreshCcw className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by payment ID, patient, or doctor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[150px]" data-testid="select-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-full sm:w-[150px]" data-testid="select-method">
            <SelectValue placeholder="Method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            <SelectItem value="online">Online</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden border-border rounded-3xl shadow-lg bg-card mt-6">
        <div className="overflow-x-auto w-full">
          <Table className="w-full text-xs md:text-sm text-left min-w-[800px]">
            <TableHeader className="bg-primary/10 border-b border-border">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-4 py-4 font-bold text-emerald-900 dark:text-emerald-500 uppercase tracking-wider w-[60px]">#</TableHead>
                <TableHead className="px-4 py-4 font-bold text-emerald-900 dark:text-emerald-500 uppercase tracking-wider">Doctor & Patient</TableHead>
                <TableHead className="px-4 py-4 font-bold text-emerald-900 dark:text-emerald-500 uppercase tracking-wider">Date</TableHead>
                <TableHead className="px-4 py-4 font-bold text-emerald-900 dark:text-emerald-500 uppercase tracking-wider">Status & Method</TableHead>
                <TableHead className="px-4 py-4 font-bold text-emerald-900 dark:text-emerald-500 uppercase tracking-wider">Amount</TableHead>
                <TableHead className="px-4 py-4 font-bold text-emerald-900 dark:text-emerald-500 uppercase tracking-wider text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border">
              {isFetching ? (
                <>
                  <PaymentRowSkeleton />
                  <PaymentRowSkeleton />
                  <PaymentRowSkeleton />
                  <PaymentRowSkeleton />
                  <PaymentRowSkeleton />
                </>
              ) : filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <DollarSign className="h-12 w-12 text-muted-foreground/50 mb-3" />
                      <h3 className="font-semibold text-foreground text-base">No payments found</h3>
                      <p className="text-muted-foreground text-sm">Try adjusting your filters or search query.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((payment: any, index: number) => (
                  <TableRow 
                    key={payment.id} 
                    className="cursor-pointer group hover:bg-primary/5 transition-colors"
                    onClick={() => {
                      setSelectedPayment(payment);
                      setShowDetailsDialog(true);
                    }}
                  >
                    <TableCell className="font-mono text-muted-foreground font-medium px-4">
                      {((currentPage - 1) * 10) + index + 1}
                    </TableCell>
                    
                    {/* Doctor & Patient Info */}
                    <TableCell className="px-4 py-3">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-semibold text-sm">Dr. {payment.appointment?.doctor?.user?.fullName || "Unknown"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">{payment.appointment?.patient?.fullName || "Unknown"}</span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Date */}
                    <TableCell className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{format(new Date(payment.createdAt), "MMM d, yyyy")}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3"/> {format(new Date(payment.createdAt), "h:mm a")}</span>
                      </div>
                    </TableCell>

                    {/* Status & Method */}
                    <TableCell className="px-4 py-3">
                      <div className="flex flex-col gap-2 items-start">
                        <StatusBadge status={payment.status} type="payment" />
                        <Badge variant={payment.method === PaymentMethod.ONLINE ? "secondary" : "outline"} className="text-[10px] w-fit">
                          {payment.method === PaymentMethod.ONLINE ? (
                            <><CreditCard className="h-3 w-3 mr-1" /> Online</>
                          ) : (
                            <><Building2 className="h-3 w-3 mr-1" /> At Clinic</>
                          )}
                        </Badge>
                      </div>
                    </TableCell>

                    {/* Amount */}
                    <TableCell className="px-4 py-3">
                      <span className="font-black text-base text-foreground block">
                        LKR {formatFee(payment.totalAmount).replace('LKR', '').trim()}
                      </span>
                      {payment.status === PaymentStatus.REFUNDED && (
                        <span className="text-xs font-bold text-destructive">Refunded: LKR {formatFee(payment.refundAmount || 0).replace('LKR', '').trim()}</span>
                      )}
                    </TableCell>

                    {/* Action */}
                    <TableCell className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {payment.status === PaymentStatus.COMPLETED && !payment.refundRequest && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-amber-600 border-amber-200 hover:bg-amber-50 rounded-full h-8"
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent row click
                              setSelectedPayment(payment);
                              setRefundAmount(payment.totalAmount.toString());
                              setShowRefundDialog(true);
                            }}
                          >
                            <ArrowRightLeft className="h-3.5 w-3.5 md:mr-1.5" /> 
                            <span className="hidden md:inline">Refund</span>
                          </Button>
                        )}
                        {payment.refundRequest && payment.status !== PaymentStatus.REFUNDED && (
                          <Badge variant="outline" className="text-[10px] w-fit text-amber-600 border-amber-300 bg-amber-50">
                            <RefreshCcw className="h-3 w-3 mr-1 animate-spin-slow" /> 
                            Refund {payment.refundRequest.status}
                          </Badge>
                        )}
                        {payment.status === PaymentStatus.REFUNDED && (
                          <Badge variant="outline" className="text-[10px] w-fit text-destructive border-destructive/50 bg-destructive/10">
                            <RefreshCcw className="h-3 w-3 mr-1" /> Refunded
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <div className="flex items-center justify-center pt-4">
        {totalPages > 1 && (
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        )}
      </div>

      {/* SUPER DETAILED PAYMENT VIEW MODAL */}
      <Modal
        isOpen={showDetailsDialog}
        onClose={() => setShowDetailsDialog(false)}
        title="Payment Record Details"
        description="Comprehensive overview of the financial transaction and related booking."
        icon={<DollarSign className="w-5 h-5 text-primary" />}
        className="max-w-5xl w-[95vw] flex flex-col h-[95vh] md:h-[85vh] p-0"
        footer={
          <div className="flex w-full justify-between items-center flex-wrap gap-4 px-6 py-4">
            <p className="text-xs text-muted-foreground hidden sm:block">Reference ID: {selectedPayment?.id}</p>
            <div className="flex gap-3 w-full sm:w-auto">
              <Button variant="outline" className="rounded-full px-6 w-full sm:w-auto border-border" onClick={() => setShowDetailsDialog(false)}>
                Close
              </Button>
              {selectedPayment?.status === PaymentStatus.COMPLETED && (
                <Button 
                  className="rounded-full px-6 w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white font-bold"
                  onClick={() => {
                    setRefundAmount(selectedPayment.totalAmount.toString());
                    setShowRefundDialog(true);
                  }}
                >
                  <RefreshCcw className="w-4 h-4 mr-2" /> Process Refund
                </Button>
              )}
            </div>
          </div>
        }
      >
        {selectedPayment && (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            
            {/* Top IDs Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 p-5 bg-muted/30 rounded-2xl border border-border shadow-sm">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Payment ID</p>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-foreground truncate">{selectedPayment.id.split('-')[0].toUpperCase()}</span>
                  <Copy className="w-3.5 h-3.5 cursor-pointer text-muted-foreground hover:text-primary transition-colors" onClick={() => { navigator.clipboard.writeText(selectedPayment.id); toast({title:"Copied", description:"Payment ID copied!"}) }} />
                </div>
              </div>
              <div className="space-y-1 sm:border-l sm:border-border sm:pl-4">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Appointment ID</p>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-foreground truncate">{selectedPayment.appointmentId.split('-')[0].toUpperCase()}</span>
                  <Copy className="w-3.5 h-3.5 cursor-pointer text-muted-foreground hover:text-primary transition-colors" onClick={() => { navigator.clipboard.writeText(selectedPayment.appointmentId); toast({title:"Copied", description:"Appointment ID copied!"}) }} />
                </div>
              </div>
              <div className="space-y-1 sm:border-l sm:border-border sm:pl-4">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">System Status</p>
                <StatusBadge status={selectedPayment.status} type="payment" />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Column 1: Participants Info */}
              <div className="space-y-6">
                <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5 h-full">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                    <User className="w-4 h-4" /> Participants
                  </h3>
                  
                  {/* Patient Info */}
                  <div className="flex items-center gap-4 mb-6">
                    <Avatar className="h-12 w-12 shadow-sm border border-border">
                      <AvatarImage src={selectedPayment.appointment?.patient?.profileImage} />
                      <AvatarFallback className="bg-blue-100 text-blue-600 font-bold">{getInitials(selectedPayment.appointment?.patient?.fullName || "")}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-0.5">Patient</p>
                      <p className="font-bold text-base text-foreground leading-tight">{selectedPayment.appointment?.patient?.fullName || "N/A"}</p>
                    </div>
                  </div>

                  {/* Doctor Info */}
                  <div className="flex items-center gap-4 pt-6 border-t border-border/50">
                    <Avatar className="h-12 w-12 shadow-sm border border-border">
                      <AvatarImage src={selectedPayment.appointment?.doctor?.user?.profileImage} />
                      <AvatarFallback className="bg-emerald-100 text-emerald-600 font-bold">{getInitials(selectedPayment.appointment?.doctor?.user?.fullName || "")}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-0.5">Doctor</p>
                      <p className="font-bold text-base text-foreground leading-tight">Dr. {selectedPayment.appointment?.doctor?.user?.fullName || "N/A"}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Column 2: Booking Details */}
              <div className="space-y-6">
                <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5 h-full">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> Schedule Info
                  </h3>
                  
                  <div className="flex items-center gap-4 mb-5 p-4 bg-primary/5 rounded-xl border border-primary/10">
                    <div className="w-14 h-14 rounded-xl bg-background flex flex-col items-center justify-center border border-border shadow-sm shrink-0">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">{format(new Date(selectedPayment.createdAt), "MMM")}</span>
                      <span className="text-xl font-black text-primary leading-none">{format(new Date(selectedPayment.createdAt), "dd")}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-base truncate">Payment Date</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5 font-medium mt-1 truncate">
                        <Clock className="w-3.5 h-3.5 text-primary/70 shrink-0" /> 
                        {format(new Date(selectedPayment.createdAt), "h:mm a")}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className="p-3.5 bg-muted/30 rounded-xl border border-border/50 text-center flex flex-col justify-center">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1 tracking-wider">Method</p>
                      <p className="font-bold text-sm text-foreground capitalize mt-1 flex items-center justify-center gap-1.5">
                        {selectedPayment.method === PaymentMethod.ONLINE ? <CreditCard className="w-4 h-4 text-blue-500" /> : <Building2 className="w-4 h-4 text-emerald-500" />}
                        {selectedPayment.method.replace("_", " ")}
                      </p>
                    </div>
                    <div className="p-3.5 bg-muted/30 rounded-xl border border-border/50 text-center flex flex-col justify-center">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1 tracking-wider">Type</p>
                      <p className="font-bold text-sm text-foreground capitalize mt-1">
                        {selectedPayment.appointment?.consultationType?.replace("_", " ") || "N/A"}
                      </p>
                    </div>
                  </div>

                  {selectedPayment.transactionId && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30">
                      <p className="text-[10px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider mb-1.5">Gateway Transaction ID</p>
                      <p className="font-mono text-sm text-blue-950 dark:text-blue-200 font-bold">{selectedPayment.transactionId}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Column 3: Financial Ledger */}
              <div className="space-y-6">
                <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5 h-full flex flex-col">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-5 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" /> Financial Ledger
                  </h3>

                  <div className="flex flex-col flex-1">
                    <div className="space-y-3.5 mb-6 flex-1">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground font-medium">Consultation Fee</span>
                        <span className="font-bold">{formatFee(selectedPayment.consultationFee)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground font-medium">Booking Charges</span>
                        <span className="font-bold">{formatFee(selectedPayment.bookingCharges || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground font-medium">Taxes & Levies</span>
                        <span className="font-bold">{formatFee(selectedPayment.tax || 0)}</span>
                      </div>
                    </div>
                    
                    <div className="p-5 bg-primary/5 rounded-xl border border-primary/20 mb-6 flex justify-between items-center">
                      <span className="font-bold text-sm text-primary uppercase tracking-wider">Gross Total</span>
                      <span className="font-black text-2xl text-primary">{formatFee(selectedPayment.totalAmount)}</span>
                    </div>

                    <div className="space-y-3 pt-5 border-t border-border">
                      <div className="flex justify-between items-center text-sm border-b border-border/50 pb-3">
                        <span className="text-muted-foreground font-medium">Platform Commission</span>
                        <span className="font-bold text-amber-600 dark:text-amber-400">-{formatFee(selectedPayment.platformCommission || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm font-bold">
                        <span className="text-foreground">Net Doctor Earnings</span>
                        <span className="text-emerald-600 dark:text-emerald-400 text-lg">{formatFee(selectedPayment.doctorEarnings)}</span>
                      </div>
                    </div>
                  </div>

                  {selectedPayment.status === PaymentStatus.REFUNDED && (
                    <div className="mt-5 p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-red-800 dark:text-red-400 mb-3 flex items-center gap-2"><RefreshCcw className="w-3.5 h-3.5"/> Refund Processed</h4>
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <p className="text-[10px] font-bold text-red-700/70 dark:text-red-400/70 uppercase tracking-wider mb-1">Amount</p>
                          <p className="font-black text-sm text-red-900 dark:text-red-200">{formatFee(selectedPayment.refundAmount || 0)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-red-700/70 dark:text-red-400/70 uppercase tracking-wider mb-1">Date</p>
                          <p className="font-bold text-sm text-red-900 dark:text-red-200">{selectedPayment.refundDate}</p>
                        </div>
                      </div>
                      {selectedPayment.refundReason && (
                        <div>
                          <p className="text-[10px] font-bold text-red-700/70 dark:text-red-400/70 uppercase tracking-wider mb-1">Reason</p>
                          <p className="text-xs font-medium text-red-900 dark:text-red-200 leading-snug">{selectedPayment.refundReason}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}
      </Modal>

      {/* INITIATE REFUND MODAL */}
      <Modal
        isOpen={showRefundDialog}
        onClose={() => {
          setShowRefundDialog(false);
          setRefundReasonType("");
          setRefundReasonNotes("");
          setRefundAmount("");
        }}
        title="Initiate Refund Request"
        description="Submit a request to refund this payment. An administrator will review and process it."
        icon={<ArrowRightLeft className="w-5 h-5 text-amber-500" />}
        className="max-w-[450px]"
        footer={
          <>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowRefundDialog(false);
                setRefundReasonType("");
                setRefundReasonNotes("");
                setRefundAmount("");
              }}
              className="rounded-full"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedPayment && refundReasonType) {
                  const finalReason = refundReasonType === "Other" 
                    ? `Other - ${refundReasonNotes.trim()}` 
                    : refundReasonType;
                    
                  // Send required amount based on the selection
                  let finalAmountToSend = 0;
                  if (refundReasonType === "Other") {
                    finalAmountToSend = parseInt(refundAmount);
                  } else if (refundReasonType === "Patient Cancellation (Approved Exception)") {
                    finalAmountToSend = selectedPayment.consultationFee;
                  } else {
                    finalAmountToSend = selectedPayment.totalAmount;
                  }
                    
                  requestRefundMutation.mutate({
                    paymentId: selectedPayment.id,
                    refundAmount: finalAmountToSend,
                    refundReason: finalReason,
                  });
                }
              }}
              disabled={
                !refundReasonType || 
                (refundReasonType === "Other" && (
                  !refundReasonNotes.trim() || 
                  parseInt(refundAmount) <= 0 || 
                  parseInt(refundAmount) > (selectedPayment?.totalAmount || 0) ||
                  isNaN(parseInt(refundAmount))
                )) || 
                requestRefundMutation.isPending
              }
              data-testid="button-confirm-refund"
              className="bg-amber-500 hover:bg-amber-600 text-white rounded-full font-bold px-6 shadow-sm"
            >
              {requestRefundMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Submit Request
            </Button>
          </>
        }
      >
        <div className="grid gap-5">
          {/* Payment Summary Info */}
          <div className="bg-muted/40 p-4 rounded-xl border border-border">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Total Paid Amount</p>
            <p className="font-black text-xl text-foreground">
              {formatFee(selectedPayment?.totalAmount || 0)}
            </p>
          </div>

          {/* Reason Dropdown */}
          <div className="space-y-2">
            <Label htmlFor="refundReasonType" className="font-bold text-foreground">Reason for Refund <span className="text-destructive">*</span></Label>
            <Select 
              value={refundReasonType} 
              onValueChange={(value) => {
                setRefundReasonType(value);
                if (value === "Other") {
                  setRefundAmount("0"); // Set default 0 when Other is selected
                } else {
                  setRefundReasonNotes(""); 
                  setRefundAmount("");
                }
              }}
            >
              <SelectTrigger className="bg-background border-border h-11">
                <SelectValue placeholder="Select a valid reason..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Gateway False-Negative (Money deducted but booking failed)">
                  Gateway Error / Double Charge (Full Refund)
                </SelectItem>
                <SelectItem value="Doctor No-Show (Doctor did not arrive)">
                  Doctor No-Show (Full Refund)
                </SelectItem>
                <SelectItem value="Doctor Cancelled Appointment">
                  Doctor Cancelled (Full Refund)
                </SelectItem>
                <SelectItem value="Patient Cancellation (Approved Exception)">
                  Patient Cancelled (Consultation Fee Only)
                </SelectItem>
                <SelectItem value="Other">
                  Other (Custom Amount)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Dynamic Refund Amount Preview for standard cases */}
          {refundReasonType && refundReasonType !== "Other" && (
            <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 animate-in fade-in">
              <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">Eligible Refund Amount</p>
              <p className="font-black text-2xl text-foreground">
                {refundReasonType === "Patient Cancellation (Approved Exception)" 
                  ? formatFee(selectedPayment?.consultationFee || 0) 
                  : formatFee(selectedPayment?.totalAmount || 0)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1.5 leading-tight">
                {refundReasonType === "Patient Cancellation (Approved Exception)" 
                  ? "Booking charges and taxes are non-refundable for patient cancellations." 
                  : "A full refund will be issued including booking charges and taxes."}
              </p>
            </div>
          )}

          {/* Custom Details for "Other" */}
          {refundReasonType === "Other" && (
            <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-300 border-t border-border pt-4">
              <div className="space-y-2">
                <Label htmlFor="customRefundAmount" className="font-bold text-foreground">
                  Custom Refund Amount (LKR) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="customRefundAmount"
                  type="number"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  min={0}
                  max={selectedPayment?.totalAmount}
                  className="font-black text-lg h-12 bg-background border-border"
                />
                <p className="text-xs flex justify-between mt-1">
                  <span className={parseInt(refundAmount) <= 0 || isNaN(parseInt(refundAmount)) ? "text-destructive font-bold" : "text-muted-foreground"}>
                    Must be greater than 0
                  </span>
                  <span className={parseInt(refundAmount) > (selectedPayment?.totalAmount || 0) ? "text-destructive font-bold" : "text-muted-foreground"}>
                    Max: {formatFee(selectedPayment?.totalAmount || 0)}
                  </span>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="refundReasonNotes" className="font-bold text-foreground">
                  Specify Reason <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="refundReasonNotes"
                  placeholder="Type the exact reason here..."
                  value={refundReasonNotes}
                  onChange={(e) => setRefundReasonNotes(e.target.value)}
                  rows={3}
                  className="resize-none bg-background border-border focus:border-amber-500"
                />
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
