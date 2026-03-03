import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CalendarEvent, eventTypeColors } from "@/data/calendarMockData";
import { Badge } from "@/components/ui/badge";

interface CalendarCardProps {
  title: string;
  source: "google" | "zoho";
  events: CalendarEvent[];
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const CalendarCard = ({ title, source, events }: CalendarCardProps) => {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 2, 1)); // March 2026

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const eventsByDay = useMemo(() => {
    const map: Record<number, CalendarEvent[]> = {};
    events.forEach((e) => {
      const d = new Date(e.date);
      if (d.getMonth() === month && d.getFullYear() === year) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(e);
      }
    });
    return map;
  }, [events, month, year]);

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const today = new Date();
  const isToday = (d: number) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="stat-card"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`pulse-dot ${source === "google" ? "bg-chart-blue" : "bg-chart-purple"}`} />
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <Badge variant="outline" className="text-[10px] font-mono">
            {source === "google" ? "Google" : "Zoho"}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-1 rounded hover:bg-secondary transition-colors">
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <span className="text-xs font-mono text-muted-foreground w-28 text-center">
            {MONTHS[month]} {year}
          </span>
          <button onClick={nextMonth} className="p-1 rounded hover:bg-secondary transition-colors">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-[10px] font-mono text-muted-foreground py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px">
        {cells.map((day, i) => (
          <div
            key={i}
            className={`relative h-10 flex flex-col items-center justify-start pt-1 rounded text-xs transition-colors
              ${day ? "hover:bg-secondary/50 cursor-pointer" : ""}
              ${day && isToday(day) ? "bg-primary/10 ring-1 ring-primary/30" : ""}
            `}
          >
            {day && (
              <>
                <span className={`text-[11px] ${isToday(day) ? "text-primary font-bold" : "text-foreground/70"}`}>
                  {day}
                </span>
                {eventsByDay[day] && (
                  <div className="flex gap-0.5 mt-0.5">
                    {eventsByDay[day].slice(0, 3).map((ev) => (
                      <span
                        key={ev.id}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: eventTypeColors[ev.type] }}
                        title={ev.title}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default CalendarCard;
