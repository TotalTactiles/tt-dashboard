import { useMemo, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { Task } from "@/hooks/useTasks";

interface Props {
  tasks: Task[];
  projectStart: string | null;
  projectEnd: string | null;
  estStart: string | null;
  onTaskClick: (id: string) => void;
}

const DAY_MS = 86_400_000;
const DAY_WIDTH = 26;
const ROW_HEIGHT = 22;

export function CalendarStrip({
  tasks,
  projectStart,
  projectEnd,
  estStart,
  onTaskClick,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const range = useMemo(() => {
    const candidates: number[] = [];
    for (const t of tasks) {
      if (t.start_date) candidates.push(new Date(t.start_date).getTime());
      if (t.end_date) candidates.push(new Date(t.end_date).getTime());
    }
    if (projectStart) candidates.push(new Date(projectStart).getTime());
    if (projectEnd) candidates.push(new Date(projectEnd).getTime());
    if (estStart) candidates.push(new Date(estStart).getTime());

    let min: number, max: number;
    if (candidates.length === 0) {
      const now = Date.now();
      min = now - 30 * DAY_MS;
      max = now + 60 * DAY_MS;
    } else {
      min = Math.min(...candidates) - 7 * DAY_MS;
      max = Math.max(...candidates) + 7 * DAY_MS;
    }
    // Snap to midnight
    const start = new Date(min);
    start.setHours(0, 0, 0, 0);
    const end = new Date(max);
    end.setHours(0, 0, 0, 0);
    const days = Math.max(30, Math.ceil((end.getTime() - start.getTime()) / DAY_MS));
    return { start, days };
  }, [tasks, projectStart, projectEnd, estStart]);

  const rows = useMemo(() => tasks.filter((t) => t.start_date), [tasks]);
  const totalWidth = range.days * DAY_WIDTH;

  // Auto-scroll to today
  useEffect(() => {
    if (!scrollRef.current) return;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const offset = (now.getTime() - range.start.getTime()) / DAY_MS;
    scrollRef.current.scrollLeft = Math.max(0, offset * DAY_WIDTH - 200);
  }, [range]);

  const todayOffset = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return ((now.getTime() - range.start.getTime()) / DAY_MS) * DAY_WIDTH;
  }, [range]);

  const dayLabels = useMemo(() => {
    const items: Array<{ label: string; monthLabel: string | null; offset: number }> = [];
    for (let i = 0; i < range.days; i++) {
      const d = new Date(range.start.getTime() + i * DAY_MS);
      const isMonthStart = d.getDate() === 1 || i === 0;
      items.push({
        label: String(d.getDate()),
        monthLabel: isMonthStart
          ? d.toLocaleDateString("en-AU", { month: "short", year: "2-digit" })
          : null,
        offset: i * DAY_WIDTH,
      });
    }
    return items;
  }, [range]);

  return (
    <div
      className="border-b"
      style={{ borderColor: "#1F2224", background: "#0A0A0A" }}
    >
      <div className="flex items-center justify-between px-6 pt-3 pb-2">
        <span className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground">
          Timeline · {rows.length} scheduled
        </span>
      </div>
      <div ref={scrollRef} className="overflow-x-auto pb-3">
        <div className="relative" style={{ width: totalWidth, minWidth: "100%" }}>
          {/* Month row + day labels */}
          <div className="relative h-9 border-b" style={{ borderColor: "#1F2224" }}>
            {dayLabels.map((d, i) => (
              <div
                key={i}
                className="absolute top-0 h-full border-l text-[9px] font-mono text-muted-foreground/70 pl-1 pt-0.5"
                style={{
                  left: d.offset,
                  width: DAY_WIDTH,
                  borderColor: d.monthLabel ? "#2A2D30" : "#141618",
                }}
              >
                {d.monthLabel && (
                  <div
                    className="absolute -top-0.5 left-1 text-[9px] font-mono uppercase tracking-widest"
                    style={{ color: "#B0B8BF" }}
                  >
                    {d.monthLabel}
                  </div>
                )}
                <span className="block mt-3">{d.label}</span>
              </div>
            ))}

            {/* Today marker */}
            {todayOffset >= 0 && todayOffset <= totalWidth && (
              <div
                className="absolute top-0 bottom-0 z-10 pointer-events-none"
                style={{
                  left: todayOffset,
                  width: 1,
                  background: "#F59E0B",
                }}
              />
            )}
          </div>

          {/* Task bars */}
          <div className="relative" style={{ height: Math.max(60, rows.length * ROW_HEIGHT + 8) }}>
            {rows.map((t, idx) => {
              const s = new Date(t.start_date!).getTime();
              const e = t.end_date ? new Date(t.end_date).getTime() : s;
              const left = ((s - range.start.getTime()) / DAY_MS) * DAY_WIDTH;
              const width = Math.max(DAY_WIDTH, ((e - s) / DAY_MS + 1) * DAY_WIDTH - 2);
              const done = t.status === "done";
              return (
                <button
                  key={t.id}
                  onClick={() => onTaskClick(t.id)}
                  className={cn(
                    "absolute rounded-sm text-[10.5px] font-medium truncate px-1.5 flex items-center hover:brightness-110 transition-all",
                  )}
                  title={t.name}
                  style={{
                    top: 4 + idx * ROW_HEIGHT,
                    left,
                    width,
                    height: ROW_HEIGHT - 4,
                    background: done ? "#22C55E33" : "#3D89DA33",
                    color: done ? "#22C55E" : "#B4D5F4",
                    borderLeft: `2px solid ${done ? "#22C55E" : "#3D89DA"}`,
                  }}
                >
                  {t.name}
                </button>
              );
            })}
            {rows.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                No scheduled tasks.
              </div>
            )}

            {/* Today line through bar area */}
            {todayOffset >= 0 && todayOffset <= totalWidth && (
              <div
                className="absolute top-0 bottom-0 z-0 pointer-events-none"
                style={{
                  left: todayOffset,
                  width: 1,
                  background: "#F59E0B44",
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
