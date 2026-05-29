import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, Download, DollarSign, Stethoscope, Wallet, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingPage } from "@/components/ui/loading-spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FilterView = "all" | "appointments" | "specialization" | "registrations" | "doctors";

interface ReportsData {
  revenueStats: {
    totalRevenue: number;
    payouts: number;
    netFees: number;
    totalRevenuePct: number;
    payoutsPct: number;
    netFeesPct: number;
  };
  weeklyAppointments: { week: string; completed: number; cancelled: number }[];
  specializationBookings: { name: string; value: number }[];
  patientRegistrations: { week: string; patients: number }[];
  registrationGrowth: number;
  doctorPerformance: {
    id: string;
    name: string;
    specializations: string[];
    status: string;
    appointments: number;
    rating: number;
    totalReviews: number;
  }[];
}

const DONUT_COLORS = ["#2D6A4F", "#E67E22", "#8E44AD", "#2980B9", "#E74C3C", "#16A085", "#D35400", "#7F8C8D"];

function formatLKR(amount: number) {
  if (amount >= 1000000) return `LKR ${(amount / 1000000).toFixed(2)}M`;
  if (amount >= 1000) return `LKR ${(amount / 1000).toFixed(0)},${String(amount % 1000).padStart(3, "0")}`;
  return `LKR ${amount}`;
}

function PctBadge({ pct }: { pct: number }) {
  const positive = pct >= 0;
  return (
    <span className={`flex items-center gap-1 text-sm font-medium ${positive ? "text-emerald-600" : "text-red-500"}`}>
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {positive ? "+" : ""}{pct}% vs prev. period
    </span>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-1 text-sm">
      <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
      {rating.toFixed(1)}
    </span>
  );
}

