import { type ReactNode, useState, useEffect, createContext, useContext } from "react";
import { Link, useLocation } from "wouter";

// ── Shared settings tab state ─────────────────────────────────────────────────
interface SettingsTabCtx { tab: string; setTab: (t: string) => void; }
export const SettingsTabContext = createContext<SettingsTabCtx>({ tab: "payment", setTab: () => {} });
export const useSettingsTab = () => useContext(SettingsTabContext);
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  LayoutDashboard,
  Calendar,
  Clock,
  FileText,
  Settings,
  Users,
  UserPlus,
  Stethoscope,
  DollarSign,
  Star,
  Bell,
  Activity,
  LogOut,
  ChevronDown,
  BriefcaseBusiness,
  Menu,
  BookOpen,
  Shield,
  AlertTriangle,
  Wallet,
  icons,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationPanel } from "@/components/notifications/notification-panel";
import { DoctorNotificationPanel } from "@/components/notifications/doctor-notification-panel";
import { AdminNotificationPanel } from "@/components/notifications/admin-notification-panel";
import { useAuth } from "@/lib/auth-context";
import { UserRole } from "@shared/schema";
import { Label } from "recharts";

interface DashboardLayoutProps {
  children: ReactNode;
}

const patientMainNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/patient" },
  { icon: Stethoscope, label: "Find Doctors", href: "/patient/find-doctors" },
  { icon: Calendar, label: "My Appointments", href: "/patient/appointments" },
];

const patientManagementNavItems = [
  { icon: Star, label: "My Reviews", href: "/patient/reviews" },
  { icon: Settings, label: "Settings", href: "/patient/settings" },
];

const doctorMainNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/doctor" },
  { icon: Calendar, label: "Appointments", href: "/doctor/appointments" },
  { icon: Clock, label: "Schedule", href: "/doctor/schedule" },
];

const doctorManagementNavItems = [
  { icon: DollarSign, label: "Earnings", href: "/doctor/earnings" },
  { icon: Star, label: "Reviews", href: "/doctor/reviews" },
  { icon: Settings, label: "Settings", href: "/doctor/settings" },
];

const adminMainNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/admin" },
  { icon: Stethoscope, label: "Doctors", href: "/admin/doctors" },
  { icon: UserPlus, label: "Register Doctor", href: "/admin/doctors/register" },
  { icon: Users, label: "Patients", href: "/admin/patients" },
];

const adminManagementNavItems = [
  { icon: Activity, label: "Specializations", href: "/admin/specializations" },
  { icon: DollarSign, label: "Payments", href: "/admin/payments" },
  { icon: Wallet, label: "Payouts", href: "/admin/payouts" },
  { icon: AlertTriangle, label: "Refunds", href: "/admin/refunds" },
  { icon: BriefcaseBusiness, label: "Careers", href: "/admin/careers" },
  { icon: BookOpen, label: "Blogs", href: "/admin/blogs" },
  { icon: FileText, label: "Audit", href: "/admin/audit" },
];

