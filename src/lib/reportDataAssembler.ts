/**
 * Report Data Assembler
 * Extracts and structures cashflow data for PDF report generation.
 * Sources data from the same DashboardData context used by the live dashboard.
 */

import type { IncomeOutgoingsPoint, KPIStat } from "@/contexts/DashboardDataContext";

// ---- Types ----

export interface ReportMonthData {
  month: string; // e.g. "Mar-26"
  income: number;
  outgoings: number;
  surplus: number;
  probableIncome: number;
  isFuture: boolean;
}

export interface ReportPeriodSummary {
  totalIncome: number;
  totalOutgoings: number;
  totalSurplus: number;
  avgIncome: number;
  avgOutgoings: number;
  avgSurplus: number;
  monthCount: number;
}

export interface MonthlyReportData {
  type: "monthly";
  periodLabel: string; // e.g. "March 2026"
  periodKey: string; // e.g. "Mar-26"
  current: ReportMonthData | null;
  previous: ReportMonthData | null;
  varianceIncome: number | null;
  varianceOutgoings: number | null;
  varianceSurplus: number | null;
  varianceIncomePercent: number | null;
  varianceOutgoingsPercent: number | null;
  varianceSurplusPercent: number | null;
  cashflowPosition: number | null;
  grossProfitMargin: number | null;
}

export interface QuarterlyReportData {
  type: "quarterly";
  periodLabel: string; // e.g. "Q1 2026"
  quarterKey: string; // e.g. "Q1"
  year: number;
  months: ReportMonthData[];
  summary: ReportPeriodSummary;
  cashflowPosition: number | null;
  grossProfitMargin: number | null;
}

export type ReportData = MonthlyReportData | QuarterlyReportData;

export interface ReportOptions {
  reportType: "monthly" | "quarterly";
  month?: string; // Mon-YY format e.g. "Mar-26"
  quarter?: string; // "Q1" | "Q2" | "Q3" | "Q4"
  year?: number;
  includeExecutiveSummary: boolean;
  includeDetailTable: boolean;
  includeCharts: boolean;
  includeCommentary: boolean;
}

// ---- Constants ----

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTH_ABBR_LIST = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const QUARTER_MONTHS: Record<string, number[]> = {
  Q1: [0, 1, 2],
  Q2: [3, 4, 5],
  Q3: [6, 7, 8],
  Q4: [9, 10, 11],
};

// ---- Helpers ----

export function parseMonthKey(key: string): { monthIdx: number; year: number } | null {
  const match = key.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2})$/i);
  if (!match) return null;
  const monthIdx = MONTH_ABBR_LIST.findIndex(m => m.toLowerCase() === match[1].toLowerCase());
  if (monthIdx < 0) return null;
  return { monthIdx, year: 2000 + parseInt(match[2], 10) };
}

export function monthKeyToLabel(key: string): string {
  const parsed = parseMonthKey(key);
  if (!parsed) return key;
  return `${MONTH_NAMES[parsed.monthIdx]} ${parsed.year}`;
}

export function getQuarterEndLabel(quarter: string, year: number): string {
  const endMonths: Record<string, string> = {
    Q1: "March", Q2: "June", Q3: "September", Q4: "December",
  };
  return `${endMonths[quarter] ?? "?"} ${year}`;
}

export function getPreviousMonthKey(key: string): string | null {
  const parsed = parseMonthKey(key);
  if (!parsed) return null;
  let m = parsed.monthIdx - 1;
  let y = parsed.year;
  if (m < 0) { m = 11; y--; }
  return `${MONTH_ABBR_LIST[m]}-${String(y).slice(-2)}`;
}

function computeVariancePercent(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / Math.abs(previous)) * 10000) / 100;
}

function summarise(months: ReportMonthData[]): ReportPeriodSummary {
  const count = months.length;
  const totalIncome = months.reduce((s, m) => s + m.income, 0);
  const totalOutgoings = months.reduce((s, m) => s + m.outgoings, 0);
  const totalSurplus = months.reduce((s, m) => s + m.surplus, 0);
  return {
    totalIncome,
    totalOutgoings,
    totalSurplus,
    avgIncome: count > 0 ? totalIncome / count : 0,
    avgOutgoings: count > 0 ? totalOutgoings / count : 0,
    avgSurplus: count > 0 ? totalSurplus / count : 0,
    monthCount: count,
  };
}

// ---- Available periods ----

export function getAvailableMonths(data: IncomeOutgoingsPoint[]): { key: string; label: string }[] {
  return data.map(d => ({ key: d.month, label: monthKeyToLabel(d.month) }));
}

