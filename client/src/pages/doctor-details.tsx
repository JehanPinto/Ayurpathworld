import { useQuery } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import {
    ArrowLeft,
    MapPin,
    CheckCircle2,
    Award,
    Users,
    FileCheck,
    GraduationCap,
    Star,
    Languages,
    ArrowUpRight,
    Navigation,
    ChevronLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingPage } from "@/components/ui/loading-spinner";
import { PublicLayout } from "@/components/layout/public-layout";
import { appointments, type DoctorWithDetails } from "@shared/schema";
import { navigate } from "wouter/use-browser-location";
import { apiRequest } from "@/lib/queryClient";

export default function DoctorDetailsPage() {
    const { id } = useParams();
    const [location] = useLocation();
    const isPatientRoute = location.startsWith("/patient");

    // Fetch doctor data
    const { data: doctor, isLoading, isError } = useQuery<DoctorWithDetails>({
        queryKey: [`/api/doctors/${id}`],
        enabled: !!id,
    });

    const { data: appointmentCount = 0 } = useQuery<number>({
        queryKey: [`/api/doctors/${id}/appointment-count`],
        queryFn: () => apiRequest("GET", `/api/doctors/${id}/appointment-count`),
    });

    if (isLoading) {
        return (
            <PublicLayout showHeader={false}>
                <LoadingPage message="Loading doctor profile..." />
            </PublicLayout>
        );
    }

    if (isError || !doctor) {
        return (
            <PublicLayout showHeader={false}>
                <div className="container mx-auto px-4 py-16 text-center">
                    <h1 className="text-2xl font-bold mb-4">Doctor not found</h1>
                    <Link href={isPatientRoute ? "/patient/find-doctors" : "/doctors"}>
                        <Button>Go Back to Doctors</Button>
                    </Link>
                </div>
            </PublicLayout>
        );
    }

    const doctorName = doctor.user.fullName.startsWith("Dr")
        ? doctor.user.fullName
        : `Dr. ${doctor.user.fullName}`;

    const backUrl = isPatientRoute ? "/patient/find-doctors" : "/doctors";
    const bookingUrl = isPatientRoute ? `/patient/book-appointment/${doctor.id}` : `/book-appointment/${doctor.id}`;

    const renderStars = (rating: number) => {
        return [...Array(5)].map((_, i) => (
            <Star
                key={i}
                className={`w-4 h-4 ${i < Math.round(rating) ? "fill-amber-400 text-amber-400" : "fill-muted text-muted"
                    }`}
            />
        ));
    };

    const pageContent = (
        <div className="min-h-screen bg-background pb-12">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

                {/* Top Navigation */}
                <div className="flex items-center justify-between mb-8">
                    <Link href="/find-doctors">
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-1.5 text-sm font-medium rounded-lg px-3 py-1.5 hover:bg-muted transition-colors"
                            onClick={() => {
                                if (window.history.length > 1) {
                                    window.history.back();
                                } else {
                                    navigate("/find-doctors");
                                }
                            }}
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Back
                        </Button>
                    </Link>
                    <img src="/logo-light.png" alt="AyurPath" className="h-8 w-auto dark:hidden" />
                    <img src="/logo-dark.png" alt="AyurPath" className="h-8 w-auto hidden dark:block" />
                </div>

                <div className="space-y-6">
                    {/* Profile Card */}
                    <div className="bg-[#eef6f1] dark:bg-muted/20 rounded-3xl p-6 md:p-8 border border-primary/10">
                        <div className="flex flex-col md:flex-row gap-6 md:gap-8 relative">
                            {/* Image */}
                            <div className="relative shrink-0 mx-auto md:mx-0">
                                <img
                                    src={doctor.user.profileImage || `https://ui-avatars.com/api/?name=${doctorName}&background=random`}
                                    alt={doctorName}
                                    className="w-32 h-32 md:w-44 md:h-44 rounded-2xl object-cover shadow-sm border border-border"
                                />
                                {doctor.status === "verified" && (
                                    <div className="absolute top-2 right-2 bg-primary rounded-full border-[#eef6f1] dark:border-background">
                                        <CheckCircle2 className="h-5 w-5 text-white" />
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 flex flex-col">
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-2">
                                    <div>
                                        <h1 className="text-2xl md:text-3xl font-extrabold text-foreground mb-1">
                                            {doctorName}
                                        </h1>
                                        <p className="text-muted-foreground font-medium">
                                            Ayurvedic Physician • {doctor.specializations[0]?.name || "General"} Specialist
                                        </p>
                                    </div>
                                    <Link href={`/doctors/${doctor.id}`}>
                                        <Button size="lg" className="rounded-full shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 font-bold px-6 gap-2">
                                            Book Appointment
                                            <ArrowUpRight className="h-4 w-4" />
                                        </Button>
                                    </Link>
                                </div>

                                <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-4 text-sm font-medium text-muted-foreground">
                                    <div className="flex items-center gap-1.5">
                                        <div className="flex">{renderStars(doctor.averageRating)}</div>
                                        <span className="text-foreground font-bold">{doctor.averageRating.toFixed(1)}</span>
                                        <span>({doctor.totalReviews} reviews)</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <MapPin className="h-4 w-4 text-primary" />
                                        {doctor.user.city ? `${doctor.user.city}, Sri Lanka` : "Sri Lanka"}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Languages className="h-4 w-4 text-primary" />
                                        Speaks {doctor.languagesSpoken?.map(l => l.charAt(0).toUpperCase() + l.slice(1)).join(", ")}
                                    </div>
                                </div>

                                {/* 4 Info Boxes */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
                                    <div className="bg-white dark:bg-background rounded-xl p-3 shadow-sm border border-primary/10">
                                        <Award className="h-5 w-5 text-primary mb-2" />
                                        <p className="font-bold text-foreground text-sm">Top Rated</p>
                                        <p className="text-xs text-muted-foreground">Highly recommended</p>
                                    </div>
                                    <div className="bg-white dark:bg-background rounded-xl p-3 shadow-sm border border-primary/10">
                                        <Users className="h-5 w-5 text-primary mb-2" />
                                        <p className="font-bold text-foreground text-sm">{appointmentCount}+ Patients</p>
                                        <p className="text-xs text-muted-foreground">Consulted</p>
                                    </div>
                                    <div className="bg-white dark:bg-background rounded-xl p-3 shadow-sm border border-primary/10">
                                        <FileCheck className="h-5 w-5 text-primary mb-2" />
                                        <p className="font-bold text-foreground text-sm">Reg. Verified</p>
                                        <p className="text-xs text-muted-foreground truncate">{doctor.registrationNumber}</p>
                                    </div>
                                    <div className="bg-white dark:bg-background rounded-xl p-3 shadow-sm border border-primary/10">
                                        <GraduationCap className="h-5 w-5 text-primary mb-2" />
                                        <p className="font-bold text-foreground text-sm">BAMS, MD</p>
                                        <p className="text-xs text-muted-foreground truncate" title={doctor.qualifications}>
                                            {doctor.qualifications.split(",")[0]}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* About Section */}
                    <div className="bg-[#eef6f1] dark:bg-muted/20 rounded-3xl p-6 md:p-8 border border-primary/10">
                        <h2 className="text-lg font-bold text-foreground mb-4">About {doctorName}</h2>
                        <div className="prose prose-sm md:prose-base dark:prose-invert text-muted-foreground max-w-none mb-6 leading-relaxed whitespace-pre-wrap">
                            {doctor.biography || `${doctorName} is a highly qualified Ayurvedic practitioner dedicated to providing holistic healthcare and traditional healing.`}
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {doctor.specializations.map((spec) => (
                                <Badge key={spec.id} variant="outline" className="border-primary/30 text-foreground bg-white dark:bg-background px-4 py-1.5 rounded-full text-sm font-medium">
                                    {spec.name}
                                </Badge>
                            ))}
                        </div>
                    </div>

                    {/* Location & Availability Section */}
                    <div className="bg-[#eef6f1] dark:bg-muted/20 rounded-3xl p-6 md:p-8 border border-primary/10 relative">
                        <h2 className="text-lg font-bold text-foreground mb-6">Location & Availability</h2>

                        {doctor.hospitals && doctor.hospitals.length > 0 ? (
                            <div className="grid md:grid-cols-2 gap-4 mb-16">
                                {doctor.hospitals.map((hospital) => (
                                    <div key={hospital.id} className="bg-white dark:bg-background rounded-2xl overflow-hidden border border-primary/10 shadow-sm flex flex-col">
                                        {/* Dummy Map Background */}
                                        <div className="h-32 w-full bg-green-50 dark:bg-green-950/20 relative flex items-center justify-center border-b border-border"
                                            style={{ backgroundImage: 'radial-gradient(#22c55e33 1px, transparent 0)', backgroundSize: '12px 12px' }}>
                                            <div className="absolute">
                                                <MapPin className="h-8 w-8 text-primary drop-shadow-md animate-bounce" />
                                            </div>
                                            <Badge className="absolute bottom-3 bg-primary/90 hover:bg-primary text-white gap-1 backdrop-blur-sm shadow-sm rounded-full">
                                                <Navigation className="h-3 w-3" /> View on Map
                                            </Badge>
                                        </div>
                                        {/* Address Info */}
                                        <div className="p-4 flex-1">
                                            <div className="flex items-start gap-2">
                                                <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="font-bold text-sm text-foreground">{hospital.name}</p>
                                                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{hospital.address}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-background rounded-2xl p-6 text-center border border-primary/10 mb-16">
                                <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                <p className="font-medium text-foreground">No physical locations listed</p>
                                <p className="text-sm text-muted-foreground">Available for online consultations only</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    // Use PublicLayout only if not inside the patient dashboard layout
    return isPatientRoute ? pageContent : <PublicLayout showHeader={false} showFooter={false}>{pageContent}</PublicLayout>;
}