const adminSettingsSubItems = [
  { icon: DollarSign, label: "Payment & Commission", tab: "payment" },
  { icon: Shield, label: "Security & Verification", tab: "security" },
  { icon: AlertTriangle, label: "Danger Zone", tab: "danger" },
];

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState("payment");

  // Reset to default tab when navigating away from settings
  useEffect(() => {
    if (!location.startsWith("/admin/settings")) {
      setSettingsTab("payment");
    }
  }, [location]);

  const { data: notifications = [] } = useQuery<{ isRead: boolean }[]>({
    queryKey: ["/api/notifications"],
    staleTime: 30 * 1000,
    enabled: !!user,
  });
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Prefetch all pages for the current role so navigation feels instant
  useEffect(() => {
    if (!user) return;
    const prefetch = (key: string) =>
      queryClient.prefetchQuery({ queryKey: [key], staleTime: 2 * 60 * 1000 });

    if (user.role === UserRole.DOCTOR) {
      prefetch("/api/appointments");
      prefetch("/api/doctor/dashboard");
      prefetch("/api/doctor/earnings");
      prefetch("/api/doctor/reviews");
      prefetch("/api/doctor/patients");
      prefetch("/api/doctor/profile");
    } else if (user.role === UserRole.PATIENT) {
      prefetch("/api/patient/dashboard");
      prefetch("/api/appointments");
      prefetch("/api/patient/reviews");
      prefetch("/api/specializations");
    }
  }, [user?.id]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
    } catch (error) {
      console.error("Server logout failed:", error);
    } finally {
      logout();
      setLocation("/");
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case UserRole.ADMIN:
        return "Administrator";
      case UserRole.DOCTOR:
        return "Doctor";
      default:
        return "Patient";
    }
  };

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SettingsTabContext.Provider value={{ tab: settingsTab, setTab: setSettingsTab }}>
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <Sidebar className="[&>[data-sidebar=sidebar]]:bg-[#c8ddd6] dark:[&>[data-sidebar=sidebar]]:bg-[#2a3d37]">
          <SidebarHeader className="border-b p-4">
            <Link href="/">
              <div className="flex items-center cursor-pointer">
                <img src="/logo-light.png" alt="AyurPath" className="h-8 w-auto dark:hidden" />
                <img src="/logo-dark.png" alt="AyurPath" className="h-8 w-auto hidden dark:block" />
              </div>
            </Link>
          </SidebarHeader>

          <SidebarContent className="scrollbar-thin">
            {user?.role === UserRole.ADMIN ? (
              <>
                <SidebarGroup>
                  <SidebarGroupLabel>Main</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {adminMainNavItems.map((item) => (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton asChild isActive={location === item.href}>
                            <Link href={item.href}>
                              <item.icon className="h-4 w-4" />
                              <span>{item.label}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
                <SidebarGroup>
                  <SidebarGroupLabel>Management</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {adminManagementNavItems.map((item) => (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton asChild isActive={location === item.href}>
                            <Link href={item.href}>
                              <item.icon className="h-4 w-4" />
                              <span>{item.label}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}

                      {/* Expandable Settings */}
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          isActive={location.startsWith("/admin/settings")}
                          className="cursor-pointer"
                          onClick={() => {
                            if (!location.startsWith("/admin/settings")) {
                              setLocation("/admin/settings");
                            }
                          }}
                        >
                          <Settings className="h-4 w-4" />
                          <span>Settings</span>
                          <ChevronDown
                            className={`ml-auto h-4 w-4 transition-transform duration-200 ${
                              location.startsWith("/admin/settings") ? "rotate-180" : ""
                            }`}
                          />
                        </SidebarMenuButton>
                        {location.startsWith("/admin/settings") && (
                          <div className="mt-1 mx-2 bg-white dark:bg-background rounded-xl shadow-sm border border-border/40 py-1.5 px-1">
                            {adminSettingsSubItems.map((sub) => (
                              <div
                                key={sub.tab}
                                onClick={() => {
                                  setSettingsTab(sub.tab);
                                  if (!location.startsWith("/admin/settings")) {
                                    setLocation("/admin/settings");
                                  }
                                }}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                                  settingsTab === sub.tab
                                    ? "bg-primary text-primary-foreground"
                                    : "text-foreground hover:bg-muted"
                                }`}
                              >
                                <sub.icon className="h-4 w-4 shrink-0" />
                                <span>{sub.label}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </SidebarMenuItem>
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </>
            ) : user?.role === UserRole.DOCTOR ? (
              <>
                <SidebarGroup>
                  <SidebarGroupLabel>Main</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {doctorMainNavItems.map((item) => (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton asChild isActive={location === item.href}>
                            <Link href={item.href}>
                              <item.icon className="h-4 w-4" />
                              <span>{item.label}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
                <SidebarGroup>
                  <SidebarGroupLabel>Management</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {doctorManagementNavItems.map((item) => (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton
                            asChild
                            isActive={location === item.href || (item.href === "/doctor/settings" && location === "/doctor/profile")}
                          >
                            <Link href={item.href}>
                              <item.icon className="h-4 w-4" />
                              <span>{item.label}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </>
            ) : (
              <>
                <SidebarGroup>
                  <SidebarGroupLabel>Main</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {patientMainNavItems.map((item) => (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton asChild isActive={location === item.href}>
                            <Link href={item.href}>
                              <item.icon className="h-4 w-4" />
                              <span>{item.label}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
                <SidebarGroup>
                  <SidebarGroupLabel>Management</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {patientManagementNavItems.map((item) => (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton asChild isActive={location === item.href}>
                            <Link href={item.href}>
                              <item.icon className="h-4 w-4" />
                              <span>{item.label}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </>
            )}
          </SidebarContent>

          <SidebarFooter className="border-t p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-3 h-auto py-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.profileImage} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                      {getInitials(user?.fullName || "")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium truncate">{user?.fullName}</p>
                    <p className="text-xs text-muted-foreground">{getRoleLabel(user?.role || "")}</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem 
                  onClick={handleLogout}
                  className="text-destructive focus:text-destructive cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b flex items-center justify-between px-4 gap-4 bg-background shrink-0">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                data-testid="button-notifications"
                onClick={() => setNotifOpen(true)}
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-2xs">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Badge>
                )}
              </Button>
              <ThemeToggle />
            </div>
            {user?.role === UserRole.DOCTOR ? (
              <DoctorNotificationPanel open={notifOpen} onOpenChange={setNotifOpen} />
            ) : user?.role === UserRole.ADMIN ? (
              <AdminNotificationPanel open={notifOpen} onOpenChange={setNotifOpen} />
            ) : (
              <NotificationPanel open={notifOpen} onOpenChange={setNotifOpen} />
            )}
          </header>

          <main className="flex-1 overflow-auto overscroll-none p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
    </SettingsTabContext.Provider>
  );
}
