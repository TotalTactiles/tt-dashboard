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
      .filter((e) => e.type === "Deadline" || e.type === "Distribution" || e.type === "Valuation" || e.type === "Milestone")
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
      className="stat-card"
    >
      <h3 className="text-sm font-semibold text-foreground mb-4">Fund Deadlines & Obligations</h3>
      <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
        {deadlines.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">No upcoming deadlines</p>
        ) : (
          deadlines.map((d) => {
            const cfg = statusConfig[d.deadlineStatus];
            const Icon = cfg.icon;
            const isOverdue = d.deadlineStatus === "overdue";
            return (
              <div
                key={d.id}
                className="flex items-center gap-3 p-3 rounded-[10px] bg-muted/50 hover:bg-secondary/60 transition-all duration-150"
                style={isOverdue ? { borderLeft: "3px solid hsl(var(--destructive))" } : {}}
              >
                <Icon className={`h-4 w-4 shrink-0 ${cfg.class}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{d.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {d.source.includes("Google") ? "Google" : "Zoho"}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1.5 py-0 rounded-full border-0"
                      style={{ backgroundColor: TYPE_COLORS[d.type] + "22", color: TYPE_COLORS[d.type] }}
                    >
                      {d.type}
                    </Badge>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-mono text-muted-foreground">
                    {d.eventDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                  <p className={`text-[10px] font-mono ${d.daysRemaining < 0 ? "text-destructive" : d.daysRemaining <= 7 ? "text-chart-amber" : "text-muted-foreground"}`}>
                    {d.daysRemaining < 0
                      ? `${Math.abs(d.daysRemaining)}d overdue`
                      : d.daysRemaining === 0
                      ? "Today"
                      : `${d.daysRemaining}d left`}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
};

export default DeadlineTracker;
