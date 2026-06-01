import { useParams } from "wouter";
import { Link } from "wouter";
import {
  LogIn,
  MousePointerSquareDashed,
  UserCheck,
  CalendarSearch,
  RefreshCw,
  LogOut,
  SlidersHorizontal,
  UserCog,
  KeyRound,
  Activity,
  Search,
  ClipboardList,
  HeartPulse,
  CreditCard,
  Receipt,
  CheckCircle,
  Download,
  AlertCircle,
  Ticket,
  Zap,
  Lock,
  Bell,
  Settings,
  ArrowLeft,
} from "lucide-react";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicLayout } from "@/components/layout/public-layout";
import { HelpStepCard } from "@/components/ui/help-step-card";

interface Step {
  id: number;
  title: string;
  desc: string;
  icon: LucideIcon;
}

interface CategoryData {
  title: string;
  description: string;
  subText?: string;
  stepLabel: string;
  steps: Step[];
}

const CATEGORIES: Record<string, CategoryData> = {
  appointments: {
    title: "How do I book an Ayurvedic Consultation?",
    description:
      "Follow the steps below to book an Ayurvedic Consultation. During your initial evaluation, our specialists will complete a comprehensive assessment and associate a personalized treatment plan for you. We will manage your wellness journey, ensuring each step of the process is tailored to your specific health needs.",
    subText:
      "You can use our online platform to manage your account and store your medical information securely. Providing detailed information regarding your health concerns helps our doctors offer a more accurate diagnosis and a better experience for your mind and body.",
    stepLabel: "To book your appointment, follow the steps outlined below:",
    steps: [
      {
        id: 1,
        title: "Log into your account",
        desc: "Log into your account using your registered credentials.",
        icon: LogIn,
      },
      {
        id: 2,
        title: 'Select "Consultations"',
        desc: "Navigate to the Consultations section from your patient dashboard.",
        icon: MousePointerSquareDashed,
      },
      {
        id: 3,
        title: "Choose your preferred doctor",
        desc: "Browse available Ayurvedic practitioners and select the one that suits your needs.",
        icon: UserCheck,
      },
      {
        id: 4,
        title: "Review availability",
        desc: "Check the doctor's schedule and confirm your preferred appointment slot.",
        icon: CalendarSearch,
      },
    ],
  },

  "account-security": {
    title: "Keeping your account safe and updated",
    description:
      "Manage passwords, security settings, and data protection preferences.",
    stepLabel: "Account & Security, follow the steps outlined below:",
    steps: [
      {
        id: 1,
        title: "Update Password",
        desc: "Change your login credentials regularly through your profile settings to maintain account safety.",
        icon: RefreshCw,
      },
      {
        id: 2,
        title: "Safe Log Out",
        desc: "Always remember to log out of your account when using public or shared devices to protect your personal details.",
        icon: LogOut,
      },
      {
        id: 3,
        title: "Privacy Control",
        desc: "Control your medical history visibility and manage data-sharing permissions safely.",
        icon: SlidersHorizontal,
      },
    ],
  },

  "api-integrations": {
    title: "Connecting external health tools and tools",
    description:
      "Integrate external calendars, health trackers, and hospital management configurations.",
    stepLabel: "API & Integrations, follow the steps outlined below:",
    steps: [
      {
        id: 1,
        title: "Generate API Key",
        desc: "Access your secure developer portal to create authentication tokens.",
        icon: KeyRound,
      },
      {
        id: 2,
        title: "Sync Calendars",
        desc: "Connect Google Calendar or Outlook to sync your booking slots instantly.",
        icon: RefreshCw,
      },
      {
        id: 3,
        title: "Monitor Usage",
        desc: "Track real-time data flow logs and active application endpoints safely.",
        icon: Activity,
      },
    ],
  },

  treatments: {
    title: "Guide to Ayurvedic Treatments and Services",
    description:
      "Explore customized wellness programs and therapy categories available on AyurPath. Our practitioners specialise in a wide range of traditional Ayurvedic treatments tailored to your individual health needs.",
    stepLabel: "Treatments and services, follow the steps outlined below:",
    steps: [
      {
        id: 1,
        title: "Search by Specialization",
        desc: "Search and filter doctors based on traditional Ayurvedic fields like Panchakarma (detoxification), Rasayana (rejuvenation), or Kayachikitsa (general medicine).",
        icon: Search,
      },
      {
        id: 2,
        title: "Check Requirements",
        desc: "Learn if your selected treatment or therapy requires a prior physical consultation or a specific diagnostic report before booking.",
        icon: ClipboardList,
      },
      {
        id: 3,
        title: "Follow-up Plans",
        desc: "Understand how digital prescriptions, herbal medicine routines, and personalized lifestyle guides are shared post-consultation.",
        icon: HeartPulse,
      },
    ],
  },

  payments: {
    title: "Payments & Billing on AyurPath",
    description:
      "AyurPath uses PayHere, a secure and certified payment gateway, to process all transactions. We support multiple payment methods to make booking your consultation as convenient as possible.",
    stepLabel: "To complete your payment, follow the steps outlined below:",
    steps: [
      {
        id: 1,
        title: "Select payment method",
        desc: "Choose from credit/debit cards or internet banking at checkout.",
        icon: CreditCard,
      },
      {
        id: 2,
        title: "Enter billing details",
        desc: "Provide your billing address and card details securely. AyurPath never stores your card information on our servers.",
        icon: Receipt,
      },
      {
        id: 3,
        title: "Confirm your payment",
        desc: "Review the appointment summary and total amount, then confirm your payment to finalise the booking.",
        icon: CheckCircle,
      },
      {
        id: 4,
        title: "Download your receipt",
        desc: "Once payment is confirmed, a receipt is sent to your email and can also be downloaded from your patient dashboard.",
        icon: Download,
      },
    ],
  },

  "technical-support": {
    title: "Troubleshooting platform issues",
    description:
      "Face a bug or glitch? Let our technical team fix it for you right away.",
    stepLabel: "Technical Support, follow the steps outlined below:",
    steps: [
      {
        id: 1,
        title: "Report a Bug",
        desc: "Take a screenshot and briefly explain the issue using the support form.",
        icon: AlertCircle,
      },
      {
        id: 2,
        title: "Ticket Creation",
        desc: "Receive a tracking reference number sent directly to your screen and mail.",
        icon: Ticket,
      },
      {
        id: 3,
        title: "Fast Resolution",
        desc: "Receive a tracking reference number sent directly to your screen and mail.",
        icon: Zap,
      },
    ],
  },

  "your-account": {
    title: "Managing Your AyurPath Account",
    description:
      "Your AyurPath account gives you full control over your personal information, appointment history, and notification preferences. Keep your profile up to date to receive the most accurate care recommendations.",
    stepLabel: "To manage your account, follow the steps outlined below:",
    steps: [
      {
        id: 1,
        title: "Update personal info",
        desc: "Go to your profile settings to update your name, phone number, address, and profile photo at any time.",
        icon: UserCog,
      },
      {
        id: 2,
        title: "Change your password",
        desc: "Navigate to Security Settings to update your password. Use a strong, unique password for maximum protection.",
        icon: Lock,
      },
      {
        id: 3,
        title: "Manage notifications",
        desc: "Customise your email and SMS notification preferences for appointment reminders, confirmations, and platform updates.",
        icon: Bell,
      },
      {
        id: 4,
        title: "Account settings",
        desc: "Review your data sharing preferences, connected devices, and account activity from the Settings panel.",
        icon: Settings,
      },
    ],
  },
};

