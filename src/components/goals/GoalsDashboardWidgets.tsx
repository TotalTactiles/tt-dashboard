import { Goal } from "@/hooks/useGoals";
import { MetricFormula, evaluateExpression } from "@/hooks/useFormulas";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { Progress } from "@/components/ui/progress";
import { Target, Calculator } from "lucide-react";

interface GoalsDashboardWidgetsProps {
  goals: Goal[];
  formulas: MetricFormula[];
}

export default function GoalsDashboardWidgets({ goals, formulas }: GoalsDashboardWidgetsProps) {
  const activeGoals = goals.
  filter((g) => {
    const progress = g.targetValue > 0 ? g.currentValue / g.targetValue * 100 : 0;
    return progress < 100;
  }).
  slice(0, 5);

  const formulaResults = formulas.slice(0, 4).map((f) => ({
    ...f,
    result: evaluateExpression(f.expression)
  }));

  if (activeGoals.length === 0 && formulaResults.length === 0) return null;

  const formatValue = (v: number, unit: string) => {
    if (unit === "$") return `$${v >= 1000 ? (v / 1000).toFixed(1) + "K" : v}`;
    if (unit === "%") return `${v.toFixed(1)}%`;
    return `${v}`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      {activeGoals.length > 0 &&
      <div className="stat-card space-y-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Active Goals</p>
          </div>
          <div className="space-y-3">
            {activeGoals.map((g) => {
            const progress = g.targetValue > 0 ? Math.min(g.currentValue / g.targetValue * 100, 100) : 0;
            return (
              <div key={g.id} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground truncate mr-2">{g.name}</span>
                    <span className="text-muted-foreground font-mono shrink-0">{progress.toFixed(0)}%</span>
                  </div>
                  <Progress value={progress} className="h-1" />
                </div>);

          })}
          </div>
        </div>
      }

      {formulaResults.length > 0
















      }
    </div>);

}