import { useMemo } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Circle, AlertTriangle } from "lucide-react";
import { type LiveCalendarEvent } from "@/contexts/DashboardDataContext";

interface DeadlineTrackerProps {
  events: LiveCalendarEvent[];
}

const TYPE_COLORS: Record<string, string> = {
  Meeting: "#378ADD",
  Deadline: "#E24B4A",
  Milestone: "#7F77DD",
  Care: "#639922",
  Valuation: "#BA7517",
  Distribution: "#1D9E75",
};

const DeadlineTracker = ({ events }: DeadlineTrackerProps) => {
  const deadlines = useMemo(() => {
    const now = new Date();
    return events
      .filter((e) => e.source === "Strategic Board" || e.id?.startsWith("sqb-"))
      .map((e) => {
        const eventDate = new Date(e.start);
        const diffMs = eventDate.getTime() - now.getTime();
        const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        const status: "overdue" | "upcoming" | "completed" = daysRemaining < 0 ? "overdue" : "upcoming";
        return { ...e, daysRemaining, deadlineStatus: status, eventDate };
      })
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [events]);

  const statusConfig = {
    overdue: { icon: AlertTriangle, class: "text-destructive" },
    upcoming: { icon: Circle, class: "text-muted-foreground" },
    completed: { icon: CheckCircle, class: "text-primary" },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="flex-1 min-h-0 min-w-0 space-y-2 overflow-y-auto pr-1"
      style={{ maxHeight: 320, scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.15) transparent" }}
    >
      {deadlines.length === 0 ? (
        <div className="flex items-center justify-center h-full min-h-[120px] px-4">
          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            No upcoming deadlines — set due dates on tasks in the Strategic Quarters board below
          </p>
        </div>
      ) : (
        deadlines.map((d) => {
          const cfg = statusConfig[d.deadlineStatus];
          const Icon = cfg.icon;
          const isOverdue = d.deadlineStatus === "overdue";
          const phaseMatch = d.title.match(/^\[([^\]]+)\]/);
          const phase = phaseMatch?.[1] ?? "Strategic";
          const PHASE_COLORS: Record<string, string> = {
            "Pre Seal": "#378ADD",
            "Close the Seal": "#1D9E75",
            "Post Seal": "#E24B4A",
            "Legacy": "#BA7517",
          };
          const color = PHASE_COLORS[phase] ?? "#888780";
          return (
            <div
              key={d.id}
              className="flex items-center gap-3 p-2.5 rounded-[10px] bg-muted/40 hover:bg-secondary/60 transition-all duration-150 min-w-0"
              style={isOverdue ? { borderLeft: "3px solid hsl(var(--destructive))" } : {}}
            >
              <Icon className={`h-4 w-4 shrink-0 ${cfg.class}`} />
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium text-foreground truncate"
                  title={d.title.replace(/^\[[^\]]+\]\s*/, '')}
                >
                  {d.title.replace(/^\[[^\]]+\]\s*/, '')}
                </p>
                <div className="flex items-center gap-2 mt-1 min-w-0">
                  <span className="text-[11px] font-mono text-muted-foreground truncate">
                    {d.eventDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                  <span
                    className={`text-[11px] font-mono truncate ${d.daysRemaining < 0 ? "text-destructive" : d.daysRemaining <= 7 ? "text-chart-amber" : "text-muted-foreground"}`}
                  >
                    {d.daysRemaining < 0
                      ? `${Math.abs(d.daysRemaining)}d overdue`
                      : d.daysRemaining === 0
                      ? "Today"
                      : `${d.daysRemaining}d left`}
                  </span>
                </div>
              </div>
              <span
                className="text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap"
                style={{ background: color + "22", color }}
              >
                {phase}
              </span>
            </div>
          );
        })
      )}
    </motion.div>
  );
};

export default DeadlineTracker;
