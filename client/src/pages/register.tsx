import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, User, Stethoscope } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { UserRole, Language, Gender } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const buildRegisterSchema = (requirePassword: boolean) => z.object({
  email: z.string().email("Invalid email address"),
  password: requirePassword
    ? z.string()
        .min(8, "Password must be at least 8 characters")
        .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
        .regex(/[a-z]/, "Password must contain at least one lowercase letter")
        .regex(/[0-9]/, "Password must contain at least one number")
        .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character")
    : z.string().optional(),
  confirmPassword: requirePassword ? z.string() : z.string().optional(),
  fullName: z.string().min(2, "Full name is required"),
  phone: z.string().regex(/^07[0-9]{8}$/, "Please enter a valid Sri Lankan mobile number (07XXXXXXXX)"),
  gender: z.enum([Gender.MALE, Gender.FEMALE, Gender.OTHER]).optional(),
  preferredLanguage: z.enum([Language.ENGLISH, Language.SINHALA, Language.TAMIL]),
  agreeTerms: z.boolean().refine(val => val === true, "You must agree to the terms"),
}).superRefine((data, ctx) => {
  if (requirePassword && data.password !== data.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["confirmPassword"],
      message: "Passwords don't match",
    });
  }
});

type RegisterInput = z.infer<ReturnType<typeof buildRegisterSchema>>;

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [registerType, setRegisterType] = useState<"patient" | "doctor">("patient");
  const [isSocialFlow, setIsSocialFlow] = useState(false);
  const [registrationToken, setRegistrationToken] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();

  const schema = useMemo(() => buildRegisterSchema(!isSocialFlow), [isSocialFlow]);
  const doctorRegisterHref = registrationToken 
    ? `/doctor/register?registrationToken=${encodeURIComponent(registrationToken)}`
    : "/doctor/register";

  const form = useForm<RegisterInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      fullName: "",
      phone: "",
      preferredLanguage: Language.ENGLISH,
      agreeTerms: false,
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("registrationToken");
    if (token) {
      setIsSocialFlow(true);
      setRegistrationToken(token);
      const storedUser = sessionStorage.getItem("registrationUser");
      if (storedUser) {
        try {
          const decoded = JSON.parse(decodeURIComponent(storedUser));
          form.reset({
            email: decoded.email || "",
            fullName: decoded.fullName || decoded.name || "",
            phone: decoded.phone || "",
            preferredLanguage: decoded.preferredLanguages?.[0] || Language.ENGLISH,
            password: "",
            confirmPassword: "",
            agreeTerms: true,
          });
        } catch {
          // ignore parse errors
        }
      }
    }
  }, [form]);

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterInput) => {
      const { agreeTerms, confirmPassword, preferredLanguage, ...rest } = data;
      const response = await apiRequest("POST", "/api/auth/register", {
        ...rest,
        role: registerType === "doctor" ? UserRole.DOCTOR : UserRole.PATIENT,
        preferredLanguages: [preferredLanguage],
      });
      return response;
    },
    onSuccess: (data: { user: any; token: string }) => {
      if (registerType === "patient") {
        login(data.user, data.token);
        toast({
          title: "Account created!",
          description: "Welcome to AyurvedicDoctor.",
        });
        setLocation("/patient");
      } else {
        toast({
          title: "Registration submitted!",
          description: "Your account is pending verification. We'll notify you once approved.",
        });
        setLocation("/login");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message || "Please check your details and try again",
        variant: "destructive",
      });
    },
  });

  const socialCompleteMutation = useMutation({
    mutationFn: async (data: RegisterInput) => {
      const { preferredLanguage, ...rest } = data;
      const response = await apiRequest("POST", "/api/auth/complete-registration", {
        registrationToken,
        role: UserRole.PATIENT,
        fullName: rest.fullName,
        phone: rest.phone,
        preferredLanguages: [preferredLanguage],
      });
      return response;
    },
    onSuccess: (data: { user: any; token: string }) => {
      login(data.user, data.token);
      toast({
        title: "Profile completed",
        description: "Welcome to AyurvedicDoctor.",
      });
      setLocation("/patient");
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message || "Please check your details and try again",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RegisterInput) => {
    if (isSocialFlow && registrationToken) {
      socialCompleteMutation.mutate(data);
      return;
    }
    registerMutation.mutate(data);
  };

  if (registerType === "doctor") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary/5 to-background p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link href="/">
              <div className="flex items-center justify-center
               cursor-pointer">
                <img src="/logo-light.png" alt="AyurPath" className="h-10 w-auto dark:hidden" />
                <img src="/logo-dark.png" alt="AyurPath" className="h-10 w-auto hidden dark:block" />
              </div>
            </Link>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5" />
                Doctor Registration
              </CardTitle>
              <CardDescription>
                Join our platform as an Ayurvedic practitioner
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Doctor registration requires verification of your credentials. Please complete the full registration process which includes:
              </p>
              <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                <li>Personal information</li>
                <li>Professional qualifications</li>
                <li>Registration number with Ayurvedic regulatory body</li>
                <li>Upload of verification documents</li>
                <li>Bank details for payouts</li>
              </ul>
              <Link href={doctorRegisterHref}>
                <Button className="w-full mt-4">
                  Continue to Doctor Registration
                </Button>
              </Link>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setRegisterType("patient")}
              >
                Register as a Patient instead
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary/5 to-background p-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/">
            <div className="flex items-center justify-center cursor-pointer">
              <img src="/logo-light.png" alt="AyurPath" className="h-10 w-auto dark:hidden" />
              <img src="/logo-dark.png" alt="AyurPath" className="h-10 w-auto hidden dark:block" />
            </div>
          </Link>
          <p className="text-muted-foreground">
            Create your account to get started
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <Button
            variant={registerType === "patient" ? "default" : "outline"}
            className="h-auto py-4 flex flex-col gap-2"
            onClick={() => setRegisterType("patient")}
            data-testid="button-register-patient"
          >
            <User className="h-6 w-6" />
            <span>Patient</span>
          </Button>
          <Button
            variant={registerType === "doctor" ? "default" : "outline"}
            className="h-auto py-4 flex flex-col gap-2"
            onClick={() => setRegisterType("doctor")}
            data-testid="button-register-doctor"
          >
            <Stethoscope className="h-6 w-6" />
            <span>Doctor</span>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create Patient Account</CardTitle>
            <CardDescription>
              Sign up to book appointments with Ayurvedic doctors
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter your full name"
                          data-testid="input-fullname"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="you@example.com"
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
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number *</FormLabel>
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

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gender</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-gender">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={Gender.MALE}>Male</SelectItem>
                            <SelectItem value={Gender.FEMALE}>Female</SelectItem>
                            <SelectItem value={Gender.OTHER}>Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="preferredLanguage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preferred Language *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-language">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={Language.ENGLISH}>English</SelectItem>
                            <SelectItem value={Language.SINHALA}>Sinhala</SelectItem>
                            <SelectItem value={Language.TAMIL}>Tamil</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {!isSocialFlow && (
                  <>
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password *</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showPassword ? "text" : "password"}
                                placeholder="Create a strong password"
                                data-testid="input-password"
                                className="pr-10"
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
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password *</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showConfirmPassword ? "text" : "password"}
                                placeholder="Confirm your password"
                                data-testid="input-confirm-password"
                                {...field}
                              />
                              <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
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
                  </>
                )}

                <FormField
                  control={form.control}
                  name="agreeTerms"
                  render={({ field }) => (
                    <FormItem className="flex items-start gap-2 space-y-0">
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
                          <Link href="/terms" className="text-primary underline">
                            Terms of Service
                          </Link>{" "}
                          and{" "}
                          <Link href="/privacy" className="text-primary underline">
                            Privacy Policy
                          </Link>
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={registerMutation.isPending || socialCompleteMutation.isPending}
                  data-testid="button-register"
                >
                  {registerMutation.isPending || socialCompleteMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </form>
            </Form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>

              <div className="mt-6">
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => window.location.href = "/api/auth/google"}
                  data-testid="button-google-signup"
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Continue with Google
                </Button>
              </div>
            </div>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login">
                <Button variant="link" className="px-0 h-auto">
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
