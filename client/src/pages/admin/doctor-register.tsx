import DoctorRegisterPage from "@/pages/doctor/register";

/**
 * Doctor onboarding lives in the admin dashboard: AyurPath staff enter the
 * practitioner's details on their behalf. There is no public doctor sign-up.
 */
export default function AdminDoctorRegisterPage() {
  return <DoctorRegisterPage adminMode />;
}
