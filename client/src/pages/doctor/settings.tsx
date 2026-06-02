import { useState, useRef, useEffect, type FormEvent } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { QRCodeCanvas } from "qrcode.react";
import {
  User,
  MapPin,
  Save,
  Check,
  Lock,
  Camera,
  Award,
  Video,
  Building2,
  Plus,
  Stethoscope,
  CalendarIcon,
  Trash2,
  X,
  ArrowLeft,
  QrCode,
  MessageCircle,
  Facebook,
  MessageSquare,
  Twitter,
  Linkedin,
  Navigation,
  Phone,
  Mail,
  Smartphone,
  Copy,
  Download,
  Share2,
  Loader2,
  MoreHorizontal,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LoadingPage, LoadingSpinner } from "@/components/ui/loading-spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User as UserType, DoctorWithDetails, Specialization } from "@shared/schema";

// Profile form schema (basic user info)
const profileSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().regex(/^07[0-9]{8}$/, "Please enter a valid Sri Lankan mobile number (07XXXXXXXX)").optional(),
  gender: z.string().optional(),
  dateOfBirth: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
});

// Doctor profile schema (professional info)
const doctorProfileSchema = z.object({
  biography: z.string().optional(),
  qualifications: z.string().min(10, "Qualifications required"),
  specializationIds: z.array(z.string()).min(1, "At least one specialization required"),
  languagesSpoken: z.array(z.string()).min(1, "At least one language required"),
  consultationTypes: z.array(z.string()).min(1, "At least one consultation type required"),
  consultationFee: z.number().min(0, "Fee must be positive"),
  onlineConsultationFee: z.number().min(0).optional(),
  homeVisitFee: z.number().min(0).optional(),
  isAvailable: z.boolean().default(true),
  maxAdvanceBookingDays: z.number().min(1).max(90).default(30),
  minBookingNoticeHours: z.number().min(1).max(72).default(2),
  slotDurationMinutes: z.number().min(15).max(120).default(30),
  bufferTimeMinutes: z.number().min(0).max(60).default(10),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ProfileFormData = z.infer<typeof profileSchema>;
type DoctorProfileFormData = z.infer<typeof doctorProfileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

export default function DoctorSettings() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("profile");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAddLocationForm, setShowAddLocationForm] = useState(false);
  const [newHospName, setNewHospName] = useState("");
  const [newHospAddress, setNewHospAddress] = useState("");
  const [isAddingLocation, setIsAddingLocation] = useState(false);
  const [removingHospitalId, setRemovingHospitalId] = useState<string | null>(null);
  const [showAddSpecModal, setShowAddSpecModal] = useState(false);
  const [newSpecName, setNewSpecName] = useState("");
  const [newSpecDescription, setNewSpecDescription] = useState("");
  const [isSavingSpec, setIsSavingSpec] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

  // Fetch doctor profile with details
  const { data: doctorProfile, isLoading: isLoadingProfile } = useQuery<DoctorWithDetails>({
    queryKey: ["/api/doctor/profile"],
    staleTime: 2 * 60 * 1000,
  });

  // Fetch all specializations
  const { data: allSpecializations = [] } = useQuery<Specialization[]>({
    queryKey: ["/api/specializations"],
    staleTime: 10 * 60 * 1000,
  });

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user?.fullName || "",
      phone: user?.phone || "",
      gender: user?.gender || "",
      dateOfBirth: user?.dateOfBirth || "",
      address: user?.address || "",
      city: user?.city || "",
    },
  });

  const doctorProfileForm = useForm<DoctorProfileFormData>({
    resolver: zodResolver(doctorProfileSchema),
    defaultValues: {
      biography: "",
      qualifications: "",
      specializationIds: [],
      languagesSpoken: ["english"],
      consultationTypes: ["in_person"],
      consultationFee: 0,
      onlineConsultationFee: 0,
      homeVisitFee: 0,
      isAvailable: true,
      maxAdvanceBookingDays: 30,
      minBookingNoticeHours: 2,
      slotDurationMinutes: 30,
      bufferTimeMinutes: 10,
    },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Update form when doctor profile loads
  useEffect(() => {
    if (doctorProfile) {
      doctorProfileForm.reset({
        biography: doctorProfile.biography || "",
        qualifications: doctorProfile.qualifications || "",
        specializationIds: doctorProfile.specializationIds || [],
        languagesSpoken: doctorProfile.languagesSpoken || ["english"],
        consultationTypes: doctorProfile.consultationTypes || ["in_person"],
        consultationFee: doctorProfile.consultationFee || 0,
        onlineConsultationFee: doctorProfile.onlineConsultationFee || 0,
        homeVisitFee: doctorProfile.homeVisitFee || 0,
        isAvailable: doctorProfile.isAvailable ?? true,
        maxAdvanceBookingDays: doctorProfile.maxAdvanceBookingDays || 30,
        minBookingNoticeHours: doctorProfile.minBookingNoticeHours || 2,
        slotDurationMinutes: doctorProfile.slotDurationMinutes || 30,
        bufferTimeMinutes: doctorProfile.bufferTimeMinutes || 10,
      });
    }
  }, [doctorProfile, doctorProfileForm]);

  // Update user profile form when user changes
  useEffect(() => {
    if (user) {
      profileForm.reset({
        fullName: user.fullName || "",
        phone: user.phone || "",
        gender: user.gender || "",
        dateOfBirth: user.dateOfBirth || "",
        address: user.address || "",
        city: user.city || "",
      });
    }
  }, [user, profileForm]);

  const qrLink = typeof window !== 'undefined' ? `${window.location.origin}/doctor-details/${doctorProfile?.id}` : "";

  const generateQrMutation = useMutation({
    mutationFn: async () => {
      const result = await apiRequest("PUT", "/api/doctor/profile", { qrCode: qrLink });
      return result as DoctorWithDetails;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctor/profile"] });
      toast({ title: "QR Code Generated successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to generate QR Code", variant: "destructive" });
    }
  });

  const copyToClipboard = () => {
    navigator.clipboard.writeText(qrLink);
    toast({ title: "Copied!", description: "Profile link copied to clipboard." });
  };

  const downloadQR = () => {
    const canvas = document.getElementById("doctor-qr-code") as HTMLCanvasElement;
    if (canvas) {
      const pngUrl = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
      const downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = `Doctor_QR_${doctorProfile?.user?.fullName}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Book an appointment with me",
          text: `Check out my profile on AyurPath and book an appointment!`,
          url: qrLink,
        });
      } catch (error) {
        toast({ title: "Failed to share", description: "Please try again.", variant: "destructive" });
      }
    } else {
      toast({ title: "Sharing not supported", description: "Your browser doesn't support native sharing." });
    }
  };
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      const result = await apiRequest("PUT", "/api/users/profile", data);
      return result as UserType;
    },
    onSuccess: async () => {
      await updateUser();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Profile updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update profile", variant: "destructive" });
    },
  });

  const shareApps = [
    { name: "WhatsApp", icon: MessageCircle, color: "text-[#25D366]", bg: "bg-[#25D366]/10", onClick: () => window.open(`https://wa.me/?text=${encodeURIComponent(qrLink)}`, "_blank") },
    { name: "Facebook", icon: Facebook, color: "text-[#1877F2]", bg: "bg-[#1877F2]/10", onClick: () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(qrLink)}`, "_blank") },
    { name: "Messenger", icon: MessageSquare, color: "text-[#0084FF]", bg: "bg-[#0084FF]/10", onClick: () => window.open(`fb-messenger://share/?link=${encodeURIComponent(qrLink)}`, "_blank") },
    { name: "X (Twitter)", icon: Twitter, color: "text-neutral-800 dark:text-neutral-200", bg: "bg-neutral-200 dark:bg-neutral-800", onClick: () => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(qrLink)}`, "_blank") },
    { name: "LinkedIn", icon: Linkedin, color: "text-[#0A66C2]", bg: "bg-[#0A66C2]/10", onClick: () => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(qrLink)}`, "_blank") },
    { name: "Telegram", icon: Navigation, color: "text-[#0088cc]", bg: "bg-[#0088cc]/10", onClick: () => window.open(`https://t.me/share/url?url=${encodeURIComponent(qrLink)}`, "_blank") },
    { name: "Viber", icon: Phone, color: "text-[#7360f2]", bg: "bg-[#7360f2]/10", onClick: () => window.open(`viber://forward?text=${encodeURIComponent(qrLink)}`, "_blank") },
    { name: "Reddit", icon: MessageCircle, color: "text-[#FF4500]", bg: "bg-[#FF4500]/10", onClick: () => window.open(`https://reddit.com/submit?url=${encodeURIComponent(qrLink)}`, "_blank") },
    { name: "Email", icon: Mail, color: "text-red-500", bg: "bg-red-100", onClick: () => window.open(`mailto:?subject=Book an appointment with me&body=${encodeURIComponent(qrLink)}`, "_blank") },
    { name: "SMS", icon: Smartphone, color: "text-green-600", bg: "bg-green-100", onClick: () => window.open(`sms:?&body=${encodeURIComponent("Book an appointment with me: " + qrLink)}`, "_self") },
  ];

  const updateDoctorProfileMutation = useMutation({
    mutationFn: async (data: DoctorProfileFormData) => {
      const result = await apiRequest("PUT", "/api/doctor/profile", data);
      return result as DoctorWithDetails;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctor/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/doctors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/specializations"] });
      toast({ title: "Professional profile updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update professional profile", variant: "destructive" });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data: PasswordFormData) =>
      apiRequest("PUT", "/api/users/password", { 
        currentPassword: data.currentPassword, 
        newPassword: data.newPassword 
      }),
    onSuccess: () => {
      passwordForm.reset();
      toast({ title: "Password changed successfully" });
    },
    onError: () => {
      toast({ title: "Failed to change password. Please check your current password.", variant: "destructive" });
    },
  });

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({ 
        title: "Invalid file type", 
        description: "Please upload a JPEG, PNG, GIF, or WebP image.",
        variant: "destructive" 
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({ 
        title: "File too large", 
        description: "Please upload an image smaller than 5MB.",
        variant: "destructive" 
      });
      return;
    }

    setIsUploadingImage(true);
    const formData = new FormData();
    formData.append("image", file);

    const token = localStorage.getItem("token");
    const headers: HeadersInit = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const response = await fetch("/api/users/profile-image", {
        method: "POST",
        body: formData,
        credentials: "include",
        headers,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      await updateUser();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/doctor/profile"] });
      toast({ title: "Profile picture updated successfully" });
    } catch (error) {
      toast({ 
        title: "Failed to upload image", 
        description: "Please try again.",
        variant: "destructive" 
      });
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "DR";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const handleAddLocation = async (e: FormEvent) => {
    e.preventDefault();
    if (!newHospName.trim() || !newHospAddress.trim()) return;
    const currentCount = doctorProfile?.hospitals?.length ?? 0;
    if (currentCount >= 5) {
      toast({ title: "Location limit reached", description: "You can only add up to 5 consultation locations.", variant: "destructive" });
      return;
    }
    setIsAddingLocation(true);
    try {
      await apiRequest("POST", "/api/doctor/hospitals", { name: newHospName.trim(), address: newHospAddress.trim() });
      queryClient.invalidateQueries({ queryKey: ["/api/doctor/profile"] });
      setNewHospName("");
      setNewHospAddress("");
      setShowAddLocationForm(false);
      toast({ title: "Location added successfully" });
    } catch {
      toast({ title: "Failed to add location", variant: "destructive" });
    } finally {
      setIsAddingLocation(false);
    }
  };

  const handleRemoveLocation = async (hospitalId: string) => {
    setRemovingHospitalId(hospitalId);
    try {
      await apiRequest("DELETE", `/api/doctor/hospitals/${hospitalId}`);
      queryClient.invalidateQueries({ queryKey: ["/api/doctor/profile"] });
      toast({ title: "Location removed" });
    } catch {
      toast({ title: "Failed to remove location", variant: "destructive" });
    } finally {
      setRemovingHospitalId(null);
    }
  };

  const handleAddSpecialization = async () => {
    if (!newSpecName.trim()) return;
    setIsSavingSpec(true);
    try {
      const spec = await apiRequest("POST", "/api/doctor/specializations", {
        name: newSpecName.trim(),
        description: newSpecDescription.trim(),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/specializations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/doctor/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/doctors"] });
      // Add the new spec to the form
      const currentIds = doctorProfileForm.getValues("specializationIds") || [];
      doctorProfileForm.setValue("specializationIds", [...currentIds, (spec as any).id]);
      setShowAddSpecModal(false);
      setNewSpecName("");
      setNewSpecDescription("");
      toast({ title: "Specialization added" });
    } catch {
      toast({ title: "Failed to add specialization", variant: "destructive" });
    } finally {
      setIsSavingSpec(false);
    }
  };

  const onProfileSubmit = (data: ProfileFormData) => {
    updateProfileMutation.mutate(data);
  };

  const onDoctorProfileSubmit = (data: DoctorProfileFormData) => {
    updateDoctorProfileMutation.mutate(data);
  };

  const onPasswordSubmit = (data: PasswordFormData) => {
    changePasswordMutation.mutate(data);
  };

  if (!user || isLoadingProfile) {
    return <LoadingPage message="Loading settings..." />;
  }

  const languageOptions = [
    { value: "english", label: "English" },
    { value: "sinhala", label: "Sinhala" },
    { value: "tamil", label: "Tamil" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-heading font-bold">
          Profile Settings
        </h1>
        <p className="text-muted-foreground">
          Manage your personal and professional information
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-transparent border-b rounded-none h-auto p-0 gap-6 w-full justify-start">
          <TabsTrigger
            value="profile"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-2 px-0 font-medium"
          >
            <User className="h-4 w-4 mr-2" />
            Personal
          </TabsTrigger>
          <TabsTrigger
            value="professional"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-2 px-0 font-medium"
          >
            <Stethoscope className="h-4 w-4 mr-2" />
            Professional
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-2 px-0 font-medium"
          >
            <Lock className="h-4 w-4 mr-2" />
            Security
          </TabsTrigger>
          <TabsTrigger
            value="qr-code"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-2 px-0 font-medium"
          >
            <QrCode className="h-4 w-4 mr-2" />
            QR code
          </TabsTrigger>
        </TabsList>

        {/* Personal Profile Tab */}
        <TabsContent value="profile" className="space-y-4">
          <Form {...profileForm}>
            <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
              {/* Personal Information Container */}
              <div className="rounded-xl bg-[#e8f3ef] dark:bg-[#1e2e29] p-6 space-y-5">
                <div>
                  <h2 className="font-semibold text-base">Personal Information</h2>
                  <p className="text-sm text-muted-foreground">Update your personal details and contact information</p>
                </div>

                {/* Avatar Row */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                      <Avatar className="h-14 w-14">
                        <AvatarImage src={user.profileImage} />
                        <AvatarFallback className="bg-primary/20 text-primary text-lg font-semibold">
                          {getInitials(user.fullName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                        {isUploadingImage ? (
                          <LoadingSpinner className="h-5 w-5 text-white" />
                        ) : (
                          <Camera className="h-5 w-5 text-white" />
                        )}
                      </div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        className="hidden"
                      />
                    </div>
                    <div>
                      <p className="font-semibold">
                        {user.fullName.startsWith("Dr") ? user.fullName : `Dr. ${user.fullName}`}
                      </p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Click on the avatar to change your profile picture</p>
                    </div>
                  </div>
                  {doctorProfile?.status === "verified" && (
                    <Badge variant="outline" className="gap-1 border-primary text-primary bg-transparent shrink-0">
                      <Check className="h-3 w-3" />
                      Verified Doctor
                    </Badge>
                  )}
                </div>

                {/* Fields - single column, rounded inputs */}
                <div className="space-y-4">
                  <FormField
                    control={profileForm.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input {...field} className="bg-white dark:bg-background rounded-lg" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={profileForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input {...field} className="bg-white dark:bg-background rounded-lg" placeholder="+94 77 123 4567" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={profileForm.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gender</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-white dark:bg-background rounded-lg">
                              <SelectValue placeholder="Select gender" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={profileForm.control}
                    name="dateOfBirth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Birth</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <input
                              {...field}
                              type="date"
                              className="w-full h-10 px-3 py-2 bg-white dark:bg-background rounded-lg border border-input text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:top-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                            />
                            <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={profileForm.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Input {...field} className="bg-white dark:bg-background rounded-lg" placeholder="Your address" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={profileForm.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-white dark:bg-background rounded-lg">
                              <SelectValue placeholder="Select city" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="colombo">Colombo</SelectItem>
                            <SelectItem value="kandy">Kandy</SelectItem>
                            <SelectItem value="galle">Galle</SelectItem>
                            <SelectItem value="jaffna">Jaffna</SelectItem>
                            <SelectItem value="negombo">Negombo</SelectItem>
                            <SelectItem value="anuradhapura">Anuradhapura</SelectItem>
                            <SelectItem value="matara">Matara</SelectItem>
                            <SelectItem value="kurunegala">Kurunegala</SelectItem>
                            <SelectItem value="batticaloa">Batticaloa</SelectItem>
                            <SelectItem value="trincomalee">Trincomalee</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Consultation Locations Container */}
              <div className="rounded-xl bg-[#e8f3ef] dark:bg-[#1e2e29] p-6 space-y-4">
                <div>
                  <h2 className="font-semibold text-base">Consultation locations</h2>
                  <p className="text-sm text-muted-foreground">Add clinics or hospitals where you offer in-person visits</p>
                </div>

                {/* Existing location cards */}
                {doctorProfile?.hospitals && doctorProfile.hospitals.length > 0 && (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {doctorProfile.hospitals.map((hospital) => (
                      <div key={hospital.id} className="bg-white dark:bg-background rounded-xl p-4 space-y-2 relative group">
                        <button
                          type="button"
                          onClick={() => handleRemoveLocation(hospital.id)}
                          disabled={removingHospitalId === hospital.id}
                          className="absolute top-2 right-2 h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          {removingHospitalId === hospital.id ? (
                            <LoadingSpinner className="h-3.5 w-3.5" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-primary shrink-0" />
                          <p className="font-semibold text-sm">{hospital.name}</p>
                        </div>
                        <p className="text-xs text-muted-foreground pl-6 leading-relaxed">
                          {hospital.address}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add location — button or form */}
                {!showAddLocationForm ? (
                  <button
                    type="button"
                    onClick={() => {
                      if ((doctorProfile?.hospitals?.length ?? 0) >= 5) {
                        toast({ title: "Location limit exceeded", description: "You can only have up to 5 consultation locations.", variant: "destructive" });
                      } else {
                        setShowAddLocationForm(true);
                      }
                    }}
                    className="w-full border-2 border-dashed border-primary/30 rounded-xl p-4 flex items-center gap-3 hover:border-primary/60 transition-colors text-left"
                  >
                    <div className="h-8 w-8 rounded-full border-2 border-primary/40 flex items-center justify-center shrink-0">
                      <Plus className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Add another location</p>
                      <p className="text-xs text-muted-foreground">You can list up to 5 consultation venues on your profile</p>
                    </div>
                  </button>
                ) : (
                  <div className="bg-white dark:bg-background rounded-xl p-4 space-y-3">
                    <div>
                      <p className="text-sm font-medium">Add another location</p>
                      <p className="text-xs text-muted-foreground">You can list up to 5 consultation venues on your profile</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Hospital Name</label>
                      <Input
                        value={newHospName}
                        onChange={(e) => setNewHospName(e.target.value)}
                        placeholder="Meridian Heart Clinic"
                        className="rounded-lg"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Address</label>
                      <Input
                        value={newHospAddress}
                        onChange={(e) => setNewHospAddress(e.target.value)}
                        placeholder="Suite 4B, 12 Wellness Ave Colombo 07, Western Province"
                        className="rounded-lg"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => { setShowAddLocationForm(false); setNewHospName(""); setNewHospAddress(""); }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={isAddingLocation || !newHospName.trim() || !newHospAddress.trim()}
                        onClick={handleAddLocation as any}
                        className="bg-primary text-white gap-1"
                      >
                        {isAddingLocation ? <LoadingSpinner className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        Add Location
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Save Button */}
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                  className="bg-primary hover:bg-primary/90 text-white gap-2"
                >
                  {updateProfileMutation.isPending ? (
                    <LoadingSpinner className="h-4 w-4" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Personal Profile
                </Button>
              </div>
            </form>
          </Form>
        </TabsContent>

        {/* Professional Profile Tab */}
        <TabsContent value="professional" className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Professional Information</h2>
            <p className="text-sm text-muted-foreground">Update your professional details, specializations, and consultation settings</p>
          </div>

          <Form {...doctorProfileForm}>
            <form onSubmit={doctorProfileForm.handleSubmit(onDoctorProfileSubmit)} className="space-y-4">

              {/* Biography container */}
              <div className="rounded-xl bg-[#e8f3ef] dark:bg-[#1e2e29] p-5 space-y-3">
                <div>
                  <p className="font-semibold text-sm">Biography / About Me</p>
                </div>
                <FormField
                  control={doctorProfileForm.control}
                  name="biography"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          {...field}
                          className="min-h-[110px] bg-white dark:bg-background rounded-lg resize-none"
                          placeholder="Tell patients about yourself, your experience, and your approach to treatment..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <p className="text-xs text-muted-foreground">This will be displayed on your public profile</p>
              </div>

              {/* Qualifications container */}
              <div className="rounded-xl bg-[#e8f3ef] dark:bg-[#1e2e29] p-5 space-y-3">
                <p className="font-semibold text-sm">Qualifications</p>
                <FormField
                  control={doctorProfileForm.control}
                  name="qualifications"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="relative">
                          <Award className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Textarea
                            {...field}
                            className="pl-10 min-h-[70px] bg-white dark:bg-background rounded-lg resize-none"
                            placeholder="Panchakarma, Marma Therapy, Herbal Medicine"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <p className="text-xs text-muted-foreground">List your degrees, certifications, and other qualifications</p>
              </div>

              {/* Specializations — free floating */}
              <FormField
                control={doctorProfileForm.control}
                name="specializationIds"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <div>
                      <p className="font-semibold text-sm">Specializations</p>
                      <p className="text-xs text-muted-foreground">Select your areas of expertise</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {allSpecializations.map((spec) => {
                        const isSelected = field.value?.includes(spec.id);
                        return (
                          <button
                            key={spec.id}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                field.onChange(field.value.filter((id: string) => id !== spec.id));
                              } else {
                                field.onChange([...(field.value || []), spec.id]);
                              }
                            }}
                            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                              isSelected
                                ? "bg-primary text-white border-primary"
                                : "bg-transparent border-border text-foreground hover:border-primary/50"
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3" />}
                            {spec.name}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setShowAddSpecModal(true)}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border border-primary text-primary hover:bg-primary/5 transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add new Specializations
                      </button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Languages Spoken — free floating */}
              <FormField
                control={doctorProfileForm.control}
                name="languagesSpoken"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <p className="font-semibold text-sm">Languages Spoken</p>
                    <div className="flex flex-wrap gap-2">
                      {languageOptions.map((lang) => {
                        const isSelected = field.value?.includes(lang.value);
                        return (
                          <button
                            key={lang.value}
                            type="button"
                            onClick={() => {
                              if (isSelected && (field.value?.length ?? 0) > 1) {
                                field.onChange(field.value.filter((l: string) => l !== lang.value));
                              } else if (!isSelected) {
                                field.onChange([...(field.value || []), lang.value]);
                              }
                            }}
                            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                              isSelected
                                ? "bg-primary text-white border-primary"
                                : "bg-transparent border-border text-foreground hover:border-primary/50"
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3" />}
                            {lang.label}
                          </button>
                        );
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Consultation Types + Fees + Booking Settings container */}
              <div className="rounded-xl bg-[#e8f3ef] dark:bg-[#1e2e29] p-5 space-y-6">
                {/* Consultation Types */}
                <FormField
                  control={doctorProfileForm.control}
                  name="consultationTypes"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <div>
                        <p className="font-semibold text-sm">Consultation Types</p>
                        <p className="text-xs text-muted-foreground">Select the types of consultations you offer</p>
                      </div>
                      <div className="flex gap-3 flex-wrap">
                        {[
                          { value: "in_person", label: "In-Person", Icon: Building2 },
                          { value: "online", label: "Online", Icon: Video },
                        ].map(({ value, label, Icon }) => {
                          const isSelected = field.value?.includes(value);
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => {
                                if (isSelected && (field.value?.length ?? 0) > 1) {
                                  field.onChange(field.value.filter((t: string) => t !== value));
                                } else if (!isSelected) {
                                  field.onChange([...(field.value || []), value]);
                                }
                              }}
                              className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium border transition-all ${
                                isSelected
                                  ? "bg-primary text-white border-primary"
                                  : "bg-white dark:bg-background border-border text-foreground hover:border-primary/50"
                              }`}
                            >
                              {isSelected && <Check className="h-3.5 w-3.5" />}
                              {label}
                              <Icon className="h-4 w-4" />
                            </button>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Consultation Fees */}
                <div className="space-y-3">
                  <p className="font-semibold text-sm">Consultation Fees (LKR)</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <FormField
                      control={doctorProfileForm.control}
                      name="consultationFee"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">In person Fees</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">Rs.</span>
                              <Input
                                {...field}
                                type="number"
                                min="0"
                                className="pl-10 bg-white dark:bg-background rounded-lg"
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={doctorProfileForm.control}
                      name="onlineConsultationFee"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">Online Fee</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">Rs.</span>
                              <Input
                                {...field}
                                type="number"
                                min="0"
                                className="pl-10 bg-white dark:bg-background rounded-lg"
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Booking Settings */}
                <div className="space-y-3">
                  <p className="font-semibold text-sm">Booking Settings</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <FormField
                      control={doctorProfileForm.control}
                      name="slotDurationMinutes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">Appointment Duration (minutes)</FormLabel>
                          <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                            <FormControl>
                              <SelectTrigger className="bg-white dark:bg-background rounded-lg">
                                <SelectValue placeholder="Select duration" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="15">15 minutes</SelectItem>
                              <SelectItem value="20">20 minutes</SelectItem>
                              <SelectItem value="30">30 minutes</SelectItem>
                              <SelectItem value="45">45 minutes</SelectItem>
                              <SelectItem value="60">60 minutes</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={doctorProfileForm.control}
                      name="bufferTimeMinutes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">Buffer Time Between Slots (minutes)</FormLabel>
                          <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                            <FormControl>
                              <SelectTrigger className="bg-white dark:bg-background rounded-lg">
                                <SelectValue placeholder="Select buffer" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="0">No buffer</SelectItem>
                              <SelectItem value="5">5 minutes</SelectItem>
                              <SelectItem value="10">10 minutes</SelectItem>
                              <SelectItem value="15">15 minutes</SelectItem>
                              <SelectItem value="30">30 minutes</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={doctorProfileForm.control}
                      name="maxAdvanceBookingDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">Max Advance Booking (days)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              min="1"
                              max="90"
                              className="bg-white dark:bg-background rounded-lg"
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 30)}
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">How far in advance patients can book</p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={doctorProfileForm.control}
                      name="minBookingNoticeHours"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">Minimum Notice (hours)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              min="1"
                              max="72"
                              className="bg-white dark:bg-background rounded-lg"
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 2)}
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">Minimum hours before appointment for booking</p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* Save button */}
              <div className="flex justify-end">
                <Button type="submit" disabled={updateDoctorProfileMutation.isPending} className="bg-primary text-white gap-2">
                  {updateDoctorProfileMutation.isPending ? <LoadingSpinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                  Save Professional Profile
                </Button>
              </div>
            </form>
          </Form>

          {/* Add new Specialization Modal */}
          {showAddSpecModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-background rounded-2xl p-8 w-full max-w-lg shadow-xl relative">
                <button
                  onClick={() => { setShowAddSpecModal(false); setNewSpecName(""); setNewSpecDescription(""); }}
                  className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold">Add new Specialization?</h2>
                  <p className="text-sm text-muted-foreground mt-1">Fill in the details for the new specialization</p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Specialization Name</label>
                    <Input
                      value={newSpecName}
                      onChange={(e) => setNewSpecName(e.target.value)}
                      placeholder="Enter the specialization name"
                      className="rounded-xl border-primary/40 focus:border-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Enter Description</label>
                    <Textarea
                      value={newSpecDescription}
                      onChange={(e) => setNewSpecDescription(e.target.value)}
                      placeholder='Provide brief description like "Traditional Ayurvedic detoxification and rejuvenation therapy."'
                      className="min-h-[120px] rounded-xl border-primary/40 focus:border-primary resize-none"
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 rounded-xl gap-2 border-primary text-primary hover:bg-primary/5"
                    onClick={() => { setShowAddSpecModal(false); setNewSpecName(""); setNewSpecDescription(""); }}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Profile
                  </Button>
                  <Button
                    type="button"
                    disabled={isSavingSpec || !newSpecName.trim()}
                    onClick={handleAddSpecialization}
                    className="flex-1 rounded-xl bg-primary text-white gap-2"
                  >
                    {isSavingSpec ? <LoadingSpinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                    Save Specialization
                  </Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Update your password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...passwordForm}>
                <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4 max-w-md">
                  <FormField
                    control={passwordForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input {...field} type="password" className="pl-10" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={passwordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input {...field} type="password" className="pl-10" />
                          </div>
                        </FormControl>
                        <FormDescription>
                          Password must be at least 8 characters
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={passwordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm New Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input {...field} type="password" className="pl-10" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" disabled={changePasswordMutation.isPending}>
                    {changePasswordMutation.isPending ? (
                      <LoadingSpinner className="mr-2 h-4 w-4" />
                    ) : (
                      <Lock className="mr-2 h-4 w-4" />
                    )}
                    Change Password
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account Security</CardTitle>
              <CardDescription>
                Additional security settings for your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div>
                  <h4 className="font-medium">Email Verification</h4>
                  <p className="text-sm text-muted-foreground">
                    {user.isEmailVerified 
                      ? "Your email is verified" 
                      : "Verify your email to secure your account"}
                  </p>
                </div>
                {user.isEmailVerified ? (
                  <Badge variant="secondary" className="gap-1">
                    <Check className="h-3 w-3" />
                    Verified
                  </Badge>
                ) : (
                  <Button variant="outline" size="sm">
                    Verify Email
                  </Button>
                )}
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <h4 className="font-medium">Phone Verification</h4>
                  <p className="text-sm text-muted-foreground">
                    {user.isPhoneVerified 
                      ? "Your phone is verified" 
                      : "Verify your phone for SMS notifications"}
                  </p>
                </div>
                {user.isPhoneVerified ? (
                  <Badge variant="secondary" className="gap-1">
                    <Check className="h-3 w-3" />
                    Verified
                  </Badge>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => navigate("/doctor/verify-phone")}>
                    Verify Phone
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="qr-code">
          <div className="bg-[#eef6f1] dark:bg-muted/20 border border-primary/20 rounded-3xl p-6 md:p-10 space-y-6">
            <div className="text-center md:text-left mb-6">
               <h2 className="text-xl font-bold text-foreground">QR Profile</h2>
               <p className="text-sm text-muted-foreground mt-1">Share your professional profile instantly. Patients can scan to view your details.</p>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-center gap-10 bg-white dark:bg-background rounded-2xl p-8 shadow-sm border border-border">
              {doctorProfile?.qrCode ? (
                <>
                  <div className="shrink-0 bg-white p-4 rounded-xl shadow-sm border border-border">
                    <QRCodeCanvas 
                      id="doctor-qr-code" 
                      value={qrLink} 
                      size={200} 
                      level="H" 
                      includeMargin={true} 
                    />
                  </div>
                  <div className="w-full max-w-sm space-y-4">
                    <div className="flex items-center gap-2">
                      <Input value={qrLink} readOnly className="font-mono text-center tracking-tight bg-muted/50 truncate" />
                      <Button variant="outline" size="icon" onClick={copyToClipboard} className="shrink-0">
                        <Copy className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                    
                    <Button onClick={downloadQR} className="w-full bg-[#10b981] hover:bg-[#10b981]/90 text-white font-bold gap-2 py-6 rounded-xl transition-transform hover:-translate-y-0.5">
                      <Download className="h-5 w-5" /> Download QR
                    </Button>
                    
                    <Button variant="outline" onClick={() => setIsShareOpen(true)} className="w-full border-[#10b981] text-[#10b981] hover:bg-[#10b981]/5 font-bold gap-2 py-6 rounded-xl transition-transform hover:-translate-y-0.5">
                      <Share2 className="h-5 w-5" /> Share QR
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-10 w-full space-y-4">
                  <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <QrCode className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold">No QR Code Generated</h3>
                  <p className="text-muted-foreground text-sm max-w-sm mx-auto">Generate a unique QR code for your profile so patients can scan and book appointments easily.</p>
                  <Button 
                     onClick={() => generateQrMutation.mutate()}
                     disabled={generateQrMutation.isPending}
                     className="bg-primary text-white px-8 rounded-full font-bold mt-4"
                  >
                     {generateQrMutation.isPending ? <Loader2 className="animate-spin h-5 w-5 mr-2"/> : <QrCode className="h-5 w-5 mr-2"/>}
                     Generate QR Code
                  </Button>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {isShareOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/60 transition-opacity animate-in fade-in duration-300" onClick={() => setIsShareOpen(false)} />
          <div className="relative bg-background w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-300">
            <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mb-6 sm:hidden" />
            <h3 className="text-xl font-bold text-center mb-6">Share Profile</h3>
            
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-y-6 gap-x-2">
              {shareApps.map((app, i) => (
                <button key={i} onClick={app.onClick} className="flex flex-col items-center gap-2 group">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center ${app.bg} ${app.color} transition-transform group-hover:scale-110`}>
                    <app.icon className="w-7 h-7" />
                  </div>
                  <span className="text-xs font-medium text-foreground">{app.name}</span>
                </button>
              ))}
              
              <button onClick={shareNative} className="flex flex-col items-center gap-2 group">
                <div className="w-14 h-14 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 transition-transform group-hover:scale-110">
                  <MoreHorizontal className="w-7 h-7" />
                </div>
                <span className="text-xs font-medium text-foreground">More...</span>
              </button>
            </div>

            <div className="mt-8 pt-6 border-t border-border flex items-center gap-2">
              <Input value={qrLink} readOnly className="bg-muted text-sm h-12 rounded-xl truncate" />
              <Button size="icon" onClick={copyToClipboard} className="h-12 w-12 shrink-0 rounded-xl bg-primary hover:bg-primary/90">
                <Copy className="h-5 w-5 text-white" />
              </Button>
            </div>
            
            <button onClick={() => setIsShareOpen(false)} className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground bg-muted/50 rounded-full">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
