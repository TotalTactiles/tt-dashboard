import { useMemo } from "react";
import { Goal } from "@/hooks/useGoals";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { Progress } from "@/components/ui/progress";
import { TrendingUp } from "lucide-react";

interface GoalProgressChartProps {
  goals: Goal[];
  monthlyExpenses?: number;
}

export default function GoalProgressChart({ goals, monthlyExpenses }: GoalProgressChartProps) {
  const { investorMetrics, dataStore } = useDashboardData();
  const im = investorMetrics as any;

  const grossMarginPct = im?.grossMarginPct ?? 55;

  const monthlyRevenue = useMemo(() => {
    if (im?.revenueExGST && im.revenueExGST > 0) return im.revenueExGST / 12;
    return 0;
  }, [im]);

  const activeExpenses = monthlyExpenses 
    ?? (im?.ytdTotalExpenses ? im.ytdTotalExpenses / 12 : 0);

  const currentMonthlySurplus = monthlyRevenue - activeExpenses;

  const goalMetrics = useMemo(() => {
    return goals.map(goal => {
      const isExpenditure = (goal.goalType ?? "expenditure") === "expenditure";
      const isLumpSum = goal.amountStructure === "lump_sum";

      if (isLumpSum) {
        // Lump sum: progress = % of target accumulated from monthly surplus
        const monthsElapsed = (() => {
          const start = new Date(goal.startDate ?? `${goal.targetYear ?? new Date().getFullYear()}-01-01`);
          const now = new Date();
          const months = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth();
          return Math.max(0, months);
        })();
        const accumulated = Math.min(
          currentMonthlySurplus > 0 ? currentMonthlySurplus * monthsElapsed : 0,
          goal.targetValue
        );
        const progress = goal.targetValue > 0 
          ? Math.min((accumulated / goal.targetValue) * 100, 100) 
          : 0;
        const monthsToTarget = currentMonthlySurplus > 0
          ? Math.ceil(goal.targetValue / currentMonthlySurplus)
          : null;
        const targetDate = monthsToTarget !== null
          ? (() => {
              const d = new Date();
              d.setMonth(d.getMonth() + monthsToTarget);
              return d.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' });
            })()
          : null;

        return {
          id: goal.id,
          name: goal.name,
          isLumpSum: true,
          isExpenditure,
          progress,
          label: `$${Math.round(accumulated).toLocaleString('en-AU')} saved of $${goal.targetValue.toLocaleString('en-AU')}`,
          sublabel: targetDate ? `Achievable by ${targetDate}` : "Increase surplus to save",
          color: progress >= 100 ? "hsl(var(--chart-green))" : "hsl(var(--primary))",
        };

      } else {
        // Recurring: progress = % of required additional revenue currently being generated
        // Required additional revenue = goalMonthly / grossMarginPct
        const goalMonthly = (() => {
          const base = goal.targetValue ?? 0;
          if (goal.period === "weekly") return base * 52 / 12;
          if (goal.period === "yearly") return base / 12;
          return base;
        })();

        const revenueRequired = grossMarginPct > 0
          ? goalMonthly / (grossMarginPct / 100)
          : 0;

        // Current surplus vs what's needed
        // If surplus > 0, we're already generating excess revenue
        // Coverage = how much of the required revenue gap is covered by current surplus
        const coverageAmount = Math.min(
          Math.max(currentMonthlySurplus, 0),
          revenueRequired
        );
        const progress = revenueRequired > 0
          ? Math.min((coverageAmount / revenueRequired) * 100, 100)
          : 0;

        const shortfall = Math.max(revenueRequired - currentMonthlySurplus, 0);

        return {
          id: goal.id,
          name: goal.name,
          isLumpSum: false,
          isExpenditure,
          progress,
          label: `${progress.toFixed(0)}% of $${Math.round(revenueRequired).toLocaleString('en-AU')}/mo revenue coverage`,
          sublabel: shortfall > 0
            ? `$${Math.round(shortfall).toLocaleString('en-AU')}/mo additional revenue needed`
            : "Fully covered by current surplus",
          color: progress >= 100 
            ? "hsl(var(--chart-green))" 
            : progress >= 50 
              ? "hsl(var(--primary))" 
              : "hsl(var(--chart-amber))",
        };
      }
    });
  }, [goals, currentMonthlySurplus, grossMarginPct, monthlyRevenue, activeExpenses]);

  if (goals.length === 0) return null;

  return (
    <div className="chart-container space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Goal Coverage Progress</h3>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">
          — based on current revenue &amp; surplus
        </span>
      </div>

      <div className="space-y-4">
        {goalMetrics.map((metric) => (
          <div key={metric.id} className="space-y-1.5">
            {/* Goal name + type */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-foreground">{metric.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                  {metric.isLumpSum ? 'Lump Sum' : metric.isExpenditure ? 'Recurring' : 'Revenue'}
                </span>
              </div>
              <span className="text-xs font-mono font-semibold text-foreground">
                {metric.progress.toFixed(0)}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="relative">
              <Progress value={metric.progress} className="h-2" style={{ background: 'hsl(var(--muted))' }} />
              <div 
                className="absolute top-0 left-0 h-2 rounded-full transition-all" 
                style={{ 
                  width: `${metric.progress}%`, 
                  backgroundColor: metric.color 
                }} 
              />
            </div>

            {/* Labels */}
            <div className="space-y-0.5">
              <p className="text-xs text-foreground font-medium">{metric.label}</p>
              <p className="text-[10px] text-muted-foreground font-mono">
                {metric.sublabel}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 pt-3 border-t border-border/50">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "hsl(var(--chart-amber))" }} />
          <span className="text-[10px] text-muted-foreground font-mono">Needs revenue growth</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "hsl(var(--primary))" }} />
          <span className="text-[10px] text-muted-foreground font-mono">Partially covered</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "hsl(var(--chart-green))" }} />
          <span className="text-[10px] text-muted-foreground font-mono">Fully covered</span>
        </div>
      </div>
    </div>
  );
}
