import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Users,
  Wallet,
  RefreshCcw,
  CalendarClock,
  BadgeDollarSign,
  X,
  AlertTriangle,
  Info,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingPage } from "@/components/ui/loading-spinner";

interface DoctorPayout {
  doctorId: string;
  doctorName: string;
  registrationNumber: string;
  bankName: string | null;
  bankAccountNumber: string | null;
  earnAmount: number;
  completedSessions: number;
  totalSessions: number;
  platformFees: number;
  platformCommissionRate: number;
  cancellationRate: number;
  cancellationFees: number;
  applicableTax: number;
  vatEnabled: boolean;
  withholdingTaxEnabled: boolean;
  stampDutyEnabled: boolean;
  vatAmount: number;
  withholdingAmount: number;
  stampDutyAmount: number;
  payoutAmount: number;
}

interface PayoutStats {
  pendingPayoutsCount: number;
  totalOutstanding: number;
  completedLastMonthAmount: number;
  completedLastMonthCount: number;
  nextPayoutDate: string;
}

interface PayoutData {
  doctors: DoctorPayout[];
  stats: PayoutStats;
}

function formatLKR(amount: number) {
  return `LKR ${amount.toLocaleString("en-LK")}`;
}

function doctorDisplayName(name: string) {
  return name.startsWith("Dr.") || name.startsWith("Dr ") ? name : `Dr. ${name}`;
}

function amountColor(value: number) {
  return value > 0 ? "text-red-500" : "text-[#3746D3]";
}

function maskAccount(bankName: string | null, accountNumber: string | null) {
  if (!bankName && !accountNumber) return null;
  const bank = bankName ?? "";
  const masked = accountNumber ? `****${accountNumber.slice(-4)}` : "****";
  return `${bank} ${masked}`.trim();
}

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return `${format(start, "MMMM d")}–${format(end, "d, yyyy")}`;
}

