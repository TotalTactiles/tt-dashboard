import { useMemo } from "react";
import { ChevronRight, Circle, CheckCircle2, Lock } from "lucide-react";
import type { Task } from "@/hooks/useTasks";
import { DATE_RULE_SHORT, formatDateShort, daysUntil } from "@/lib/projects/dateRules";
import { cn } from "@/lib/utils";

interface Props {
  task: Task;
  depth: number;
  onOpen: (id: string) => void;
  onToggle: (task: Task) => void;
  childCounts?: { total: number; done: number };
}

export function TaskRow({ task, depth, onOpen, onToggle, childCounts }: Props) {
  const days = useMemo(() => daysUntil(task.end_date), [task.end_date]);

  const dueColor = useMemo(() => {
    if (task.status === "done") return "#22C55E";
    if (days === null) return "#B0B8BF";
    if (days < 0) return "#EF4444";
    if (days <= 2) return "#F59E0B";
    return "#B0B8BF";
  }, [days, task.status]);

  const done = task.status === "done";

  return (
    <div
      className={cn(
        "group flex items-center gap-2 px-3 py-2 rounded-md border-l-2 cursor-pointer transition-colors",
        "hover:bg-white/[0.03]",
      )}
      style={{
        marginLeft: depth * 20,
        borderLeftColor: done ? "#22C55E" : task.office_only ? "#7C5BC7" : "transparent",
        background: done ? "rgba(34,197,94,0.04)" : "transparent",
      }}
      onClick={() => onOpen(task.id)}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle(task);
        }}
        className="shrink-0 text-muted-foreground hover:text-foreground"
        aria-label={done ? "Reopen task" : "Complete task"}
      >
        {done ? (
          <CheckCircle2 className="h-4 w-4" style={{ color: "#22C55E" }} />
        ) : (
          <Circle className="h-4 w-4" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              "text-[12.5px] font-medium truncate",
              done ? "line-through text-muted-foreground" : "text-foreground/90",
            )}
          >
            {task.name}
          </span>
          {task.product_code && (
            <span
              className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-sm"
              style={{ background: "rgba(255,255,255,0.05)", color: "#B0B8BF" }}
            >
              {task.product_code}
            </span>
          )}
          {task.calc_table && (
            <span
              className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-sm"
              style={{ background: "#3D89DA22", color: "#3D89DA" }}
            >
              {task.calc_table.replace(/_/g, " ")}
            </span>
          )}
          {task.office_only && (
            <span
              className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-sm inline-flex items-center gap-1"
              style={{ background: "#7C5BC722", color: "#B9A5E5" }}
            >
              <Lock className="h-2.5 w-2.5" />
              office
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[10.5px] font-mono text-muted-foreground truncate">
          {task.start_date || task.end_date ? (
            <>
              {formatDateShort(task.start_date)} → {formatDateShort(task.end_date)}
              {" · "}
              <span style={{ opacity: 0.7 }}>{DATE_RULE_SHORT[task.rule]}</span>
              {task.date_manual && (
                <span className="ml-1" style={{ color: "#F59E0B" }}>
                  · manual
                </span>
              )}
            </>
          ) : (
            <span style={{ opacity: 0.6 }}>{DATE_RULE_SHORT[task.rule]}</span>
          )}
          {childCounts && childCounts.total > 0 && (
            <>
              {" · "}
              {childCounts.done}/{childCounts.total} subtasks
            </>
          )}
        </div>
      </div>

      <div
        className="text-[10.5px] font-mono shrink-0"
        style={{ color: dueColor }}
      >
        {task.end_date && !done
          ? days === 0
            ? "today"
            : days! > 0
              ? `in ${days}d`
              : `${-days!}d late`
          : done
            ? "done"
            : ""}
      </div>

      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground" />
    </div>
  );
}
