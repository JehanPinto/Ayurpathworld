import { useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, ArrowLeft, Mail, KeyRound, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const emailSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

const passwordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain at least one uppercase letter")
      .regex(/[a-z]/, "Must contain at least one lowercase letter")
      .regex(/[0-9]/, "Must contain at least one number")
      .regex(/[^A-Za-z0-9]/, "Must contain at least one special character"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type EmailInput = z.infer<typeof emailSchema>;
type PasswordInput = z.infer<typeof passwordSchema>;

export default function ForgotPasswordPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Steps: 1. email -> 2. otp -> 3. password
  const [step, setStep] = useState<"email" | "otp" | "password">("email");
  const [submittedEmail, setSubmittedEmail] = useState("");
  
  // OTP State handling for 6 separate boxes
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const otpRefs = useRef<(HTMLInputElement | null)[]>(Array(6).fill(null));
  const [otpError, setOtpError] = useState("");
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const emailForm = useForm<EmailInput>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const passwordForm = useForm<PasswordInput>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
    mode: "onChange",
  });

  // MUTATION 1: Send OTP to Email
  const sendOtpMutation = useMutation({
    mutationFn: (data: EmailInput) =>
      apiRequest("POST", "/api/auth/forgot-password", data),
    onSuccess: () => {
      setSubmittedEmail(emailForm.getValues("email"));
      setOtp(Array(6).fill(""));
      setOtpError("");
      setStep("otp");
      toast({
        title: "OTP Sent",
        description: "Check your inbox for the 6-digit code.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send OTP",
        variant: "destructive",
      });
    },
  });

  // MUTATION 2: Verify OTP
  const verifyOtpMutation = useMutation({
    mutationFn: (otpString: string) =>
      apiRequest("POST", "/api/auth/verify-otp", {
        email: submittedEmail,
        otp: otpString,
      }),
    onSuccess: () => {
      passwordForm.reset();
      setStep("password");
    },
    onError: (error: Error) => {
      setOtpError(error.message || "Invalid OTP code");
    },
  });

  // MUTATION 3: Final Password Reset
  const resetPasswordMutation = useMutation({
    mutationFn: (data: PasswordInput) =>
      apiRequest("POST", "/api/auth/reset-password", {
        email: submittedEmail,
        otp: otp.join(""),
        newPassword: data.newPassword,
      }),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Your password has been updated. Please sign in.",
      });
      setLocation("/login");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reset password",
        variant: "destructive",
      });
    },
  });

  // Handle individual OTP box changes
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1); 
    setOtp(newOtp);
    setOtpError("");

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    
    if (pastedData) {
      const newOtp = [...otp];
      for (let i = 0; i < pastedData.length; i++) {
        newOtp[i] = pastedData[i];
      }
      setOtp(newOtp);
      setOtpError("");
      
      const focusIndex = Math.min(pastedData.length, 5);
      otpRefs.current[focusIndex]?.focus();
    }
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    const otpString = otp.join("");
    if (otpString.length !== 6) {
      setOtpError("Please enter all 6 digits.");
      return;
    }
    verifyOtpMutation.mutate(otpString);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary/5 to-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/">
            <div className="flex justify-center items-center cursor-pointer">
              <img src="/logo-light.png" alt="AyurPath" className="h-10 w-auto dark:hidden" />
              <img src="/logo-dark.png" alt="AyurPath" className="h-10 w-auto hidden dark:block" />
            </div>
          </Link>
        </div>

        {/* STEP 1: ENTER EMAIL */}
        {step === "email" && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 mb-1">
                <Mail className="h-5 w-5 text-primary" />
                <CardTitle>Forgot Password</CardTitle>
              </div>
              <CardDescription>
                Enter your registered email and we'll send you a verification code.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...emailForm}>
                <form
                  onSubmit={emailForm.handleSubmit((d) => sendOtpMutation.mutate(d))}
                  className="space-y-4"
                >
                  <FormField
                    control={emailForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="you@example.com"
                            autoComplete="email"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={sendOtpMutation.isPending}
                  >
                    {sendOtpMutation.isPending ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking...</>
                    ) : (
                      "Send Verification Code"
                    )}
                  </Button>
                </form>
              </Form>

              <div className="mt-4 text-center">
                <Link href="/login">
                  <button className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                    <ArrowLeft className="h-3 w-3" /> Back to Sign In
                  </button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 2: ENTER OTP */}
        {step === "otp" && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 mb-1">
                <KeyRound className="h-5 w-5 text-primary" />
                <CardTitle>Verify Code</CardTitle>
              </div>
              <CardDescription>
                Enter the 6-digit code sent to <strong>{submittedEmail}</strong>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <div className="space-y-2">
                  <Label>Verification Code</Label>
                  <div className="flex justify-between gap-2" onPaste={handleOtpPaste}>
                    {otp.map((digit, index) => (
                      <Input
                        key={index}
                        ref={(el) => (otpRefs.current[index] = el)}
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                        className={`h-12 w-12 text-center text-lg font-bold ${
                          otpError ? "border-destructive focus-visible:ring-destructive" : ""
                        }`}
                      />
                    ))}
                  </div>
                  {otpError && (
                    <p className="text-sm font-medium text-destructive mt-1">{otpError}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={verifyOtpMutation.isPending}
                >
                  {verifyOtpMutation.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</>
                  ) : (
                    "Verify Code"
                  )}
                </Button>
              </form>

              <div className="mt-6 flex flex-col gap-3 text-center text-sm">
                <button
                  type="button"
                  className="text-primary hover:underline font-medium"
                  onClick={() => sendOtpMutation.mutate({ email: submittedEmail })}
                  disabled={sendOtpMutation.isPending}
                >
                  Resend Code
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-primary transition-colors"
                  onClick={() => setStep("email")}
                >
                  Change Email Address
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 3: CREATE NEW PASSWORD */}
        {step === "password" && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 mb-1">
                <Lock className="h-5 w-5 text-primary" />
                <CardTitle>Create New Password</CardTitle>
              </div>
              <CardDescription>
                Your identity has been verified. Please create a strong new password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...passwordForm}>
                <form
                  onSubmit={passwordForm.handleSubmit((d) => resetPasswordMutation.mutate(d))}
                  className="space-y-4"
                >
                  <FormField
                    control={passwordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="Create a strong password"
                              className="pr-10"
                              autoComplete="new-password"
                              {...field}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={passwordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showConfirm ? "text" : "password"}
                              placeholder="Repeat your password"
                              className="pr-10"
                              autoComplete="new-password"
                              {...field}
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirm(!showConfirm)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                            >
                              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full mt-6"
                    disabled={resetPasswordMutation.isPending}
                  >
                    {resetPasswordMutation.isPending ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                    ) : (
                      "Save New Password"
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}