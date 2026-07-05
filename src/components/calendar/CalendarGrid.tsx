import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type LiveCalendarEvent } from "@/contexts/DashboardDataContext";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { getEventTheme } from "./eventColors";

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

const pad2 = (n: number) => n.toString().padStart(2, "0");
const dateKey = (year: number, month: number, day: number) => `${year}-${pad2(month + 1)}-${pad2(day)}`;


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
  const [expandedPastDays, setExpandedPastDays] = useState<Set<string>>(new Set());

  const hoverCapable = useMediaQuery("(hover: hover) and (pointer: fine)", false);
  const isNarrow = useMediaQuery("(max-width: 639px)", false);
  const tvMode = useTvMode();
  // TV wallboards get more room per cell → show more pills, no interactive expand.
  const collapsedLimit = tvMode ? 6 : isNarrow ? 2 : 4;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const prevMonth = () => { setExpandedDay(null); setExpandedPastDays(new Set()); setCurrentDate(new Date(year, month - 1, 1)); };
  const nextMonth = () => { setExpandedDay(null); setExpandedPastDays(new Set()); setCurrentDate(new Date(year, month + 1, 1)); };

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, [month, year]);

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

  const isToday = (d: number) =>
    d === todayStart.getDate() && month === todayStart.getMonth() && year === todayStart.getFullYear();
  const isPast = (d: number) => {
    const dObj = new Date(year, month, d);
    dObj.setHours(0, 0, 0, 0);
    return dObj.getTime() < todayStart.getTime();
  };
  const isSelected = (d: number) =>
    d === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear();

  const handleDayClick = (day: number) => {
    const key = dateKey(year, month, day);
    const past = isPast(day);
    if (past) {
      // Past days toggle expand/collapse in-place instead of opening the create modal.
      setExpandedPastDays((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
      // Still update the selected day so the side panels reflect the chosen date,
      // but do not trigger the day-click → create-event modal.
      onSelectDate(new Date(year, month, day));
      return;
    }
    onSelectDate(new Date(year, month, day));
    if (onDayClick) {
      const iso = `${year}-${pad2(month + 1)}-${pad2(day)}`;
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
        className="grid grid-cols-7 gap-1 flex-1 min-h-0 items-start"
        style={{ gridTemplateRows: `repeat(${rowCount}, minmax(0, auto))` }}
      >
        {cells.map((cell, i) => {
          const dayEvents = cell.inMonth ? eventsByDay[cell.day] || [] : [];
          const key = cell.inMonth ? dateKey(year, month, cell.day) : "";
          const past = cell.inMonth && isPast(cell.day);
          const expandedPast = past && expandedPastDays.has(key);
          const collapsedPast = past && !expandedPast;

          // In TV mode, never expand interactively — just show up to collapsedLimit and a static "+X" if any remain.
          const isExpanded = !tvMode && cell.inMonth && expandedDay === cell.day && dayEvents.length > collapsedLimit;
          const visibleEvents = isExpanded ? dayEvents : dayEvents.slice(0, collapsedLimit);
          const overflow = dayEvents.length - collapsedLimit;

          const handleMouseEnter = () => {
            if (!tvMode && hoverCapable && cell.inMonth && dayEvents.length > collapsedLimit) {
              setExpandedDay(cell.day);
            }
          };
          const handleMouseLeave = () => {
            if (!tvMode && hoverCapable && expandedDay === cell.day) setExpandedDay(null);
          };
          const handleChipClick = (e: React.MouseEvent) => {
            e.stopPropagation();
            if (tvMode) return;
            setExpandedDay(isExpanded ? null : cell.day);
          };

          return (
            <div
              key={i}
              onClick={() => cell.inMonth && handleDayClick(cell.day)}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              className={`relative flex items-start rounded-lg transition-all duration-150
                ${collapsedPast ? (tvMode ? "h-10 px-2 py-1 justify-between" : "h-6 px-1.5 py-0.5 justify-between") : `flex-col ${tvMode ? "p-2" : "p-1.5"}`}
                ${!cell.inMonth ? "opacity-30 pointer-events-none" : "cursor-pointer"}
                ${cell.inMonth && isToday(cell.day) ? "bg-primary/15 ring-1 ring-primary/40" : ""}
                ${cell.inMonth && isSelected(cell.day) && !isToday(cell.day) ? "bg-secondary ring-1 ring-primary/30" : ""}
                ${cell.inMonth && !isToday(cell.day) && !isSelected(cell.day) ? "bg-muted/50 hover:bg-secondary/70" : ""}
                ${isExpanded ? "z-20 shadow-lg ring-1 ring-primary/40 bg-card" : "overflow-hidden"}
              `}
              style={{ minHeight: 0 }}
            >
              <div className={`flex items-center ${collapsedPast ? "justify-between w-full" : "mb-1"}`}>
                <span
                  className={`font-bold leading-none ${cell.inMonth && isToday(cell.day) ? "text-primary" : "text-foreground/80"}`}
                  style={{ fontSize: tvMode ? "clamp(16px, 1.1vw, 22px)" : "clamp(10px, 1vw, 12px)" }}
                >
                  {cell.day}
                </span>
                {collapsedPast && dayEvents.length > 0 && (
                  <span
                    className="rounded-full bg-primary/70 shrink-0"
                    style={{ width: tvMode ? 8 : 5, height: tvMode ? 8 : 5 }}
                  />
                )}
              </div>
              {!collapsedPast && (
                <div
                  className={`flex flex-col ${tvMode ? "gap-1.5" : "gap-1"} flex-1 min-h-0 w-full ${isExpanded ? "overflow-y-auto max-h-[60vh]" : "overflow-hidden"}`}
                >
                  {visibleEvents.map((ev) => {
                    const theme = getEventTheme(ev);
                    const isPending = !!ev._pending;
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        title={isPending ? `${ev.title} (syncing…)` : ev.title}
                        onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                        className={`group flex items-center min-w-0 w-full rounded-md cursor-pointer text-left transition-all duration-300 border-l-[3px] ${
                          tvMode
                            ? "gap-2 px-2 py-1.5 border-y border-r border-border/40"
                            : `gap-1 px-1 border-y border-r border-transparent ${hoverCapable ? "py-0.5" : "py-1.5 min-h-[36px]"}`
                        }`}
                        style={{
                          opacity: isPending ? (tvMode ? 0.6 : 0.5) : 1,
                          background: theme.bg,
                          borderLeftColor: theme.border,
                        }}
                      >
                        <span
                          className={`rounded-full shrink-0 ${tvMode ? "w-2.5 h-2.5" : "w-1.5 h-1.5"} ${isPending ? "animate-pulse" : ""}`}
                          style={{ backgroundColor: theme.accent }}
                        />
                        <span
                          className={`truncate leading-tight ${tvMode ? "text-foreground font-medium" : "text-foreground/90 group-hover:text-foreground"}`}
                          style={{ fontSize: tvMode ? "clamp(13px, 0.9vw, 17px)" : "clamp(9px, 0.9vw, 11px)" }}
                        >
                          {ev.title}
                        </span>
                        {isPending && (
                          <span
                            className="ml-auto shrink-0 italic text-muted-foreground"
                            style={{ fontSize: tvMode ? "11px" : "9px" }}
                          >
                            syncing…
                          </span>
                        )}
                      </button>
                    );
                  })}
                  {overflow > 0 && (
                    tvMode ? (
                      <span
                        className="text-muted-foreground font-medium px-2 pt-0.5"
                        style={{ fontSize: "clamp(12px, 0.85vw, 15px)" }}
                      >
                        +{overflow} more
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleChipClick}
                        className={`text-primary hover:text-primary/80 font-medium truncate text-left cursor-pointer rounded-md px-1 hover:bg-primary/10 ${hoverCapable ? "" : "min-h-[40px] py-1.5 bg-primary/5"}`}
                        style={{ fontSize: "clamp(9px, 0.9vw, 11px)" }}
                      >
                        {isExpanded ? "Show less" : `+${overflow} more`}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

    </motion.div>
  );
};

export default CalendarGrid;
