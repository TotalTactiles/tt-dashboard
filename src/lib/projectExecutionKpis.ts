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

/**
 * Build period options driven by actual quoted jobs data.
 * Only months/quarters with real jobs appear; empty ones are excluded.
 */
export function buildPeriodOptions(jobs: QuotedJob[]): PeriodSpec[] {
  // Collect all valid month keys from job dates
  const monthKeySet = new Set<string>();
  for (const job of jobs) {
    const d = tryParseDate(job.dateQuoted);
    if (d) monthKeySet.add(dateToMonKey(d));
  }

  if (monthKeySet.size === 0) return [];

  // Parse and sort month keys chronologically
  const parsed = Array.from(monthKeySet)
    .map((k) => ({ key: k, date: monKeyToDate(k)! }))
    .filter((p) => p.date !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const options: PeriodSpec[] = [];

  // ── Individual month options ──
  for (const { key, date } of parsed) {
    const yr = date.getFullYear();
    const yr2 = String(yr).slice(-2);
    const mi = date.getMonth();
    const prevMonth = new Date(yr, mi - 1, 1);
    options.push({
      mode: "month",
      key,
      label: `${MONTH_ABBR[mi]} ${yr2}`,
      months: [key],
      priorMonths: [dateToMonKey(prevMonth)],
    });
  }

  // ── Quarter options (only quarters with jobs) ──
  const quarterMap = new Map<string, { months: string[]; yr: number; q: number }>();
  for (const { key, date } of parsed) {
    const yr = date.getFullYear();
    const q = getQuarterForMonth(date.getMonth());
    const qKey = `Q${q}-${String(yr).slice(-2)}`;
    if (!quarterMap.has(qKey)) {
      const qStart = (q - 1) * 3;
      const yr2 = String(yr).slice(-2);
      const qMonths = Array.from({ length: 3 }, (_, i) => `${MONTH_ABBR[qStart + i]}-${yr2}`);
      quarterMap.set(qKey, { months: qMonths, yr, q });
    }
  }

  const sortedQuarters = Array.from(quarterMap.entries()).sort((a, b) => {
    const diff = a[1].yr - b[1].yr;
    return diff !== 0 ? diff : a[1].q - b[1].q;
  });

  for (const [qKey, { months: qMonths, yr, q }] of sortedQuarters) {
    const prevQStart = (q - 1) * 3 - 3;
    const prevYr = prevQStart < 0 ? yr - 1 : yr;
    const prevQStartAdj = prevQStart < 0 ? prevQStart + 12 : prevQStart;
    const prevYr2 = String(prevYr).slice(-2);
    const prevQMonths = Array.from({ length: 3 }, (_, i) => `${MONTH_ABBR[prevQStartAdj + i]}-${prevYr2}`);
    options.push({
      mode: "quarter",
      key: qKey,
      label: `Q${q} ${String(yr).slice(-2)}`,
      months: qMonths,
      priorMonths: prevQMonths,
    });
  }

  // ── YTD options (per year that has jobs) ──
  const years = new Set(parsed.map((p) => p.date.getFullYear()));
  for (const yr of Array.from(years).sort()) {
    const yr2 = String(yr).slice(-2);
    const maxMonth = parsed
      .filter((p) => p.date.getFullYear() === yr)
      .reduce((m, p) => Math.max(m, p.date.getMonth()), 0);
    const ytdMonths = Array.from({ length: maxMonth + 1 }, (_, i) => `${MONTH_ABBR[i]}-${yr2}`);
    const prevYr2 = String(yr - 1).slice(-2);
    const prevYtdMonths = Array.from({ length: maxMonth + 1 }, (_, i) => `${MONTH_ABBR[i]}-${prevYr2}`);
    options.push({
      mode: "ytd",
      key: `YTD-${yr2}`,
      label: `YTD ${yr2}`,
      months: ytdMonths,
      priorMonths: prevYtdMonths,
    });
  }

  return options;
}

// ── Filter helpers ─────────────────────────────────────────────────

function jobEstimatedDateKey(job: QuotedJob): string | null {
  const d = tryParseDate(job.dateQuoted);
  return d ? dateToMonKey(d) : null;
}

function revenueMonthKey(rp: RevenueProject): string | null {
  const d = tryParseDate(rp.invoiceDate) || tryParseDate(rp.otherDate);
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
  isForecast?: boolean;
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
  const completedStatuses = new Set(["paid", "invoiced"]);

  // Try period-specific completed revenue first
  let periodItems = filterByPeriod(revenue, revenueMonthKey, period.months)
    .filter((r) => completedStatuses.has(r.status));
  let isForecast = false;

  // Fallback: if no completed revenue in period, try ALL completed revenue (full dataset)
  if (periodItems.length === 0) {
    periodItems = revenue.filter((r) => completedStatuses.has(r.status));
    isForecast = false; // still actual data, just not period-filtered
    if (periodItems.length === 0) {
      // Second fallback: use all revenue rows regardless of status (pipeline/forecast)
      periodItems = revenue.filter((r) => r.valueExclGST > 0);
      isForecast = true;
      if (periodItems.length === 0) {
        return unavailable("No revenue data available");
      }
    }
  }

  const priorItems = filterByPeriod(revenue, revenueMonthKey, period.priorMonths)
    .filter((r) => completedStatuses.has(r.status));

  const totalRev = periodItems.reduce((s, r) => s + r.valueExclGST, 0);
  const totalGP = periodItems.reduce((s, r) => s + r.grossProfit, 0);

  if (totalRev <= 0) return unavailable("Zero revenue in dataset");

  const margin = (totalGP / totalRev) * 100;

  const priorRev = priorItems.reduce((s, r) => s + r.valueExclGST, 0);
  const priorGP = priorItems.reduce((s, r) => s + r.grossProfit, 0);
  const priorMargin = priorRev > 0 ? (priorGP / priorRev) * 100 : null;
  const diff = priorMargin !== null ? margin - priorMargin : null;

  const contextBase = `${formatMetricValue(totalGP, "currency")} GP on ${formatMetricValue(totalRev, "currency")} rev`;

  return {
    value: margin,
    formatted: `${margin.toFixed(1)}%`,
    change: diff,
    changeFormatted: diff !== null ? `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}pp` : "--",
    context: isForecast ? `Forecast · ${contextBase}` : contextBase,
    isForecast,
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

function calcCashExpected(cashflowData: IncomeOutgoingsPoint[], revenue: RevenueProject[], period: PeriodSpec): KPIResult {
  const monthSet = new Set(period.months);
  const priorSet = new Set(period.priorMonths);

  // Cash expected = revenue from jobs invoiced in the prior month with due dates in the selected month
  const matchingJobs = revenue.filter((r) => {
    const inv = tryParseDate(r.invoiceDate);
    const due = tryParseDate(r.dueDate);
    if (!inv || !due) return false;
    const invKey = dateToMonKey(inv);
    const dueKey = dateToMonKey(due);
    return priorSet.has(invKey) && monthSet.has(dueKey);
  });

  const totalExpected = matchingJobs.reduce((s, r) => s + r.valueInclGST, 0);

  // Prior period comparison: jobs invoiced 2 months ago with due dates in prior month
  // Build a "prior-prior" month set by shifting priorMonths back one month
  const priorPriorSet = new Set<string>();
  for (const mk of priorSet) {
    const d = monKeyToDate(mk);
    if (d) {
      d.setMonth(d.getMonth() - 1);
      priorPriorSet.add(dateToMonKey(d));
    }
  }
  const priorMatchingJobs = revenue.filter((r) => {
    const inv = tryParseDate(r.invoiceDate);
    const due = tryParseDate(r.dueDate);
    if (!inv || !due) return false;
    const invKey = dateToMonKey(inv);
    const dueKey = dateToMonKey(due);
    return priorPriorSet.has(invKey) && priorSet.has(dueKey);
  });
  const priorExpected = priorMatchingJobs.reduce((s, r) => s + r.valueInclGST, 0);
  const diff = priorSet.size > 0 ? totalExpected - priorExpected : null;

  // Outgoings from cashflow data for the selected period
  const periodPoints = cashflowData.filter((p) => monthSet.has(p.month));
  const totalOutgoings = periodPoints.reduce((s, p) => s + p.outgoings, 0);

  if (matchingJobs.length === 0 && periodPoints.length === 0) return unavailable("No data for period");

  return {
    value: totalExpected,
    formatted: formatMetricValue(totalExpected, "currency"),
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