function exportToCSV(data: ReportsData) {
  const lines: string[] = [];

  lines.push("REPORTS & ANALYTICS — Last 30 Days");
  lines.push("");

  lines.push("REVENUE SUMMARY");
  lines.push("Metric,Amount (LKR),% vs Prev Period");
  lines.push(`Total Platform Revenue,${data.revenueStats.totalRevenue},${data.revenueStats.totalRevenuePct}%`);
  lines.push(`Payouts to Doctors,${data.revenueStats.payouts},${data.revenueStats.payoutsPct}%`);
  lines.push(`Net Platform Fees,${data.revenueStats.netFees},${data.revenueStats.netFeesPct}%`);
  lines.push("");

  lines.push("WEEKLY APPOINTMENTS");
  lines.push("Week,Completed,Cancelled");
  data.weeklyAppointments.forEach(w => lines.push(`${w.week},${w.completed},${w.cancelled}`));
  lines.push("");

  lines.push("BOOKINGS BY SPECIALIZATION");
  lines.push("Specialization,Bookings");
  data.specializationBookings.forEach(s => lines.push(`${s.name},${s.value}`));
  lines.push("");

  lines.push("NEW PATIENT REGISTRATIONS");
  lines.push("Week,New Patients");
  data.patientRegistrations.forEach(p => lines.push(`${p.week},${p.patients}`));
  lines.push(`Growth (W1 to W4),${data.registrationGrowth}%`);
  lines.push("");

  lines.push("DOCTOR PERFORMANCE");
  lines.push("Doctor,Specializations,Status,Appointments,Rating");
  data.doctorPerformance.forEach(d =>
    lines.push(`"${d.name}","${d.specializations.join(", ")}",${d.status},${d.appointments},${d.rating.toFixed(1)}`)
  );

  const csv = lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ayurpath-report-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function AdminReportsPage() {
  const [view, setView] = useState<FilterView>("all");

  const { data, isLoading, isError } = useQuery<ReportsData>({
    queryKey: ["/api/admin/reports"],
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <LoadingPage />;

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Failed to load reports. Please try again.
      </div>
    );
  }

  const { revenueStats, weeklyAppointments, specializationBookings, patientRegistrations, registrationGrowth, doctorPerformance } = data;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Insights across revenue, bookings and patient growth.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium bg-muted text-muted-foreground">
            Last 30 Days
          </span>
          <Select value={view} onValueChange={(v) => setView(v as FilterView)}>
            <SelectTrigger className="h-8 text-xs w-[180px] rounded-full border bg-muted text-muted-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Regions</SelectItem>
              <SelectItem value="appointments">Appointments</SelectItem>
              <SelectItem value="specialization">Booking Specialization</SelectItem>
              <SelectItem value="registrations">New Patient Registration</SelectItem>
              <SelectItem value="doctors">Doctor Performance</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2" onClick={() => exportToCSV(data)}>
            <Download className="h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Revenue Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Platform Revenue</p>
                <p className="text-2xl font-bold mt-1">
                  LKR {revenueStats.totalRevenue.toLocaleString()}
                </p>
              </div>
              <div className="rounded-full bg-emerald-50 p-2">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
            <div className="mt-3">
              <PctBadge pct={revenueStats.totalRevenuePct} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Payouts to Doctors</p>
                <p className="text-2xl font-bold mt-1">
                  LKR {revenueStats.payouts.toLocaleString()}
                </p>
              </div>
              <div className="rounded-full bg-blue-50 p-2">
                <Stethoscope className="h-5 w-5 text-blue-600" />
              </div>
            </div>
            <div className="mt-3">
              <PctBadge pct={revenueStats.payoutsPct} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Net Platform Fees</p>
                <p className="text-2xl font-bold mt-1">
                  LKR {revenueStats.netFees.toLocaleString()}
                </p>
              </div>
              <div className="rounded-full bg-purple-50 p-2">
                <Wallet className="h-5 w-5 text-purple-600" />
              </div>
            </div>
            <div className="mt-3">
              <PctBadge pct={revenueStats.netFeesPct} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 1: Bar chart + Donut chart side by side */}
      {(view === "all" || view === "appointments" || view === "specialization") && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {(view === "all" || view === "appointments") && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Appointments — Completed vs. Cancelled</CardTitle>
                <p className="text-xs text-muted-foreground">Monthly appointments across the selected window</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={weeklyAppointments} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="completed" name="Completed" fill="#2D6A4F" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="cancelled" name="Cancelled" fill="#EF4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {(view === "all" || view === "specialization") && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Bookings by Specialization</CardTitle>
                <p className="text-xs text-muted-foreground">Share of total appointments</p>
              </CardHeader>
              <CardContent>
                {specializationBookings.every(s => s.value === 0) ? (
                  <div className="flex items-center justify-center h-[260px] text-muted-foreground text-sm">
                    No bookings data available
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="55%" height={260}>
                      <PieChart>
                        <Pie
                          data={specializationBookings.filter(s => s.value > 0)}
                          cx="50%"
                          cy="50%"
                          innerRadius={70}
                          outerRadius={110}
                          dataKey="value"
                          stroke="none"
                        >
                          {specializationBookings.filter(s => s.value > 0).map((item, i) => (
                            <Cell key={item.name} fill={DONUT_COLORS[specializationBookings.findIndex(s => s.name === item.name) % DONUT_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-col gap-2 text-xs">
                      {specializationBookings.map((item, i) => (
                        <div key={item.name} className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: item.value > 0 ? DONUT_COLORS[i % DONUT_COLORS.length] : "#D1D5DB" }}
                          />
                          <span className={item.value > 0 ? "text-foreground" : "text-muted-foreground"}>
                            {item.name}
                            {item.value === 0 && <span className="ml-1 text-[10px] text-muted-foreground">(no bookings)</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Row 2: Area chart + Doctor table side by side */}
      {(view === "all" || view === "registrations" || view === "doctors") && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {(view === "all" || view === "registrations") && (
            <Card className="flex flex-col">
              <CardHeader className="pb-2 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">New Patient Registrations</CardTitle>
                    <p className="text-xs text-muted-foreground">Weekly signups over the selected period</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${registrationGrowth >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                    {registrationGrowth >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {registrationGrowth >= 0 ? "+" : ""}{registrationGrowth}%
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 pb-6">
                <ResponsiveContainer width="100%" height="100%" minHeight={260}>
                  <AreaChart data={patientRegistrations}>
                    <defs>
                      <linearGradient id="patientGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2D6A4F" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#2D6A4F" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Area type="monotone" dataKey="patients" name="New Patients" stroke="#2D6A4F" strokeWidth={2} fill="url(#patientGradient)" dot={{ r: 4, fill: "#2D6A4F" }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {(view === "all" || view === "doctors") && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Doctor Performance</CardTitle>
                <p className="text-xs text-muted-foreground">Top practitioners by activity & rating</p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Doctor</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Status</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs">Appts</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs">Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {doctorPerformance.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center py-8 text-muted-foreground text-xs px-4">No doctor data available</td>
                        </tr>
                      ) : (
                        doctorPerformance.map((doc) => (
                          <tr key={doc.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-medium text-foreground leading-tight">{doc.name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{doc.specializations.slice(0, 2).join(", ") || "—"}</p>
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                variant={doc.status === "verified" ? "default" : "secondary"}
                                className={doc.status === "verified" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs" : "bg-amber-100 text-amber-700 hover:bg-amber-100 text-xs"}
                              >
                                {doc.status === "verified" ? "Verified" : "Pending"}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-right font-medium">{doc.appointments}</td>
                            <td className="px-4 py-3 text-right"><StarRating rating={doc.rating} /></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
