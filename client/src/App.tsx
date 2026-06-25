import { Switch, Route, useLocation, Redirect } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { LoadingPage } from "@/components/ui/loading-spinner";
import { UserRole } from "@shared/schema";

import HomePage from "@/pages/home";
import AboutPage from "@/pages/about";
import SpecializationsPage from "@/pages/specializations";
import ContactPage from "@/pages/contact";
import BlogPage from "@/pages/blog";
import BlogNewPage from "@/pages/blog-new";
import BlogDetailPage from "@/pages/blog-detail";
import LoginPage from "@/pages/login";
import ForgotPasswordPage from "@/pages/forgot-password";
import RegisterPage from "@/pages/register";
import AuthCallbackPage from "@/pages/auth-callback";
import DoctorsPage from "@/pages/doctors";
import DoctorProfilePage from "@/pages/doctor-profile";
import BookAppointmentPage from "@/pages/book-appointment";
import PatientDashboard from "@/pages/patient/dashboard";
import PatientAppointmentsPage from "@/pages/patient/appointments";
import PatientReviewsPage from "@/pages/patient/reviews";
import PatientSettingsPage from "@/pages/patient/settings";
import VerifyPhonePage from "@/pages/patient/verify-phone";
import DoctorDashboard from "@/pages/doctor/dashboard";
import DoctorRegisterPage from "@/pages/doctor/register";
import DoctorAppointmentsPage from "@/pages/doctor/appointments";
import DoctorSchedulePage from "@/pages/doctor/schedule";
import DoctorReviewsPage from "@/pages/doctor/reviews";
import DoctorEarningsPage from "@/pages/doctor/earnings";
import DoctorSettingsPage from "@/pages/doctor/settings";
import DoctorVerifyPhonePage from "@/pages/doctor/verify-phone";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminDoctorsPage from "@/pages/admin/doctors";
import AdminPatientsPage from "@/pages/admin/patients";
import AdminAppointmentsPage from "@/pages/admin/appointments";
import AdminSpecializationsPage from "@/pages/admin/specializations";
import AdminPaymentsPage from "@/pages/admin/payments";
import AdminPayoutsPage from "@/pages/admin/payouts";
import AdminSettingsPage from "@/pages/admin/settings";
import AdminBlogsPage from "@/pages/admin/blogs";
import AdminBlogViewPage from "@/pages/admin/blog-view";
import NotFound from "@/pages/not-found";
import EmailVerificationPage from "./pages/email-verification";
import HelpDetailsPage from "./pages/help-details";
import HelpCenterPage from "./pages/help-center";
import CareerPage from "./pages/careers";
import AdminCareersPage from "./pages/admin/careers";
import PrivacyPolicyPage from "@/pages/privacy";
import TermsAndConditionsPage from "@/pages/terms-and-conditions";
import RefundPolicyPage from "@/pages/refund-policy";
import ContactPrivacyPage from "@/pages/contact-privacy";
import AdminRefundsPage from "./pages/admin/refunds";
import AdminReportsPage from "./pages/admin/reports";
import FindDoctors from "./pages/patient/find-doctors";
import DoctorDetailsPage from "./pages/doctor-details";
import AdminAuditPage from "./pages/admin/AdminAudit";
import DoctorWaitingVerification from "@/pages/doctor/doctor_verifing_waiting_dashboard";

function ProtectedRoute({ 
  children, 
  allowedRoles 
}: { 
  children: React.ReactNode; 
  allowedRoles?: string[];
}) {
  const { user, isLoading, doctorProfile } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return <LoadingPage />;
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  // if (user.role === UserRole.DOCTOR && doctorProfile?.status === "pending") {
  //    return <Redirect to="/doctor/verification-pending" />;
  // }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Redirect to="/" />;
  }

  return <>{children}</>;
}

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  return null;
}

