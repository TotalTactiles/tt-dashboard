import { useMemo } from "react";
import { motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { type LiveCalendarEvent } from "@/contexts/DashboardDataContext";

interface DaySchedulePanelProps {
  events: LiveCalendarEvent[];
  selectedDate: Date;
  onPrevDay: () => void;
  onNextDay: () => void;
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

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 08:00–20:00

const DaySchedulePanel = ({ events, selectedDate, onPrevDay, onNextDay, onEventClick }: DaySchedulePanelProps) => {
  const dayEvents = useMemo(() => {
    return events.filter((e) => {
      const d = new Date(e.start);
      return (
        d.getDate() === selectedDate.getDate() &&
        d.getMonth() === selectedDate.getMonth() &&
        d.getFullYear() === selectedDate.getFullYear()
      );
    });
  }, [events, selectedDate]);

  const dateStr = selectedDate.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });

  const eventsByHour = useMemo(() => {
    const map: Record<number, LiveCalendarEvent[]> = {};
    dayEvents.forEach((ev) => {
      if (ev.allDay) {
        if (!map[8]) map[8] = [];
        map[8].push(ev);
        return;
      }
      const hour = new Date(ev.start).getHours();
      if (!map[hour]) map[hour] = [];
      map[hour].push(ev);
    });
    return map;
  }, [dayEvents]);

  const formatTime12 = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  };

  const getDuration = (start: string, end: string) => {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const hrs = ms / (1000 * 60 * 60);
    if (hrs < 1) return `${Math.round(hrs * 60)} min`;
    return `${hrs % 1 === 0 ? hrs : hrs.toFixed(1)} hrs`;
  };

  const getInitials = (email: string) => {
    const name = email.split("@")[0];
    const parts = name.split(/[._-]/).filter(Boolean);
    return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join("");
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
                <div className={`flex-1 pt-1 pb-2 ${hourEvents.length === 0 ? "border-t border-dashed border-border/20" : "border-t border-border/30"}`}>
                  {hourEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="rounded-xl p-3 mb-1.5 transition-all duration-150 hover:scale-[1.01] cursor-pointer"
                      style={{
                        background: "hsl(var(--secondary))",
                        borderLeft: `3px solid ${getTypeColor(ev.type)}`,
                      }}
                      onClick={() => onEventClick(ev)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1">
                          <p className="text-xs font-bold text-foreground">{ev.title}</p>
                          {ev.htmlLink && (
                            <a href={ev.htmlLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                              <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary" />
                            </a>
                          )}
                        </div>
                        <span
                          className="text-[9px] font-mono px-2 py-0.5 rounded-full shrink-0"
                          style={{
                            background: ev.source.includes("Google") ? "hsl(200 80% 50% / 0.15)" : "hsl(270 60% 55% / 0.15)",
                            color: ev.source.includes("Google") ? "hsl(200 80% 50%)" : "hsl(270 60% 55%)",
                          }}
                        >
                          {ev.source.includes("Google") ? "Google" : "Zoho"}
                        </span>
                      </div>
                      {ev.description && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{ev.description}</p>
                      )}
                      {!ev.allDay && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {formatTime12(ev.start)} – {formatTime12(ev.end)} ({getDuration(ev.start, ev.end)})
                          </span>
                        </div>
                      )}
                      {ev.attendees && ev.attendees.length > 0 && (
                        <div className="flex items-center gap-1 mt-2">
                          {ev.attendees.slice(0, 3).map((att, i) => (
                            <div
                              key={i}
                              className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[9px] font-bold flex items-center justify-center"
                              title={att}
                            >
                              {getInitials(att)}
                            </div>
                          ))}
                          {ev.attendees.length > 3 && (
                            <span className="text-[9px] text-muted-foreground">+{ev.attendees.length - 3}</span>
                          )}
                        </div>
                      )}
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
