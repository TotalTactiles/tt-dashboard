import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import type { Task, TaskList as TL } from "@/hooks/useTasks";
import type { ProfileLite } from "@/hooks/useProfiles";
import { TaskRow } from "./TaskRow";
import { Ring } from "./Ring";
import { buildRowGrid, COLUMN_DEFS, type ColumnKey } from "./columns";

interface Project {
  estimated_start: string | null;
  project_start: string | null;
  project_end: string | null;
}

interface Props {
  list: TL;
  tasks: Task[];
  columns: ColumnKey[];
  profiles: ProfileLite[];
  project: Project | null;
  onOpen: (id: string) => void;
  onToggle: (task: Task) => void;
  onPatch: (id: string, patch: Partial<Task>) => void;
}

export function TaskListSection({
  list,
  tasks,
  columns,
  profiles,
  project,
  onOpen,
  onToggle,
  onPatch,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const listTasks = useMemo(() => tasks.filter((t) => t.list_id === list.id), [tasks, list.id]);
  const parents = useMemo(
    () => listTasks.filter((t) => !t.parent_id).sort((a, b) => a.position - b.position),
    [listTasks],
  );
  const childrenOf = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const t of listTasks) {
      if (t.parent_id) (map[t.parent_id] ??= []).push(t);
    }
    for (const k of Object.keys(map)) map[k].sort((a, b) => a.position - b.position);
    return map;
  }, [listTasks]);

  const totals = useMemo(() => {
    const countable = listTasks.filter((t) => !t.office_only);
    const total = countable.length;
    const done = countable.filter((t) => t.status === "done").length;
    const pct = total ? Math.round((100 * done) / total) : 0;
    return { total, done, pct, all: listTasks.length };
  }, [listTasks]);

  return (
    <div
      className="rounded-md border overflow-hidden"
      style={{ borderColor: "#1F2224", background: "#0A0A0A" }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2 border-b group"
        style={{ borderColor: "#1F2224", background: "#0F1113" }}
      >
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left hover:opacity-90"
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <Ring pct={totals.pct} size={20} stroke={2.5} />
          <span className="text-[12px] font-semibold tracking-tight text-foreground">
            {list.name}
          </span>
          <span
            className="text-[10px] font-mono px-2 py-0.5 rounded-sm"
            style={{
              background: "rgba(255,255,255,0.05)",
              color: totals.done === totals.total && totals.total > 0 ? "#22C55E" : "#B0B8BF",
            }}
          >
            {totals.done}/{totals.total}
          </span>
        </button>
        <button
          className="opacity-0 group-hover:opacity-100 transition-opacity text-[10.5px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          disabled
          title="Add task — coming soon"
        >
          <Plus className="h-3 w-3" /> Add task
        </button>
      </div>

      {!collapsed && (
        <div>
          {parents.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground text-center">
              No tasks in this list.
            </div>
          ) : (
            <TaskTree
              parents={parents}
              childrenOf={childrenOf}
              columns={columns}
              profiles={profiles}
              listName={list.name}
              project={project}
              onOpen={onOpen}
              onToggle={onToggle}
              onPatch={onPatch}
            />
          )}
        </div>
      )}
    </div>
  );
}

function TaskTree({
  parents,
  childrenOf,
  columns,
  profiles,
  listName,
  project,
  onOpen,
  onToggle,
  onPatch,
}: {
  parents: Task[];
  childrenOf: Record<string, Task[]>;
  columns: ColumnKey[];
  profiles: ProfileLite[];
  listName: string;
  project: Project | null;
  onOpen: (id: string) => void;
  onToggle: (task: Task) => void;
  onPatch: (id: string, patch: Partial<Task>) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const isExpanded = (id: string) => expanded[id] !== false; // default true

  const renderNode = (t: Task, depth: number): JSX.Element => {
    const kids = childrenOf[t.id] ?? [];
    const hasKids = kids.length > 0;
    const open = isExpanded(t.id);
    return (
      <div key={t.id}>
        <TaskRow
          task={t}
          depth={depth}
          columns={columns}
          profiles={profiles}
          listName={listName}
          project={project}
          onOpen={onOpen}
          onToggle={onToggle}
          onPatch={onPatch}
          childCounts={
            hasKids
              ? { total: kids.length, done: kids.filter((k) => k.status === "done").length }
              : undefined
          }
          expanded={hasKids ? open : undefined}
          onToggleExpand={
            hasKids ? () => setExpanded((prev) => ({ ...prev, [t.id]: !open })) : undefined
          }
        />
        {hasKids && open && kids.map((k) => renderNode(k, depth + 1))}
      </div>
    );
  };

  return <>{parents.map((p) => renderNode(p, 0))}</>;
}

export function TaskListColumnHeader({ columns }: { columns: ColumnKey[] }) {
  return (
    <div
      className="sticky top-0 z-10 grid text-[9.5px] font-mono uppercase tracking-widest text-muted-foreground border-b"
      style={{
        gridTemplateColumns: buildRowGrid(columns),
        background: "#0F1113",
        borderColor: "#1F2224",
        height: 30,
      }}
    >
      <div />
      <div />
      {columns.map((k) => {
        const def = COLUMN_DEFS[k];
        const isCount = k === "comments" || k === "files";
        return (
          <div
            key={k}
            className={isCount ? "flex items-center justify-center" : "flex items-center px-2"}
          >
            {isCount ? (k === "comments" ? "💬" : "📎") : def.label}
          </div>
        );
      })}
      <div />
    </div>
  );
}
