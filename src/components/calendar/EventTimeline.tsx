import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { type LiveCalendarEvent } from "@/contexts/DashboardDataContext";

interface EventTimelineProps {
  events: LiveCalendarEvent[];
  onEventClick: (event: LiveCalendarEvent) => void;
}

const TYPE_COLORS: Record<string, string> = {
  Meeting: "#378ADD",
  Deadline: "#E24B4A",
  Milestone: "#7F77DD",
  Care: "#639922",
  Valuation: "#BA7517",
  Distribution: "#1D9E75",
};

const getTypeColor = (type: string) => TYPE_COLORS[type] || "#378ADD";

const EventTimeline = ({ events, onEventClick }: EventTimelineProps) => {
  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" }) +
      " · " +
      d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="stat-card"
    >
      <h3 className="text-sm font-semibold text-foreground mb-4">Upcoming Events</h3>
      <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">No upcoming events</p>
        ) : (
          events.slice(0, 20).map((ev) => (
            <div
              key={ev.id}
              onClick={() => onEventClick(ev)}
              className="flex items-start gap-3 p-2.5 rounded-[10px] hover:bg-secondary/40 transition-all duration-150 hover:shadow-md cursor-pointer"
              style={{ borderLeft: `3px solid ${getTypeColor(ev.type)}` }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{ev.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-mono text-muted-foreground">{formatDateTime(ev.start)}</span>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 rounded-full">{ev.type}</Badge>
                </div>
              </div>
              <span
                className="text-[9px] font-mono px-2 py-0.5 rounded-full shrink-0 mt-0.5"
                style={{
                  background: ev.source.includes("Google") ? "hsl(200, 80%, 50% / 0.15)" : "hsl(270, 60%, 55% / 0.15)",
                  color: ev.source.includes("Google") ? "hsl(200, 80%, 50%)" : "hsl(270, 60%, 55%)",
                }}
              >
                {ev.source.includes("Google") ? "Google" : "Zoho"}
              </span>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
};

export default EventTimeline;
