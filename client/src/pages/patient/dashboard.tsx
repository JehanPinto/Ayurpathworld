import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  Calendar, CheckCircle2, CreditCard, FileClock, ArrowRight,
  Video, Building2, Map, Plus, AlertCircle, Download, FileText, User, 
  ExternalLink, Printer, Receipt, X, Star, MapPin, GraduationCap, Info, Wallet, 
  Stethoscope, Home
} from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LoadingPage } from "@/components/ui/loading-spinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { Modal } from "@/components/ui/modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";

export default function PatientDashboard() {
  const { user } = useAuth();
  
  // Receipt Modal State
  const [selectedTx, setSelectedTx] = useState<any>(null);
  // Doctor Details Modal State
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);

  const { data: dashboardData, isLoading, isError } = useQuery<any>({
    queryKey: ["/api/patient/dashboard"],
    staleTime: 2 * 60 * 1000,
  });

  const formatFee = (fee: number) => {
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
      minimumFractionDigits: 2,
    }).format(fee).replace("LKR", "LKR ");
  };

  const getInitials = (name: string) => {
    if (!name) return "DR";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  // 🟢 Receipt HTML Generation for New Tab / Print
  const generateReceiptHTML = (tx: any) => {
    const txDate = tx.date || tx.createdAt || new Date();
    const dateStr = format(new Date(txDate), "MMM d, yyyy");
    const receiptNo = `INV-${new Date(txDate).getFullYear()}-${(tx.id || "0000").toString().substring(0, 4).toUpperCase()}`;
    const docName = tx.doctorName || tx.doctor?.user?.fullName || "Doctor";
    
    return `
      <html>
        <head>
          <title>Receipt ${receiptNo}</title>
          <style>
            body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #333; margin: 0; padding: 20px; background: #f9fafb; }
            .receipt-container { max-width: 800px; margin: 0 auto; background: #fff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
            .header { background: #0f172a; color: white; padding: 30px; display: flex; justify-content: space-between; align-items: center; }
            .header h1 { margin: 0; font-size: 24px; font-weight: 600; color: #fff; }
            .meta-row { background: #f0fdf4; padding: 15px 30px; display: flex; justify-content: space-between; border-bottom: 1px solid #d1fae5; }
            .meta-box span { display: block; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-bottom: 4px; }
            .meta-box strong { font-size: 16px; color: #022c22; font-weight: 700; }
            .meta-box.right { text-align: right; }
            .meta-box.right strong { color: #059669; }
            .address-row { display: flex; justify-content: space-between; padding: 30px; }
            .address-col { border-left: 3px solid #059669; padding-left: 15px; }
            .address-col span { display: block; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-bottom: 8px; }
            .address-col strong { display: block; font-size: 15px; color: #0f172a; margin-bottom: 4px; }
            .address-col p { margin: 0; font-size: 14px; color: #475569; line-height: 1.5; }
            .table-container { padding: 0 30px; }
            table { width: 100%; border-collapse: collapse; border: 1px solid #a7f3d0; border-radius: 8px; overflow: hidden; }
            th, td { padding: 12px 15px; text-align: left; }
            th { background: #ecfdf5; color: #064e3b; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #a7f3d0; }
            td { font-size: 14px; border-bottom: 1px solid #e2e8f0; }
            th:last-child, td:last-child { text-align: right; }
            .totals { padding: 30px; display: flex; justify-content: flex-end; }
            .totals-content { width: 300px; }
            .total-line { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; color: #475569; }
            .total-line.final { background: #10b981; color: white; padding: 15px; border-radius: 8px; margin-top: 15px; align-items: center; }
            .total-line.final span { text-transform: uppercase; font-size: 12px; font-weight: 600; }
            .total-line.final strong { font-size: 24px; font-weight: 700; }
            .footer-info { padding: 0 30px 30px; font-size: 12px; color: #64748b; }
            .footer { background: #0f172a; color: white; padding: 20px 30px; text-align: center; font-size: 14px; }
            .footer p { margin: 5px 0; color: #94a3b8; font-size: 12px; }
            @media print { body { background: #fff; padding: 0; } .receipt-container { box-shadow: none; } }
          </style>
        </head>
        <body onload="window.print()">
          <div class="receipt-container">
            <div class="header">
              <div><h2 style="margin:0; color:#10b981; display:flex; align-items:center;">AyurPath <span style="font-size:12px; color:#94a3b8; font-weight:normal; margin-left:10px;">Ayurvedic Healthcare Platform</span></h2></div>
              <h1>Official Receipt</h1>
            </div>
            <div class="meta-row">
              <div class="meta-box"><span>Date of Issue</span><strong>${dateStr}</strong></div>
              <div class="meta-box right"><span>Receipt No.</span><strong>${receiptNo}</strong></div>
            </div>
            <div class="address-row">
              <div class="address-col">
                <span>From</span><strong>AyurPath Medical Platform</strong>
                <p>info@ayurvedicdoctor.lk<br/>+94 11 234 5678 | +94 77 123 4567</p>
              </div>
              <div class="address-col">
                <span>Billed To</span><strong>${user?.fullName}</strong>
                <p>Patient<br/>AyurPath Registered Patient</p>
              </div>
            </div>
            <div class="table-container">
              <table>
                <thead><tr><th>Description</th><th>Amount</th></tr></thead>
                <tbody>
                  <tr><td>Ayurvedic Consultation – Dr. ${tx.doctorName}</td><td>${formatFee(tx.consultationFee || 0)}</td></tr>
                  <tr><td>Service & Booking Fee</td><td>${formatFee(tx.bookingCharges || 0)}</td></tr>
                  ${(() => {
                    const items = Array.isArray(tx.taxBreakdown)
                      ? tx.taxBreakdown.filter((t: any) => !(t.kind === "fee" && t.applicableTo === "doctors"))
                      : [];
                    return items.length > 0
                      ? items.map((t: any) => `<tr><td>${t.title}${t.feeType === "amount" ? "" : ` (${t.rate}%)`}</td><td>${formatFee(t.amount)}</td></tr>`).join("")
                      : `<tr><td>Tax</td><td>${formatFee(tx.tax || 0)}</td></tr>`;
                  })()}
                </tbody>
              </table>
            </div>
            <div class="totals">
              <div class="totals-content">
                <div class="total-line"><span>Subtotal:</span><strong>${formatFee((tx.consultationFee || 0) + (tx.bookingCharges || 0))}</strong></div>
                <div class="total-line"><span>Total Tax:</span><strong>${formatFee(tx.tax || 0)}</strong></div>
                <div class="total-line final"><span>Total Paid</span><strong>${formatFee(tx.totalAmount || 0)}</strong></div>
              </div>
            </div>
            <div class="footer-info">
              Payment Method: ${tx.method === 'online' ? 'Online Transfer' : 'Cash' } | Transaction Ref: TXN-${tx.id.substring(0,8).toUpperCase()}<br/>
              <br/>This receipt is computer-generated and is valid without a physical signature.
            </div>
            <div class="footer">
              <strong>Thank you for choosing AyurPath Ayurvedic Healthcare Platform</strong>
              <p>info@ayurvedicdoctor.lk | +94 11 234 5678 | +94 77 123 4567</p>
            </div>
          </div>
        </body>
      </html>
    `;
  };

  const handleOpenNewTab = (tx: any) => {
    const newWindow = window.open();
    if (newWindow) {
      newWindow.document.write(generateReceiptHTML(tx));
      newWindow.document.close();
    }
  };

  if (isLoading) return <LoadingPage message="Loading dashboard..." />;

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">Failed to load dashboard. Please try again.</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  const { stats, upcomingAppointments = [], myDoctors = [], recentTransactions = [] } = dashboardData || {};

  return (
    <div className="space-y-6">
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-extrabold text-foreground tracking-tight">
            Welcome back, {user?.fullName?.split(" ")[0]}!
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">
            Easily find doctors, manage your bookings and payment history.
          </p>
        </div>
        <Link href="/patient/find-doctors">
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm px-6 h-11 w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" /> Book New Appointment
          </Button>
        </Link>
      </div>

      {/* Stats Cards (Responsive & Dark Mode Supported) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-primary/50 shadow-sm rounded-2xl bg-transparent">
          <CardContent className="p-4 sm:p-5 flex flex-col items-center justify-center text-center relative overflow-hidden">
            <div className="flex items-center gap-2">
              <div className="rounded-full sm:left-3 text-primary/50 border border-primary/50 bg-primary/10 p-2">
                <Calendar className="w-4 h-4 sm:w-6 sm:h-6" />
              </div>
              <h2 className="text-sm sm:text-base font-semibold text-foreground">
                Upcoming Appointments
              </h2>
            </div>
            <div className="flex items-baseline gap-1 mt-2 z-10">
              <span className="text-3xl sm:text-4xl font-extrabold text-foreground">{stats?.upcomingAppointments || 0}</span>
              <span className="text-xs sm:text-sm font-medium text-muted-foreground">bookings</span>
            </div>
            <p className="text-emerald-700 dark:text-emerald-400 font-medium text-xs sm:text-sm mt-2 sm:mt-3 z-10">{stats?.pendingCount || 0} pending</p>
          </CardContent>
        </Card>

        <Card className="border-primary/50 shadow-sm rounded-2xl bg-transparent">
          <CardContent className="p-4 sm:p-5 flex flex-col items-center justify-center text-center relative overflow-hidden">
            <div className="flex items-center gap-2">
              <div className="rounded-full sm:left-3 text-primary/50 border border-primary/50 bg-primary/10 p-2">
                <CheckCircle2 className="w-4 h-4 sm:w-6 sm:h-6" />
              </div>
              <h2 className="text-sm sm:text-base font-semibold text-foreground">
                Completed Appointments
              </h2>
            </div>
            <div className="flex items-baseline gap-1 mt-2 z-10">
              <span className="text-3xl sm:text-4xl font-extrabold text-foreground">{stats?.completedAppointments || 0}</span>
              <span className="text-xs sm:text-sm font-medium text-muted-foreground">sessions</span>
            </div>
            <p className="text-emerald-700 dark:text-emerald-400 font-medium text-xs sm:text-sm mt-2 sm:mt-3 z-10">{stats?.inPersonCompleted || 0} Clinic & {stats?.onlineCompleted || 0} Online</p>
          </CardContent>
        </Card>

        <Card className="border-primary/50 shadow-sm rounded-2xl bg-transparent">
          <CardContent className="p-4 sm:p-5 flex flex-col items-center justify-center text-center relative overflow-hidden">
            <div className="flex items-center gap-2">
              <div className="text-primary/50 border border-primary/50 bg-primary/10 p-2 rounded-full">
                <CreditCard className="w-4 h-4 sm:w-6 sm:h-6" />
              </div>
              <h2 className="text-sm sm:text-base font-semibold text-foreground">
                Total Paid
              </h2>
            </div>
            <div className="flex items-baseline gap-1 mt-2 z-10">
              <span className="text-2xl sm:text-3xl font-extrabold text-foreground">LKR {(stats?.totalPaidAmount || 0).toLocaleString()}</span>
            </div>
            <p className="text-muted-foreground font-medium text-xs sm:text-sm mt-2 sm:mt-3 z-10">Total Paid (LKR)</p>
          </CardContent>
        </Card>

        <Card className="border-primary/50 shadow-sm rounded-2xl bg-transparent">
          <CardContent className="p-4 sm:p-5 flex flex-col items-center justify-center text-center relative overflow-hidden">
            <div className="flex items-center gap-2">  
              <div className="text-primary/50 border border-primary/50 bg-primary/10 p-2 rounded-full">
                <FileClock className="w-4 h-4 sm:w-6 sm:h-6" />
              </div>
              <h2 className="text-sm sm:text-base font-semibold text-foreground">
                Refund Requests
              </h2>
            </div>
            <div className="flex items-baseline gap-1 mt-2 z-10">
              <span className="text-3xl sm:text-4xl font-extrabold text-foreground">{stats?.refundPendingCount || 0}</span>
              <span className="text-xs sm:text-sm font-medium text-muted-foreground">Pending</span>
            </div>
            <p className="text-muted-foreground font-medium text-xs sm:text-sm mt-2 sm:mt-3 z-10">Action may be required</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area */}
      <div className="grid lg:grid-cols-3 gap-6">
        
        {/* Left Column: Upcoming Appointments */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-emerald-100 dark:border-emerald-900/30 shadow-sm rounded-2xl bg-card overflow-hidden">
            <div className="flex items-center justify-between p-4 sm:p-5 bg-emerald-50/50 dark:bg-emerald-900/20 border-b border-emerald-100 dark:border-emerald-900/30">
              <h3 className="font-bold text-base sm:text-lg flex items-center gap-2 text-emerald-950 dark:text-emerald-100">
                <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-500" /> Upcoming Appointments
              </h3>
              <Link href="/patient/appointments">
                <Button variant="ghost" size="sm" className="text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 font-semibold p-0 px-2 h-auto">
                  View All <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
            
            <CardContent className="p-4 sm:p-5">
              {upcomingAppointments.length > 0 ? (
                <div className="space-y-4">
                  {upcomingAppointments.map((appointment: any) => {
                    const docName = appointment.doctor?.user?.fullName;
                    const dateObj = new Date(appointment.appointmentDate);
                    const formattedDate = format(dateObj, "MMM dd");
                    const isOnline = appointment.consultationType === "online";

                    return (
                      <div key={appointment.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border hover:shadow-md transition-shadow bg-background gap-4">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-12 w-12 border-2 border-emerald-50 dark:border-emerald-900/30 shrink-0">
                            <AvatarImage src={appointment.doctor?.user?.profileImage} />
                            <AvatarFallback className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold">
                              {getInitials(docName)}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div>
                            <h4 className="font-bold text-foreground text-sm sm:text-base">Dr. {docName}</h4>
                            <div className="flex items-center gap-2 mt-1 text-xs sm:text-sm text-muted-foreground flex-wrap">
                              <span>{appointment.appointmentTime}</span>
                              <Badge variant="secondary" className={`text-[10px] font-medium uppercase px-2 py-0.5 ${
                                isOnline ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                              }`}>
                                {isOnline ? "Online" : "In Person"}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 mt-2 sm:mt-0">
                          <span className="font-bold text-xs sm:text-sm text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 rounded-md">
                            {formattedDate}
                          </span>
                          {
                            appointment.consultationType === "online" ? (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 h-8 text-xs font-semibold w-full sm:w-auto"
                                onClick={() => {
                                  if (appointment.slot?.meetLink) {
                                    window.open(appointment.slot.meetLink, "_blank", "noopener,noreferrer");
                                  }
                                }}  
                                >
                                <Video className="w-3.5 h-3.5 mr-1.5" /> Join call
                              </Button>
                            ) : (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 h-8 text-xs font-semibold w-full sm:w-auto"
                                onClick={() => {
                                  toast({
                                    title: "Coming Soon",
                                    description: "This feature is currently under development.",
                                    duration: 3000,
                                  });
                                }}
                                >
                                <Map className="w-3.5 h-3.5 mr-1.5" /> View map
                              </Button>
                            )
                          }
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-10 opacity-70">
                  <Calendar className="h-10 w-10 mx-auto text-emerald-200 dark:text-emerald-800 mb-3" />
                  <p className="font-medium text-emerald-800 dark:text-emerald-400">No upcoming appointments</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Doctors & Transactions */}
        <div className="space-y-6">
          
          {/* My Doctors Card */}
          <Card className="border-emerald-100 dark:border-emerald-900/30 shadow-sm rounded-2xl bg-emerald-50/30 dark:bg-emerald-900/5 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-emerald-100 dark:border-emerald-900/30">
              <h3 className="font-bold flex items-center gap-2 text-emerald-950 dark:text-emerald-100 text-sm sm:text-base">
                <User className="w-4 h-4 text-emerald-600 dark:text-emerald-500" /> My Doctors
              </h3>
            </div>
            <CardContent className="p-0">
              <div className="divide-y divide-emerald-50 dark:divide-emerald-900/20">
                {myDoctors.map((doc: any) => (
                  <div key={doc.id} className="flex items-center justify-between p-4 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors">
                    <span className="font-semibold text-xs sm:text-sm truncate mr-2">Dr. {doc.user?.fullName?.split(" ")[0]}</span>
                    <span className="text-[10px] sm:text-xs font-medium text-orange-500 dark:text-orange-400 truncate">{doc.specializations?.[0]?.name || "General"}</span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setSelectedDoctor(doc)}
                      className="h-7 w-7 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 shrink-0 ml-2"
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
                {myDoctors.length === 0 && <p className="text-center text-sm p-4 text-muted-foreground">No doctors visited yet.</p>}
              </div>
            </CardContent>
          </Card>

          {/* Recent Transactions Card */}
          <Card className="border-emerald-100 dark:border-emerald-900/30 shadow-sm rounded-2xl bg-emerald-50/30 dark:bg-emerald-900/5 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-emerald-100 dark:border-emerald-900/30">
              <h3 className="font-bold flex items-center gap-2 text-emerald-950 dark:text-emerald-100 text-sm sm:text-base">
                <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-500" /> Recent Transactions
              </h3>
            </div>
            <CardContent className="p-0">
              <div className="divide-y divide-emerald-50 dark:divide-emerald-900/20">
                {recentTransactions.map((tx: any) => {
                  const dateStr = format(new Date(tx.date), "MMM dd, yyyy");
                  let badgeClass = "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
                  if (tx.status === "pending") badgeClass = "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300";
                  if (tx.status === "refunded") badgeClass = "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";

                  return (
                    <div key={tx.id} className="flex items-center justify-between p-3.5 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors text-[11px] sm:text-xs gap-2">
                      <div className="flex flex-col">
                        <span className="text-muted-foreground">{dateStr}</span>
                        <span className="font-medium truncate max-w-[80px] sm:max-w-[100px]">Dr. {tx.doctorName?.split(" ")[0]}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="flex flex-col items-end">
                          <span className="font-bold">{formatFee(tx.totalAmount || 0)}</span>
                          <Badge className={`${badgeClass} shadow-none px-1.5 py-0 text-[9px] sm:text-[10px] font-semibold capitalize`}>
                            {tx.status || "unknown"}
                          </Badge>
                        </div>
                        {/* Click to open Receipt Modal */}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => setSelectedTx(tx)}
                          className="h-7 w-7 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-md shrink-0"
                          title="View Receipt"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {recentTransactions.length === 0 && <p className="text-center text-sm p-4 text-muted-foreground">No recent transactions.</p>}
              </div>
            </CardContent>
          </Card>

        </div>
      </div>

      {/* ======================================================== */}
      {/* OFFICIAL RECEIPT MODAL */}
      {/* ======================================================== */}
      <Dialog open={!!selectedTx} onOpenChange={(open) => !open && setSelectedTx(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-[#f9fafb] dark:bg-zinc-950 border-0 shadow-2xl rounded-xl">
          {selectedTx && (
            <div className="flex flex-col h-full max-h-[85vh]">
              
              {/* Modal Header Actions */}
              <div className="flex items-center justify-between p-3 sm:p-4 bg-white dark:bg-zinc-900 border-b border-border shrink-0 z-10">
                <DialogTitle className="text-sm font-semibold flex items-center gap-2">
                  <Download className="w-4 h-4 text-emerald-600" /> Transaction Receipt
                </DialogTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => handleOpenNewTab(selectedTx)}>
                    <ExternalLink className="w-3.5 h-3.5" /> New Tab
                  </Button>
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8 gap-1 text-xs" onClick={() => handleOpenNewTab(selectedTx)}>
                    <Printer className="w-3.5 h-3.5" /> Print / PDF
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 w-8 rounded-md" onClick={() => setSelectedTx(null)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Scrollable Receipt Area */}
              <div className="overflow-y-auto p-4 sm:p-8 bg-[#f9fafb] dark:bg-muted-foreground/5">
                
                {/* The Receipt Paper */}
                <div className="max-w-2xl mx-auto bg-white dark:bg-zinc-900 shadow-md border border-border/50 rounded-none sm:rounded-lg overflow-hidden">
                  
                  {/* Receipt Header */}
                  <div className="bg-[#0f172a] text-white p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h2 className="m-0 text-emerald-400 flex items-center text-xl font-bold">
                        AyurPath
                        <span className="text-[10px] sm:text-xs text-slate-400 font-normal ml-2 hidden sm:inline-block">Ayurvedic Healthcare Platform</span>
                      </h2>
                    </div>
                    <h1 className="m-0 text-xl sm:text-2xl font-semibold">Official Receipt</h1>
                  </div>

                  {/* Meta Info Row */}
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 sm:p-6 flex justify-between border-b border-emerald-100 dark:border-emerald-900/50">
                    <div>
                      <span className="block text-[10px] sm:text-xs text-slate-500 uppercase font-semibold mb-1">Date of Issue</span>
                      <strong className="text-sm sm:text-base text-emerald-950 dark:text-emerald-100">{format(new Date(selectedTx.date), "MMM d, yyyy")}</strong>
                    </div>
                    <div className="text-right">
                      <span className="block text-[10px] sm:text-xs text-slate-500 uppercase font-semibold mb-1">Receipt No.</span>
                      <strong className="text-sm sm:text-base text-emerald-600 dark:text-emerald-500">INV-{new Date(selectedTx.date).getFullYear()}-{selectedTx.id.substring(0, 4).toUpperCase()}</strong>
                    </div>
                  </div>

                  {/* Address Row */}
                  <div className="flex flex-col sm:flex-row justify-between p-6 sm:p-8 gap-6 sm:gap-4">
                    <div className="border-l-2 border-emerald-600 pl-3 sm:pl-4">
                      <span className="block text-[10px] sm:text-xs text-slate-500 uppercase font-semibold mb-2">From</span>
                      <strong className="block text-sm sm:text-base text-foreground mb-1">AyurPath Medical Platform</strong>
                      <p className="m-0 text-xs sm:text-sm text-muted-foreground leading-relaxed">info@ayurvedicdoctor.lk<br/>+94 11 234 5678 | +94 77 123 4567</p>
                    </div>
                    <div className="border-l-2 border-emerald-600 pl-3 sm:pl-4">
                      <span className="block text-[10px] sm:text-xs text-slate-500 uppercase font-semibold mb-2">Billed To</span>
                      <strong className="block text-sm sm:text-base text-foreground mb-1">{user?.fullName}</strong>
                      <p className="m-0 text-xs sm:text-sm text-muted-foreground leading-relaxed">Patient<br/>AyurPath Registered Patient</p>
                    </div>
                  </div>

                  {/* Table Area */}
                  <div className="px-4 sm:px-8 pb-4">
                    <div className="border border-emerald-100 dark:border-emerald-900/50 rounded-lg overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-emerald-50 dark:bg-emerald-950/50 border-b border-emerald-100 dark:border-emerald-900/50">
                            <th className="p-3 sm:p-4 text-[10px] sm:text-xs text-emerald-900 dark:text-emerald-300 uppercase font-semibold">Description</th>
                            <th className="p-3 sm:p-4 text-[10px] sm:text-xs text-emerald-900 dark:text-emerald-300 uppercase font-semibold text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-border/50">
                            <td className="p-3 sm:p-4 text-xs sm:text-sm">Ayurvedic Consultation – Dr. {selectedTx.doctorName}</td>
                            <td className="p-3 sm:p-4 text-xs sm:text-sm text-right font-medium">{formatFee(selectedTx.consultationFee || 0)}</td>
                          </tr>
                          <tr className="border-b border-border/50">
                            <td className="p-3 sm:p-4 text-xs sm:text-sm">Service & Booking Fee</td>
                            <td className="p-3 sm:p-4 text-xs sm:text-sm text-right font-medium">{formatFee(selectedTx.bookingCharges || 0)}</td>
                          </tr>
                          {(() => {
                            const items = Array.isArray(selectedTx.taxBreakdown)
                              ? selectedTx.taxBreakdown.filter((t: any) => !(t.kind === "fee" && t.applicableTo === "doctors"))
                              : [];
                            return items.length > 0
                              ? items.map((t: any, i: number) => (
                                  <tr key={i} className="border-b border-border/50 last:border-0">
                                    <td className="p-3 sm:p-4 text-xs sm:text-sm">{t.title}{t.feeType === "amount" ? "" : ` (${t.rate}%)`}</td>
                                    <td className="p-3 sm:p-4 text-xs sm:text-sm text-right font-medium">{formatFee(t.amount)}</td>
                                  </tr>
                                ))
                              : (
                                  <tr>
                                    <td className="p-3 sm:p-4 text-xs sm:text-sm">Tax</td>
                                    <td className="p-3 sm:p-4 text-xs sm:text-sm text-right font-medium">{formatFee(selectedTx.tax || 0)}</td>
                                  </tr>
                                );
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Totals Area */}
                  <div className="p-6 sm:p-8 flex justify-end">
                    <div className="w-full sm:w-[300px]">
                      <div className="flex justify-between mb-2.5 text-xs sm:text-sm text-muted-foreground">
                        <span>Subtotal:</span>
                        <strong className="text-foreground">{formatFee((selectedTx.consultationFee || 0) + (selectedTx.bookingCharges || 0))}</strong>
                      </div>
                      <div className="flex justify-between mb-4 text-xs sm:text-sm text-muted-foreground">
                        <span>Total Tax:</span>
                        <strong className="text-foreground">{formatFee(selectedTx.tax || 0)}</strong>
                      </div>
                      <div className="bg-emerald-500 text-white p-3 sm:p-4 rounded-lg flex items-center justify-between mt-2">
                        <span className="uppercase text-[10px] sm:text-xs font-semibold">Total Paid</span>
                        <strong className="text-lg sm:text-xl font-bold">{formatFee(selectedTx.totalAmount || 0)}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Footer Info */}
                  <div className="px-6 sm:px-8 pb-6 sm:pb-8 text-[10px] sm:text-xs text-muted-foreground">
                    Payment Method: {selectedTx.method === 'online' ? 'Online Transfer' : 'Cash'} | Transaction Ref: TXN-{selectedTx.id.substring(0,8).toUpperCase()}<br/><br/>
                    This receipt is computer-generated and is valid without a physical signature.
                  </div>

                  {/* Bottom Strip */}
                  <div className="bg-[#0f172a] text-white p-4 sm:p-6 text-center">
                    <strong className="block text-xs sm:text-sm mb-1">Thank you for choosing AyurPath Ayurvedic Healthcare Platform</strong>
                    <p className="m-0 text-[10px] sm:text-xs text-slate-400">info@ayurvedicdoctor.lk | +94 11 234 5678 | +94 77 123 4567</p>
                  </div>

                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* DOCTOR INFO MODAL (TABBED UI) */}
      {/* ======================================================== */}
      <Modal 
        isOpen={!!selectedDoctor} 
        onClose={() => setSelectedDoctor(null)}
        title="Doctor Profile"
        description="Detailed information about the doctor."
        icon={<Stethoscope className="w-6 h-6 text-emerald-600 dark:text-emerald-500" />}
        footer={
          <div className="flex justify-between w-full">
            <Button variant="outline" onClick={() => setSelectedDoctor(null)}>Close</Button>
            {selectedDoctor && (
              <Link href={`/doctors/${selectedDoctor.id}`}>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md">
                  Book Appointment <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
        }
      >
        {selectedDoctor && (
          <div className="space-y-6 py-2">
            
            {/* ── Header: Avatar, Name, Rating ── */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
              <Avatar className="h-20 w-20 sm:h-24 sm:w-24 border-4 border-emerald-100 dark:border-emerald-900/50 shadow-sm">
                <AvatarImage src={selectedDoctor.user?.profileImage} />
                <AvatarFallback className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold text-2xl sm:text-3xl">
                  {getInitials(selectedDoctor.user?.fullName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1.5 pt-1">
                <h3 className="font-bold text-xl text-foreground">
                  Dr. {selectedDoctor.user?.fullName}
                </h3>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  {selectedDoctor.specializations?.map((s: any) => (
                    <Badge key={s.id} variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 hover:bg-emerald-100">
                      {s.name}
                    </Badge>
                  ))}
                  {(!selectedDoctor.specializations || selectedDoctor.specializations.length === 0) && (
                    <Badge variant="secondary">General Practitioner</Badge>
                  )}
                </div>
                
                {/* Rating */}
                <div className="flex items-center justify-center sm:justify-start gap-1 pt-1 text-sm font-medium text-amber-500">
                  <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                  <span>{selectedDoctor.averageRating?.toFixed(1) || "New"}</span>
                  <span className="text-muted-foreground ml-1">
                    ({selectedDoctor.totalReviews || 0} Reviews)
                  </span>
                </div>
              </div>
            </div>

            {/* ── Tabs Section ── */}
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 rounded-xl">
                <TabsTrigger value="overview" className="rounded-lg text-xs sm:text-sm"><Info className="h-4 w-4 mr-2 hidden sm:block" /> Overview</TabsTrigger>
                <TabsTrigger value="locations" className="rounded-lg text-xs sm:text-sm"><MapPin className="h-4 w-4 mr-2 hidden sm:block" /> Locations</TabsTrigger>
                <TabsTrigger value="fees" className="rounded-lg text-xs sm:text-sm"><Wallet className="h-4 w-4 mr-2 hidden sm:block" /> Fees & Services</TabsTrigger>
              </TabsList>

              {/* TAB 1: OVERVIEW */}
              <TabsContent value="overview" className="mt-4 space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                
                {/* Biography */}
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <User className="h-4 w-4 text-emerald-600" /> About Doctor
                  </h4>
                  <p className="text-sm text-muted-foreground leading-relaxed bg-muted/30 p-3 rounded-lg border border-border">
                    {selectedDoctor.biography || "No biography provided by the doctor yet."}
                  </p>
                </div>

                {/* Qualifications */}
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-emerald-600" /> Qualifications & Credentials
                  </h4>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="bg-primary/5 p-3 rounded-lg border border-primary/10">
                      <span className="block text-[10px] sm:text-xs text-primary font-bold uppercase mb-1">Degrees / Certifications</span>
                      <span className="text-sm font-medium text-foreground">{selectedDoctor.qualifications || "N/A"}</span>
                    </div>
                    <div className="bg-primary/5 p-3 rounded-lg border border-primary/10">
                      <span className="block text-[10px] sm:text-xs text-primary font-bold uppercase mb-1">SLAMC Registration No.</span>
                      <span className="text-sm font-medium text-foreground">{selectedDoctor.registrationNumber || "N/A"}</span>
                    </div>
                  </div>
                </div>

                {/* Languages */}
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4 text-emerald-600" /> Languages Spoken
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedDoctor.languagesSpoken?.map((lang: string) => (
                      <Badge key={lang} variant="outline" className="capitalize border-border bg-background">
                        {lang}
                      </Badge>
                    )) || <span className="text-sm text-muted-foreground">English</span>}
                  </div>
                </div>
              </TabsContent>

              {/* TAB 2: LOCATIONS */}
              <TabsContent value="locations" className="mt-4 space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                <div className="space-y-3">
                  {/* Hospitals from DB */}
                  {selectedDoctor.hospitals?.map((hosp: any) => (
                    <div key={hosp.id} className="flex items-start gap-3 p-4 rounded-xl border border-border bg-background shadow-sm hover:border-emerald-200 transition-colors">
                      <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400 shrink-0">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm text-foreground truncate">{hosp.name}</h4>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{hosp.address}</p>
                        {hosp.city && <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-1">{hosp.city}</p>}
                      </div>
                    </div>
                  ))}

                  {/* Manual Clinic Locations */}
                  {selectedDoctor.clinic_locations?.map((loc: string, idx: number) => (
                    <div key={idx} className="flex items-start gap-3 p-4 rounded-xl border border-border bg-background shadow-sm hover:border-emerald-200 transition-colors">
                      <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400 shrink-0">
                        <MapPin className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm text-foreground">Private Clinic</h4>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{loc}</p>
                      </div>
                    </div>
                  ))}

                  {/* Empty State */}
                  {(!selectedDoctor.hospitals?.length && !selectedDoctor.clinic_locations?.length) && (
                    <div className="text-center py-8 bg-muted/30 rounded-xl border border-dashed border-border">
                      <MapPin className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-sm font-medium text-muted-foreground">No specific locations listed.</p>
                      <p className="text-xs text-muted-foreground mt-1">Check online availability.</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* TAB 3: FEES & SERVICES */}
              <TabsContent value="fees" className="mt-4 space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                <div className="grid gap-3">
                  
                  {/* In Person */}
                  {selectedDoctor.consultationTypes?.includes("in_person") && (
                    <div className="flex items-center justify-between p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-900/10">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white dark:bg-background rounded-lg shadow-sm">
                          <Building2 className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-foreground">Clinic Consultation</h4>
                          <p className="text-xs text-muted-foreground">In-person visit</p>
                        </div>
                      </div>
                      <span className="font-black text-emerald-700 dark:text-emerald-400">
                        {formatFee(selectedDoctor.consultationFee || 0)}
                      </span>
                    </div>
                  )}

                  {/* Online */}
                  {selectedDoctor.consultationTypes?.includes("online") && (
                    <div className="flex items-center justify-between p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-900/10">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white dark:bg-background rounded-lg shadow-sm">
                          <Video className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-foreground">Video Consultation</h4>
                          <p className="text-xs text-muted-foreground">Online via Google Meet</p>
                        </div>
                      </div>
                      <span className="font-black text-blue-700 dark:text-blue-400">
                        {formatFee(selectedDoctor.onlineConsultationFee || selectedDoctor.consultationFee || 0)}
                      </span>
                    </div>
                  )}

                  {/* Home Visit */}
                  {selectedDoctor.consultationTypes?.includes("home_visit") && (
                    <div className="flex items-center justify-between p-4 rounded-xl border border-purple-100 dark:border-purple-900/30 bg-purple-50/50 dark:bg-purple-900/10">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white dark:bg-background rounded-lg shadow-sm">
                          <Home className="h-4 w-4 text-purple-600" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-foreground">Home Visit</h4>
                          <p className="text-xs text-muted-foreground">Doctor visits your home</p>
                        </div>
                      </div>
                      <span className="font-black text-purple-700 dark:text-purple-400">
                        {formatFee(selectedDoctor.homeVisitFee || 0)}
                      </span>
                    </div>
                  )}

                  <p className="text-[10px] sm:text-xs text-muted-foreground text-center mt-2 flex items-center justify-center gap-1.5">
                    <AlertCircle className="w-3 h-3" />
                    Fees shown above exclude platform booking charges & taxes.
                  </p>
                </div>
              </TabsContent>

            </Tabs>
          </div>
        )}
      </Modal>
    </div>
  );
}