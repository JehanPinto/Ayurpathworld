import { Link } from "wouter";
import { MapPin, Clock, Award, Languages } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/components/ui/star-rating";
import { ConsultationTypeBadges } from "@/components/ui/status-badge";
import type { DoctorWithDetails } from "@shared/schema";

interface DoctorCardProps {
  doctor: DoctorWithDetails;
}

export function DoctorCard({ doctor }: DoctorCardProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatFee = (fee: number) => {
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(fee);
  };

  const primarySpecialization = doctor.specializations[0];
  const primaryHospital = doctor.hospitals[0];

  return (
    <Card
      className="overflow-hidden border border-primary/50 transition-all duration-300 hover:border-primary hover:shadow-xl hover:-translate-y-1 hover:scale-[1.02]"
      data-testid={`card-doctor-${doctor.id}`}
    >
      <CardContent className="p-0 group">

        <div className="p-6">
          <div className="flex items-start gap-4">
            
            <Avatar className="h-20 w-20 rounded-full border-2 border-primary/10 shrink-0">
              <AvatarImage
                src={doctor.user.profileImage || ""}
                alt={doctor.user.fullName}
                className="object-cover"
              />
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold uppercase">
                {getInitials(doctor.user.fullName)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 
                    className="font-semibold text-lg text-foreground truncate w-full" 
                    title={doctor.user.fullName.startsWith("Dr") ? doctor.user.fullName : `Dr. ${doctor.user.fullName}`}
                  >
                    {doctor.user.fullName.startsWith("Dr") ? doctor.user.fullName : `Dr. ${doctor.user.fullName}`}
                  </h3>
                  {primarySpecialization && (
                    <p className="text-sm text-secondary font-medium">
                      {primarySpecialization.name}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <StarRating
                  rating={doctor.averageRating}
                  showValue
                  reviewCount={doctor.totalReviews}
                  size="sm"
                />
              </div>

              <div className="mt-3 space-y-1.5">
                {primaryHospital && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{primaryHospital.name}, {primaryHospital.city}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Languages className="h-3.5 w-3.5 shrink-0" />
                  <span>{doctor.languagesSpoken.map(l => l.charAt(0).toUpperCase() + l.slice(1)).join(", ")}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Consultation Fees
                </p>
                <ConsultationTypeBadges
                  types={doctor.consultationTypes}
                  size="sm"
                  className="flex flex-row"
                />
              </div>
              
              <div className="flex flex-wrap gap-2">
                {/* In-Person Fee */}
                {doctor.consultationTypes.includes("in_person") && (
                  <div className="bg-muted/30 rounded-lg p-2 border border-border/50 flex-1 min-w-[100px]">
                    <p className="text-[11px] text-muted-foreground mb-0.5">In-Person</p>
                    <p className="text-sm font-bold text-secondary">
                      {formatFee(doctor.consultationFee)}
                    </p>
                  </div>
                )}

                {/* Online Fee */}
                {doctor.consultationTypes.includes("online") && doctor.onlineConsultationFee != null && (
                  <div className="bg-muted/30 rounded-lg p-2 border border-border/50 flex-1 min-w-[100px]">
                    <p className="text-[11px] text-muted-foreground mb-0.5">Online</p>
                    <p className="text-sm font-bold text-secondary">
                      {formatFee(doctor.onlineConsultationFee)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6">
          <Link href={`/doctor-details/${doctor.id}`}>
            <Button variant="outline" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors" data-testid={`button-book-doctor-${doctor.id}`}>
              View Profile & Book
            </Button>
          </Link>
        </div>

      </CardContent>
    </Card>
  );
}
