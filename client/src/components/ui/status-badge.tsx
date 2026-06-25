import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  CheckCircle, 
  Clock, 
  XCircle, 
  AlertCircle,
  Video,
  Building2,
  Home
} from "lucide-react";
import { 
  AppointmentStatus, 
  DoctorStatus, 
  PaymentStatus,
  ConsultationType 
} from "@shared/schema";

type StatusType = "appointment" | "doctor" | "payment" | "consultation";

interface StatusBadgeProps {
  status: string;
  type: StatusType;
  className?: string;
}

const statusConfig = {
  appointment: {
    [AppointmentStatus.PENDING]: { label: "Pending", variant: "outline" as const, icon: Clock, color: "text-yellow-600 dark:text-yellow-400" },
    [AppointmentStatus.CONFIRMED]: { label: "Confirmed", variant: "default" as const, icon: CheckCircle, color: "text-blue-600 dark:text-blue-400" },
    [AppointmentStatus.COMPLETED]: { label: "Completed", variant: "secondary" as const, icon: CheckCircle, color: "text-green-600 dark:text-green-400" },
    [AppointmentStatus.CANCELLED]: { label: "Cancelled", variant: "destructive" as const, icon: XCircle, color: "text-white" },
    [AppointmentStatus.NO_SHOW]: { label: "No Show", variant: "outline" as const, icon: AlertCircle, color: "text-gray-600 dark:text-gray-400" },
  },
  doctor: {
    [DoctorStatus.PENDING]: { label: "Pending Verification", variant: "outline" as const, icon: Clock, color: "text-yellow-600" },
    [DoctorStatus.VERIFIED]: { label: "Verified", variant: "default" as const, icon: CheckCircle, color: "text-white" },
    [DoctorStatus.REJECTED]: { label: "Rejected", variant: "destructive" as const, icon: XCircle, color: "text-white" },
    [DoctorStatus.SUSPENDED]: { label: "Suspended", variant: "outline" as const, icon: AlertCircle, color: "text-gray-600" },
  },
  payment: {
    [PaymentStatus.PENDING]: { label: "Pending", variant: "outline" as const, icon: Clock, color: "text-yellow-600" },
    [PaymentStatus.COMPLETED]: { label: "Paid", variant: "default" as const, icon: CheckCircle, color: "text-white" },
    [PaymentStatus.REFUNDED]: { label: "Refunded", variant: "secondary" as const, icon: CheckCircle, color: "text-white" },
    [PaymentStatus.FAILED]: { label: "Failed", variant: "destructive" as const, icon: XCircle, color: "text-white" },
  },
  consultation: {
    [ConsultationType.IN_PERSON]: { label: "In Person", variant: "outline" as const, icon: Building2, color: "text-blue-600" },
    [ConsultationType.ONLINE]: { label: "Online", variant: "secondary" as const, icon: Video, color: "text-green-600" },
    [ConsultationType.HOME_VISIT]: { label: "Home Visit", variant: "outline" as const, icon: Home, color: "text-purple-600" },
  },
};

export function StatusBadge({ status, type, className }: StatusBadgeProps) {
  const config = statusConfig[type][status as keyof typeof statusConfig[typeof type]];
  
  if (!config) {
    return <Badge variant="outline">{status}</Badge>;
  }

  const Icon = config.icon;

  return (
    <Badge 
      variant={config.variant} 
      className={cn("gap-1", className)}
    >
      <Icon className={cn("h-3 w-3", config.color)} />
      {config.label}
    </Badge>
  );
}

interface ConsultationTypeBadgesProps {
  types: string[];
  size?: "sm" | "md";
  className?: string;
}

export function ConsultationTypeBadges({ types, size = "sm", className }: ConsultationTypeBadgesProps) {
  const icons = {
    [ConsultationType.IN_PERSON]: Building2,
    [ConsultationType.ONLINE]: Video,
    [ConsultationType.HOME_VISIT]: Home,
  };

  const labels = {
    [ConsultationType.IN_PERSON]: "In Person",
    [ConsultationType.ONLINE]: "Online",
    [ConsultationType.HOME_VISIT]: "Home Visit",
  };

  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
  };

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {types.map((type) => {
        const Icon = icons[type as keyof typeof icons];
        if (!Icon) return null;
        return (
          <Badge key={type} variant="outline" className="gap-1 text-xs">
            <Icon className={sizeClasses[size]} />
            {labels[type as keyof typeof labels]}
          </Badge>
        );
      })}
    </div>
  );
}
