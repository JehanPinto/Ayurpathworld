import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Download,
  AlertTriangle,
  DollarSign,
  Landmark,
  CheckCircle2,
  Loader2,
  User,
  Search,
  Filter,
  Building2,
  CreditCard,
  Clock,
  Laptop,
  Users,
  Eye,
  X,
  Activity,
  Info,
  Hourglass,
  CheckSquare
} from "lucide-react";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingPage } from "@/components/ui/loading-spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function DoctorEarnings() {
  const { toast } = useToast();
  
  // Modals & States
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [showAlert, setShowAlert] = useState(true);
  
  // Details Modal State
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  
  // Pagination & Filters
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedDay, setSelectedDay] = useState<string>("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["/api/doctor/earnings/advanced", currentPage, debouncedSearch, selectedYear, selectedMonth, selectedDay],
    queryFn: async () => {
      const params = new URLSearchParams({ page: currentPage.toString(), limit: "10" });
      if (debouncedSearch) params.append("search", debouncedSearch);
      if (selectedYear !== "all") params.append("year", selectedYear);
      if (selectedMonth !== "all") params.append("month", selectedMonth);
      if (selectedDay !== "all") params.append("day", selectedDay);

      const res = await fetch(`/api/doctor/earnings/advanced?${params.toString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    }
  });

  const { data: settings } = useQuery<any>({
    queryKey: ["/api/booking-settings"],
    queryFn: async () => {
      const res = await fetch("/api/booking-settings");
      if (!res.ok) throw new Error("Failed to load settings");
      return res.json();
    }
  });

  const requestPayoutMutation = useMutation({
    mutationFn: (amount: number) => apiRequest("POST", "/api/doctor/payouts/request", { amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctor/earnings/advanced"] });
      toast({ title: "Payout Requested Successfully", description: "Funds will be transferred to your bank account." });
      setIsWithdrawModalOpen(false);
      setWithdrawAmount("");
    },
    onError: (err: any) => {
      toast({ title: "Failed to request payout", description: err.message, variant: "destructive" });
    }
  });

  useEffect(() => {
    if (data?.stats?.cancellationsCount > 0) setShowAlert(true);
  }, [data?.stats?.cancellationsCount]);

  if (isLoading && !data) return <LoadingPage message="Loading financial data..." />;

  const formatLKR = (num: number) => new Intl.NumberFormat("en-LK", { maximumFractionDigits: 0 }).format(num || 0);

  const stats = data?.stats || {};
  const breakdown = data?.breakdown || {};
  const chartData = data?.chartData || [];
  const historyData = data?.history?.data || [];
  const totalPages = data?.history?.totalPages || 1;

  const today = new Date();
  const currentDay = today.getDate();
  const autoPayoutDay = settings?.autoPayoutDay || 1;

  let daysUntilPayout = 0;
  if (currentDay < autoPayoutDay) {
      daysUntilPayout = autoPayoutDay - currentDay;
  } else if (currentDay > autoPayoutDay) {
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, autoPayoutDay);
      const diffTime = Math.abs(nextMonth.getTime() - today.getTime());
      daysUntilPayout = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  let earlyFeePercentage = 0;
  if (daysUntilPayout === 0) {
      earlyFeePercentage = 0;
  } else if (daysUntilPayout <= 7) {
      earlyFeePercentage = settings?.earlyPayoutFee7Days || 1;
  } else if (daysUntilPayout <= 14) {
      earlyFeePercentage = settings?.earlyPayoutFee14Days || 3;
  } else {
      earlyFeePercentage = settings?.earlyPayoutFee21Days || 5;
  }

  const isFreePayout = daysUntilPayout === 0;
  const amountToWithdraw = parseInt(withdrawAmount) || 0;
  const calculatedFee = isFreePayout ? 0 : Math.round((amountToWithdraw * earlyFeePercentage) / 100);
  const finalNet = amountToWithdraw - calculatedFee;

  const handleWithdrawSubmit = () => {
    if (amountToWithdraw <= 0) return toast({ title: "Invalid amount", variant: "destructive" });
    if (amountToWithdraw > stats.withdrawableBalance) return toast({ title: "Exceeds available balance", variant: "destructive" });
    requestPayoutMutation.mutate(amountToWithdraw);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    // UI Constraint: Prevent typing more than the withdrawable balance
    if (Number(val) > stats.withdrawableBalance) {
      val = stats.withdrawableBalance.toString();
    }
    setWithdrawAmount(val);
  };

  const handleViewDetails = (record: any) => {
    setSelectedRecord(record);
    setIsDetailsModalOpen(true);
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const months = Array.from({ length: 12 }, (_, i) => ({ value: (i + 1).toString().padStart(2, '0'), label: format(new Date(2000, i, 1), 'MMMM') }));
  const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, '0'));

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-10">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Earnings</h1>
          <p className="text-muted-foreground text-sm mt-1">Track your income, withdrawals, and patient payment history</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => setIsWithdrawModalOpen(true)} className="bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-full shadow-sm font-bold">
            <Landmark className="w-4 h-4 mr-2" /> Withdraw Funds
          </Button>
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-sm font-bold">
            Export Report <Download className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>

      {/* DISMISSABLE ALERT BOX */}
      {showAlert && stats.cancellationsCount > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-4 md:p-5 flex items-center justify-between gap-4 relative">
          <button onClick={() => setShowAlert(false)} className="absolute top-3 right-3 text-destructive hover:bg-destructive/20 p-1 rounded-full transition-colors">
            <X className="w-4 h-4" />
          </button>
          <div className="flex gap-3 items-start">
            <AlertTriangle className="w-6 h-6 text-destructive shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-destructive">Cancellation Fees Deducted</h3>
              <p className="text-sm text-destructive/80 mt-0.5">These charges have already been deducted from your Withdrawable Balance.</p>
            </div>
          </div>
          <div className="flex items-center gap-8 shrink-0 pr-6">
            <div className="text-center hidden sm:block">
              <span className="text-3xl font-black text-destructive leading-none">{stats.cancellationsCount < 10 ? `0${stats.cancellationsCount}` : stats.cancellationsCount}</span>
              <p className="text-[11px] font-bold text-destructive/70 uppercase tracking-widest mt-1">Cancellations</p>
            </div>
            <div className="text-right">
              <span className="text-2xl md:text-3xl font-black text-destructive leading-none">LKR {formatLKR(stats.cancellationDeducted)}</span>
              <p className="text-[11px] font-bold text-destructive/70 uppercase tracking-widest mt-1">Deducted</p>
            </div>
          </div>
        </div>
      )}

      {/* TOP 4 CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Profit / Withdrawable */}
        <Card className="border-primary/20 shadow-sm rounded-3xl overflow-hidden hover:shadow-md transition-all bg-gradient-to-br from-primary/10 to-transparent">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 shrink-0">
              <DollarSign className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Available Profit</p>
              <h2 className="text-2xl font-black text-foreground">LKR {formatLKR(stats.withdrawableBalance)}</h2>
              <p className="text-[10px] font-bold text-primary/80 mt-1">Ready to withdraw</p>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: This Month Net */}
        <Card className="border-border shadow-sm rounded-3xl overflow-hidden hover:shadow-md transition-all bg-card">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center border border-accent/50 shrink-0">
              <Clock className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">This Month Net</p>
              <h2 className="text-2xl font-black text-foreground">LKR {formatLKR(stats.thisMonthNet)}</h2>
              <p className="text-[10px] font-bold text-muted-foreground mt-1">Current month earnings</p>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: In Person Lifetime */}
        <Card className="border-border shadow-sm rounded-3xl overflow-hidden hover:shadow-md transition-all bg-card">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center border border-accent/50 shrink-0">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">In-Person Net</p>
              <h2 className="text-2xl font-black text-foreground">LKR {formatLKR(stats.inPersonNet)}</h2>
              <p className="text-[10px] font-bold text-muted-foreground mt-1">Lifetime generated</p>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Online Lifetime */}
        <Card className="border-border shadow-sm rounded-3xl overflow-hidden hover:shadow-md transition-all bg-card">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center border border-accent/50 shrink-0">
              <Laptop className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Online Net</p>
              <h2 className="text-2xl font-black text-foreground">LKR {formatLKR(stats.onlineNet)}</h2>
              <p className="text-[10px] font-bold text-muted-foreground mt-1">Lifetime generated</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Pending Withdrawals */}
        <Card className="border-border shadow-sm rounded-3xl overflow-hidden hover:shadow-md transition-all bg-card">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center border border-secondary/20 shrink-0">
              <Hourglass className="w-6 h-6 text-secondary" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Pending Withdrawals</p>
              <h2 className="text-2xl font-black text-foreground">LKR {formatLKR(stats.pendingPayouts)}</h2>
              <p className="text-[10px] font-bold text-secondary mt-1">Processing bank transfers</p>
            </div>
          </CardContent>
        </Card>

        {/* Completed Withdrawals */}
        <Card className="border-border shadow-sm rounded-3xl overflow-hidden hover:shadow-md transition-all bg-card">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
              <CheckSquare className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Completed Withdrawals</p>
              <h2 className="text-2xl font-black text-foreground">LKR {formatLKR(stats.completedPayoutsLifetime)}</h2>
              <p className="text-[10px] font-bold text-primary mt-1">LKR {formatLKR(stats.completedPayoutsThisMonth)} withdrawn this month</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* MIDDLE SECTION: BREAKDOWN & ANALYTICS CHART */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Breakdown Card */}
        <Card className="border-border rounded-3xl shadow-sm bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold">Current Month Breakdown</CardTitle>
            <p className="text-sm text-muted-foreground">Earnings calculation for {format(new Date(), "MMMM yyyy")}</p>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="flex justify-between text-sm font-medium">
              <span className="text-foreground">Gross Consultation Fees</span>
              <span className="font-bold">LKR {formatLKR(breakdown.gross)}</span>
            </div>
            <div className="flex justify-between text-sm text-destructive font-medium">
              <span>Platform Fee Deducted</span>
              <span>-LKR {formatLKR(breakdown.platformFee)}</span>
            </div>
            <div className="flex justify-between text-sm text-destructive font-medium">
              <span>Tax & Levies Deducted</span>
              <span>-LKR {formatLKR(breakdown.tax)}</span>
            </div>
            <div className="flex justify-between text-sm text-destructive font-medium border-b border-border pb-4">
              <span>Cancellation Penalties (This Month)</span>
              <span>-LKR {formatLKR(breakdown.cancellationFee)}</span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="font-bold text-foreground">Total Net Earnings</span>
              <span className="font-black text-xl text-primary">LKR {formatLKR(breakdown.net)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Analytics Bar Chart Card */}
        <Card className="border-border rounded-3xl shadow-sm bg-card flex flex-col">
          <CardHeader className="pb-0 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold">Earnings Analytics</CardTitle>
              <p className="text-sm text-muted-foreground">Net profit over the last 6 months</p>
            </div>
            <Button variant="outline" size="sm" className="rounded-full text-xs font-semibold h-8 border-border hover:bg-accent" onClick={() => toast({title: "Analytics Page", description: "Detailed reports coming soon!"})}>
              <Activity className="w-3.5 h-3.5 mr-1" /> More Analytics
            </Button>
          </CardHeader>
          <CardContent className="pt-6 flex-1 min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} dy={10} />
                <Tooltip 
                  cursor={{ fill: "hsl(var(--muted)/0.4)" }}
                  contentStyle={{ backgroundColor: "hsl(var(--card))", borderRadius: "12px", border: "1px solid hsl(var(--border))", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontWeight: "bold", color: "hsl(var(--foreground))" }}
                  formatter={(value: number) => [`LKR ${formatLKR(value)}`, "Net Earnings"]}
                />
                <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* FILTER CONTROLS */}
      <div className="bg-card border border-border p-4 rounded-3xl shadow-sm flex flex-col lg:flex-row gap-5 justify-between items-start lg:items-center">
        
        {/* Search Box */}
        <div className="relative w-full lg:max-w-[350px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search IDs, Patient Names, Email..." 
            className="pl-9 pr-10 bg-background border-border rounded-full h-10 w-full focus-visible:ring-primary"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
          {/* Clear Button (X) */}
          {searchQuery && (
            <X 
              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer hover:text-destructive transition-colors" 
              onClick={() => { 
                setSearchQuery(""); 
                setDebouncedSearch("");
                setCurrentPage(1); 
              }}
            />
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground whitespace-nowrap">
            <Filter className="w-4 h-4" /> Filter By:
          </div>
          
          {/* Mobile Grid / Desktop Flex */}
          <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 w-full sm:w-auto">
            <Select value={selectedYear} onValueChange={(val) => { setSelectedYear(val); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-[110px] h-10 rounded-full bg-background"><SelectValue placeholder="Year" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={selectedMonth} onValueChange={(val) => { setSelectedMonth(val); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-[130px] h-10 rounded-full bg-background"><SelectValue placeholder="Month" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={selectedDay} onValueChange={(val) => { setSelectedDay(val); setCurrentPage(1); }}>
              <SelectTrigger className="col-span-2 sm:col-span-1 w-full sm:w-[110px] h-10 rounded-full bg-background"><SelectValue placeholder="Day" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Days</SelectItem>
                {days.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

      </div>

      {/* PATIENT PAYMENTS TABLE */}
      <Card className="border-border rounded-3xl shadow-sm overflow-hidden bg-card relative">
        {isFetching && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}
        <CardHeader className="bg-accent/40 border-b border-border py-4 px-6 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold text-foreground">Detailed Payment Records</CardTitle>
            <p className="text-sm text-muted-foreground">Individual patient payment and deduction records</p>
          </div>
          <Badge variant="outline" className="bg-background border-border text-foreground">Total Results: {data?.history?.totalCount || 0}</Badge>
        </CardHeader>
        <div className="overflow-x-auto w-full">
          <table className="w-full text-xs md:text-sm text-left">
            <thead className="uppercase bg-muted text-muted-foreground border-b border-border">
              <tr>
                <th className="px-6 py-4 font-bold tracking-wider">Date & Time</th>
                <th className="px-4 py-4 font-bold tracking-wider">Patient Details</th>
                <th className="px-4 py-4 font-bold tracking-wider text-center hidden md:table-cell">Type</th>
                <th className="px-4 py-4 font-bold tracking-wider text-center hidden md:table-cell">Method</th>
                <th className="px-4 py-4 font-bold tracking-wider text-right">Gross Paid</th>
                <th className="px-6 py-4 font-bold tracking-wider text-right text-primary">Net Earnings</th>
                <th className="px-4 py-4 font-bold tracking-wider text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {historyData.map((row: any, idx: number) => {
                const isFailed = row.status === 'failed' || row.status === 'refunded';
                return (
                  <tr key={idx} className={`hover:bg-accent/50 transition-colors ${isFailed ? 'opacity-60' : ''}`}>
                    
                    {/* Date */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="font-bold text-foreground">{format(new Date(row.date), "MMM dd, yyyy")}</p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5"><Clock className="w-3 h-3"/> {format(new Date(row.date), "h:mm a")}</p>
                    </td>
                    
                    {/* Patient Name & Contact */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="font-semibold text-foreground">{row.patientName || "Unknown"}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground ml-6 truncate max-w-[150px]">{row.patientEmail || row.patientPhone}</p>
                    </td>

                    {/* Consultation Type */}
                    <td className="px-4 py-4 text-center hidden md:table-cell">
                      <Badge variant="outline" className="capitalize text-[10px] font-medium border-border">{row.appointmentType?.replace('_', ' ') || 'N/A'}</Badge>
                    </td>

                    {/* Payment Method & Status */}
                    <td className="px-4 py-4 text-center hidden md:table-cell">
                      <div className="flex flex-col items-center gap-1">
                        <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground capitalize">
                          {row.method === 'online' ? <CreditCard className="w-3 h-3 text-primary" /> : <Building2 className="w-3 h-3 text-secondary" />}
                          {row.method?.replace('_', ' ')}
                        </span>
                        {isFailed && <span className="text-[9px] font-bold text-destructive uppercase tracking-widest">{row.status}</span>}
                      </div>
                    </td>

                    {/* Gross */}
                    <td className={`px-4 py-4 text-right font-semibold whitespace-nowrap ${isFailed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                      LKR {formatLKR(row.grossAmount)}
                    </td>

                    {/* Net Earnings */}
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <span className={`font-black text-base ${isFailed ? 'text-muted-foreground' : 'text-primary'}`}>
                        LKR {isFailed ? '0' : formatLKR(row.netEarnings)}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="px-4 py-4 text-center">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-primary/20 hover:text-primary" onClick={() => handleViewDetails(row)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </td>

                  </tr>
                );
              })}
              
              {historyData.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10">
                    <DollarSign className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground font-medium text-base">No payment records found.</p>
                    <p className="text-sm text-muted-foreground mt-1">Try clearing your search or adjusting the date filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex items-center justify-center pt-2">
        {totalPages > 1 && (
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        )}
      </div>

      {/* DETAILS MODAL */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title="Transaction Details"
        description="Comprehensive view of the appointment and payment record."
      >
        {selectedRecord && (
          <div className="space-y-6 pt-2">
            
            {/* Patient & Appointment Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-accent/50 rounded-xl p-4 border border-border">
                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1"><User className="w-3 h-3"/> Patient Details</h4>
                <p className="font-bold text-foreground text-sm">{selectedRecord.patientName}</p>
                <p className="text-xs text-muted-foreground mt-1">{selectedRecord.patientEmail || "No Email"}</p>
                <p className="text-xs text-muted-foreground">{selectedRecord.patientPhone || "No Phone"}</p>
                <p className="text-xs text-muted-foreground capitalize mt-1">Gender: {selectedRecord.patientGender || "N/A"}</p>
              </div>

              <div className="bg-accent/50 rounded-xl p-4 border border-border">
                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1"><Clock className="w-3 h-3"/> Appointment</h4>
                <p className="font-bold text-foreground text-sm">{selectedRecord.slotDate ? format(new Date(selectedRecord.slotDate), "MMM dd, yyyy") : "N/A"}</p>
                <p className="text-xs text-muted-foreground mt-1">Time: {selectedRecord.slotStartTime || "N/A"}</p>
                <p className="text-xs text-muted-foreground capitalize">Type: {selectedRecord.appointmentType?.replace('_', ' ') || 'N/A'}</p>
                <Badge variant="outline" className="mt-2 text-[10px] capitalize border-border">{selectedRecord.appointmentStatus}</Badge>
              </div>
            </div>

            {/* Symptoms / Reason */}
            <div className="bg-primary/10 rounded-xl p-4 border border-primary/20">
              <h4 className="text-[10px] font-bold text-primary uppercase tracking-wider mb-2">Reason for Visit / Symptoms</h4>
              <p className="text-sm text-foreground leading-relaxed">{selectedRecord.symptoms || "No symptoms provided."}</p>
            </div>

            {/* Financial Breakdown */}
            <div>
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3 border-b border-border pb-2">Financial Breakdown</h4>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Gross Amount Paid</span>
                  <span className="font-bold">LKR {formatLKR(selectedRecord.grossAmount)}</span>
                </div>
                <div className="flex justify-between text-sm text-destructive">
                  <span>Platform Fee Deduction</span>
                  <span>-LKR {formatLKR(selectedRecord.platformFee)}</span>
                </div>
                <div className="flex justify-between text-sm text-destructive border-b border-border/50 pb-3">
                  <span>Tax & Levies Deduction</span>
                  <span>-LKR {formatLKR(selectedRecord.tax)}</span>
                </div>
                <div className="flex justify-between text-base pt-1">
                  <span className="font-bold text-foreground">Doctor's Net Earning</span>
                  <span className="font-black text-primary">LKR {formatLKR(selectedRecord.netEarnings)}</span>
                </div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground text-center pt-2">
              Payment ID: {selectedRecord.id}
            </div>

          </div>
        )}
      </Modal>

      {/* WITHDRAW MODAL */}
      <Modal
        isOpen={isWithdrawModalOpen}
        onClose={() => setIsWithdrawModalOpen(false)}
        title="Request Payout"
        description="Withdraw your available earnings directly to your bank account."
        icon={<Landmark className="w-6 h-6 text-secondary" />}
        footer={
          <>
            <Button variant="outline" className="rounded-full border-border hover:bg-accent" onClick={() => setIsWithdrawModalOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleWithdrawSubmit} 
              disabled={requestPayoutMutation.isPending || !withdrawAmount || parseInt(withdrawAmount) <= 0 || parseInt(withdrawAmount) > stats.withdrawableBalance}
              className="bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-full font-bold px-6"
            >
              {requestPayoutMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Confirm Withdrawal"}
            </Button>
          </>
        }
      >
        <div className="space-y-6 pt-2">
          
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex justify-between items-center">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Available to Withdraw</p>
              <p className="text-2xl font-black text-primary">LKR {formatLKR(stats.withdrawableBalance)}</p>
              {stats.cancellationsCount > 0 && (
                 <p className="text-[10px] font-semibold text-destructive mt-1 leading-tight max-w-[250px]">
                   *After auto-deducting LKR {formatLKR(stats.cancellationDeducted)} for cancellation penalties.
                 </p>
              )}
            </div>
            <Landmark className="w-8 h-8 text-primary/40 shrink-0" />
          </div>

          <div className="space-y-2">
            <Label className="font-bold text-foreground">Enter Amount (LKR) <span className="text-destructive">*</span></Label>
            <Input 
              type="number" 
              value={withdrawAmount}
              onChange={handleAmountChange}
              placeholder="0.00"
              max={stats.withdrawableBalance}
              className="text-lg font-black h-12 bg-background border-border focus-visible:ring-primary"
            />
          </div>

          <div className="bg-accent/50 border border-border rounded-xl p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground font-medium">Requested Amount</span>
              <span className="font-bold text-foreground">LKR {formatLKR(amountToWithdraw)}</span>
            </div>
            
            <div className="flex justify-between text-sm text-destructive">
              <span className="font-medium flex items-center gap-1">
                Express Fee
                {!isFreePayout && <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-destructive/10 text-destructive ml-1 border-destructive/30">{earlyFeePercentage}%</Badge>}
              </span>
              <span className="font-bold">-LKR {formatLKR(calculatedFee)}</span>
            </div>
            
            <div className="flex justify-between text-sm text-muted-foreground border-b border-border/50 pb-3">
              <span className="font-medium flex items-center gap-1">Bank Transfer Fee</span>
              <span className="font-bold text-primary">Covered by Platform</span>
            </div>

            <div className="flex justify-between text-base pt-1">
              <span className="font-bold text-foreground">Net Bank Transfer</span>
              <span className="font-black text-primary">LKR {formatLKR(finalNet > 0 ? finalNet : 0)}</span>
            </div>
          </div>

          {!isFreePayout ? (
            <div className="flex items-start gap-2 text-xs text-secondary-foreground bg-secondary/10 p-3 rounded-lg border border-secondary/20">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <p>Payouts requested <b>{daysUntilPayout} days</b> before the {autoPayoutDay}st are subject to a <b>{earlyFeePercentage}% express fee</b>. Wait until the {autoPayoutDay}st to withdraw for free.</p>
            </div>
          ) : (
            <div className="flex items-start gap-2 text-xs text-primary bg-primary/10 p-3 rounded-lg border border-primary/20">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <p>Today is the {autoPayoutDay}st! Your payout will be processed with <b>0% express fees</b>.</p>
            </div>
          )}

        </div>
      </Modal>

    </div>
  );
}