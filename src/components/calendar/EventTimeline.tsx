import { motion } from "framer-motion";
import { calendarEvents, eventTypeColors, type CalendarEvent } from "@/data/calendarMockData";
import { Badge } from "@/components/ui/badge";

const typeLabels: Record<CalendarEvent["type"], string> = {
  meeting: "Meeting",
  deadline: "Deadline",
  milestone: "Milestone",
  call: "Call",
  filing: "Filing",
  distribution: "Distribution",
  valuation: "Valuation",
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
      <div className="space-y-1 max-h-[400px] overflow-y-auto">
        {upcoming.map((ev, i) => {
          const d = new Date(ev.date);
          const dayStr = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
          return (
            <div key={ev.id} className="flex items-start gap-3 p-2 rounded-md hover:bg-secondary/30 transition-colors">
              <div
                className="w-1 h-full min-h-[36px] rounded-full shrink-0 mt-0.5"
                style={{ backgroundColor: eventTypeColors[ev.type] }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{ev.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-mono text-muted-foreground">{dayStr}</span>
                  {ev.time && <span className="text-[10px] font-mono text-muted-foreground">{ev.time}</span>}
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0">{typeLabels[ev.type]}</Badge>
                </div>
              </div>
              <span className={`pulse-dot shrink-0 mt-1.5 ${ev.calendar === "google" ? "bg-chart-blue" : "bg-chart-purple"}`} />
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default EventTimeline;
