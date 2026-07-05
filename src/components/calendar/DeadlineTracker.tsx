import { useMemo } from "react";
import { motion } from "framer-motion";
import { CheckCircle, Circle, AlertTriangle } from "lucide-react";
import { type LiveCalendarEvent } from "@/contexts/DashboardDataContext";

interface DeadlineTrackerProps {
  events: LiveCalendarEvent[];
}

const PHASE_COLORS: Record<string, string> = {
  "Pre Seal": "#378ADD",
  "Close the Seal": "#1D9E75",
  "Post Seal": "#E24B4A",
  "Legacy": "#BA7517",
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
        const status: "overdue" | "upcoming" | "completed" =
          daysRemaining < 0 ? "overdue" : "upcoming";
        return { ...e, daysRemaining, deadlineStatus: status, eventDate };
      })
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [events]);

  const statusConfig = {
    overdue: { icon: AlertTriangle },
    upcoming: { icon: Circle },
    completed: { icon: CheckCircle },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="flex-1 min-h-0 min-w-0 space-y-1 overflow-y-auto pr-1"
      style={{
        maxHeight: 320,
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(255,255,255,0.15) transparent",
      }}
    >
      {deadlines.length === 0 ? (
        <div className="flex items-center justify-center h-full min-h-[120px] px-4 py-8">
          <p className="text-[11.5px] text-muted-foreground/70 text-center leading-relaxed">
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
          const phaseColor = PHASE_COLORS[phase] ?? "#888780";
          const railColor = isOverdue ? "#E24B4A" : phaseColor;
          return (
            <div
              key={d.id}
              className="relative flex items-center gap-2.5 py-2 pl-3 pr-2.5 rounded-xl cursor-pointer transition-colors hover:bg-white/[0.04] min-w-0"
            >
              <span
                className="absolute left-0 top-2 bottom-2 w-[2.5px] rounded-full"
                style={{ background: railColor }}
              />
              <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p
                  className="text-[12.5px] font-medium text-foreground/85 truncate"
                  title={d.title.replace(/^\[[^\]]+\]\s*/, "")}
                >
                  {d.title.replace(/^\[[^\]]+\]\s*/, "")}
                </p>
                <div className="font-mono text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2 min-w-0">
                  <span className="truncate">
                    {d.eventDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                  <span
                    className={`truncate ${
                      d.daysRemaining < 0
                        ? "text-destructive"
                        : d.daysRemaining <= 7
                        ? "text-chart-amber"
                        : "text-muted-foreground"
                    }`}
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
                className="font-mono text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap"
                style={{ background: phaseColor + "29", color: phaseColor }}
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
