import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  CreditCard,
  Clock,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Download,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  ArrowUp,
  ArrowDown,
  FileJson,
  FileText,
  CalendarDays
} from "lucide-react";
import { endOfMonth, format, parseISO, startOfMonth, subMonths } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingPage, LoadingSpinner } from "@/components/ui/loading-spinner";
import { StatusBadge } from "@/components/ui/status-badge";
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
import type { Payment, AppointmentWithDetails } from "@shared/schema";
import { toast } from "@/hooks/use-toast";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EarningsSummary {
  totalEarnings: number;
  pendingEarnings: number;
  completedPayments: number;
  pendingPayments: number;
  thisMonthEarnings: number;
  lastMonthEarnings: number;
}

interface EarningsData {
  summary: EarningsSummary;
  payments: (Payment & { appointment?: AppointmentWithDetails })[];
  cancellationCharges: { count: number; totalOwed: number };
}

export default function DoctorEarnings() {
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPeriod, setFilterPeriod] = useState<string>("all");
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [atBottom, setAtBottom] = useState(false);

  // Export Modal States
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportType, setExportType] = useState<"earnings" | "appointments" | "all">("all");
  const [exportFormat, setExportFormat] = useState<"csv" | "json">("csv");
  const [exportDateRange, setExportDateRange] = useState("all_time");

  // Custom Date Range States
  const [customStartDate, setCustomStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [customEndDate, setCustomEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  
  useEffect(() => {
    const container = document.querySelector("main");
    if (!container) return;
    const onScroll = () => {
      const scrolled = container.scrollTop;
      const total = container.scrollHeight - container.clientHeight;
      setShowScrollBtn(scrolled > 300);
      setAtBottom(total > 0 && scrolled >= total - 50);
    };
    container.addEventListener("scroll", onScroll);
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  const { data, isLoading, isError } = useQuery<EarningsData>({
    queryKey: ["/api/doctor/earnings"],
    staleTime: 2 * 60 * 1000,
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      let start = customStartDate;
      let end = customEndDate;
      const today = new Date();

      // Add the "all_time" condition here
      if (exportDateRange === "all_time") {
        start = "2020-01-01"; // Set a past date to cover everything
        end = format(today, "yyyy-MM-dd");
      } else if (exportDateRange === "this_month") {
        start = format(startOfMonth(today), "yyyy-MM-dd");
        end = format(endOfMonth(today), "yyyy-MM-dd");
      } else if (exportDateRange === "last_month") {
        const lastMonth = subMonths(today, 1);
        start = format(startOfMonth(lastMonth), "yyyy-MM-dd");
        end = format(endOfMonth(lastMonth), "yyyy-MM-dd");
      }

      const res = await fetch("/api/doctor/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          startDate: start,
          endDate: end,
          reportType: exportType,
          format: exportFormat
        }),
      });

      if (!res.ok) throw new Error("Export failed");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `AyurPath_Report_${start}_to_${end}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    },
    onSuccess: () => {
      toast({ title: "Report downloaded successfully!" });
      setIsExportOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to generate report", variant: "destructive" });
    }
  });

  const formatFee = (fee: number) => {
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
      minimumFractionDigits: 0,
    }).format(fee);
  };

  const summary = data?.summary || {
    totalEarnings: 0,
    pendingEarnings: 0,
    completedPayments: 0,
    pendingPayments: 0,
    thisMonthEarnings: 0,
    lastMonthEarnings: 0,
  };

  const payments = data?.payments || [];

  const monthlyGrowth = summary.lastMonthEarnings > 0
    ? ((summary.thisMonthEarnings - summary.lastMonthEarnings) / summary.lastMonthEarnings) * 100
    : 0;

  const filteredPayments = payments.filter(payment => {
    if (filterStatus !== "all" && payment.status !== filterStatus) {
      return false;
    }
    if (filterPeriod !== "all") {
      const paymentDate = parseISO(payment.createdAt);
      const now = new Date();
      if (filterPeriod === "today") {
        if (format(paymentDate, "yyyy-MM-dd") !== format(now, "yyyy-MM-dd")) {
          return false;
        }
      } else if (filterPeriod === "week") {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        if (paymentDate < weekAgo) return false;
      } else if (filterPeriod === "month") {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        if (paymentDate < monthAgo) return false;
      }
    }
    return true;
  });

  if (isLoading) {
    return <LoadingPage message="Loading earnings..." />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">Failed to load earnings. Please try again.</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold" data-testid="text-page-title">
            Earnings
          </h1>
          <p className="text-muted-foreground">
            Track your income and payment history
          </p>
        </div>
        <Button onClick={() => setIsExportOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/20 border-green-200 dark:border-green-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 dark:text-green-400">Total Earnings</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {formatFee(summary.totalEarnings)}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">
                  {summary.completedPayments} completed
                </p>
              </div>
              <DollarSign className="h-10 w-10 text-green-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20 border-amber-200 dark:border-amber-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-600 dark:text-amber-400">Pending</p>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                  {formatFee(summary.pendingEarnings)}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {summary.pendingPayments} payments
                </p>
              </div>
              <Clock className="h-10 w-10 text-amber-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200 dark:border-blue-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 dark:text-blue-400">This Month</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {formatFee(summary.thisMonthEarnings)}
                </p>
                <div className="flex items-center gap-1 text-xs">
                  {monthlyGrowth >= 0 ? (
                    <>
                      <ArrowUpRight className="h-3 w-3 text-green-500" />
                      <span className="text-green-600">+{monthlyGrowth.toFixed(1)}%</span>
                    </>
                  ) : (
                    <>
                      <ArrowDownRight className="h-3 w-3 text-red-500" />
                      <span className="text-red-600">{monthlyGrowth.toFixed(1)}%</span>
                    </>
                  )}
                  <span className="text-muted-foreground">vs last month</span>
                </div>
              </div>
              <TrendingUp className="h-10 w-10 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20 border-purple-200 dark:border-purple-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 dark:text-purple-400">Last Month</p>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  {formatFee(summary.lastMonthEarnings)}
                </p>
                <p className="text-xs text-purple-600 dark:text-purple-400">
                  Reference period
                </p>
              </div>
              <Calendar className="h-10 w-10 text-purple-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Payment History</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={filterPeriod} onValueChange={setFilterPeriod}>
              <SelectTrigger className="w-[130px]" data-testid="filter-period">
                <Calendar className="h-4 w-4 mr-1" />
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[130px]" data-testid="filter-status">
                <Filter className="h-4 w-4 mr-1" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredPayments.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Consultation</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Your Earnings</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment) => (
                    <TableRow key={payment.id} data-testid={`row-payment-${payment.id}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {format(parseISO(payment.createdAt), "MMM d, yyyy")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(payment.createdAt), "h:mm a")}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {payment.appointment?.patient?.fullName || "Unknown"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {payment.appointment?.consultationType === "online" ? "Online" : "In Person"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatFee(payment.totalAmount)}
                      </TableCell>
                      <TableCell className="font-semibold text-green-600">
                        {formatFee(payment.doctorEarnings)}
                      </TableCell>
                      <TableCell className="align-middle">
                        <StatusBadge status={payment.status} type="payment" className="inline-flex items-center justify-center h-6 w-20" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                {filterStatus !== "all" || filterPeriod !== "all"
                  ? "No payments match your filters"
                  : "No payment history yet"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Consultation Fees</span>
                <span className="font-medium">
                  {formatFee(payments.reduce((sum, p) => sum + p.consultationFee, 0))}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Platform Commission (10%)</span>
                <span className="font-medium text-red-500">
                  -{formatFee(payments.reduce((sum, p) => sum + (p.platformCommission || 0), 0))}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax (4%)</span>
                <span className="font-medium text-red-500">
                  -{formatFee(payments.reduce((sum, p) => sum + p.consultationFee, 0) * 0.04)}
                </span>
              </div>
              <hr />
              <div className="flex justify-between font-semibold">
                <span>Net Earnings</span>
                <span className="text-green-600">
                  {formatFee(summary.totalEarnings)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Payment Methods
            </CardTitle>
            <span className="text-xs text-muted-foreground font-normal">1 method</span>
          </CardHeader>
          <CardContent className="space-y-3">
            {(() => {
              const onlineCount = payments.filter(p => p.method === "online").length;
              const onlineAmount = payments
                .filter(p => p.method === "online")
                .reduce((sum, p) => sum + p.doctorEarnings, 0);
              return (
                <div className="flex items-center justify-between rounded-lg border-2 border-green-400 bg-green-50 dark:bg-green-950/20 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700 dark:text-green-400">Online</span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-700 dark:text-green-400">{formatFee(onlineAmount)}</p>
                    <p className="text-xs text-green-600 dark:text-green-500">{onlineCount} payments</p>
                  </div>
                </div>
              );
            })()}
            <p className="text-xs text-muted-foreground pt-1">
              All consultations this month were processed through online payments.
            </p>
          </CardContent>
        </Card>
      </div>

      {showScrollBtn && (
        <button
          onClick={() => {
            const container = document.querySelector("main");
            if (!container) return;
            container.scrollTo({ top: atBottom ? 0 : container.scrollHeight, behavior: "smooth" });
          }}
          className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-lg flex items-center justify-center transition-all"
          aria-label={atBottom ? "Scroll to top" : "Scroll to bottom"}
        >
          {atBottom ? <ArrowUp className="h-5 w-5" /> : <ArrowDown className="h-5 w-5" />}
        </button>
      )}

      <Modal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        title="Export Data Report"
        description="Download your earnings and appointment history for your personal records."
        icon={<Download className="w-6 h-6 text-emerald-600" />}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsExportOpen(false)}>Cancel</Button>
            <Button onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {exportMutation.isPending ? <LoadingSpinner size="sm" className="mr-2" /> : <Download className="w-4 h-4 mr-2" />}
              {exportMutation.isPending ? "Generating..." : "Download File"}
            </Button>
          </>
        }
      >
        <div className="space-y-5 py-2">
          
          {/* Data to Include */}
          <div className="space-y-2">
            <Label className="text-foreground font-semibold">Data to Include</Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                className={`flex flex-col items-center justify-center p-3 rounded-lg border text-sm transition-colors ${exportType === "all" ? "bg-emerald-50 border-emerald-500 text-emerald-700" : "bg-card hover:bg-muted"}`}
                onClick={() => setExportType("all")}
              >
                <FileText className="w-5 h-5 mb-1 opacity-80" /> All Data
              </button>
              <button
                className={`flex flex-col items-center justify-center p-3 rounded-lg border text-sm transition-colors ${exportType === "earnings" ? "bg-emerald-50 border-emerald-500 text-emerald-700" : "bg-card hover:bg-muted"}`}
                onClick={() => setExportType("earnings")}
              >
                <DollarSign className="w-5 h-5 mb-1 opacity-80" /> Earnings
              </button>
              <button
                className={`flex flex-col items-center justify-center p-3 rounded-lg border text-sm transition-colors ${exportType === "appointments" ? "bg-emerald-50 border-emerald-500 text-emerald-700" : "bg-card hover:bg-muted"}`}
                onClick={() => setExportType("appointments")}
              >
                <CalendarDays className="w-5 h-5 mb-1 opacity-80" /> Appointments
              </button>
            </div>
          </div>

          {/* Date Range */}
          <div className="space-y-3 border-t pt-4">
            <Label className="text-foreground font-semibold">Date Range</Label>
            <Select value={exportDateRange} onValueChange={setExportDateRange}>
              <SelectTrigger>
                <SelectValue placeholder="Select date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_time">All Time</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="last_month">Last Month</SelectItem>
                <SelectItem value="custom">Custom Date Range</SelectItem>
              </SelectContent>
            </Select>

            {exportDateRange === "custom" && (
              <div className="grid grid-cols-2 gap-3 pt-2 animate-in slide-in-from-top-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Start Date</Label>
                  <Input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} max={customEndDate} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">End Date</Label>
                  <Input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} min={customStartDate} max={format(new Date(), "yyyy-MM-dd")} />
                </div>
              </div>
            )}
          </div>

          {/* File Format */}
          <div className="space-y-2 border-t pt-4">
            <Label className="text-foreground font-semibold">File Format</Label>
            <div className="flex gap-2">
              <button
                className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg border text-sm transition-colors ${exportFormat === "csv" ? "bg-emerald-50 border-emerald-500 text-emerald-700" : "bg-card hover:bg-muted"}`}
                onClick={() => setExportFormat("csv")}
              >
                <FileText className="w-4 h-4" /> CSV (Excel)
              </button>
              <button
                className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg border text-sm transition-colors ${exportFormat === "json" ? "bg-emerald-50 border-emerald-500 text-emerald-700" : "bg-card hover:bg-muted"}`}
                onClick={() => setExportFormat("json")}
              >
                <FileJson className="w-4 h-4" /> JSON Data
              </button>
            </div>
            <p className="text-xs text-muted-foreground text-center pt-1">CSV format is highly recommended for opening in Microsoft Excel or Google Sheets.</p>
          </div>

        </div>
      </Modal>
    </div>
  );
}
