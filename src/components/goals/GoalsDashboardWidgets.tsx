import { useMemo, useState, useEffect } from "react";
import { Goal, resolveGoalAutoValue } from "@/hooks/useGoals";
import { MetricFormula } from "@/hooks/useFormulas";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Target, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const COLLAPSE_KEY = "tt_goals_widget_collapsed";

interface GoalsDashboardWidgetsProps {
  goals: Goal[];
  formulas: MetricFormula[];
  activeGoalIds?: Set<string>;
  onToggleGoal?: (id: string) => void;
  onToggleMerge?: (id: string, mergeOn: boolean) => void;
}

export default function GoalsDashboardWidgets({
  goals,
  formulas,
  activeGoalIds,
  onToggleGoal,
  onToggleMerge,
}: GoalsDashboardWidgetsProps) {
  const { dataStore } = useDashboardData();
  const qs = dataStore.quotesSummary;
  const cs = dataStore.cashflowSummary;

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === "true"; } catch { return false; }
  });

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, String(collapsed));
  }, [collapsed]);

  const enrichedGoals = useMemo(() => {
    return goals.map((g) => {
      const auto = resolveGoalAutoValue(g, qs, cs);
      if (auto) return { ...g, currentValue: auto.value, _isAuto: true };
      return { ...g, _isAuto: false };
    });
  }, [goals, qs, cs]);

  // Show ALL goals — no filtering, no slicing
  const displayGoals = enrichedGoals;

  if (displayGoals.length === 0) return null;

  const shouldScroll = displayGoals.length > 8;

  return (
    <div className="mb-4 md:mb-6">
      <div className="stat-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <p className="text-[length:clamp(9px,1vw,11px)] text-muted-foreground font-mono uppercase tracking-wider">Active Goals</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronDown className="h-3 w-3 mr-1" /> : <ChevronUp className="h-3 w-3 mr-1" />}
            {collapsed ? "Show" : "Hide"}
          </Button>
        </div>
        {!collapsed && (
          <div className={`space-y-2.5 ${shouldScroll ? "max-h-[360px] overflow-y-auto pr-1" : ""}`}>
            {displayGoals.map((g) => {
              const progress = g.targetValue > 0 ? Math.min((g.currentValue / g.targetValue) * 100, 100) : 0;
              const isMerged = g.merge === true;
              const isActive = activeGoalIds?.has(g.id) ?? false;
              const isRevenue = (g.goalType ?? "expenditure") === "revenue";
              return (
                <div key={g.id} className="flex items-center gap-2 sm:gap-3 min-w-0">
                  {/* Name + badges */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-xs font-semibold text-foreground truncate min-w-0 flex items-center gap-1" style={{ flexBasis: "35%", flexShrink: 1 }}>
                        {g.name}
                        {g._isAuto && (
                          <Badge variant="secondary" className="text-[8px] px-1 py-0 h-3.5 bg-primary/15 text-primary border-0 shrink-0">
                            auto
                          </Badge>
                        )}
                        <span
                          className="w-1.5 h-1.5 rounded-full inline-block shrink-0"
                          style={{ backgroundColor: isRevenue ? "hsl(var(--chart-green))" : "hsl(var(--chart-amber))" }}
                        />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs font-mono">
                      {g.name}
                    </TooltipContent>
                  </Tooltip>

                  {/* Progress bar */}
                  <Progress value={progress} className="h-1.5 flex-1 min-w-0" />

                  {/* Percentage */}
                  <span className="text-xs text-muted-foreground font-mono shrink-0 w-10 text-right">{progress.toFixed(0)}%</span>

                  {/* Merge toggle */}
                  {isMerged && onToggleGoal && (
                    <Switch
                      checked={isActive}
                      onCheckedChange={() => onToggleGoal(g.id)}
                      className="scale-75 shrink-0"
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
