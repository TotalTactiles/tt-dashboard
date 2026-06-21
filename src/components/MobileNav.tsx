import {
  LayoutDashboard,
  Activity,
  TrendingUp,
  Receipt,
  Package,
  CalendarDays,
  Users,
  Target,
  BrainCircuit,
  MoreHorizontal,
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const allNavItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Deal Flow", url: "/deals", icon: Activity },
  { title: "Revenue & COGS", url: "/revenue", icon: TrendingUp },
  { title: "Expenses", url: "/expenses", icon: Receipt },
  { title: "Stock", url: "/stock", icon: Package },
  { title: "Calendar", url: "/calendar", icon: CalendarDays },
  { title: "Employee Centre", url: "/employees", icon: Users },
  { title: "Goals & Targets", url: "/goals", icon: Target },
  { title: "Consulting", url: "/consulting", icon: BrainCircuit },
];

const primaryUrls = ["/", "/deals", "/calendar", "/goals"];
const primaryItems = primaryUrls
  .map((u) => allNavItems.find((i) => i.url === u)!)
  .filter(Boolean);
const moreItems = allNavItems.filter((i) => !primaryUrls.includes(i.url));

export function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const [isLandscapeRail, setIsLandscapeRail] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(orientation: landscape) and (max-height: 500px)");
    const update = () => setIsLandscapeRail(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const isActive = (url: string) =>
    url === "/" ? location.pathname === "/" : location.pathname.startsWith(url);

  if (isLandscapeRail) {
    return (
      <nav className="landscape-rail-show fixed top-0 left-0 bottom-0 z-50 w-14 border-r border-border bg-card/95 backdrop-blur-md flex-col items-center py-2 gap-1 hidden md:!hidden"
           style={{ display: "flex" }}>
        {allNavItems.map((item) => {
          const active = isActive(item.url);
          return (
            <button
              key={item.url}
              onClick={() => navigate(item.url)}
              aria-label={item.title}
              className={cn(
                "w-11 h-11 flex items-center justify-center rounded-lg transition-colors",
                active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"
              )}
            >
              <item.icon className="h-5 w-5" />
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <>
      <nav className="landscape-hide fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-border bg-card/95 backdrop-blur-md safe-area-bottom">
        <div className="flex items-center justify-around px-1 py-1">
          {primaryItems.map((item) => {
            const active = isActive(item.url);
            return (
              <NavLink
                key={item.url}
                to={item.url}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-0.5 py-2 px-2 rounded-lg transition-colors min-w-[3rem] min-h-[2.75rem]",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className={cn("h-5 w-5", active && "text-primary")} />
                <span className={cn(
                  "text-[10px] font-mono leading-tight",
                  active ? "font-semibold text-primary" : "text-muted-foreground"
                )}>
                  {item.title}
                </span>
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
                )}
              </NavLink>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 py-2 px-2 rounded-lg transition-colors min-w-[3rem] min-h-[2.75rem]",
              "text-muted-foreground"
            )}
            aria-label="More navigation"
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-[10px] font-mono leading-tight">More</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="h-[60vh] p-0">
          <SheetHeader className="px-4 py-3 border-b border-border">
            <SheetTitle className="text-left">More</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col p-2 gap-1 overflow-y-auto">
            {moreItems.map((item) => {
              const active = isActive(item.url);
              return (
                <button
                  key={item.url}
                  onClick={() => {
                    setMoreOpen(false);
                    navigate(item.url);
                  }}
                  className={cn(
                    "w-full min-h-[52px] flex items-center gap-3 px-4 rounded-lg text-left transition-colors",
                    active
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-foreground hover:bg-muted/50"
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span className="text-sm">{item.title}</span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
