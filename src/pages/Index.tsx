import { useState, useMemo, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { formatMetricValue } from "@/lib/formatMetricValue";
import PortfolioChart from "@/components/dashboard/PortfolioChart";
import SectorAllocationChart from "@/components/dashboard/SectorAllocationChart";
import DealPipeline from "@/components/dashboard/DealPipeline";
import CashflowChart from "@/components/dashboard/CashflowChart";
import FundPerformanceChart from "@/components/dashboard/FundPerformanceChart";
import ForecastChart from "@/components/dashboard/ForecastChart";
import RevenueProjectsTable from "@/components/dashboard/RevenueProjectsTable";
import ExpenseBreakdown from "@/components/dashboard/ExpenseBreakdown";
import DashboardLayout from "@/components/DashboardLayout";
import GoalsDashboardWidgets from "@/components/goals/GoalsDashboardWidgets";
import GoalScenarioBar from "@/components/dashboard/GoalScenarioBar";
import { useGoals } from "@/hooks/useGoals";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { applyGoalMerge } from "@/lib/goalMerge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Unplug, Loader2 } from "lucide-react";

const fmtAUD = (n: number) => formatMetricValue(n, "currency");

function timeAgo(ts: number | null): string {
  if (!ts) return "never";
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

const ACTIVE_GOALS_KEY = "tt_active_goal_ids";

function loadActiveGoalIds(allGoals: {id: string;merge?: boolean;}[]): Set<string> {
  try {
    const raw = localStorage.getItem(ACTIVE_GOALS_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set(allGoals.filter((g) => g.merge).map((g) => g.id));
}

const DashboardContent = () => {
  const { goals, updateGoal } = useGoals();
  const { formulas, kpiStats, hasLiveData, connectedCount, dataHealth, isLoading, lastUpdated, sources, syncNow, formulaCache, incomeOutgoingsData } = useDashboardData();

  const [activeGoalIds, setActiveGoalIds] = useState<Set<string>>(() => loadActiveGoalIds(goals));

  const setAndPersistActiveIds = useCallback((ids: Set<string>) => {
    setActiveGoalIds(ids);
    localStorage.setItem(ACTIVE_GOALS_KEY, JSON.stringify([...ids]));
  }, []);

  const handleToggleGoal = useCallback((id: string) => {
    setActiveGoalIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);else
      next.add(id);
      localStorage.setItem(ACTIVE_GOALS_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const handleSetAll = useCallback(() => {
    const ids = new Set(goals.filter((g) => g.merge).map((g) => g.id));
    setAndPersistActiveIds(ids);
  }, [goals, setAndPersistActiveIds]);

  const handleClearAll = useCallback(() => {
    setAndPersistActiveIds(new Set());
  }, [setAndPersistActiveIds]);

  const handleToggleMerge = useCallback((id: string, mergeOn: boolean) => {
    updateGoal(id, { merge: mergeOn });
    if (mergeOn) {
      setActiveGoalIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        localStorage.setItem(ACTIVE_GOALS_KEY, JSON.stringify([...next]));
        return next;
      });
    }
  }, [updateGoal]);

  const { adjustedData, adjustments, netMonthlyEffect } = useMemo(
    () => applyGoalMerge(incomeOutgoingsData, goals, activeGoalIds),
    [incomeOutgoingsData, goals, activeGoalIds]
  );

  const hasActiveGoals = useMemo(() => {
    return goals.some((g) => g.merge && activeGoalIds.has(g.id));
  }, [goals, activeGoalIds]);

  const adjustedKpiStats = useMemo(() => {
    if (!hasActiveGoals) return kpiStats;

    // Current month key e.g. "Mar-26"
    const now = new Date();
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonthKey = `${MONTHS[now.getMonth()]}-${String(now.getFullYear()).slice(-2)}`;

    // Cashflow Position: use current month from adjusted data, fallback to nearest future
    let adjustedCashflowPos = 0;
    const currentPoint = adjustedData.find((p) => p.month === currentMonthKey);
    if (currentPoint && currentPoint.surplus !== 0) {
      adjustedCashflowPos = currentPoint.surplus;
    } else {
      // Find nearest future month with non-zero surplus
      const currentIdx = adjustedData.findIndex((p) => p.month === currentMonthKey);
      const startIdx = currentIdx >= 0 ? currentIdx : 0;
      for (let i = startIdx; i < adjustedData.length; i++) {
        if (adjustedData[i].surplus !== 0) {adjustedCashflowPos = adjustedData[i].surplus;break;}
      }
      // If still 0, search backwards
      if (adjustedCashflowPos === 0) {
        for (let i = adjustedData.length - 1; i >= 0; i--) {
          if (adjustedData[i].surplus !== 0) {adjustedCashflowPos = adjustedData[i].surplus;break;}
        }
      }
    }

    // Net Revenue adjustment from active goals
    let netRevenueAdj = 0;
    const activeGoals = goals.filter((g) => g.merge && activeGoalIds.has(g.id));
    for (const goal of activeGoals) {
      const goalType = goal.goalType ?? "expenditure";
      if (goal.amountStructure === "lump_sum" && goal.lumpSumDate) {
        const lumpDate = new Date(goal.lumpSumDate);
        if (lumpDate <= now) {
          netRevenueAdj += goalType === "revenue" ? goal.targetValue : -goal.targetValue;
        }
      } else if (goal.amountStructure === "recurring") {
        const start = new Date(goal.startDate);
        if (start <= now) {
          const monthsElapsed = Math.max(1, (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth() + 1);
          let monthly = goal.targetValue || 0;
          if (goal.period === "weekly") monthly = monthly * 4.33;else
          if (goal.period === "yearly") monthly = monthly / 12;
          netRevenueAdj += goalType === "revenue" ? monthly * monthsElapsed : -monthly * monthsElapsed;
        }
      }
    }

    return kpiStats.map((stat) => {
      if (stat.label === "Cashflow Position") {
        return { ...stat, value: fmtAUD(adjustedCashflowPos), positive: adjustedCashflowPos >= 0, goalAdjusted: true };
      }
      if (stat.label === "Net Revenue") {
        const baseValue = parseFloat(stat.value.replace(/[^0-9.-]/g, "")) || 0;
        // Reconstruct from raw value stored in kpiStats
        const adjustedNetRev = baseValue + netRevenueAdj;
        return { ...stat, value: fmtAUD(adjustedNetRev), positive: adjustedNetRev >= 0, goalAdjusted: true };
      }
      return stat;
    });
  }, [kpiStats, adjustedData, goals, activeGoalIds, hasActiveGoals]);

  const handleRefresh = () => {
    const gSheets = sources.find((s) => s.id === "google_sheets");
    if (gSheets) syncNow(gSheets.id);
  };

  const formatLastUpdated = (ts: string | null) => {
    if (!ts) return null;
    try {return new Date(ts).toLocaleString();} catch {return ts;}
  };

  const getFormulaForCard = (cardLabel: string) => {
    const formula = formulas.find((f) => f.dashboardCard === cardLabel);
    if (!formula) return null;
    const cached = formulaCache.get(formula.id);
    if (!cached || cached.value === null) return null;
    return { formula, cached };
  };

  const getCardValue = (stat: any) => {
    // Priority: 1) formula cache as BASE, 2) apply goal delta on top, 3) raw stat.value
    const match = getFormulaForCard(stat.label);
    if (match) {
      let baseValue = match.cached.value!;
      // If goal-adjusted, apply the goal delta on top of formula result
      if (stat.goalAdjusted) {
        const rawStatNum = parseFloat(kpiStats.find((s) => s.label === stat.label)?.value?.replace(/[^0-9.-]/g, "") ?? "0") || 0;
        const adjustedNum = parseFloat(stat.value.replace(/[^0-9.-]/g, "")) || 0;
        const goalDelta = adjustedNum - rawStatNum;
        baseValue = baseValue + goalDelta;
      }
      if (stat.label === "Conversion Rate") return `${baseValue.toFixed(1)}%`;
      return fmtAUD(baseValue);
    }
    // No formula — use goal-adjusted or raw value as-is
    return stat.value;
  };

  const getFormulaInfo = (cardLabel: string) => {
    const formula = formulas.find((f) => f.dashboardCard === cardLabel);
    if (!formula) return null;
    const cached = formulaCache.get(formula.id);
    if (!cached || cached.value === null) return null;
    return {
      name: formula.name,
      expression: formula.expression,
      lastComputed: formulaCache.lastComputedAt_value
    };
  };

  const allResults = formulaCache.getAll();
  const activeFormulaCount = Object.values(allResults).filter((r) => r.value !== null).length;
  const formulaLastComputed = formulaCache.lastComputedAt_value;

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-4 md:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-semibold" style={{ fontSize: "clamp(20px, 3vw, 32px)" }}>Business Dashboard</h1>
          <p className="text-muted-foreground font-mono" style={{ fontSize: "clamp(9px, 1vw, 11px)" }}>FY 2026 Overview</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            {lastUpdated &&
            <span className="text-xs font-mono text-muted-foreground block">
                Last updated: {formatLastUpdated(lastUpdated)}
              </span>
            }
            {activeFormulaCount > 0 &&
            <span className="text-[10px] font-mono text-muted-foreground/70 block">
                Formulas: {activeFormulaCount} active · last computed {timeAgo(formulaLastComputed)}
              </span>
            }
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading} className="gap-1.5">
            {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Refresh
          </Button>
          <Badge
            variant={hasLiveData ? "default" : "secondary"}
            className={`font-mono text-xs ${hasLiveData ? "bg-chart-green/20 text-chart-green border-chart-green/30" : ""}`}>
            
            {hasLiveData ?
            <><CheckCircle className="w-3 h-3 mr-1" />Live</> :

            <><Unplug className="w-3 h-3 mr-1" />No Data</>
            }
          </Badge>
        </div>
      </div>

      {isLoading && !hasLiveData &&
      <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground font-mono">Loading data...</span>
        </div>
      }

      {!isLoading && !hasLiveData && (() => {
        const gSheets = sources.find((s) => s.id === "google_sheets");
        const hasWebhook = !!gSheets?.webhookUrl;
        return (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Unplug className="w-12 h-12 text-muted-foreground/40 mb-4" />
            <p className="text-lg text-muted-foreground mb-2">
              {hasWebhook ? "Webhook configured — click Refresh to load data" : "No data source connected"}
            </p>
            <p className="text-sm text-muted-foreground font-mono mb-4">
              {hasWebhook ? "Your n8n webhook URL is saved. Hit Refresh to pull the latest data." : "Add your n8n webhook URL in Settings to get started"}
            </p>
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="w-4 h-4 mr-2" /> {hasWebhook ? "Refresh" : "Retry"}
            </Button>
          </div>);

      })()}

      {hasLiveData &&
      <>
          {/* KPI Cards - responsive grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 items-stretch mb-4 md:mb-6" style={{ gap: "clamp(8px, 1vw, 16px)" }}>
            {adjustedKpiStats.map((stat, i) =>
          <StatCard
            key={stat.label}
            {...stat}
            value={getCardValue(stat)}
            index={i}
            formulaDriven={getFormulaInfo(stat.label)}
            altValue={stat.altValue}
            altChange={stat.altChange}
            altPositive={stat.altPositive} />

          )}
          </div>

          {/* Active Goals */}
          <GoalsDashboardWidgets
          goals={goals}
          formulas={formulas}
          activeGoalIds={activeGoalIds}
          onToggleGoal={handleToggleGoal}
          onToggleMerge={handleToggleMerge} />
        

          {/* Goal Scenarios */}
          <GoalScenarioBar
          goals={goals}
          activeGoalIds={activeGoalIds}
          onToggleGoal={handleToggleGoal}
          onSetAll={handleSetAll}
          onClearAll={handleClearAll}
          netMonthlyEffect={netMonthlyEffect} />
        

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6">
            <PortfolioChart adjustedData={adjustedData} adjustments={adjustments} />
            <SectorAllocationChart />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-4 md:mb-6">
            <CashflowChart adjustedData={adjustedData} adjustments={adjustments} />
            <FundPerformanceChart />
          </div>

          <div className="mb-4 md:mb-6">
            <ForecastChart />
          </div>

          <div className="space-y-4 md:space-y-6">
            <DealPipeline />
            <RevenueProjectsTable />
            <ExpenseBreakdown goals={goals} activeGoalIds={activeGoalIds} />
          </div>
        </>
      }
    </DashboardLayout>);

};

const Index = () => {
  return <DashboardContent />;
};

export default Index;