import { useState, useCallback, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { Building2, MapPin, Phone, Mail, Loader2, Navigation, Trash2, AlertCircle } from "lucide-react";
import type { InsertHospital } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface HospitalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: InsertHospital, id?: string) => void;
  onDelete?: (id: string) => void; 
  isSaving: boolean;
  initialData?: (InsertHospital & { id?: string }) | null;
  mode?: "add" | "edit";
}

const mapContainerStyle = { width: "100%", height: "100%", borderRadius: "12px" };
const defaultCenter = { lat: 7.8731, lng: 80.7718 }; 

// --- SRI LANKAN CITIES ---
const SRI_LANKAN_CITIES = [
  "Ambalangoda", "Ampara", "Anuradhapura", "Avissawella", "Badulla", "Balangoda", 
  "Bandarawela", "Battaramulla", "Batticaloa", "Beruwala", "Boralesgamuwa", "Chilaw", 
  "Colombo", "Dambulla", "Dehiwala", "Embilipitiya", "Galle", "Gampaha", "Gampola", 
  "Hambantota", "Hatton", "Homagama", "Horana", "Ja-Ela", "Jaffna", "Kadawatha", 
  "Kadugannawa", "Kaduwela", "Kalutara", "Kandana", "Kandy", "Kegalle", "Kelaniya", 
  "Kilinochchi", "Kinniya", "Kolonnawa", "Kuliyapitiya", "Kurunegala", "Maharagama", 
  "Mahiyanganaya", "Malabe", "Mannar", "Matale", "Matara", "Minuwangoda", "Moneragala", 
  "Moratuwa", "Mount Lavinia", "Mullaitivu", "Nawalapitiya", "Negombo", "Nugegoda", 
  "Nuwara Eliya", "Panadura", "Peliyagoda", "Point Pedro", "Polonnaruwa", "Puttalam", 
  "Ratnapura", "Sri Jayawardenepura Kotte", "Tangalle", "Trincomalee", "Vavuniya", "Wattala", "Weligama", "Welisara"
].sort();

