/**
 * Project Execution KPI calculations — V2
 *
 * Uses ONLY data available from Google Sheets:
 *   QUOTES  → QuotedJob[]
 *   REVENUE → RevenueProject[]
 *   CASHFLOW → IncomeOutgoingsPoint[]
 */

import type { QuotedJob, RevenueProject, IncomeOutgoingsPoint } from "@/contexts/DashboardDataContext";
import { formatMetricValue } from "@/lib/formatMetricValue";

// ── Helpers ────────────────────────────────────────────────────────

const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"] as const;

function dateToMonKey(d: Date): string {
  return `${MONTH_ABBR[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
}

function tryParseDate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** Parse "Mon-YY" → Date or null */
function monKeyToDate(key: string): Date | null {
  const m = key.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2})$/i);
  if (!m) return null;
  return new Date(2000 + parseInt(m[2]), MONTH_ABBR.indexOf(m[1] as any), 1);
}

// ── Period helpers ─────────────────────────────────────────────────

export type PeriodMode = "month" | "quarter" | "ytd";

export interface PeriodSpec {
  mode: PeriodMode;
  key: string;
  label: string;
  months: string[];
  priorMonths: string[];
}

export function getCurrentMonthKey(): string {
  return dateToMonKey(new Date());
}

export function getQuarterForMonth(monthIdx: number): number {
  return Math.floor(monthIdx / 3) + 1;
}

export function buildPeriodOptions(now: Date = new Date()): PeriodSpec[] {
  const yr = now.getFullYear();
  const yr2 = String(yr).slice(-2);
  const mi = now.getMonth();
  const options: PeriodSpec[] = [];

  // Current month
  const curKey = dateToMonKey(now);
  const prevMonth = new Date(yr, mi - 1, 1);
  options.push({
    mode: "month",
    key: curKey,
    label: `${MONTH_ABBR[mi]} ${yr}`,
    months: [curKey],
    priorMonths: [dateToMonKey(prevMonth)],
  });

  // Current quarter
  const q = getQuarterForMonth(mi);
  const qStart = (q - 1) * 3;
  const qMonths = Array.from({ length: 3 }, (_, i) => `${MONTH_ABBR[qStart + i]}-${yr2}`);
  const prevQStart = qStart - 3;
  const prevYr = prevQStart < 0 ? yr - 1 : yr;
  const prevQStartAdj = prevQStart < 0 ? prevQStart + 12 : prevQStart;
  const prevYr2 = String(prevYr).slice(-2);
  const prevQMonths = Array.from({ length: 3 }, (_, i) => `${MONTH_ABBR[prevQStartAdj + i]}-${prevYr2}`);
  options.push({
    mode: "quarter",
    key: `Q${q}-${yr2}`,
    label: `Q${q} ${yr}`,
    months: qMonths,
    priorMonths: prevQMonths,
  });

  // YTD
  const ytdMonths = Array.from({ length: mi + 1 }, (_, i) => `${MONTH_ABBR[i]}-${yr2}`);
  const prevYtdMonths = Array.from({ length: mi + 1 }, (_, i) => `${MONTH_ABBR[i]}-${String(yr - 1).slice(-2)}`);
  options.push({
    mode: "ytd",
    key: `YTD-${yr2}`,
    label: `YTD ${yr}`,
    months: ytdMonths,
    priorMonths: prevYtdMonths,
  });

  return options;
}

// ── Filter helpers ─────────────────────────────────────────────────

function jobEstimatedDateKey(job: QuotedJob): string | null {
  const d = tryParseDate(job.dateQuoted);
  return d ? dateToMonKey(d) : null;
}

function revenueMonthKey(rp: RevenueProject): string | null {
  const d = tryParseDate(rp.otherDate) || tryParseDate(rp.invoiceDate);
  return d ? dateToMonKey(d) : null;
}

function filterByPeriod<T>(items: T[], keyFn: (item: T) => string | null, months: string[]): T[] {
  const set = new Set(months);
  return items.filter((item) => {
    const k = keyFn(item);
    return k !== null && set.has(k);
  });
}

// ── KPI Result ─────────────────────────────────────────────────────

export interface KPIResult {
  value: number | null;
  formatted: string;
  change: number | null;
  changeFormatted: string;
  context: string;
  unavailableReason?: string;
}

function unavailable(reason: string): KPIResult {
  return { value: null, formatted: "--", change: null, changeFormatted: "--", context: "Data unavailable", unavailableReason: reason };
}

// ── 1. ACTIVE JOBS ─────────────────────────────────────────────────

function calcActiveJobs(jobs: QuotedJob[], period: PeriodSpec): KPIResult {
  const activeStatuses = new Set(["pending", "yellow"]);
  const allActive = jobs.filter((j) => activeStatuses.has(j.status));
  const periodJobs = filterByPeriod(allActive, jobEstimatedDateKey, period.months);
  const priorJobs = filterByPeriod(allActive, jobEstimatedDateKey, period.priorMonths);

  const count = periodJobs.length;
  const priorCount = priorJobs.length;
  const diff = count - priorCount;

  const pending = periodJobs.filter((j) => j.status === "pending").length;
  const yellow = periodJobs.filter((j) => j.status === "yellow").length;

  return {
    value: count,
    formatted: String(count),
    change: priorCount > 0 ? diff : null,
    changeFormatted: priorCount > 0 ? `${diff >= 0 ? "+" : ""}${diff}` : "--",
    context: `${pending} pending · ${yellow} yellow`,
  };
}

// ── 2. OVERDUE JOBS ────────────────────────────────────────────────

function calcOverdueJobs(jobs: QuotedJob[]): KPIResult {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeStatuses = new Set(["pending", "yellow"]);
  const activeJobs = jobs.filter((j) => activeStatuses.has(j.status));
  if (activeJobs.length === 0) {
    return { value: 0, formatted: "0", change: null, changeFormatted: "--", context: "No active jobs" };
  }

  const overdue = activeJobs.filter((j) => {
    const d = tryParseDate(j.dateQuoted);
    return d !== null && d < today;
  });

  const pct = activeJobs.length > 0 ? Math.round((overdue.length / activeJobs.length) * 100) : 0;

  return {
    value: overdue.length,
    formatted: String(overdue.length),
    change: null,
    changeFormatted: "--",
    context: `${pct}% of ${activeJobs.length} active jobs`,
  };
}

// ── 3. JOBS DUE THIS PERIOD ───────────────────────────────────────

function calcJobsDuePeriod(jobs: QuotedJob[], period: PeriodSpec): KPIResult {
  const periodJobs = filterByPeriod(jobs, jobEstimatedDateKey, period.months);
  const priorJobs = filterByPeriod(jobs, jobEstimatedDateKey, period.priorMonths);

  const count = periodJobs.length;
  const priorCount = priorJobs.length;
  const diff = count - priorCount;

  const totalValue = periodJobs.reduce((s, j) => s + j.value, 0);

  return {
    value: count,
    formatted: String(count),
    change: priorCount > 0 ? diff : null,
    changeFormatted: priorCount > 0 ? `${diff >= 0 ? "+" : ""}${diff} vs prior` : "--",
    context: `${formatMetricValue(totalValue, "currency")} pipeline`,
  };
}

// ── 4. WEIGHTED GROSS MARGIN ──────────────────────────────────────

function calcWeightedGrossMargin(revenue: RevenueProject[], period: PeriodSpec): KPIResult {
  const periodItems = filterByPeriod(revenue, revenueMonthKey, period.months)
    .filter((r) => r.status === "paid" || r.status === "invoiced");
  const priorItems = filterByPeriod(revenue, revenueMonthKey, period.priorMonths)
    .filter((r) => r.status === "paid" || r.status === "invoiced");

  if (periodItems.length === 0) {
    return unavailable("No completed revenue in period");
  }

  const totalRev = periodItems.reduce((s, r) => s + r.valueExclGST, 0);
  const totalGP = periodItems.reduce((s, r) => s + r.grossProfit, 0);

  if (totalRev <= 0) return unavailable("Zero revenue in period");

  const margin = (totalGP / totalRev) * 100;

  const priorRev = priorItems.reduce((s, r) => s + r.valueExclGST, 0);
  const priorGP = priorItems.reduce((s, r) => s + r.grossProfit, 0);
  const priorMargin = priorRev > 0 ? (priorGP / priorRev) * 100 : null;
  const diff = priorMargin !== null ? margin - priorMargin : null;

  return {
    value: margin,
    formatted: `${margin.toFixed(1)}%`,
    change: diff,
    changeFormatted: diff !== null ? `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}pp` : "--",
    context: `${formatMetricValue(totalGP, "currency")} GP on ${formatMetricValue(totalRev, "currency")} rev`,
  };
}

// ── 5. REVENUE PER JOB ────────────────────────────────────────────

function calcRevenuePerJob(revenue: RevenueProject[], period: PeriodSpec): KPIResult {
  const periodItems = filterByPeriod(revenue, revenueMonthKey, period.months)
    .filter((r) => r.valueExclGST > 0);
  const priorItems = filterByPeriod(revenue, revenueMonthKey, period.priorMonths)
    .filter((r) => r.valueExclGST > 0);

  if (periodItems.length === 0) return unavailable("No revenue jobs in period");

  const totalRev = periodItems.reduce((s, r) => s + r.valueExclGST, 0);
  const avg = totalRev / periodItems.length;

  const priorRev = priorItems.reduce((s, r) => s + r.valueExclGST, 0);
  const priorAvg = priorItems.length > 0 ? priorRev / priorItems.length : null;
  const diff = priorAvg !== null ? avg - priorAvg : null;

  return {
    value: avg,
    formatted: formatMetricValue(avg, "currency"),
    change: diff,
    changeFormatted: diff !== null ? `${diff >= 0 ? "+" : ""}${formatMetricValue(diff, "currency")}` : "--",
    context: `${periodItems.length} jobs`,
  };
}

// ── 6. GROSS PROFIT PER JOB ──────────────────────────────────────

function calcGrossProfitPerJob(revenue: RevenueProject[], period: PeriodSpec): KPIResult {
  const periodItems = filterByPeriod(revenue, revenueMonthKey, period.months)
    .filter((r) => r.valueExclGST > 0);
  const priorItems = filterByPeriod(revenue, revenueMonthKey, period.priorMonths)
    .filter((r) => r.valueExclGST > 0);

  if (periodItems.length === 0) return unavailable("No revenue jobs in period");

  const totalGP = periodItems.reduce((s, r) => s + r.grossProfit, 0);
  const avg = totalGP / periodItems.length;

  const priorGP = priorItems.reduce((s, r) => s + r.grossProfit, 0);
  const priorAvg = priorItems.length > 0 ? priorGP / priorItems.length : null;
  const diff = priorAvg !== null ? avg - priorAvg : null;

  return {
    value: avg,
    formatted: formatMetricValue(avg, "currency"),
    change: diff,
    changeFormatted: diff !== null ? `${diff >= 0 ? "+" : ""}${formatMetricValue(diff, "currency")}` : "--",
    context: `${periodItems.length} jobs`,
  };
}

// ── 7. CASH EXPECTED THIS PERIOD ──────────────────────────────────

function calcCashExpected(cashflowData: IncomeOutgoingsPoint[], period: PeriodSpec): KPIResult {
  const monthSet = new Set(period.months);
  const priorSet = new Set(period.priorMonths);

  const periodPoints = cashflowData.filter((p) => monthSet.has(p.month));
  const priorPoints = cashflowData.filter((p) => priorSet.has(p.month));

  if (periodPoints.length === 0) return unavailable("No cashflow data for period");

  const totalIncome = periodPoints.reduce((s, p) => s + p.income, 0);
  const priorIncome = priorPoints.reduce((s, p) => s + p.income, 0);
  const diff = priorPoints.length > 0 ? totalIncome - priorIncome : null;

  const totalOutgoings = periodPoints.reduce((s, p) => s + p.outgoings, 0);

  return {
    value: totalIncome,
    formatted: formatMetricValue(totalIncome, "currency"),
    change: diff,
    changeFormatted: diff !== null ? `${diff >= 0 ? "+" : ""}${formatMetricValue(diff, "currency")}` : "--",
    context: `${formatMetricValue(totalOutgoings, "currency")} outgoings`,
  };
}

// ── Aggregate runner ───────────────────────────────────────────────

export interface ExecutionKPIs {
  activeJobs: KPIResult;
  overdueJobs: KPIResult;
  jobsDuePeriod: KPIResult;
  weightedGrossMargin: KPIResult;
  revenuePerJob: KPIResult;
  grossProfitPerJob: KPIResult;
  cashExpected: KPIResult;
}

export function computeExecutionKPIs(
  jobs: QuotedJob[],
  revenue: RevenueProject[],
  cashflowData: IncomeOutgoingsPoint[],
  period: PeriodSpec,
): ExecutionKPIs {
  return {
    activeJobs: calcActiveJobs(jobs, period),
    overdueJobs: calcOverdueJobs(jobs),
    jobsDuePeriod: calcJobsDuePeriod(jobs, period),
    weightedGrossMargin: calcWeightedGrossMargin(revenue, period),
    revenuePerJob: calcRevenuePerJob(revenue, period),
    grossProfitPerJob: calcGrossProfitPerJob(revenue, period),
    cashExpected: calcCashExpected(cashflowData, period),
  };
}
