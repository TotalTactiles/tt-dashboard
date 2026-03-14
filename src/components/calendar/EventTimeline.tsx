import { motion } from "framer-motion";
import { calendarEvents, eventTypeColors, type CalendarEvent } from "@/data/calendarMockData";
import { Badge } from "@/components/ui/badge";

const typeLabels: Record<CalendarEvent["type"], string> = {
  meeting: "Meeting", deadline: "Deadline", milestone: "Milestone",
  call: "Call", filing: "Filing", distribution: "Distribution", valuation: "Valuation",
};

const EventTimeline = () => {
  const upcoming = [...calendarEvents]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 10);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="stat-card"
    >
      <h3 className="text-sm font-semibold text-foreground mb-4">Upcoming Events</h3>
      <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
        {upcoming.map((ev) => {
          const d = new Date(ev.date);
          const dayStr = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
          return (
            <div
              key={ev.id}
              className="flex items-start gap-3 p-2.5 rounded-[10px] hover:bg-secondary/40 transition-all duration-150 hover:shadow-md cursor-pointer"
              style={{ borderLeft: `3px solid ${eventTypeColors[ev.type]}` }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{ev.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-mono text-muted-foreground">{dayStr}</span>
                  {ev.time && <span className="text-[10px] font-mono text-muted-foreground">{ev.time}</span>}
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 rounded-full">{typeLabels[ev.type]}</Badge>
                </div>
              </div>
              <span
                className="text-[9px] font-mono px-2 py-0.5 rounded-full shrink-0 mt-0.5"
                style={{
                  background: ev.calendar === "google" ? "hsl(200, 80%, 50% / 0.15)" : "hsl(270, 60%, 55% / 0.15)",
                  color: ev.calendar === "google" ? "hsl(200, 80%, 50%)" : "hsl(270, 60%, 55%)",
                }}
              >
                {ev.calendar === "google" ? "Google" : "Zoho"}
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default EventTimeline;
