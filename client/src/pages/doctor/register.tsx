import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Specialization } from "@shared/schema";
import { ConsultationType, Gender, Language, UserRole } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle,
  Eye,
  EyeOff,
  FileText,
  GraduationCap,
  Loader2,
  PlusCircle,
  Stethoscope,
  Upload,
  User,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation } from "wouter";
import { z } from "zod";

const buildPersonalInfoSchema = (requirePassword: boolean) =>
  z
    .object({
      fullName: z.string().min(2, "Full name is required"),
      email: z.string().email("Invalid email address"),
      phone: z.string().regex(/^07[0-9]{8}$/, "Please enter a valid Sri Lankan mobile number (07XXXXXXXX)"),
      password: requirePassword
        ? z
            .string()
            .min(8, "Password must be at least 8 characters")
            .regex(
              /[A-Z]/,
              "Password must contain at least one uppercase letter",
            )
            .regex(
              /[a-z]/,
              "Password must contain at least one lowercase letter",
            )
            .regex(/[0-9]/, "Password must contain at least one number")
        : z.string().optional(),
      confirmPassword: requirePassword ? z.string() : z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      gender: z.enum([Gender.MALE, Gender.FEMALE]).optional(),
    })
    .superRefine((data, ctx) => {
      if (requirePassword && data.password !== data.confirmPassword) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Passwords don't match",
          path: ["confirmPassword"],
        });
      }
    });

const professionalInfoSchema = z.object({
  registrationNumber: z.string().min(5, "Registration number is required"),
  qualifications: z.string().min(10, "Please provide your qualifications"),
  biography: z.string().optional(),
  specializationIds: z
    .array(z.string())
    .min(1, "Select at least one specialization"),
  languagesSpoken: z.array(z.string()).min(1, "Select at least one language"),
  consultationTypes: z
    .array(z.string())
    .min(1, "Select at least one consultation type"),
  consultationFee: z.string().min(1, "Consultation fee is required"),
  onlineConsultationFee: z.string().optional(),
  clinic_locations: z.array(z.string()).default([]),
}).superRefine((data, ctx) => {
  if (data.consultationTypes.includes(ConsultationType.IN_PERSON) && (!data.clinic_locations || data.clinic_locations.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please enter your meeting location for In-Person consultations",
      path: ["clinic_locations"],
    });
  }
});

const bankInfoSchema = z.object({
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankBranch: z.string().optional(),
  agreeTerms: z
    .boolean()
    .refine((val) => val === true, "You must agree to the terms"),
});

type PersonalInfo = z.infer<ReturnType<typeof buildPersonalInfoSchema>>;
type ProfessionalInfo = z.infer<typeof professionalInfoSchema>;
type BankInfo = z.infer<typeof bankInfoSchema>;

const STEPS = [
  { id: 1, title: "Personal Info", icon: User },
  { id: 2, title: "Professional", icon: GraduationCap },
  { id: 3, title: "Documents", icon: FileText },
  { id: 4, title: "Bank Details", icon: Building2 },
];

interface FileDetail {
  id: string;
  name: string;
  size: number;
  type: string;
  previewUrl: string;
}

