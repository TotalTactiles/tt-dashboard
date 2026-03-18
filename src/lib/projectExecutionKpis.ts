/**
 * Project Execution KPI calculations.
 *
 * Each function operates on the arrays already available in the dashboard
 * context (QuotedJob[], RevenueProject[]).  Where a required field is
 * absent the function returns `null` so the UI can render "Data unavailable"
 * instead of fabricating a number.
 */

import type { QuotedJob, RevenueProject } from "@/contexts/DashboardDataContext";

// ── Helpers ────────────────────────────────────────────────────────

const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"] as const;

/** Parse "Mon-YY" → { month, year } or null */
function parseMonKey(key: string): { month: number; year: number } | null {
  const m = key.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2})$/i);
  if (!m) return null;
  return { month: MONTH_ABBR.indexOf(m[1] as any), year: 2000 + parseInt(m[2]) };
}

/** Date → "Mon-YY" */
function dateToMonKey(d: Date): string {
  return `${MONTH_ABBR[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
}

/** Attempt to parse any date-ish string */
function tryParseDate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// ── Period helpers ─────────────────────────────────────────────────

export type PeriodMode = "month" | "quarter" | "ytd";

export interface PeriodSpec {
  mode: PeriodMode;
  /** For month: "Mar-26"; for quarter: "Q1-26"; for ytd: "YTD-26" */
  key: string;
  /** Human label */
  label: string;
  /** Month keys included in this period */
  months: string[];
  /** Prior comparison period month keys */
  priorMonths: string[];
}

export function getCurrentMonthKey(): string {
  return dateToMonKey(new Date());
}

export function getQuarterForMonth(monthIdx: number): number {
  return Math.floor(monthIdx / 3) + 1;
}

/** Build the selectable periods from the current date */
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
  const qMonths = Array.from({ length: 3 }, (_, i) =>
    `${MONTH_ABBR[qStart + i]}-${yr2}`
  );
  const prevQStart = qStart - 3;
  const prevYr = prevQStart < 0 ? yr - 1 : yr;
  const prevQStartAdj = prevQStart < 0 ? prevQStart + 12 : prevQStart;
  const prevYr2 = String(prevYr).slice(-2);
  const prevQMonths = Array.from({ length: 3 }, (_, i) =>
    `${MONTH_ABBR[prevQStartAdj + i]}-${prevYr2}`
  );
  options.push({
    mode: "quarter",
    key: `Q${q}-${yr2}`,
    label: `Q${q} ${yr}`,
    months: qMonths,
    priorMonths: prevQMonths,
  });

  // YTD (Jul–now for Australian FY, or Jan–now)
  // Using calendar year for simplicity
  const ytdMonths = Array.from({ length: mi + 1 }, (_, i) =>
    `${MONTH_ABBR[i]}-${yr2}`
  );
  const prevYtdMonths = Array.from({ length: mi + 1 }, (_, i) =>
    `${MONTH_ABBR[i]}-${String(yr - 1).slice(-2)}`
  );
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

function jobMonthKey(job: QuotedJob): string | null {
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

// ── KPI Result types ───────────────────────────────────────────────

export interface KPIResult {
  value: number | null;
  formatted: string;
  change: number | null;
  changeFormatted: string;
  context: string;
  unavailableReason?: string;
}

function pct(v: number | null): string {
  if (v === null) return "--";
  return `${v >= 0 ? "" : ""}${v.toFixed(1)}%`;
}

function changePct(current: number | null, prior: number | null): { change: number | null; changeFormatted: string } {
  if (current === null || prior === null) return { change: null, changeFormatted: "--" };
  const diff = current - prior;
  return { change: diff, changeFormatted: `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}pp` };
}

// ── 1. On-Time Delivery % ──────────────────────────────────────────

export function calcOnTimeDelivery(
  jobs: QuotedJob[],
  period: PeriodSpec,
  priorPeriod: PeriodSpec | null
): KPIResult {
  // We need completion_date and estimated_job_date — not available in current data model
  return {
    value: null,
    formatted: "--",
    change: null,
    changeFormatted: "--",
    context: "Requires completion dates",
    unavailableReason: "completion_date and estimated_job_date fields not available in current data source",
  };
}

// ── 2. Schedule Slippage ───────────────────────────────────────────

export function calcScheduleSlippage(
  jobs: QuotedJob[],
  period: PeriodSpec
): KPIResult {
  // Requires date change history (latest_estimated_date vs previous_estimated_date)
  return {
    value: null,
    formatted: "--",
    change: null,
    changeFormatted: "--",
    context: "Requires schedule history",
    unavailableReason: "Schedule change history not available in current data source",
  };
}

// ── 3. Margin Variance % (WEIGHTED) ───────────────────────────────

export function calcMarginVariance(
  revenue: RevenueProject[],
  period: PeriodSpec,
  priorPeriod: PeriodSpec | null
): KPIResult {
  // We have actual revenue and actual COGS but no estimated/quoted cost
  // We can compute actual margin but not variance against expected
  const periodItems = filterByPeriod(revenue, revenueMonthKey, period.months);
  const completed = periodItems.filter((r) => r.status === "paid");

  if (completed.length === 0) {
    return {
      value: null,
      formatted: "--",
      change: null,
      changeFormatted: "--",
      context: "No completed jobs in period",
      unavailableReason: "No paid revenue projects found for selected period",
    };
  }

  // Weighted actual margin: Σ grossProfit / Σ revenueExGST
  const totalRevenue = completed.reduce((s, r) => s + r.valueExclGST, 0);
  const totalGP = completed.reduce((s, r) => s + r.grossProfit, 0);

  if (totalRevenue <= 0) {
    return {
      value: null,
      formatted: "--",
      change: null,
      changeFormatted: "--",
      context: "No revenue in period",
      unavailableReason: "Total revenue is zero for selected period",
    };
  }

  const actualMarginPct = (totalGP / totalRevenue) * 100;

  // Without estimated_cost we cannot compute variance — show actual margin instead
  // and flag that variance requires estimated cost data
  const priorItems = priorPeriod
    ? filterByPeriod(revenue, revenueMonthKey, priorPeriod.months).filter((r) => r.status === "paid")
    : [];
  const priorRev = priorItems.reduce((s, r) => s + r.valueExclGST, 0);
  const priorGP = priorItems.reduce((s, r) => s + r.grossProfit, 0);
  const priorMargin = priorRev > 0 ? (priorGP / priorRev) * 100 : null;

  const { change, changeFormatted } = changePct(actualMarginPct, priorMargin);
  const lostAmt = totalRevenue > 0 ? Math.round(totalGP - totalRevenue * (priorMargin ?? actualMarginPct) / 100) : 0;

  return {
    value: actualMarginPct,
    formatted: pct(actualMarginPct),
    change,
    changeFormatted,
    context: `${completed.length} jobs · ${lostAmt >= 0 ? "+" : ""}$${Math.abs(lostAmt).toLocaleString()} vs prior`,
  };
}

// ── 4. Cost Overrun % ──────────────────────────────────────────────

export function calcCostOverrun(
  revenue: RevenueProject[],
  period: PeriodSpec,
  priorPeriod: PeriodSpec | null
): KPIResult {
  // Requires estimated_cost — not available
  return {
    value: null,
    formatted: "--",
    change: null,
    changeFormatted: "--",
    context: "Requires estimated cost data",
    unavailableReason: "estimated_cost field not available in current data source",
  };
}

// ── 5. Labour Efficiency % ────────────────────────────────────────

export function calcLabourEfficiency(
  revenue: RevenueProject[],
  period: PeriodSpec
): KPIResult {
  // Requires actual_hours and estimated_hours
  return {
    value: null,
    formatted: "--",
    change: null,
    changeFormatted: "--",
    context: "Requires hours tracking",
    unavailableReason: "actual_hours and estimated_hours not available in current data source",
  };
}

// ── 6. Jobs At Risk ───────────────────────────────────────────────

export function calcJobsAtRisk(
  jobs: QuotedJob[],
  revenue: RevenueProject[],
  period: PeriodSpec,
  marginThreshold = 30
): KPIResult {
  // Active jobs: pending or yellow status
  const activeJobs = filterByPeriod(jobs, jobMonthKey, period.months)
    .filter((j) => j.status === "pending" || j.status === "yellow");

  if (activeJobs.length === 0) {
    return {
      value: 0,
      formatted: "0",
      change: null,
      changeFormatted: "--",
      context: "No active jobs in period",
    };
  }

  // Check revenue data for margin status — match by company+project
  let atRisk = 0;
  let highRisk = 0;

  for (const job of activeJobs) {
    let riskFactors = 0;

    // Yellow status is a delay signal
    if (job.status === "yellow") riskFactors++;

    // Find matching revenue project for margin check
    const matchingRev = revenue.find(
      (r) => r.company === job.company && r.project === job.project
    );
    if (matchingRev && matchingRev.valueExclGST > 0) {
      const margin = (matchingRev.grossProfit / matchingRev.valueExclGST) * 100;
      if (margin < marginThreshold) riskFactors++;
    }

    if (riskFactors >= 1) atRisk++;
    if (riskFactors >= 2) highRisk++;
  }

  return {
    value: atRisk,
    formatted: String(atRisk),
    change: null,
    changeFormatted: "--",
    context: highRisk > 0 ? `${highRisk} high-risk (2+ factors)` : `${activeJobs.length} active jobs checked`,
  };
}

// ── Aggregate runner ───────────────────────────────────────────────

export interface ExecutionKPIs {
  onTimeDelivery: KPIResult;
  scheduleSlippage: KPIResult;
  marginVariance: KPIResult;
  costOverrun: KPIResult;
  labourEfficiency: KPIResult;
  jobsAtRisk: KPIResult;
}

export function computeExecutionKPIs(
  jobs: QuotedJob[],
  revenue: RevenueProject[],
  period: PeriodSpec,
): ExecutionKPIs {
  const priorPeriod: PeriodSpec = {
    ...period,
    months: period.priorMonths,
    priorMonths: [],
  };

  return {
    onTimeDelivery: calcOnTimeDelivery(jobs, period, priorPeriod),
    scheduleSlippage: calcScheduleSlippage(jobs, period),
    marginVariance: calcMarginVariance(revenue, period, priorPeriod),
    costOverrun: calcCostOverrun(revenue, period, priorPeriod),
    labourEfficiency: calcLabourEfficiency(revenue, period),
    jobsAtRisk: calcJobsAtRisk(jobs, revenue, period),
  };
}
