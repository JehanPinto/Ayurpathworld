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
  Loader2
} from "lucide-react";
import { format, parseISO } from "date-fns";

import { Card } from "@/components/ui/card";
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

  const [currentPage, setCurrentPage] = useState(1);

  const { data: response, isLoading, isFetching, isError } = useQuery({
    queryKey: ["/api/admin/refund-requests", currentPage],
    queryFn: async () => { 
      const res = await fetch(`/api/admin/refund-requests?page=${currentPage}&limit=10`);
      if (!res.ok) throw new Error("Failed to load refund requests");
      return res.json();
    }
  });

  const allRequests = response?.data || [];
  const totalPages = response?.totalPages || 1;

  console.log("Fetched refund requests:", allRequests);
  console.log("Current page:", currentPage, "Total pages:", totalPages);

  const processMutation = useMutation({
    mutationFn: (data: { id: string; status: string }) => {
      return apiRequest("PATCH", `/api/admin/refunds/${data.id}/process`, { status: data.status });
    },
    onSuccess: (responseData) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/refund-requests"] });
      setSelectedRefund(null);
      toast({ title: "Refund processed successfully!" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to process", description: err.message, variant: "destructive" });
    },
  });

  const pendingRequests = allRequests.filter((r: any) => r.refund.status === "pending");
  const completedRefunds = allRequests.filter((r: any) => r.refund.status === "completed");

  const doctorCancellationsPending = pendingRequests.filter((r: any) => r.appointment.cancelledBy === "doctor").length;
  const doctorCancellationsTotal = allRequests.filter((r: any) => r.appointment.cancelledBy === "doctor").length;
  const doctorRefundedAmount = completedRefunds
    .filter((r: any) => r.appointment.cancelledBy === "doctor")
    .reduce((sum: number, r: any) => sum + r.refund.amount, 0);

  const patientCancellationsTotal = allRequests.filter((r: any) => r.appointment.cancelledBy === "patient").length;
  const patientRefundedAmount = completedRefunds
    .filter((r: any) => r.appointment.cancelledBy === "patient")
    .reduce((sum: number, r: any) => sum + r.refund.amount, 0);

  const refundableTotal = pendingRequests.reduce((sum: number, r: any) => sum + r.refund.amount, 0);

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

      {/* --- STATS CARDS --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
        <Card className="p-6 border-primary/50 bg-sidebar dark:bg-popover rounded-3xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-full border border-primary/50 text-primary/50">
              <MoreHorizontal className="w-5 h-5" />
            </div>
            <span className="text-sm font-bold text-slate-600 dark:text-white/80">Pending Requests</span>
          </div>
          <div className="text-center mt-2">
            <span className="text-4xl lg:text-5xl font-black text-slate-800 dark:text-white tracking-tight">{pendingRequests.length}</span>
            <p className="text-sm font-bold text-destructive mt-2">{doctorCancellationsPending} doctor cancellations</p>
          </div>
        </Card>

        <Card className="p-6 border-primary/50 bg-sidebar dark:bg-popover rounded-3xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-full border border-primary/50 text-primary/50">
              <UserX className="w-5 h-5" />
            </div>
            <span className="text-sm font-bold text-slate-600 dark:text-white/80">Doctor cancellations</span>
          </div>
          <div className="text-center mt-2">
            <span className="text-4xl lg:text-5xl font-black text-slate-800 dark:text-white tracking-tight">{doctorCancellationsTotal}</span>
            <p className="text-sm font-bold text-slate-400 dark:text-white/80 mt-2">LKR {formatPrice(doctorRefundedAmount)} refunded</p>
          </div>
        </Card>

        <Card className="p-6 border-primary/50 bg-sidebar dark:bg-popover rounded-3xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-full border border-primary/50 text-primary/50">
              <UserX className="w-5 h-5" />
            </div>
            <span className="text-sm font-bold text-slate-600 dark:text-white/80">Patient cancellations</span>
          </div>
          <div className="text-center mt-2">
            <span className="text-4xl lg:text-5xl font-black text-slate-800 dark:text-white tracking-tight">{patientCancellationsTotal}</span>
            <p className="text-sm font-bold text-slate-400 dark:text-white/80 mt-2">LKR {formatPrice(patientRefundedAmount)} refunded</p>
          </div>
        </Card>

        <Card className="p-6 border-primary/50 bg-sidebar dark:bg-popover rounded-3xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-full border border-primary/50 text-primary/50">
              <Sigma className="w-5 h-5" />
            </div>
            <span className="text-sm font-bold text-slate-600 dark:text-white/80">Refundable Total</span>
          </div>
          <div className="text-center mt-2 flex items-baseline justify-center gap-1.5">
            <span className="text-xl lg:text-2xl font-black text-slate-800 dark:text-white">LKR</span>
            <span className="text-4xl lg:text-5xl font-black text-slate-800 dark:text-white tracking-tight">{formatPrice(refundableTotal)}</span>
          </div>
        </Card>
      </div>

      {/* --- DATA TABLE --- */}
      <Card className="overflow-hidden border-border rounded-[2rem] shadow-lg bg-card">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-xs md:text-sm text-left">
            <thead className="bg-primary/10 text-emerald-900 dark:text-emerald-500 font-bold uppercase tracking-wider border-b border-border">
              <tr>
                {/* Sticky Column Header */}
                <th className="px-3 py-4 md:px-6 md:py-5 whitespace-nowrap sticky left-0 bg-popover z-20 border-r border-border">#</th>
                <th className="px-3 py-4 md:px-6 md:py-5 whitespace-nowrap">Patient</th>
                <th className="px-3 py-4 md:px-6 md:py-5 whitespace-nowrap">Reason</th>
                <th className="px-3 py-4 md:px-6 md:py-5 whitespace-nowrap">Total</th>
                
                <th className="px-3 py-4 md:px-6 md:py-5 whitespace-nowrap hidden sm:table-cell">Booking Charge</th>
                <th className="px-3 py-4 md:px-6 md:py-5 whitespace-nowrap hidden sm:table-cell">Tax</th>
                
                <th className="px-3 py-4 md:px-6 md:py-5 whitespace-nowrap">Refund</th>
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
                    No refund requests found.
                  </td>
                </tr>
              ) : (
                allRequests.map((req: any, index: number) => (
                  <tr key={req.refund.id} className="hover:bg-accent/50 transition-colors">
                    <td className="px-3 py-4 md:px-6 md:py-5 font-mono font-bold text-muted-foreground bg-card sticky left-0 z-10 border-r border-border">
                      {index + 1}
                    </td>
                    <td className="px-3 py-4 md:px-6 md:py-5 font-bold text-foreground whitespace-nowrap">
                      {req.appointment.patient?.fullName || "Unknown"}
                    </td>
                    <td className="px-3 py-4 md:px-6 md:py-5 font-medium text-muted-foreground whitespace-nowrap">{req.refund.reason}</td>
                    <td className="px-3 py-4 md:px-6 md:py-5 font-semibold text-foreground whitespace-nowrap">LKR {formatPrice(req.payment.totalAmount)}</td>
                    
                    <td className="px-3 py-4 md:px-6 md:py-5 font-black text-destructive whitespace-nowrap hidden sm:table-cell">LKR {formatPrice(req.payment.bookingCharges || 0)}</td>
                    <td className="px-3 py-4 md:px-6 md:py-5 font-black text-destructive whitespace-nowrap hidden sm:table-cell">LKR {formatPrice(req.payment.tax || 0)}</td>
                    
                    <td className="px-3 py-4 md:px-6 md:py-5 font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">LKR {formatPrice(req.refund.amount)}</td>
                    <td className="px-3 py-4 md:px-6 md:py-5 text-right whitespace-nowrap">
                      <Button
                        onClick={() => setSelectedRefund(req)}
                        className="bg-secondary text-secondary-foreground hover:bg-secondary/90 rounded-full font-bold px-4 md:px-6 shadow-sm"
                        size="sm"
                      >
                        <CircleDollarSign className="w-4 h-4 md:mr-2" /> 
                        <span className="hidden md:inline">Refund</span>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex items-center justify-center">
        {totalPages > 1 && (
          <div className="pt-4 flex justify-end">
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
        )}
      </div>

      <Modal 
        isOpen={!!selectedRefund} 
        onClose={() => setSelectedRefund(null)}
        title="Process Refund"
        description="Review and confirm refund details"
        icon={<CircleDollarSign className="w-6 h-6 text-primary" />}
      >
        {selectedRefund && (
          <div className="space-y-6">
            <div className="bg-muted/30 border border-border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-foreground text-lg">{selectedRefund.appointment.patient?.fullName}</h4>
                <p className="text-xs font-bold text-muted-foreground mt-1">
                  {format(parseISO(selectedRefund.appointment.appointmentDate), "MMM d, yyyy")}
                </p>
              </div>
              <Badge variant="outline" className="border-primary/20 text-primary rounded-full font-bold px-3">
                {selectedRefund.appointment.consultationType === "in_person" ? "In Person" : "Online"}
              </Badge>
            </div>

            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl text-sm font-bold">
              {selectedRefund.appointment.cancelledBy === "doctor" ? "Doctor cancelled" : "Patient cancelled"} — Only consultation fee refund eligible
            </div>

            {/* Breakdown Table */}
            <div className="border border-border rounded-2xl overflow-hidden bg-card">
              <div className="flex justify-between items-center p-4 border-b border-border">
                <span className="font-semibold text-muted-foreground">Total Paid</span>
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
              <div className="flex justify-between items-center p-4 bg-primary/10 text-primary">
                <span className="font-bold">Final Refund</span>
                <span className="font-black text-lg">LKR {formatPrice(selectedRefund.refund.amount)}</span>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => setSelectedRefund(null)} className="rounded-full">Cancel</Button>
              <Button 
                onClick={() => processMutation.mutate({ id: selectedRefund.refund.id, status: 'completed' })}
                className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Confirm Refund
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function StethoscopeIcon({ className = "" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/>
      <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/>
      <circle cx="20" cy="10" r="2"/>
    </svg>
  );
}