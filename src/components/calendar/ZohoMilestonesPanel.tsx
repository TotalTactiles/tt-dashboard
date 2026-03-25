import { useMemo } from "react";
import { AlertTriangle, Circle } from "lucide-react";
import { type LiveCalendarEvent } from "@/contexts/DashboardDataContext";

interface ZohoMilestonesPanelProps {
  events: LiveCalendarEvent[];
  onEventClick: (event: LiveCalendarEvent) => void;
}

export default function ZohoMilestonesPanel({ events, onEventClick }: ZohoMilestonesPanelProps) {
  const milestones = useMemo(() => {
    const now = new Date();
    return events
      .filter((e) =>
        e.source === "Zoho Projects" ||
        e.source === "Zoho Calendar" ||
        e.source?.toLowerCase().includes("zoho") ||
        e.type === "Milestone" ||
        e.type === "Task"
      )
      .map((e) => {
        const d = new Date(e.start);
        const days = Math.ceil((d.getTime() - now.getTime()) / 86400000);
        return { ...e, daysRemaining: days };
      })
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [events]);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" });

  return (
    <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
      {milestones.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">No Zoho milestones in current filter — check Zoho Projects is toggled on above</p>
      ) : (
        milestones.map((m) => {
          const overdue = m.daysRemaining < 0;
          const soon = !overdue && m.daysRemaining <= 7;
          return (
            <div
              key={m.id}
              onClick={() => onEventClick(m)}
              className="flex items-center gap-3 p-2.5 rounded-[10px] bg-muted/50 hover:bg-secondary/60 transition-all cursor-pointer"
              style={overdue ? { borderLeft: "3px solid #E24B4A" } : soon ? { borderLeft: "3px solid #BA7517" } : {}}
            >
              {overdue
                ? <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                : <Circle className="w-4 h-4 text-muted-foreground shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{m.title}</p>
                <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                  {fmt(m.start)} · {overdue ? `${Math.abs(m.daysRemaining)}d overdue` : m.daysRemaining === 0 ? "Today" : `${m.daysRemaining}d left`}
                </p>
              </div>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                {m.type}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}