export function getAvailableQuarters(data: IncomeOutgoingsPoint[]): { key: string; year: number; label: string }[] {
  const seen = new Set<string>();
  const result: { key: string; year: number; label: string }[] = [];
  for (const d of data) {
    const parsed = parseMonthKey(d.month);
    if (!parsed) continue;
    const q = parsed.monthIdx <= 2 ? "Q1" : parsed.monthIdx <= 5 ? "Q2" : parsed.monthIdx <= 8 ? "Q3" : "Q4";
    const id = `${q}-${parsed.year}`;
    if (seen.has(id)) continue;
    seen.add(id);
    result.push({ key: q, year: parsed.year, label: `${q} ${parsed.year}` });
  }
  return result;
}

// ---- Main assembler ----

export function assembleReportData(
  options: ReportOptions,
  incomeOutgoingsData: IncomeOutgoingsPoint[],
  kpiStats: KPIStat[],
  profitMarginData: { month: string; grossMargin: number }[],
): { data: ReportData | null; errors: string[] } {
  const errors: string[] = [];

  // Extract cashflow position from KPI stats
  const cashflowStat = kpiStats.find(s => s.label === "Cashflow Position");
  const cashflowPosition = cashflowStat && cashflowStat.value !== "--"
    ? parseFloat(cashflowStat.value.replace(/[^0-9.-]/g, "")) || null
    : null;

  if (options.reportType === "monthly") {
    if (!options.month) {
      errors.push("No month selected");
      return { data: null, errors };
    }

    const currentPoint = incomeOutgoingsData.find(d => d.month === options.month);
    if (!currentPoint) {
      errors.push(`No data found for ${options.month}`);
      return { data: null, errors };
    }

    const current: ReportMonthData = { ...currentPoint };

    const prevKey = getPreviousMonthKey(options.month);
    const prevPoint = prevKey ? incomeOutgoingsData.find(d => d.month === prevKey) : null;
    const previous: ReportMonthData | null = prevPoint ? { ...prevPoint } : null;

    // GP% for selected month
    const gpPoint = profitMarginData.find(p => p.month === options.month);
    const grossProfitMargin = gpPoint?.grossMargin ?? null;

    const data: MonthlyReportData = {
      type: "monthly",
      periodLabel: monthKeyToLabel(options.month),
      periodKey: options.month,
      current,
      previous,
      varianceIncome: previous ? current.income - previous.income : null,
      varianceOutgoings: previous ? current.outgoings - previous.outgoings : null,
      varianceSurplus: previous ? current.surplus - previous.surplus : null,
      varianceIncomePercent: previous ? computeVariancePercent(current.income, previous.income) : null,
      varianceOutgoingsPercent: previous ? computeVariancePercent(current.outgoings, previous.outgoings) : null,
      varianceSurplusPercent: previous ? computeVariancePercent(current.surplus, previous.surplus) : null,
      cashflowPosition,
      grossProfitMargin,
    };

    return { data, errors };
  }

  // Quarterly
  if (!options.quarter || !options.year) {
    errors.push("No quarter or year selected");
    return { data: null, errors };
  }

  const qMonthIdxs = QUARTER_MONTHS[options.quarter];
  if (!qMonthIdxs) {
    errors.push(`Invalid quarter: ${options.quarter}`);
    return { data: null, errors };
  }

  const yearShort = String(options.year).slice(-2);
  const quarterMonthKeys = qMonthIdxs.map(idx => `${MONTH_ABBR_LIST[idx]}-${yearShort}`);

  const months: ReportMonthData[] = [];
  for (const mk of quarterMonthKeys) {
    const point = incomeOutgoingsData.find(d => d.month === mk);
    if (point) {
      months.push({ ...point });
    }
  }

  if (months.length === 0) {
    errors.push(`No data found for ${options.quarter} ${options.year}`);
    return { data: null, errors };
  }

  // Average GP% across quarter months
  const gpPoints = profitMarginData.filter(p => quarterMonthKeys.includes(p.month));
  const grossProfitMargin = gpPoints.length > 0
    ? Math.round((gpPoints.reduce((s, p) => s + p.grossMargin, 0) / gpPoints.length) * 100) / 100
    : null;

  const data: QuarterlyReportData = {
    type: "quarterly",
    periodLabel: `${options.quarter} ${options.year}`,
    quarterKey: options.quarter,
    year: options.year,
    months,
    summary: summarise(months),
    cashflowPosition,
    grossProfitMargin,
  };

  return { data, errors };
}

// ---- File name generator ----

export function generateFileName(reportData: ReportData): string {
  const base = "total-tactiles-cashflow-report";
  if (reportData.type === "monthly") {
    return `${base}-${reportData.periodKey.toLowerCase()}.pdf`;
  }
  return `${base}-${reportData.quarterKey.toLowerCase()}-${reportData.year}.pdf`;
}

// ---- Currency formatter for reports ----

export function formatReportCurrency(value: number): string {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (value < 0) return `($${formatted})`;
  return `$${formatted}`;
}

export function formatReportPercent(value: number | null): string {
  if (value === null) return "N/A";
  return `${value.toFixed(1)}%`;
}
