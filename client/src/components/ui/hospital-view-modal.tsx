import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { Building2, MapPin, Phone, Mail, CarFront, Loader2, Navigation, Map as MapIcon, ExternalLink } from "lucide-react";
import type { Hospital } from "@shared/schema";

interface HospitalViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  hospital: Hospital | null;
}

const mapContainerStyle = { width: "100%", height: "100%", borderRadius: "16px" };

export function HospitalViewModal({ isOpen, onClose, hospital }: HospitalViewModalProps) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
  });

  if (!hospital) return null;

  // 🟢 100% FREE Industry Standard Method
  const handleGetDirections = () => {
    if (hospital.latitude && hospital.longitude) {
      // මේ Link එකෙන් Mobile එකේ Google Maps App එක කෙලින්ම Open වෙනවා
      const url = `https://www.google.com/maps/dir/?api=1&destination=${hospital.latitude},${hospital.longitude}`;
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Consultation Venue"
      description="Location and contact details"
      icon={<Building2 className="w-5 h-5 text-primary" />}
      className="max-w-2xl border-none shadow-2xl"
    >
      <div className="space-y-6">
        
        {/* Map Section */}
        {hospital.latitude && hospital.longitude ? (
           <div className="w-full bg-muted/20 rounded-3xl p-1.5 h-[220px] sm:h-[300px] relative overflow-hidden group shadow-inner">
            {isLoaded ? (
              <div className="w-full h-full rounded-2xl overflow-hidden relative">
                <GoogleMap 
                  mapContainerStyle={mapContainerStyle} 
                  center={{ lat: hospital.latitude, lng: hospital.longitude }} 
                  zoom={16} 
                  options={{ 
                    disableDefaultUI: true, 
                    gestureHandling: "cooperative", // Prevents getting stuck when scrolling on mobile
                    styles: [
                      {
                        featureType: "poi",
                        elementType: "labels",
                        stylers: [{ visibility: "off" }]
                      }
                    ]
                  }}
                >
                  <Marker 
                    position={{ lat: hospital.latitude, lng: hospital.longitude }} 
                    animation={google.maps.Animation.DROP}
                  />
                </GoogleMap>
                
                {/* Subtle gradient overlay to make buttons pop */}
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/40 to-transparent pointer-events-none rounded-b-2xl"></div>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground bg-muted/10 rounded-2xl">
                <Loader2 className="w-8 h-8 animate-spin mb-3 text-primary/50"/>
                <p className="text-sm font-medium">Loading interactive map...</p>
              </div>
            )}
            
            {/* 🟢 Get Directions Button (Overlay on Map) */}
            <div className="absolute bottom-5 right-5 flex justify-end z-10">
               <Button 
                 onClick={handleGetDirections} 
                 className="shadow-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-2xl h-12 px-6 transition-all hover:scale-105 hover:shadow-primary/30"
               >
                 <Navigation className="w-4 h-4 mr-2 fill-current" /> 
                 Get Directions
               </Button>
            </div>
          </div>
        ) : (
           <div className="w-full h-[160px] bg-muted/30 rounded-3xl border border-dashed border-primary/20 flex flex-col items-center justify-center text-muted-foreground">
             <MapIcon className="w-10 h-10 mb-3 opacity-20" />
             <p className="text-sm font-medium">No map coordinates available for this location</p>
           </div>
        )}

        {/* Hospital Details Card */}
        <div className="bg-card rounded-3xl p-6 border border-border/50 shadow-sm relative overflow-hidden">
           {/* Decorative background element */}
           <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-10"></div>

           <div className="flex items-start justify-between gap-4">
             <div>
               <h3 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">{hospital.name}</h3>
               <div className="flex items-start gap-2 mt-2.5 text-muted-foreground">
                 <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                 <p className="text-sm leading-relaxed">{hospital.address}, <span className="font-semibold text-foreground">{hospital.city}</span></p>
               </div>
             </div>
           </div>

           <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
             {/* Phone - Clickable */}
             {hospital.contactNumber && hospital.contactNumber !== "N/A" && (
                <a 
                  href={`tel:${hospital.contactNumber.replace(/[^0-9+]/g, '')}`}
                  className="flex items-center gap-3 text-sm bg-muted/30 hover:bg-muted/50 transition-colors p-3.5 rounded-2xl border border-border/40 group"
                >
                  <div className="bg-background p-2 rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                    <Phone className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground font-medium mb-0.5">Call Clinic</span>
                    <span className="font-semibold text-foreground">{hospital.contactNumber}</span>
                  </div>
                </a>
             )}

             {/* Email - Clickable */}
             {hospital.email && (
                <a 
                  href={`mailto:${hospital.email}`}
                  className="flex items-center gap-3 text-sm bg-muted/30 hover:bg-muted/50 transition-colors p-3.5 rounded-2xl border border-border/40 group"
                >
                  <div className="bg-background p-2 rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                    <Mail className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs text-muted-foreground font-medium mb-0.5">Email Clinic</span>
                    <span className="font-semibold text-foreground truncate">{hospital.email}</span>
                  </div>
                </a>
             )}

             {/* Parking Status */}
             <div className="flex items-center gap-3 text-sm bg-muted/30 p-3.5 rounded-2xl border border-border/40 sm:col-span-2">
                <div className="bg-background p-2 rounded-xl shadow-sm">
                  <CarFront className="w-4 h-4 text-primary" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground font-medium mb-0.5">Parking Facility</span>
                  {hospital.parkingAvailable ? (
                    <span className="text-primary font-bold">Available at location</span>
                  ) : (
                    <span className="text-foreground font-medium">Not specified / No parking</span>
                  )}
                </div>
             </div>
           </div>
        </div>
        
        {/* Footer Actions */}
        <div className="flex justify-between items-center pt-2">
          <p className="text-xs text-muted-foreground hidden sm:flex items-center gap-1.5">
            <ExternalLink className="w-3.5 h-3.5" />
            Opens in Native Google Maps
          </p>
          <Button onClick={onClose} variant="secondary" className="px-8 rounded-xl h-11 ml-auto font-semibold">
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}