// ─── Payout Modal ────────────────────────────────────────────────────────────
function PayoutModal({ doc, onClose }: { doc: DoctorPayout; onClose: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [vatChecked, setVatChecked] = useState(doc.vatEnabled);
  const [withholdingChecked, setWithholdingChecked] = useState(doc.withholdingTaxEnabled);

  const totalTaxes =
    (vatChecked ? doc.vatAmount : 0) +
    (withholdingChecked ? doc.withholdingAmount : 0);

  const finalPayout = Math.max(
    0,
    doc.earnAmount - totalTaxes - doc.cancellationFees - doc.platformFees
  );

  const bankBadge = maskAccount(doc.bankName, doc.bankAccountNumber);

  const CheckCircle = ({ checked }: { checked: boolean }) => (
    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${
      checked ? "bg-emerald-500 border-emerald-500" : "border-muted-foreground/40"
    }`}>
      {checked && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="relative bg-[#f5f5f0] dark:bg-card rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
              </svg>
            </div>
            <div>
              <p className="font-bold text-foreground">Process doctor payout</p>
              <p className="text-xs text-muted-foreground">Monthly earning · {monthRange()}</p>
            </div>
          </div>

          {/* Doctor card */}
          <div className="bg-[#e8f3ef] dark:bg-primary/10 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="font-semibold text-foreground">{doctorDisplayName(doc.doctorName)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Ayurvedic Physician · {doc.registrationNumber}</p>
            </div>
            {bankBadge && (
              <span className="bg-emerald-600 text-white text-xs font-semibold px-3 py-1 rounded-full shrink-0 ml-3">
                {bankBadge}
              </span>
            )}
          </div>

          {/* Penalty banner */}
          {doc.cancellationRate > 0 && (
            <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-600 dark:text-red-400">
                Penalty active — cancellation rate {doc.cancellationRate}%. {formatLKR(doc.cancellationFees)} deducted.
              </p>
            </div>
          )}

          {/* STEP 1: tax checkboxes + breakdown */}
          {step === 1 && (
            <>
              <div className="bg-white dark:bg-muted/20 rounded-xl p-4 space-y-3">
                <div>
                  <p className="font-semibold text-sm text-foreground">Applicable taxes</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Check to apply. Uncheck to exclude from this payout.</p>
                </div>
                <div className="flex items-center justify-between">
                  <button type="button" onClick={() => setVatChecked(!vatChecked)} className="flex items-center gap-2.5">
                    <CheckCircle checked={vatChecked} />
                    <span className={`text-sm ${vatChecked ? "text-foreground" : "text-muted-foreground"}`}>VAT (18%)</span>
                  </button>
                  <span className={`text-sm font-medium ${vatChecked ? "text-red-500" : "text-muted-foreground"}`}>
                    − {formatLKR(doc.vatAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <button type="button" onClick={() => setWithholdingChecked(!withholdingChecked)} className="flex items-center gap-2.5">
                    <CheckCircle checked={withholdingChecked} />
                    <span className={`text-sm ${withholdingChecked ? "text-foreground" : "text-muted-foreground"}`}>Withholding tax (5%)</span>
                  </button>
                  <span className={`text-sm font-medium ${withholdingChecked ? "text-red-500" : "text-muted-foreground"}`}>
                    − {formatLKR(doc.withholdingAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between opacity-50">
                  <div className="flex items-center gap-2.5">
                    <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/40 shrink-0" />
                    <span className="text-sm text-muted-foreground">Stamp duty (1%)</span>
                  </div>
                  <span className="text-sm text-muted-foreground">− {formatLKR(doc.stampDutyAmount)}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between">
                  <span className="text-sm font-medium text-foreground">Total taxes</span>
                  <span className="text-sm font-semibold text-red-500">− {formatLKR(totalTaxes)}</span>
                </div>
              </div>

              <div className="bg-white dark:bg-muted/20 rounded-xl overflow-hidden divide-y divide-border">
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-sm text-muted-foreground">Earning amount</span>
                  <span className="text-sm font-medium text-foreground">{formatLKR(doc.earnAmount)}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-sm text-muted-foreground">Cancellation fee</span>
                  <span className={`text-sm font-medium ${doc.cancellationFees > 0 ? "text-red-500" : "text-foreground"}`}>
                    {doc.cancellationFees > 0 ? `− ${formatLKR(doc.cancellationFees)}` : formatLKR(0)}
                  </span>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-sm text-muted-foreground">AyurPath platform fee ({doc.platformCommissionRate}%)</span>
                  <span className="text-sm font-medium text-red-500">− {formatLKR(doc.platformFees)}</span>
                </div>
                <div className="flex justify-between px-4 py-3 bg-muted/10">
                  <span className="text-sm font-bold text-foreground">Payout Amount</span>
                  <span className="text-sm font-bold text-foreground">{formatLKR(finalPayout)}</span>
                </div>
              </div>
            </>
          )}

          {/* STEP 2: confirmation breakdown */}
          {step === 2 && (
            <div className="bg-white dark:bg-muted/20 rounded-xl overflow-hidden divide-y divide-border">
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-sm text-muted-foreground">Earning amount</span>
                <span className="text-sm font-medium text-foreground">{formatLKR(doc.earnAmount)}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-sm text-muted-foreground">Cancellation fee</span>
                <span className={`text-sm font-medium ${doc.cancellationFees > 0 ? "text-red-500" : "text-foreground"}`}>
                  {doc.cancellationFees > 0 ? `− ${formatLKR(doc.cancellationFees)}` : formatLKR(0)}
                </span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-sm text-muted-foreground">AyurPath platform fee ({doc.platformCommissionRate}%)</span>
                <span className="text-sm font-medium text-red-500">− {formatLKR(doc.platformFees)}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-sm text-muted-foreground">Applicable tax</span>
                <span className="text-sm font-medium text-red-500">− {formatLKR(totalTaxes)}</span>
              </div>
              <div className="flex justify-between px-4 py-3 bg-muted/10">
                <span className="text-sm font-bold text-foreground">Payout Amount</span>
                <span className="text-sm font-bold text-foreground">{formatLKR(finalPayout)}</span>
              </div>
            </div>
          )}

          {/* Info note */}
          <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2.5">
            <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Payout will be credited to the doctor's registered bank account within 3–5 business days.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Button
              variant="outline"
              className="flex-1 border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
              onClick={step === 1 ? onClose : () => setStep(1)}
            >
              <X className="w-4 h-4 mr-1.5" />
              Cancel
            </Button>
            {step === 1 ? (
              <Button className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white" onClick={() => setStep(2)}>
                Next <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            ) : (
              <Button className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                Confirm Payout
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminPayoutsPage() {
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorPayout | null>(null);

  const { data, isLoading, isError } = useQuery<PayoutData>({
    queryKey: ["/api/admin/payouts"],
    staleTime: 60 * 1000,
  });

  if (isLoading) return <LoadingPage />;
  if (isError || !data) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Failed to load payout data.
      </div>
    );
  }

  const { doctors, stats } = data;
  const nextPayout = new Date(stats.nextPayoutDate);

  return (
    <div className="p-6 space-y-6">
      {selectedDoctor && (
        <PayoutModal doc={selectedDoctor} onClose={() => setSelectedDoctor(null)} />
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Payout Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review earnings and disburse payments to verified practitioners.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-primary/30">
          <CardContent className="p-5 flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground font-medium">Pending Payouts</span>
            </div>
            <p className="text-4xl font-bold text-foreground">{stats.pendingPayoutsCount}</p>
            <p className="text-sm text-primary font-medium">{formatLKR(stats.totalOutstanding)} in queue</p>
          </CardContent>
        </Card>

        <Card className="border border-primary/30">
          <CardContent className="p-5 flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <BadgeDollarSign className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground font-medium">Total outstanding</span>
            </div>
            <p className="text-2xl font-bold text-foreground whitespace-nowrap">{formatLKR(stats.totalOutstanding)}</p>
            <p className="text-sm text-muted-foreground">Ready for payout</p>
          </CardContent>
        </Card>

        <Card className="border border-primary/30">
          <CardContent className="p-5 flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <RefreshCcw className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground font-medium">Completed last month</span>
            </div>
            <p className="text-2xl font-bold text-foreground whitespace-nowrap">{formatLKR(stats.completedLastMonthAmount)}</p>
            <p className="text-sm text-muted-foreground">{stats.completedLastMonthCount} successful transfers</p>
          </CardContent>
        </Card>

        <Card className="border border-primary/30">
          <CardContent className="p-5 flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <CalendarClock className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground font-medium">Next payout date</span>
            </div>
            <p className="text-2xl font-bold text-foreground whitespace-nowrap">{format(nextPayout, "MMM d, yyyy")}</p>
            <p className="text-sm text-muted-foreground">Scheduled · Friday</p>
          </CardContent>
        </Card>
      </div>

      {/* Payout Table */}
      <Card className="border border-primary/20">
        <CardContent className="p-0">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">Doctor Name</th>
                <th className="text-right px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">Earn Amount</th>
                <th className="text-center px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">Sessions</th>
                <th className="text-right px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">Platform Fees</th>
                <th className="text-center px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">Cancel Rate</th>
                <th className="text-right px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">Cancel Fees</th>
                <th className="text-right px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">Applicable Tax</th>
                <th className="text-right px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">Payout Amount</th>
                <th className="text-center px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody>
              {doctors.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-muted-foreground">
                    No payout data available for this month.
                  </td>
                </tr>
              ) : (
                doctors.map((doc) => (
                  <tr key={doc.doctorId} className="border-b border-border hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2.5 font-medium text-foreground whitespace-nowrap">
                      {doctorDisplayName(doc.doctorName)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-foreground whitespace-nowrap">
                      {formatLKR(doc.earnAmount)}
                    </td>
                    <td className="px-3 py-2.5 text-center text-foreground whitespace-nowrap">
                      {doc.completedSessions}/{doc.totalSessions}
                    </td>
                    <td className={`px-3 py-2.5 text-right whitespace-nowrap font-medium ${amountColor(doc.platformFees)}`}>
                      {formatLKR(doc.platformFees)}
                    </td>
                    <td className={`px-3 py-2.5 text-center whitespace-nowrap font-medium ${amountColor(doc.cancellationRate)}`}>
                      {doc.cancellationRate}%
                    </td>
                    <td className={`px-3 py-2.5 text-right whitespace-nowrap font-medium ${amountColor(doc.cancellationFees)}`}>
                      {formatLKR(doc.cancellationFees)}
                    </td>
                    <td className={`px-3 py-2.5 text-right whitespace-nowrap font-medium ${amountColor(doc.applicableTax)}`}>
                      {formatLKR(doc.applicableTax)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-foreground whitespace-nowrap">
                      {formatLKR(doc.payoutAmount)}
                    </td>
                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                      <Button
                        size="sm"
                        className="bg-orange-500 hover:bg-orange-600 text-white text-xs px-3 h-7 rounded-md"
                        disabled={doc.payoutAmount === 0}
                        onClick={() => setSelectedDoctor(doc)}
                      >
                        <Wallet className="w-3 h-3 mr-1" />
                        Pay Now
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}