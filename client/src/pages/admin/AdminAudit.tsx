import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Activity,
  Search,
  Filter,
  ShieldAlert,
  Printer,
  Mail,
  Lock,
  Briefcase,
  Settings,
  Calendar as CalendarIcon,
  X,
  Clock,
  CreditCard,
  FileText,
  Zap,
  CheckCircle2,
  XCircle,
  History,
  User,
  Tag,
  MapPin,
  Fingerprint,
  MonitorSmartphone
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { LoadingPage, LoadingSpinner } from "@/components/ui/loading-spinner";
import { Pagination } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "ALL", label: "All Logs", icon: Activity },
  { id: "AUTH", label: "Authentication", icon: Lock },
  { id: "APPOINTMENT", label: "Appointments", icon: CalendarIcon },
  { id: "PAYMENT", label: "Payments", icon: CreditCard },
  { id: "CAREER", label: "Careers", icon: Briefcase },
  { id: "BLOGS", label: "Blogs", icon: FileText },
  { id: "SYSTEM", label: "System", icon: Settings },
];

const QUICK_SEARCHES = [
  { label: "Failed Actions", value: "failed" },
  { label: "Logins", value: "USER_LOGIN" },
  { label: "Registrations", value: "REGISTER" },
  { label: "Cancellations", value: "CANCEL" },
];

