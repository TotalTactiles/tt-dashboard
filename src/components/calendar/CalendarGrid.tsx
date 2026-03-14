import { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X, Plus } from "lucide-react";
import { CalendarEvent, eventTypeColors } from "@/data/calendarMockData";
import { Badge } from "@/components/ui/badge";

interface CalendarGridProps {
  events: CalendarEvent[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const typeLabels: Record<CalendarEvent["type"], string> = {
  meeting: "Meeting", deadline: "Deadline", milestone: "Milestone",
  call: "Call", filing: "Filing", distribution: "Distribution", valuation: "Valuation",
};

const CalendarGrid = ({ events, selectedDate, onSelectDate }: CalendarGridProps) => {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 2, 1));
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const cellRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => { setCurrentDate(new Date(year, month - 1, 1)); setExpandedDay(null); };
  const nextMonth = () => { setCurrentDate(new Date(year, month + 1, 1)); setExpandedDay(null); };

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

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // Pad to fill complete rows
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();
  const isToday = (d: number) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  const isSelected = (d: number) =>
    d === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear();

  const handleDayClick = (day: number) => {
    onSelectDate(new Date(year, month, day));
    setExpandedDay(expandedDay === day ? null : day);
  };

  const expandedEvents = expandedDay ? eventsByDay[expandedDay] || [] : [];
  const expandedDate = expandedDay ? new Date(year, month, expandedDay) : null;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="stat-card flex-1 min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => { setCurrentDate(new Date(year, Number(e.target.value), 1)); setExpandedDay(null); }}
            className="bg-secondary text-foreground text-sm font-semibold rounded-lg px-3 py-1.5 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select
            value={year}
            onChange={(e) => { setCurrentDate(new Date(Number(e.target.value), month, 1)); setExpandedDay(null); }}
            className="bg-secondary text-foreground text-sm font-semibold rounded-lg px-3 py-1.5 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-secondary transition-colors duration-150">
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-secondary transition-colors duration-150">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-[11px] font-mono text-muted-foreground py-1.5 font-medium">{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1.5 relative">
        {cells.map((day, i) => (
          <div
            key={i}
            ref={(el) => { if (day) cellRefs.current[day] = el; }}
            onClick={() => day && handleDayClick(day)}
            className={`relative min-h-[100px] flex flex-col p-2 rounded-xl text-xs transition-all duration-150 cursor-pointer
              ${!day ? "opacity-0 pointer-events-none" : ""}
              ${day && isToday(day) ? "bg-primary/15 ring-1 ring-primary/40" : ""}
              ${day && isSelected(day) && !isToday(day) ? "bg-secondary ring-1 ring-primary/30" : ""}
              ${day && !isToday(day) && !isSelected(day) ? "bg-muted/50 hover:bg-secondary/70" : ""}
            `}
          >
            {day && (
              <>
                <span className={`text-[12px] font-bold mb-1 ${isToday(day) ? "text-primary" : "text-foreground/80"}`}>
                  {day}
                </span>
                <div className="flex flex-col gap-0.5 flex-1">
                  {(eventsByDay[day] || []).slice(0, 3).map((ev) => (
                    <div key={ev.id} className="flex items-center gap-1 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: eventTypeColors[ev.type] }} />
                      <span className="text-[10px] text-foreground/70 truncate leading-tight">{ev.title}</span>
                    </div>
                  ))}
                  {(eventsByDay[day] || []).length > 3 && (
                    <span className="text-[9px] text-primary font-medium">+{(eventsByDay[day] || []).length - 3} more</span>
                  )}
                </div>
              </>
            )}
          </div>
        ))}

        {/* Expanded day floating card */}
        <AnimatePresence>
          {expandedDay && expandedDate && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute z-50 w-[320px] bg-card border border-border rounded-xl shadow-2xl p-4"
              style={{
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-foreground">
                  {expandedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </h4>
                <button onClick={() => setExpandedDay(null)} className="p-1 rounded-lg hover:bg-secondary transition-colors">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              {expandedEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No events for this day</p>
              ) : (
                <div className="space-y-2 max-h-[260px] overflow-y-auto">
                  {expandedEvents.map((ev) => (
                    <div key={ev.id} className="p-2.5 rounded-lg bg-secondary/50 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          className="text-[9px] px-1.5 py-0 rounded-full border-0"
                          style={{ backgroundColor: eventTypeColors[ev.type], color: "hsl(220, 20%, 6%)" }}
                        >
                          {typeLabels[ev.type]}
                        </Badge>
                        <span className="text-[10px] font-mono text-muted-foreground ml-auto">
                          {ev.calendar === "google" ? "Google" : "Zoho"}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-foreground">{ev.title}</p>
                      {ev.time && <p className="text-[10px] font-mono text-muted-foreground">{ev.time}</p>}
                      {ev.description && <p className="text-[10px] text-foreground/60">{ev.description}</p>}
                    </div>
                  ))}
                </div>
              )}
              <button className="flex items-center gap-1 mt-3 text-[11px] text-primary font-medium hover:text-primary/80 transition-colors">
                <Plus className="h-3 w-3" /> Add Event
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default CalendarGrid;
