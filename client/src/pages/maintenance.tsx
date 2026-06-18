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

function getRemaining(target: number) {
  const diff = Math.max(0, target - Date.now());
  const totalSec = Math.floor(diff / 1000);
  return {
    diff,
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    mins: Math.floor((totalSec % 3600) / 60),
    secs: totalSec % 60,
  };
}

// Deterministic drifting particles (Ayurvedic "spores")
const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  left: (i * 53) % 100,
  size: 3 + ((i * 7) % 9),
  delay: ((i * 0.83) % 7).toFixed(2),
  duration: 9 + ((i * 3) % 9),
  hue: i % 3, // 0 green, 1 amber, 2 pale
}));

export default function MaintenancePage() {
  const [, navigate] = useLocation();
  const [endTime, setEndTime] = useState<string | null>(null);
  const [, setNow] = useState(Date.now()); // tick to re-render countdown

  // ── Backend logic (unchanged): poll status + auto-redirect when lifted ──
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

  // Live countdown tick (purely visual)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const target = endTime ? new Date(endTime).getTime() : 0;
  const rem = endTime ? getRemaining(target) : null;
  const showCountdown = rem !== null && rem.diff > 0;

  const countdownUnits = rem
    ? [
        { label: "Days", value: rem.days },
        { label: "Hours", value: rem.hours },
        { label: "Mins", value: rem.mins },
        { label: "Secs", value: rem.secs },
      ]
    : [];

  return (
    <div className="mnt-root min-h-screen relative flex flex-col items-center justify-center overflow-hidden px-4 bg-background">
      <style>{MNT_STYLES}</style>

      {/* ── Animated aurora background ── */}
      <div className="mnt-aurora mnt-aurora-1" />
      <div className="mnt-aurora mnt-aurora-2" />
      <div className="mnt-aurora mnt-aurora-3" />
      <div className="mnt-grid" />

      {/* ── Drifting spores ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className={`mnt-spore mnt-spore-${p.hue}`}
            style={{
              left: `${p.left}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
          />
        ))}
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 flex flex-col items-center gap-7 max-w-lg text-center">

        {/* Logo */}
        <div className="mnt-fade-up flex items-center gap-2" style={{ animationDelay: "0.05s" }}>
          <img
            src="/logo.png"
            alt="AyurPath"
            className="h-9 w-9 object-contain"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
          <span className="text-2xl font-bold tracking-tight mnt-gradient-text">AyurPath</span>
        </div>

        {/* ── Living botanical medallion ── */}
        <div className="mnt-medallion mnt-fade-up" style={{ animationDelay: "0.15s" }}>
          {/* pulsing glow rings */}
          <span className="mnt-ring mnt-ring-1" />
          <span className="mnt-ring mnt-ring-2" />

          {/* rotating gear/orbit ticks */}
          <svg className="mnt-orbit" viewBox="0 0 200 200" aria-hidden="true">
            <circle
              cx="100" cy="100" r="92"
              fill="none"
              stroke="hsl(var(--secondary))"
              strokeWidth="1.5"
              strokeDasharray="2 12"
              strokeLinecap="round"
              opacity="0.55"
            />
          </svg>
          <svg className="mnt-orbit-rev" viewBox="0 0 200 200" aria-hidden="true">
            <circle
              cx="100" cy="100" r="78"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="1"
              strokeDasharray="1 18"
              strokeLinecap="round"
              opacity="0.4"
            />
          </svg>

          {/* orbiting herb dots */}
          <div className="mnt-orbit-dots">
            <span className="mnt-dot mnt-dot-a" />
            <span className="mnt-dot mnt-dot-b" />
            <span className="mnt-dot mnt-dot-c" />
          </div>

          {/* glass core with growing plant */}
          <div className="mnt-core">
            <svg viewBox="0 0 120 120" className="w-full h-full" aria-hidden="true">
              <defs>
                <linearGradient id="mntLeaf" x1="0" y1="1" x2="1" y2="0">
                  <stop offset="0%" stopColor="hsl(var(--primary))" />
                  <stop offset="100%" stopColor="hsl(152 70% 55%)" />
                </linearGradient>
                <radialGradient id="mntBerry" cx="0.35" cy="0.35" r="0.7">
                  <stop offset="0%" stopColor="hsl(36 90% 65%)" />
                  <stop offset="100%" stopColor="hsl(var(--secondary))" />
                </radialGradient>
              </defs>

              {/* sway group (infinite) */}
              <g className="mnt-sway" style={{ transformOrigin: "60px 112px" }}>
                {/* grow group (one-shot) */}
                <g className="mnt-grow" style={{ transformOrigin: "60px 112px" }}>
                  {/* stem */}
                  <path
                    d="M60 112 C 60 92 57 78 60 62 C 63 48 60 36 60 22"
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  {/* leaf pairs */}
                  <g>
                    <path d="M60 86 C 50 80 38 80 30 88 C 40 94 52 94 60 86 Z" fill="url(#mntLeaf)" />
                    <path d="M60 86 C 70 80 82 80 90 88 C 80 94 68 94 60 86 Z" fill="url(#mntLeaf)" />
                  </g>
                  <g>
                    <path d="M59 64 C 50 57 39 56 32 63 C 41 70 52 71 59 64 Z" fill="url(#mntLeaf)" />
                    <path d="M61 64 C 70 57 81 56 88 63 C 79 70 68 71 61 64 Z" fill="url(#mntLeaf)" />
                  </g>
                  <g>
                    <path d="M60 44 C 53 38 44 37 38 43 C 45 49 54 50 60 44 Z" fill="url(#mntLeaf)" />
                    <path d="M60 44 C 67 38 76 37 82 43 C 75 49 66 50 60 44 Z" fill="url(#mntLeaf)" />
                  </g>
                  {/* top bud + berries */}
                  <circle cx="60" cy="20" r="5" fill="url(#mntBerry)" />
                  <circle cx="52" cy="27" r="3" fill="url(#mntBerry)" />
                  <circle cx="68" cy="27" r="3" fill="url(#mntBerry)" />
                </g>
              </g>
            </svg>
          </div>
        </div>

        {/* Message */}
        <div className="mnt-fade-up space-y-3" style={{ animationDelay: "0.3s" }}>
          <h1 className="text-3xl sm:text-4xl font-bold mnt-gradient-text">
            We're restoring your wellness
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed max-w-md mx-auto">
            AyurPath is undergoing scheduled maintenance. Our team is fine-tuning
            the platform so your Ayurvedic care stays in balance. We'll be back
            shortly.
          </p>
        </div>

        {/* ── Live countdown ── */}
        {showCountdown && (
          <div className="mnt-fade-up flex items-center gap-2 sm:gap-3" style={{ animationDelay: "0.42s" }}>
            {countdownUnits.map((u) => (
              <div key={u.label} className="mnt-count-box">
                <span className="mnt-count-value">
                  {String(u.value).padStart(2, "0")}
                </span>
                <span className="mnt-count-label">{u.label}</span>
              </div>
            ))}
          </div>
        )}

        {endTime && (
          <p className="mnt-fade-up text-sm font-medium text-foreground/90" style={{ animationDelay: "0.5s" }}>
            Expected back by{" "}
            <span className="text-primary font-semibold">{formatEndTime(endTime)}</span>
          </p>
        )}

        {/* indeterminate progress */}
        <div className="mnt-fade-up mnt-progress" style={{ animationDelay: "0.58s" }}>
          <span className="mnt-progress-bar" />
        </div>

        {/* Footer note */}
        <p className="mnt-fade-up text-xs text-muted-foreground" style={{ animationDelay: "0.66s" }}>
          This page refreshes automatically. Thank you for your patience.
        </p>

        <a
          href="/login"
          className="mnt-fade-up text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          style={{ animationDelay: "0.74s" }}
        >
          Admin login
        </a>
      </div>
    </div>
  );
}

