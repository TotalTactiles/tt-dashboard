import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { type LiveCalendarEvent } from "@/contexts/DashboardDataContext";
import { getEventTheme } from "./eventColors";

interface EventTimelineProps {
  events: LiveCalendarEvent[];
  onEventClick: (event: LiveCalendarEvent) => void;
}

const getSourceLabel = (source: string) => {
  const s = source.toLowerCase();
  if (s.includes("google")) return "Google";
  if (s.includes("zoho")) return "Zoho";
  if (s.includes("strategic")) return "Strategic";
  return source;
};

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
      className="flex-1 min-h-0 min-w-0 space-y-2 overflow-y-auto pr-1"
      style={{ maxHeight: 320, scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.15) transparent" }}
    >
      {events.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">No upcoming events</p>
      ) : (
        events.slice(0, 20).map((ev) => {
          const theme = getEventTheme(ev);
          return (
            <div
              key={ev.id}
              onClick={() => onEventClick(ev)}
              className="flex items-center gap-3 p-2.5 rounded-[10px] bg-muted/40 hover:bg-secondary/60 transition-all duration-150 cursor-pointer min-w-0"
              style={{ borderLeft: `3px solid ${theme.border}` }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate" title={ev.title}>
                  {ev.title}
                </p>
                <div className="flex items-center gap-2 mt-1 min-w-0">
                  <span className="text-[11px] font-mono text-muted-foreground truncate">
                    {formatDateTime(ev.start)}
                  </span>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 rounded-full shrink-0">
                    {ev.type}
                  </Badge>
                </div>
              </div>
              <span
                className="text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap"
                style={{
                  background: theme.accent + "22",
                  color: theme.accent,
                }}
              >
                {getSourceLabel(ev.source)}
              </span>
            </div>
          );
        })
      )}
    </motion.div>
  );
};

export default EventTimeline;
