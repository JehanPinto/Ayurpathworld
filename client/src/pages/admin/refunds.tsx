import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  MoreHorizontal, 
  CircleDollarSign, 
  UserX, 
  Sigma, 
  Info, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Clock,
  ArrowRightLeft,
  History,
  XCircle
} from "lucide-react";
import { format, parseISO } from "date-fns";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingPage, LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Modal } from "@/components/ui/modal";
import { useUrlPagination } from "@/hooks/use-url-pagination";
import { Pagination } from "@/components/ui/pagination";

const RefundRowSkeleton = () => (
  <tr className="animate-pulse border-b border-border">
    <td className="px-3 py-5 md:px-6"><div className="h-4 w-4 bg-muted rounded" /></td>
    <td className="px-3 py-5 md:px-6"><div className="h-4 w-28 bg-muted rounded" /></td>
    <td className="px-3 py-5 md:px-6"><div className="h-4 w-36 bg-muted rounded" /></td>
    <td className="px-3 py-5 md:px-6"><div className="h-4 w-20 bg-muted rounded" /></td>
    <td className="px-3 py-5 md:px-6 hidden sm:table-cell"><div className="h-4 w-16 bg-muted rounded" /></td>
    <td className="px-3 py-5 md:px-6 hidden sm:table-cell"><div className="h-4 w-12 bg-muted rounded" /></td>
    <td className="px-3 py-5 md:px-6"><div className="h-4 w-20 bg-muted rounded" /></td>
    <td className="px-3 py-5 md:px-6 text-right"><div className="h-8 w-20 bg-muted rounded-full inline-block" /></td>
  </tr>
);