const MNT_STYLES = `
.mnt-root { isolation: isolate; }

/* ── Aurora background ── */
.mnt-aurora {
  position: absolute;
  border-radius: 50%;
  filter: blur(70px);
  opacity: 0.5;
  pointer-events: none;
  will-change: transform;
}
.mnt-aurora-1 {
  width: 55vw; height: 55vw; top: -12%; left: -8%;
  background: radial-gradient(circle, hsl(var(--primary) / 0.55), transparent 70%);
  animation: mnt-drift-1 18s ease-in-out infinite;
}
.mnt-aurora-2 {
  width: 50vw; height: 50vw; bottom: -15%; right: -10%;
  background: radial-gradient(circle, hsl(var(--secondary) / 0.4), transparent 70%);
  animation: mnt-drift-2 22s ease-in-out infinite;
}
.mnt-aurora-3 {
  width: 40vw; height: 40vw; top: 35%; left: 40%;
  background: radial-gradient(circle, hsl(172 60% 45% / 0.3), transparent 70%);
  animation: mnt-drift-1 26s ease-in-out infinite reverse;
}
@keyframes mnt-drift-1 {
  0%,100% { transform: translate(0,0) scale(1); }
  50% { transform: translate(6%, 8%) scale(1.12); }
}
@keyframes mnt-drift-2 {
  0%,100% { transform: translate(0,0) scale(1); }
  50% { transform: translate(-7%, -6%) scale(1.15); }
}

/* subtle grid */
.mnt-grid {
  position: absolute; inset: 0; pointer-events: none; opacity: 0.4;
  background-image:
    linear-gradient(hsl(var(--foreground) / 0.04) 1px, transparent 1px),
    linear-gradient(90deg, hsl(var(--foreground) / 0.04) 1px, transparent 1px);
  background-size: 46px 46px;
  mask-image: radial-gradient(circle at center, black, transparent 75%);
  -webkit-mask-image: radial-gradient(circle at center, black, transparent 75%);
}

/* ── Drifting spores ── */
.mnt-spore {
  position: absolute; bottom: -20px; border-radius: 50%;
  opacity: 0; filter: blur(0.5px);
  animation-name: mnt-float-up;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  will-change: transform, opacity;
}
.mnt-spore-0 { background: hsl(var(--primary) / 0.8); box-shadow: 0 0 8px hsl(var(--primary) / 0.6); }
.mnt-spore-1 { background: hsl(var(--secondary) / 0.85); box-shadow: 0 0 8px hsl(var(--secondary) / 0.6); }
.mnt-spore-2 { background: hsl(152 60% 75% / 0.7); box-shadow: 0 0 6px hsl(152 60% 75% / 0.5); }
@keyframes mnt-float-up {
  0% { transform: translateY(0) translateX(0) scale(0.6); opacity: 0; }
  10% { opacity: 0.9; }
  50% { transform: translateY(-55vh) translateX(20px) scale(1); }
  90% { opacity: 0.6; }
  100% { transform: translateY(-105vh) translateX(-15px) scale(0.7); opacity: 0; }
}

/* ── Medallion ── */
.mnt-medallion {
  position: relative;
  width: 220px; height: 220px;
  display: flex; align-items: center; justify-content: center;
}
.mnt-ring {
  position: absolute; border-radius: 50%; inset: 0;
  border: 1px solid hsl(var(--primary) / 0.4);
}
.mnt-ring-1 { animation: mnt-pulse-ring 3.4s ease-out infinite; }
.mnt-ring-2 { animation: mnt-pulse-ring 3.4s ease-out infinite 1.7s; }
@keyframes mnt-pulse-ring {
  0% { transform: scale(0.7); opacity: 0.7; }
  100% { transform: scale(1.25); opacity: 0; }
}
.mnt-orbit, .mnt-orbit-rev {
  position: absolute; inset: 0; width: 100%; height: 100%;
}
.mnt-orbit { animation: mnt-spin 28s linear infinite; }
.mnt-orbit-rev { animation: mnt-spin 36s linear infinite reverse; }
@keyframes mnt-spin { to { transform: rotate(360deg); } }

.mnt-orbit-dots {
  position: absolute; inset: 0; animation: mnt-spin 14s linear infinite;
}
.mnt-dot {
  position: absolute; width: 10px; height: 10px; border-radius: 50%;
  top: 50%; left: 50%; margin: -5px 0 0 -5px;
}
.mnt-dot-a { transform: rotate(0deg) translateX(104px); background: hsl(var(--secondary)); box-shadow: 0 0 10px hsl(var(--secondary) / 0.8); }
.mnt-dot-b { transform: rotate(120deg) translateX(104px); background: hsl(var(--primary)); box-shadow: 0 0 10px hsl(var(--primary) / 0.8); }
.mnt-dot-c { transform: rotate(240deg) translateX(104px); width: 7px; height: 7px; background: hsl(152 60% 75%); box-shadow: 0 0 8px hsl(152 60% 75% / 0.8); }

.mnt-core {
  position: relative; z-index: 2;
  width: 130px; height: 130px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  padding: 22px;
  background: radial-gradient(circle at 35% 30%, hsl(var(--card) / 0.9), hsl(var(--background) / 0.7));
  border: 1px solid hsl(var(--primary) / 0.25);
  box-shadow: 0 0 40px hsl(var(--primary) / 0.25), inset 0 0 25px hsl(var(--primary) / 0.12);
  backdrop-filter: blur(6px);
  animation: mnt-breathe 4.5s ease-in-out infinite;
}
@keyframes mnt-breathe {
  0%,100% { box-shadow: 0 0 35px hsl(var(--primary) / 0.2), inset 0 0 25px hsl(var(--primary) / 0.1); }
  50% { box-shadow: 0 0 55px hsl(var(--primary) / 0.4), inset 0 0 30px hsl(var(--primary) / 0.18); }
}

/* plant grow + sway */
.mnt-grow { animation: mnt-grow 1.8s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
@keyframes mnt-grow {
  0% { transform: scaleY(0.05) scaleX(0.6); opacity: 0; }
  60% { opacity: 1; }
  100% { transform: scaleY(1) scaleX(1); opacity: 1; }
}
.mnt-sway { animation: mnt-sway 5s ease-in-out infinite; animation-delay: 1.8s; }
@keyframes mnt-sway {
  0%,100% { transform: rotate(-2.5deg); }
  50% { transform: rotate(2.5deg); }
}

/* ── Countdown ── */
.mnt-count-box {
  display: flex; flex-direction: column; align-items: center;
  min-width: 64px; padding: 10px 6px;
  border-radius: var(--radius);
  background: hsl(var(--card) / 0.6);
  border: 1px solid hsl(var(--primary) / 0.2);
  box-shadow: 0 4px 20px hsl(0 0% 0% / 0.15);
  backdrop-filter: blur(8px);
}
.mnt-count-value {
  font-size: 1.6rem; font-weight: 700; line-height: 1;
  color: hsl(var(--foreground));
  font-variant-numeric: tabular-nums;
}
.mnt-count-label {
  margin-top: 4px; font-size: 0.62rem; letter-spacing: 0.12em;
  text-transform: uppercase; color: hsl(var(--muted-foreground));
}

/* ── Indeterminate progress ── */
.mnt-progress {
  position: relative; width: 200px; height: 4px; border-radius: 999px;
  overflow: hidden; background: hsl(var(--muted) / 0.5);
}
.mnt-progress-bar {
  position: absolute; top: 0; left: 0; height: 100%; width: 40%;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, hsl(var(--primary)), hsl(var(--secondary)), transparent);
  animation: mnt-shimmer 1.8s ease-in-out infinite;
}
@keyframes mnt-shimmer {
  0% { left: -45%; }
  100% { left: 105%; }
}

/* ── Gradient text ── */
.mnt-gradient-text {
  background: linear-gradient(90deg, hsl(var(--primary)), hsl(152 70% 55%), hsl(var(--secondary)));
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent; color: transparent;
  background-size: 200% auto;
  animation: mnt-text-shine 6s linear infinite;
}
@keyframes mnt-text-shine { to { background-position: 200% center; } }

/* ── Entrance ── */
.mnt-fade-up { opacity: 0; animation: mnt-fade-up 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
@keyframes mnt-fade-up {
  0% { opacity: 0; transform: translateY(18px); }
  100% { opacity: 1; transform: translateY(0); }
}

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  .mnt-aurora, .mnt-spore, .mnt-orbit, .mnt-orbit-rev, .mnt-orbit-dots,
  .mnt-ring, .mnt-core, .mnt-grow, .mnt-sway, .mnt-progress-bar,
  .mnt-gradient-text, .mnt-fade-up {
    animation: none !important;
  }
  .mnt-fade-up { opacity: 1; }
  .mnt-grow { transform: none; opacity: 1; }
}
`;
