import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Anchor, ChevronDown } from "lucide-react";
import type { Task } from "@/hooks/useTasks";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIsPmMobile } from "@/hooks/useProjects";


const db = supabase as any;

interface Props {
  tasks: Task[];
  projectStart: string | null;
  projectEnd: string | null;
  estStart: string | null;
  onTaskClick: (id: string) => void;
  onPatch?: (id: string, patch: Partial<Task>) => void;
}

const DAY_MS = 86_400_000;
const DAY_WIDTH = 26;
const ROW_HEIGHT = 22;

function toISODate(ms: number) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDay(s: string) {
  const d = new Date(s + (s.length === 10 ? "T00:00:00" : ""));
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

interface DragState {
  taskId: string;
  originStart: number;
  originEnd: number;
  duration: number;
  pointerStartX: number;
  deltaDays: number;
  moved: boolean;
  pointerId: number;
}

export function CalendarStrip({
  tasks,
  projectStart,
  projectEnd,
  estStart,
  onTaskClick,
  onPatch,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const prefersReducedMotion = useRef(false);
  const isMobile = useIsPmMobile();
  const [mobileCollapsed, setMobileCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("tt.projects.timeline.collapsed") === "1";
    } catch {
      return false;
    }
  });
  const setMobileCollapsedPersist = (v: boolean) => {
    setMobileCollapsed(v);
    try {
      localStorage.setItem("tt.projects.timeline.collapsed", v ? "1" : "0");
    } catch {}
  };


  useEffect(() => {
    prefersReducedMotion.current = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches ?? false;
  }, []);

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
      min = Math.min(...candidates) - 21 * DAY_MS;
      max = Math.max(...candidates) + 21 * DAY_MS;
    }
    const start = new Date(min);
    start.setHours(0, 0, 0, 0);
    const end = new Date(max);
    end.setHours(0, 0, 0, 0);
    const days = Math.max(30, Math.ceil((end.getTime() - start.getTime()) / DAY_MS));
    return { start, days };
  }, [tasks, projectStart, projectEnd, estStart]);

  const rows = useMemo(() => tasks.filter((t) => t.start_date), [tasks]);
  const totalWidth = range.days * DAY_WIDTH;

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

  const commitDrag = useCallback(
    async (task: Task, deltaDays: number) => {
      if (!task.start_date || deltaDays === 0) return;
      const s = parseDay(task.start_date);
      const e = task.end_date ? parseDay(task.end_date) : s;
      const newStart = toISODate(s + deltaDays * DAY_MS);
      const newEnd = toISODate(e + deltaDays * DAY_MS);
      const patch: Partial<Task> = {
        start_date: newStart,
        end_date: newEnd,
        date_manual: true,
      };
      // Optimistic through onPatch
      onPatch?.(task.id, patch);
      const { error } = await db.from("tasks").update(patch).eq("id", task.id);
      if (error) {
        // Snap back
        onPatch?.(task.id, {
          start_date: task.start_date,
          end_date: task.end_date,
          date_manual: task.date_manual,
        });
        toast.error("Couldn't reschedule task — reverted");
      }
    },
    [onPatch],
  );

  const onPointerDown = (e: React.PointerEvent, task: Task) => {
    if (!task.start_date || !onPatch) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const s = parseDay(task.start_date);
    const en = task.end_date ? parseDay(task.end_date) : s;
    setDrag({
      taskId: task.id,
      originStart: s,
      originEnd: en,
      duration: (en - s) / DAY_MS,
      pointerStartX: e.clientX,
      deltaDays: 0,
      moved: false,
      pointerId: e.pointerId,
    });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dx = e.clientX - drag.pointerStartX;
    const days = Math.round(dx / DAY_WIDTH);
    if (days !== drag.deltaDays || (!drag.moved && Math.abs(dx) > 3)) {
      setDrag({ ...drag, deltaDays: days, moved: drag.moved || Math.abs(dx) > 3 });
    }
    // Auto-scroll near edges
    const el = scrollRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      if (e.clientX > rect.right - 40) el.scrollLeft += 8;
      else if (e.clientX < rect.left + 40) el.scrollLeft -= 8;
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const task = rows.find((t) => t.id === drag.taskId);
    const moved = drag.moved && drag.deltaDays !== 0;
    if (task && moved) {
      commitDrag(task, drag.deltaDays);
    }
    setDrag(null);
  };

  const onPointerCancel = () => setDrag(null);

  const dragEnabled = !!onPatch && !isMobile;

  if (isMobile && mobileCollapsed) {
    return (
      <div
        className="border-b select-none"
        style={{ borderColor: "#1F2224", background: "#0A0A0A" }}
      >
        <button
          onClick={() => setMobileCollapsedPersist(false)}
          className="w-full flex items-center gap-2 px-3 py-3 min-h-[44px]"
        >
          <span className="text-[10px] font-mono tracking-[0.9px] uppercase" style={{ color: "rgba(229,233,234,0.45)" }}>
            Timeline
          </span>
          <span className="text-[10px] font-mono" style={{ color: "rgba(229,233,234,0.28)" }}>
            · {rows.length} scheduled
          </span>
          <ChevronDown className="ml-auto h-3.5 w-3.5 text-muted-foreground/60 transition-transform" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="border-b select-none overflow-hidden"
      style={{
        borderColor: "#1F2224",
        background: "#0A0A0A",
      }}
    >
      <div className={cn("flex items-center justify-between pt-3 pb-2", isMobile ? "px-3" : "px-6")}>
        {isMobile ? (
          <button
            onClick={() => setMobileCollapsedPersist(true)}
            className="flex items-center gap-2 text-[10px] font-mono tracking-[0.9px] uppercase text-muted-foreground"
          >
            Timeline · {rows.length} scheduled
            <ChevronDown className="h-3.5 w-3.5 rotate-180 transition-transform" />
          </button>
        ) : (
          <span className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground">
            Timeline · {rows.length} scheduled
          </span>
        )}
        {drag && drag.moved && (
          <span className="text-[10px] font-mono tracking-widest text-[#3D89DA]">
            {drag.deltaDays === 0
              ? "no change"
              : `${drag.deltaDays > 0 ? "+" : ""}${drag.deltaDays}d`}
          </span>
        )}

      </div>
      <div ref={scrollRef} className="overflow-x-auto pb-3">
        <div className="relative" style={{ width: totalWidth, minWidth: "100%" }}>
          {/* Month row + day labels */}
          <div className="relative h-9 border-b" style={{ borderColor: "#1F2224", position: isMobile ? "sticky" : "relative", top: 0, background: isMobile ? "#0A0A0A" : undefined, zIndex: isMobile ? 5 : undefined }}>
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
              const s = parseDay(t.start_date!);
              const e = t.end_date ? parseDay(t.end_date) : s;
              const isDragging = drag?.taskId === t.id;
              const deltaMs = isDragging ? drag!.deltaDays * DAY_MS : 0;
              const left = ((s + deltaMs - range.start.getTime()) / DAY_MS) * DAY_WIDTH;
              const width = Math.max(DAY_WIDTH, ((e - s) / DAY_MS + 1) * DAY_WIDTH - 2);
              const done = t.status === "done";
              const draggable = dragEnabled;
              return (
                <button
                  key={t.id}
                  onPointerDown={draggable ? (ev) => onPointerDown(ev, t) : undefined}
                  onPointerMove={draggable ? onPointerMove : undefined}
                  onPointerUp={draggable ? onPointerUp : undefined}
                  onPointerCancel={draggable ? onPointerCancel : undefined}
                  onClick={(ev) => {
                    if (drag && drag.moved) {
                      ev.preventDefault();
                      ev.stopPropagation();
                      return;
                    }
                    onTaskClick(t.id);
                  }}
                  className={cn(
                    "absolute rounded-sm text-[10.5px] font-medium truncate px-1.5 flex items-center gap-1 hover:brightness-110",
                    !prefersReducedMotion.current && "transition-[left,box-shadow,transform] duration-100",
                    draggable && "cursor-grab active:cursor-grabbing touch-none",
                    isDragging && "z-20",
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
                    boxShadow: isDragging
                      ? "0 6px 18px rgba(0,0,0,.55), 0 0 0 1px #3D89DA"
                      : undefined,
                    transform: isDragging && !prefersReducedMotion.current ? "scale(1.04)" : undefined,
                  }}
                >
                  {t.date_manual && (
                    <Anchor className="h-2.5 w-2.5 shrink-0" style={{ color: "#F59E0B" }} />
                  )}
                  <span className="truncate">{t.name}</span>
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
