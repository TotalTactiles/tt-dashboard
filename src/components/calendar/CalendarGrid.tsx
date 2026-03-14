import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X, Plus, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { type LiveCalendarEvent } from "@/contexts/DashboardDataContext";

interface CalendarGridProps {
  events: LiveCalendarEvent[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onEventClick: (event: LiveCalendarEvent) => void;
  onAddEvent: () => void;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const TYPE_COLORS: Record<string, string> = {
  Meeting: "#378ADD",
  Deadline: "#E24B4A",
  Milestone: "#7F77DD",
  Care: "#639922",
  Valuation: "#BA7517",
  Distribution: "#1D9E75",
};

const getTypeColor = (type: string) => TYPE_COLORS[type] || "#378ADD";

const CalendarGrid = ({ events, selectedDate, onSelectDate, onEventClick, onAddEvent }: CalendarGridProps) => {
  const [currentDate, setCurrentDate] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const prevMonth = () => { setCurrentDate(new Date(year, month - 1, 1)); setExpandedDay(null); };
  const nextMonth = () => { setCurrentDate(new Date(year, month + 1, 1)); setExpandedDay(null); };

  const eventsByDay = useMemo(() => {
    const map: Record<number, LiveCalendarEvent[]> = {};
    events.forEach((e) => {
      const d = new Date(e.start);
      if (d.getMonth() === month && d.getFullYear() === year) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(e);
      }
    });
    return map;
  }, [events, month, year]);

  // Build cells: leading blanks from prev month, current month days, trailing blanks
  const cells: { day: number; inMonth: boolean }[] = [];
  for (let i = firstDay - 1; i >= 0; i--) cells.push({ day: prevMonthDays - i, inMonth: false });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, inMonth: true });
  while (cells.length % 7 !== 0) cells.push({ day: cells.length - firstDay - daysInMonth + 1, inMonth: false });

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

  const formatTime12 = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="stat-card flex-1 min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-foreground">
            {MONTHS[month]} {year}
          </h3>
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
        {cells.map((cell, i) => {
          const dayEvents = cell.inMonth ? eventsByDay[cell.day] || [] : [];
          return (
            <div
              key={i}
              onClick={() => cell.inMonth && handleDayClick(cell.day)}
              className={`relative min-h-[110px] flex flex-col p-2 rounded-xl text-xs transition-all duration-150
                ${!cell.inMonth ? "opacity-30 pointer-events-none" : "cursor-pointer"}
                ${cell.inMonth && isToday(cell.day) ? "bg-primary/15 ring-1 ring-primary/40" : ""}
                ${cell.inMonth && isSelected(cell.day) && !isToday(cell.day) ? "bg-secondary ring-1 ring-primary/30" : ""}
                ${cell.inMonth && !isToday(cell.day) && !isSelected(cell.day) ? "bg-muted/50 hover:bg-secondary/70" : ""}
              `}
            >
              <span className={`text-[12px] font-bold mb-1 ${cell.inMonth && isToday(cell.day) ? "text-primary" : "text-foreground/80"}`}>
                {cell.day}
              </span>
              <div className="flex flex-col gap-0.5 flex-1">
                {dayEvents.slice(0, 3).map((ev) => (
                  <div key={ev.id} className="flex items-center gap-1 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: getTypeColor(ev.type) }} />
                    <span className="text-[10px] text-foreground/70 truncate leading-tight">{ev.title}</span>
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <span className="text-[9px] text-primary font-medium">+{dayEvents.length - 3} more</span>
                )}
              </div>
            </div>
          );
        })}

        {/* Expanded day floating card */}
        <AnimatePresence>
          {expandedDay && expandedDate && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute z-50 w-[320px] bg-card border border-border rounded-xl shadow-2xl p-4"
              style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-foreground">
                  {expandedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </h4>
                <button onClick={(e) => { e.stopPropagation(); setExpandedDay(null); }} className="p-1 rounded-lg hover:bg-secondary transition-colors">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              {expandedEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No events for this day</p>
              ) : (
                <div className="space-y-2 max-h-[260px] overflow-y-auto">
                  {expandedEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="p-2.5 rounded-lg bg-secondary/50 space-y-1 cursor-pointer hover:bg-secondary/80 transition-colors"
                      onClick={(e) => { e.stopPropagation(); onEventClick(ev); setExpandedDay(null); }}
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          className="text-[9px] px-1.5 py-0 rounded-full border-0"
                          style={{ backgroundColor: getTypeColor(ev.type), color: "#fff" }}
                        >
                          {ev.type}
                        </Badge>
                        <span className="text-[9px] font-mono text-muted-foreground ml-auto">
                          {ev.source.includes("Google") ? "Google" : "Zoho"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <p className="text-xs font-semibold text-foreground">{ev.title}</p>
                        {ev.htmlLink && <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />}
                      </div>
                      {!ev.allDay && ev.start && (
                        <p className="text-[10px] font-mono text-muted-foreground">{formatTime12(ev.start)}</p>
                      )}
                      {ev.description && <p className="text-[10px] text-foreground/60 line-clamp-2">{ev.description}</p>}
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); setExpandedDay(null); onAddEvent(); }}
                className="flex items-center gap-1 mt-3 text-[11px] text-primary font-medium hover:text-primary/80 transition-colors"
              >
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
