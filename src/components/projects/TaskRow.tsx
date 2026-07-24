import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, GripVertical, Lock, Anchor, MoreHorizontal } from "lucide-react";
import type { Task } from "@/hooks/useTasks";
import type { ProfileLite } from "@/hooks/useProfiles";
import { DATE_RULE_SHORT, formatDateShort, daysUntil } from "@/lib/projects/dateRules";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { buildRowGrid, COLUMN_DEFS, type ColumnKey } from "./columns";

const db = supabase as any;

interface Project {
  estimated_start: string | null;
  project_start: string | null;
  project_end: string | null;
}

interface Props {
  task: Task;
  depth: number;
  columns: ColumnKey[];
  profiles: ProfileLite[];
  listName?: string;
  project: Project | null;
  onOpen: (id: string) => void;
  onToggle: (task: Task) => void;
  onPatch: (id: string, patch: Partial<Task>) => void;
  childCounts?: { total: number; done: number };
  expanded?: boolean;
  onToggleExpand?: () => void;
}

/** Build the grid template columns string from the ordered visible column set. */
export function rowGridFor(cols: ColumnKey[]) {
  return buildRowGrid(cols);
}

export function TaskRow({
  task,
  depth,
  columns,
  profiles,
  listName,
  project,
  onOpen,
  onToggle,
  onPatch,
  childCounts,
  expanded,
  onToggleExpand,
}: Props) {
  const done = task.status === "done";
  const gridTemplate = useMemo(() => buildRowGrid(columns), [columns]);
  const isSub = depth > 0;
  const indent = depth * 28;

  // Subtle background layer for subtasks + vertical guide line at the parent's indent depth.
  const baseBg = done ? "rgba(34,197,94,0.03)" : isSub ? "rgba(0,0,0,0.16)" : "transparent";
  const guideOffset = isSub ? (depth - 1) * 28 + 14 : 0;
  const bg = isSub
    ? `linear-gradient(#26262C, #26262C) ${guideOffset}px 0 / 1px 100% no-repeat, ${baseBg}`
    : baseBg;

  return (
    <div
      className="group grid items-center text-[12.5px] transition-colors hover:bg-[#16161A] cursor-pointer border-b"
      style={{
        gridTemplateColumns: gridTemplate,
        height: 40,
        borderColor: "#131418",
        background: bg,
        paddingLeft: indent,
      }}
      onClick={() => onOpen(task.id)}
    >
      {/* drag handle */}
      <div className="flex items-center justify-center text-muted-foreground/40 opacity-0 group-hover:opacity-100">
        <GripVertical className="h-3.5 w-3.5" />
      </div>

      {/* checkbox */}
      <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => onToggle(task)}
          className="h-4 w-4 rounded-[3px] border flex items-center justify-center transition-colors"
          style={{
            borderColor: done ? "#22C55E" : "#3A3A42",
            background: done ? "#22C55E" : "transparent",
          }}
          aria-label={done ? "Reopen" : "Complete"}
        >
          {done && (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M2 5.2 L4.2 7.4 L8 3" stroke="#0A0A0A" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>

      {columns.map((k) => (
        <Cell
          key={k}
          k={k}
          task={task}
          depth={depth}
          done={done}
          profiles={profiles}
          listName={listName}
          project={project}
          onPatch={onPatch}
          childCounts={childCounts}
          expanded={expanded}
          onToggleExpand={onToggleExpand}
        />
      ))}

      {/* overflow / more */}
      <div className="flex items-center justify-center text-muted-foreground/30 opacity-0 group-hover:opacity-100">
        <MoreHorizontal className="h-3.5 w-3.5" />
      </div>
    </div>
  );
}

function Cell({
  k,
  task,
  depth,
  done,
  profiles,
  listName,
  project,
  onPatch,
  childCounts,
}: {
  k: ColumnKey;
  task: Task;
  depth: number;
  done: boolean;
  profiles: ProfileLite[];
  listName?: string;
  project: Project | null;
  onPatch: (id: string, patch: Partial<Task>) => void;
  childCounts?: { total: number; done: number };
}) {
  switch (k) {
    case "name":
      return (
        <div className="min-w-0 flex items-center gap-2 px-1 pr-3" style={{ paddingLeft: depth * 20 }}>
          {childCounts && childCounts.total > 0 && (
            <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
          )}
          {task.product_code && (
            <span
              className="text-[10.5px] font-mono uppercase tracking-wider shrink-0"
              style={{ color: "#3D89DA" }}
            >
              {task.product_code}
            </span>
          )}
          <span
            className={cn("truncate", done ? "line-through text-muted-foreground" : "text-foreground/90")}
          >
            {task.name}
          </span>
          {task.office_only && (
            <span className="text-[9.5px] font-mono uppercase tracking-wider inline-flex items-center gap-1 shrink-0 px-1 py-0.5 rounded-sm"
              style={{ background: "#7C5BC722", color: "#B9A5E5" }}>
              <Lock className="h-2.5 w-2.5" /> office
            </span>
          )}
          {childCounts && childCounts.total > 0 && (
            <span className="text-[10px] font-mono text-muted-foreground shrink-0">
              {childCounts.done}/{childCounts.total}
            </span>
          )}
        </div>
      );
    case "status":
      return (
        <div className="px-2" onClick={(e) => e.stopPropagation()}>
          <StatusPill task={task} onChange={(s) => onPatch(task.id, { status: s })} />
        </div>
      );
    case "assignee":
      return (
        <div className="px-2" onClick={(e) => e.stopPropagation()}>
          <AssigneeCell task={task} profiles={profiles} onChange={(id) => onPatch(task.id, { assignee_id: id })} />
        </div>
      );
    case "start":
      return (
        <DateColumn task={task} field="start_date" project={project} onPatch={onPatch} showCount={false} />
      );
    case "due":
      return (
        <DateColumn task={task} field="end_date" project={project} onPatch={onPatch} showCount={true} />
      );
    case "table":
      return (
        <div className="px-2">
          {task.calc_table ? (
            <span
              className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-sm"
              style={{ background: "#3D89DA22", color: "#3D89DA" }}
            >
              {task.calc_table.replace(/_/g, " ")}
            </span>
          ) : (
            <span className="text-muted-foreground/30">—</span>
          )}
        </div>
      );
    case "rule":
      return (
        <div className="px-2 text-[10.5px] font-mono text-muted-foreground truncate">
          {DATE_RULE_SHORT[task.rule]}
        </div>
      );
    case "product_code":
      return (
        <div className="px-2 text-[10.5px] font-mono truncate" style={{ color: task.product_code ? "#3D89DA" : "#4B5058" }}>
          {task.product_code ?? "—"}
        </div>
      );
    case "list":
      return (
        <div className="px-2 text-[10.5px] font-mono text-muted-foreground truncate">
          {listName ?? "—"}
        </div>
      );
    case "comments":
      return <CommentAttachmentCount taskId={task.id} kind="comments" />;
    case "files":
      return <CommentAttachmentCount taskId={task.id} kind="attachments" />;
    default:
      return null;
  }
}

/* ---------------- Date column wrapper (measures width for count vs tooltip) ---------------- */

function DateColumn({
  task,
  field,
  project,
  onPatch,
  showCount,
}: {
  task: Task;
  field: "start_date" | "end_date";
  project: Project | null;
  onPatch: (id: string, patch: Partial<Task>) => void;
  showCount: boolean;
}) {
  const value = task[field];
  const done = task.status === "done";
  const dayD = daysUntil(value);
  const isDate = value !== null && value !== undefined && value !== "";
  const overdue = !done && isDate && dayD !== null && dayD < 0;
  // For start col overdue means: start date passed and task still open.
  // For due col overdue means: due date passed and task still open.
  const soon = !done && !overdue && isDate && dayD !== null && dayD >= 0 && dayD <= 7;

  const color = !isDate
    ? "#4B5058"
    : done
      ? "#B0B8BF"
      : overdue
        ? "#E24B4A"
        : soon
          ? "#BA7517"
          : "#E5E9EA";

  // Measure the cell width to decide inline vs tooltip for count
  const cellRef = useRef<HTMLDivElement>(null);
  const [inline, setInline] = useState(true);

  useEffect(() => {
    if (!showCount) return;
    const el = cellRef.current;
    if (!el) return;
    const check = () => {
      // Threshold: inline text ("14 July · 11d late") needs ~115px of horizontal room
      setInline(el.clientWidth >= 115);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [showCount]);

  const countLabel = overdue && isDate ? `${-dayD!}d late` : soon && isDate ? (dayD === 0 ? "today" : `${dayD}d`) : null;
  const tooltip =
    overdue && isDate
      ? `${-dayD!} days overdue`
      : soon && isDate
        ? (dayD === 0 ? "Due today" : `${dayD} days remaining`)
        : undefined;

  return (
    <div
      ref={cellRef}
      className="px-2 h-full flex items-center gap-1 min-w-0"
      onClick={(e) => e.stopPropagation()}
      title={showCount && !inline ? tooltip : undefined}
      style={
        overdue
          ? { borderLeft: "2px solid #E24B4A", paddingLeft: "6px" }
          : undefined
      }
    >
      <DateEditor
        task={task}
        field={field}
        value={value}
        project={project}
        onPatch={onPatch}
        color={color}
      />
      {showCount && countLabel && inline && (
        <span
          className="text-[9.5px] font-mono ml-auto shrink-0 whitespace-nowrap"
          style={{ color, opacity: 0.7 }}
        >
          {countLabel}
        </span>
      )}
    </div>
  );
}

/* ---------------- Status pill ---------------- */

function StatusPill({
  task,
  onChange,
}: {
  task: Task;
  onChange: (next: "open" | "done") => void;
}) {
  const [open, setOpen] = useState(false);
  const done = task.status === "done";
  const inProgress = false;

  const label = done ? "DONE" : inProgress ? "IN PROGRESS" : "OPEN";
  const style: React.CSSProperties = done
    ? { color: "#22C55E", background: "rgba(34,197,94,.12)" }
    : inProgress
      ? { color: "#BA7517", background: "rgba(186,117,23,.15)" }
      : { color: "#5C5C65", background: "#1D1D22" };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-[9.5px] font-mono uppercase tracking-widest px-2 py-1 rounded-sm w-full text-left"
        style={style}
      >
        {label}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            className="absolute z-40 mt-1 left-0 rounded-md border py-1 min-w-[120px]"
            style={{ background: "#0A0A0A", borderColor: "#1F2224" }}
          >
            {(["open", "done"] as const).map((s) => (
              <button
                key={s}
                onClick={() => {
                  onChange(s);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-[10.5px] font-mono uppercase tracking-widest hover:bg-white/[0.04]"
                style={{ color: s === "done" ? "#22C55E" : "#B0B8BF" }}
              >
                {s}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------- Assignee ---------------- */

function AssigneeCell({
  task,
  profiles,
  onChange,
}: {
  task: Task;
  profiles: ProfileLite[];
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const p = profiles.find((x) => x.id === task.assignee_id);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 h-6 max-w-full"
      >
        {p ? (
          <>
            <span
              className="h-5 w-5 rounded-full inline-flex items-center justify-center text-[9px] font-mono font-bold text-white shrink-0"
              style={{ background: p.colour ?? "#3D89DA" }}
            >
              {p.initials ?? "?"}
            </span>
            <span className="text-[11px] truncate">{p.full_name.split(" ")[0]}</span>
          </>
        ) : (
          <span className="h-5 w-5 rounded-full border border-dashed inline-block" style={{ borderColor: "#3A3A42" }} />
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            className="absolute z-40 mt-1 left-0 rounded-md border py-1 min-w-[180px] max-h-[240px] overflow-y-auto"
            style={{ background: "#0A0A0A", borderColor: "#1F2224" }}
          >
            <button
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-white/[0.04] text-muted-foreground"
            >
              Unassigned
            </button>
            {profiles.map((pr) => (
              <button
                key={pr.id}
                onClick={() => {
                  onChange(pr.id);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 text-left px-3 py-1.5 text-[11px] hover:bg-white/[0.04]"
              >
                <span
                  className="h-5 w-5 rounded-full inline-flex items-center justify-center text-[9px] font-mono font-bold text-white"
                  style={{ background: pr.colour ?? "#3D89DA" }}
                >
                  {pr.initials ?? "?"}
                </span>
                <span className="truncate">{pr.full_name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------- Date editor ---------------- */

function DateEditor({
  task,
  field,
  value,
  project,
  onPatch,
  color,
}: {
  task: Task;
  field: "start_date" | "end_date";
  value: string | null;
  project: Project | null;
  onPatch: (id: string, patch: Partial<Task>) => void;
  color: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => setDraft(value ?? ""), [value]);

  const commit = (v: string) => {
    onPatch(task.id, { [field]: v || null, date_manual: true } as Partial<Task>);
  };

  const clearDates = () => {
    onPatch(task.id, { start_date: null, end_date: null, date_manual: true });
    setOpen(false);
  };

  const resetToRule = async () => {
    if (!project) return;
    const { data } = await db.rpc("resolve_task_dates", {
      p_rule: task.rule,
      p_est_start: project.estimated_start,
      p_proj_start: project.project_start,
      p_proj_end: project.project_end,
    });
    const row = Array.isArray(data) ? data[0] : null;
    onPatch(task.id, {
      start_date: row?.start_date ?? null,
      end_date: row?.end_date ?? null,
      date_manual: false,
    });
    setOpen(false);
  };

  return (
    <div className="relative flex-1 min-w-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-left font-mono text-[11px] w-full flex items-center gap-1"
        style={{ color }}
      >
        {task.date_manual && value && (
          <Anchor className="h-2.5 w-2.5 shrink-0" style={{ color: "#F59E0B" }} />
        )}
        <span className="truncate">{value ? formatDateShort(value) : "—"}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            className="absolute z-40 mt-1 left-0 rounded-md border p-2 min-w-[220px] space-y-2"
            style={{ background: "#0A0A0A", borderColor: "#1F2224" }}
          >
            <input
              type="date"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                if (draft !== (value ?? "")) commit(draft);
              }}
              className="w-full h-8 px-2 rounded-md bg-black/40 border text-[12px] font-mono outline-none focus:border-primary/50"
              style={{ borderColor: "#1F2224" }}
            />
            <div className="text-[10px] font-mono text-muted-foreground">
              Rule · {DATE_RULE_SHORT[task.rule]}
            </div>
            <div className="flex gap-2">
              <button
                onClick={clearDates}
                className="flex-1 h-7 rounded-md text-[10.5px] font-mono uppercase tracking-widest border hover:bg-white/[0.04]"
                style={{ borderColor: "#1F2224", color: "#B0B8BF" }}
              >
                Clear
              </button>
              <button
                onClick={resetToRule}
                className="flex-1 h-7 rounded-md text-[10.5px] font-mono uppercase tracking-widest text-white"
                style={{ background: "#3D89DA" }}
              >
                Reset to rule
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------- Comment / attachment counts ---------------- */

const countCache = new Map<string, number>();

function CommentAttachmentCount({ taskId, kind }: { taskId: string; kind: "comments" | "attachments" }) {
  const key = `${kind}:${taskId}`;
  const [count, setCount] = useState<number>(countCache.get(key) ?? 0);
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    if (countCache.has(key)) return;
    db.from(kind)
      .select("id", { count: "exact", head: true })
      .eq("task_id", taskId)
      .then(({ count }: { count: number | null }) => {
        const n = count ?? 0;
        countCache.set(key, n);
        setCount(n);
      });
  }, [key, kind, taskId]);

  return (
    <div className="flex items-center justify-center text-[10.5px] font-mono text-muted-foreground/60">
      {count > 0 ? count : ""}
    </div>
  );
}

// Backwards-compat export (unused after refactor). Consumers should use buildRowGrid.
export const ROW_GRID = buildRowGrid(["name","status","start","due","comments","files"]);
