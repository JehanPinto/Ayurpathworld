import { useEffect, useState } from "react";
import { useLocation } from "wouter";

interface MaintenanceStatus {
  isActive: boolean;
  endTime: string | null;
}

function formatEndTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-LK", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

export default function MaintenancePage() {
  const [, navigate] = useLocation();
  const [endTime, setEndTime] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    const check = async () => {
      try {
        const res = await fetch("/api/maintenance-status");
        const data: MaintenanceStatus = await res.json();
        setEndTime(data.endTime);
        if (!data.isActive) {
          navigate("/");
        }
      } catch {
        // network error, keep showing maintenance page
      }
    };

    check();
    timer = setInterval(check, 60_000);
    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="flex flex-col items-center gap-8 max-w-md text-center">

        {/* Logo */}
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="AyurPath" className="h-10 w-10 object-contain" onError={(e) => (e.currentTarget.style.display = "none")} />
          <span className="text-2xl font-bold text-primary">AyurPath</span>
        </div>

        {/* Icon */}
        <div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-6">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-amber-600">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>

        {/* Message */}
        <div className="space-y-3">
          <h1 className="text-3xl font-bold text-foreground">We're under maintenance</h1>
          <p className="text-muted-foreground text-base leading-relaxed">
            AyurPath is currently undergoing scheduled maintenance. We'll be back shortly.
          </p>
          {endTime && (
            <p className="text-sm font-medium text-foreground mt-2">
              Expected back by{" "}
              <span className="text-primary font-semibold">{formatEndTime(endTime)}</span>
            </p>
          )}
        </div>

        {/* Footer note */}
        <p className="text-xs text-muted-foreground">
          This page refreshes automatically. Thank you for your patience.
        </p>

        <a href="/login" className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors mt-4">
          Admin login
        </a>
      </div>
    </div>
  );
}
