import { useState, useCallback, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { Building2, MapPin, Phone, Mail, Loader2, Navigation, Trash2 } from "lucide-react";
import type { InsertHospital } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface HospitalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: InsertHospital, id?: string) => void;
  onDelete?: (id: string) => void; // Optional: Only for edit mode
  isSaving: boolean;
  initialData?: (InsertHospital & { id?: string }) | null; // For Edit Mode
  mode?: "add" | "edit";
}

const mapContainerStyle = { width: "100%", height: "100%", borderRadius: "12px" };
const defaultCenter = { lat: 7.8731, lng: 80.7718 }; // Sri Lanka Center

export function HospitalModal({ isOpen, onClose, onSave, onDelete, isSaving, initialData, mode = "add" }: HospitalModalProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Partial<InsertHospital>>({
    name: "", address: "", city: "", contactNumber: "", email: "", parkingAvailable: false,
  });
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // Set initial data when opening in edit mode
  useEffect(() => {
    if (isOpen && initialData) {
      setFormData(initialData);
    } else if (isOpen && !initialData) {
      setFormData({ name: "", address: "", city: "", contactNumber: "", email: "", parkingAvailable: false, latitude: undefined, longitude: undefined });
    }
  }, [isOpen, initialData]);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
  });

  const onMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      setFormData(prev => ({ ...prev, latitude: e.latLng!.lat(), longitude: e.latLng!.lng() }));
    }
  }, []);

  const handleLiveLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Geolocation not supported", description: "Your browser does not support location tracking.", variant: "destructive" });
      return;
    }
    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({ ...prev, latitude: position.coords.latitude, longitude: position.coords.longitude }));
        setIsGettingLocation(false);
        toast({ title: "Location pinned successfully!" });
      },
      (error) => {
        setIsGettingLocation(false);
        toast({ title: "Failed to get location", description: "Please allow location access in your browser.", variant: "destructive" });
      }
    );
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.address || !formData.city) return;
    onSave(formData as InsertHospital, initialData?.id);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === "add" ? "Add Consultation Location" : "Update Consultation Location"}
      description="Enter the details of the clinic or hospital."
      icon={<Building2 className="w-5 h-5 text-primary" />}
      className="max-w-3xl" // Made slightly wider for map
      footer={
        <div className="flex justify-between items-center w-full">
          {mode === "edit" && onDelete && initialData?.id ? (
            <Button variant="destructive" className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 shadow-none" onClick={() => onDelete(initialData.id!)}>
              <Trash2 className="w-4 h-4 mr-2" /> Remove Location
            </Button>
          ) : <div></div>}
          
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSaving || !formData.name || !formData.address || !formData.city}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {mode === "add" ? "Save Location" : "Update Location"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5 max-h-[70vh] px-1 pb-4 custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Location Name *</label>
            <Input placeholder="e.g. AyurPath Wellness Center" value={formData.name || ""} onChange={e => setFormData({ ...formData, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">City *</label>
            <Input placeholder="e.g. Colombo" value={formData.city || ""} onChange={e => setFormData({ ...formData, city: e.target.value })} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium">Full Address *</label>
            <Input placeholder="123 Temple Road..." value={formData.address || ""} onChange={e => setFormData({ ...formData, address: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Contact Number (Optional)</label>
            <div className="relative">
              <Phone className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              <Input className="pl-9" placeholder="0112345678" value={formData.contactNumber || ""} onChange={e => setFormData({ ...formData, contactNumber: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email (Optional)</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              <Input className="pl-9" type="email" placeholder="clinic@example.com" value={formData.email || ""} onChange={e => setFormData({ ...formData, email: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 pt-2 bg-muted/30 p-3 rounded-lg border border-border">
          <Checkbox id="parking" checked={formData.parkingAvailable || false} onCheckedChange={(c) => setFormData({ ...formData, parkingAvailable: !!c })} />
          <label htmlFor="parking" className="text-sm font-medium leading-none cursor-pointer">Parking Available at location</label>
        </div>

        <div className="pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div>
              <label className="text-sm font-medium flex items-center gap-2"><MapPin className="w-4 h-4 text-primary"/> Pin Location on Map (Optional)</label>
              <p className="text-xs text-muted-foreground">Click on the map or use live location to pin exact coordinates.</p>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={handleLiveLocation} disabled={isGettingLocation} className="shrink-0 text-xs">
               {isGettingLocation ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin"/> : <Navigation className="w-3.5 h-3.5 mr-1.5"/>}
               Use Live Location
            </Button>
          </div>
          
          <div className="w-full bg-muted/30 rounded-xl border border-border p-1 h-[250px] sm:h-[350px]">
            {isLoaded ? (
              <GoogleMap 
                mapContainerStyle={mapContainerStyle} 
                center={formData.latitude ? { lat: formData.latitude, lng: formData.longitude! } : defaultCenter} 
                zoom={formData.latitude ? 16 : 7} 
                onClick={onMapClick}
                options={{ gestureHandling: "greedy", disableDefaultUI: false }} // Better mobile scroll handling
              >
                {formData.latitude && formData.longitude && (
                  <Marker position={{ lat: formData.latitude, lng: formData.longitude }} animation={google.maps.Animation.DROP} />
                )}
              </GoogleMap>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mr-2"/> Loading Map...</div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}