const SRI_LANKAN_BANKS = [
  { name: "Amana Bank PLC", domain: "amanabank.lk" },
  { name: "Axis Bank Ltd", domain: "axisbank.com" },
  { name: "Bank of Ceylon", domain: "boc.lk" },
  { name: "Cargills Bank PLC", domain: "cargillsbank.com" },
  { name: "Citibank, N.A.", domain: "citibank.com" },
  { name: "Commercial Bank of Ceylon PLC", domain: "combank.lk" },
  { name: "Deutsche Bank AG", domain: "db.com" },
  { name: "DFCC Bank PLC", domain: "dfcc.lk" },
  { name: "Habib Bank Ltd", domain: "hbl.com" },
  { name: "Hatton National Bank PLC", domain: "hnb.net" },
  { name: "HSBC", domain: "hsbc.lk" },
  { name: "ICICI Bank Ltd", domain: "icicibank.com" },
  { name: "Indian Bank", domain: "indianbank.in" },
  { name: "Indian Overseas Bank", domain: "iob.in" },
  { name: "MCB Bank Ltd", domain: "mcb.com.pk" },
  { name: "National Development Bank PLC", domain: "ndbbank.com" },
  { name: "Nations Trust Bank PLC", domain: "nationstrust.com" },
  { name: "Pan Asia Banking Corporation PLC", domain: "pabcbank.com" },
  { name: "People's Bank", domain: "peoplesbank.lk" },
  { name: "Public Bank Berhad", domain: "publicbankgroup.com" },
  { name: "Sampath Bank PLC", domain: "sampath.lk" },
  { name: "Seylan Bank PLC", domain: "seylan.lk" },
  { name: "Standard Chartered Bank", domain: "sc.com" },
  { name: "State Bank of India", domain: "sbi.co.in" },
  { name: "Union Bank of Colombo PLC", domain: "unionb.com" },
  { name: "Other", domain: "" },
];

