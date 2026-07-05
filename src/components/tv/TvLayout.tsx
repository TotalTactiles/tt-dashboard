import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Activity,
  HeartPulse,
  CalendarDays,
  Users,
  Target,
  BrainCircuit,
  Tv,
} from "lucide-react";

const TV_TABS = [
  { title: "Dashboard", path: "/tv", icon: LayoutDashboard, match: (p: string) => p === "/tv" || p === "/tv/" },
  { title: "Deal Flow", path: "/tv/deals", icon: Activity, match: (p: string) => p.startsWith("/tv/deals") },
  { title: "Financials", path: "/tv/financial-health", icon: HeartPulse, match: (p: string) => p.startsWith("/tv/financial-health") },
  { title: "Calendar", path: "/tv/calendar", icon: CalendarDays, match: (p: string) => p.startsWith("/tv/calendar") },
  { title: "Employees", path: "/tv/employees", icon: Users, match: (p: string) => p.startsWith("/tv/employees") },
  { title: "Goals", path: "/tv/goals", icon: Target, match: (p: string) => p.startsWith("/tv/goals") },
  { title: "Consulting", path: "/tv/consulting", icon: BrainCircuit, match: (p: string) => p.startsWith("/tv/consulting") },
];

const PROXIMITY_PX = 140;
const HIDE_DELAY_MS = 2500;

const TvBottomNav = () => {
  const [visible, setVisible] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const hideTimer = useRef<number | null>(null);

  useEffect(() => {
    const clearHide = () => {
      if (hideTimer.current !== null) {
        window.clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
    };
    const scheduleHide = () => {
      clearHide();
      hideTimer.current = window.setTimeout(() => setVisible(false), HIDE_DELAY_MS);
    };
    const onMove = (e: PointerEvent | MouseEvent) => {
      const y = (e as MouseEvent).clientY;
      const nearBottom = window.innerHeight - y <= PROXIMITY_PX;
      if (nearBottom) {
        clearHide();
        setVisible(true);
      } else if (visible) {
        scheduleHide();
      }
    };
    const onLeave = () => scheduleHide();

    window.addEventListener("pointermove", onMove as any);
    window.addEventListener("mousemove", onMove as any);
    document.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove as any);
      window.removeEventListener("mousemove", onMove as any);
      document.removeEventListener("mouseleave", onLeave);
      clearHide();
    };
  }, [visible]);

  return (
    <>
      {/* Bottom proximity trigger zone — invisible; keeps nav pinned when cursor is on the bar itself */}
      <div
        className="fixed left-0 right-0 bottom-0 z-40"
        style={{ height: `${PROXIMITY_PX}px`, pointerEvents: "none" }}
        aria-hidden
      />
      <nav
        onMouseEnter={() => setVisible(true)}
        className={`fixed left-0 right-0 bottom-0 z-50 transition-transform duration-300 ease-out ${
          visible ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ paddingBottom: "3vh", paddingLeft: "4vw", paddingRight: "4vw" }}
        aria-label="TV navigation"
      >
        <div className="mx-auto max-w-[1600px] bg-card/95 backdrop-blur border border-border rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-2">
          {TV_TABS.map((t) => {
            const active = t.match(location.pathname);
            const Icon = t.icon;
            return (
              <button
                key={t.path}
                type="button"
                onClick={() => navigate(t.path)}
                className={`flex-1 min-h-[64px] px-4 py-3 rounded-xl flex flex-col items-center justify-center gap-1 transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/60 text-foreground hover:bg-secondary"
                }`}
                style={{ fontSize: "1.05rem" }}
              >
                <Icon className="w-6 h-6" />
                <span className="font-medium tracking-wide">{t.title}</span>
              </button>
            );
          })}
          <div className="hidden xl:flex items-center gap-2 px-3 text-muted-foreground">
            <Tv className="w-5 h-5" />
            <span className="text-sm font-mono uppercase tracking-widest">TV Mode</span>
          </div>
        </div>
      </nav>
    </>
  );
};

interface TvLayoutProps {
  children: React.ReactNode;
}

const TvLayout = ({ children }: TvLayoutProps) => {
  useEffect(() => {
    document.documentElement.classList.add("tv-mode");
    document.body.classList.add("tv-mode");
    return () => {
      document.documentElement.classList.remove("tv-mode");
      document.body.classList.remove("tv-mode");
    };
  }, []);

  return (
    <div className="tv-mode min-h-screen w-full bg-background text-foreground overflow-hidden">
      <div
        className="min-h-screen w-full overflow-auto"
        style={{
          paddingLeft: "4vw",
          paddingRight: "4vw",
          paddingTop: "3vh",
          paddingBottom: "calc(3vh + 96px)",
        }}
      >
        {children}
      </div>
      <TvBottomNav />
    </div>
  );
};

export default TvLayout;
