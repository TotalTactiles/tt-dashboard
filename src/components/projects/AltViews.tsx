import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task, TaskList as TL } from "@/hooks/useTasks";
import type { ProfileLite } from "@/hooks/useProfiles";
import { formatDateShort, daysUntil } from "@/lib/projects/dateRules";
import { useIsPmMobile } from "@/hooks/useProjects";

interface CommonProps {
  lists: TL[];
  tasks: Task[];
  profiles: ProfileLite[];
  onOpen: (id: string) => void;
}

/* ────────────────────────── BOARD ────────────────────────── */

export function BoardView({ lists, tasks, onOpen }: CommonProps) {
  const byList = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const t of tasks) (map[t.list_id] ??= []).push(t);
    for (const k of Object.keys(map)) map[k].sort((a, b) => a.position - b.position);
    return map;
  }, [tasks]);

  return (
    <div className="overflow-x-auto max-w-full">
      <div className="flex gap-3 min-w-min pb-2">
        {lists.map((l) => {
          const listTasks = byList[l.id] ?? [];
          const parents = listTasks.filter((t) => !t.parent_id);
          const childrenOf: Record<string, Task[]> = {};
          for (const t of listTasks) if (t.parent_id) (childrenOf[t.parent_id] ??= []).push(t);
          const countable = listTasks.filter((t) => !t.office_only);
          const done = countable.filter((t) => t.status === "done").length;
          return (
            <div
              key={l.id}
              className="w-[280px] shrink-0 rounded-md border overflow-hidden flex flex-col"
              style={{ borderColor: "#1F2224", background: "#0A0A0A" }}
            >
              <div
                className="px-3 py-2 border-b flex items-center justify-between"
                style={{ borderColor: "#1F2224", background: "#0F1113" }}
              >
                <span className="text-[11px] font-semibold text-foreground truncate">{l.name}</span>
                <span className="text-[10px] font-mono text-muted-foreground shrink-0 ml-2">
                  {done}/{countable.length}
                </span>
              </div>
              <div className="p-2 space-y-2 flex-1 min-h-[40px]">
                {parents.length === 0 && (
                  <div className="text-[10.5px] text-muted-foreground/60 font-mono text-center py-4">
                    No tasks
                  </div>
                )}
                {parents.map((t) => (
                  <BoardCard
                    key={t.id}
                    task={t}
                    children={childrenOf[t.id] ?? []}
                    onOpen={onOpen}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BoardCard({
  task,
  children,
  onOpen,
}: {
  task: Task;
  children: Task[];
  onOpen: (id: string) => void;
}) {
  const done = task.status === "done";
  const d = daysUntil(task.end_date);
  const isDate = !!task.end_date;
  const overdue = !done && isDate && d !== null && d < 0;
  const soon = !done && !overdue && isDate && d !== null && d >= 0 && d <= 7;
  const color = !isDate
    ? "#4B5058"
    : done
      ? "#B0B8BF"
      : overdue
        ? "#E24B4A"
        : soon
          ? "#BA7517"
          : "#B0B8BF";

  return (
    <div
      onClick={() => onOpen(task.id)}
      className="rounded-md border cursor-pointer hover:border-primary/40 transition-colors overflow-hidden"
      style={{
        borderColor: overdue ? "rgba(226,75,74,0.4)" : "#1F2224",
        background: done ? "rgba(34,197,94,0.04)" : "#0F1113",
      }}
    >
      <div className="p-2.5 space-y-1.5">
        <div className="flex items-start gap-1.5">
          <span
            className={cn(
              "text-[11.5px] leading-snug min-w-0 truncate flex-1",
              done ? "line-through text-muted-foreground" : "text-foreground/90",
            )}
            title={task.name}
          >
            {task.name}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded-sm shrink-0"
            style={
              done
                ? { color: "#22C55E", background: "rgba(34,197,94,0.12)" }
                : { color: "#5C5C65", background: "#1D1D22" }
            }
          >
            {done ? "Done" : "Open"}
          </span>
          <span className="text-[10px] font-mono shrink-0" style={{ color }}>
            {isDate ? formatDateShort(task.end_date) : "—"}
          </span>
          <span className="ml-auto text-[10px] font-mono text-muted-foreground/60 shrink-0">
            <MiniCounts taskId={task.id} />
          </span>
        </div>
      </div>
      {children.length > 0 && (
        <div className="border-t px-2.5 py-1.5 space-y-1" style={{ borderColor: "#1F2224" }}>
          {children.map((c) => (
            <div
              key={c.id}
              onClick={(e) => {
                e.stopPropagation();
                onOpen(c.id);
              }}
              className="flex items-center gap-1.5 text-[10.5px] pl-2 border-l cursor-pointer hover:bg-white/[0.03] rounded-sm py-0.5"
              style={{ borderColor: "#26262C" }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full shrink-0"
                style={{
                  background: c.status === "done" ? "#22C55E" : "#3A3A42",
                }}
              />
              <span
                className={cn(
                  "truncate",
                  c.status === "done" ? "line-through text-muted-foreground" : "text-foreground/80",
                )}
                title={c.name}
              >
                {c.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniCounts({ taskId }: { taskId: string }) {
  // Keep it light — no per-card DB calls on Board.
  return <>{taskId ? "" : ""}</>;
}

/* ────────────────────────── CALENDAR ────────────────────────── */

export function CalendarMonthView({ tasks, onOpen }: { tasks: Task[]; onOpen: (id: string) => void }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const monthLabel = cursor.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
  const firstDow = (cursor.getDay() + 6) % 7; // Mon = 0
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();

  const cells: { day: number | null; iso: string | null }[] = [];
  for (let i = 0; i < firstDow; i++) cells.push({ day: null, iso: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, iso });
  }
  while (cells.length % 7 !== 0) cells.push({ day: null, iso: null });

  // Group into weeks of 7
  const weeks: { day: number | null; iso: string | null }[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const tasksByDay = useMemo(() => {
    const m: Record<string, Task[]> = {};
    for (const t of tasks) {
      if (!t.end_date) continue;
      const iso = t.end_date.slice(0, 10);
      (m[iso] ??= []).push(t);
    }
    return m;
  }, [tasks]);

  const todayIso = (() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  })();

  const dated = tasks.filter((t) => {
    if (!t.end_date) return false;
    const d = new Date(t.end_date + "T00:00:00");
    return d.getFullYear() === cursor.getFullYear() && d.getMonth() === cursor.getMonth();
  });

  const isMobile = useIsPmMobile();
  const [expanded, setExpanded] = useState<string | null>(null); // desktop: single cell +N more expand

  // A week is "past" iff every ISO cell in it is strictly before today.
  // Leading/trailing empty cells are ignored.
  const isPastWeek = (wk: { iso: string | null }[]) => {
    const isos = wk.map((c) => c.iso).filter((x): x is string => !!x);
    if (isos.length === 0) return false;
    return isos.every((iso) => iso < todayIso);
  };

  // Expanded past-week indices for the current month view
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(() => new Set());
  // Reset collapse on month change
  const cursorKey = `${cursor.getFullYear()}-${cursor.getMonth()}`;
  useEffect(() => {
    setExpandedWeeks(new Set());
    setExpanded(null);
    // reset selection to today if today is in this month, else first day of month
    const t = new Date();
    if (t.getFullYear() === cursor.getFullYear() && t.getMonth() === cursor.getMonth()) {
      setSelectedDay(todayIso);
    } else {
      const firstIso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-01`;
      setSelectedDay(firstIso);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursorKey]);

  const toggleWeek = (idx: number) =>
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });

  const allWeeksPast = weeks.every((w) => {
    const isos = w.map((c) => c.iso).filter((x): x is string => !!x);
    return isos.length === 0 || isos.every((iso) => iso < todayIso);
  }) && weeks.some((w) => w.some((c) => !!c.iso));
  const allExpanded =
    allWeeksPast &&
    weeks.every((_, i) => !isPastWeek(weeks[i]) || expandedWeeks.has(i));

  const expandAll = () =>
    setExpandedWeeks(new Set(weeks.map((_, i) => i).filter((i) => isPastWeek(weeks[i]))));
  const collapseAll = () => setExpandedWeeks(new Set());

  // Mobile day-detail selection
  const [selectedDay, setSelectedDay] = useState<string>(() => {
    const t = new Date();
    if (t.getFullYear() === cursor.getFullYear() && t.getMonth() === cursor.getMonth()) return todayIso;
    return `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-01`;
  });

  const shiftMonth = (delta: number) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  const formatRange = (wk: { day: number | null; iso: string | null }[]) => {
    const withIso = wk.filter((c) => c.iso);
    if (withIso.length === 0) return "";
    const first = withIso[0].iso!;
    const last = withIso[withIso.length - 1].iso!;
    const f = new Date(first + "T00:00:00");
    const l = new Date(last + "T00:00:00");
    const fMon = f.toLocaleDateString("en-AU", { month: "short" });
    const lMon = l.toLocaleDateString("en-AU", { month: "short" });
    if (fMon === lMon) return `${f.getDate()} – ${l.getDate()} ${lMon}`;
    return `${f.getDate()} ${fMon} – ${l.getDate()} ${lMon}`;
  };

  const weekTaskCount = (wk: { iso: string | null }[]) =>
    wk.reduce((n, c) => (c.iso ? n + (tasksByDay[c.iso]?.length ?? 0) : n), 0);

  const selectedTasks = tasksByDay[selectedDay] ?? [];
  const selectedDateLabel = (() => {
    const d = new Date(selectedDay + "T00:00:00");
    if (isNaN(d.getTime())) return selectedDay;
    return d.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
  })();

  return (
    <div className="rounded-md border overflow-hidden" style={{ borderColor: "#1F2224", background: "#0A0A0A" }}>
      <div
        className="flex items-center justify-between px-3 py-2 border-b gap-2"
        style={{ borderColor: "#1F2224", background: "#0F1113" }}
      >
        <button
          onClick={() => shiftMonth(-1)}
          className="p-1 rounded hover:bg-white/[0.05] text-muted-foreground"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-[12px] font-semibold text-foreground uppercase tracking-widest truncate">
            {monthLabel}
          </div>
          {allWeeksPast && (
            <button
              onClick={allExpanded ? collapseAll : expandAll}
              className="text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded border hover:bg-white/[0.05] text-muted-foreground shrink-0"
              style={{ borderColor: "#1F2224" }}
            >
              {allExpanded ? "Collapse all" : "Expand all"}
            </button>
          )}
        </div>
        <button
          onClick={() => shiftMonth(1)}
          className="p-1 rounded hover:bg-white/[0.05] text-muted-foreground"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {dated.length === 0 && !allWeeksPast ? (
        <div className="p-8 text-center text-[11.5px] font-mono text-muted-foreground">
          No dated tasks this month.
        </div>
      ) : (
        <>
          <div
            className="grid grid-cols-7 text-[9.5px] font-mono uppercase tracking-widest text-muted-foreground border-b"
            style={{ borderColor: "#1F2224", background: "#0F1113" }}
          >
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="px-2 py-1.5 text-center">{d}</div>
            ))}
          </div>
          <div>
            {weeks.map((wk, wIdx) => {
              const past = isPastWeek(wk);
              const collapsed = past && !expandedWeeks.has(wIdx);

              if (collapsed) {
                const count = weekTaskCount(wk);
                return (
                  <button
                    key={`w-${wIdx}`}
                    onClick={() => toggleWeek(wIdx)}
                    className="w-full flex items-center justify-between px-3 py-2 border-b text-left hover:bg-white/[0.03] transition-colors"
                    style={{ borderColor: "#131418", background: "#0A0B0D", minHeight: 32 }}
                    aria-expanded={false}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <ChevronRight className="h-3 w-3 shrink-0" style={{ color: "rgba(229,233,234,0.4)" }} />
                      <span className="text-[10.5px] font-mono truncate" style={{ color: "rgba(229,233,234,0.55)" }}>
                        {formatRange(wk)}
                      </span>
                    </span>
                    <span className="text-[10px] font-mono shrink-0" style={{ color: "rgba(229,233,234,0.4)" }}>
                      {count === 0 ? "no tasks" : count === 1 ? "1 task" : `${count} tasks`}
                    </span>
                  </button>
                );
              }

              // Expanded (or non-past) week: 7 day cells
              return (
                <div key={`w-${wIdx}`} className="grid grid-cols-7 relative">
                  {past && (
                    <button
                      onClick={() => toggleWeek(wIdx)}
                      className="absolute top-0.5 right-0.5 z-10 text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded hover:bg-white/[0.06]"
                      style={{ color: "rgba(229,233,234,0.35)" }}
                      title="Collapse week"
                    >
                      collapse
                    </button>
                  )}
                  {wk.map((c, i) => {
                    if (!c.day || !c.iso) {
                      return (
                        <div
                          key={i}
                          className={cn("border-r border-b", isMobile ? "min-h-[44px]" : "min-h-[92px]")}
                          style={{ borderColor: "#131418", background: "#08080A" }}
                        />
                      );
                    }
                    const dayTasks = tasksByDay[c.iso] ?? [];
                    const isToday = c.iso === todayIso;
                    const isSelected = isMobile && c.iso === selectedDay;
                    const isExpanded = expanded === c.iso;
                    const shown = isExpanded ? dayTasks : dayTasks.slice(0, 3);
                    const more = dayTasks.length - shown.length;

                    if (isMobile) {
                      // Marker-only cell: date + dot, no chips
                      return (
                        <button
                          key={i}
                          onClick={() => setSelectedDay(c.iso!)}
                          className={cn(
                            "border-r border-b p-1.5 flex flex-col items-center justify-start gap-1 min-w-0 text-left",
                          )}
                          style={{
                            borderColor: "#131418",
                            background: isSelected
                              ? "rgba(61,137,218,0.14)"
                              : isToday
                                ? "rgba(61,137,218,0.05)"
                                : "transparent",
                            outline: isSelected
                              ? "1px solid #3D89DA"
                              : isToday
                                ? "1px solid rgba(61,137,218,0.5)"
                                : undefined,
                            outlineOffset: "-1px",
                            minHeight: 44,
                          }}
                          aria-pressed={isSelected}
                        >
                          <span
                            className="text-[11px] font-mono"
                            style={{ color: isToday ? "#3D89DA" : isSelected ? "#3D89DA" : "rgba(229,233,234,0.65)" }}
                          >
                            {c.day}
                          </span>
                          {dayTasks.length > 0 && (
                            <span
                              className="rounded-full"
                              style={{
                                width: 6,
                                height: 6,
                                background: dayTasks.some((t) => t.status !== "done" && daysUntil(t.end_date) !== null && daysUntil(t.end_date)! < 0)
                                  ? "#E24B4A"
                                  : dayTasks.every((t) => t.status === "done")
                                    ? "#22C55E"
                                    : "#3D89DA",
                              }}
                            />
                          )}
                        </button>
                      );
                    }

                    // Desktop: chips with names (unchanged)
                    return (
                      <div
                        key={i}
                        className="border-r border-b p-1.5 space-y-1 min-w-0 min-h-[92px]"
                        style={{
                          borderColor: "#131418",
                          background: isToday ? "rgba(61,137,218,0.05)" : "transparent",
                          outline: isToday ? "1px solid #3D89DA" : undefined,
                          outlineOffset: "-1px",
                        }}
                      >
                        <div
                          className="text-[10px] font-mono"
                          style={{ color: isToday ? "#3D89DA" : "rgba(229,233,234,0.5)" }}
                        >
                          {c.day}
                        </div>
                        {shown.map((t) => {
                          const done = t.status === "done";
                          const d = daysUntil(t.end_date);
                          const overdue = !done && d !== null && d < 0;
                          const bg = done
                            ? "rgba(34,197,94,0.12)"
                            : overdue
                              ? "rgba(226,75,74,0.14)"
                              : "rgba(61,137,218,0.12)";
                          const fg = done ? "#22C55E" : overdue ? "#E24B4A" : "#3D89DA";
                          return (
                            <button
                              key={t.id}
                              onClick={(e) => { e.stopPropagation(); onOpen(t.id); }}
                              className="w-full text-left text-[9.5px] font-mono truncate rounded-sm px-1.5 py-0.5"
                              style={{ background: bg, color: fg }}
                              title={t.name}
                            >
                              {t.name}
                            </button>
                          );
                        })}
                        {more > 0 && !isExpanded && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setExpanded(c.iso); }}
                            className="text-[9.5px] font-mono text-muted-foreground/70 hover:text-foreground"
                          >
                            +{more} more
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {isMobile && (
            <div className="border-t" style={{ borderColor: "#1F2224", background: "#0A0B0D" }}>
              <div
                className="px-3 py-2 border-b text-[11px] font-semibold uppercase tracking-widest text-foreground"
                style={{ borderColor: "#1F2224", background: "#0F1113" }}
              >
                {selectedDateLabel}
              </div>
              {selectedTasks.length === 0 ? (
                <div className="px-3 py-4 text-[11.5px] font-mono text-muted-foreground">
                  No tasks on this day.
                </div>
              ) : (
                <ul className="divide-y" style={{ borderColor: "#131418" }}>
                  {selectedTasks.map((t) => {
                    const done = t.status === "done";
                    const d = daysUntil(t.end_date);
                    const overdue = !done && d !== null && d < 0;
                    const fg = done ? "#22C55E" : overdue ? "#E24B4A" : "#3D89DA";
                    const bg = done
                      ? "rgba(34,197,94,0.12)"
                      : overdue
                        ? "rgba(226,75,74,0.14)"
                        : "rgba(61,137,218,0.12)";
                    return (
                      <li key={t.id} style={{ borderColor: "#131418" }}>
                        <button
                          onClick={() => onOpen(t.id)}
                          className="w-full text-left px-3 py-2 flex items-start gap-3 hover:bg-white/[0.03]"
                          style={{ minHeight: 44 }}
                        >
                          <span
                            className="mt-0.5 h-2 w-2 rounded-full shrink-0"
                            style={{ background: fg }}
                          />
                          <span className="flex-1 min-w-0">
                            <span
                              className={cn(
                                "block text-[12px] leading-snug break-words",
                                done ? "line-through text-muted-foreground" : "text-foreground/90",
                              )}
                            >
                              {t.name}
                            </span>
                          </span>
                          <span
                            className="text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded-sm shrink-0"
                            style={{ color: fg, background: bg }}
                          >
                            {done ? "Done" : overdue ? "Overdue" : "Open"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* Table view removed. */
