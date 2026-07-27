import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task, TaskList as TL } from "@/hooks/useTasks";
import type { ProfileLite } from "@/hooks/useProfiles";
import { formatDateShort, daysUntil } from "@/lib/projects/dateRules";
import { COLUMN_DEFS, type ColumnKey } from "./columns";

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

  const [expanded, setExpanded] = useState<string | null>(null);

  const shiftMonth = (delta: number) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  return (
    <div className="rounded-md border overflow-hidden" style={{ borderColor: "#1F2224", background: "#0A0A0A" }}>
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: "#1F2224", background: "#0F1113" }}
      >
        <button
          onClick={() => shiftMonth(-1)}
          className="p-1 rounded hover:bg-white/[0.05] text-muted-foreground"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-[12px] font-semibold text-foreground uppercase tracking-widest">
          {monthLabel}
        </div>
        <button
          onClick={() => shiftMonth(1)}
          className="p-1 rounded hover:bg-white/[0.05] text-muted-foreground"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {dated.length === 0 ? (
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
          <div className="grid grid-cols-7">
            {cells.map((c, i) => {
              if (!c.day || !c.iso) {
                return <div key={i} className="min-h-[92px] border-r border-b" style={{ borderColor: "#131418", background: "#08080A" }} />;
              }
              const dayTasks = tasksByDay[c.iso] ?? [];
              const isToday = c.iso === todayIso;
              const isExpanded = expanded === c.iso;
              const shown = isExpanded ? dayTasks : dayTasks.slice(0, 3);
              const more = dayTasks.length - shown.length;
              return (
                <div
                  key={i}
                  className="min-h-[92px] border-r border-b p-1.5 space-y-1 min-w-0"
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
                        onClick={() => onOpen(t.id)}
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
                      onClick={() => setExpanded(c.iso)}
                      className="text-[9.5px] font-mono text-muted-foreground/70 hover:text-foreground"
                    >
                      +{more} more
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ────────────────────────── TABLE ────────────────────────── */

type SortKey = "name" | "list" | "status" | "start_date" | "end_date" | "assignee";

export function TableView({
  lists,
  tasks,
  profiles,
  columns,
  onOpen,
}: CommonProps & { columns: ColumnKey[] }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);

  const listName = useMemo(() => {
    const m: Record<string, string> = {};
    for (const l of lists) m[l.id] = l.name;
    return m;
  }, [lists]);
  const parentName = useMemo(() => {
    const m: Record<string, string> = {};
    for (const t of tasks) m[t.id] = t.name;
    return m;
  }, [tasks]);
  const profileName = (id: string | null) => {
    if (!id) return "";
    return profiles.find((p) => p.id === id)?.full_name ?? "";
  };

  // Preserve template order by default: sort by list position, then task position, then parent-first.
  const listOrder = useMemo(() => {
    const m: Record<string, number> = {};
    lists.forEach((l, i) => (m[l.id] = i));
    return m;
  }, [lists]);

  const rows = useMemo(() => {
    const arr = [...tasks];
    if (!sort) {
      arr.sort((a, b) => {
        const la = listOrder[a.list_id] ?? 999;
        const lb = listOrder[b.list_id] ?? 999;
        if (la !== lb) return la - lb;
        // Parents first, then their subs in position order
        const pa = a.parent_id ?? a.id;
        const pb = b.parent_id ?? b.id;
        if (pa !== pb) return (a.position ?? 0) - (b.position ?? 0);
        // same parent group
        if (!a.parent_id && b.parent_id) return -1;
        if (a.parent_id && !b.parent_id) return 1;
        return (a.position ?? 0) - (b.position ?? 0);
      });
      return arr;
    }
    const dir = sort.dir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      switch (sort.key) {
        case "name":
          av = a.name.toLowerCase();
          bv = b.name.toLowerCase();
          break;
        case "list":
          av = listName[a.list_id] ?? "";
          bv = listName[b.list_id] ?? "";
          break;
        case "status":
          av = a.status;
          bv = b.status;
          break;
        case "start_date":
          av = a.start_date ?? "";
          bv = b.start_date ?? "";
          break;
        case "end_date":
          av = a.end_date ?? "";
          bv = b.end_date ?? "";
          break;
        case "assignee":
          av = profileName(a.assignee_id).toLowerCase();
          bv = profileName(b.assignee_id).toLowerCase();
          break;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, sort, listOrder, listName]);

  const toggleSort = (key: SortKey) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  };

  const H = ({ label, k }: { label: string; k?: SortKey }) => (
    <th
      onClick={k ? () => toggleSort(k) : undefined}
      className={cn(
        "text-left font-mono uppercase tracking-widest text-[9.5px] text-muted-foreground px-2.5 py-2 whitespace-nowrap select-none",
        k && "cursor-pointer hover:text-foreground",
      )}
      style={{ background: "#0F1113", borderBottom: "1px solid #1F2224" }}
    >
      {label}
      {k && sort?.key === k && <span className="ml-1 opacity-60">{sort.dir === "asc" ? "↑" : "↓"}</span>}
    </th>
  );

  const showCol = (k: ColumnKey) => columns.includes(k) || k === "name" || k === "status";

  return (
    <div
      className="rounded-md border overflow-hidden"
      style={{ borderColor: "#1F2224", background: "#0A0A0A" }}
    >
      <div className="overflow-x-auto max-w-full">
        <table className="w-full text-[11.5px] border-collapse min-w-[720px]">
          <thead>
            <tr>
              <th
                className="sticky left-0 z-10 text-left font-mono uppercase tracking-widest text-[9.5px] text-muted-foreground px-2.5 py-2 whitespace-nowrap select-none cursor-pointer hover:text-foreground"
                style={{ background: "#0F1113", borderBottom: "1px solid #1F2224", minWidth: 260 }}
                onClick={() => toggleSort("name")}
              >
                {COLUMN_DEFS.name.label}
                {sort?.key === "name" && (
                  <span className="ml-1 opacity-60">{sort.dir === "asc" ? "↑" : "↓"}</span>
                )}
              </th>
              <H label="List" k="list" />
              {showCol("status") && <H label="Status" k="status" />}
              {showCol("start") && <H label="Start" k="start_date" />}
              {showCol("due") && <H label="Due" k="end_date" />}
              {showCol("assignee") && <H label="Assignee" k="assignee" />}
              {showCol("comments") && <H label="💬" />}
              {showCol("files") && <H label="📎" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const done = t.status === "done";
              const parentPrefix = t.parent_id ? parentName[t.parent_id] : null;
              const d = daysUntil(t.end_date);
              const overdue = !done && t.end_date && d !== null && d < 0;
              const soon = !done && !overdue && t.end_date && d !== null && d >= 0 && d <= 7;
              const dueColor = !t.end_date
                ? "#4B5058"
                : done
                  ? "#B0B8BF"
                  : overdue
                    ? "#E24B4A"
                    : soon
                      ? "#BA7517"
                      : "#E5E9EA";
              return (
                <tr
                  key={t.id}
                  onClick={() => onOpen(t.id)}
                  className="cursor-pointer hover:bg-[#16161A]"
                  style={{ borderBottom: "1px solid #131418" }}
                >
                  <td
                    className="sticky left-0 z-10 px-2.5 py-2 min-w-0"
                    style={{ background: "#0A0A0A", maxWidth: 360 }}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ background: done ? "#22C55E" : "#3A3A42" }}
                      />
                      <span className="min-w-0 truncate" title={`${parentPrefix ? parentPrefix + " › " : ""}${t.name}`}>
                        {parentPrefix && (
                          <span className="text-muted-foreground/60">{parentPrefix} › </span>
                        )}
                        <span className={done ? "line-through text-muted-foreground" : "text-foreground/90"}>
                          {t.name}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className="px-2.5 py-2 font-mono text-[10.5px] text-muted-foreground whitespace-nowrap">
                    {listName[t.list_id] ?? "—"}
                  </td>
                  {showCol("status") && (
                    <td className="px-2.5 py-2">
                      <span
                        className="text-[9.5px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-sm"
                        style={
                          done
                            ? { color: "#22C55E", background: "rgba(34,197,94,.12)" }
                            : { color: "#5C5C65", background: "#1D1D22" }
                        }
                      >
                        {done ? "Done" : "Open"}
                      </span>
                    </td>
                  )}
                  {showCol("start") && (
                    <td className="px-2.5 py-2 font-mono text-[10.5px] whitespace-nowrap" style={{ color: "#B0B8BF" }}>
                      {t.start_date ? formatDateShort(t.start_date) : "—"}
                    </td>
                  )}
                  {showCol("due") && (
                    <td className="px-2.5 py-2 font-mono text-[10.5px] whitespace-nowrap" style={{ color: dueColor }}>
                      {t.end_date ? formatDateShort(t.end_date) : "—"}
                    </td>
                  )}
                  {showCol("assignee") && (
                    <td className="px-2.5 py-2 font-mono text-[10.5px] text-muted-foreground truncate max-w-[140px]">
                      {profileName(t.assignee_id) || "—"}
                    </td>
                  )}
                  {showCol("comments") && (
                    <td className="px-2.5 py-2 font-mono text-[10.5px] text-muted-foreground/70 text-center" />
                  )}
                  {showCol("files") && (
                    <td className="px-2.5 py-2 font-mono text-[10.5px] text-muted-foreground/70 text-center" />
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
