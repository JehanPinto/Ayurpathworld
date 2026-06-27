import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CheckCircle2,
  XCircle,
  Copy,
  Landmark,
  Search,
  Loader2,
  Eye,
  Lock,
  X,
  ShieldCheck
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Label } from "recharts";

export default function AdminPayoutsTable() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useState(() => new URLSearchParams(window.location.search));
  
  const activeTab = searchParams.get("tab") || "pending";
  const currentPage = parseInt(searchParams.get("page") || "1");
  const searchQuery = searchParams.get("search") || "";

  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [selectedPayout, setSelectedPayout] = useState<any>(null);
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'free' | 'view'>('approve');

  const updateParams = (updates: any) => {
    const newParams = new URLSearchParams(searchParams);
    Object.keys(updates).forEach(key => {
      if (updates[key]) newParams.set(key, updates[key]);
      else newParams.delete(key);
    });
    window.history.replaceState(null, "", `${window.location.pathname}?${newParams.toString()}`);
    setSearchParams(newParams);
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["/api/admin/payouts/management", activeTab, currentPage, searchQuery],
    queryFn: async () => {
      const res = await fetch(`/api/admin/payouts/management?tab=${activeTab}&page=${currentPage}&limit=10&search=${searchQuery}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    }
  });

  const processMutation = useMutation({
    mutationFn: async (payload: any) => {
      const endpoint = actionType === 'free' 
        ? "/api/admin/payouts/process-free" 
        : `/api/admin/payouts/${selectedPayout.id}/process`;
      
      return await apiRequest("POST", endpoint, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payouts/management"] });
      toast({ title: "Success", description: "Payout action completed securely." });
      setIsSecurityModalOpen(false);
      setAdminPassword("");
      setRejectReason("");
    },
    onError: (err: any) => {
      toast({ title: "Action Failed", description: err.message, variant: "destructive" });
    }
  });

  const handleProceedToSecurity = () => {
    if (actionType === 'reject' && !rejectReason) {
      return toast({ title: "Reason required for rejection", variant: "destructive" });
    }
    setIsProcessModalOpen(false);
    setIsSecurityModalOpen(true);
  };

  const handleProcessSubmit = () => {
    if (!adminPassword) return toast({ title: "Password required", variant: "destructive" });
    if (actionType === 'reject' && !rejectReason) return toast({ title: "Reason required for rejection", variant: "destructive" });

    const payload = actionType === 'free' 
      ? { doctorId: selectedPayout.doctorId, amount: selectedPayout.availableBalance, adminPassword }
      : { action: actionType, rejectReason, adminPassword };
      
    processMutation.mutate(payload);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: "Bank detail copied to clipboard." });
  };

  const formatLKR = (num: number) => new Intl.NumberFormat("en-LK", { maximumFractionDigits: 0 }).format(num || 0);

  const renderTabs = () => (
    <div className="flex space-x-2 border-b border-border pb-2 mb-4 overflow-x-auto scrollbar-thin">
      {[
        { id: "pending", label: "Pending Withdraws" },
        { id: "free", label: "Monthly Free Payouts" },
        { id: "history", label: "Payout History" }
      ].map(t => (
        <button
          key={t.id}
          onClick={() => updateParams({ tab: t.id, page: "1" })}
          className={`px-4 py-2 text-sm font-bold rounded-full whitespace-nowrap transition-colors ${activeTab === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/50'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold">Payout Management</h1>
          <p className="text-muted-foreground">View and manage all payouts</p>
        </div>
      </div>

      <Card className="border-border shadow-sm rounded-3xl overflow-hidden bg-card">
        <CardHeader className="bg-muted/20 border-b border-border py-4 px-6 flex flex-col lg:flex-row gap-4 items-start justify-between">
          <div>
            <CardTitle className="text-lg font-bold text-foreground">Doctor Payouts</CardTitle>
            <p className="text-sm text-muted-foreground">Securely process withdrawals to doctor bank accounts</p>
          </div>
          <div className="relative w-full max-w-[400px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            {
              localSearch && (
                <X className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer" 
                  onClick={() => { setLocalSearch(""); updateParams({ search: "", page: "1" }); }}
                />
              )
            }
            <Input 
              placeholder="Search Name, Email, Phone or Payout ID..."
              className="pl-9 rounded-full bg-background border-border h-10"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') updateParams({ search: localSearch, page: "1" }); }}
              onBlur={() => updateParams({ search: localSearch, page: "1" })}
            />
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {renderTabs()}

          <div className="overflow-x-auto relative min-h-[300px]">
            {isFetching && (
              <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            )}

            <table className="w-full min-w-[1000px] text-sm text-left">
              <thead className="text-xs uppercase bg-muted/40 text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-4 py-3 font-bold tracking-wider sticky left-0 z-10 border-r border-border bg-muted">#</th>
                  <th className="px-4 py-3 font-bold tracking-wider">Doctor</th>
                  <th className="px-4 py-3 font-bold tracking-wider">Bank Info</th>
                  <th className="px-4 py-3 font-bold tracking-wider text-right">Amount / Details</th>
                  <th className="px-4 py-3 font-bold tracking-wider text-center">Status</th>
                  <th className="px-4 py-3 font-bold tracking-wider text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data?.data?.map((row: any) => (
                  <tr key={row.id || row.doctorId} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-4 font-mono text-xs text-muted-foreground sticky left-0 z-10 border-r border-border bg-muted">
                      {data?.data?.indexOf(row) + 1}
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-bold text-foreground">{row.doctorName}</div>
                      <div className="text-xs text-muted-foreground">{row.doctorEmail}</div>
                      {row.requested_at && <div className="text-[10px] text-muted-foreground mt-1">Req: {format(new Date(row.requested_at), "MMM dd, yyyy")}</div>}
                      {row.processed_at && <div className="text-[10px] text-primary mt-1">Processed: {format(new Date(row.processed_at), "MMM dd, yyyy")}</div>}
                    </td>
                    
                    <td className="px-4 py-4">
                      {row.bankName || row.bank_name ? (
                        <div className="space-y-1">
                          <div className="text-xs font-semibold">{row.bankName || row.bank_name} - {row.bankBranch || row.bank_branch}</div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            Acc: {row.bankAccount || row.bank_account_number}
                            <button onClick={() => copyToClipboard(row.bankAccount || row.bank_account_number)} className="hover:text-primary transition-colors"><Copy className="w-3 h-3"/></button>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-destructive italic">Not Provided</span>
                      )}
                    </td>

                    <td className="px-4 py-4 text-right">
                      {activeTab === 'free' ? (
                        <div>
                          <div className="font-black text-primary text-base">LKR {formatLKR(row.availableBalance)}</div>
                          <div className="text-[10px] text-muted-foreground uppercase">Eligible Balance</div>
                        </div>
                      ) : (
                        <div>
                          <div className="text-xs text-muted-foreground line-through">LKR {formatLKR(row.amount_requested)}</div>
                          <div className="font-black text-foreground text-base">LKR {formatLKR(row.net_amount)}</div>
                          <div className="text-[10px] text-destructive uppercase">Fee: {row.fee_percentage}% (-LKR {formatLKR(row.fee_deducted)})</div>
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-4 text-center">
                      {activeTab === 'free' ? (
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Ready</Badge>
                      ) : (
                        <Badge variant="outline" className={
                          row.status === 'completed' ? 'bg-primary/10 text-primary border-primary/20' : 
                          row.status === 'rejected' ? 'bg-destructive/10 text-destructive border-destructive/20' : 
                          'bg-secondary/10 text-secondary border-secondary/20'
                        }>
                          {row.status.toUpperCase()}
                        </Badge>
                      )}
                    </td>

                    <td className="px-4 py-4 text-center">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="rounded-full text-xs font-bold border-border hover:bg-primary/10 hover:text-primary"
                        onClick={() => {
                          setSelectedPayout(row);
                          setActionType(activeTab === 'free' ? 'free' : activeTab === 'pending' ? 'approve' : 'view');
                          setIsProcessModalOpen(true);
                        }}
                      >
                        <Eye className="w-3 h-3 mr-1" /> {activeTab === 'history' ? 'View Details' : 'Process'}
                      </Button>
                    </td>
                  </tr>
                ))}

                {data?.data?.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={5} className="text-center py-12">
                      <Landmark className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                      <p className="font-medium text-foreground">No records found</p>
                      <p className="text-sm text-muted-foreground">There are no payouts in this category currently.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {data?.totalPages > 1 && (
            <div className="mt-6 flex justify-center">
              <Pagination currentPage={currentPage} totalPages={data.totalPages} onPageChange={(p) => updateParams({ page: p.toString() })} />
            </div>
          )}
        </CardContent>

        {/* SECURITY PROCESSING MODAL */}
        <Modal
          isOpen={isProcessModalOpen}
          onClose={() => { setIsProcessModalOpen(false); setAdminPassword(""); setRejectReason(""); }}
          title={actionType === 'view' ? "Payout Details" : "Process Doctor Payout"}
          description={actionType === 'view' ? "Review the history of this payout." : "Review details and authorize transfer securely."}
          icon={actionType === 'view' ? <Landmark className="w-6 h-6 text-primary" /> : <Lock className="w-6 h-6 text-destructive" />}
        >
          {selectedPayout && (
            <div className="space-y-6 pt-2">
              
              {/* Calculation Overview */}
              <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Calculation Overview</h4>
                {actionType === 'free' ? (
                  <div className="flex justify-between items-center text-lg font-black">
                    <span>Net Transfer (0% Fee)</span>
                    <span className="text-primary">LKR {formatLKR(selectedPayout.availableBalance)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Requested Amount</span>
                      <span className="font-bold">LKR {formatLKR(selectedPayout.amount_requested)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-destructive border-b border-border/50 pb-3">
                      <span>Express Fee ({selectedPayout.fee_percentage}%)</span>
                      <span>-LKR {formatLKR(selectedPayout.fee_deducted)}</span>
                    </div>
                    <div className="flex justify-between items-center text-lg pt-1">
                      <span className="font-bold">Net Bank Transfer</span>
                      <span className="font-black text-primary">LKR {formatLKR(selectedPayout.net_amount)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Bank Details Panel (Easy Copy) */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                <h4 className="text-[10px] font-bold text-primary uppercase tracking-wider mb-3">Target Bank Account</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Bank & Branch</span>
                    <span className="text-sm font-bold">{selectedPayout.bankName || selectedPayout.bank_name} - {selectedPayout.bankBranch || selectedPayout.bank_branch}</span>
                  </div>
                  <div className="flex justify-between items-center bg-background border border-border px-3 py-2 rounded-lg">
                    <span className="text-sm font-mono font-bold tracking-widest">{selectedPayout.bankAccount || selectedPayout.bank_account_number}</span>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs font-bold hover:text-primary" onClick={() => copyToClipboard(selectedPayout.bankAccount || selectedPayout.bank_account_number)}>
                      <Copy className="w-3 h-3 mr-1"/> Copy
                    </Button>
                  </div>
                </div>
              </div>

              {/* Reject Reason Display (If viewing history of rejected payout) */}
              {actionType === 'view' && selectedPayout.status === 'rejected' && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4">
                  <h4 className="text-[10px] font-bold text-destructive uppercase tracking-wider mb-1">Rejection Reason</h4>
                  <p className="text-sm font-medium text-destructive/90">{selectedPayout.reject_reason || "No reason provided."}</p>
                </div>
              )}

              {/* Action Toggles (Only for Pending Requests) */}
              {activeTab === 'pending' && actionType !== 'view' && (
                <div className="flex gap-2">
                  <Button type="button" variant={actionType === 'approve' ? 'default' : 'outline'} className={`flex-1 rounded-full font-bold ${actionType==='approve' ? 'bg-primary text-primary-foreground' : 'border-border text-muted-foreground'}`} onClick={() => setActionType('approve')}><CheckCircle2 className="w-4 h-4 mr-2"/> Approve</Button>
                  <Button type="button" variant={actionType === 'reject' ? 'default' : 'outline'} className={`flex-1 rounded-full font-bold ${actionType==='reject' ? 'bg-destructive text-destructive-foreground' : 'border-border text-muted-foreground'}`} onClick={() => setActionType('reject')}><XCircle className="w-4 h-4 mr-2"/> Reject</Button>
                </div>
              )}

              {/* Reject Input */}
              {actionType === 'reject' && (
                <div className="space-y-2">
                  <Label className="font-bold text-destructive">Reason for Rejection <span className="text-destructive">*</span></Label>
                  <Input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="e.g. Invalid bank details provided" className="bg-background border-destructive/50 focus-visible:ring-destructive"/>
                </div>
              )}

              {/* Admin Security Password (Hidden if just viewing history) */}
              {actionType !== 'view' ? (
                <Button 
                  onClick={handleProceedToSecurity} 
                  disabled={actionType === 'reject' && !rejectReason}
                  className={`w-full rounded-full font-bold h-12 ${actionType === 'reject' ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : 'bg-primary hover:bg-primary/90 text-primary-foreground'}`}
                >
                  Proceed to Authorization
                </Button>
              ) : (
                <Button onClick={() => setIsProcessModalOpen(false)} className="w-full rounded-full font-bold bg-secondary hover:bg-secondary/90 text-secondary-foreground">
                  Close Window
                </Button>
              )}
            </div>
          )}
        </Modal>

        <Modal
          isOpen={isSecurityModalOpen}
          onClose={() => { setIsSecurityModalOpen(false); setAdminPassword(""); }}
          title=""
          description=""
        >
          <div className="space-y-6 pt-2">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center ${actionType === 'reject' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
                <ShieldCheck className="w-10 h-10" />
              </div>
              <div>
                <h3 className="font-bold text-xl text-foreground">Security Authorization</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  You are about to <strong className={actionType === 'reject' ? 'text-destructive' : 'text-primary'}>{actionType === 'reject' ? 'reject' : 'authorize'}</strong> a transaction for<br/>
                  <span className="font-bold text-foreground text-base">{selectedPayout?.doctorName}</span>
                </p>
              </div>
            </div>
            
            <div className="space-y-3 pb-2">
              <Label className="font-bold text-foreground flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-muted-foreground"/> Admin Password
              </Label>
              <Input 
                type="password" 
                value={adminPassword} 
                onChange={(e) => setAdminPassword(e.target.value)} 
                placeholder="••••••••" 
                className={`h-12 text-center text-xl tracking-[0.3em] font-mono bg-background focus-visible:ring-2 ${actionType === 'reject' ? 'border-destructive/30 focus-visible:ring-destructive' : 'border-border focus-visible:ring-primary'}`}
                autoFocus
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 rounded-full font-bold border-border hover:bg-accent" onClick={() => { setIsSecurityModalOpen(false); setAdminPassword(""); }}>
                Cancel
              </Button>
              <Button 
                onClick={handleProcessSubmit} 
                disabled={processMutation.isPending || !adminPassword}
                className={`flex-1 rounded-full font-bold ${actionType === 'reject' ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : 'bg-primary hover:bg-primary/90 text-primary-foreground'}`}
              >
                {processMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Action'}
              </Button>
            </div>
          </div>
        </Modal>
      </Card>
    </div>
  );
}