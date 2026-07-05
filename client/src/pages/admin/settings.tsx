import { useState, useEffect } from "react";
import { useSettingsTab } from "@/components/layout/dashboard-layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Shield,
  AlertTriangle,
  Plus,
  Trash2,
  Loader2,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoadingPage } from "@/components/ui/loading-spinner";
import type { PlatformSettings, TaxEntry, FeeEntry } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

function SpinnerBox({
  label,
  value,
  unit,
  description,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  testId,
}: {
  label: string;
  value: string;
  unit: "%" | "LKR";
  description: string;
  onChange: (val: string) => void;
  min?: number;
  max?: number;
  step?: number;
  testId?: string;
}) {
  const num = parseFloat(value) || 0;
  const display = unit === "%" ? `${num}%` : String(num);

  return (
    <div className="flex-1 bg-[#e8f3ef] dark:bg-primary/10 rounded-xl px-6 py-5 flex flex-col gap-3">
      <p className="text-sm font-medium text-center text-foreground">{label}</p>
      <div className="flex items-center justify-center gap-3">
        <p className="text-4xl font-bold text-foreground">{display}</p>
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={() => onChange(String(Math.min(max, +(num + step).toFixed(2))))}
            className="text-foreground/60 hover:text-foreground transition-colors"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onChange(String(Math.max(min, +(num - step).toFixed(2))))}
            className="text-foreground/60 hover:text-foreground transition-colors"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center">{description}</p>
      <input type="hidden" data-testid={testId} value={value} />
    </div>
  );
}

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const { tab: activeTab } = useSettingsTab();

  const toLocalDatetimeValue = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const [maintenanceDialog, setMaintenanceDialog] = useState(false);
  const [maintenanceDisableDialog, setMaintenanceDisableDialog] = useState(false);
  const [maintStartTime, setMaintStartTime] = useState(toLocalDatetimeValue(new Date()));
  const [maintEndTime, setMaintEndTime] = useState("");

  const [settings, setSettings] = useState({
    platformCommissionRate: "10",
    bookingCharges: "100",
    taxRate: "4",
    cancellationFee: "300",
    maxAdvanceBookingDays: "30",
    minBookingNoticeHours: "2",
    defaultSlotDuration: "30",
    defaultBufferTime: "10",
    emailNotifications: true,
    smsNotifications: true,
    pushNotifications: false,
    autoConfirmAppointments: false,
    requireDoctorVerification: true,
    allowOnlinePayments: true,
    allowClinicPayments: false,
    autoGenerateInvoices: false,
    twoFactorAuth: false,
    sessionTimeout: false,
    defaultLanguage: "english",
    maintenanceMode: false,
  });

  const [newTaxTitle, setNewTaxTitle] = useState("");
  const [newTaxRate, setNewTaxRate] = useState("");
  const [newTaxApplicableTo, setNewTaxApplicableTo] = useState<"doctors" | "patients" | "both">("doctors");

  const [newFeeTitle, setNewFeeTitle] = useState("");
  const [newFeeType, setNewFeeType] = useState<"" | "amount" | "percentage">("");
  const [newFeeRate, setNewFeeRate] = useState("");
  const [newFeeApplicableTo, setNewFeeApplicableTo] = useState<"" | "doctors" | "patients" | "both">("");
  // Fee pending delete confirmation
  const [feeToDelete, setFeeToDelete] = useState<FeeEntry | null>(null);

  const [systemTaxes, setSystemTaxes] = useState([
    { id: "vat", title: "VAT", rate: 18, description: "Value-added tax on consultation fees", applicableTo: "doctors", enabled: true },
    { id: "withholding", title: "Withholding tax", rate: 5, description: "Deducted from doctor payouts", applicableTo: "doctors", enabled: true },
    { id: "stamp", title: "Stamp duty", rate: 1, description: "Applied to booking confirmations", applicableTo: "patients", enabled: false },
  ]);

  const toggleSystemTax = (id: string) =>
    setSystemTaxes((prev) => prev.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t)));

  const { data: serverSettings, isLoading, isError } = useQuery<PlatformSettings>({
    queryKey: ["/api/admin/settings"],
  });

  const { data: taxEntries = [], isLoading: taxLoading } = useQuery<TaxEntry[]>({
    queryKey: ["/api/admin/tax-entries"],
  });

  const { data: feeEntries = [], isLoading: feeLoading } = useQuery<FeeEntry[]>({
    queryKey: ["/api/admin/fee-entries"],
  });

  const { data: feeLimits } = useQuery<{ maxAmount: number; maxPercentage: number }>({
    queryKey: ["/api/admin/fee-limits"],
  });
  const maxFeeAmount = feeLimits?.maxAmount ?? 0;
  const maxFeePercentage = feeLimits?.maxPercentage ?? 100;

  // Live validation message for the fee rate field
  const feeRateError = (() => {
    if (!newFeeRate || !newFeeType) return "";
    const rate = parseFloat(newFeeRate);
    if (isNaN(rate)) return "";
    if (rate <= 0) return "Rate must be greater than 0";
    if (newFeeType === "percentage" && rate > maxFeePercentage)
      return `Percentage cannot exceed ${maxFeePercentage}%`;
    if (newFeeType === "amount" && maxFeeAmount > 0 && rate > maxFeeAmount)
      return `Amount cannot exceed LKR ${maxFeeAmount.toLocaleString()} (typical consultation fee)`;
    return "";
  })();

  useEffect(() => {
    if (serverSettings) {
      setSettings((prev) => ({
        ...prev,
        platformCommissionRate: String(serverSettings.platformCommissionRate),
        bookingCharges: String(serverSettings.bookingCharges),
        taxRate: String(serverSettings.taxRate),
        maxAdvanceBookingDays: String(serverSettings.maxAdvanceBookingDays),
        minBookingNoticeHours: String(serverSettings.minBookingNoticeHours),
        defaultSlotDuration: String(serverSettings.defaultSlotDuration),
        defaultBufferTime: String(serverSettings.defaultBufferTime),
        emailNotifications: serverSettings.emailNotifications,
        smsNotifications: serverSettings.smsNotifications,
        pushNotifications: serverSettings.pushNotifications,
        autoConfirmAppointments: serverSettings.autoConfirmAppointments,
        requireDoctorVerification: serverSettings.requireDoctorVerification,
        allowOnlinePayments: serverSettings.allowOnlinePayments,
        allowClinicPayments: serverSettings.allowClinicPayments,
        defaultLanguage: serverSettings.defaultLanguage,
        maintenanceMode: serverSettings.maintenanceMode,
        cancellationFee: String(serverSettings.cancellationFee ?? 300),
      }));
      if (serverSettings.maintenanceEndTime) {
        setMaintEndTime(toLocalDatetimeValue(new Date(serverSettings.maintenanceEndTime)));
      }
      setSystemTaxes((prev) =>
        prev.map((t) => {
          if (t.id === "vat") return { ...t, enabled: serverSettings.vatEnabled ?? true };
          if (t.id === "withholding") return { ...t, enabled: serverSettings.withholdingTaxEnabled ?? true };
          if (t.id === "stamp") return { ...t, enabled: serverSettings.stampDutyEnabled ?? false };
          return t;
        })
      );
    }
  }, [serverSettings]);

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<PlatformSettings>) =>
      apiRequest("PUT", "/api/admin/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/booking-settings"] });
      toast({ title: "Settings Saved", description: "Platform settings have been updated successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to save settings", variant: "destructive" });
    },
  });

  const addTaxMutation = useMutation({
    mutationFn: async ({ title, rate, applicableTo }: { title: string; rate: number; applicableTo: "doctors" | "patients" | "both" }) =>
      apiRequest("POST", "/api/admin/tax-entries", { title, rate, applicableTo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tax-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tax-entries"] });
      setNewTaxTitle("");
      setNewTaxRate("");
      setNewTaxApplicableTo("doctors");
      toast({ title: "Tax Added", description: "Custom tax entry has been added." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to add tax", variant: "destructive" });
    },
  });

  const deleteTaxMutation = useMutation({
    mutationFn: async (id: string) =>
      apiRequest("DELETE", `/api/admin/tax-entries/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tax-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tax-entries"] });
      toast({ title: "Tax Removed", description: "Custom tax entry has been deleted." });
    },
  });

  const invalidateFees = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/fee-entries"] });
    queryClient.invalidateQueries({ queryKey: ["/api/fee-entries"] });
  };

  const addFeeMutation = useMutation({
    mutationFn: async ({ title, feeType, rate, applicableTo }: { title: string; feeType: "amount" | "percentage"; rate: number; applicableTo: "doctors" | "patients" | "both" }) =>
      apiRequest("POST", "/api/admin/fee-entries", { title, feeType, rate, applicableTo }),
    onSuccess: () => {
      invalidateFees();
      setNewFeeTitle("");
      setNewFeeType("");
      setNewFeeRate("");
      setNewFeeApplicableTo("");
      toast({ title: "Fee Added", description: "Custom fee has been added." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to add fee", variant: "destructive" });
    },
  });

  const toggleFeeMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) =>
      apiRequest("PATCH", `/api/admin/fee-entries/${id}`, { enabled }),
    onSuccess: () => {
      invalidateFees();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to update fee", variant: "destructive" });
    },
  });

  const deleteFeeMutation = useMutation({
    mutationFn: async (id: string) =>
      apiRequest("DELETE", `/api/admin/fee-entries/${id}`),
    onSuccess: () => {
      invalidateFees();
      setFeeToDelete(null);
      toast({ title: "Fee Removed", description: "Custom fee has been deleted." });
    },
    onError: () => {
      setFeeToDelete(null);
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      platformCommissionRate: parseInt(settings.platformCommissionRate) || 10,
      bookingCharges: parseInt(settings.bookingCharges) || 100,
      taxRate: parseInt(settings.taxRate) || 4,
      maxAdvanceBookingDays: parseInt(settings.maxAdvanceBookingDays) || 30,
      minBookingNoticeHours: parseInt(settings.minBookingNoticeHours) || 2,
      defaultSlotDuration: parseInt(settings.defaultSlotDuration) || 30,
      defaultBufferTime: parseInt(settings.defaultBufferTime) || 10,
      emailNotifications: settings.emailNotifications,
      smsNotifications: settings.smsNotifications,
      pushNotifications: settings.pushNotifications,
      autoConfirmAppointments: settings.autoConfirmAppointments,
      requireDoctorVerification: settings.requireDoctorVerification,
      allowOnlinePayments: settings.allowOnlinePayments,
      allowClinicPayments: settings.allowClinicPayments,
      defaultLanguage: settings.defaultLanguage,
      maintenanceMode: settings.maintenanceMode,
      cancellationFee: parseInt(settings.cancellationFee) || 300,
      stampDutyEnabled: systemTaxes.find((t) => t.id === "stamp")?.enabled ?? false,
      vatEnabled: systemTaxes.find((t) => t.id === "vat")?.enabled ?? true,
      withholdingTaxEnabled: systemTaxes.find((t) => t.id === "withholding")?.enabled ?? true,
    });
  };

  const handleMaintenanceToggle = (value: boolean) => {
    if (value) {
      // Show confirmation popup — don't activate yet
      setMaintStartTime(toLocalDatetimeValue(new Date()));
      setMaintEndTime("");
      setMaintenanceDialog(true);
    } else {
      // Turning off is high-impact — confirm before saving
      setMaintenanceDisableDialog(true);
    }
  };

  const handleMaintenanceDisableConfirm = () => {
    setMaintenanceDisableDialog(false);
    update("maintenanceMode", false);
    saveMutation.mutate({
      maintenanceMode: false,
      maintenanceStartTime: null,
      maintenanceEndTime: null,
    });
  };

  const handleMaintenanceConfirm = () => {
    if (!maintEndTime) {
      toast({ title: "End time required", description: "Please set an expected end time.", variant: "destructive" });
      return;
    }
    setMaintenanceDialog(false);
    update("maintenanceMode", true);
    saveMutation.mutate({
      maintenanceMode: true,
      maintenanceStartTime: new Date(maintStartTime).toISOString(),
      maintenanceEndTime: new Date(maintEndTime).toISOString(),
    });
  };

  const handleAddTax = () => {
    const title = newTaxTitle.trim();
    const rate = parseFloat(newTaxRate);
    if (!title) {
      toast({ title: "Error", description: "Please enter a tax title", variant: "destructive" });
      return;
    }
    if (isNaN(rate) || rate <= 0) {
      toast({ title: "Error", description: "Please enter a valid tax rate", variant: "destructive" });
      return;
    }
    addTaxMutation.mutate({ title, rate, applicableTo: newTaxApplicableTo });
  };

  const handleAddFee = () => {
    const title = newFeeTitle.trim();
    const rate = parseFloat(newFeeRate);
    if (!title) {
      toast({ title: "Error", description: "Please enter a fee title", variant: "destructive" });
      return;
    }
    if (!newFeeType) {
      toast({ title: "Error", description: "Please select a fee type", variant: "destructive" });
      return;
    }
    if (isNaN(rate) || rate <= 0) {
      toast({ title: "Error", description: "Please enter a valid fee rate", variant: "destructive" });
      return;
    }
    if (newFeeType === "percentage" && rate > maxFeePercentage) {
      toast({ title: "Error", description: `Percentage rate cannot exceed ${maxFeePercentage}%`, variant: "destructive" });
      return;
    }
    if (newFeeType === "amount" && maxFeeAmount > 0 && rate > maxFeeAmount) {
      toast({ title: "Error", description: `Amount cannot exceed LKR ${maxFeeAmount.toLocaleString()} (the highest consultation fee)`, variant: "destructive" });
      return;
    }
    if (!newFeeApplicableTo) {
      toast({ title: "Error", description: "Please select to whom the fee applies", variant: "destructive" });
      return;
    }
    addFeeMutation.mutate({ title, feeType: newFeeType, rate, applicableTo: newFeeApplicableTo });
  };

  // Human-readable description based on who the fee applies to
  const feeDescription = (applicableTo: "doctors" | "patients" | "both") =>
    applicableTo === "doctors"
      ? "Deducted from doctor payouts"
      : applicableTo === "patients"
      ? "Added to patient invoice"
      : "Deducted from doctors and added to patient invoice";

  // Display value: amount as "Rs. X", percentage as "X%"
  const feeValueLabel = (fee: FeeEntry) =>
    fee.feeType === "percentage"
      ? `${fee.rate}%`
      : `Rs. ${fee.rate.toLocaleString()}`;

  const update = (key: string, value: unknown) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  if (isLoading) return <LoadingPage message="Loading settings..." />;

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-muted-foreground">Failed to load settings. Please try again.</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-heading font-bold">Platform Settings</h1>
        <p className="text-muted-foreground">Configure platform-wide settings and preferences</p>
      </div>

      {/* ── Payment & Commission ── */}
      {activeTab === "payment" && (
        <>
          <div className="border border-primary/40 rounded-2xl p-6 space-y-6">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                  <rect x="2" y="5" width="20" height="14" rx="2"/>
                  <line x1="2" y1="10" x2="22" y2="10"/>
                </svg>
                <h2 className="font-semibold">Payment &amp; Commission Settings</h2>
              </div>
              <p className="text-sm text-muted-foreground mt-1">Configure payment methods and commission rates</p>
            </div>

            {/* 3 spinner boxes */}
            <div className="flex gap-4">
              <SpinnerBox
                label="Platform Commission (%)"
                value={settings.platformCommissionRate}
                unit="%"
                description="Percentage charged on each consultation"
                onChange={(v) => update("platformCommissionRate", v)}
                min={0}
                max={100}
                testId="input-commission"
              />
              <SpinnerBox
                label="Booking Charges (LKR)"
                value={settings.bookingCharges}
                unit="LKR"
                description="Fixed fee per appointment booking"
                onChange={(v) => update("bookingCharges", v)}
                min={0}
                max={10000}
                step={50}
                testId="input-booking-charges"
              />
              <SpinnerBox
                label="Tax Rate (%)"
                value={settings.taxRate}
                unit="%"
                description="Tax percentage on consultation fees"
                onChange={(v) => update("taxRate", v)}
                min={0}
                max={50}
                testId="input-tax"
              />
              <SpinnerBox
                label="Cancellation fees (LKR)"
                value={settings.cancellationFee}
                unit="LKR"
                description="Fixed fee per consultation"
                onChange={(v) => update("cancellationFee", v)}
                min={0}
                max={10000}
                step={50}
                testId="input-cancellation-fee"
              />
            </div>

            <Separator />

            {/* Add new Tax */}
            <div className="border border-primary/30 rounded-xl p-5 space-y-4">
              <h3 className="font-semibold text-sm">Add new Tax</h3>
              <div className="flex gap-3 items-end">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="taxTitle" className="text-xs font-medium">
                    Tax Title<span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="taxTitle"
                    placeholder="Booking Charges"
                    value={newTaxTitle}
                    onChange={(e) => setNewTaxTitle(e.target.value)}
                    className="border-primary/30"
                    data-testid="input-tax-title"
                  />
                </div>
                <div className="w-44 space-y-1.5">
                  <Label htmlFor="newTaxRate" className="text-xs font-medium">
                    Tax Rate<span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="newTaxRate"
                    type="number"
                    placeholder="0%"
                    min={0}
                    max={100}
                    value={newTaxRate}
                    onChange={(e) => setNewTaxRate(e.target.value)}
                    className="border-primary/30"
                    data-testid="input-new-tax-rate"
                  />
                </div>
                <div className="w-44 space-y-1.5">
                  <Label className="text-xs font-medium">To whom</Label>
                  <Select value={newTaxApplicableTo} onValueChange={(v) => setNewTaxApplicableTo(v as "doctors" | "patients" | "both")}>
                    <SelectTrigger className="border-primary/30 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="doctors">
                        <span className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200">Doctors</span>
                        </span>
                      </SelectItem>
                      <SelectItem value="patients">
                        <span className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-pink-100 text-pink-600 border border-pink-200">Patients</span>
                        </span>
                      </SelectItem>
                      <SelectItem value="both">
                        <span className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">Both</span>
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleAddTax}
                  disabled={addTaxMutation.isPending}
                  className="gap-1.5 shrink-0"
                  data-testid="button-add-tax"
                >
                  {addTaxMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>Add Tax <Plus className="h-4 w-4" /></>
                  )}
                </Button>
              </div>

              {/* Recently Added Taxes */}
              <div className="pt-1">
                <h3 className="text-sm font-semibold text-foreground mb-1">Recently Added Taxes</h3>
                <div className="divide-y divide-border">
                  {systemTaxes.map((tax) => (
                    <div key={tax.id} className="flex items-center py-3">
                      {/* Left: name + enabled badge + description */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">
                            {tax.title} ({tax.rate}%)
                          </span>
                          {tax.enabled && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full border border-green-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
                              Enabled
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{tax.description}</p>
                      </div>
                      {/* Center: badge in true middle — equal thirds layout */}
                      <div className="flex-1 flex justify-center">
                        <span className={`px-4 py-1 rounded-md text-sm font-medium ${
                          tax.applicableTo === "doctors"
                            ? "bg-purple-100 text-purple-700 border border-purple-200"
                            : "bg-pink-100 text-pink-600 border border-pink-200"
                        }`}>
                          {tax.applicableTo === "doctors" ? "Doctors" : "Patients"}
                        </span>
                      </div>
                      {/* Right: toggle pushed to end in its own flex-1 column */}
                      <div className="flex-1 flex justify-end">
                        <Switch
                          checked={tax.enabled}
                          onCheckedChange={() => toggleSystemTax(tax.id)}
                          data-testid={`switch-tax-${tax.id}`}
                        />
                      </div>
                    </div>
                  ))}

                  {/* User-added dynamic taxes */}
                  {!taxLoading && taxEntries.map((entry) => (
                    <div key={entry.id} className="flex items-center py-3">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold text-foreground">
                          {entry.title} ({entry.rate}%)
                        </span>
                      </div>
                      <div className="flex-1 flex justify-center">
                        <span className={`px-4 py-1 rounded-md text-sm font-medium ${
                          entry.applicableTo === "doctors"
                            ? "bg-purple-100 text-purple-700 border border-purple-200"
                            : entry.applicableTo === "patients"
                            ? "bg-pink-100 text-pink-600 border border-pink-200"
                            : "bg-orange-100 text-orange-700 border border-orange-200"
                        }`}>
                          {entry.applicableTo === "doctors" ? "Doctors" : entry.applicableTo === "patients" ? "Patients" : "Both"}
                        </span>
                      </div>
                      <div className="flex-1 flex justify-end">
                        <button
                          onClick={() => deleteTaxMutation.mutate(entry.id)}
                          disabled={deleteTaxMutation.isPending}
                          className="text-destructive hover:text-destructive/70 transition-colors shrink-0"
                          data-testid={`button-delete-tax-${entry.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Separator />

            {/* Add new Fee */}
            <div className="border border-primary/30 rounded-xl p-5 space-y-4">
              <h3 className="font-semibold text-sm">Add new Fee</h3>
              <div className="flex gap-3 items-end">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="feeTitle" className="text-xs font-medium">
                    Fee Title<span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="feeTitle"
                    placeholder="Booking Charges"
                    value={newFeeTitle}
                    onChange={(e) => setNewFeeTitle(e.target.value)}
                    className="border-primary/30"
                    data-testid="input-fee-title"
                  />
                </div>
                <div className="w-40 space-y-1.5">
                  <Label className="text-xs font-medium">
                    Fee Type<span className="text-destructive">*</span>
                  </Label>
                  <Select value={newFeeType} onValueChange={(v) => setNewFeeType(v as "amount" | "percentage")}>
                    <SelectTrigger className="border-primary/30 h-9" data-testid="select-fee-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="amount">Amount</SelectItem>
                      <SelectItem value="percentage">Percentage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-40 space-y-1.5">
                  <Label htmlFor="newFeeRate" className="text-xs font-medium">
                    Fee Rate<span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="newFeeRate"
                    type="number"
                    placeholder={newFeeType === "percentage" ? "0%" : "0"}
                    min={0}
                    max={newFeeType === "percentage" ? maxFeePercentage : (maxFeeAmount > 0 ? maxFeeAmount : undefined)}
                    value={newFeeRate}
                    onChange={(e) => setNewFeeRate(e.target.value)}
                    className={`border-primary/30 ${feeRateError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    data-testid="input-new-fee-rate"
                  />
                </div>
                <div className="w-40 space-y-1.5">
                  <Label className="text-xs font-medium">
                    To whom<span className="text-destructive">*</span>
                  </Label>
                  <Select value={newFeeApplicableTo} onValueChange={(v) => setNewFeeApplicableTo(v as "doctors" | "patients" | "both")}>
                    <SelectTrigger className="border-primary/30 h-9" data-testid="select-fee-applicable">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="doctors">
                        <span className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200">Doctors</span>
                        </span>
                      </SelectItem>
                      <SelectItem value="patients">
                        <span className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-pink-100 text-pink-600 border border-pink-200">Patients</span>
                        </span>
                      </SelectItem>
                      <SelectItem value="both">
                        <span className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">Both</span>
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleAddFee}
                  disabled={addFeeMutation.isPending || !!feeRateError}
                  className="gap-1.5 shrink-0"
                  data-testid="button-add-fee"
                >
                  {addFeeMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>Add Fee <Plus className="h-4 w-4" /></>
                  )}
                </Button>
              </div>

              {feeRateError ? (
                <p className="text-xs text-destructive" data-testid="text-fee-rate-error">{feeRateError}</p>
              ) : newFeeType === "amount" && maxFeeAmount > 0 ? (
                <p className="text-xs text-muted-foreground">Max amount: LKR {maxFeeAmount.toLocaleString()} (typical consultation fee)</p>
              ) : newFeeType === "percentage" ? (
                <p className="text-xs text-muted-foreground">Max percentage: {maxFeePercentage}%</p>
              ) : null}

              {/* Recently Added Fees */}
              <div className="pt-1">
                <h3 className="text-sm font-semibold text-foreground mb-1">Recently Added Fees</h3>
                <div className="divide-y divide-border">
                  {!feeLoading && feeEntries.length === 0 && (
                    <p className="text-xs text-muted-foreground py-3">No fees added yet.</p>
                  )}
                  {!feeLoading && feeEntries.map((fee) => (
                    <div key={fee.id} className="flex items-center py-3">
                      {/* Left: name + value + enabled badge + description */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">
                            {fee.title} ({feeValueLabel(fee)})
                          </span>
                          {fee.enabled && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full border border-green-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
                              Enabled
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{feeDescription(fee.applicableTo)}</p>
                      </div>
                      {/* Center: To whom pill */}
                      <div className="flex-1 flex justify-center">
                        <span className={`px-4 py-1 rounded-md text-sm font-medium ${
                          fee.applicableTo === "doctors"
                            ? "bg-purple-100 text-purple-700 border border-purple-200"
                            : fee.applicableTo === "patients"
                            ? "bg-pink-100 text-pink-600 border border-pink-200"
                            : "bg-orange-100 text-orange-700 border border-orange-200"
                        }`}>
                          {fee.applicableTo === "doctors" ? "Doctors" : fee.applicableTo === "patients" ? "Patients" : "Both"}
                        </span>
                      </div>
                      {/* Right: toggle + delete */}
                      <div className="flex-1 flex justify-end items-center gap-3">
                        <Switch
                          checked={fee.enabled}
                          onCheckedChange={(v) => toggleFeeMutation.mutate({ id: fee.id, enabled: v })}
                          data-testid={`switch-fee-${fee.id}`}
                        />
                        <button
                          onClick={() => setFeeToDelete(fee)}
                          disabled={deleteFeeMutation.isPending}
                          className="text-destructive hover:text-destructive/70 transition-colors shrink-0"
                          data-testid={`button-delete-fee-${fee.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Delete Fee confirmation */}
            <Dialog open={!!feeToDelete} onOpenChange={(open) => { if (!open) setFeeToDelete(null); }}>
              <DialogContent className="max-w-sm rounded-2xl">
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold">Delete this fee?</DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground pt-1">
                    Are you sure you want to delete{" "}
                    <span className="font-semibold text-foreground">{feeToDelete?.title}</span>? This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setFeeToDelete(null)}
                    data-testid="button-cancel-delete-fee"
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                    disabled={deleteFeeMutation.isPending}
                    onClick={() => { if (feeToDelete) deleteFeeMutation.mutate(feeToDelete.id); }}
                    data-testid="button-confirm-delete-fee"
                  >
                    {deleteFeeMutation.isPending ? "Deleting..." : "Delete"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="px-8 gap-2"
              data-testid="button-save"
            >
              {saveMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Saving...</>
              ) : (
                <>
                  Save Changes
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                </>
              )}
            </Button>
          </div>
        </>
      )}

      {/* ── Security & Verification ── */}
      {activeTab === "security" && (
        <>
          <div className="border border-primary/40 rounded-2xl p-6 space-y-6">
            <div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <h2 className="font-semibold">Security &amp; Verification</h2>
              </div>
              <p className="text-sm text-muted-foreground mt-1">Configure security and verification settings</p>
            </div>

            {/* Require Doctor Verification — functional */}
            <div className="flex items-center justify-between py-1">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">Require Doctor Verification</p>
                  {settings.requireDoctorVerification && (
                    <span className="flex items-center gap-1 text-xs text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-full">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" />
                      Enabled
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  New doctors must be verified by admin before accepting appointments
                </p>
              </div>
              <Switch
                checked={settings.requireDoctorVerification}
                onCheckedChange={(v) => update("requireDoctorVerification", v)}
                data-testid="switch-doctor-verification"
              />
            </div>

            <Separator />

            {/* Two-factor Authentication — UI only, no backend */}
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="font-medium">Two-factor Authentication</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Require 2FA for admin accounts
                </p>
              </div>
              <Switch
                checked={settings.twoFactorAuth}
                onCheckedChange={(v) => update("twoFactorAuth", v)}
                data-testid="switch-2fa"
              />
            </div>

            <Separator />

            {/* Session Timeout — UI only, no backend */}
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="font-medium">Session Timeout</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Auto-logout inactive sessions after 30 minutes
                </p>
              </div>
              <Switch
                checked={settings.sessionTimeout}
                onCheckedChange={(v) => update("sessionTimeout", v)}
                data-testid="switch-session-timeout"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="px-8 gap-2"
              data-testid="button-save-security"
            >
              {saveMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Saving...</>
              ) : (
                <>
                  Save Changes
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                </>
              )}
            </Button>
          </div>
        </>
      )}

      {/* ── Danger Zone ── */}
      {activeTab === "danger" && (
        <>
          <div className="border border-destructive/40 rounded-2xl p-6 space-y-6">
            <div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <h2 className="font-semibold text-destructive">Danger Zone</h2>
              </div>
              <p className="text-sm text-muted-foreground mt-1">These settings can affect platform availability</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="font-medium">Maintenance Mode</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Temporarily disable the platform for maintenance. Users will see a maintenance page.
                  </p>
                </div>
                <Switch
                  checked={settings.maintenanceMode}
                  onCheckedChange={handleMaintenanceToggle}
                  data-testid="switch-maintenance"
                />
              </div>
              {settings.maintenanceMode && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-3">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Maintenance is currently active</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">End Time</Label>
                      <input
                        type="datetime-local"
                        value={maintEndTime}
                        onChange={(e) => setMaintEndTime(e.target.value)}
                        className="w-full text-sm rounded-md border border-input bg-background px-3 py-1.5 text-foreground"
                      />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-amber-400 text-amber-800 dark:text-amber-300 hover:bg-amber-100"
                    onClick={() => {
                      if (!maintEndTime) {
                        toast({ title: "End time required", variant: "destructive" });
                        return;
                      }
                      saveMutation.mutate({
                        maintenanceMode: true,
                        maintenanceEndTime: new Date(maintEndTime).toISOString(),
                      });
                    }}
                  >
                    Update End Time
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              variant="destructive"
              className="px-8"
              data-testid="button-save-danger"
            >
              {saveMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
              ) : "Save Changes"}
            </Button>
          </div>
        </>
      )}
    </div>

    {/* Maintenance Mode Confirmation Dialog */}
    <Dialog open={maintenanceDialog} onOpenChange={setMaintenanceDialog}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Enable Maintenance Mode?
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            This will disable the platform for <strong>all users</strong>. They will see a maintenance page until you turn this off manually.
          </p>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Start Date &amp; Time</Label>
              <input
                type="datetime-local"
                value={maintStartTime}
                onChange={(e) => setMaintStartTime(e.target.value)}
                className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 text-foreground"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Expected End Date &amp; Time <span className="text-destructive">*</span></Label>
              <input
                type="datetime-local"
                value={maintEndTime}
                onChange={(e) => setMaintEndTime(e.target.value)}
                className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 text-foreground"
              />
              <p className="text-xs text-muted-foreground">Shown to users on the maintenance page. You must turn off maintenance manually.</p>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setMaintenanceDialog(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleMaintenanceConfirm} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enabling...</> : "Enable Maintenance"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Confirm before turning maintenance off */}
    <Dialog open={maintenanceDisableDialog} onOpenChange={setMaintenanceDisableDialog}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Turn off Maintenance Mode?
          </DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <p className="text-sm text-muted-foreground">
            Turning off Maintenance Mode will make the platform live to <strong>all users</strong> immediately. Continue?
          </p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setMaintenanceDisableDialog(false)} data-testid="button-cancel-disable-maintenance">Cancel</Button>
          <Button variant="destructive" onClick={handleMaintenanceDisableConfirm} disabled={saveMutation.isPending} data-testid="button-confirm-disable-maintenance">
            {saveMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Turn Off Maintenance"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
