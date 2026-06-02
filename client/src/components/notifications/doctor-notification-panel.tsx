import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isToday, isYesterday, subDays } from "date-fns";
import { ArrowUpRight, CheckCheck } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useTheme } from "@/lib/theme-context";
import type { Notification } from "@shared/schema";

// ─── Types ───────────────────────────────────────────────────────────────────
type FilterType = "all" | "appointment" | "payment" | "verification" | "reminder" | "announcement";
type CardVariant = "green" | "red" | "orange";

// ─── Filter config ────────────────────────────────────────────────────────────
const FILTERS: { key: FilterType; label: string }[] = [
  { key: "all",           label: "All" },
  { key: "appointment",   label: "Appointments" },
  { key: "payment",       label: "Payments" },
  { key: "verification",  label: "Verification" },
  { key: "reminder",      label: "Reminders" },
  { key: "announcement",  label: "Announcements" },
];

// ─── Demo notifications ───────────────────────────────────────────────────────
const yesterday    = subDays(new Date(), 1).toISOString();
const threeDaysAgo = subDays(new Date(), 3).toISOString();
const fourDaysAgo  = subDays(new Date(), 4).toISOString();

const DEMO_NOTIFICATIONS: Notification[] = [
  {
    id: "demo-doc-admin-request",
    userId: "",
    title: "Additional documents required",
    message: "Please upload a clear copy of your specialist registration certificate to complete your profile review.",
    type: "system",
    isRead: false,
    relatedId: null as any,
    createdAt: new Date().toISOString(),
  },
  {
    id: "demo-doc-verified",
    userId: "",
    title: "Verification approved",
    message: "Your medical licence and credentials have been verified. Your profile is now fully visible to patients.",
    type: "verification",
    isRead: true,
    relatedId: null as any,
    createdAt: yesterday,
  },
  {
    id: "demo-doc-reminder",
    userId: "",
    title: "Consultation tomorrow at 10:30 AM",
    message: "You have an upcoming consultation with Sumudu Jayawardena tomorrow. Review their case notes beforehand.",
    type: "reminder",
    isRead: true,
    relatedId: null as any,
    createdAt: yesterday,
  },
  {
    id: "demo-doc-payment",
    userId: "",
    title: "Payment received from patient",
    message: "LKR 3,500 has been received for the consultation on 25 Apr. This will be included in your next payout.",
    type: "payment",
    isRead: true,
    relatedId: null as any,
    createdAt: yesterday,
  },
  {
    id: "demo-doc-payout",
    userId: "",
    title: "Payout processed successfully",
    message: "LKR 42,000 has been transferred to your registered bank account (ending 7731) for the period 15–25 Apr.",
    type: "payment",
    isRead: true,
    relatedId: null as any,
    createdAt: threeDaysAgo,
  },
  {
    id: "demo-doc-announcement",
    userId: "",
    title: "New patient messaging feature live",
    message: "You can now send follow-up messages directly to patients post-consultation from your dashboard.",
    type: "system",
    isRead: true,
    relatedId: null as any,
    createdAt: fourDaysAgo,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isAnnouncement(n: Notification): boolean {
  const title = n.title.toLowerCase();
  return (
    n.type === "system" &&
    !title.includes("document") &&
    !title.includes("required") &&
    !title.includes("cancell")
  );
}

function getVariant(n: Notification): CardVariant {
  if (n.type === "reminder")  return "orange";
  if (isAnnouncement(n))      return "orange";
  const text = (n.title + " " + n.message).toLowerCase();
  if (
    text.includes("booked") ||
    text.includes("approved") ||
    text.includes("verified") ||
    text.includes("received") ||
    text.includes("processed") ||
    text.includes("payout") ||
    text.includes("verification")
  ) return "green";
  return "red";
}

function getIcon(n: Notification): string {
  if (n.type === "reminder")              return "/icons/reminder.png";
  if (n.type === "verification")          return "/icons/verify.png";
  if (isAnnouncement(n))                  return "/icons/announcement.png";
  if (n.type === "system")                return "/icons/payment-failed.png"; // admin request
  if (n.type === "payment")               return "/icons/payment-success.png";
  const variant = getVariant(n);
  return variant === "green" ? "/icons/new-booking.png" : "/icons/cancel.png";
}

function getBadgeLabel(n: Notification): string {
  if (n.type === "reminder")   return "Reminder";
  if (n.type === "verification") return "Verification";
  if (isAnnouncement(n))       return "Announcement";
  if (n.type === "system")     return "Admin Request";
  if (n.type === "payment") {
    const text = n.title.toLowerCase();
    if (text.includes("payout")) return "Payout";
    return "Payment";
  }
  const title = n.title.toLowerCase();
  if (title.includes("new appointment") || title.includes("booked")) return "New Booking";
  if (title.includes("cancell")) return "Cancelled";
  return "Appointment";
}

function getButton(n: Notification) {

  const meetLinkMatch = n.message.match(/https:\/\/meet\.google\.com\/[a-z\-]+/i);
  if (meetLinkMatch) {
    return { label: "Join Meeting", href: meetLinkMatch[0], isExternal: true };
  }

  const title = n.title.toLowerCase();
  if (isAnnouncement(n))                                               return null;
  if (title.includes("additional documents") || title.includes("admin request"))
                                                                        return { label: "Make Payment",     href: "/doctor/profile" };
  if (n.type === "verification")                                        return { label: "View Profile",     href: "/doctor/profile" };
  if (n.type === "reminder")                                            return { label: "View Appointment", href: "/doctor/appointments" };
  if (n.type === "payment")                                             return { label: "View Receipt",     href: "/doctor/earnings" };
  if (n.type === "appointment")                                         return { label: "View Appointment", href: "/doctor/appointments" };
  return null;
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

export function DoctorNotificationPanel({ open, onOpenChange }: Props) {
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

  // Merge real + demo (demo shown only when no real equivalent)
  const realTitles = new Set(apiNotifications.map((n) => n.title));
  const notifications = [
    ...apiNotifications,
    ...DEMO_NOTIFICATIONS.filter((d) => !realTitles.has(d.title)),
  ];

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const filtered = notifications.filter((n) => {
    if (activeFilter === "all")           return true;
    if (activeFilter === "announcement")  return isAnnouncement(n);
    if (activeFilter === "verification")  return n.type === "verification";
    return n.type === activeFilter;
  });

  const grouped = groupByDate(filtered);

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
                Stay updated on your appointments and activity
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
                    <DoctorNotifCard
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
function DoctorNotifCard({
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
        {/* Icon */}
        <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5", styles.iconBg)}>
          <img src={icon} alt="" className="w-5 h-5 object-contain" />
        </div>

        {/* Content */}
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
