import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { 
  Activity, Search, Filter, ShieldAlert, Printer, Mail, Leaf, 
  Lock, Briefcase, Settings, Calendar as CalendarIcon, X, Clock
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { LoadingPage } from "@/components/ui/loading-spinner";
import { Pagination } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "ALL", label: "All Logs", icon: Activity },
  { id: "AUTH", label: "Authentication", icon: Lock },
  { id: "CAREER", label: "Careers & Apps", icon: Briefcase },
  { id: "SYSTEM", label: "System Setup", icon: Settings },
];

export default function AdminAudit() {
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  // Date and Time states
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const limit = 20;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); 
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/admin/audit-logs", page, activeTab, debouncedSearch, startDate, endDate],
    queryFn: async () => {
      let url = `/api/admin/audit-logs?page=${page}&limit=${limit}&type=${activeTab}`;
      if (debouncedSearch) url += `&search=${encodeURIComponent(debouncedSearch)}`;
      
      // Date and Time Formatting for Backend
      if (startDate) url += `&startDate=${new Date(startDate).toISOString()}`;
      if (endDate) url += `&endDate=${new Date(endDate).toISOString()}`;

      const res = await fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
      if (!res.ok) throw new Error("Failed to fetch logs");
      return res.json();
    },
    staleTime: 30 * 1000,
  });

  const clearFilters = () => {
    setSearchTerm("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const getActionColor = (action: string) => {
    if (action.includes("LOGIN") || action.includes("REGISTER") || action.includes("PASSWORD")) return "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400";
    if (action.includes("CAREER") || action.includes("APPLICATION")) return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400";
    if (action.includes("CANCELLED") || action.includes("FAILED") || action.includes("REJECT") || action.includes("DEACTIVATE") || action.includes("DELETE")) return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400";
    if (action.includes("UPDATED") || action.includes("CONFIRM") || action.includes("RESCHEDULE")) return "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400";
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400";
  };

  const logs = data?.data || [];
  const totalPages = data?.totalPages || 1;

  // ==========================================
  // TIMELINE RENDERERS (Auth, Career, System)
  // ==========================================

  const renderAuthTimeline = () => {
    if (!selectedLog) return null;
    const tl = selectedLog.metadata?.timeline || {};
    const status = selectedLog.status;
    const reason = selectedLog.metadata?.reason;

    const allSteps = [
      { key: "requestReceivedAt", title: "Request Initialized", desc: "User triggered authentication sequence." },
      { key: "emailValidationFailedAt", title: "Email Validation Failed", desc: "Invalid email format provided.", forceFail: true },
      { key: "providerCheckFailedAt", title: "Provider Conflict", desc: "Account registered with a social provider.", forceFail: true },
      { key: "emailNotFoundAt", title: "Email Not Found", desc: "No account linked to this email address.", forceFail: true },
      { key: "limitationchekedAt", title: "Rate Limit Verified", desc: "IP address passed rate limiting." },
      { key: "credentialsVerifiedAt", title: "Credentials Validated", desc: "Security details verified." },
      { key: "userCheckedAt", title: "User Checked", desc: "User existence verified." },
      { key: "providerIdentifiedAt", title: "Provider Matched", desc: "Authentication method confirmed." },
      { key: "doctorProfileCheckedAt", title: "Profile Validated", desc: "Doctor clearance verified." },
      { key: "accountActiveAt", title: "Status Verified", desc: "Account is in good standing." },
      { key: "otpSetAt", title: "OTP Generated", desc: "One-Time Password created securely." },
      { key: "emailSentAt", title: "Email Sent", desc: "Verification email dispatched to user." },
      { key: "emailSendFailedAt", title: "Email Failed", desc: "SMTP service rejected the email.", forceFail: true },
      { key: "validationPasswordAt", title: "Password Rule Failed", desc: "New password does not meet security criteria.", forceFail: true },
      { key: "otpVerificationFailedAt", title: "OTP Verification Failed", desc: "Invalid or expired OTP provided.", forceFail: true },
      { key: "passwordResetAt", title: "Password Reset", desc: "User successfully recovered their account." },
      { key: "registrationCompleteAt", title: "Registration Checked", desc: "Account creation steps are complete." },
      { key: "sessionCreatedAt", title: "Session Activated", desc: `Token issued successfully.` },
      { key: "DoctorStatusCheckedAt", title: "Doctor Clearance", desc: "Doctor status verified." },
      { key: "SuspendedIdentifiedAt", title: "Account Suspended", desc: "System blocked access.", forceFail: true },
      { key: "RejectionIdentifiedAt", title: "Account Rejected", desc: "Application was denied.", forceFail: true },
      { key: "completedAt", title: status === 'success' ? "Process Completed" : "Process Failed", desc: status === 'success' ? "Authentication cycle concluded." : (reason || "Process aborted.") }
    ];

    const activeSteps = allSteps.filter(step => tl[step.key]);
    if(activeSteps.length === 0) return <p className="text-sm text-muted-foreground">Standard Auth Record.</p>;

    return activeSteps.map((step, index) => {
      const isFailedStep = step.forceFail || (index === activeSteps.length - 1 && status === 'failed');
      return (
        <div key={step.key} className="relative">
          <div className={cn("absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full ring-4 ring-background", isFailedStep ? 'bg-destructive' : 'bg-purple-500')} />
          <h4 className={cn("font-bold text-sm", isFailedStep ? "text-destructive" : "text-foreground")}>{step.title}</h4>
          <p className="text-xs text-muted-foreground mt-1">{format(new Date(tl[step.key]), "HH:mm:ss.SSS, MMM dd")}</p>
          <p className={cn("text-xs mt-0.5", isFailedStep ? "text-destructive font-medium" : "text-muted-foreground")}>{step.desc}</p>
        </div>
      );
    });
  };

  const renderCareerTimeline = () => {
    if (!selectedLog) return null;
    const tl = selectedLog.metadata?.timeline || {};
    const status = selectedLog.status;
    const reason = selectedLog.metadata?.reason;

    const allSteps = [
      { key: "requestReceivedAt", title: "Request Received", desc: "Career module triggered." },
      { key: "fileMissingAt", title: "CV Missing", desc: "Applicant did not provide a CV document.", forceFail: true },
      { key: "fieldsMissingAt", title: "Incomplete Data", desc: "Required form fields are missing.", forceFail: true },
      { key: "validationFailedAt", title: "Validation Failed", desc: "Input data schema mismatched.", forceFail: true },
      { key: "careerNotFoundAt", title: "Career Not Found", desc: "The specified job listing no longer exists.", forceFail: true },
      { key: "applicationNotFoundAt", title: "Application Not Found", desc: "Candidate record missing.", forceFail: true },
      { key: "validationSuccessAt", title: "Validation Passed", desc: "Data schema is valid." },
      { key: "deactivationSuccessAt", title: "Career Disabled", desc: "Job listing marked as inactive." },
      { key: "emailSentAt", title: "Email Dispatched", desc: "Candidate notified of status update." },
      { key: "completedAt", title: status === 'success' ? "Process Completed" : "Process Failed", desc: status === 'success' ? "Career operation finalized." : (reason || "Operation aborted.") }
    ];

    const activeSteps = allSteps.filter(step => tl[step.key]);
    if(activeSteps.length === 0) return <p className="text-sm text-muted-foreground">Standard Career Record.</p>;

    return activeSteps.map((step, index) => {
      const isFailedStep = step.forceFail || (index === activeSteps.length - 1 && status === 'failed');
      return (
        <div key={step.key} className="relative">
          <div className={cn("absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full ring-4 ring-background", isFailedStep ? 'bg-destructive' : 'bg-blue-500')} />
          <h4 className={cn("font-bold text-sm", isFailedStep ? "text-destructive" : "text-foreground")}>{step.title}</h4>
          <p className="text-xs text-muted-foreground mt-1">{format(new Date(tl[step.key]), "HH:mm:ss.SSS, MMM dd")}</p>
          <p className={cn("text-xs mt-0.5", isFailedStep ? "text-destructive font-medium" : "text-muted-foreground")}>{step.desc}</p>
        </div>
      );
    });
  };

  const renderSystemTimeline = () => {
    if (!selectedLog) return null;
    const tl = selectedLog.metadata?.timeline || {};
    const status = selectedLog.status;
    const reason = selectedLog.metadata?.reason;

    const allSteps = [
      { key: "requestReceivedAt", title: "Action Requested", desc: "System module received execution request." },
      { key: "validationFailedAt", title: "System Validation Failed", desc: "Provided parameters were invalid.", forceFail: true },
      { key: "completedAt", title: status === 'success' ? "Execute Success" : "Execute Failed", desc: status === 'success' ? "System configuration or module updated." : (reason || "System fault detected.") }
    ];

    const activeSteps = allSteps.filter(step => tl[step.key]);

    if(activeSteps.length === 0) {
      return (
        <div className="relative">
          <div className={cn("absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full ring-4 ring-background", status === 'success' ? 'bg-emerald-500' : 'bg-destructive')} />
          <h4 className={cn("font-bold text-sm", status === 'success' ? "text-foreground" : "text-destructive")}>System Execution</h4>
          <p className="text-xs text-muted-foreground mt-1">{selectedLog.createdAt ? format(new Date(selectedLog.createdAt), "HH:mm:ss.SSS, MMM dd") : ""}</p>
          <p className={cn("text-xs mt-0.5", status === 'success' ? "text-muted-foreground" : "text-destructive font-medium")}>{reason || "Module updated successfully."}</p>
        </div>
      );
    }

    return activeSteps.map((step, index) => {
      const isFailedStep = step.forceFail || (index === activeSteps.length - 1 && status === 'failed');
      return (
        <div key={step.key} className="relative">
          <div className={cn("absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full ring-4 ring-background", isFailedStep ? 'bg-destructive' : 'bg-emerald-500')} />
          <h4 className={cn("font-bold text-sm", isFailedStep ? "text-destructive" : "text-foreground")}>{step.title}</h4>
          <p className="text-xs text-muted-foreground mt-1">{format(new Date(tl[step.key]), "HH:mm:ss.SSS, MMM dd")}</p>
          <p className={cn("text-xs mt-0.5", isFailedStep ? "text-destructive font-medium" : "text-muted-foreground")}>{step.desc}</p>
        </div>
      );
    });
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <Activity className="w-7 h-7 text-primary" />
            System Audit Logs
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor and track all critical system activities and user transactions.
          </p>
        </div>
      </div>

      {/* TABS ROW */}
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <Button
              key={tab.id}
              variant={isActive ? "default" : "outline"}
              onClick={() => { setActiveTab(tab.id); setPage(1); }}
              className={cn("rounded-full px-5 transition-all", isActive ? "shadow-md" : "hover:bg-muted")}
            >
              <Icon className="w-4 h-4 mr-2" />
              {tab.label}
            </Button>
          )
        })}
      </div>

      {/* TOOLBAR (Filters & Search) */}
      <Card className="border-border shadow-sm bg-card/50">
        <CardContent className="p-4 flex flex-col xl:flex-col gap-4 items-end xl:items-center justify-between">
          
          <div className="flex flex-col xl:flex-col xl:w-full items-center gap-4 w-full">
            {/* Search Input */}
            <div className="relative w-full shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search user email, ID or action..." 
                className="pl-9 bg-background h-10 border-border" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            {/* Date & Time Range Pickers */}
            <div className="flex w-full max-sm:flex-col md:flex-col xl:flex-row items-center gap-2">
              <div className="relative p-1 w-full border border-border rounded-md bg-background">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input 
                  type="datetime-local" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)} 
                  className="pl-9 border-0 bg-transparent h-8 text-xs focus-visible:ring-0 focus-visible:ring-offset-0" 
                />
              </div>
              <span className="text-muted-foreground text-xs font-semibold px-1 shrink-0">TO</span>
              <div className="relative p-1 w-full border border-border rounded-md bg-background">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input 
                  type="datetime-local" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)} 
                  className="pl-9 border-0 bg-transparent h-8 text-xs focus-visible:ring-0 focus-visible:ring-offset-0" 
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full justify-end">
            {(searchTerm || startDate || endDate) && (
              <Button variant="ghost" onClick={clearFilters} className="text-muted-foreground hover:text-foreground h-10">
                <X className="w-4 h-4 mr-1.5" /> Clear Filters
              </Button>
            )}
            <Button onClick={() => refetch()} variant="secondary" className="h-10 border border-border font-semibold shadow-sm">
              <Filter className="w-4 h-4 mr-2" /> Apply Filter
            </Button>
          </div>

        </CardContent>
      </Card>

      {/* Data Table */}
      <Card className="border-border shadow-sm overflow-hidden min-h-[400px]">
        {isLoading ? (
          <LoadingPage message="Fetching secure logs..." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-4">#</th>
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4">Actor Details</th>
                  <th className="px-6 py-4">Module Type</th>
                  <th className="px-6 py-4">Action Triggered</th>
                  <th className="px-6 py-4">Final Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.length > 0 ? (
                  logs.map((log: any) => (
                    <tr 
                      key={log.id} 
                      className="hover:bg-muted/20 transition-colors bg-card group"
                      onClick={() => setSelectedLog(log)}
                      style={{ cursor: "pointer" }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-foreground">
                          {format(new Date(log.createdAt), "MMM dd, yyyy")}
                        </div>
                        <div className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
                          {format(new Date(log.createdAt), "hh:mm:ss a")}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-foreground">{log.actorName || "System Process"}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[9px] uppercase text-muted-foreground px-1.5 py-0">{log.actorRole}</Badge>
                          {log.actorEmail && <span className="text-xs text-muted-foreground truncate max-w-[150px]">{log.actorEmail}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                         <Badge variant="secondary" className="text-[10px] uppercase shadow-none bg-muted/50 text-muted-foreground font-bold tracking-wider">
                            {log.metadata?.auditType || "SYSTEM"}
                         </Badge>
                      </td>
                      <td className="px-6 py-4 font-semibold">
                        <Badge className={`${getActionColor(log.action)} shadow-none border-0`}>
                          {log.action.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        {log.status === "success" 
                          ? <span className="flex items-center text-emerald-600 text-xs font-bold"><div className="w-2 h-2 rounded-full bg-emerald-500 mr-2" /> SUCCESS</span>
                          : <span className="flex items-center text-red-600 text-xs font-bold"><div className="w-2 h-2 rounded-full bg-red-500 mr-2" /> {log.status.toUpperCase()}</span>
                        }
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center text-muted-foreground bg-card">
                      <ShieldAlert className="w-12 h-12 mx-auto text-muted/30 mb-4" />
                      <p className="font-medium text-base text-foreground mb-1">No audit logs found</p>
                      <p className="text-sm">Try adjusting your search criteria or date filters.</p>
                      {(searchTerm || startDate || endDate) && (
                        <Button variant="ghost" onClick={clearFilters} className="mt-4 text-primary">Clear all filters</Button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* PAGINATION (New Component) */}
      {!isLoading && totalPages > 1 && (
        <Pagination 
          currentPage={page} 
          totalPages={totalPages} 
          onPageChange={setPage} 
        />
      )}

      {/* DETAILED MODAL VIEW */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="Audit Log Inspector"
        description="Detailed execution and transaction history."
        icon={<ShieldAlert className="w-5 h-5 text-primary" />}
        className="max-w-3xl bg-background border-border"
        footer={
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-6 font-semibold shadow-md transition-all active:scale-95 flex items-center gap-2">
            <Printer className="w-4 h-4" /> Print Record
          </Button>
        }
      >
        <div className="space-y-8">
          
          {/* Top Info Banner */}
          <div className="bg-card text-card-foreground border border-border rounded-xl p-5 relative flex max-md:flex-col items-center gap-5 shadow-sm">
            <div className="absolute top-5 right-5 flex gap-2">
                <div className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase border flex items-center gap-2",
                  selectedLog?.metadata?.auditType === 'AUTH' ? "bg-purple-500/10 border-purple-500/20 text-purple-600" : 
                  selectedLog?.metadata?.auditType === 'CAREER' ? "bg-blue-500/10 border-blue-500/20 text-blue-600" :
                  "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
                )}>
                  {selectedLog?.metadata?.auditType || "SYSTEM"}
                </div>
                
                <div className={cn(
                  "border px-3 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5",
                  selectedLog?.status === 'success' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" : "bg-destructive/10 border-destructive/20 text-destructive"
                )}>
                  <div className={cn("w-1.5 h-1.5 rounded-full", selectedLog?.status === 'success' ? "bg-emerald-500" : "bg-destructive")} />
                  {selectedLog?.status || "UNKNOWN"}
                </div>
            </div>
            
            <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-primary text-2xl font-bold shadow-inner shrink-0 max-md:mt-10">
              {selectedLog?.actorName ? selectedLog.actorName.substring(0, 2).toUpperCase() : "SY"}
            </div>
            
            <div className="overflow-hidden pr-20 max-md:pr-0">
              <h2 className="text-xl font-bold text-foreground truncate">{selectedLog?.actorName || "System Process"}</h2>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                <span className="bg-secondary/80 text-secondary-foreground px-2.5 py-0.5 rounded-md font-medium capitalize border border-secondary/20 shrink-0">
                  {selectedLog?.actorRole || "System"}
                </span>
                {selectedLog?.actorEmail && (
                  <span className="flex items-center gap-1.5 truncate">
                    <Mail className="w-3.5 h-3.5 shrink-0" /> 
                    <span className="truncate">{selectedLog.actorEmail}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Core Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card rounded-xl border border-border p-4 text-center shadow-sm">
              <p className="text-xs font-medium text-muted-foreground mb-1">Event ID</p>
              <p className="font-bold text-foreground text-sm uppercase" title={selectedLog?.id}>
                {selectedLog?.id ? `EVT-${selectedLog.id.substring(0, 5)}` : "N/A"}
              </p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 text-center shadow-sm">
              <p className="text-xs font-medium text-muted-foreground mb-1">Timestamp</p>
              <p className="font-bold text-foreground text-sm">
                {selectedLog?.createdAt ? format(new Date(selectedLog.createdAt), "HH:mm:ss.SSS") : "N/A"}
              </p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 text-center shadow-sm">
              <p className="text-xs font-medium text-muted-foreground mb-1">Date</p>
              <p className="font-bold text-foreground text-sm">
                {selectedLog?.createdAt ? format(new Date(selectedLog.createdAt), "MMM dd, yyyy") : "N/A"}
              </p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 text-center shadow-sm flex flex-col items-center justify-center overflow-hidden">
              <p className="text-xs font-medium text-muted-foreground mb-1">Target Entity</p>
              <Badge variant="outline" className="text-[10px] uppercase font-bold truncate max-w-full">{selectedLog?.entityType || "N/A"}</Badge>
            </div>
          </div>

          {/* Details Grid */}
          <div>
            <h3 className="text-base font-extrabold text-foreground mb-4 capitalize">
              {selectedLog?.action?.replace(/_/g, " ").toLowerCase()} context
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-0 text-sm">
              <div className="space-y-0">
                <div className="flex justify-between py-3 border-b border-border">
                  <span className="text-muted-foreground font-medium">Action Triggered</span>
                  <span className="font-semibold text-foreground capitalize truncate ml-4">{selectedLog?.action?.replace(/_/g, " ").toLowerCase()}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-border">
                  <span className="text-muted-foreground font-medium shrink-0">Context Data</span>
                  <span className="font-semibold text-foreground truncate ml-4 text-right" title={selectedLog?.metadata?.method || selectedLog?.metadata?.jobTitle || selectedLog?.metadata?.providedEmail || selectedLog?.metadata?.name || "Execute Payload"}>
                    {selectedLog?.metadata?.method || selectedLog?.metadata?.jobTitle || selectedLog?.metadata?.providedEmail || selectedLog?.metadata?.name || "Execute Payload"}
                  </span>
                </div>
                <div className="flex justify-between py-3 border-b border-border">
                  <span className="text-muted-foreground font-medium">Target ID</span>
                  <span className="font-medium text-primary uppercase" title={selectedLog?.entityId}>{selectedLog?.entityId?.substring(0, 8) || "N/A"}</span>
                </div>
              </div>
              <div className="space-y-0">
                <div className="flex justify-between py-3 border-b border-border">
                  <span className="text-muted-foreground font-medium">IP Address</span>
                  <span className="font-semibold text-foreground">{selectedLog?.ipAddress || "Internal System"}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-border">
                  <span className="text-muted-foreground font-medium shrink-0">Origin Device</span>
                  <span className="font-semibold text-foreground truncate ml-4 text-right" title={selectedLog?.device || "Server Module"}>
                    {selectedLog?.device || "Server Module"}
                  </span>
                </div>
                <div className="flex justify-between py-3 border-b border-border">
                  <span className="text-muted-foreground font-medium">Session Fingerprint</span>
                  <span className="font-semibold text-foreground uppercase">{selectedLog?.sessionId || "N/A"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* DYNAMIC TIMELINE */}
          <div>
            <h3 className="text-base font-extrabold text-foreground mb-6">Execution Timeline</h3>
            <div className="relative pl-6 border-l-2 border-border space-y-8 ml-2">
               {selectedLog?.metadata?.auditType === 'AUTH' && renderAuthTimeline()}
               {selectedLog?.metadata?.auditType === 'CAREER' && renderCareerTimeline()}
               {(!selectedLog?.metadata?.auditType || selectedLog?.metadata?.auditType === 'SYSTEM' || selectedLog?.metadata?.auditType === 'BLOGS') && renderSystemTimeline()}
            </div>
          </div>

        </div>
      </Modal>
    </div>
  );
}