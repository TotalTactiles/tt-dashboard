import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Target } from "lucide-react";
import { useGoals, Goal, resolveGoalAutoValue } from "@/hooks/useGoals";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import GoalCard from "@/components/goals/GoalCard";
import GoalForm from "@/components/goals/GoalForm";
import GoalProgressChart from "@/components/goals/GoalProgressChart";

const CATEGORIES = ["All", "Revenue", "Customer", "Sales Target", "Operating Expense", "Capital Expense", "Payroll", "Marketing", "Other"];

const GoalsTargets = () => {
  const { goals, addGoal, updateGoal, deleteGoal } = useGoals();
  const { dataStore, investorMetrics } = useDashboardData();
  const qs = dataStore.quotesSummary;
  const cs = dataStore.cashflowSummary;

  const [goalFormOpen, setGoalFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | undefined>();
  const [categoryFilter, setCategoryFilter] = useState("All");

  const enrichedGoals = useMemo(() => {
    return goals.map((g) => {
      const auto = resolveGoalAutoValue(g, qs, cs);
      if (auto) return { ...g, currentValue: auto.value, _isAuto: true };
      return { ...g, _isAuto: false };
    });
  }, [goals, qs, cs]);

  const filteredGoals = categoryFilter === "All" ? enrichedGoals : enrichedGoals.filter((g) => g.category === categoryFilter);

  const handleEditGoal = (goal: Goal) => {
    setEditingGoal(goal);
    setGoalFormOpen(true);
  };

  const handleGoalSubmit = (data: Omit<Goal, "id" | "createdAt">) => {
    if (editingGoal) {
      updateGoal(editingGoal.id, data);
    } else {
      addGoal(data);
    }
    setEditingGoal(undefined);
  };

  return (
    <DashboardLayout>
      <div className="mb-4 md:mb-6">
        <h1 className="text-fluid-2xl font-semibold">Goals & Targets</h1>
        <p className="text-fluid-xs text-muted-foreground font-mono">Track objectives and business targets</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px] text-xs">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => { setEditingGoal(undefined); setGoalFormOpen(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Goal
          </Button>
        </div>

        <GoalProgressChart goals={filteredGoals} />

        {(() => {
          const totalMonthlyGoalCost = filteredGoals
            .filter((g) => (g.goalType ?? "expenditure") === "expenditure")
            .reduce((s, g) => {
              if (g.amountStructure === "recurring") {
                const base = g.targetValue ?? 0;
                if (g.period === "weekly") return s + (base * 52) / 12;
                if (g.period === "yearly") return s + base / 12;
                return s + base;
              }
              return s;
            }, 0);
          const im = investorMetrics as any;
          const monthlyRevenue = im?.revenueExGST ? im.revenueExGST / 12 : 0;
          const monthlyExpenses = im?.ytdTotalExpenses ? im.ytdTotalExpenses / 12 : 0;
          const currentSurplus = monthlyRevenue - monthlyExpenses;
          const surplusWithAllGoals = currentSurplus - totalMonthlyGoalCost;
          const grossMarginPct = im?.grossMarginPct ?? 55;
          const totalRevenueNeeded = totalMonthlyGoalCost / (grossMarginPct / 100);
          if (filteredGoals.length <= 1 || totalMonthlyGoalCost <= 0) return null;
          const fmtNum = (n: number) =>
            n.toLocaleString("en-AU", { maximumFractionDigits: 0 });
          return (
            <div className="chart-container space-y-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Combined Goal Impact</h3>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {filteredGoals.length} goals
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Total Monthly Cost
                  </div>
                  <div className="text-base font-mono font-semibold text-foreground mt-1">
                    ${fmtNum(totalMonthlyGoalCost)}
                  </div>
                </div>
                <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Annual Cost
                  </div>
                  <div className="text-base font-mono font-semibold text-foreground mt-1">
                    ${fmtNum(totalMonthlyGoalCost * 12)}
                  </div>
                </div>
                <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Revenue Needed
                  </div>
                  <div className="text-base font-mono font-semibold text-foreground mt-1">
                    ${fmtNum(totalRevenueNeeded)}/mo
                  </div>
                </div>
                <div
                  className={`rounded-md border p-3 ${
                    surplusWithAllGoals >= 0
                      ? "border-emerald-500/40 bg-emerald-500/10"
                      : "border-red-500/40 bg-red-500/10"
                  }`}
                >
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Surplus With All Goals
                  </div>
                  <div
                    className={`text-base font-mono font-semibold mt-1 ${
                      surplusWithAllGoals >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {surplusWithAllGoals < 0 ? "(" : ""}$
                    {fmtNum(Math.abs(surplusWithAllGoals))}
                    {surplusWithAllGoals < 0 ? ")" : ""}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
          {filteredGoals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} onEdit={handleEditGoal} onDelete={deleteGoal} isAuto={(goal as any)._isAuto} />
          ))}
        </div>

        {filteredGoals.length === 0 && (
          <div className="chart-container flex flex-col items-center justify-center py-12">
            <Target className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No goals yet. Create your first goal to start tracking.</p>
          </div>
        )}

        <GoalForm
          open={goalFormOpen}
          onOpenChange={(open) => { setGoalFormOpen(open); if (!open) setEditingGoal(undefined); }}
          onSubmit={handleGoalSubmit}
          initial={editingGoal}
        />
      </div>
    </DashboardLayout>
  );
};

export default GoalsTargets;