export default function AdminRefunds() {
  const { toast } = useToast();
  const [selectedRefund, setSelectedRefund] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [currentPage, setCurrentPage] = useState(1);

  const { data: response, isLoading, isFetching, isError } = useQuery({
    queryKey: ["/api/admin/refund-requests", currentPage, activeTab],
    queryFn: async () => { 
      const res = await fetch(`/api/admin/refund-requests?page=${currentPage}&limit=10&status=${activeTab}`);
      if (!res.ok) throw new Error("Failed to load refund requests");
      return res.json();
    }
  });

  const allRequests = response?.data || [];
  const totalPages = response?.totalPages || 1;

  const processMutation = useMutation({
    mutationFn: (data: { id: string; status: string }) => {
      return apiRequest("PATCH", `/api/admin/refunds/${data.id}/process`, { status: data.status });
    },
    onSuccess: (responseData, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/refund-requests"] });
      setSelectedRefund(null);
      toast({ 
        title: variables.status === 'completed' ? "Refund Approved!" : "Refund Rejected",
        description: `The refund request was successfully ${variables.status}.`,
        variant: variables.status === 'rejected' ? 'destructive' : 'default'
      });
    },
    onError: (err: any) => {
      toast({ title: "Failed to process", description: err.message, variant: "destructive" });
    },
  });

  // --- CALCULATIONS FOR CARDS ---
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Since allRequests is paginated, we should ideally fetch global stats from an endpoint.
  // For now, based on your logic:
  const pendingRequests = allRequests.filter((r: any) => r.refund.status === "pending");
  const pendingRequestsCount = pendingRequests.length;

  const requestsLast30Days = allRequests.filter((r: any) => {
    const createdAt = new Date(r.refund.createdAt || r.refund.created_at || Date.now());
    return createdAt >= thirtyDaysAgo;
  });
  const requestsLast30DaysCount = requestsLast30Days.length;

  const refundedLast30DaysAmount = requestsLast30Days
    .filter((r: any) => r.refund.status === "completed")
    .reduce((sum: number, r: any) => sum + (Number(r.refund.amount) || 0), 0);

  const refundableTotalAmount = pendingRequests
    .reduce((sum: number, r: any) => sum + (Number(r.refund.amount) || 0), 0);

  const formatPrice = (value: number) => 
    new Intl.NumberFormat("en-LK", { minimumFractionDigits: 0 }).format(value || 0);

  if (isLoading) return <LoadingPage message="Loading refund requests..." />;

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 px-4 text-center">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">Failed to load dashboard. Please try again.</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl md:text-3xl font-heading font-bold">Refund Requests</h1>
        <p className="text-muted-foreground">Review and process pending appointment refunds.</p>
      </div>

      {/* --- STATS CARDS USING CSS VARIABLES (NO HARDCODED COLORS) --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        
        {/* Card 1: Pending Requests (Secondary/Yellow Theme) */}
        <Card className="p-6 border-secondary/20 bg-secondary/5 rounded-3xl shadow-sm flex flex-col justify-between hover-elevate">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-secondary/20 rounded-full text-secondary">
              <Clock className="w-5 h-5" />
            </div>
            <span className="text-sm font-bold text-foreground/80">Pending Requests</span>
          </div>
          <div className="text-center">
            <span className="text-4xl lg:text-5xl font-black text-secondary tracking-tight">
              {pendingRequestsCount}
            </span>
            <p className="text-sm font-bold text-muted-foreground">Awaiting processing</p>
          </div>
        </Card>

        {/* Card 2: Refund Requests (Primary/Green Theme) */}
        <Card className="p-6 border-primary/20 bg-primary/5 rounded-3xl shadow-sm flex flex-col justify-between hover-elevate">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-full text-primary">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <span className="text-sm font-bold text-foreground/80">Refund Requests</span>
          </div>
          <div className="text-center">
            <span className="text-4xl lg:text-5xl font-black text-primary tracking-tight">
              {requestsLast30DaysCount}
            </span>
            <p className="text-sm font-bold text-muted-foreground">Last 30 days</p>
          </div>
        </Card>

        {/* Card 3: Refund Payment (Accent/Muted Theme) */}
        <Card className="p-6 border-accent bg-accent/30 rounded-3xl shadow-sm flex flex-col justify-between hover-elevate">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-background border border-border rounded-full text-foreground">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="text-sm font-bold text-foreground/80">Refunded Payment</span>
          </div>
          <div className="text-center flex items-baseline justify-center gap-1.5">
            <span className="text-xl lg:text-2xl font-black text-foreground">LKR</span>
            <span className="text-3xl lg:text-4xl font-black text-foreground tracking-tight">
              {formatPrice(refundedLast30DaysAmount)}
            </span>
          </div>
          <p className="text-sm font-bold text-muted-foreground text-center mt-2">Last 30 days</p>
        </Card>

        {/* Card 4: Refundable Total (Destructive/Red Theme) */}
        <Card className="p-6 border-destructive/20 bg-destructive/5 rounded-3xl shadow-sm flex flex-col justify-between hover-elevate">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-destructive/20 rounded-full text-destructive">
              <Sigma className="w-5 h-5" />
            </div>
            <span className="text-sm font-bold text-foreground/80">Refundable Total</span>
          </div>
          <div className="text-center flex items-baseline justify-center gap-1.5">
            <span className="text-xl lg:text-2xl font-black text-destructive">LKR</span>
            <span className="text-3xl lg:text-4xl font-black text-destructive tracking-tight">
              {formatPrice(refundableTotalAmount)}
            </span>
          </div>
          <p className="text-sm font-bold text-muted-foreground text-center mt-2">Pending to be paid</p>
        </Card>

      </div>

      {/* --- TABS --- */}
      <div className="flex items-center gap-2 p-1.5 bg-muted/40 w-fit rounded-xl border border-border shadow-sm">
        <button 
          onClick={() => { setActiveTab("pending"); setCurrentPage(1); }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
            activeTab === "pending" 
            ? "bg-background text-foreground shadow-sm" 
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Clock className="w-4 h-4" /> Pending Processing
        </button>
        <button 
          onClick={() => { setActiveTab("history"); setCurrentPage(1); }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
            activeTab === "history" 
            ? "bg-background text-foreground shadow-sm" 
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <History className="w-4 h-4" /> Refund History
        </button>
      </div>

      {/* --- DATA TABLE --- */}
      <Card className="overflow-hidden border-border rounded-[2rem] shadow-lg bg-card">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-xs md:text-sm text-left">
            <thead className="bg-primary/10 text-primary font-bold uppercase tracking-wider border-b border-border">
              <tr>
                <th className="px-3 py-4 md:px-6 md:py-5 whitespace-nowrap sticky left-0 bg-popover z-20 border-r border-border">#</th>
                <th className="px-3 py-4 md:px-6 md:py-5 whitespace-nowrap">Patient</th>
                <th className="px-3 py-4 md:px-6 md:py-5 whitespace-nowrap">Reason</th>
                <th className="px-3 py-4 md:px-6 md:py-5 whitespace-nowrap">Original Paid</th>
                <th className="px-3 py-4 md:px-6 md:py-5 whitespace-nowrap hidden sm:table-cell">Booking Charge</th>
                <th className="px-3 py-4 md:px-6 md:py-5 whitespace-nowrap hidden sm:table-cell">Tax</th>
                <th className="px-3 py-4 md:px-6 md:py-5 whitespace-nowrap">Refund Total</th>
                <th className="px-3 py-4 md:px-6 md:py-5 whitespace-nowrap text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isFetching ? (
                <>
                  <RefundRowSkeleton />
                  <RefundRowSkeleton />
                  <RefundRowSkeleton />
                  <RefundRowSkeleton />
                  <RefundRowSkeleton />
                </>
              ) : allRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-muted-foreground font-bold text-base">
                    No {activeTab} refund requests found.
                  </td>
                </tr>
              ) : (
                allRequests.map((req: any, index: number) => (
                  <tr key={req.refund.id} className="hover:bg-accent/50 transition-colors">
                    <td className="px-3 py-4 md:px-6 md:py-5 font-mono font-bold text-muted-foreground bg-card sticky left-0 z-10 border-r border-border">
                      {((currentPage - 1) * 10) + index + 1}
                    </td>
                    <td className="px-3 py-4 md:px-6 md:py-5 font-bold text-foreground whitespace-nowrap">
                      {req.appointment?.patient?.fullName || "Unknown"}
                    </td>
                    <td className="px-3 py-4 md:px-6 md:py-5 font-medium text-muted-foreground whitespace-nowrap truncate max-w-[200px]" title={req.refund.reason}>
                      {req.refund.reason}
                    </td>
                    <td className="px-3 py-4 md:px-6 md:py-5 font-semibold text-foreground whitespace-nowrap">
                      LKR {formatPrice(req.payment.totalAmount)}
                    </td>
                    
                    <td className="px-3 py-4 md:px-6 md:py-5 font-black text-destructive whitespace-nowrap hidden sm:table-cell">LKR {formatPrice(req.payment.bookingCharges || 0)}</td>
                    <td className="px-3 py-4 md:px-6 md:py-5 font-black text-destructive whitespace-nowrap hidden sm:table-cell">LKR {formatPrice(req.payment.tax || 0)}</td>
                    
                    <td className="px-3 py-4 md:px-6 md:py-5 font-black text-primary whitespace-nowrap">LKR {formatPrice(req.refund.amount)}</td>
                    <td className="px-3 py-4 md:px-6 md:py-5 text-right whitespace-nowrap">
                      {activeTab === 'pending' ? (
                        <Button
                          onClick={() => setSelectedRefund(req)}
                          className="bg-secondary text-secondary-foreground hover:bg-secondary/90 rounded-full font-bold px-4 md:px-6 shadow-sm"
                          size="sm"
                        >
                          <CircleDollarSign className="w-4 h-4 md:mr-2" /> 
                          <span className="hidden md:inline">Process</span>
                        </Button>
                      ) : (
                        <div className="flex items-center justify-end gap-3">
                          <Badge variant={req.refund.status === 'completed' ? 'default' : 'destructive'} className="capitalize hidden lg:flex">
                            {req.refund.status}
                          </Badge>
                          <Button
                            onClick={() => setSelectedRefund(req)}
                            variant="outline"
                            className="rounded-full font-bold shadow-sm"
                            size="sm"
                          >
                            <Info className="w-4 h-4 md:mr-2" /> 
                            <span className="hidden md:inline">Details</span>
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* --- PAGINATION --- */}
      <div className="flex items-center justify-center pt-4">
        {totalPages > 1 && (
          <div className="flex justify-end">
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
        )}
      </div>

      {/* --- PROCESS REFUND MODAL --- */}
      <Modal 
        isOpen={!!selectedRefund} 
        onClose={() => setSelectedRefund(null)}
        title={selectedRefund?.refund.status === 'pending' ? "Process Refund Request" : "Refund Details"}
        description={selectedRefund?.refund.status === 'pending' ? "Review the details and confirm or reject the refund." : "Viewing processed refund details."}
        icon={<CircleDollarSign className="w-6 h-6 text-primary" />}
      >
        {selectedRefund && (
          <div className="space-y-6">
            <div className="bg-muted/30 border border-border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-foreground text-lg">{selectedRefund.appointment?.patient?.fullName}</h4>
                <p className="text-xs font-bold text-muted-foreground mt-1">
                  Appt. Date: {format(parseISO(selectedRefund.appointment?.appointmentDate || new Date().toISOString()), "MMM d, yyyy")}
                </p>
              </div>
              <Badge 
                variant={selectedRefund.refund.status === 'completed' ? 'default' : selectedRefund.refund.status === 'rejected' ? 'destructive' : 'outline'} 
                className="rounded-full font-bold px-3 capitalize"
              >
                Status: {selectedRefund.refund.status}
              </Badge>
            </div>

            <div className="bg-primary/5 border border-primary/20 text-foreground px-4 py-3 rounded-xl text-sm flex flex-col gap-1">
              <span className="font-bold text-primary uppercase text-[10px] tracking-wider">Reason for Refund</span>
              <span className="font-medium leading-relaxed">{selectedRefund.refund.reason}</span>
            </div>

            {/* Breakdown Table */}
            <div className="border border-border rounded-2xl overflow-hidden bg-card">
              <div className="flex justify-between items-center p-4 border-b border-border">
                <span className="font-semibold text-muted-foreground">Original Paid Amount</span>
                <span className="font-bold text-foreground">LKR {formatPrice(selectedRefund.payment.totalAmount)}</span>
              </div>
              <div className="flex justify-between items-center p-4 border-b border-border">
                <span className="font-semibold text-muted-foreground">Tax</span>
                <span className="font-bold text-destructive">– LKR {formatPrice(selectedRefund.payment.tax || 0)}</span>
              </div>
              <div className="flex justify-between items-center p-4 border-b border-border">
                <span className="font-semibold text-muted-foreground">Booking Charge</span>
                <span className="font-bold text-destructive">– LKR {formatPrice(selectedRefund.payment.bookingCharges || 0)}</span>
              </div>
              <div className={`flex justify-between items-center p-4 ${selectedRefund.refund.status === 'rejected' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
                <span className="font-bold">Requested Refund Amount</span>
                <span className="font-black text-lg">LKR {formatPrice(selectedRefund.refund.amount)}</span>
              </div>
            </div>

            {selectedRefund.refund.status === 'pending' ? (
              <div className="flex gap-3 justify-end pt-4 border-t border-border">
                <Button 
                  variant="outline" 
                  onClick={() => processMutation.mutate({ id: selectedRefund.refund.id, status: 'rejected' })}
                  className="rounded-full text-destructive border-destructive/50 hover:bg-destructive hover:text-white"
                  disabled={processMutation.isPending}
                >
                  {processMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><XCircle className="w-4 h-4 mr-2" /> Reject</>}
                </Button>
                <Button 
                  onClick={() => processMutation.mutate({ id: selectedRefund.refund.id, status: 'completed' })}
                  className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={processMutation.isPending}
                >
                  {processMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Confirm Refund"}
                </Button>
              </div>
            ) : (
              <div className="flex gap-3 justify-end pt-2">
                <Button onClick={() => setSelectedRefund(null)} className="rounded-full">Close</Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}