export default function HelpDetailsPage() {
  const params = useParams<{ category: string }>();
  const category = params.category ?? "appointments";
  const data = CATEGORIES[category] ?? CATEGORIES["appointments"];

  return (
    <PublicLayout showFooter={false}>
      <div className="min-h-screen bg-background flex flex-col pb-20">

        {/* Back link */}
        <div className="container mx-auto max-w-6xl px-4 pt-6">
          <Link href="/help">
            <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to Help Center
            </button>
          </Link>
        </div>

        {/* TOP SECTION */}
        <section className="flex-grow container mx-auto max-w-6xl mt-8 px-4">

          <div className="max-w-5xl mb-12">
            <h1 className="text-center text-[32px] md:text-[40px] lg:text-[56px] font-bold text-foreground mb-6 tracking-tight">
              {data.title}
            </h1>
            <p className="text-[16px] md:text-[18px] lg:text-[20px] text-foreground leading-relaxed mb-6">
              {data.description}
            </p>
            {data.subText && (
              <p className="text-[16px] md:text-[18px] lg:text-[20px] text-foreground leading-relaxed mb-10">
                {data.subText}
              </p>
            )}
            <h2 className="text-[16px] md:text-[18px] lg:text-[20px] font-semibold text-foreground">
              {data.stepLabel}
            </h2>
          </div>

          {/* Steps Grid */}
          <div className="relative mt-8">
            <div className="hidden lg:block absolute top-[16px] left-[10%] right-[10%] h-[2px] bg-foreground z-0" />
            <div
              className={`grid grid-cols-1 md:grid-cols-2 ${
                data.steps.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"
              } gap-6`}
            >
              {data.steps.map((step) => (
                <HelpStepCard
                  key={step.id}
                  id={step.id}
                  title={step.title}
                  desc={step.desc}
                  Icon={step.icon}
                />
              ))}
            </div>
          </div>
        </section>


      </div>
    </PublicLayout>
  );
}
