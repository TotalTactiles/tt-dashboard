import { useState, useMemo, useCallback, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { formatMetricValue } from "@/lib/formatMetricValue";
import PortfolioChart from "@/components/dashboard/PortfolioChart";
import SectorAllocationChart from "@/components/dashboard/SectorAllocationChart";
import DealPipeline from "@/components/dashboard/DealPipeline";
import CashflowChart from "@/components/dashboard/CashflowChart";
import FundPerformanceChart from "@/components/dashboard/FundPerformanceChart";
import ForecastChart from "@/components/dashboard/ForecastChart";
import ProjectExecutionKPIs from "@/components/dashboard/ProjectExecutionKPIs";
import RevenueProjectsTable from "@/components/dashboard/RevenueProjectsTable";
import ExpenseBreakdown from "@/components/dashboard/ExpenseBreakdown";
import DashboardLayout from "@/components/DashboardLayout";
import GoalsDashboardWidgets from "@/components/goals/GoalsDashboardWidgets";
import GoalScenarioBar from "@/components/dashboard/GoalScenarioBar";
import { useGoals } from "@/hooks/useGoals";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { applyGoalMerge } from "@/lib/goalMerge";
import { buildPeriodOptions, getCurrentMonthKey } from "@/lib/projectExecutionKpis";
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
  const { formulas, kpiStats, hasLiveData, connectedCount, dataHealth, isLoading, isRefreshing, lastUpdated, sources, syncNow, formulaCache, incomeOutgoingsData, quotedJobs, investorMetrics, isOffline, lastCachedAt, revenueProjects, dataStore, liveData } = useDashboardData();

  // ── Shared period state — resets to current month on every mount/data change ──
  const periodOptions = useMemo(() => buildPeriodOptions(quotedJobs, revenueProjects), [quotedJobs, revenueProjects]);
  const defaultPeriodIdx = useMemo(() => {
    const currentKey = getCurrentMonthKey();
    // 1. Current month if available
    const exactIdx = periodOptions.findIndex((p) => p.mode === "month" && p.months.includes(currentKey));
    if (exactIdx >= 0) return exactIdx;

    // 2. Latest available month in current year up to today
    const now = new Date();
    const curYr2 = String(now.getFullYear()).slice(-2);
    const curMonNum = now.getMonth();
    const ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    let bestIdx = -1;
    let bestMon = -1;
    for (let i = 0; i < periodOptions.length; i++) {
      const p = periodOptions[i];
      if (p.mode !== "month") continue;
      const mk = p.months[0]; // e.g. "Mar-26"
      const match = mk?.match(/^([A-Za-z]{3})-(\d{2})$/);
      if (!match) continue;
      const mIdx = ABBR.indexOf(match[1]);
      const yr = match[2];
      if (yr === curYr2 && mIdx <= curMonNum && mIdx > bestMon) {
        bestMon = mIdx;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) return bestIdx;

    // 3. Current-year YTD
    const ytdIdx = periodOptions.findIndex((p) => p.mode === "ytd" && p.key === `YTD-${curYr2}`);
    if (ytdIdx >= 0) return ytdIdx;

    // 4. Latest valid available option
    const monthOptions = periodOptions.filter((p) => p.mode === "month");
    if (monthOptions.length > 0) {
      return periodOptions.indexOf(monthOptions[monthOptions.length - 1]);
    }
    return 0;
  }, [periodOptions]);

  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState(defaultPeriodIdx);

  // Reset to default on every data reload / remount
  useEffect(() => {
    setSelectedPeriodIdx(defaultPeriodIdx);
    setShowAllTables(false);
  }, [defaultPeriodIdx]);

  const selectedPeriod = periodOptions[selectedPeriodIdx] ?? null;

  // ── Shared "All" toggle for both tables — always starts OFF ──
  const [showAllTables, setShowAllTables] = useState(false);
  const [invoiceFilter, setInvoiceFilter] = useState<"invoiced" | "to_be_invoiced">("invoiced");
  const [investorScope, setInvestorScope] = useState<"ytd" | "quarter">("ytd");

  // ── Compute date windows from real current date ──────────────────
  const investorDateWindows = useMemo(() => {
    const now = new Date();
    const yr = now.getFullYear();
    const mo = now.getMonth(); // 0-indexed
    const ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const yr2 = String(yr).slice(-2);

    // YTD: Jan of current year → current month inclusive
    const ytdMonths: string[] = [];
    for (let i = 0; i <= mo; i++) ytdMonths.push(`${ABBR[i]}-${yr2}`);

    // Current quarter: Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec
    const qNum = Math.floor(mo / 3) + 1;
    const qStart = (qNum - 1) * 3;
    const qMonths: string[] = [];
    for (let i = qStart; i < qStart + 3 && i <= mo; i++) qMonths.push(`${ABBR[i]}-${yr2}`);
    const qLabel = `Q${qNum} ${yr} (${ABBR[qStart]}–${ABBR[Math.min(qStart + 2, 11)]})`;

    return { ytdMonths, qMonths, qLabel, yr, yr2, mo, ABBR };
  }, []);

  // ── Filter source data to active scope ───────────────────────────
  const scopedInvestorData = useMemo(() => {
    const { ytdMonths, qMonths } = investorDateWindows;
    const activeMonths = investorScope === "ytd" ? ytdMonths : qMonths;
    const activeMonthSet = new Set(activeMonths);

    const dateToMK = (s: string): string | null => {
      if (!s) return null;
      const d = new Date(s);
      if (isNaN(d.getTime())) return null;
      const A = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      return `${A[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
    };

    // Revenue projects in scope
    const scopedRevenue = revenueProjects.filter(rp => {
      const mk = dateToMK(rp.invoiceDate) ?? dateToMK(rp.otherDate);
      return mk ? activeMonthSet.has(mk) : false;
    });

    // Quoted jobs in scope (by dateQuoted)
    const scopedQuotes = quotedJobs.filter(j => {
      const mk = dateToMK(j.dateQuoted);
      return mk ? activeMonthSet.has(mk) : false;
    });

    // Won jobs in scope
    const scopedWonOnly = scopedQuotes.filter(j => j.status === "won");

    // Revenue metrics
    const revenueExGST = scopedRevenue.reduce((s, r) => s + r.valueExclGST, 0);
    const totalCOGS = scopedRevenue.reduce((s, r) => s + r.totalCOGS, 0);
    const grossProfit = revenueExGST - totalCOGS;
    const grossMarginPct = revenueExGST > 0 ? (grossProfit / revenueExGST) * 100 : 0;

    // Expenses from cashflow
    const rawCF = (liveData as any)?.cashflow as any[] ?? [];
    const findCFRow = (label: string) => rawCF.find((r: any) => {
      const l = String(r._label_rowLabel ?? r.col_1 ?? "").toUpperCase().trim();
      return l === label.toUpperCase();
    });
    const opexRow = findCFRow("TOTAL OPERATING EXPENSES (INCL. SALARIES)");
    const labourRow = findCFRow("TOTAL COST OF SALES");
    const parseN = (v: any) => { const n = parseFloat(String(v ?? "0").replace(/[$,()]/g, "")); return isNaN(n) ? 0 : Math.abs(n); };
    const totalExpenses = activeMonths.reduce((s, mk) => s + parseN(opexRow?.[mk]), 0);
    const totalLabour = activeMonths.reduce((s, mk) => s + parseN(labourRow?.[mk]), 0);
    const netProfit = revenueExGST - totalExpenses;
    const opExpRatio = revenueExGST > 0 ? (totalExpenses / revenueExGST) * 100 : 0;
    const labourRatio = revenueExGST > 0 ? (totalLabour / revenueExGST) * 100 : 0;

    // Job metrics
    const wonCount = scopedWonOnly.length;
    const totalCount = scopedQuotes.length;
    const avgWon = wonCount > 0 ? scopedWonOnly.reduce((s, j) => s + j.value, 0) / wonCount : 0;
    const avgQuoted = totalCount > 0 ? scopedQuotes.reduce((s, j) => s + j.value, 0) / totalCount : 0;
    const revPerJobWon = wonCount > 0 ? revenueExGST / wonCount : 0;
    const revPerJobQuoted = totalCount > 0 ? revenueExGST / totalCount : 0;

    // Pipeline coverage: all pending+yellow / revenueExGST
    const pipelineVal = quotedJobs
      .filter(j => j.status === "pending" || j.status === "yellow")
      .reduce((s, j) => s + j.value, 0);
    const pipelineCoverage = revenueExGST > 0 ? pipelineVal / revenueExGST : 0;

    // Debt service ratio
    const im_full = investorMetrics as any;
    const bizLoan = im_full?.bizLoanMonthly ?? 4318;
    const carLoan = im_full?.carLoanMonthly ?? 1223;
    const monthlyDebt = bizLoan + carLoan;
    const annualDebt = monthlyDebt * 12;
    const dsrValue = revenueExGST > 0 ? (annualDebt / revenueExGST) * 100 : 0;

    return {
      revenueExGST, totalCOGS, grossProfit, grossMarginPct,
      totalExpenses, totalLabour, netProfit, opExpRatio, labourRatio,
      wonCount, totalCount, avgWon, avgQuoted, revPerJobWon, revPerJobQuoted,
      pipelineVal, pipelineCoverage, dsrValue, bizLoan, carLoan, monthlyDebt, annualDebt,
      scopedMonthCount: activeMonths.length,
    };
  }, [investorScope, investorDateWindows, revenueProjects, quotedJobs, liveData, investorMetrics]);

  // Find current-year YTD index for auto-switch
  const currentYearYtdIdx = useMemo(() => {
    const yr2 = String(new Date().getFullYear()).slice(-2);
    return periodOptions.findIndex((p) => p.mode === "ytd" && p.key === `YTD-${yr2}`);
  }, [periodOptions]);

  // When user clicks "All" on either table → both tables enter/exit All mode
  const handleTableAllToggle = useCallback((allOn: boolean) => {
    setShowAllTables(allOn);
    if (allOn && currentYearYtdIdx >= 0) {
      setSelectedPeriodIdx(currentYearYtdIdx);
    }
  }, [currentYearYtdIdx]);

  // When user changes the period selector → exit All mode for both tables
  const handlePeriodChange = useCallback((idx: number) => {
    setSelectedPeriodIdx(idx);
    setShowAllTables(false);
  }, []);

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

    const now = new Date();
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonthKey = `${MONTHS[now.getMonth()]}-${String(now.getFullYear()).slice(-2)}`;

    let adjustedCashflowPos = 0;
    const currentPoint = adjustedData.find((p) => p.month === currentMonthKey);
    if (currentPoint && currentPoint.surplus !== 0) {
      adjustedCashflowPos = currentPoint.surplus;
    } else {
      const currentIdx = adjustedData.findIndex((p) => p.month === currentMonthKey);
      const startIdx = currentIdx >= 0 ? currentIdx : 0;
      for (let i = startIdx; i < adjustedData.length; i++) {
        if (adjustedData[i].surplus !== 0) {adjustedCashflowPos = adjustedData[i].surplus;break;}
      }
      if (adjustedCashflowPos === 0) {
        for (let i = adjustedData.length - 1; i >= 0; i--) {
          if (adjustedData[i].surplus !== 0) {adjustedCashflowPos = adjustedData[i].surplus;break;}
        }
      }
    }

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
    const match = getFormulaForCard(stat.label);
    if (match) {
      let baseValue = match.cached.value!;
      if (stat.goalAdjusted) {
        const rawStatNum = parseFloat(kpiStats.find((s) => s.label === stat.label)?.value?.replace(/[^0-9.-]/g, "") ?? "0") || 0;
        const adjustedNum = parseFloat(stat.value.replace(/[^0-9.-]/g, "")) || 0;
        const goalDelta = adjustedNum - rawStatNum;
        baseValue = baseValue + goalDelta;
      }
      if (stat.label === "Conversion Rate") return `${baseValue.toFixed(1)}%`;
      return fmtAUD(baseValue);
    }
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
          <h1 className="font-semibold" style={{ fontSize: "clamp(20px, 3vw, 32px)" }}>Total Tactiles Business Dashboard</h1>
          <p className="text-muted-foreground font-mono" style={{ fontSize: "clamp(9px, 1vw, 11px)" }}>K & M Legacy View</p>
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
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading || isRefreshing} className="gap-1.5">
            {isLoading || isRefreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {isRefreshing ? "Refreshing…" : "Refresh"}
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

      {isOffline && (lastCachedAt || hasLiveData) && (
        <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 px-4 py-2.5 mb-4">
          <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
            <span>⚡</span>
            <span className="font-medium">Offline mode</span>
            <span className="text-amber-600 dark:text-amber-400">
              {lastCachedAt
                ? `Showing cached data from ${new Date(lastCachedAt).toLocaleString("en-AU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`
                : "Showing last known data"}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => syncNow("google_sheets")} className="text-amber-700 border-amber-300 hover:bg-amber-100 dark:text-amber-200 dark:border-amber-600 dark:hover:bg-amber-900/40">
            Retry
          </Button>
        </div>
      )}

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

          {investorMetrics && (() => {
            const sd = scopedInvestorData;
            const { yr, mo, ABBR } = investorDateWindows;

            const fmtVal = (n: number) => {
              const abs = Math.abs(n);
              const sign = n < 0 ? '-' : '';
              if (abs >= 1_000_000) return `${sign}$${(abs/1_000_000).toFixed(2).replace(/\.?0+$/,'')}M`;
              if (abs >= 1_000)     return `${sign}$${(abs/1_000).toFixed(1).replace(/\.?0+$/,'')}K`;
              return `${sign}$${Math.round(abs).toLocaleString()}`;
            };

            const scopeLabel = investorScope === "ytd"
              ? `Jan–${ABBR[mo]} ${yr} YTD`
              : investorDateWindows.qLabel;

            const ebitdaMarginPct = sd.revenueExGST > 0
              ? `${((sd.grossProfit / sd.revenueExGST) * 100).toFixed(1)}% margin`
              : "--";
            const netProfitMarginPct = sd.revenueExGST > 0
              ? `${((sd.netProfit / sd.revenueExGST) * 100).toFixed(1)}% margin`
              : "--";
            const gmPct = sd.grossMarginPct.toFixed(2);

            return (
            <div className="mt-4 mb-4">
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Investor Metrics</span>
                <div className="flex-1 h-px bg-border" />
                <div className="flex rounded-full bg-secondary/80 p-0.5 leading-none" style={{ fontSize: "clamp(8px, 0.85vw, 10px)" }}>
                  {(["ytd", "quarter"] as const).map((scope) => (
                    <button
                      key={scope}
                      onClick={() => setInvestorScope(scope)}
                      className={`px-1.5 py-0.5 rounded-full transition-all duration-150 font-mono whitespace-nowrap ${investorScope === scope ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >{scope === "ytd" ? "This Year" : investorDateWindows.qLabel}</button>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground font-mono">Business Health</span>
              </div>
              <div className="text-xs font-mono text-muted-foreground/70 bg-secondary/40 border border-border/50 rounded px-3 py-1.5 mb-3">
                {investorScope === "ytd"
                  ? `Jan–${ABBR[mo]} ${yr} YTD · ${investorDateWindows.ytdMonths.length} months`
                  : `${investorDateWindows.qLabel} · ${investorDateWindows.qMonths.length} months to date`}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" style={{ containerType: 'inline-size' }}>
                <StatCard
                  label="Profitability"
                  value={fmtVal(sd.grossProfit)}
                  change={ebitdaMarginPct}
                  positive={sd.grossProfit >= 0}
                  index={10}
                  momContext={scopeLabel}
                  altValue={fmtVal(sd.netProfit)}
                  altChange={netProfitMarginPct}
                  altPositive={sd.netProfit >= 0}
                  altMomContext={scopeLabel}
                      toggleLabelBase="Net Profit"
                      toggleLabelAlt="Gross Profit"
                  greenAltPill={true}
                />
                <StatCard
                  label="Gross Margin %"
                  value={`${gmPct}%`}
                  change={`avg ${gmPct}%`}
                  positive={sd.grossMarginPct >= 30}
                  index={11}
                  momContext={scopeLabel}
                />
                <StatCard
                  label="Revenue Growth"
                  value={fmtVal(sd.revenueExGST)}
                  change={scopeLabel}
                  positive={true}
                  index={12}
                  momContext={`${sd.wonCount} jobs won`}
                />
                <StatCard
                  label="Pipeline Coverage"
                  value={`${sd.pipelineCoverage.toFixed(1)}x`}
                  change={fmtVal(sd.pipelineVal) + " pipeline"}
                  positive={sd.pipelineCoverage >= 2}
                  index={13}
                />
                <StatCard
                  label="Avg Contract Value"
                  value={fmtVal(sd.avgWon)}
                  change={`${sd.wonCount} jobs won`}
                  positive={true}
                  index={14}
                  altValue={fmtVal(sd.avgQuoted)}
                  altChange={`${sd.totalCount} jobs quoted`}
                  altPositive={true}
                  toggleLabelBase="Won"
                  toggleLabelAlt="Quoted"
                  greenAltPill={true}
                />
                <StatCard
                  label="Op. Expense Ratio"
                  value={`${sd.opExpRatio.toFixed(1)}%`}
                  change="Expenses / Revenue"
                  positive={sd.opExpRatio < 60}
                  index={15}
                  altValue={fmtVal(sd.totalExpenses)}
                  altChange={`${scopeLabel} expenses`}
                  altPositive={sd.opExpRatio < 60}
                  toggleLabelBase="Ratio"
                  toggleLabelAlt="$"
                  greenAltPill={true}
                />
                <StatCard
                  label="Labour Cost Ratio"
                  value={`${sd.labourRatio.toFixed(1)}%`}
                  change="Labour / Revenue"
                  positive={sd.labourRatio < 35}
                  index={16}
                  altValue={fmtVal(sd.totalLabour)}
                  altChange={`${scopeLabel} labour`}
                  altPositive={sd.labourRatio < 35}
                  toggleLabelBase="Ratio"
                  toggleLabelAlt="$"
                  greenAltPill={true}
                />
                <StatCard
                  label="Revenue Per Job"
                  value={fmtVal(sd.revPerJobWon)}
                  change={`${sd.wonCount} jobs won`}
                  positive={true}
                  index={17}
                  altValue={fmtVal(sd.revPerJobQuoted)}
                  altChange={`${sd.totalCount} jobs quoted`}
                  altPositive={true}
                  toggleLabelBase="Won"
                  toggleLabelAlt="Quoted"
                  greenAltPill={true}
                />
                <StatCard
                  label="CAC Per Client"
                  value="N/A (no ad spend)"
                  change="$0/mo ads"
                  positive={true}
                  index={18}
                />
                <StatCard
                  label="Debt Service Ratio"
                  value={`${sd.dsrValue.toFixed(1)}%`}
                  change={`$${((sd.bizLoan + sd.carLoan) * 12 / 1000).toFixed(1)}K/yr annualised`}
                  positive={sd.dsrValue <= 25}
                  index={19}
                  momContext={sd.dsrValue <= 15 ? "Healthy — under 15%" : sd.dsrValue > 25 ? "High — above 25%" : "Monitor — 15–25%"}
                />
              </div>
            </div>
            );
          })()}

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
            <CashflowChart adjustedData={adjustedData} adjustments={adjustments} hasActiveGoals={hasActiveGoals} />
            <FundPerformanceChart />
          </div>

          <div className="mb-4 md:mb-6">
            <ForecastChart />
          </div>

          <ProjectExecutionKPIs selectedPeriodIdx={selectedPeriodIdx} onPeriodChange={handlePeriodChange} invoiceFilter={invoiceFilter} onInvoiceFilterChange={setInvoiceFilter} />

          <div className="space-y-4 md:space-y-6">
            <DealPipeline
              periodFilter={selectedPeriod}
              showAll={showAllTables}
              onAllToggle={handleTableAllToggle}
            />
            <RevenueProjectsTable
              periodFilter={selectedPeriod}
              showAll={showAllTables}
              onAllToggle={handleTableAllToggle}
              invoiceFilter={invoiceFilter}
            />
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
