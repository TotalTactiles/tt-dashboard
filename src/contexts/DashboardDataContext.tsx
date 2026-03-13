import React, { createContext, useContext, useMemo, useRef } from "react";
import { useDataSources } from "@/hooks/useDataSources";
import { resolveKpiVariables, createFormulaCache, DataStore, type EvaluationCache } from "@/engine/formulaEngine";
import { useFormulas } from "@/hooks/useFormulas";

// Module-level formula cache singleton — survives re-renders
const formulaCacheInstance = createFormulaCache();

// ---- Helpers ----

function parseNum(v: any): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[$,\s]/g, "");
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

const MONTH_REGEX = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{2}$/i;

// ---- Quote status normalizer ----

function normalizeQuoteStatus(raw: string): "won" | "lost" | "pending" | "yellow" {
  const s = (raw ?? "").toUpperCase();
  if (s.includes("PO RECEIVED") || s.includes("WON") || s === "GREEN") return "won";
  if (s.includes("LOST") || s.includes("DEAD")) return "lost";
  if (s.includes("VERBAL") || s.includes("YELLOW") || s.includes("YLW") || s.includes("90%")) return "yellow";
  if (s.includes("NEGOTIATION") || s.includes("REVIEW") || s.includes("QUOTE SENT") || s.includes("PENDING")) return "pending";
  return "pending";
}

function normalizeRevenueStatus(raw: string): "invoiced" | "pending" | "overdue" {
  const s = (raw ?? "").toUpperCase();
  if (s.includes("INVOICED") || s.includes("PAID")) return "invoiced";
  if (s.includes("OVERDUE")) return "overdue";
  return "pending";
}

// ---- Types ----

export interface QuotedJob {
  id: string;
  company: string;
  project: string;
  value: number;
  status: "won" | "lost" | "pending" | "yellow";
  dateQuoted: string;
  notes: string;
}

export interface RevenueProject {
  id: string;
  company: string;
  project: string;
  valueInclGST: number;
  valueExclGST: number;
  invoiceDate: string;
  dueDate: string;
  labourCost: number;
  tactileCost: number;
  otherCost: number;
  totalCOGS: number;
  grossProfit: number;
  status: "invoiced" | "pending" | "overdue";
}

export interface ExpenseItem {
  name: string;
  category: string;
  weeklyCost: number;
  monthlyCost: number;
  yearlyCost: number;
}

export interface ExpenseCategoryGroup {
  category: string;
  items: ExpenseItem[];
  totalMonthly: number;
  totalYearly: number;
}

export interface KPIStat {
  label: string;
  value: string;
  change: string;
  positive: boolean;
  noData?: boolean;
}

export interface IncomeOutgoingsPoint {
  month: string;
  income: number;
  outgoings: number;
  surplus: number;
}

export interface ProfitMarginPoint {
  month: string;
  grossMargin: number;
}

export interface ForecastChartPoint {
  month: string;
  totalOutgoings: number;
  anticipatedSurplus: number;
  probableJobs: number;
  surplusIncludingProbable: number;
}

export interface ExpenseAllocationItem {
  name: string;
  value: number;
  fill: string;
}

export type DataHealthStatus = "disconnected" | "connected-empty" | "healthy";

export interface SectionHealth {
  status: DataHealthStatus;
  rawCount: number;
  mappedCount: number;
}

export interface DataHealth {
  quotes: SectionHealth;
  cashflow: SectionHealth;
  revenue: SectionHealth;
  expenses: SectionHealth;
}

