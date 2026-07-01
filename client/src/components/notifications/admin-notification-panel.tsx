import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isToday, isYesterday } from "date-fns";
import { ArrowUpRight, CheckCheck } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useTheme } from "@/lib/theme-context";
import type { Notification } from "@shared/schema";

// ─── Types ────────────────────────────────────────────────────────────────────
type FilterType = "all" | "registration" | "verification" | "payments" | "appointments" | "complaints";
type CardVariant = "green" | "red" | "orange";

// ─── Filters ──────────────────────────────────────────────────────────────────
const FILTERS: { key: FilterType; label: string }[] = [
  { key: "all",           label: "All" },
  { key: "registration",  label: "Registration" },
  { key: "verification",  label: "Verification" },
  { key: "payments",      label: "Payments" },
  { key: "appointments",  label: "Appointments" },
  { key: "complaints",    label: "Complaints" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getVariant(n: Notification): CardVariant {
  const text = (n.title + " " + n.message).toLowerCase();
  if (
    text.includes("pending") ||
    text.includes("complaint") ||
    text.includes("overdue")
  ) return "orange";
  if (
    text.includes("failed") ||
    text.includes("reset") ||
    text.includes("declined") ||
    text.includes("critical") ||
    text.includes("unrecognised")
  ) return "red";
  return "green";
}

function getIcon(n: Notification): string {
  const title = n.title.toLowerCase();
  if (title.includes("registration"))                            return "/icons/new-registration.png";
  if (title.includes("failed") || title.includes("transaction") || title.includes("reset") || title.includes("password")) return "/icons/warning.png";
  if (title.includes("pending") || title.includes("overdue"))   return "/icons/pending.png";
  if (title.includes("maintenance") || title.includes("maintenance mode")) return "/icons/system-update.png";
  if (title.includes("milestone") || title.includes("reached")) return "/icons/reached.png";
  if (title.includes("complaint"))                               return "/icons/complaint.png";
  return "/icons/new-registration.png";
}

function getBadgeLabel(n: Notification): string {
  const title = n.title.toLowerCase();
  if (title.includes("registration"))                            return "New Registration";
  if (title.includes("failed") || title.includes("transaction") || title.includes("critical")) return "Critical";
  if (title.includes("reset") || title.includes("password"))     return "Admin Request";
  if (title.includes("pending") || title.includes("overdue"))    return "Reminder";
  if (title.includes("maintenance") || title.includes("completed")) return "Resolved";
  if (title.includes("milestone") || title.includes("reached"))  return "Reached";
  if (title.includes("complaint"))                               return "Complaint";
  return "System";
}

function getButton(n: Notification) {
  const text  = (n.title + " " + n.message).toLowerCase();
  const isDemo = n.id.startsWith("demo-");
  if (text.includes("registration"))             return { label: "Review Doctor",   href: "/admin/doctors" };
  if (text.includes("failed") || text.includes("declined"))
                                                  return { label: "Resolve Issue",   href: isDemo ? null : "/admin/payments" };
  if (text.includes("reset") || text.includes("unrecognised")) return null;
  if (text.includes("pending") || text.includes("overdue"))
                                                  return { label: "Review Doctor",   href: "/admin" };
  if (text.includes("maintenance") || text.includes("uptime")) return null;
  if (text.includes("milestone") || text.includes("reached"))  return null;
  if (text.includes("complaint"))                return { label: "View Complaint",  href: "/admin/patients" };
  return null;
}

function matchesFilter(n: Notification, filter: FilterType): boolean {
  if (filter === "all") return true;
  const text = (n.title + " " + n.message).toLowerCase();
  switch (filter) {
    case "registration":  return text.includes("registration");
    case "verification":  return text.includes("verif") || text.includes("pending") || text.includes("overdue");
    case "payments":      return text.includes("payment") || text.includes("transaction") || text.includes("payout") || text.includes("failed");
    case "appointments":  return text.includes("appointment") || text.includes("consultation");
    case "complaints":    return text.includes("complaint");
    default:              return true;
  }
}

function groupByDate(list: Notification[]): [string, Notification[]][] {
  const map = new Map<string, Notification[]>();
  for (const n of list) {
    const d = new Date(n.createdAt);
    const key = isToday(d) ? "Today" : isYesterday(d) ? "Yesterday" : format(d, "d MMM");
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(n);
  }
  return Array.from(map.entries());
}

// ─── Component ────────────────────────────────────────────────────────────────
interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function AdminNotificationPanel({ open, onOpenChange }: Props) {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  const { data: apiNotifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    staleTime: 30 * 1000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/notifications/read-all"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  // Trigger overdue check and refresh notifications when panel opens
  useEffect(() => {
    if (open) {
      apiRequest("POST", "/api/admin/check-overdue")
        .then(() => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }))
        .catch(() => {});
    }
  }, [open]);

  const notifications = apiNotifications;

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const filtered    = notifications.filter((n) => matchesFilter(n, activeFilter));
  const grouped     = groupByDate(filtered);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-full p-0 flex flex-col gap-0 overflow-hidden"
      >
        {/* Header */}
        <div className="shrink-0 px-8 pt-8 pb-0">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h1 className="text-3xl font-heading font-bold leading-tight">Notifications</h1>
              <p className="text-sm text-muted-foreground mt-1">
                AyurPath · Control Panel
              </p>
            </div>
            <img
              src={theme === "dark" ? "/logo-dark.png" : "/logo-light.png"}
              alt="AyurPath"
              className="h-9 w-auto"
            />
          </div>

          {/* Filter row */}
          <div className="flex items-center gap-2 overflow-x-auto pb-4 border-b scrollbar-none">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={cn(
                  "shrink-0 px-4 py-1.5 text-xs rounded border border-primary font-medium transition-colors",
                  activeFilter === f.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-foreground hover:bg-primary/10"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {unreadCount > 0 && (
            <div className="flex justify-end mb-4">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-primary hover:text-primary"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Mark all as read
              </Button>
            </div>
          )}

          {grouped.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              No notifications
            </div>
          ) : (
            grouped.map(([label, items]) => (
              <div key={label} className="mb-8">
                <p className="text-sm font-semibold mb-3">{label}</p>
                <div className="flex flex-col gap-3">
                  {items.map((n) => (
                    <AdminNotifCard
                      key={n.id}
                      n={n}
                      onRead={() => !n.isRead && !n.id.startsWith("demo-") && markRead.mutate(n.id)}
                      onClose={() => onOpenChange(false)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
function AdminNotifCard({
  n,
  onRead,
  onClose,
}: {
  n: Notification;
  onRead: () => void;
  onClose: () => void;
}) {
  const variant = getVariant(n);
  const icon    = getIcon(n);
  const badge   = getBadgeLabel(n);
  const cta     = getButton(n);

  const styles = {
    green: {
      card:   "bg-primary/10 hover:bg-primary/15 border-l-4 border-primary",
      ring:   "ring-1 ring-primary/20",
      iconBg: "bg-primary/20",
      badge:  "border-primary/50 text-primary bg-primary/10",
      btn:    "bg-primary/20 text-primary hover:bg-primary/30",
    },
    red: {
      card:   "bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/50 border-l-4 border-red-400",
      ring:   "ring-1 ring-red-200 dark:ring-red-800",
      iconBg: "bg-red-100 dark:bg-red-900/40",
      badge:  "border-red-300 text-red-600 bg-red-50 dark:bg-red-950/50 dark:border-red-700 dark:text-red-400",
      btn:    "bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400",
    },
    orange: {
      card:   "bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/30 dark:hover:bg-orange-950/50 border-l-4 border-orange-400",
      ring:   "ring-1 ring-orange-200 dark:ring-orange-800",
      iconBg: "bg-orange-100 dark:bg-orange-900/40",
      badge:  "border-orange-400 text-orange-600 bg-orange-50 dark:bg-orange-950/50 dark:border-orange-600 dark:text-orange-400",
      btn:    "bg-orange-100 text-orange-600 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400",
    },
  }[variant];

  return (
    <div
      onClick={onRead}
      className={cn(
        "rounded-xl px-4 py-3 cursor-pointer transition-colors",
        styles.card,
        !n.isRead && styles.ring
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5", styles.iconBg)}>
          <img src={icon} alt="" className="w-5 h-5 object-contain" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className={cn("inline-block text-[10px] font-medium px-2 py-0.5 rounded-full border", styles.badge)}>
              {badge}
            </span>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {format(new Date(n.createdAt), "h:mm a")}
            </span>
          </div>

          <p className="text-sm font-bold text-foreground leading-snug">{n.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{n.message}</p>

          {cta && (
            cta.href ? (
              <Link href={cta.href} onClick={(e) => { e.stopPropagation(); onClose(); }}>
                <button className={cn("mt-2 flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors", styles.btn)}>
                  {cta.label}
                  <ArrowUpRight className="h-3 w-3" />
                </button>
              </Link>
            ) : (
              <button
                onClick={(e) => e.stopPropagation()}
                className={cn("mt-2 flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors", styles.btn)}
              >
                {cta.label}
                <ArrowUpRight className="h-3 w-3" />
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
