import { useState, useMemo, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type LiveCalendarEvent } from "@/contexts/DashboardDataContext";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { getEventTheme } from "./eventColors";
import DayEventsModal from "./DayEventsModal";
import { List } from "lucide-react";

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
const dateISO = (d: Date) => dateKey(d.getFullYear(), d.getMonth(), d.getDate());

type CalendarView = "day" | "week" | "month";

interface CalendarGridProps {
  events: LiveCalendarEvent[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onEventClick: (event: LiveCalendarEvent) => void;
  onAddEvent: () => void;
  onDayClick?: (dateISO: string) => void;
  onViewMonthChange?: (viewMonth: Date) => void;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const parseLocal = (raw: string) =>
  raw.includes("T") ? new Date(raw) : new Date(raw + "T00:00:00");

/** Return the Date at Sunday 00:00 of the week containing `d`. */
const startOfWeek = (d: Date) => {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() - out.getDay());
  return out;
};

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Expand an event into the set of local days it occupies. */
const eventOccupiesDay = (e: LiveCalendarEvent, target: Date): boolean => {
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
  const t = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  return t >= startLocal.getTime() && t <= endLocal.getTime();
};

const CalendarGrid = ({ events, selectedDate, onSelectDate, onEventClick, onDayClick, onViewMonthChange }: CalendarGridProps) => {
  const [view, setView] = useState<CalendarView>("month");
  const [currentDate, setCurrentDate] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));

  useEffect(() => {
    onViewMonthChange?.(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
  }, [currentDate, onViewMonthChange]);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [expandedPastDays, setExpandedPastDays] = useState<Set<string>>(new Set());
  const [viewAllDay, setViewAllDay] = useState<Date | null>(null);
  const [userSelectedKey, setUserSelectedKey] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Clear transient day-selection highlight when clicking outside the calendar grid.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const el = rootRef.current;
      if (!el) return;
      const target = e.target as Node | null;
      if (target && el.contains(target)) return;
      // Ignore clicks inside dialogs/popovers (portals live outside root)
      if (target instanceof Element) {
        if (target.closest('[role="dialog"], [data-radix-popper-content-wrapper]')) return;
      }
      setUserSelectedKey(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const hoverCapable = useMediaQuery("(hover: hover) and (pointer: fine)", false);
  const isNarrow = useMediaQuery("(max-width: 639px)", false);
  const tvMode = useTvMode();
  const collapsedLimit = tvMode ? 6 : isNarrow ? 2 : 3;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Today as a local-midnight Date, computed once per mount so collapsed styling is stable.
  const todayDate = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const dateKeyNum = (d: Date) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  const todayKey = dateKeyNum(todayDate);

  // ---- Navigation dispatched by active view ----
  const goPrev = () => {
    setExpandedDay(null);
    setExpandedPastDays(new Set());
    if (view === "month") {
      setCurrentDate(new Date(year, month - 1, 1));
    } else if (view === "week") {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() - 7);
      onSelectDate(d);
      setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1));
    } else {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() - 1);
      onSelectDate(d);
      setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  };
  const goNext = () => {
    setExpandedDay(null);
    setExpandedPastDays(new Set());
    if (view === "month") {
      setCurrentDate(new Date(year, month + 1, 1));
    } else if (view === "week") {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + 7);
      onSelectDate(d);
      setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1));
    } else {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + 1);
      onSelectDate(d);
      setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  };

  // ---- Month view data ----
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const eventsByDay = useMemo(() => {
    const map: Record<number, LiveCalendarEvent[]> = {};
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
    d === todayDate.getDate() && month === todayDate.getMonth() && year === todayDate.getFullYear();
  const isPast = (d: number) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cellDate = new Date(year, month, d);
    cellDate.setHours(0, 0, 0, 0);

    return cellDate.getTime() < today.getTime();
  };
  const isDatePast = (d: Date) => dateKeyNum(d) < todayKey;

  const isSelected = (d: number) => userSelectedKey === dateKey(year, month, d);

  const handleMonthDayClick = (day: number) => {
    const key = dateKey(year, month, day);
    setUserSelectedKey(key);
    const past = isPast(day);
    if (past) {
      setExpandedPastDays((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
      onSelectDate(new Date(year, month, day));
      return;
    }
    onSelectDate(new Date(year, month, day));
    if (onDayClick) onDayClick(`${year}-${pad2(month + 1)}-${pad2(day)}`);
  };

  // ---- Week view data ----
  const weekStart = useMemo(() => startOfWeek(selectedDate), [selectedDate]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    }),
    [weekStart]
  );

  const weekEventsByDate = useMemo(() => {
    const map: Record<string, LiveCalendarEvent[]> = {};
    weekDays.forEach((d) => (map[dateISO(d)] = []));
    events.forEach((e) => {
      weekDays.forEach((d) => {
        if (eventOccupiesDay(e, d)) map[dateISO(d)].push(e);
      });
    });
    // sort each day by start time
    Object.values(map).forEach((list) =>
      list.sort((a, b) => a.start.localeCompare(b.start))
    );
    return map;
  }, [events, weekDays]);

  // ---- Day view data ----
  const dayEvents = useMemo(() => {
    return events
      .filter((e) => eventOccupiesDay(e, selectedDate))
      .sort((a, b) => a.start.localeCompare(b.start));
  }, [events, selectedDate]);

  // Header title reflects the active unit
  const headerTitle = (() => {
    if (view === "month") return `${MONTHS[month]} ${year}`;
    if (view === "week") {
      const end = new Date(weekStart);
      end.setDate(end.getDate() + 6);
      const sameMonth = end.getMonth() === weekStart.getMonth();
      const startLabel = `${MONTHS[weekStart.getMonth()].slice(0, 3)} ${weekStart.getDate()}`;
      const endLabel = sameMonth
        ? `${end.getDate()}`
        : `${MONTHS[end.getMonth()].slice(0, 3)} ${end.getDate()}`;
      return `${startLabel} – ${endLabel}, ${end.getFullYear()}`;
    }
    return selectedDate.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="stat-card flex-1 min-w-0 flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0 gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-foreground truncate">{headerTitle}</h3>
        <div className="flex items-center gap-2">
          {/* Segmented view switcher */}
          <div
            role="tablist"
            aria-label="Calendar view"
            className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5"
          >
            {(["day", "week", "month"] as CalendarView[]).map((v) => {
              const active = view === v;
              return (
                <button
                  key={v}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setView(v)}
                  className={
                    "px-2.5 py-1 rounded-md text-[11px] font-medium capitalize transition-colors duration-150 " +
                    (active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  {v}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={goPrev} className="p-1.5 rounded-lg hover:bg-secondary transition-colors duration-150">
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            <button onClick={goNext} className="p-1.5 rounded-lg hover:bg-secondary transition-colors duration-150">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      {view === "month" && (
        <>
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
            className="grid grid-cols-7 gap-1 flex-1 min-h-0 items-stretch"
            style={{ gridTemplateRows: `repeat(${rowCount}, minmax(0, auto))` }}
          >
            {cells.map((cell, i) => {
              const dayEvts = cell.inMonth ? eventsByDay[cell.day] || [] : [];
              const key = cell.inMonth ? dateKey(year, month, cell.day) : "";
              const past = cell.inMonth && isPast(cell.day);
              const expandedPast = past && expandedPastDays.has(key);
              const collapsedPast = past && !expandedPast;

              const isExpanded = !tvMode && cell.inMonth && expandedDay === cell.day && dayEvts.length > collapsedLimit;
              const visibleEvents = isExpanded ? dayEvts : dayEvts.slice(0, collapsedLimit);
              const overflow = dayEvts.length - collapsedLimit;

              const handleMouseEnter = () => {
                if (!tvMode && hoverCapable && cell.inMonth && dayEvts.length > collapsedLimit) {
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
                  onClick={() => cell.inMonth && handleMonthDayClick(cell.day)}
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                  className={`relative rounded-lg transition-all duration-150 overflow-hidden
                    ${collapsedPast
                      ? `self-start flex items-center justify-between ${tvMode ? "h-10 px-2 py-1" : "min-h-[22px] h-[22px] px-2 py-1"} cursor-pointer`
                      : `flex flex-col items-start h-full ${tvMode ? "p-2" : "p-1.5 min-h-[64px]"}`}
                    ${!cell.inMonth ? "opacity-30 pointer-events-none" : "cursor-pointer"}
                    ${cell.inMonth && isToday(cell.day) ? "bg-primary/15 ring-1 ring-primary/40" : ""}
                    ${cell.inMonth && isSelected(cell.day) && !isToday(cell.day) ? "bg-secondary ring-1 ring-primary/30" : ""}
                    ${cell.inMonth && !isToday(cell.day) && !isSelected(cell.day) ? "bg-muted/50 hover:bg-secondary/70" : ""}
                    ${isExpanded ? "z-20 shadow-lg ring-1 ring-primary/40 bg-card" : ""}
                  `}
                >
                  <div className={`flex items-center ${collapsedPast ? "justify-between w-full" : "mb-1"}`}>
                    <span
                      className={`font-bold leading-none ${cell.inMonth && isToday(cell.day) ? "text-primary" : "text-foreground/80"}`}
                      style={{ fontSize: tvMode ? "clamp(16px, 1.1vw, 22px)" : "clamp(10px, 1vw, 12px)" }}
                    >
                      {cell.day}
                    </span>
                    {collapsedPast && dayEvts.length > 0 && (
                      <span
                        className="rounded-full bg-primary/70 shrink-0"
                        style={{ width: tvMode ? 8 : 5, height: tvMode ? 8 : 5 }}
                      />
                    )}
                  </div>
                  {!collapsedPast && (
                    <div
                      className={`flex flex-col ${tvMode ? "gap-1.5" : "gap-1"} flex-1 min-h-0 w-full overflow-y-auto ${isExpanded ? "max-h-[60vh]" : ""}`}
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
                  {!collapsedPast && dayEvts.length > 3 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewAllDay(new Date(year, month, cell.day));
                      }}
                      className={`mt-1 inline-flex items-center gap-1 self-stretch justify-center rounded-md bg-primary/10 hover:bg-primary/20 text-primary font-medium transition-colors shrink-0 ${tvMode ? "px-2 py-1 text-[12px]" : "px-1.5 py-0.5 text-[10px]"}`}
                      title={`View all ${dayEvts.length} events`}
                    >
                      <List className={tvMode ? "h-3.5 w-3.5" : "h-3 w-3"} />
                      View all ({dayEvts.length})
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {view === "week" && (
        <>
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1 shrink-0">
            {weekDays.map((d) => {
              const today = sameDay(d, todayDate);
              const selected = sameDay(d, selectedDate);
              return (
                <div
                  key={d.toISOString()}
                  className={`text-center py-1 font-medium rounded-md ${today ? "text-primary" : selected ? "text-foreground" : "text-muted-foreground"}`}
                  style={{ fontSize: tvMode ? "clamp(12px, 0.9vw, 15px)" : "clamp(10px, 0.9vw, 12px)" }}
                >
                  <div className="font-mono uppercase">{DAYS[d.getDay()]}</div>
                  <div className="font-bold" style={{ fontSize: tvMode ? "clamp(18px, 1.4vw, 26px)" : "clamp(13px, 1.1vw, 16px)" }}>
                    {d.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Week columns */}
          <div className="grid grid-cols-7 gap-1 flex-1 min-h-0">
            {weekDays.map((d) => {
              const iso = dateISO(d);
              const list = weekEventsByDate[iso] || [];
              const today = sameDay(d, todayDate);
              const selected = sameDay(d, selectedDate);
              const past = isDatePast(d);
              return (
                <div
                  key={iso}
                  onClick={() => {
                    onSelectDate(d);
                    if (past) return;
                    if (onDayClick) onDayClick(iso);
                  }}
                  className={`relative flex flex-col rounded-lg cursor-pointer transition-colors duration-150 p-1.5 gap-1 overflow-y-auto
                    ${today ? "bg-primary/15 ring-1 ring-primary/40" : selected ? "bg-secondary ring-1 ring-primary/30" : "bg-muted/50 hover:bg-secondary/70"}
                  `}
                >
                  {list.length === 0 && (
                    <span className="text-muted-foreground/60 italic text-[10px] px-1 py-2">
                      {past ? "—" : "+ add"}
                    </span>
                  )}
                  {list.map((ev) => {
                    const theme = getEventTheme(ev);
                    const isPending = !!ev._pending;
                    const startD = parseLocal(ev.start);
                    const timeLabel = ev.allDay
                      ? "All day"
                      : `${pad2(startD.getHours())}:${pad2(startD.getMinutes())}`;
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        title={isPending ? `${ev.title} (syncing…)` : ev.title}
                        onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                        className="group flex flex-col min-w-0 w-full rounded-md cursor-pointer text-left border-l-[3px] border-y border-r border-border/40 px-2 py-1.5 gap-0.5"
                        style={{
                          opacity: isPending ? 0.5 : 1,
                          background: theme.bg,
                          borderLeftColor: theme.border,
                        }}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`rounded-full shrink-0 w-1.5 h-1.5 ${isPending ? "animate-pulse" : ""}`}
                            style={{ backgroundColor: theme.accent }}
                          />
                          <span
                            className="font-mono text-muted-foreground shrink-0"
                            style={{ fontSize: tvMode ? "clamp(10px, 0.75vw, 13px)" : "10px" }}
                          >
                            {timeLabel}
                          </span>
                          {isPending && (
                            <span className="ml-auto italic text-muted-foreground text-[9px]">syncing…</span>
                          )}
                        </div>
                        <span
                          className="truncate text-foreground/90 font-medium leading-tight"
                          style={{ fontSize: tvMode ? "clamp(12px, 0.9vw, 15px)" : "clamp(10px, 0.85vw, 12px)" }}
                        >
                          {ev.title}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </>
      )}

      {view === "day" && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {(() => {
            const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 06:00 – 22:00
            const past = isDatePast(selectedDate) && !sameDay(selectedDate, todayDate);
            // Bucket timed events by hour; keep all-day separately.
            const allDay: LiveCalendarEvent[] = [];
            const byHour: Record<number, LiveCalendarEvent[]> = {};
            HOURS.forEach((h) => (byHour[h] = []));
            const outOfRange: LiveCalendarEvent[] = [];
            dayEvents.forEach((ev) => {
              if (ev.allDay) { allDay.push(ev); return; }
              const startD = parseLocal(ev.start);
              const h = startD.getHours();
              if (h >= HOURS[0] && h <= HOURS[HOURS.length - 1]) byHour[h].push(ev);
              else outOfRange.push(ev);
            });

            const renderEvent = (ev: LiveCalendarEvent) => {
              const theme = getEventTheme(ev);
              const isPending = !!ev._pending;
              const startD = parseLocal(ev.start);
              const timeLabel = ev.allDay
                ? "All day"
                : `${pad2(startD.getHours())}:${pad2(startD.getMinutes())}`;
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                  className="group flex items-center min-w-0 w-full rounded-md cursor-pointer text-left border-l-[3px] border-y border-r border-border/40 px-3 py-2 gap-3"
                  style={{
                    opacity: isPending ? 0.5 : 1,
                    background: theme.bg,
                    borderLeftColor: theme.border,
                  }}
                >
                  <span
                    className={`rounded-full shrink-0 w-2 h-2 ${isPending ? "animate-pulse" : ""}`}
                    style={{ backgroundColor: theme.accent }}
                  />
                  <span
                    className="font-mono text-muted-foreground shrink-0"
                    style={{ fontSize: tvMode ? "clamp(11px, 0.85vw, 14px)" : "11px" }}
                  >
                    {timeLabel}
                  </span>
                  <span
                    className="truncate text-foreground/90 font-medium"
                    style={{ fontSize: tvMode ? "clamp(13px, 1vw, 17px)" : "clamp(11px, 0.9vw, 13px)" }}
                  >
                    {ev.title}
                  </span>
                  {isPending && (
                    <span className="ml-auto italic text-muted-foreground text-[10px]">syncing…</span>
                  )}
                </button>
              );
            };

            return (
              <div className="flex flex-col gap-2">
                {allDay.length > 0 && (
                  <div className="border-b border-border pb-2 mb-1">
                    <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1 px-1">All day</div>
                    <div className="flex flex-col gap-1">{allDay.map(renderEvent)}</div>
                  </div>
                )}
                {HOURS.map((h) => {
                  const list = byHour[h];
                  const label = `${pad2(h)}:00`;
                  return (
                    <div
                      key={h}
                      onClick={() => {
                        if (past) return;
                        if (list.length === 0 && onDayClick) {
                          onDayClick(dateISO(selectedDate));
                        }
                      }}
                      className={`grid grid-cols-[60px_1fr] gap-2 min-h-[44px] py-1 border-t border-border/40 ${list.length === 0 && !past ? "cursor-pointer hover:bg-muted/30" : ""}`}
                    >
                      <div
                        className="text-right pr-1 pt-1 font-mono text-muted-foreground"
                        style={{ fontSize: tvMode ? "clamp(11px, 0.8vw, 14px)" : "11px" }}
                      >
                        {label}
                      </div>
                      <div className="flex flex-col gap-1 min-w-0">
                        {list.length === 0 ? (
                          <span className="text-muted-foreground/40 text-[10px] italic pt-1">
                            {past ? "" : "+ add"}
                          </span>
                        ) : (
                          list.map(renderEvent)
                        )}
                      </div>
                    </div>
                  );
                })}
                {outOfRange.length > 0 && (
                  <div className="border-t border-border pt-2 mt-1">
                    <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1 px-1">Outside 06–22</div>
                    <div className="flex flex-col gap-1">{outOfRange.map(renderEvent)}</div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      <DayEventsModal
        open={!!viewAllDay}
        onClose={() => setViewAllDay(null)}
        date={viewAllDay}
        events={viewAllDay ? events.filter((e) => eventOccupiesDay(e, viewAllDay)) : []}
        onEventClick={(ev) => {
          setViewAllDay(null);
          onEventClick(ev);
        }}
        onAddEvent={() => {
          if (!viewAllDay) return;
          const iso = dateISO(viewAllDay);
          const d = viewAllDay;
          setViewAllDay(null);
          onSelectDate(d);
          if (onDayClick) onDayClick(iso);
        }}
      />
    </motion.div>
  );
};

export default CalendarGrid;