export interface DashboardData {
  quotedJobs: QuotedJob[];
  revenueProjects: RevenueProject[];
  expenseCategories: ExpenseCategoryGroup[];
  kpiStats: KPIStat[];
  incomeOutgoingsData: IncomeOutgoingsPoint[];
  profitMarginData: ProfitMarginPoint[];
  forecastChartData: ForecastChartPoint[];
  expenseAllocation: ExpenseAllocationItem[];
  kpiVariables: Record<string, number>;
  formulaCache: ReturnType<typeof createFormulaCache>;
  dataHealth: DataHealth;
  isLoading: boolean;
  hasLiveData: boolean;
  connectedCount: number;
  lastUpdated: string | null;
  sources: ReturnType<typeof useDataSources>["sources"];
  toggleConnection: ReturnType<typeof useDataSources>["toggleConnection"];
  updateWebhookUrl: ReturnType<typeof useDataSources>["updateWebhookUrl"];
  saveAndTest: ReturnType<typeof useDataSources>["saveAndTest"];
  syncNow: ReturnType<typeof useDataSources>["syncNow"];
}

const DashboardDataContext = createContext<DashboardData | null>(null);

// ---- Category colors for expenses ----
const CATEGORY_FILLS: Record<string, string> = {
  "Essentials": "hsl(160, 70%, 45%)",
  "Office & Misc": "hsl(200, 80%, 50%)",
  "Shared Expenses": "hsl(270, 60%, 55%)",
  "Employee Expenses": "hsl(38, 92%, 55%)",
};
const FALLBACK_FILLS = ["hsl(340, 65%, 50%)", "hsl(120, 50%, 40%)", "hsl(30, 60%, 50%)"];

// ---- Format helpers ----
function fmtAUD(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? "-" : ""}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${n < 0 ? "-" : ""}$${(abs / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;
}

// ---- Extract month values from a raw cashflow row ----
function getMonthValues(row: any, months: string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const m of months) {
    result[m] = parseNum(row?.[m] ?? 0);
  }
  return result;
}

// ---- Provider ----

