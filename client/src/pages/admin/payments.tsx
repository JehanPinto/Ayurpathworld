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
  Calendar
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingPage } from "@/components/ui/loading-spinner";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Payment, AppointmentWithDetails } from "@shared/schema";
import { PaymentStatus, PaymentMethod } from "@shared/schema";
import { Pagination } from "@/components/ui/pagination";

interface PaymentWithAppointment extends Payment {
  appointment?: AppointmentWithDetails;
}

export default function AdminPaymentsPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [selectedPayment, setSelectedPayment] = useState<PaymentWithAppointment | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const { data: response, isLoading, isError } = useQuery({
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

  const refundMutation = useMutation({
    mutationFn: ({ id, refundAmount, refundReason }: { id: string; refundAmount: number; refundReason: string }) => 
      apiRequest("PATCH", `/api/admin/payments/${id}/refund`, { refundAmount, refundReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] });
      toast({
        title: "Refund Processed",
        description: "The payment has been refunded successfully.",
      });
      setShowRefundDialog(false);
      setShowDetailsDialog(false);
      setRefundAmount("");
      setRefundReason("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to process refund. Please try again.",
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
            <SelectItem value="at_clinic">At Clinic</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        {filteredPayments.length > 0 ? (
          filteredPayments.map((payment: any) => (
            <Card 
              key={payment.id} 
              className="hover-elevate"
              data-testid={`card-payment-${payment.id}`}
            >
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                      <Badge variant="outline" className="font-mono w-fit">
                        {payment.id.slice(0, 8)}
                      </Badge>
                      <StatusBadge status={payment.status} type="payment" />
                      <Badge variant={payment.method === PaymentMethod.ONLINE ? "secondary" : "outline"} className="w-fit">
                        {payment.method === PaymentMethod.ONLINE ? (
                          <><CreditCard className="h-3 w-3 mr-1" /> Online</>
                        ) : (
                          <><Building2 className="h-3 w-3 mr-1" /> At Clinic</>
                        )}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Patient</p>
                        <p className="font-medium">{payment.appointment?.patient?.fullName || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Doctor</p>
                        <p className="font-medium">{payment.appointment?.doctor?.user?.fullName || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Date</p>
                        <p className="font-medium">{format(new Date(payment.createdAt), "MMM d, yyyy")}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Amount</p>
                        <p className="font-medium text-lg">{formatFee(payment.totalAmount)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setSelectedPayment(payment);
                        setShowDetailsDialog(true);
                      }}
                      data-testid={`button-view-${payment.id}`}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    {payment.status === PaymentStatus.COMPLETED && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-amber-600"
                        onClick={() => {
                          setSelectedPayment(payment);
                          setRefundAmount(payment.totalAmount.toString());
                          setShowRefundDialog(true);
                        }}
                        data-testid={`button-refund-${payment.id}`}
                      >
                        <RefreshCcw className="h-4 w-4 mr-1" />
                        Refund
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-1">No payments found</h3>
              <p className="text-muted-foreground text-sm">
                {searchQuery || statusFilter !== "all" ? "Try adjusting your search or filters" : "No payments recorded yet"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex items-center justify-center pt-4">
        {totalPages > 1 && (
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        )}
      </div>

      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Payment Details</DialogTitle>
            <DialogDescription>
              Complete payment information
            </DialogDescription>
          </DialogHeader>
          
          {selectedPayment && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="font-mono">
                  {selectedPayment.id}
                </Badge>
                <StatusBadge status={selectedPayment.status} type="payment" />
              </div>

              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Patient</p>
                    <p className="font-medium">{selectedPayment.appointment?.patient?.fullName || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Doctor</p>
                    <p className="font-medium">{selectedPayment.appointment?.doctor?.user?.fullName || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Payment Method</p>
                    <p className="font-medium capitalize">{selectedPayment.method?.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="font-medium">{format(new Date(selectedPayment.createdAt), "PPP")}</p>
                  </div>
                </div>

                {selectedPayment.transactionId && (
                  <div>
                    <p className="text-sm text-muted-foreground">Transaction ID</p>
                    <p className="font-mono text-sm">{selectedPayment.transactionId}</p>
                  </div>
                )}

                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Consultation Fee</span>
                    <span>{formatFee(selectedPayment.consultationFee)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Booking Charges</span>
                    <span>{formatFee(selectedPayment.bookingCharges || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <span>{formatFee(selectedPayment.tax || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t pt-2">
                    <span className="text-muted-foreground">Platform Commission</span>
                    <span>{formatFee(selectedPayment.platformCommission || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Doctor Earnings</span>
                    <span>{formatFee(selectedPayment.doctorEarnings)}</span>
                  </div>
                  <div className="flex justify-between font-medium text-lg border-t pt-2">
                    <span>Total Amount</span>
                    <span>{formatFee(selectedPayment.totalAmount)}</span>
                  </div>
                </div>

                {selectedPayment.status === PaymentStatus.REFUNDED && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                    <h4 className="font-semibold text-amber-700 dark:text-amber-400 mb-2">Refund Details</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Refund Amount</p>
                        <p className="font-medium">{formatFee(selectedPayment.refundAmount || 0)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Refund Date</p>
                        <p className="font-medium">{selectedPayment.refundDate}</p>
                      </div>
                    </div>
                    {selectedPayment.refundReason && (
                      <div className="mt-2">
                        <p className="text-muted-foreground text-sm">Reason</p>
                        <p className="text-sm">{selectedPayment.refundReason}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {selectedPayment.status === PaymentStatus.COMPLETED && (
                <DialogFooter>
                  <Button 
                    variant="outline"
                    className="text-amber-600"
                    onClick={() => {
                      setRefundAmount(selectedPayment.totalAmount.toString());
                      setShowRefundDialog(true);
                    }}
                  >
                    <RefreshCcw className="h-4 w-4 mr-2" />
                    Process Refund
                  </Button>
                </DialogFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showRefundDialog} onOpenChange={setShowRefundDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Refund</DialogTitle>
            <DialogDescription>
              Enter the refund amount and reason
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="refundAmount">Refund Amount (LKR)</Label>
              <Input
                id="refundAmount"
                type="number"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                max={selectedPayment?.totalAmount}
                data-testid="input-refund-amount"
              />
              <p className="text-xs text-muted-foreground">
                Maximum: {formatFee(selectedPayment?.totalAmount || 0)}
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="refundReason">Reason for Refund</Label>
              <Textarea
                id="refundReason"
                placeholder="Enter the reason for this refund..."
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                rows={3}
                data-testid="input-refund-reason"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRefundDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedPayment && refundAmount) {
                  refundMutation.mutate({
                    id: selectedPayment.id,
                    refundAmount: parseInt(refundAmount),
                    refundReason,
                  });
                }
              }}
              disabled={!refundAmount || refundMutation.isPending}
              data-testid="button-confirm-refund"
            >
              Process Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
