import { motion } from "framer-motion";
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
    return (
      d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" }) +
      " · " +
      d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="flex-1 min-h-0 min-w-0 space-y-1 max-h-[320px] overflow-y-auto pr-1"
      style={{
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(255,255,255,0.15) transparent",
      }}
    >
      {events.length === 0 ? (
        <p className="text-[11.5px] text-muted-foreground/70 py-8 px-4 text-center leading-relaxed">
          No upcoming events
        </p>
      ) : (
        events.slice(0, 20).map((ev) => {
          const theme = getEventTheme(ev);
          return (
            <div
              key={ev.id}
              onClick={() => onEventClick(ev)}
              className="relative flex items-center gap-2.5 py-2 pl-3 pr-2.5 rounded-xl cursor-pointer transition-colors hover:bg-white/[0.04] min-w-0"
            >
              <span
                className="absolute left-0 top-2 bottom-2 w-[2.5px] rounded-full"
                style={{ background: theme.border }}
              />
              <div className="flex-1 min-w-0">
                <p
                  className="text-[12.5px] font-medium text-foreground/85 truncate"
                  title={ev.title}
                >
                  {ev.title}
                </p>
                <div className="font-mono text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2 min-w-0">
                  <span className="truncate">{formatDateTime(ev.start)}</span>
                  <span className="font-mono text-[9px] font-semibold px-1.5 py-0.5 rounded-full text-muted-foreground bg-white/[0.06] shrink-0">
                    {ev.type}
                  </span>
                </div>
              </div>
              <span
                className="font-mono text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap"
                style={{ background: theme.accent + "29", color: theme.accent }}
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
