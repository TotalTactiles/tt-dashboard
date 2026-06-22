import { LayoutDashboard, Activity, HeartPulse, CalendarDays, Users, Target, BrainCircuit, FunctionSquare, Settings } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Deal Flow", url: "/deals", icon: Activity },
  { title: "Fin. Health", url: "/financial-health", icon: HeartPulse },
  { title: "Calendar", url: "/calendar", icon: CalendarDays },
  { title: "Employees", url: "/employees", icon: Users },
  { title: "Goals", url: "/goals", icon: Target },
  { title: "Consulting", url: "/consulting", icon: BrainCircuit },
  { title: "Formulas", url: "/formulas", icon: FunctionSquare },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function MobileNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-border bg-card/95 backdrop-blur-md safe-area-bottom">
      <div
        className="flex items-center overflow-x-auto scrollbar-none px-1 py-1"
        style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {navItems.map((item) => {
          const isActive = item.url === "/" ? location.pathname === "/" : location.pathname.startsWith(item.url);
          return (
            <NavLink
              key={item.url}
              to={item.url}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 py-2 px-3 rounded-lg transition-colors shrink-0 min-w-[4rem] min-h-[2.75rem]",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
              )}
              <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
              <span className={cn(
                "text-[9px] font-mono leading-tight whitespace-nowrap",
                isActive ? "font-semibold text-primary" : "text-muted-foreground"
              )}>
                {item.title}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
