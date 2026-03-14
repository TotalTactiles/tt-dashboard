import { useMemo } from "react";
import { motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { CalendarEvent, eventTypeColors } from "@/data/calendarMockData";

interface DaySchedulePanelProps {
  events: CalendarEvent[];
  selectedDate: Date;
  onPrevDay: () => void;
  onNextDay: () => void;
}

const typeLabels: Record<CalendarEvent["type"], string> = {
  meeting: "Meeting", deadline: "Deadline", milestone: "Milestone",
  call: "Call", filing: "Filing", distribution: "Distribution", valuation: "Valuation",
};

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 07:00–19:00

const DaySchedulePanel = ({ events, selectedDate, onPrevDay, onNextDay }: DaySchedulePanelProps) => {
  const dayEvents = useMemo(() => {
    return events.filter((e) => {
      const d = new Date(e.date);
      return (
        d.getDate() === selectedDate.getDate() &&
        d.getMonth() === selectedDate.getMonth() &&
        d.getFullYear() === selectedDate.getFullYear()
      );
    });
  }, [events, selectedDate]);

  const dateStr = selectedDate.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });

  // Map events to their hour slot
  const eventsByHour = useMemo(() => {
    const map: Record<number, CalendarEvent[]> = {};
    dayEvents.forEach((ev) => {
      const hour = ev.time ? parseInt(ev.time.split(":")[0], 10) : 9;
      if (!map[hour]) map[hour] = [];
      map[hour].push(ev);
    });
    return map;
  }, [dayEvents]);

  // Generate initials for fake attendees
  const getInitials = (title: string) => {
    const words = title.split(" ").filter((w) => w.length > 2);
    return words.slice(0, 2).map((w) => w[0].toUpperCase());
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      className="stat-card w-full lg:w-[35%] lg:min-w-[320px] flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Scheduled</h3>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onPrevDay} className="p-1.5 rounded-lg hover:bg-secondary transition-colors duration-150">
            <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <span className="text-xs font-mono text-muted-foreground px-2">{dateStr}</span>
          <button onClick={onNextDay} className="p-1.5 rounded-lg hover:bg-secondary transition-colors duration-150">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto max-h-[500px] space-y-0">
        {dayEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CalendarDays className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Nothing scheduled</p>
            <p className="text-[11px] text-muted-foreground/60 mt-1">Enjoy your day ☀️</p>
          </div>
        ) : (
          HOURS.map((hour) => {
            const hourEvents = eventsByHour[hour] || [];
            const timeLabel = `${hour.toString().padStart(2, "0")}:00`;
            return (
              <div key={hour} className="flex gap-3 min-h-[48px]">
                <span className="text-[10px] font-mono text-muted-foreground/50 w-10 shrink-0 pt-1 text-right">{timeLabel}</span>
                <div className="flex-1 border-t border-border/30 pt-1 pb-2">
                  {hourEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="rounded-xl p-3 mb-1.5 transition-all duration-150 hover:scale-[1.01]"
                      style={{
                        background: "hsl(var(--secondary))",
                        borderTop: `3px solid ${eventTypeColors[ev.type]}`,
                      }}
                    >
                      <p className="text-xs font-bold text-foreground">{ev.title}</p>
                      {ev.description && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{ev.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        {ev.time && (
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {ev.time} — {parseInt(ev.time) + 1}:00 (1h)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1">
                          {getInitials(ev.title).map((init, i) => (
                            <div
                              key={i}
                              className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[9px] font-bold flex items-center justify-center"
                            >
                              {init}
                            </div>
                          ))}
                        </div>
                        <span
                          className="text-[9px] font-mono px-2 py-0.5 rounded-full"
                          style={{
                            background: ev.calendar === "google" ? "hsl(200, 80%, 50% / 0.15)" : "hsl(270, 60%, 55% / 0.15)",
                            color: ev.calendar === "google" ? "hsl(200, 80%, 50%)" : "hsl(270, 60%, 55%)",
                          }}
                        >
                          {ev.calendar === "google" ? "Google" : "Zoho"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
};

export default DaySchedulePanel;
