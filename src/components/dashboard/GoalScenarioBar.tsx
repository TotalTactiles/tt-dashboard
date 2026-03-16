import { useMemo } from "react";
import { Goal } from "@/hooks/useGoals";
import { formatMetricValue } from "@/lib/formatMetricValue";

interface GoalScenarioBarProps {
  goals: Goal[];
  activeGoalIds: Set<string>;
  onToggleGoal: (id: string) => void;
  onSetAll: () => void;
  onClearAll: () => void;
  netMonthlyEffect: number;
}

export default function GoalScenarioBar({
  goals,
  activeGoalIds,
  onToggleGoal,
  onSetAll,
  onClearAll,
  netMonthlyEffect,
}: GoalScenarioBarProps) {
  const mergedGoals = useMemo(() => goals.filter(g => g.merge), [goals]);

  if (mergedGoals.length === 0) return null;

  const allActive = mergedGoals.every(g => activeGoalIds.has(g.id));
  const noneActive = mergedGoals.every(g => !activeGoalIds.has(g.id));
  const someActive = !allActive && !noneActive;

  const activeNames = mergedGoals.filter(g => activeGoalIds.has(g.id)).map(g => g.name);

  return (
    <div className="mb-4 space-y-2">
      <div className="stat-card !py-3 overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <p className="text-muted-foreground font-mono uppercase tracking-wider" style={{ fontSize: "clamp(9px, 1vw, 11px)" }}>
            Goal Scenarios
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={onSetAll}
            className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-medium transition-all ${
              allActive
                ? "bg-primary text-primary-foreground"
                : "bg-transparent border border-border text-muted-foreground hover:border-muted-foreground/50"
            }`}
          >
            All
          </button>
          <button
            onClick={onClearAll}
            className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-medium transition-all ${
              noneActive
                ? "bg-primary text-primary-foreground"
                : "bg-transparent border border-border text-muted-foreground hover:border-muted-foreground/50"
            }`}
          >
            None
          </button>

          <span className="w-px h-4 bg-border mx-1" />

          {mergedGoals.map(g => {
            const isActive = activeGoalIds.has(g.id);
            const isRevenue = (g.goalType ?? "expenditure") === "revenue";
            const dotColor = isRevenue ? "hsl(var(--chart-green))" : "hsl(var(--chart-amber))";
            return (
              <button
                key={g.id}
                onClick={() => onToggleGoal(g.id)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-medium transition-all flex items-center gap-1.5 max-w-[200px] ${
                  isActive
                    ? isRevenue
                      ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/40"
                      : "bg-amber-600/20 text-amber-400 border border-amber-500/40"
                    : "bg-transparent border border-border text-muted-foreground hover:border-muted-foreground/50"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                <span className="truncate">{g.name}</span>
              </button>
            );
          })}

          <span className="w-px h-4 bg-border mx-1" />

          <button
            onClick={onSetAll}
            className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-medium transition-all flex items-center gap-1.5 ${
              allActive
                ? "bg-primary/20 text-primary border border-primary/40"
                : "bg-transparent border border-border text-muted-foreground hover:border-muted-foreground/50"
            }`}
          >
            Combined
            {!noneActive && (
              <span className={`text-[9px] ${netMonthlyEffect >= 0 ? "text-emerald-400" : "text-amber-400"}`}>
                {netMonthlyEffect >= 0 ? "+" : ""}{formatMetricValue(netMonthlyEffect, "currency")}/mo
              </span>
            )}
          </button>
        </div>
      </div>

      {someActive && (
        <div
          className="rounded-lg px-3 py-2 font-mono text-muted-foreground"
          style={{
            fontSize: "clamp(9px, 1vw, 11px)",
            background: "hsl(var(--card))",
            borderLeft: `3px solid ${netMonthlyEffect >= 0 ? "hsl(var(--chart-green))" : "hsl(var(--chart-amber))"}`,
          }}
        >
          Scenario: {activeNames.join(" + ")} active — net effect:{" "}
          <span className={netMonthlyEffect >= 0 ? "text-emerald-400" : "text-amber-400"}>
            {netMonthlyEffect >= 0 ? "+" : ""}{formatMetricValue(netMonthlyEffect, "currency")}/mo
          </span>{" "}
          on cashflow
        </div>
      )}
    </div>
  );
}