export function DashboardDataProvider({ children }: { children: React.ReactNode }) {
  const ds = useDataSources();
  const { liveData, hasLiveData, connectedCount, sources } = ds;
  const isLoading = sources.some((s) => s.loading);
  const { formulas } = useFormulas();

  const data = useMemo<DashboardData>(() => {
    const rawQuotes = liveData.quotes ?? [];
    const rawCashflow = liveData.cashflow ?? [];
    const rawRevenue = liveData.revenue ?? [];
    const rawExpenses = liveData.expenses ?? [];
    const qs = liveData.quotesSummary as any;
    const cs = liveData.cashflowSummary as any;
    const meta = liveData._meta as any;

    // ===== QUOTED JOBS TABLE =====
    const quotedJobs: QuotedJob[] = rawQuotes
      .filter((r: any) => r?._label_isLineItem === true)
      .map((r: any, i: number) => ({
        id: `Q${i}`,
        company: r._company ?? r._label_company ?? "",
        project: r._project ?? r._label_project ?? "",
        value: parseNum(r._value ?? r._label_dollarValue ?? 0),
        status: normalizeQuoteStatus(r.Status ?? r.status ?? "pending"),
        dateQuoted: r["Date Quoted"] ?? r.dateQuoted ?? "",
        notes: r.Notes ?? r.notes ?? "",
      }))
      .sort((a: QuotedJob, b: QuotedJob) => {
        if (!a.dateQuoted && !b.dateQuoted) return 0;
        if (!a.dateQuoted) return 1;
        if (!b.dateQuoted) return -1;
        return new Date(b.dateQuoted).getTime() - new Date(a.dateQuoted).getTime();
      });

    // ===== REVENUE PROJECTS TABLE =====
    const revenueProjects: RevenueProject[] = rawRevenue
      .filter((r: any) => r?._label_isLineItem === true)
      .map((r: any, i: number) => {
        const valInc = parseNum(r._label_value ?? 0);
        const valExc = valInc / 1.1;
        const labour = parseNum(r._label_labourCost ?? 0);
        const tactile = parseNum(r._label_tactileCost ?? 0);
        const other = parseNum(r._label_otherCost ?? 0);
        const totalCost = parseNum(r._label_totalCost ?? 0) || (labour + tactile + other);
        return {
          id: `R${i}`,
          company: r._label_company ?? "",
          project: r._label_project ?? "",
          valueInclGST: valInc,
          valueExclGST: Math.round(valExc * 100) / 100,
          invoiceDate: r._label_invoiceDate ?? "",
          dueDate: r._label_dueDate ?? "",
          labourCost: labour,
          tactileCost: tactile,
          otherCost: other,
          totalCOGS: totalCost,
          grossProfit: Math.round((valExc - totalCost) * 100) / 100,
          status: normalizeRevenueStatus(r.Status ?? r.status ?? "pending"),
        };
      });

    // ===== EXPENSE ITEMS & CATEGORIES =====
    const expenseItems: ExpenseItem[] = rawExpenses
      .filter((r: any) => r?._label_isLineItem === true)
      .map((r: any) => ({
        name: r._label_name ?? "",
        category: r._label_category ?? "Uncategorised",
        weeklyCost: parseNum(r._label_weeklyCost ?? 0),
        monthlyCost: parseNum(r._label_monthlyCost ?? 0),
        yearlyCost: parseNum(r._label_yearlyCost ?? 0),
      }));

    const catMap: Record<string, ExpenseItem[]> = {};
    for (const item of expenseItems) {
      if (!catMap[item.category]) catMap[item.category] = [];
      catMap[item.category].push(item);
    }
    const expenseCategories: ExpenseCategoryGroup[] = Object.entries(catMap).map(([cat, items]) => ({
      category: cat,
      items,
      totalMonthly: items.reduce((s, i) => s + i.monthlyCost, 0),
      totalYearly: items.reduce((s, i) => s + i.yearlyCost, 0),
    }));

    // ===== EXPENSE ALLOCATION (PIE) =====
    let fillIdx = 0;
    const expenseAllocation: ExpenseAllocationItem[] = expenseCategories.map((cat) => ({
      name: cat.category,
      value: cat.totalYearly,
      fill: CATEGORY_FILLS[cat.category] ?? FALLBACK_FILLS[fillIdx++ % FALLBACK_FILLS.length],
    }));

    // ===== CASHFLOW SUMMARY CHARTS =====
    const months: string[] = cs?.months ?? [];

    // Helper to get value from a summary dict for a month
    const sv = (dict: any, month: string) => parseNum(dict?.[month] ?? 0);

    // Find totalOutgoings from raw cashflow rows
    const findCashflowRow = (label: string) => {
      const upper = label.toUpperCase().trim();
      return rawCashflow.find((r: any) => {
        const rl = (r._label_rowLabel ?? r.col_1 ?? "").toString().toUpperCase().trim();
        return rl === upper || rl.includes(upper) || upper.includes(rl);
      });
    };

    const totalOutgoingsRow = findCashflowRow("Total Outgoings");
    const jobsProbableRow = findCashflowRow("Jobs Probable To Be Won");
    const surplusWithJobsRow = findCashflowRow("Anticipated Cash Surplus/(Deficit) Including Probable Jobs");

    // Income vs Outgoings bar chart
    const incomeOutgoingsData: IncomeOutgoingsPoint[] = months
      .filter((m) => {
        const inc = sv(cs?.totalIncome, m);
        const outRaw = totalOutgoingsRow ? parseNum(totalOutgoingsRow[m] ?? 0) : (Math.abs(sv(cs?.totalCostOfSales, m)) + Math.abs(sv(cs?.totalOperatingExpenses, m)));
        return inc !== 0 || outRaw !== 0;
      })
      .map((m) => {
        const inc = sv(cs?.totalIncome, m);
        const out = totalOutgoingsRow
          ? Math.abs(parseNum(totalOutgoingsRow[m] ?? 0))
          : (Math.abs(sv(cs?.totalCostOfSales, m)) + Math.abs(sv(cs?.totalOperatingExpenses, m)));
        return {
          month: m,
          income: inc,
          outgoings: out,
          surplus: sv(cs?.anticipatedSurplus, m),
        };
      });

    // Gross Profit Margin line chart
    const profitMarginData: ProfitMarginPoint[] = months
      .filter((m) => sv(cs?.totalIncome, m) !== 0)
      .map((m) => {
        // Prefer pre-calculated grossMarginPct
        if (cs?.grossMarginPct?.[m] !== undefined) {
          return { month: m, grossMargin: parseNum(cs.grossMarginPct[m]) };
        }
        const gp = sv(cs?.grossProfit, m);
        const inc = sv(cs?.totalIncome, m);
        return { month: m, grossMargin: inc > 0 ? Math.round((gp / inc) * 100) : 0 };
      });

    // Forecast chart
    const forecastChartData: ForecastChartPoint[] = months.map((m) => {
      const totalOut = totalOutgoingsRow ? Math.abs(parseNum(totalOutgoingsRow[m] ?? 0)) : 0;
      const anticipated = sv(cs?.anticipatedSurplus, m);
      const probable = jobsProbableRow ? parseNum(jobsProbableRow[m] ?? 0) : 0;
      const surplusWithJobs = surplusWithJobsRow ? parseNum(surplusWithJobsRow[m] ?? 0) : (cs?.anticipatedSurplusWithJobs ? sv(cs.anticipatedSurplusWithJobs, m) : 0);
      return { month: m, totalOutgoings: totalOut, anticipatedSurplus: anticipated, probableJobs: probable, surplusIncludingProbable: surplusWithJobs };
    });

    // ===== KPI STAT CARDS =====
    const noData = !hasLiveData;

    // Card 4: Net Revenue = sum(totalIncome) - sum(totalCostOfSales)
    const netRevenue = months.reduce((s, m) => s + sv(cs?.totalIncome, m) - Math.abs(sv(cs?.totalCostOfSales, m)), 0);

    // Card 5: Cashflow Position = last non-zero anticipatedSurplus, fallback to Closing Balance
    let cashflowPosition = 0;
    for (let i = months.length - 1; i >= 0; i--) {
      const val = sv(cs?.anticipatedSurplus, months[i]);
      if (val !== 0) { cashflowPosition = val; break; }
    }
    // Fallback: try Closing Balance row from raw cashflow
    if (cashflowPosition === 0) {
      const closingRow = findCashflowRow("Closing Balance");
      if (closingRow) {
        for (let i = months.length - 1; i >= 0; i--) {
          const val = parseNum(closingRow[months[i]] ?? 0);
          if (val !== 0) { cashflowPosition = val; break; }
        }
      }
    }

    const kpiStats: KPIStat[] = [
      {
        label: "Total Quoted",
        value: noData ? "--" : fmtAUD(parseNum(qs?.totalQuoted?.value ?? 0)),
        change: noData ? "--" : `${parseNum(qs?.totalQuoted?.count ?? 0)} jobs`,
        positive: true, noData,
      },
      {
        label: "Total Won",
        value: noData ? "--" : fmtAUD(parseNum(qs?.totalWon?.value ?? 0)),
        change: noData ? "--" : `${parseNum(qs?.totalWon?.count ?? 0)} jobs`,
        positive: true, noData,
      },
      {
        label: "Quoted Remaining",
        value: noData ? "--" : fmtAUD(parseNum(qs?.remaining?.value ?? 0)),
        change: noData ? "--" : `${parseNum(qs?.remaining?.count ?? 0)} jobs`,
        positive: parseNum(qs?.remaining?.value ?? 0) >= 0, noData,
      },
      {
        label: "Net Revenue",
        value: noData ? "--" : fmtAUD(netRevenue),
        change: "--",
        positive: netRevenue >= 0, noData,
      },
      {
        label: "Cashflow Position",
        value: noData ? "--" : fmtAUD(cashflowPosition),
        change: "--",
        positive: cashflowPosition >= 0, noData,
      },
      {
        label: "Conversion Rate",
        value: noData ? "--" : `${parseNum(qs?.conversionRate ?? 0)}%`,
        change: noData ? "--" : `${parseNum(qs?.totalWon?.count ?? 0)} won of ${parseNum(qs?.totalQuoted?.count ?? 0)}`,
        positive: parseNum(qs?.conversionRate ?? 0) >= 20, noData,
      },
    ];

    // KPI variables via formula engine
    const storeSnapshot: DataStore = {
      quotes: rawQuotes,
      qtsSmmry: liveData.qtsSmmry ?? [],
      cashflow: rawCashflow,
      revenue: rawRevenue,
      expenses: rawExpenses,
      labour: liveData.labour ?? [],
      stock: liveData.stock ?? [],
      quotesSummary: qs ?? {},
      cashflowSummary: cs ?? {},
      revenueSummary: liveData.revenueSummary ?? {},
      expensesSummary: liveData.expensesSummary ?? {},
    };
    const kpiVariables = resolveKpiVariables(storeSnapshot);

    // Data health
    const health = (raw: any[], mapped: any[]): SectionHealth => {
      if (!raw || raw.length === 0) return { status: "disconnected", rawCount: 0, mappedCount: 0 };
      if (mapped.length === 0) return { status: "connected-empty", rawCount: raw.length, mappedCount: 0 };
      return { status: "healthy", rawCount: raw.length, mappedCount: mapped.length };
    };
    const dataHealth: DataHealth = {
      quotes: health(rawQuotes, quotedJobs),
      cashflow: months.length > 0 ? { status: "healthy", rawCount: rawCashflow.length, mappedCount: months.length } : health(rawCashflow, []),
      revenue: health(rawRevenue, revenueProjects),
      expenses: health(rawExpenses, expenseItems),
    };

    const lastUpdated = meta?.pulledAt ?? null;

    // Compute formula cache
    formulaCacheInstance.invalidate();
    // Note: formulas from useFormulas() are not available here (hook can't be called inside useMemo).
    // The cache.compute() call happens via the exposed formulaCache on the context — consumers call it.

    return {
      quotedJobs, revenueProjects, expenseCategories,
      kpiStats, incomeOutgoingsData, profitMarginData, forecastChartData, expenseAllocation,
      kpiVariables, formulaCache: formulaCacheInstance, dataHealth, isLoading, hasLiveData, connectedCount, lastUpdated,
      sources: ds.sources, toggleConnection: ds.toggleConnection,
      updateWebhookUrl: ds.updateWebhookUrl, saveAndTest: ds.saveAndTest, syncNow: ds.syncNow,
    };
  }, [liveData, hasLiveData, connectedCount, isLoading, ds]);

  return <DashboardDataContext.Provider value={data}>{children}</DashboardDataContext.Provider>;
}

export function useDashboardData(): DashboardData {
  const ctx = useContext(DashboardDataContext);
  if (!ctx) {
    return {
      quotedJobs: [], revenueProjects: [], expenseCategories: [],
      kpiStats: [], incomeOutgoingsData: [], profitMarginData: [],
      forecastChartData: [], expenseAllocation: [], kpiVariables: {},
      formulaCache: formulaCacheInstance,
      dataHealth: {
        quotes: { status: "disconnected", rawCount: 0, mappedCount: 0 },
        cashflow: { status: "disconnected", rawCount: 0, mappedCount: 0 },
        revenue: { status: "disconnected", rawCount: 0, mappedCount: 0 },
        expenses: { status: "disconnected", rawCount: 0, mappedCount: 0 },
      },
      isLoading: false, hasLiveData: false, connectedCount: 0, lastUpdated: null,
      sources: [], toggleConnection: () => {}, updateWebhookUrl: () => {},
      saveAndTest: async () => ({ success: false, error: "Not initialized" }), syncNow: () => {},
    } as DashboardData;
  }
  return ctx;
}
