import { useState, useMemo } from "react";
import { DollarSign } from "lucide-react";
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

  const EXPENSES_OVERRIDE_KEY = "tt_goals_monthly_expenses_override";

  const dashboardMonthlyExpenses = useMemo(() => {
    const im = investorMetrics as any;
    if (im?.ytdTotalExpenses && im.ytdTotalExpenses > 0) {
      return Math.round(im.ytdTotalExpenses / 12);
    }
    // Fallback: sum from expenses tab
    const expRows = dataStore.expenses ?? [];
    return Math.round(expRows.reduce((s: number, e: any) => {
      const sub = String(e['Sub-Category'] ?? '').toUpperCase();
      if (sub === 'TOTAL' || sub === 'GRAND TOTAL') return s;
      const v = parseFloat(String(e['Monthly Cost'] ?? 0).replace(/[^0-9.-]/g,''));
      return s + (isNaN(v) ? 0 : v);
    }, 0));
  }, [investorMetrics, dataStore]);

  const [expensesOverride, setExpensesOverride] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem(EXPENSES_OVERRIDE_KEY);
      return saved ? Number(saved) : null;
    } catch { return null; }
  });

  const [editingExpenses, setEditingExpenses] = useState(false);
  const [expensesInputVal, setExpensesInputVal] = useState("");

  const activeMonthlyExpenses = expensesOverride ?? dashboardMonthlyExpenses;
  const isOverridden = expensesOverride !== null;

  function saveExpensesOverride() {
    const parsed = parseFloat(expensesInputVal.replace(/[^0-9.]/g, ''));
    if (!isNaN(parsed) && parsed > 0) {
      setExpensesOverride(parsed);
      localStorage.setItem(EXPENSES_OVERRIDE_KEY, String(parsed));
    }
    setEditingExpenses(false);
  }

  function resetExpensesOverride() {
    setExpensesOverride(null);
    localStorage.removeItem(EXPENSES_OVERRIDE_KEY);
    setEditingExpenses(false);
  }

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

        <GoalProgressChart goals={filteredGoals} monthlyExpenses={activeMonthlyExpenses} />

        <div className="stat-card p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs font-semibold text-foreground">Monthly Business Expenses</p>
                <p className="text-[10px] text-muted-foreground">
                  {isOverridden
                    ? "Manually set — used for goal calculations"
                    : "Auto from dashboard — used for goal calculations"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {editingExpenses ? (
                <>
                  <span className="text-xs text-muted-foreground">$</span>
                  <input
                    type="number"
                    value={expensesInputVal}
                    onChange={(e) => setExpensesInputVal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveExpensesOverride();
                      if (e.key === 'Escape') setEditingExpenses(false);
                    }}
                    className="w-28 h-7 text-xs font-mono bg-background border border-border rounded px-2 text-right focus:outline-none focus:border-primary"
                    autoFocus
                  />
                  <button
                    onClick={saveExpensesOverride}
                    className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingExpenses(false)}
                    className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className={`text-sm font-semibold font-mono ${isOverridden ? 'text-amber-400' : 'text-foreground'}`}>
                    ${activeMonthlyExpenses.toLocaleString('en-AU', {maximumFractionDigits: 0})}
                    <span className="text-[10px] font-normal text-muted-foreground">/mo</span>
                  </span>
                  <button
                    onClick={() => {
                      setExpensesInputVal(String(activeMonthlyExpenses));
                      setEditingExpenses(true);
                    }}
                    className="text-[10px] px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Edit
                  </button>
                  {isOverridden && (
                    <button
                      onClick={resetExpensesOverride}
                      className="text-[10px] px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Reset to auto
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          {/* Source detail */}
          <div className="mt-2 pt-2 border-t border-border/30 flex items-center gap-3 text-[10px] text-muted-foreground">
            <span>Dashboard figure: ${dashboardMonthlyExpenses.toLocaleString('en-AU', {maximumFractionDigits: 0})}/mo</span>
            {isOverridden && (
              <>
                <span>·</span>
                <span className="text-amber-400">
                  Override active: ${expensesOverride!.toLocaleString('en-AU', {maximumFractionDigits: 0})}/mo
                </span>
              </>
            )}
          </div>
        </div>

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
          const monthlyExpenses = activeMonthlyExpenses;
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
