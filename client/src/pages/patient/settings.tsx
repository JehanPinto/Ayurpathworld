import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import Cropper from "react-easy-crop";
import { 
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Globe,
  Save,
  AlertCircle,
  Check,
  Lock,
  Camera,
  Edit2,
  X,
  UploadCloud,
  ImageIcon,
  ZoomIn,
  KeyRound,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LoadingPage, LoadingSpinner } from "@/components/ui/loading-spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User as UserType } from "@shared/schema";
import { Modal } from "@/components/ui/modal";

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });

async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  fileName: string = "profile.jpg"
): Promise<File> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) throw new Error("No 2d context");

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, pixelCrop.width, pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Canvas is empty"));
        return;
      }
      const file = new File([blob], fileName, { type: "image/jpeg" });
      resolve(file);
    }, "image/jpeg", 0.95);
  });
}

const profileSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().regex(/^07[0-9]{8}$/, "Please enter a valid Sri Lankan mobile number (07XXXXXXXX)").optional(),
  gender: z.string().optional(),
  dateOfBirth: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  preferredLanguages: z.array(z.string()).default(["english"]),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const otpPasswordSchema = z.object({
  otp: z.string().length(6, "OTP must be exactly 6 digits"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;
type OtpPasswordFormData = z.infer<typeof otpPasswordSchema>;

export default function PatientSettings() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  const [activeTab, setActiveTab] = useState("profile");
  const [isEditing, setIsEditing] = useState(false); // 🟢 Edit state
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false); // 🟢 Modal state
  
  const [securityMode, setSecurityMode] = useState<"standard" | "otp_flow">("standard");
  const [isOtpSent, setIsOtpSent] = useState(false);

  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  console.log("User data in settings page:", user); // Debugging line

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user?.fullName || "",
      phone: user?.phone || "",
      gender: user?.gender || "",
      dateOfBirth: user?.dateOfBirth || "",
      address: user?.address || "",
      city: user?.city || "",
      preferredLanguages: user?.preferredLanguages || ["english"],
    },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const otpPasswordForm = useForm<OtpPasswordFormData>({
    resolver: zodResolver(otpPasswordSchema),
    defaultValues: { otp: "", newPassword: "", confirmPassword: "" },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      const result = await apiRequest("PUT", "/api/users/profile", data);
      return result as UserType;
    },
    onSuccess: async () => {
      await updateUser();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Profile updated successfully" });
      setIsEditing(false);
    },
    onError: () => {
      toast({ title: "Failed to update profile", variant: "destructive" });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data: PasswordFormData) =>
      apiRequest("PUT", "/api/users/password", { currentPassword: data.currentPassword, newPassword: data.newPassword }),
    onSuccess: () => {
      passwordForm.reset();
      toast({ title: "Password changed successfully" });
    },
    onError: () => toast({ title: "Failed to change password. Please check your current password.", variant: "destructive" }),
  });

  const sendOtpMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/users/send-password-otp"),
    onSuccess: () => {
      setIsOtpSent(true);
      toast({ title: "OTP Sent!", description: `Check your email (${user?.email}) for the verification code.` });
    },
    onError: () => toast({ title: "Failed to send OTP", variant: "destructive" }),
  });

  const verifyOtpAndResetMutation = useMutation({
    mutationFn: (data: OtpPasswordFormData) =>
      apiRequest("POST", "/api/users/reset-password-with-otp", { otp: data.otp, newPassword: data.newPassword }),
    onSuccess: () => {
      otpPasswordForm.reset();
      setSecurityMode("standard");
      setIsOtpSent(false);
      toast({ title: "Password Reset Successful", description: "You can now login with your new password." });
    },
    onError: (err: any) => {
      toast({ title: "Reset Failed", description: "Invalid or expired OTP. Please try again.", variant: "destructive" });
    },
  });

  const onProfileSubmit = (data: ProfileFormData) => updateProfileMutation.mutate(data);
  const onPasswordSubmit = (data: PasswordFormData) => changePasswordMutation.mutate(data);
  const onOtpPasswordSubmit = (data: OtpPasswordFormData) => verifyOtpAndResetMutation.mutate(data);

  // Handle File Selection in Modal
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Invalid file type. Please upload a JPG, PNG, or WEBP image.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image size is too big. Maximum allowed size is 5MB.", variant: "destructive" });
      return;
    }

    setPreviewImage(URL.createObjectURL(file));
    setZoom(1); // Reset zoom when new file is selected
  };

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  // Handle Image Upload after cropping
  const confirmImageUpload = async () => {
    if (!previewImage || !croppedAreaPixels) return;
    setIsUploadingImage(true);

    try {
      // Get the cropped image as a File object
      const croppedFile = await getCroppedImg(previewImage, croppedAreaPixels, "profile.jpg");

      const formData = new FormData();
      formData.append("image", croppedFile);

      const token = localStorage.getItem("token");
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch("/api/users/profile-image", {
        method: "POST",
        body: formData,
        credentials: "include",
        headers,
      });

      if (!response.ok) throw new Error("Upload failed");

      await updateUser();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      
      toast({ title: "Profile picture updated!" });
      
      // Close Modal and Reset
      setIsAvatarModalOpen(false);
      setPreviewImage(null);
    } catch (error) {
      toast({ title: "Failed to upload image", variant: "destructive" });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  if (!user) return <LoadingPage message="Loading settings..." />;

  const availableLanguages = [
    { id: "english", label: "English" },
    { id: "sinhala", label: "Sinhala" },
    { id: "tamil", label: "Tamil" },
  ];

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">
          Profile Settings
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Manage your personal and professional information
        </p>
      </div>

      {/* Underline Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex border-b border-border rounded-none bg-transparent w-full justify-start h-auto p-0 space-x-6">
          <TabsTrigger 
            value="profile" 
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none py-3 px-1 font-medium bg-transparent"
          >
            <User className="h-4 w-4 mr-2" /> Personal
          </TabsTrigger>
          
          {user.provider === "local" && (
            <TabsTrigger 
              value="security" 
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none py-3 px-1 font-medium bg-transparent"
            >
              <Lock className="h-4 w-4 mr-2" /> Security
            </TabsTrigger>
          )}
        </TabsList>

        {/* Profile Tab Content */}
        <TabsContent value="profile" className="space-y-6">
          <Card className="dark:bg-primary/5 bg-primary/5 border-0 shadow-sm rounded-2xl overflow-hidden">
            <CardContent className="p-6 sm:p-8 space-y-8">
              
              {/* Header inside Card */}
              <div>
                <h3 className="text-lg font-bold text-foreground">Personal Information</h3>
                <p className="text-sm text-muted-foreground">Update your personal information and preferences</p>
              </div>

              {/* Avatar Section */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4 max-sm:flex-col">
                  <div className="relative group">
                    <Avatar className="h-20 w-20 border-2 border-white shadow-sm">
                      <AvatarImage src={user.profileImage} />
                      <AvatarFallback className="bg-emerald-100 text-primary/70 text-xl font-medium">
                        {getInitials(user.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <button 
                      onClick={() => {
                        setPreviewImage(user.profileImage || null);
                        setIsAvatarModalOpen(true);
                      }}
                      className="absolute bottom-0 right-0 bg-white dark:bg-muted p-1.5 rounded-full shadow-md border border-border text-primary hover:text-primary/70 transition-colors"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{user.fullName}</h3>
                    <p className="text-sm text-muted-foreground mb-1">{user.email}</p>
                    <p className="text-xs text-muted-foreground opacity-80">Click on the camera icon to change your profile picture</p>
                  </div>
                </div>

                {user.isEmailVerified ? (
                  <Badge variant="outline" className="border-primary/50 text-primary/80 bg-emerald-50 px-3 py-1">
                    <Check className="h-3.5 w-3.5 mr-1" /> Email Verified
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-secondary text-secondary bg-amber-50 px-3 py-1">
                    <AlertCircle className="h-3.5 w-3.5 mr-1" /> Unverified
                  </Badge>
                )}
              </div>

              {/* Form Section */}
              <Form {...profileForm}>
                <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-5">
                  
                  <FormField
                    control={profileForm.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Full Name</Label>
                        <FormControl>
                          <Input {...field} disabled={!isEditing} className={`bg-white dark:bg-background border-primary/40 ${!isEditing && "opacity-70 font-medium"}`} />
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
                        <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Phone Number</Label>
                        <FormControl>
                          <Input {...field} disabled={!isEditing} placeholder="0771234567" maxLength={10} className={`bg-white dark:bg-background border-primary/40 ${!isEditing && "opacity-70 font-medium"}`} />
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
                        <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Gender</Label>
                        <Select onValueChange={field.onChange} value={field.value} disabled={!isEditing}>
                          <FormControl>
                            <SelectTrigger className={`bg-white dark:bg-background border-primary/40 ${!isEditing && "opacity-70 font-medium"}`}>
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
                        <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Date of Birth</Label>
                        <FormControl>
                          <Input type="date" {...field} disabled={!isEditing} className={`bg-white dark:bg-background border-primary/40 ${!isEditing && "opacity-70 font-medium"}`} />
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
                        <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Address</Label>
                        <FormControl>
                          <Input {...field} disabled={!isEditing} className={`bg-white dark:bg-background border-primary/40 ${!isEditing && "opacity-70 font-medium"}`} />
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
                        <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">City</Label>
                        <Select onValueChange={field.onChange} value={field.value} disabled={!isEditing}>
                          <FormControl>
                            <SelectTrigger className={`bg-white dark:bg-background border-primary/40 ${!isEditing && "opacity-70 font-medium"}`}>
                              <SelectValue placeholder="Select city" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="colombo">Colombo</SelectItem>
                            <SelectItem value="kandy">Kandy</SelectItem>
                            <SelectItem value="galle">Galle</SelectItem>
                            <SelectItem value="matara">Matara</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={profileForm.control}
                    name="preferredLanguages"
                    render={({ field }) => (
                      <FormItem>
                        <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Preferred Language</Label>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {availableLanguages.map((lang) => {
                            const isSelected = field.value.includes(lang.id);
                            return (
                              <Badge
                                key={lang.id}
                                variant={isSelected ? "default" : "outline"}
                                className={`cursor-pointer px-3 py-1.5 text-sm transition-colors ${
                                  isSelected 
                                    ? "bg-primary/80 hover:bg-primary text-white" 
                                    : "bg-white text-muted-foreground hover:bg-muted"
                                } ${!isEditing && "pointer-events-none opacity-80"}`}
                                onClick={() => {
                                  if (!isEditing) return;
                                  if (isSelected) {
                                    field.onChange(field.value.filter(v => v !== lang.id));
                                  } else {
                                    field.onChange([...field.value, lang.id]);
                                  }
                                }}
                              >
                                {isSelected && <Check className="w-3.5 h-3.5 mr-1.5" />}
                                {lang.label}
                              </Badge>
                            );
                          })}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-3 pt-4 mt-6 border-t border-border/50">
                    {!isEditing ? (
                      <Button 
                        type="button" 
                        onClick={(e) => { e.preventDefault(); setIsEditing(true); }} 
                        className="bg-primary/90 hover:bg-primary text-white rounded-lg px-6"
                      >
                        <Edit2 className="w-4 h-4 mr-2" /> Edit Profile
                      </Button>
                    ) : (
                      <>
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => {
                            setIsEditing(false);
                            profileForm.reset(); // Revert changes
                          }}
                        >
                          Cancel
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={updateProfileMutation.isPending}
                          className="bg-primary/90 hover:bg-primary text-white rounded-lg px-6 border-none"
                        >
                          {updateProfileMutation.isPending ? <LoadingSpinner className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                          Save Changes
                        </Button>
                      </>
                    )}
                  </div>

                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab Content */}
        {user.provider === "local" && (
          <TabsContent value="security" className="space-y-6">
            <Card className="bg-primary/5 dark:bg-primary/5 border-0 shadow-sm rounded-2xl overflow-hidden">
              <CardContent className="p-6 sm:p-8 space-y-6">
                
                {securityMode === "standard" ? (
                  <>
                    <div className="flex justify-between items-start max-sm:flex-col">
                      <div>
                        <h3 className="text-lg font-bold text-foreground">Change Password</h3>
                        <p className="text-sm text-muted-foreground">Update your password using your current password.</p>
                      </div>
                      <Button 
                        variant="ghost" 
                        onClick={() => setSecurityMode("otp_flow")}
                        className="text-primary/80 hover:text-primary/90 hover:bg-none text-sm"
                      >
                        Forgot Current Password?
                      </Button>
                    </div>

                    <Form {...passwordForm}>
                      <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-5 max-w-md">
                        <FormField control={passwordForm.control} name="currentPassword" render={({ field }) => (
                          <FormItem>
                            <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Current Password</Label>
                            <FormControl>
                              <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-60" />
                                <Input {...field} type="password" className="pl-10 bg-white dark:bg-background border-primary/40" />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}/>
                        <FormField control={passwordForm.control} name="newPassword" render={({ field }) => (
                          <FormItem>
                            <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">New Password</Label>
                            <FormControl>
                              <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-60" />
                                <Input {...field} type="password" className="pl-10 bg-white dark:bg-background border-primary/40" />
                              </div>
                            </FormControl>
                            <p className="text-xs text-muted-foreground">Password must be at least 8 characters</p>
                            <FormMessage />
                          </FormItem>
                        )}/>
                        <FormField control={passwordForm.control} name="confirmPassword" render={({ field }) => (
                          <FormItem>
                            <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Confirm New Password</Label>
                            <FormControl>
                              <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-60" />
                                <Input {...field} type="password" className="pl-10 bg-white dark:bg-background border-primary/40" />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}/>
                        <div className="pt-2">
                          <Button type="submit" disabled={changePasswordMutation.isPending} className="bg-primary/90 hover:bg-primary border-none text-white rounded-lg px-6">
                            {changePasswordMutation.isPending && <LoadingSpinner className="mr-2 h-4 w-4" />} Update Password
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-lg font-bold text-primary/80">Reset Password via Email</h3>
                        <p className="text-sm text-muted-foreground">We will send a 6-digit code to <span className="font-medium text-foreground">{user.email}</span></p>
                      </div>
                      <Button variant="ghost" onClick={() => setSecurityMode("standard")} className="text-muted-foreground hover:bg-muted text-sm">
                        Back to standard
                      </Button>
                    </div>

                    {!isOtpSent ? (
                      <div className="max-w-md p-6 bg-white dark:bg-background border border-primary/20 rounded-xl text-center space-y-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                          <Mail className="w-6 h-6 text-primary/80" />
                        </div>
                        <h4 className="font-semibold text-lg">Send Verification Code</h4>
                        <p className="text-sm text-muted-foreground pb-2">You need to verify your identity to reset your password without your current one.</p>
                        <Button 
                          onClick={() => sendOtpMutation.mutate()} 
                          disabled={sendOtpMutation.isPending}
                          className="w-full bg-primary/90 hover:bg-primary text-white border-none"
                        >
                          {sendOtpMutation.isPending ? <LoadingSpinner className="mr-2 h-4 w-4" /> : "Send OTP to Email"}
                        </Button>
                      </div>
                    ) : (
                      <Form {...otpPasswordForm}>
                        <form onSubmit={otpPasswordForm.handleSubmit(onOtpPasswordSubmit)} className="space-y-5 max-w-md">
                          <FormField control={otpPasswordForm.control} name="otp" render={({ field }) => (
                            <FormItem>
                              <Label className="text-emerald-700 text-xs font-semibold uppercase tracking-wider">6-Digit OTP</Label>
                              <FormControl>
                                <div className="relative">
                                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/80" />
                                  <Input {...field} placeholder="000000" maxLength={6} className="pl-10 bg-white dark:bg-background text-lg tracking-[0.5em] font-mono border-primary/40" />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}/>
                          <FormField control={otpPasswordForm.control} name="newPassword" render={({ field }) => (
                            <FormItem>
                              <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">New Password</Label>
                              <FormControl><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-60" /><Input {...field} type="password" className="pl-10 bg-white dark:bg-background border-primary/40" /></div></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}/>
                          <FormField control={otpPasswordForm.control} name="confirmPassword" render={({ field }) => (
                            <FormItem>
                              <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Confirm New Password</Label>
                              <FormControl><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-60" /><Input {...field} type="password" className="pl-10 bg-white dark:bg-background border-primary/40" /></div></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}/>
                          <div className="pt-2 flex gap-3">
                            <Button type="submit" disabled={verifyOtpAndResetMutation.isPending} className="bg-primary/90 hover:bg-primary text-white rounded-lg flex-1">
                              {verifyOtpAndResetMutation.isPending && <LoadingSpinner className="mr-2 h-4 w-4" />} Verify & Reset Password
                            </Button>
                          </div>
                        </form>
                      </Form>
                    )}
                  </>
                )}

              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Profile Image Upload Modal */}
      <Modal 
        isOpen={isAvatarModalOpen} 
        onClose={() => {
          setIsAvatarModalOpen(false);
          setPreviewImage(null);
        }}
        title="Update Profile Picture"
        description="Choose a photo and adjust it to fit your profile perfectly."
        icon={<ImageIcon className="w-5 h-5 text-primary/80" />}
        footer={
          <>
            <Button variant="ghost" onClick={() => {
              setIsAvatarModalOpen(false);
              setPreviewImage(null);
            }}>Cancel</Button>
            <Button 
              onClick={confirmImageUpload} 
              disabled={!previewImage || isUploadingImage}
              className="bg-primary/90 hover:bg-primary text-white border-none"
            >
              {isUploadingImage && <LoadingSpinner size="sm" className="mr-2" />}
              Save & Upload
            </Button>
          </>
        }
      >
        <div className="flex flex-col items-center justify-center p-2 sm:p-6 space-y-6">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
          />

          {!previewImage ? (
            // State 1: No image selected — show file picker
            <div
              className="w-full h-64 border-dashed border-2 border-primary/20 hover:bg-primary/10 dark:hover:bg-primary/20 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Avatar className="h-24 w-24 border-4 border-primary/20 shadow-md mb-4">
                <AvatarImage src={user.profileImage} className="object-cover" />
                <AvatarFallback className="bg-primary/10 text-primary/80 text-3xl font-bold">
                  {getInitials(user.fullName)}
                </AvatarFallback>
              </Avatar>
              <h3 className="font-semibold text-primary/80 dark:text-primary/60 flex items-center gap-2">
                <UploadCloud className="w-5 h-5" /> Click here to browse files
              </h3>
              <p className="text-xs text-muted-foreground mt-1 font-normal">Supports JPG, PNG, WEBP (Max 5MB)</p>
            </div>
          ) : (
            // State 2: Image selected — show Cropper + prominent change button
            <div className="w-full flex flex-col items-center gap-4">
              <p className="text-xs text-muted-foreground text-center">Drag to reposition · Use the slider to zoom</p>
              <div className="relative w-full h-[300px] sm:h-[400px] bg-black/5 rounded-2xl overflow-hidden shadow-inner">
                <Cropper
                  image={previewImage}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                />
              </div>

              <div className="w-full px-4 flex items-center gap-3">
                <ImageIcon className="w-4 h-4 text-muted-foreground" />
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full h-2 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <ZoomIn className="w-4 h-4 text-muted-foreground" />
              </div>

              <Button
                variant="outline"
                className="w-full border-primary/40 text-primary hover:bg-primary/10 font-semibold flex items-center justify-center gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadCloud className="w-4 h-4" />
                Select a New Photo
              </Button>
            </div>
          )}
        </div>
      </Modal>

    </div>
  );
}