export function HospitalModal({ isOpen, onClose, onSave, onDelete, isSaving, initialData, mode = "add" }: HospitalModalProps) {
  const { toast } = useToast();
  
  // Set defaults including +94 for phone
  const [formData, setFormData] = useState<Partial<InsertHospital>>({
    name: "", address: "", city: "", contactNumber: "+94", email: "", parkingAvailable: false,
  });
  
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [errors, setErrors] = useState<{name?: string, city?: string, address?: string, phone?: string}>({});

  useEffect(() => {
    if (isOpen && initialData) {
      setFormData({
        ...initialData,
        // Ensure existing phone numbers have +94
        contactNumber: initialData.contactNumber?.startsWith("+94") ? initialData.contactNumber : "+94"
      });
    } else if (isOpen && !initialData) {
      setFormData({ name: "", address: "", city: "", contactNumber: "+94", email: "", parkingAvailable: false, latitude: undefined, longitude: undefined });
    }
    setErrors({});
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

  const handlePhoneChange = (val: string) => {
    // 1. If user deletes +94, put it back
    if (!val.startsWith("+94")) {
      const digitsOnly = val.replace(/\D/g, "");
      
      // If user pasted a full number (e.g. 0771234567)
      if (digitsOnly.length >= 9) {
        let cleaned = digitsOnly;
        if (cleaned.startsWith("94")) cleaned = cleaned.slice(2);
        if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
        setFormData({ ...formData, contactNumber: "+94" + cleaned.slice(0, 9) });
        return;
      }
      
      // Otherwise lock prefix
      setFormData({ ...formData, contactNumber: "+94" });
      return;
    }

    // 2. Extract digits after +94
    let rest = val.slice(3).replace(/\D/g, "");
    
    // Prevent typing a '0' right after +94
    if (rest.startsWith("0")) {
      rest = rest.slice(1); 
    }

    // Combine prefix and up to 9 digits
    setFormData({ ...formData, contactNumber: "+94" + rest });
    setErrors({ ...errors, phone: undefined }); // Clear error on change
  };

  const handleSubmit = () => {
    const newErrors: any = {};
    if (!formData.name?.trim()) newErrors.name = "Location name is required";
    if (!formData.city?.trim()) newErrors.city = "City is required";
    if (!formData.address?.trim()) newErrors.address = "Full address is required";
    
    // Optional phone, but if typed it must be 12 chars exactly (+947XXXXXXXX)
    if (formData.contactNumber && formData.contactNumber !== "+94" && formData.contactNumber.length !== 12) {
      newErrors.phone = "Phone number must be 9 digits after +94";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    // If the user left the phone field as just "+94" (meaning they didn't want to provide it),
    // we save it as empty string so it doesn't look weird in the DB.
    const finalData = { ...formData };
    if (finalData.contactNumber === "+94") {
      finalData.contactNumber = "";
    }

    onSave(finalData as InsertHospital, initialData?.id);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === "add" ? "Add Consultation Location" : "Update Consultation Location"}
      description="Enter the details of the clinic or hospital."
      icon={<Building2 className="w-5 h-5 text-primary" />}
      className="max-w-3xl"
      footer={
        <div className="flex justify-between items-center w-full">
          {mode === "edit" && onDelete && initialData?.id ? (
            <Button variant="destructive" className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 shadow-none" onClick={() => onDelete(initialData.id!)}>
              <Trash2 className="w-4 h-4 mr-2" /> Remove Location
            </Button>
          ) : <div></div>}
          
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {mode === "add" ? "Save Location" : "Update Location"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5 max-h-[70vh] px-1 pb-4 custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Location Name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Location Name *</label>
            <Input 
              placeholder="e.g. AyurPath Wellness Center" 
              value={formData.name || ""} 
              onChange={e => { setFormData({ ...formData, name: e.target.value }); setErrors({...errors, name: undefined}); }} 
              className={errors.name ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {errors.name && <p className="text-xs text-destructive mt-1 flex items-center"><AlertCircle className="w-3 h-3 mr-1"/>{errors.name}</p>}
          </div>
          
          {/* City Selection */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">City *</label>
            <Select 
              value={formData.city || ""} 
              onValueChange={(val) => { setFormData({ ...formData, city: val }); setErrors({...errors, city: undefined}); }}
            >
              <SelectTrigger className={errors.city ? "border-destructive focus-visible:ring-destructive" : ""}>
                <SelectValue placeholder="Select your city" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {SRI_LANKAN_CITIES.map((city) => (
                  <SelectItem key={city} value={city}>{city}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.city && <p className="text-xs text-destructive mt-1 flex items-center"><AlertCircle className="w-3 h-3 mr-1"/>{errors.city}</p>}
          </div>
          
          {/* Address */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium">Full Address *</label>
            <Input 
              placeholder="123 Temple Road..." 
              value={formData.address || ""} 
              onChange={e => { setFormData({ ...formData, address: e.target.value }); setErrors({...errors, address: undefined}); }} 
              className={errors.address ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {errors.address && <p className="text-xs text-destructive mt-1 flex items-center"><AlertCircle className="w-3 h-3 mr-1"/>{errors.address}</p>}
          </div>

          {/* Contact Number with custom formatting */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Contact Number (Optional)</label>
            <div className="relative">
              <Phone className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              <Input 
                className={`pl-9 ${errors.phone ? "border-destructive focus-visible:ring-destructive" : ""}`}
                placeholder="+947XXXXXXXX" 
                maxLength={12}
                value={formData.contactNumber || "+94"} 
                onChange={(e) => handlePhoneChange(e.target.value)} 
              />
            </div>
            {errors.phone && <p className="text-xs text-destructive mt-1 flex items-center"><AlertCircle className="w-3 h-3 mr-1"/>{errors.phone}</p>}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email (Optional)</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              <Input 
                className="pl-9" 
                type="email" 
                placeholder="clinic@example.com" 
                value={formData.email || ""} 
                onChange={e => setFormData({ ...formData, email: e.target.value })} 
              />
            </div>
          </div>
        </div>

        {/* Parking Checkbox */}
        <div className="flex items-center space-x-2 pt-2 bg-muted/30 p-3 rounded-lg border border-border">
          <Checkbox id="parking" checked={formData.parkingAvailable || false} onCheckedChange={(c) => setFormData({ ...formData, parkingAvailable: !!c })} />
          <label htmlFor="parking" className="text-sm font-medium leading-none cursor-pointer">Parking Available at location</label>
        </div>

        {/* Map Location Section */}
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
                options={{ gestureHandling: "greedy", disableDefaultUI: false }} 
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