function Router() {
  return (
    <>
      <ScrollToTop />
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/about" component={AboutPage} />
      <Route path="/specializations" component={SpecializationsPage} />
      <Route path="/contact" component={ContactPage} />
      <Route path="/blog" component={BlogPage} />
      <Route path="/blog/new" component={BlogNewPage} />
      <Route path="/blog/:id" component={BlogDetailPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/auth/callback" component={AuthCallbackPage} />
      <Route path="/doctor/register" component={DoctorRegisterPage} />
      <Route path="/doctors" component={DoctorsPage} />
      <Route path="/doctors/:id" component={DoctorProfilePage} />
      <Route path="/email-verification" component={EmailVerificationPage} />
      <Route path="/help/:category" component={HelpDetailsPage} />
      <Route path="/help" component={HelpCenterPage} />
      <Route path="/careers" component={CareerPage} />
      <Route path="/privacy" component={PrivacyPolicyPage} />
      <Route path="/terms" component={TermsAndConditionsPage} />
      <Route path="/refund-policy" component={RefundPolicyPage} />
      <Route path="/contact-privacy" component={ContactPrivacyPage} />
      <Route path="/doctor-details/:id" component={DoctorDetailsPage} />
      <Route path="/doctor/verification-pending" component={DoctorWaitingVerification} />

      <Route path="/book/:doctorId">
        <ProtectedRoute allowedRoles={[UserRole.PATIENT]}>
          <BookAppointmentPage />
        </ProtectedRoute>
      </Route>
      
      <Route path="/patient">
        <ProtectedRoute allowedRoles={[UserRole.PATIENT]}>
          <DashboardLayout>
            <PatientDashboard />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/patient/:rest*">
        <ProtectedRoute allowedRoles={[UserRole.PATIENT]}>
          <DashboardLayout>
            <Switch>
              <Route path="/patient/appointments" component={PatientAppointmentsPage} />
              <Route path="/patient/find-doctors" component={FindDoctors} />
              <Route path="/patient/records" component={PatientDashboard} />
              <Route path="/patient/reviews" component={PatientReviewsPage} />
              <Route path="/patient/settings" component={PatientSettingsPage} />
              <Route path="/patient/verify-phone" component={VerifyPhonePage} />
              <Route component={NotFound} />
            </Switch>
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/doctor">
        <ProtectedRoute allowedRoles={[UserRole.DOCTOR]}>
          <DashboardLayout>
            <DoctorDashboard />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/doctor/:rest*">
        <ProtectedRoute allowedRoles={[UserRole.DOCTOR]}>
          <DashboardLayout>
            <Switch>
              <Route path="/doctor/appointments" component={DoctorAppointmentsPage} />
              <Route path="/doctor/schedule" component={DoctorSchedulePage} />
              <Route path="/doctor/earnings" component={DoctorEarningsPage} />
              <Route path="/doctor/reviews" component={DoctorReviewsPage} />
              <Route path="/doctor/profile" component={DoctorSettingsPage} />
              <Route path="/doctor/settings" component={DoctorSettingsPage} />
              <Route path="/doctor/verify-phone" component={DoctorVerifyPhonePage} />
              <Route component={NotFound} />
            </Switch>
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin">
        <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
          <DashboardLayout>
            <AdminDashboard />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/blog-view/:id">
        <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
          <AdminBlogViewPage />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/:rest*">
        <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
          <DashboardLayout>
            <Switch>
              <Route path="/admin/doctors" component={AdminDoctorsPage} />
              <Route path="/admin/patients" component={AdminPatientsPage} />
              <Route path="/admin/appointments" component={AdminAppointmentsPage} />
              <Route path="/admin/specializations" component={AdminSpecializationsPage} />
              <Route path="/admin/payments" component={AdminPaymentsPage} />
              <Route path="/admin/payouts" component={AdminPayoutsPage} />
              <Route path="/admin/refunds" component={AdminRefundsPage} />
              <Route path="/admin/careers" component={AdminCareersPage} />
              <Route path="/admin/blogs" component={AdminBlogsPage} />
              <Route path="/admin/reports" component={AdminReportsPage} />
              <Route path="/admin/audit" component={AdminAuditPage} />
              <Route path="/admin/settings" component={AdminSettingsPage} />
              <Route component={NotFound} />
            </Switch>
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      <Route component={NotFound} />
    </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Router />
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
