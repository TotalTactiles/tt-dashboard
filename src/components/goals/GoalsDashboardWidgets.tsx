import { useMemo, useState, useEffect } from "react";
import { Goal, resolveGoalAutoValue } from "@/hooks/useGoals";
import { MetricFormula } from "@/hooks/useFormulas";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { Progress } from "@/components/ui/progress";
import { Target, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const COLLAPSE_KEY = "tt_goals_widget_collapsed";

interface GoalsDashboardWidgetsProps {
  goals: Goal[];
  formulas: MetricFormula[];
}

export default function GoalsDashboardWidgets({ goals, formulas }: GoalsDashboardWidgetsProps) {
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

  const activeGoals = enrichedGoals
    .filter((g) => {
      const progress = g.targetValue > 0 ? (g.currentValue / g.targetValue) * 100 : 0;
      return progress < 100;
    })
    .slice(0, 5);

  // Only render when goals exist
  if (activeGoals.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="stat-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Active Goals</p>
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
          <div className="space-y-3">
            {activeGoals.map((g) => {
              const progress = g.targetValue > 0 ? Math.min((g.currentValue / g.targetValue) * 100, 100) : 0;
              return (
                <div key={g.id} className="flex items-center gap-3">
                  <span className="text-xs text-foreground truncate min-w-0 flex-shrink flex items-center gap-1" style={{ flexBasis: "40%" }}>
                    {g.name}
                    {g._isAuto && (
                      <Badge variant="secondary" className="text-[8px] px-1 py-0 h-3.5 bg-primary/15 text-primary border-0">
                        auto
                      </Badge>
                    )}
                  </span>
                  <Progress value={progress} className="h-1.5 flex-1" />
                  <span className="text-xs text-muted-foreground font-mono shrink-0 w-10 text-right">{progress.toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
