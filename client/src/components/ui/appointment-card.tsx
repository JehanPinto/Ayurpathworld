import { format, parseISO } from "date-fns";
import {
  Building2,
  Map,
  MapPin,
  Video,
  Star,
  CheckCircle2,
  Clock,
  XCircle,
  User,
  DollarSign,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppointmentStatus, ConsultationType, RefundStatus } from "@shared/schema";
import type { AppointmentWithDetails } from "@shared/schema";

interface AppointmentCardProps {
  appointment: AppointmentWithDetails;
  onFeedbackClick: (appointment: AppointmentWithDetails) => void;
  onDetailsClick: (appointment: AppointmentWithDetails) => void;
  onCancelClick?: (appointment: AppointmentWithDetails) => void;
}

export function AppointmentCard({ appointment, onFeedbackClick, onDetailsClick, onCancelClick }: AppointmentCardProps) {
  const isOnline = appointment.consultationType === ConsultationType.ONLINE;
  const isHomeVisit = appointment.consultationType === ConsultationType.HOME_VISIT;
  const isCancelled = ["cancelled", "no_show"].includes(appointment.status);
  const isCompleted = appointment.status === AppointmentStatus.COMPLETED;
  const isUpcoming = ["pending", "confirmed"].includes(appointment.status);

  const cancelledByYou = appointment.cancelledBy === "patient";
  const refundAmount = appointment.payment?.refundAmount;
  const refundCompleted = appointment.payment?.refundStatus === RefundStatus.COMPLETED;

  const formatLKR = (amount: number) =>
    new Intl.NumberFormat("en-LK", { maximumFractionDigits: 0 }).format(amount);

  const formatSlotTime = (time: string) => {
    const [h, m] = time.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  };

  const startTime = appointment.slot?.startTime ? formatSlotTime(appointment.slot.startTime) : formatSlotTime(appointment.appointmentTime);
  const endTime = appointment.slot?.endTime ? formatSlotTime(appointment.slot.endTime) : null;
  const timeRange = endTime ? `${startTime} - ${endTime}` : startTime;

  const getActionText = () => {
    const name = appointment.doctor?.user?.fullName?.replace(/^Dr\.?\s*/i, "") || "Doctor";
    switch (appointment.status) {
      case AppointmentStatus.PENDING: return `Waiting for Dr. ${name} to approve`;
      case AppointmentStatus.CONFIRMED: return `Dr. ${name} approved appointment`;
      case AppointmentStatus.CANCELLED: return `Dr. ${name} canceled appointment`;
      case AppointmentStatus.COMPLETED: return `Dr. ${name} completed appointment`;
      case "no_show": return "Marked as no-show";
      default: return "";
    }
  };

  const renderStatusBadge = () => {
    switch (appointment.status) {
      case AppointmentStatus.CONFIRMED:
        return (
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 px-3 py-1 font-bold rounded-full gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed
          </Badge>
        );
      case AppointmentStatus.PENDING:
        return (
          <Badge variant="outline" className="bg-secondary/15 text-secondary border-secondary/20 px-3 py-1 font-bold rounded-full gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Pending
          </Badge>
        );
      case AppointmentStatus.CANCELLED:
      case "no_show":
        return (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 px-3 py-1 font-bold rounded-full gap-1.5">
            <User className="w-3.5 h-3.5" /> {cancelledByYou ? "Canceled by You" : "Canceled by Doctor"}
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div
      onClick={() => onDetailsClick(appointment)}
      className="rounded-[1.25rem] border border-border overflow-hidden bg-card hover:shadow-md transition-shadow cursor-pointer group"
      data-testid={`card-appointment-${appointment.id}`}
    >
      {/* Date Header */}
      <div className="bg-primary/5 border-b border-border px-4 py-2.5">
        <span className="text-sm font-bold text-foreground">
          {format(parseISO(appointment.appointmentDate), "EEE, MMM dd")}
        </span>
      </div>

      {/* Card Body */}
      <div className="flex flex-col md:flex-row md:items-center gap-4 px-4 py-4">

        {/* LEFT: Icon, Time, Badge, Action Text */}
        <div className="flex items-start gap-3 md:w-[35%] shrink-0">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
            isOnline ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400" :
            isHomeVisit ? "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400" :
            "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400"
          }`}>
            {isOnline ? <Video className="h-5 w-5" /> : isHomeVisit ? <MapPin className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-sm font-bold text-foreground whitespace-nowrap">{timeRange}</span>
              <Badge variant="secondary" className={`text-[10px] font-extrabold px-2 py-0 border-0 rounded-md ${
                isOnline ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" :
                isHomeVisit ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" :
                "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
              }`}>
                {isOnline ? "Online" : isHomeVisit ? "Home Visit" : "In Person"}
              </Badge>
            </div>
            <p className="text-xs font-medium text-muted-foreground">{getActionText()}</p>
          </div>
        </div>

        {/* MIDDLE: Location / Link Button (only for active appointments) */}
        {!isCancelled && !isCompleted && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 md:justify-center">
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              {isOnline ? "Consultation Link :" : "Consultation Place :"}
            </span>
            <Button
              type="button"
              variant="outline"
              className="h-8 px-3 rounded-lg text-xs font-bold border-0 transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={(e) => {
                e.stopPropagation();
                if (isOnline && appointment.slot?.meetLink) {
                  window.open(appointment.slot.meetLink, "_blank", "noopener,noreferrer");
                }
              }}
            >
              {isOnline ? <Video className="h-3.5 w-3.5 mr-1.5" /> : <Map className="h-3.5 w-3.5 mr-1.5" />}
              {isOnline ? "View in Browser" : "View on Map"}
            </Button>
          </div>
        )}
        {(isCancelled || isCompleted) && <div className="flex-1" />}

        {/* RIGHT: Status Badge + actions */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end md:justify-start shrink-0 mt-2 md:mt-0 pt-3 md:pt-0 border-t md:border-t-0 border-border">
          {isCompleted ? (
            <Button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFeedbackClick(appointment);
              }}
              className="h-8 px-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs"
              data-testid={`button-feedback-${appointment.id}`}
            >
              <Star className="h-3.5 w-3.5 mr-1.5 fill-current" />
              Give Feedback
            </Button>
          ) : (
            <>
              {renderStatusBadge()}
              {isUpcoming && onCancelClick && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancelClick(appointment);
                  }}
                  className="h-8 px-3 rounded-lg text-xs font-bold border border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10 gap-1.5"
                  data-testid={`button-cancel-${appointment.id}`}
                >
                  <XCircle className="h-3.5 w-3.5" /> Cancel
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* CANCELLED: reason + refund status row */}
      {isCancelled && (
        <div className="border-t border-border px-4 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="min-w-0 space-y-1">
            {appointment.cancelReason && (
              <p className="text-sm text-foreground">
                <span className="font-semibold">Reason:</span> {appointment.cancelReason}
              </p>
            )}
            {refundCompleted ? (
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <DollarSign className="h-4 w-4" /> Refund Completed{typeof refundAmount === "number" ? ` (LKR ${formatLKR(refundAmount)})` : ""}
              </p>
            ) : (
              <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <DollarSign className="h-4 w-4" /> Refund: Refund Processing (Est. 3–5 business days)
              </p>
            )}
          </div>
          <Button
            type="button"
            disabled={!refundCompleted}
            onClick={(e) => {
              e.stopPropagation();
              if (refundCompleted) onDetailsClick(appointment);
            }}
            className={`h-9 px-5 rounded-lg font-bold text-sm gap-1.5 shrink-0 ${
              refundCompleted
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-primary/40 text-primary-foreground/70 cursor-not-allowed"
            }`}
            data-testid={`button-view-details-${appointment.id}`}
          >
            View Details <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
