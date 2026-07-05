import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type LiveCalendarEvent } from "@/contexts/DashboardDataContext";
import { useMediaQuery } from "@/hooks/useMediaQuery";

const useTvMode = () => {
  const [tv, setTv] = useState<boolean>(() =>
    typeof document !== "undefined" && document.body.classList.contains("tv-mode")
  );
  useEffect(() => {
    if (typeof document === "undefined") return;
    const check = () => setTv(document.body.classList.contains("tv-mode"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return tv;
};

interface CalendarGridProps {
  events: LiveCalendarEvent[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onEventClick: (event: LiveCalendarEvent) => void;
  onAddEvent: () => void;
  onDayClick?: (dateISO: string) => void;
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
  Task: "#5DCAA5",
  Event: "#D4537E",
};

const getTypeColor = (type: string) => TYPE_COLORS[type] || "#378ADD";

const CalendarGrid = ({ events, selectedDate, onSelectDate, onEventClick, onDayClick }: CalendarGridProps) => {
  const [currentDate, setCurrentDate] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  const hoverCapable = useMediaQuery("(hover: hover) and (pointer: fine)", false);
  const isNarrow = useMediaQuery("(max-width: 639px)", false);
  const collapsedLimit = isNarrow ? 2 : 4;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const prevMonth = () => { setExpandedDay(null); setCurrentDate(new Date(year, month - 1, 1)); };
  const nextMonth = () => { setExpandedDay(null); setCurrentDate(new Date(year, month + 1, 1)); };

  const eventsByDay = useMemo(() => {
    const map: Record<number, LiveCalendarEvent[]> = {};
    const parseLocal = (raw: string) =>
      raw.includes("T") ? new Date(raw) : new Date(raw + "T00:00:00");

    events.forEach((e) => {
      const startD = parseLocal(e.start);
      const startLocal = new Date(startD.getFullYear(), startD.getMonth(), startD.getDate());

      let endLocal = startLocal;
      const endRaw = (e as any).end as string | undefined;
      if (e.allDay && endRaw && endRaw !== e.start) {
        const endD = parseLocal(endRaw);
        endLocal = new Date(endD.getFullYear(), endD.getMonth(), endD.getDate());
        const isDateOnlyEnd = !endRaw.includes("T");
        if (isDateOnlyEnd && endLocal.getTime() > startLocal.getTime()) {
          const prev = new Date(endLocal);
          prev.setDate(prev.getDate() - 1);
          if (prev.getTime() >= startLocal.getTime()) endLocal = prev;
        }
      }

      const cursor = new Date(startLocal);
      while (cursor.getTime() <= endLocal.getTime()) {
        if (cursor.getMonth() === month && cursor.getFullYear() === year) {
          const day = cursor.getDate();
          if (!map[day]) map[day] = [];
          map[day].push(e);
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    });
    return map;
  }, [events, month, year]);

  const cells: { day: number; inMonth: boolean }[] = [];
  for (let i = firstDay - 1; i >= 0; i--) cells.push({ day: prevMonthDays - i, inMonth: false });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, inMonth: true });
  while (cells.length % 7 !== 0) cells.push({ day: cells.length - firstDay - daysInMonth + 1, inMonth: false });
  const rowCount = cells.length / 7;

  const today = new Date();
  const isToday = (d: number) =>
    d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  const isSelected = (d: number) =>
    d === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear();

  const pad = (n: number) => n.toString().padStart(2, "0");
  const handleDayClick = (day: number) => {
    onSelectDate(new Date(year, month, day));
    if (onDayClick) {
      const iso = `${year}-${pad(month + 1)}-${pad(day)}`;
      onDayClick(iso);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="stat-card flex-1 min-w-0 flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <h3 className="text-sm font-semibold text-foreground">
          {MONTHS[month]} {year}
        </h3>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-secondary transition-colors duration-150">
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-secondary transition-colors duration-150">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1 shrink-0">
        {DAYS.map((d) => (
          <div
            key={d}
            className="text-center font-mono text-muted-foreground py-1 font-medium"
            style={{ fontSize: "clamp(9px, 1vw, 11px)" }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div
        className="grid grid-cols-7 gap-1 flex-1 min-h-0"
        style={{ gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))` }}
      >
        {cells.map((cell, i) => {
          const dayEvents = cell.inMonth ? eventsByDay[cell.day] || [] : [];
          const isExpanded = cell.inMonth && expandedDay === cell.day && dayEvents.length > collapsedLimit;
          const visibleEvents = isExpanded ? dayEvents : dayEvents.slice(0, collapsedLimit);
          const overflow = dayEvents.length - collapsedLimit;

          const handleMouseEnter = () => {
            if (hoverCapable && cell.inMonth && dayEvents.length > collapsedLimit) {
              setExpandedDay(cell.day);
            }
          };
          const handleMouseLeave = () => {
            if (hoverCapable && expandedDay === cell.day) setExpandedDay(null);
          };
          const handleChipClick = (e: React.MouseEvent) => {
            e.stopPropagation();
            setExpandedDay(isExpanded ? null : cell.day);
          };

          return (
            <div
              key={i}
              onClick={() => cell.inMonth && handleDayClick(cell.day)}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              className={`relative flex flex-col p-1.5 rounded-lg transition-all duration-150
                ${!cell.inMonth ? "opacity-30 pointer-events-none" : "cursor-pointer"}
                ${cell.inMonth && isToday(cell.day) ? "bg-primary/15 ring-1 ring-primary/40" : ""}
                ${cell.inMonth && isSelected(cell.day) && !isToday(cell.day) ? "bg-secondary ring-1 ring-primary/30" : ""}
                ${cell.inMonth && !isToday(cell.day) && !isSelected(cell.day) ? "bg-muted/50 hover:bg-secondary/70" : ""}
                ${isExpanded ? "z-20 shadow-lg ring-1 ring-primary/40 bg-card" : "overflow-hidden"}
              `}
              style={isExpanded ? { minHeight: 0 } : { minHeight: 0 }}
            >
              <span
                className={`font-bold leading-none mb-0.5 ${cell.inMonth && isToday(cell.day) ? "text-primary" : "text-foreground/80"}`}
                style={{ fontSize: "clamp(10px, 1vw, 12px)" }}
              >
                {cell.day}
              </span>
              <div
                className={`flex flex-col gap-1 flex-1 min-h-0 ${isExpanded ? "overflow-y-auto max-h-[60vh]" : "overflow-hidden"}`}
              >
                {visibleEvents.map((ev) => {
                  const color = getTypeColor(ev.type);
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      title={ev.title}
                      onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                      className={`group flex items-center gap-1 min-w-0 w-full px-1 rounded-md border border-transparent bg-secondary/40 hover:bg-secondary hover:border-border cursor-pointer text-left transition-colors ${hoverCapable ? "py-0.5" : "py-1.5 min-h-[36px]"}`}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span
                        className="text-foreground/80 group-hover:text-foreground truncate leading-tight"
                        style={{ fontSize: "clamp(9px, 0.9vw, 11px)" }}
                      >
                        {ev.title}
                      </span>
                    </button>
                  );
                })}
                {overflow > 0 && (
                  <button
                    type="button"
                    onClick={handleChipClick}
                    className={`text-primary hover:text-primary/80 font-medium truncate text-left cursor-pointer rounded-md px-1 hover:bg-primary/10 ${hoverCapable ? "" : "min-h-[40px] py-1.5 bg-primary/5"}`}
                    style={{ fontSize: "clamp(9px, 0.9vw, 11px)" }}
                  >
                    {isExpanded ? "Show less" : `+${overflow} more`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default CalendarGrid;
