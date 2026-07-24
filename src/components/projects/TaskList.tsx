import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task, TaskList as TL } from "@/hooks/useTasks";
import { TaskRow } from "./TaskRow";

interface Props {
  list: TL;
  tasks: Task[]; // all tasks in project — this component filters
  onOpen: (id: string) => void;
  onToggle: (task: Task) => void;
}

export function TaskListSection({ list, tasks, onOpen, onToggle }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const listTasks = useMemo(
    () => tasks.filter((t) => t.list_id === list.id),
    [tasks, list.id],
  );

  // Group into parents + children lookup
  const parents = useMemo(
    () => listTasks.filter((t) => !t.parent_id).sort((a, b) => a.position - b.position),
    [listTasks],
  );
  const childrenOf = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const t of listTasks) {
      if (t.parent_id) {
        (map[t.parent_id] ??= []).push(t);
      }
    }
    for (const k of Object.keys(map)) map[k].sort((a, b) => a.position - b.position);
    return map;
  }, [listTasks]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const totals = useMemo(() => {
    const total = listTasks.length;
    const done = listTasks.filter((t) => t.status === "done").length;
    return { total, done };
  }, [listTasks]);

  return (
    <div
      className="rounded-md border overflow-hidden"
      style={{ borderColor: "#1F2224", background: "#0A0A0A" }}
    >
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-2 px-3 py-2 border-b hover:bg-white/[0.02]"
        style={{ borderColor: "#1F2224", background: "#0F1113" }}
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span className="text-[12px] font-semibold tracking-tight text-foreground">
          {list.name}
        </span>
        <span
          className="ml-auto text-[10px] font-mono px-2 py-0.5 rounded-sm"
          style={{
            background: "rgba(255,255,255,0.05)",
            color: totals.done === totals.total && totals.total > 0 ? "#22C55E" : "#B0B8BF",
          }}
        >
          {totals.done}/{totals.total}
        </span>
      </button>

      {!collapsed && (
        <div className="p-1.5 space-y-0.5">
          {parents.length === 0 && (
            <div className="p-4 text-xs text-muted-foreground text-center">
              No tasks in this list.
            </div>
          )}
          {parents.map((p) => {
            const kids = childrenOf[p.id] ?? [];
            const isOpen = expanded[p.id] ?? true;
            return (
              <div key={p.id}>
                <div className="flex items-stretch">
                  {kids.length > 0 && (
                    <button
                      onClick={() =>
                        setExpanded((prev) => ({ ...prev, [p.id]: !isOpen }))
                      }
                      className={cn(
                        "w-6 shrink-0 flex items-center justify-center text-muted-foreground/60 hover:text-foreground",
                      )}
                      aria-label={isOpen ? "Collapse subtasks" : "Expand subtasks"}
                    >
                      {isOpen ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                    </button>
                  )}
                  <div className="flex-1">
                    <TaskRow
                      task={p}
                      depth={0}
                      onOpen={onOpen}
                      onToggle={onToggle}
                      childCounts={
                        kids.length > 0
                          ? {
                              total: kids.length,
                              done: kids.filter((k) => k.status === "done").length,
                            }
                          : undefined
                      }
                    />
                  </div>
                </div>
                {isOpen &&
                  kids.map((k) => (
                    <TaskRow
                      key={k.id}
                      task={k}
                      depth={1}
                      onOpen={onOpen}
                      onToggle={onToggle}
                    />
                  ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