export default function AdminAudit() {
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState("ALL");
  
  // UI Inputs (What user types, does not trigger API directly)
  const [searchInput, setSearchInput] = useState("");
  const [startDateInput, setStartDateInput] = useState("");
  const [endDateInput, setEndDateInput] = useState("");

  // Applied Filters (Triggers the API Call)
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedStartDate, setAppliedStartDate] = useState("");
  const [appliedEndDate, setAppliedEndDate] = useState("");

  const [selectedLog, setSelectedLog] = useState<any>(null);
  const limit = 15;

  // Apply filters when user clicks the "Search & Apply Filter" button
  const handleApplyFilters = () => {
    setAppliedSearch(searchInput);
    setAppliedStartDate(startDateInput);
    setAppliedEndDate(endDateInput);
    setPage(1);
  };

  const clearFilters = () => {
    setSearchInput("");
    setStartDateInput("");
    setEndDateInput("");
    setAppliedSearch("");
    setAppliedStartDate("");
    setAppliedEndDate("");
    setPage(1);
  };

  // Helper to format Date to datetime-local string (YYYY-MM-DDThh:mm)
  const toInputFormat = (d: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const setQuickDate = (days: number) => {
    const now = new Date();
    
    // End time is end of today
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    // Start time
    const start = new Date(now);
    if (days === 0) {
      start.setHours(0, 0, 0, 0); // Start of today
    } else {
      start.setDate(start.getDate() - days);
      start.setHours(0, 0, 0, 0); // Start of that past day
    }

    const startStr = toInputFormat(start);
    const endStr = toInputFormat(end);

    setStartDateInput(startStr);
    setEndDateInput(endStr);
    
    // Auto-apply for quick dates
    setAppliedStartDate(startStr);
    setAppliedEndDate(endStr);
    setPage(1);
  };

  // Auto-apply quick searches
  const handleQuickSearch = (value: string) => {
    setSearchInput(value);
    setAppliedSearch(value);
    setPage(1);
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      "/api/admin/audit-logs",
      page,
      activeTab,
      appliedSearch,
      appliedStartDate,
      appliedEndDate,
    ],
    queryFn: async () => {
      let url = `/api/admin/audit-logs?page=${page}&limit=${limit}&type=${activeTab}`;
      if (appliedSearch) url += `&search=${encodeURIComponent(appliedSearch)}`;
      if (appliedStartDate) url += `&startDate=${new Date(appliedStartDate).toISOString()}`;
      if (appliedEndDate) url += `&endDate=${new Date(appliedEndDate).toISOString()}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch logs");
      return res.json();
    },
    staleTime: 30 * 1000,
  });

  const getActionColor = (action: string, status: string) => {
    if (status !== "success") return "bg-destructive/15 text-destructive border-destructive/20";
    const upperAction = action.toUpperCase();
    if (upperAction.includes("UPDATE") || upperAction.includes("EDIT") || upperAction.includes("RESCHEDULE")) {
      return "bg-secondary/20 text-secondary-foreground border-secondary/30";
    }
    return "bg-primary/10 text-primary border-primary/20";
  };

  const logs = data?.data || [];
  const totalPages = data?.totalPages || 1;

  // ==========================================
  // DYNAMIC TIMELINE RENDERER
  // ==========================================
  const renderDynamicTimeline = () => {
    if (!selectedLog || !selectedLog.metadata?.timeline) {
      return (
        <div className="relative pb-4">
          <div className="absolute -left-[29px] top-1 w-4 h-4 rounded-full border-2 border-background bg-primary shadow-sm" />
          <h4 className="font-bold text-sm text-foreground">Action Executed</h4>
          <p className="text-xs text-muted-foreground mt-1">
            {selectedLog?.createdAt ? format(new Date(selectedLog.createdAt), "HH:mm:ss.SSS, MMM dd") : "N/A"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {selectedLog?.metadata?.reason || "Execution tracked successfully."}
          </p>
        </div>
      );
    }

    const tl = selectedLog.metadata.timeline;
    const globalStatus = selectedLog.status;
    const globalReason = selectedLog.metadata.reason;

    const sortedSteps = Object.entries(tl)
      .map(([key, time]) => ({ key, time: new Date(time as string) }))
      .sort((a, b) => a.time.getTime() - b.time.getTime());

    return sortedSteps.map((step, index) => {
      const isLastStep = index === sortedSteps.length - 1;
      const isFailedStep = 
        step.key.toLowerCase().includes('fail') || 
        step.key.toLowerCase().includes('error') || 
        step.key.toLowerCase().includes('reject') ||
        (isLastStep && globalStatus !== "success");

      let title = step.key.replace(/([A-Z])/g, ' $1').replace(/At$/i, '').trim();
      title = title.charAt(0).toUpperCase() + title.slice(1);

      let description = "Process recorded in system.";
      if (isFailedStep) description = globalReason || "Operation encountered an error.";
      else if (isLastStep) description = globalReason || "Operation finalized successfully.";
      else if (step.key === "requestReceivedAt") description = "Initial request received by system module.";

      return (
        <div key={step.key} className="relative pb-8 last:pb-0">
          {!isLastStep && <div className="absolute left-[-22px] top-4 w-[2px] h-full bg-border" />}
          <div
            className={cn(
              "absolute -left-[29px] top-1 w-4 h-4 rounded-full border-2 border-background shadow-sm flex items-center justify-center",
              isFailedStep ? "bg-destructive" : "bg-primary"
            )}
          >
            {isFailedStep ? <X className="w-2.5 h-2.5 text-destructive-foreground" /> : <CheckCircle2 className="w-2.5 h-2.5 text-primary-foreground" />}
          </div>
          <Card className="shadow-none border-border/50 bg-card/50 hover:bg-accent/10 transition-colors">
            <CardContent className="p-3">
              <h4 className={cn("font-bold text-sm", isFailedStep ? "text-destructive" : "text-foreground")}>
                {title}
              </h4>
              <p className="text-xs font-medium text-muted-foreground mt-0.5 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {format(step.time, "HH:mm:ss.SSS, MMM dd")}
              </p>
              <p className={cn("text-xs mt-1.5", isFailedStep ? "text-destructive font-medium" : "text-muted-foreground")}>
                {description}
              </p>
            </CardContent>
          </Card>
        </div>
      );
    });
  };

  // 🖨️ Print Report Function 
  const handlePrintReport = () => {
    if (!selectedLog) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Please allow popups to print or export this record.");
      return;
    }

    // Format Timeline
    const tl = selectedLog.metadata?.timeline || {};
    const sortedSteps = Object.entries(tl)
      .map(([key, time]) => ({ key, time: new Date(time as string) }))
      .sort((a, b) => a.time.getTime() - b.time.getTime());

    const timelineHtml = sortedSteps.map(step => {
      const title = step.key.replace(/([A-Z])/g, ' $1').replace(/At$/i, '').trim().toUpperCase();
      return `
        <div style="padding: 10px 0; border-bottom: 1px solid #eef0f2;">
          <strong style="color: #334155;">${title}</strong>
          <div style="color: #64748b; font-size: 12px; margin-top: 4px;">${format(step.time, "MMM dd, yyyy • HH:mm:ss.SSS")}</div>
        </div>
      `;
    }).join('');

    // Format Metadata (Exclude timeline and object values)
    const metadataHtml = selectedLog.metadata ? Object.entries(selectedLog.metadata)
      .filter(([k, v]) => typeof v !== 'object' && k !== 'timeline' && k !== 'auditType')
      .map(([k, v]) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #eef0f2; color: #64748b; font-size: 12px; font-weight: bold; text-transform: uppercase; width: 35%;">${k.replace(/([A-Z])/g, ' $1').trim()}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eef0f2; color: #0f172a; font-weight: 500;">${String(v)}</td>
        </tr>
      `).join('') : '';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Audit Log - EVT-${selectedLog.id.substring(0, 8)}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.5; padding: 40px; max-width: 800px; margin: 0 auto; }
          .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-start; }
          .title-area h1 { margin: 0 0 8px 0; font-size: 24px; color: #0f172a; text-transform: capitalize; }
          .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
          .bg-success { background: #dcfce7; color: #059669; border: 1px solid #bbf7d0; }
          .bg-error { background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; }
          .bg-gray { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
          .section { margin-bottom: 30px; page-break-inside: avoid; }
          .section-title { font-size: 14px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
          table { width: 100%; border-collapse: collapse; }
          .footer { margin-top: 50px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 15px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title-area">
            <h1>${selectedLog.action?.replace(/_/g, " ").toLowerCase()}</h1>
            <div style="color: #64748b; font-family: monospace; font-size: 13px;">ID: EVT-${selectedLog.id}</div>
          </div>
          <div style="text-align: right;">
            <div class="badge ${selectedLog.status === 'success' ? 'bg-success' : 'bg-error'}">${selectedLog.status}</div>
            <div style="margin-top: 8px;" class="badge bg-gray">${selectedLog.metadata?.auditType || 'SYSTEM EVENT'}</div>
          </div>
        </div>

        <div class="info-grid section">
          <div>
            <div class="section-title">Actor Information</div>
            <table>
              <tr><td style="padding: 8px 0; color: #64748b; font-size: 12px; width: 80px;">Name:</td><td style="font-weight: 600;">${selectedLog.actorName || 'System Auto Process'}</td></tr>
              <tr><td style="padding: 8px 0; color: #64748b; font-size: 12px;">Role:</td><td style="text-transform: uppercase; font-size: 12px; font-weight: 700;">${selectedLog.actorRole}</td></tr>
              <tr><td style="padding: 8px 0; color: #64748b; font-size: 12px;">Email:</td><td>${selectedLog.actorEmail || 'N/A'}</td></tr>
              <tr><td style="padding: 8px 0; color: #64748b; font-size: 12px;">User ID:</td><td style="font-family: monospace; font-size: 12px;">${selectedLog.actorId || 'N/A'}</td></tr>
            </table>
          </div>
          <div>
            <div class="section-title">Request Source</div>
            <table>
              <tr><td style="padding: 8px 0; color: #64748b; font-size: 12px; width: 80px;">IP Addr:</td><td style="font-family: monospace;">${selectedLog.ipAddress || 'Internal'}</td></tr>
              <tr><td style="padding: 8px 0; color: #64748b; font-size: 12px;">Location:</td><td>${selectedLog.location || 'N/A'}</td></tr>
              <tr><td style="padding: 8px 0; color: #64748b; font-size: 12px;">Device:</td><td>${selectedLog.device || 'Server Module'}</td></tr>
              <tr><td style="padding: 8px 0; color: #64748b; font-size: 12px;">Session:</td><td style="font-family: monospace; font-size: 12px;">${selectedLog.sessionId || 'N/A'}</td></tr>
            </table>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Target Entity</div>
          <table>
            <tr>
              <td style="padding: 10px; background: #f8fafc; border-radius: 6px 0 0 6px; width: 50%;">
                <div style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: bold; margin-bottom: 4px;">Entity Type</div>
                <div style="font-weight: 600; text-transform: capitalize;">${selectedLog.entityType?.replace(/_/g, " ") || 'N/A'}</div>
              </td>
              <td style="padding: 10px; background: #f8fafc; border-radius: 0 6px 6px 0; border-left: 2px solid #fff;">
                <div style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: bold; margin-bottom: 4px;">Entity ID</div>
                <div style="font-family: monospace; font-weight: 600;">${selectedLog.entityId || 'N/A'}</div>
              </td>
            </tr>
          </table>
        </div>

        ${metadataHtml ? `
        <div class="section">
          <div class="section-title">Payload Metadata</div>
          <table>
            ${metadataHtml}
          </table>
        </div>` : ''}

        <div class="section">
          <div class="section-title">Execution Flow</div>
          <div>
            ${timelineHtml || '<p style="color: #64748b; font-size: 13px;">No timeline data available.</p>'}
          </div>
        </div>

        <div class="footer">
          AyurPath System Audit Report • Generated on ${format(new Date(), "PPpp")}
        </div>

        <script>
          window.onload = function() { 
            setTimeout(() => {
              window.print(); 
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-primary" />
            Security & Audit
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time monitoring and transaction history analysis.
          </p>
        </div>
      </div>

      {/* Advanced Filter Toolbar */}
      <Card className="border-border shadow-sm bg-card/80 backdrop-blur-xl">
        <CardContent className="p-4 sm:p-5 space-y-5">
          {/* Tabs - Scrollable on Mobile */}
          <div className="flex overflow-x-auto scrollbar-thin gap-2 w-full pb-2">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <Button
                  key={tab.id}
                  variant={isActive ? "default" : "outline"}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setPage(1);
                  }}
                  className={cn(
                    "rounded-xl px-4 transition-all shrink-0 h-10 text-xs sm:text-sm",
                    isActive ? "shadow-md bg-primary text-primary-foreground border-transparent" : "hover:bg-accent hover:text-accent-foreground border-border bg-background"
                  )}
                >
                  <Icon className="w-4 h-4 mr-2 opacity-70" />
                  {tab.label}
                </Button>
              );
            })}
          </div>

          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 border-t border-border/50 pt-4">
            
            {/* Search Input */}
            <div className="flex flex-col gap-2 w-full lg:w-1/3 shrink-0 mt-4">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Search Keyword</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Action, email, or ID..."
                  className="pl-9 bg-background h-11 border-border focus-visible:ring-primary shadow-sm rounded-xl"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                  <Zap className="w-3 h-3 text-secondary" /> QUICK:
                </span>
                {QUICK_SEARCHES.map((qs) => (
                  <Badge 
                    key={qs.value} 
                    variant="secondary" 
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors bg-accent text-accent-foreground border-border shadow-none text-[9px] px-1.5 py-0"
                    onClick={() => handleQuickSearch(qs.value)}
                  >
                    {qs.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Date Time Picker Range */}
            <div className="flex flex-col gap-2 w-full lg:w-2/3">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Filter by Date & Time</label>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] bg-accent hover:bg-primary/10 rounded-md" onClick={() => setQuickDate(0)}>Today</Button>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] bg-accent hover:bg-primary/10 rounded-md" onClick={() => setQuickDate(7)}>7D</Button>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] bg-accent hover:bg-primary/10 rounded-md" onClick={() => setQuickDate(30)}>30D</Button>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative w-full">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    type="datetime-local"
                    value={startDateInput}
                    onChange={(e) => setStartDateInput(e.target.value)}
                    className="pl-9 h-11 bg-background border-border text-sm rounded-xl focus-visible:ring-primary shadow-sm w-full"
                  />
                </div>
                <span className="text-muted-foreground text-xs font-bold shrink-0 hidden sm:block">TO</span>
                <div className="relative w-full">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    type="datetime-local"
                    value={endDateInput}
                    onChange={(e) => setEndDateInput(e.target.value)}
                    className="pl-9 h-11 bg-background border-border text-sm rounded-xl focus-visible:ring-primary shadow-sm w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-end pt-2">
            {(appliedSearch || appliedStartDate || appliedEndDate || searchInput || startDateInput || endDateInput) && (
              <Button
                variant="ghost"
                onClick={clearFilters}
                className="w-full sm:w-auto h-11 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl"
              >
                <X className="w-4 h-4 mr-2" /> Clear All
              </Button>
            )}
            <Button
              onClick={handleApplyFilters}
              disabled={isFetching}
              className="w-full sm:w-auto h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-md transition-all active:scale-95 px-8"
            >
              {isFetching ? <LoadingSpinner className="w-4 h-4 mr-2" /> : <Filter className="w-4 h-4 mr-2" />} 
              Apply Filters & Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card className="border-border shadow-sm overflow-hidden min-h-[400px] bg-card">
        {isLoading ? (
          <LoadingPage message="Fetching secure logs..." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/40 text-muted-foreground text-xs uppercase font-bold tracking-wider border-b border-border">
                <tr>
                  <th className="px-6 py-4 sticky left-0 bg-muted/40 z-20 border-r border-border w-16">#</th>
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4">Actor</th>
                  <th className="px-6 py-4">Module</th>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.length > 0 ? (
                  logs.map((log: any, index: number) => (
                    <tr
                      key={log.id}
                      className="hover:bg-accent/40 transition-all bg-card group"
                      onClick={() => setSelectedLog(log)}
                      style={{ cursor: "pointer" }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-muted-foreground sticky left-0 z-10 border-r border-border bg-card group-hover:bg-accent/40 font-mono">
                        {(page - 1) * limit + index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-semibold text-foreground">
                          {format(new Date(log.createdAt), "MMM dd, yyyy")}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {format(new Date(log.createdAt), "hh:mm:ss a")}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-foreground truncate max-w-[150px] sm:max-w-[200px]">
                          {log.actorName || "System Auto Process"}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-[9px] uppercase px-1.5 py-0 border-border bg-background text-muted-foreground">
                            {log.actorRole}
                          </Badge>
                          {log.actorEmail && (
                            <span className="text-xs text-muted-foreground truncate max-w-[120px] sm:max-w-[150px]" title={log.actorEmail}>
                              {log.actorEmail}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="text-[10px] uppercase shadow-sm bg-background text-muted-foreground font-bold tracking-wider border-border">
                          {log.metadata?.auditType || "SYSTEM"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn("px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider border whitespace-nowrap", getActionColor(log.action, log.status))}>
                          {log.action.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {log.status === "success" ? (
                          <div className="inline-flex items-center justify-end text-primary text-xs font-bold uppercase bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20">
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> SUCCESS
                          </div>
                        ) : (
                          <div className="inline-flex items-center justify-end text-destructive text-xs font-bold uppercase bg-destructive/10 px-2.5 py-1 rounded-full border border-destructive/20">
                            <XCircle className="w-3.5 h-3.5 mr-1" /> FAILED
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-24 text-center bg-card">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mb-4">
                          <Search className="w-8 h-8 opacity-50" />
                        </div>
                        <p className="font-semibold text-lg text-foreground mb-1">No audit logs found</p>
                        <p className="text-sm max-w-sm text-center">We couldn't find any records matching your current filter criteria.</p>
                        {(appliedSearch || appliedStartDate || appliedEndDate) && (
                          <Button variant="outline" onClick={clearFilters} className="mt-6 rounded-xl border-border h-11 px-6 font-semibold">
                            Clear all filters
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {!isLoading && totalPages > 1 && (
        <div className="pt-2">
           <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      {/* DETAILED MODAL VIEW */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="Transaction Inspector"
        description="Detailed metadata and timeline of the selected operation."
        icon={<History className="w-5 h-5 text-primary" />}
        className="w-full max-w-5xl bg-background border-border mx-auto rounded-2xl shadow-2xl p-0 overflow-hidden flex flex-col max-h-[90vh]"
        footer={
          <div className="flex w-full justify-between items-center gap-4">
            <Button variant="ghost" onClick={() => setSelectedLog(null)} className="w-full sm:w-auto text-muted-foreground hover:text-foreground h-11 rounded-xl">
              Close Window
            </Button>
            <Button 
              onClick={handlePrintReport} 
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-6 h-11 font-bold shadow-sm flex items-center justify-center gap-2 w-full sm:w-auto transition-transform active:scale-95"
            >
              <Printer className="w-4 h-4" /> Print Record
            </Button>
          </div>
        }
      >
        <div className="flex flex-col w-full h-full overflow-hidden">
          
          {/* LEFT PANEL - Metadata & Details (Scrollable) */}
          <div className="flex-1 overflow-y-auto scrollbar-thin lg:border-r border-border bg-background space-y-6">
            
            {/* Header Banner */}
            <div className="bg-card border border-border rounded-xl p-5 relative shadow-sm">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-primary rounded-l-xl" />
              <div className="flex justify-between items-start mb-3">
                <Badge variant="outline" className="bg-accent/50 border-border text-muted-foreground font-bold tracking-widest text-[10px] uppercase">
                  {selectedLog?.metadata?.auditType || "SYSTEM EVENT"}
                </Badge>
                <div className={cn(
                  "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase flex items-center gap-1.5 border shadow-sm",
                  selectedLog?.status === "success" ? "bg-primary text-primary-foreground border-primary" : "bg-destructive text-destructive-foreground border-destructive"
                )}>
                  {selectedLog?.status === "success" ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  {selectedLog?.status}
                </div>
              </div>

              <h2 className="text-xl font-extrabold text-foreground capitalize mb-2 leading-tight">
                {selectedLog?.action?.replace(/_/g, " ").toLowerCase()}
              </h2>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-3">
                <span className="font-mono bg-accent px-2 py-1 rounded-md border border-border/50 text-foreground">
                  ID: {selectedLog?.id}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {selectedLog?.createdAt ? format(new Date(selectedLog.createdAt), "MMM dd, yyyy - HH:mm:ss") : "N/A"}
                </span>
              </div>
            </div>

            {/* Core Info - Actor & Source */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-card rounded-xl p-4 border border-border shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border/50 pb-2">
                  <User className="w-4 h-4 text-primary" /> Actor
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent border border-border flex items-center justify-center text-foreground font-bold shrink-0">
                    {selectedLog?.actorName ? selectedLog.actorName.substring(0, 2).toUpperCase() : "SY"}
                  </div>
                  <div className="overflow-hidden">
                    <p className="font-semibold text-sm text-foreground truncate">{selectedLog?.actorName || "System"}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">{selectedLog?.actorRole}</p>
                  </div>
                </div>
                <div className="text-xs space-y-1.5 pt-1">
                  <div className="flex justify-between items-center"><span className="text-muted-foreground">ID:</span> <span className="font-mono text-primary truncate max-w-[120px]" title={selectedLog?.actorId}>{selectedLog?.actorId?.substring(0,10)}...</span></div>
                  {selectedLog?.actorEmail && <div className="flex justify-between items-center"><span className="text-muted-foreground">Email:</span> <span className="font-medium truncate max-w-[140px]" title={selectedLog.actorEmail}>{selectedLog.actorEmail}</span></div>}
                </div>
              </div>

              <div className="bg-card rounded-xl p-4 border border-border shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border/50 pb-2">
                   <MonitorSmartphone className="w-4 h-4 text-secondary" /> Request Source
                </div>
                <div className="text-xs space-y-3 pt-1">
                  <div className="flex items-start gap-3">
                     <Fingerprint className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                     <div className="overflow-hidden">
                       <p className="text-muted-foreground text-[10px] uppercase font-bold">IP & Session</p>
                       <p className="font-mono font-medium text-foreground truncate">{selectedLog?.ipAddress || "Internal"}</p>
                       <p className="font-mono text-muted-foreground truncate" title={selectedLog?.sessionId}>{selectedLog?.sessionId || "N/A"}</p>
                     </div>
                  </div>
                  <div className="flex items-start gap-3">
                     <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                     <div className="overflow-hidden">
                       <p className="text-muted-foreground text-[10px] uppercase font-bold">Location & Device</p>
                       <p className="font-medium text-foreground truncate">{selectedLog?.location || "N/A"}</p>
                       <p className="text-muted-foreground truncate" title={selectedLog?.device}>{selectedLog?.device || "Server Module"}</p>
                     </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Target Entity */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between shadow-sm">
               <div className="flex items-center gap-3">
                 <div className="p-2 bg-background rounded-lg border border-border/50">
                    <Tag className="w-4 h-4 text-primary" />
                 </div>
                 <div>
                   <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Target Entity</p>
                   <p className="font-bold text-sm text-foreground capitalize">{selectedLog?.entityType?.replace(/_/g, " ")}</p>
                 </div>
               </div>
               <div className="text-right">
                 <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Entity ID</p>
                 <p className="font-mono text-xs font-semibold text-primary bg-background px-2 py-1 rounded-md border border-border/50 inline-block">
                   {selectedLog?.entityId || "N/A"}
                 </p>
               </div>
            </div>

            {/* Payload Data */}
            <div className="space-y-4">
              <h3 className="text-xs font-extrabold text-foreground uppercase tracking-widest flex items-center gap-2 border-b border-border pb-2">
                <FileText className="w-4 h-4 text-muted-foreground" /> Payload Metadata
              </h3>
              
              {selectedLog?.metadata && Object.keys(selectedLog.metadata).some((k) => typeof selectedLog.metadata[k] === "object" && k !== "timeline") ? (
                <ModalTabs selectedLog={selectedLog} />
              ) : (
                <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                  <div className="divide-y divide-border/50">
                    {selectedLog?.metadata && Object.entries(selectedLog.metadata)
                      .filter(([key, value]) => !["timeline", "auditType", "validationErrors"].includes(key) && typeof value !== "object")
                      .map(([key, value]) => {
                        const isFailedReason = key === "reason" && selectedLog.status === "failed";
                        return (
                          <div key={key} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 gap-2 sm:gap-4 hover:bg-accent/20 transition-colors">
                            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider sm:w-1/3 shrink-0">
                              {key.replace(/([A-Z])/g, " $1").trim()}
                            </span>
                            <span className={cn(
                              "text-sm font-medium sm:text-right break-words", 
                              isFailedReason ? "text-destructive font-bold" : "text-foreground"
                            )}>
                              {String(value)}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* RIGHT PANEL - Timeline */}
          <div className="w-full mt-5 rounded-2xl shrink-0 bg-accent/20 sm:p-10 overflow-y-auto scrollbar-thin">
             <div className="sticky top-0">
                <h3 className="text-xs font-extrabold text-foreground mb-6 uppercase tracking-widest flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" /> Execution Flow
                </h3>
                {renderDynamicTimeline()}
             </div>
          </div>

        </div>
      </Modal>
    </div>
  );
}

// COMPONENT: Modal Tabs for complex objects
function ModalTabs({ selectedLog }: { selectedLog: any }) {
  const [modalTab, setModalTab] = useState<string>("");

  const objectKeys = Object.keys(selectedLog.metadata).filter(
    (k) => typeof selectedLog.metadata[k] === "object" && selectedLog.metadata[k] !== null && !["timeline", "validationErrors"].includes(k)
  );

  const tabs = [
    { id: "overview", label: "Overview" },
    ...objectKeys.map((k) => ({ id: k, label: k.replace(/([A-Z])/g, " $1").trim() })),
  ];

  // Set default tab on mount
  useEffect(() => {
    if (objectKeys.length > 0) setModalTab("overview");
  }, []);

  return (
    <div className="mt-6 border border-border rounded-2xl overflow-hidden bg-card shadow-sm">
      <div className="flex overflow-x-auto scrollbar-hide bg-accent/40 border-b border-border p-1.5 gap-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setModalTab(tab.id)}
            className={cn(
              "px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all duration-200",
              modalTab === tab.id
                ? "bg-background text-primary shadow-sm border border-border"
                : "text-muted-foreground hover:bg-background/50 hover:text-foreground border border-transparent"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-4 sm:p-5 min-h-[150px] bg-background">
        {modalTab === "overview" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             {Object.entries(selectedLog.metadata)
                .filter(([k, v]) => typeof v !== "object" && !["auditType"].includes(k))
                .map(([key, value]) => (
                  <div key={key} className="flex flex-col gap-1.5 p-3 rounded-xl bg-accent/30 border border-border/50 shadow-sm">
                    <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">
                      {key.replace(/([A-Z])/g, " $1").trim()}
                    </span>
                    <span className={cn("text-sm font-semibold", key === "reason" && selectedLog.status === "failed" ? "text-destructive" : "text-foreground")}>
                      {String(value)}
                    </span>
                  </div>
                ))}
          </div>
        ) : (
          selectedLog.metadata[modalTab] && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(selectedLog.metadata[modalTab]).map(([key, value]) => {
                const formattedKey = key.replace(/([A-Z])/g, " $1").trim();
                const isId = key.toLowerCase().includes("id");
                const isAmount = key.toLowerCase().includes("amount") || key.toLowerCase().includes("fee") || key.toLowerCase().includes("currency");

                return (
                  <div key={key} className="flex flex-col py-2.5 border-b border-border/50 last:border-0">
                    <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider mb-1">{formattedKey}</span>
                    <span className={cn("text-sm break-all", isId ? "font-mono text-primary font-medium" : isAmount ? "font-bold text-foreground" : "font-medium text-foreground")}>
                      {String(value)}
                    </span>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}