export default function DoctorRegisterPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo | null>(null);
  const [professionalInfo, setProfessionalInfo] =
    useState<ProfessionalInfo | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadToken, setUploadToken] = useState<string | null>(null);
  const [authRegistrationToken, setAuthRegistrationToken] = useState<
    string | null
  >(null);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [fileDetails, setFileDetails] = useState<FileDetail[]>([]);
  const [isSocialFlow, setIsSocialFlow] = useState(false);
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const [bankStatementFile, setBankStatementFile] = useState<{
    url: string;
    name: string;
    type: string;
    previewUrl?: string;
  } | null>(null);
  const [locationInput, setLocationInput] = useState("");

  const { data: specializations = [] } = useQuery<Specialization[]>({
    queryKey: ["/api/specializations"],
  });

  const personalSchema = useMemo(
    () => buildPersonalInfoSchema(!isSocialFlow),
    [isSocialFlow],
  );

  const personalForm = useForm<PersonalInfo>({
    resolver: zodResolver(personalSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      address: "",
      city: "",
    },
  });

  const professionalForm = useForm<ProfessionalInfo>({
    resolver: zodResolver(professionalInfoSchema),
    defaultValues: {
      registrationNumber: "",
      qualifications: "",
      biography: "",
      specializationIds: [],
      languagesSpoken: [Language.ENGLISH],
      consultationTypes: [ConsultationType.IN_PERSON],
      consultationFee: "",
      onlineConsultationFee: "",
      clinic_locations: [],
    },
  });

  const bankForm = useForm<BankInfo>({
    resolver: zodResolver(bankInfoSchema),
    defaultValues: {
      bankName: "",
      bankAccountNumber: "",
      bankBranch: "",
      agreeTerms: false,
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("registrationToken");
    if (token) {
      setIsSocialFlow(true);
      setAuthRegistrationToken(token);
      const storedUser = sessionStorage.getItem("registrationUser");
      if (storedUser) {
        try {
          const decoded = JSON.parse(decodeURIComponent(storedUser));
          personalForm.reset({
            fullName: decoded.fullName || decoded.name || "",
            email: decoded.email || "",
            phone: decoded.phone || "",
            password: "",
            confirmPassword: "",
            address: decoded.address || "",
            city: decoded.city || "",
          });
        } catch {
          // ignore parse errors
        }
      }
    }
  }, [personalForm]);

  useEffect(() => {
    return () => {
      fileDetails.forEach((file) => URL.revokeObjectURL(file.previewUrl));
    };
  }, [fileDetails]);

  const registerMutation = useMutation({
    mutationFn: async (data: any) => {
      if (isSocialFlow && authRegistrationToken) {
        const response = await fetch("/api/auth/complete-registration", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            registrationToken: authRegistrationToken,
            role: UserRole.DOCTOR,
            fullName: data.fullName,
            phone: data.phone,
            preferredLanguages: data.languagesSpoken || [Language.ENGLISH],
            address: data.address,
            city: data.city,
            registrationNumber: data.registrationNumber,
            qualifications: data.qualifications,
            specializationIds: data.specializationIds,
            languagesSpoken: data.languagesSpoken,
            consultationTypes: data.consultationTypes,
            consultationFee: data.consultationFee,
            onlineConsultationFee: data.onlineConsultationFee,
            homeVisitFee: data.homeVisitFee,
            verificationDocuments: data.verificationDocuments,
            bankName: data.bankName,
            bankAccountNumber: data.bankAccountNumber,
            bankBranch: data.bankBranch,
            biography: data.biography,
          }),
        });
        if (!response.ok) {
          const error = await response.json();
          const message = error.details?.length
            ? error.details.map((d: any) => d.message).join(", ")
            : error.error || "Registration failed";
          throw new Error(message);
        }
        return response.json();
      }

      const response = await fetch("/api/auth/register-doctor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(uploadToken ? { "X-Registration-Token": uploadToken } : {}),
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        const message = error.details?.length
          ? error.details.map((d: any) => d.message).join(", ")
          : error.error || "Registration failed";
        throw new Error(message);
      }
      return response.json();
    },
    onSuccess: (data: { user: any; token: string }) => {
      toast({
        title: "Registration Submitted!",
        description:
          "Your application is pending verification. We'll notify you once approved.",
      });
      setLocation("/login");
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message || "Please check your details and try again",
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (!uploadToken || !personalInfo?.email) {
      toast({
        title: "Session expired",
        description: "Please refresh the page and try again.",
        variant: "destructive",
      });
      return;
    }

    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
    const validFiles = Array.from(files).filter((file) => {
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "File too large",
          description: `${file.name} is larger than 5MB. Please select a smaller file.`,
          variant: "destructive",
        });
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) {
      if (event.target) event.target.value = "";
      return;
    }

    const newFileDetails = validFiles.map((file) => ({
      id: Math.random().toString(36).substring(2, 9),
      name: file.name,
      size: file.size,
      type: file.type,
      previewUrl: URL.createObjectURL(file),
    }));

    setFileDetails((prev) => [...prev, ...newFileDetails]);

    setIsUploading(true);

    try {
      for (const file of validFiles) {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/upload", {
          method: "POST",
          headers: {
            "X-Registration-Token": uploadToken,
            "X-Registration-Email": personalInfo.email,
          },
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Upload failed");
        }

        const result = await response.json();
        setUploadedFiles((prev) => [...prev, result.url]);
      }

      toast({
        title: "Files uploaded",
        description: "Your documents have been uploaded successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error?.message || "Failed to upload documents. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (event.target) event.target.value = "";
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
    setFileDetails((prev) => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].previewUrl);
      updated.splice(index, 1);
      return updated;
    });
  };

  const handlePersonalSubmit = async (data: PersonalInfo) => {
    try {
      const response = await fetch("/api/registration/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast({
          title: "Registration Error",
          description: error.error || "Failed to start registration",
          variant: "destructive",
        });
        return;
      }

      const result = await response.json();
      setUploadToken(result.token);
      setPersonalInfo(data);
      setCurrentStep(2);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Unable to connect to the server. Please check your internet connection and try again.",
        variant: "destructive",
      });
    }
  };

  const handleProfessionalSubmit = (data: ProfessionalInfo) => {
    setProfessionalInfo(data);
    setCurrentStep(3);
  };

  const handleDocumentsNext = () => {
    if (uploadedFiles.length === 0) {
      toast({
        title: "Documents required",
        description: "Please upload at least one verification document.",
        variant: "destructive",
      });
      return;
    }
    setCurrentStep(4);
  };

  const handleFinalSubmit = (bankData: BankInfo) => {
    if (!personalInfo || !professionalInfo) {
      toast({
        title: "Error",
        description: "Missing personal or professional info",
        variant: "destructive",
      });
      return;
    }

    const registrationData = {
      ...personalInfo,
      registrationNumber: professionalInfo.registrationNumber,
      qualifications: professionalInfo.qualifications,
      biography: professionalInfo.biography,
      specializationIds: professionalInfo.specializationIds,
      languagesSpoken: professionalInfo.languagesSpoken,
      consultationTypes: professionalInfo.consultationTypes,
      consultationFee: parseInt(professionalInfo.consultationFee) || 0,
      onlineConsultationFee: professionalInfo.onlineConsultationFee
        ? parseInt(professionalInfo.onlineConsultationFee)
        : undefined,
      verificationDocuments: bankStatementFile
        ? [...uploadedFiles, bankStatementFile.url]
        : uploadedFiles,
      verificationDocumentDetails: uploadedFiles,
      bankName: bankData.bankName,
      bankAccountNumber: bankData.bankAccountNumber,
      bankBranch: bankData.bankBranch,
      clinic_locations: professionalInfo.clinic_locations,
    };

    registerMutation.mutate(registrationData);
  };

  const handleBankStatementUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    const isImage = file.type.startsWith("image/");
    const previewUrl = isImage ? URL.createObjectURL(file) : undefined;

    if (!uploadToken || !personalInfo?.email) {
      setTimeout(() => {
        setBankStatementFile({
          url: "mock-url-for-dev",
          name: file.name,
          type: file.type,
          previewUrl,
        });
        setIsUploading(false);
        toast({ title: "Document Added (Dev Mode)" });
      }, 1000);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "X-Registration-Token": uploadToken,
          "X-Registration-Email": personalInfo.email,
        },
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");

      const result = await response.json();
      setBankStatementFile({
        url: result.url,
        name: file.name,
        type: file.type,
        previewUrl,
      });
      toast({ title: "Bank statement uploaded!" });
    } catch (error) {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const removeBankStatement = () => {
    if (bankStatementFile?.previewUrl) {
      URL.revokeObjectURL(bankStatementFile.previewUrl);
    }
    setBankStatementFile(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <Link href="/">
            <div className="flex items-center justify-center cursor-pointer">
              <img src="/logo-light.png" alt="AyurPath" className="h-10 w-auto dark:hidden" />
              <img src="/logo-dark.png" alt="AyurPath" className="h-10 w-auto hidden dark:block" />
            </div>
          </Link>
        </div>

        <div className="flex justify-between items-center mb-8 w-full ps-5 pe-5">
          {STEPS.map((step, index) => (
            <div
              key={step.id}
              className={`flex items-center ${index < STEPS.length - 1 ? "flex-1" : ""}`}
            >
              <div className="flex flex-col items-center relative">
                <div
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center z-10 ${
                    currentStep >= step.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {currentStep > step.id ? (
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                  ) : (
                    <step.icon className="h-4 w-4 sm:h-5 sm:w-5" />
                  )}
                </div>

                <span
                  className={`text-xs mt-2 absolute top-full whitespace-nowrap hidden sm:block ${
                    currentStep >= step.id
                      ? "text-primary font-medium"
                      : "text-muted-foreground"
                  }`}
                >
                  {step.title}
                </span>
              </div>

              {index < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 sm:mx-4 ${
                    currentStep > step.id ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 max-sm:hidden">
              <Stethoscope className="h-5 w-5" />
              Doctor Registration - Step {currentStep} of 4
            </CardTitle>
            <CardTitle className="flex items-center gap-2 sm:hidden">
              <Stethoscope className="h-8 w-8" />
              Doctor Registration <br /> Step {currentStep} of 4
            </CardTitle>
            <CardDescription>
              {currentStep === 1 && "Enter your personal information"}
              {currentStep === 2 && "Enter your professional credentials"}
              {currentStep === 3 && "Upload verification documents"}
              {currentStep === 4 && "Bank details for payouts (optional)"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {currentStep === 1 && (
              <Form {...personalForm}>
                <form
                  onSubmit={personalForm.handleSubmit(handlePersonalSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={personalForm.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Dr. John Doe"
                            data-testid="input-fullname"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={personalForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email *</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="doctor@example.com"
                              data-testid="input-email"
                              disabled={isSocialFlow}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={personalForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="+94 77 123 4567"
                              data-testid="input-phone"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {!isSocialFlow && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={personalForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password *</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type={showPassword ? "text" : "password"}
                                  placeholder="Create password"
                                  data-testid="input-password"
                                  {...field}
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowPassword(!showPassword)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                                >
                                  {showPassword ? (
                                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <Eye className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={personalForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirm Password *</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type={
                                    showConfirmPassword ? "text" : "password"
                                  }
                                  placeholder="Confirm password"
                                  data-testid="input-confirm-password"
                                  {...field}
                                />
                                <button
                                  type="button"
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                                  onClick={() =>
                                    setShowConfirmPassword(!showConfirmPassword)
                                  }
                                >
                                  {showConfirmPassword ? (
                                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <Eye className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  <FormField
                    control={personalForm.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Your address"
                            data-testid="input-address"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={personalForm.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Colombo"
                            data-testid="input-city"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={personalForm.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gender</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-gender">
                              <SelectValue placeholder="Select gender" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={Gender.MALE}>Male</SelectItem>
                            <SelectItem value={Gender.FEMALE}>
                              Female
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-between pt-4">
                    <Link href="/register">
                      <Button variant="ghost" type="button">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                      </Button>
                    </Link>
                    <Button type="submit" data-testid="button-next-step1">
                      Next
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </form>
              </Form>
            )}

            {currentStep === 2 && (
              <Form {...professionalForm}>
                <form
                  onSubmit={professionalForm.handleSubmit(
                    handleProfessionalSubmit,
                  )}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 gap-4">
                    <FormField
                      control={professionalForm.control}
                      name="registrationNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SLAMC Registration Number *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="AY/12345"
                              data-testid="input-registration"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Your Ayurvedic Medical Council registration
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={professionalForm.control}
                    name="qualifications"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Qualifications *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="BAMS, MD (Ayurveda), PhD..."
                            data-testid="input-qualifications"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          List your educational degrees and certifications
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={professionalForm.control}
                    name="biography"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Professional Biography</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Brief description of your practice and expertise..."
                            data-testid="input-biography"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={professionalForm.control}
                    name="specializationIds"
                    render={({ field }) => {
                      return (
                        <FormItem>
                          <FormLabel>Specializations *</FormLabel>
                          <div className="grid grid-cols-2 gap-2">
                            {specializations.map((spec) => (
                              <div
                                key={spec.id}
                                className="flex items-center space-x-2"
                              >
                                <Checkbox
                                  id={spec.id}
                                  checked={field.value.includes(spec.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      field.onChange([...field.value, spec.id]);
                                    } else {
                                      field.onChange(
                                        field.value.filter(
                                          (id) => id !== spec.id,
                                        ),
                                      );
                                    }
                                  }}
                                />
                                <label
                                  htmlFor={spec.id}
                                  className="text-sm cursor-pointer"
                                >
                                  {spec.name}
                                </label>
                              </div>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />

                  <FormField
                    control={professionalForm.control}
                    name="languagesSpoken"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Languages *</FormLabel>
                        <div className="flex gap-4">
                          {[
                            { value: Language.ENGLISH, label: "English" },
                            { value: Language.SINHALA, label: "Sinhala" },
                            { value: Language.TAMIL, label: "Tamil" },
                          ].map((lang) => (
                            <div
                              key={lang.value}
                              className="flex items-center space-x-2"
                            >
                              <Checkbox
                                id={lang.value}
                                checked={field.value.includes(lang.value)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    field.onChange([
                                      ...field.value,
                                      lang.value,
                                    ]);
                                  } else {
                                    field.onChange(
                                      field.value.filter(
                                        (l) => l !== lang.value,
                                      ),
                                    );
                                  }
                                }}
                              />
                              <label
                                htmlFor={lang.value}
                                className="text-sm cursor-pointer"
                              >
                                {lang.label}
                              </label>
                            </div>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={professionalForm.control}
                    name="consultationTypes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Consultation Types *</FormLabel>
                        <div className="flex gap-4">
                          {[
                            {
                              value: ConsultationType.IN_PERSON,
                              label: "In-Person",
                            },
                            { value: ConsultationType.ONLINE, label: "Online" },
                          ].map((type) => (
                            <div
                              key={type.value}
                              className="flex items-center space-x-2"
                            >
                              <Checkbox
                                id={type.value}
                                checked={field.value.includes(type.value)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    field.onChange([
                                      ...field.value,
                                      type.value,
                                    ]);
                                  } else {
                                    field.onChange(
                                      field.value.filter(
                                        (t) => t !== type.value,
                                      ),
                                    );
                                  }
                                }}
                              />
                              <label
                                htmlFor={type.value}
                                className="text-sm cursor-pointer"
                              >
                                {type.label}
                              </label>
                            </div>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Multiple Locations Add */}
                  {professionalForm.watch("consultationTypes").includes(ConsultationType.IN_PERSON) && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                      <FormField
                        control={professionalForm.control}
                        name="clinic_locations"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-bold text-primary">In-Person Meeting Locations *</FormLabel>
                            
                            <div className="flex gap-2">
                              <Input
                                placeholder="Enter clinic, hospital, or city..."
                                value={locationInput}
                                onChange={(e) => setLocationInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    if (locationInput.trim() && !field.value?.includes(locationInput.trim())) {
                                      field.onChange([...(field.value || []), locationInput.trim()]);
                                      setLocationInput("");
                                    }
                                  }
                                }}
                              />
                              <Button
                                type="button"
                                onClick={() => {
                                  if (locationInput.trim() && !field.value?.includes(locationInput.trim())) {
                                    field.onChange([...(field.value || []), locationInput.trim()]);
                                    setLocationInput("");
                                  }
                                }}
                              >
                                Add
                              </Button>
                            </div>

                            {Array.isArray(field.value) && field.value.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-3">
                                {field.value.map((loc: string, index: number) => (
                                  <div key={index} className="flex items-center bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
                                    {loc}
                                    <X
                                      className="h-3.5 w-3.5 ml-2 cursor-pointer hover:text-destructive transition-colors"
                                      onClick={() => {
                                        field.onChange(field.value.filter((_, i) => i !== index));
                                      }}
                                    />
                                  </div>
                                ))}
                              </div>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={professionalForm.control}
                      name="consultationFee"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>In-Person Fee (LKR) *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="2000"
                              data-testid="input-fee"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={professionalForm.control}
                      name="onlineConsultationFee"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Online Fee (LKR)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="1500"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-between pt-4">
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => setCurrentStep(1)}
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                    <Button type="submit" data-testid="button-next-step2">
                      Next
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </form>
              </Form>
            )}

            {/* Step 3 - Interactive Image/PDF Previews */}
            {currentStep === 3 && (
              <div className="space-y-6">
                {/* Upload Box matching Careers page style */}
                <div
                  className={`border-2 border-dashed border-border rounded-xl p-10 text-center bg-background cursor-pointer hover:border-primary transition-colors ${isUploading ? "opacity-50 pointer-events-none" : ""}`}
                  onClick={() =>
                    !isUploading &&
                    document.getElementById("file-upload")?.click()
                  }
                >
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-bold text-foreground mb-2">
                    Upload Verification Documents
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Upload your medical council registration certificate, degree
                    certificates, and any other relevant documents.
                    <br />
                    Supported Formats: PDF, JPG, PNG (Max 5MB each)
                  </p>

                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    data-testid="input-file-upload"
                  />

                  <Button
                    variant="outline"
                    type="button"
                    disabled={isUploading}
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent the div click from triggering again
                      document.getElementById("file-upload")?.click();
                    }}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Select Files
                      </>
                    )}
                  </Button>
                </div>

                {/* Previews Grid matching Careers page logic */}
                {fileDetails.length > 0 && (
                  <div className="space-y-4 mt-6">
                    <h4 className="font-medium text-foreground">
                      Uploaded Documents
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {fileDetails.map((file, index) => {
                        const isPdf = file.type.includes("pdf");
                        const isImage = file.type.includes("image");

                        return (
                          <div
                            key={file.id}
                            className="border border-border rounded-xl p-4 bg-background shadow-sm flex flex-col"
                          >
                            {/* File Info Header */}
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3 overflow-hidden">
                                <div className="w-10 h-10 shrink-0 bg-primary/10 rounded-lg flex items-center justify-center">
                                  <FileText className="w-5 h-5 text-primary" />
                                </div>
                                <div className="min-w-0">
                                  <p
                                    className="text-foreground font-semibold text-sm truncate"
                                    title={file.name}
                                  >
                                    {file.name}
                                  </p>
                                  <p className="text-muted-foreground text-xs">
                                    {(file.size / 1024 / 1024).toFixed(2)} MB
                                  </p>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                type="button"
                                className="p-2 hover:bg-destructive/10 text-destructive rounded-lg transition-colors shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFile(index);
                                }}
                                disabled={isUploading}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>

                            {/* Visual Preview Section */}
                            <div className="w-full h-[180px] bg-muted/30 rounded-lg overflow-hidden border border-border/50 flex items-center justify-center relative mt-auto">
                              {isPdf ? (
                                <iframe
                                  src={`${file.previewUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                                  className="w-full h-full object-cover pointer-events-none"
                                  title={`Preview ${index}`}
                                />
                              ) : isImage ? (
                                <img
                                  src={file.previewUrl}
                                  alt={`Preview ${index}`}
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <div className="flex flex-col items-center text-muted-foreground">
                                  <FileText className="w-10 h-10 mb-2 opacity-30" />
                                  <span className="text-xs">
                                    No visual preview
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex justify-between pt-4">
                  <Button variant="ghost" onClick={() => setCurrentStep(2)}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back
                  </Button>
                  <Button
                    onClick={handleDocumentsNext}
                    data-testid="button-next-step3"
                  >
                    Next <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <Form {...bankForm}>
                <form
                  onSubmit={bankForm.handleSubmit(handleFinalSubmit)}
                  className="space-y-4"
                >
                  <p className="text-sm text-muted-foreground mb-4">
                    Bank details are optional but required for receiving
                    payments from online consultations.
                  </p>

                  <FormField
                    control={bankForm.control}
                    name="bankName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bank Name *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select your bank" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-[300px]">
                            {SRI_LANKAN_BANKS.map((bank) => (
                              <SelectItem key={bank.name} value={bank.name}>
                                <div className="flex items-center gap-3">
                                  {bank.name !== "Other" ? (
                                    <div className="w-6 h-6 flex items-center justify-center rounded bg-muted overflow-hidden shrink-0 border">
                                      <img
                                        src={`https://logo.clearbit.com/${bank.domain}`}
                                        alt=""
                                        className="w-full h-full object-contain"
                                        onError={(e) => {
                                          e.currentTarget.style.display =
                                            "none";
                                          e.currentTarget.nextElementSibling?.classList.remove(
                                            "hidden",
                                          );
                                        }}
                                      />
                                      <Building2 className="w-4 h-4 hidden text-muted-foreground" />
                                    </div>
                                  ) : (
                                    <div className="w-6 h-6 flex items-center justify-center rounded bg-primary/10 shrink-0 border border-primary/20">
                                      <Building2 className="w-4 h-4 text-primary" />
                                    </div>
                                  )}
                                  <span className="text-sm">{bank.name}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Select "Other" to specify bank name */}
                  {bankForm.watch("bankName") === "Other" && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                      <FormField
                        control={bankForm.control}
                        name="bankName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-bold text-primary">
                              Please Specify Bank Name *
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter your bank name"
                                onChange={(e) => field.onChange(e.target.value)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={bankForm.control}
                      name="bankAccountNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account Number</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="1234567890"
                              data-testid="input-account-number"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={bankForm.control}
                      name="bankBranch"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Branch</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Colombo Main"
                              data-testid="input-bank-branch"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-3 pt-2">
                    <FormLabel>Bank statement/ Proof of bank account</FormLabel>

                    {!bankStatementFile ? (
                      // Upload Box (Dashed Border)
                      <div
                        className="border-2 border-dashed border-primary/40 bg-primary/5 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-primary/10 transition-colors"
                        onClick={() =>
                          document
                            .getElementById("bank-statement-upload")
                            ?.click()
                        }
                      >
                        <input
                          type="file"
                          id="bank-statement-upload"
                          className="hidden"
                          accept=".pdf,.docx,.jpg,.png"
                          onChange={handleBankStatementUpload}
                          disabled={isUploading}
                        />
                        {isUploading ? (
                          <>
                            <Loader2 className="h-8 w-8 text-primary animate-spin mb-2" />
                            <p className="text-sm font-medium text-foreground">
                              Uploading...
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-semibold text-foreground mb-1">
                              Drag & Drop your Bank statement/ Proof of bank
                              account <br /> or Click to Upload
                            </p>
                            <p className="text-xs text-muted-foreground mb-4">
                              Supported Files: PDF, DOCX (Max 10MB)
                            </p>
                            <Upload className="h-6 w-6 text-foreground" />
                          </>
                        )}
                      </div>
                    ) : (
                      // Uploaded File Preview
                      <div className="space-y-2 mt-4 animate-in fade-in zoom-in duration-300">
                        <h4 className="text-sm font-bold text-foreground">
                          Uploaded Document
                        </h4>
                        <div className="relative rounded-xl border border-primary/20 bg-card text-card-foreground shadow-sm overflow-hidden group">
                          {/* Preview Area */}
                          {bankStatementFile.previewUrl ? (
                            <div className="w-full h-48 bg-muted relative flex items-center justify-center p-2">
                              <img
                                src={bankStatementFile.previewUrl}
                                alt="Document Preview"
                                className="w-full h-full object-contain rounded-md drop-shadow-sm"
                              />
                            </div>
                          ) : (
                            <div className="w-full h-32 bg-primary/5 flex flex-col items-center justify-center text-muted-foreground">
                              <FileText className="h-10 w-10 mb-2 text-primary/60" />
                              <span className="text-sm font-medium">
                                Preview not available for this file type
                              </span>
                            </div>
                          )}

                          {/* Details & Action Area */}
                          <div className="flex items-center justify-between p-3 bg-primary/5 border-t border-primary/10">
                            <div className="flex flex-col min-w-0 pr-2">
                              <span className="text-sm font-semibold text-foreground truncate w-full">
                                {bankStatementFile.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {bankStatementFile.type || "Document"}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-destructive hover:bg-destructive hover:text-white shrink-0 rounded-full transition-colors shadow-sm bg-white dark:bg-zinc-900"
                              onClick={removeBankStatement}
                              type="button"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <FormField
                    control={bankForm.control}
                    name="agreeTerms"
                    render={({ field }) => (
                      <FormItem className="flex items-start gap-2 space-y-0 pt-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-terms"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="font-normal cursor-pointer">
                            I agree to the{" "}
                            <Link
                              href="/terms"
                              className="text-primary underline"
                            >
                              Terms of Service
                            </Link>{" "}
                            and{" "}
                            <Link
                              href="/privacy"
                              className="text-primary underline"
                            >
                              Privacy Policy
                            </Link>
                            . I confirm that all information provided is
                            accurate and my credentials are valid.
                          </FormLabel>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-between pt-4 max-sm:flex-col max-sm:gap-2">
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => setCurrentStep(3)}
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                    <Button
                      type="submit"
                      disabled={registerMutation.isPending}
                      data-testid="button-submit-registration"
                    >
                      {registerMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Submit Application
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            )}

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login">
                <Button variant="ghost" className="px-0 h-auto underline">
                  Sign in
                </Button>
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
