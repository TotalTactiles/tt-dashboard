import React, { createContext, useContext, useMemo, useRef } from "react";
import { useDataSources } from "@/hooks/useDataSources";
import { resolveKpiVariables, createFormulaCache, DataStore, type EvaluationCache } from "@/engine/formulaEngine";
import { useFormulas } from "@/hooks/useFormulas";
import { formatMetricValue } from "@/lib/formatMetricValue";

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
  const s = (raw ?? "").trim();
  // n8n pre-normalised values
  if (s === "won") return "won";
  if (s === "lost") return "lost";
  if (s === "yellow") return "yellow";
  if (s === "pending") return "pending";
  // Raw "Current Status" fallbacks
  const u = s.toUpperCase();
  if (u.includes("PO RECEIVED") || u.includes("GRN") || u === "COMPLETED") return "won";
  if (u.includes("LOST") || u.includes("DEAD")) return "lost";
  if (u.includes("VERBAL") || u.includes("YLW")) return "yellow";
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
  rawStatus: string;
  dateQuoted: string;
  stageValue: number;
  lostReason: string;
  zohoId: string;
  projectYear: string;
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
  totalWeekly: number;
  totalMonthly: number;
  totalYearly: number;
}

export interface GrandTotalExpense {
  weeklyCost: number;
  monthlyCost: number;
  yearlyCost: number;
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
  probableIncome: number;
  isFuture: boolean;
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

export interface QuotesDebugInfo {
  rawResponseType: string;
  topLevelKeys: string[];
  hasTopLevelQuotes: boolean;
  rawQuotesLength: number;
  afterFilterLength: number;
  row0ContractValue: unknown;
  row0UnderscoreValue: unknown;
  row0Keys: string[];
  firstQuoteTopLevel: any;
  rawQuotesSample: any[];
  valuePaths: Record<string, unknown>;
}

export interface LiveCalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  allDay: boolean;
  source: string;
  type: string;
  attendees: string[];
  googleId?: string;
  zohoId?: string;
  status?: string;
  organizer?: string;
  htmlLink?: string;
}

export interface CalendarSummary {
  totalEvents: number;
  upcomingCount: number;
  byType: Record<string, number>;
}

export interface DashboardData {
  quotedJobs: QuotedJob[];
  revenueProjects: RevenueProject[];
  expenseCategories: ExpenseCategoryGroup[];
  grandTotalExpense: GrandTotalExpense | null;
  kpiStats: KPIStat[];
  incomeOutgoingsData: IncomeOutgoingsPoint[];
  profitMarginData: ProfitMarginPoint[];
  forecastChartData: ForecastChartPoint[];
  expenseAllocation: ExpenseAllocationItem[];
  kpiVariables: Record<string, number>;
  dataStore: DataStore;
  formulaCache: ReturnType<typeof createFormulaCache>;
  changedFormulas: string[];
  formulas: import("@/hooks/useFormulas").MetricFormula[];
  addFormula: (formula: Omit<import("@/hooks/useFormulas").MetricFormula, "id">) => void;
  updateFormula: (id: string, updates: Partial<import("@/hooks/useFormulas").MetricFormula>) => void;
  deleteFormula: (id: string) => void;
  dataHealth: DataHealth;
  quotesDebug: QuotesDebugInfo;
  isLoading: boolean;
  hasLiveData: boolean;
  connectedCount: number;
  lastUpdated: string | null;
  sources: ReturnType<typeof useDataSources>["sources"];
  toggleConnection: ReturnType<typeof useDataSources>["toggleConnection"];
  updateWebhookUrl: ReturnType<typeof useDataSources>["updateWebhookUrl"];
  saveAndTest: ReturnType<typeof useDataSources>["saveAndTest"];
  syncNow: ReturnType<typeof useDataSources>["syncNow"];
  calendarEvents: LiveCalendarEvent[];
  upcomingEvents: LiveCalendarEvent[];
  calendarSummary: CalendarSummary | null;
  setCalendarEvents: React.Dispatch<React.SetStateAction<LiveCalendarEvent[]>>;
}

const DashboardDataContext = createContext<DashboardData | null>(null);

// ---- Category colors for expenses ----
const CATEGORY_FILLS: Record<string, string> = {
  "Essentials": "hsl(160, 70%, 45%)",
  "Office & Misc": "hsl(200, 80%, 50%)",
  "Shared Expenses": "hsl(270, 60%, 55%)",
  "Employee Expenses": "hsl(38, 92%, 55%)",
  "Krishan": "hsl(340, 65%, 50%)",
  "Mehmet": "hsl(30, 60%, 50%)",
};
const FALLBACK_FILLS = ["hsl(120, 50%, 40%)", "hsl(280, 50%, 55%)", "hsl(15, 70%, 50%)", "hsl(190, 60%, 45%)"];

// ---- Format helpers ----
const fmtAUD = (n: number) => formatMetricValue(n, "currency");

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
  const { formulas, addFormula, updateFormula, deleteFormula } = useFormulas();

  const data = useMemo<DashboardData>(() => {
    const webhookResponse: any = liveData;

    console.log("WEBHOOK RAW RESPONSE type:", typeof webhookResponse);
    console.log("WEBHOOK TOP LEVEL KEYS:", Object.keys(webhookResponse ?? {}));
    console.log("quotes type:", typeof webhookResponse?.quotes);
    console.log("quotes length:", webhookResponse?.quotes?.length);
    console.log("quotes[0]:", JSON.stringify(webhookResponse?.quotes?.[0], null, 2));

    const rawQuotes = Array.isArray(webhookResponse?.quotes) ? webhookResponse.quotes : [];
    const rawCashflow = liveData.cashflow ?? [];
    const rawRevenue = liveData.revenue ?? [];
    // Unwrap n8n per-item envelope: [{ json: {...} }] → [{...}]
    const unwrapItems = (arr: any[]): any[] =>
      arr.map((item: any) =>
        item && typeof item === "object" && item.json && typeof item.json === "object" ? item.json : item
      );
    const rawExpenses = unwrapItems(liveData.expenses ?? []);
    console.log("[Expenses Debug] raw length:", (liveData.expenses ?? []).length, "unwrapped sample:", rawExpenses[0]);
    const qs = liveData.quotesSummary as any;
    const cs = liveData.cashflowSummary as any;
    const meta = liveData._meta as any;

    if (meta) {
      console.log("Dashboard data loaded:", meta);
    }

    // ===== QUOTED JOBS TABLE =====
    const quotedJobs: QuotedJob[] = rawQuotes
      .map((r: any, i: number) => ({
        id: `Q${i}`,
        company: String(r["Company Name"] ?? r._company ?? "").trim(),
        project: String(r["Project Name"] ?? r._project ?? "").trim(),
        value: typeof r["Contract Value ($)"] === "number"
          ? r["Contract Value ($)"]
          : parseFloat(String(r["Contract Value ($)"] ?? r._value ?? "0").replace(/[^0-9.-]/g, "")) || 0,
        status: (r.Status === "won" || r.Status === "lost" || r.Status === "yellow" || r.Status === "pending")
          ? r.Status as "won" | "lost" | "yellow" | "pending"
          : normalizeQuoteStatus(String(r["Current Status"] ?? "pending")),
        rawStatus: String(r["Current Status"] ?? r["Current\nStatus"] ?? r.Status ?? "").trim(),
        dateQuoted: String(r["Estimated Job Date"] ?? r["Date Quoted"] ?? "").trim(),
        stageValue: parseNum(r["Stage Value ($)"] ?? 0),
        lostReason: String(r["Lost/Dead Reason"] ?? r["Lost/Dead\nReason"] ?? "").trim(),
        zohoId: String(r["Job/Lead ID (Zoho)"] ?? r["Job / Lead ID\n(Zoho)"] ?? "").trim(),
        projectYear: String(r["Project Year"] ?? r["Project\nYear"] ?? "").trim(),
      }))
      .filter((j) => j.company || j.project)
      .sort((a: QuotedJob, b: QuotedJob) => {
        if (!a.dateQuoted && !b.dateQuoted) return 0;
        if (!a.dateQuoted) return 1;
        if (!b.dateQuoted) return -1;
        return new Date(b.dateQuoted).getTime() - new Date(a.dateQuoted).getTime();
      });

    const testRow = webhookResponse?.quotes?.[0] ?? webhookResponse?.[0]?.quotes?.[0] ?? {};
    const valuePaths: Record<string, unknown> = {
      'direct ["Contract Value ($)"]': testRow?.["Contract Value ($)"],
      "direct._value": testRow?._value,
      "direct.value": testRow?.value,
      "direct.Value": testRow?.Value,
      "direct.Amount": testRow?.Amount,
      "all keys": Object.keys(testRow ?? {}).join(", "),
    };

    const quotesDebug: QuotesDebugInfo = {
      rawResponseType: typeof webhookResponse,
      topLevelKeys: Object.keys(webhookResponse ?? {}),
      hasTopLevelQuotes: Array.isArray(webhookResponse?.quotes),
      rawQuotesLength: rawQuotes.length,
      afterFilterLength: quotedJobs.length,
      row0ContractValue: rawQuotes[0]?.["Contract Value ($)"],
      row0UnderscoreValue: rawQuotes[0]?._value,
      row0Keys: Object.keys(rawQuotes[0] ?? {}),
      firstQuoteTopLevel: webhookResponse?.quotes?.[0] ?? null,
      rawQuotesSample: rawQuotes.slice(0, 3),
      valuePaths,
    };

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
    // New webhook format: { Category, "Sub-Category", "Weekly Cost", "Monthly Cost", "Yearly Cost" }
    // Fallback to legacy _label_ format
    const expenseItems: ExpenseItem[] = rawExpenses
      .filter((r: any) => {
        // New format: exclude TOTAL sub-categories and GRAND TOTAL
        const subCat = r["Sub-Category"] ?? r._label_name ?? "";
        const cat = r["Category"] ?? r._label_category ?? "";
        if (String(subCat).toUpperCase() === "TOTAL" || String(subCat).toUpperCase() === "ALL") return false;
        if (String(cat).toUpperCase() === "GRAND TOTAL") return false;
        // Legacy format
        if (r._label_isLineItem !== undefined) return r._label_isLineItem === true;
        // New format: must have a sub-category
        return !!subCat;
      })
      .map((r: any) => ({
        name: String(r["Sub-Category"] ?? r._label_name ?? "").trim(),
        category: String(r["Category"] ?? r._label_category ?? "Uncategorised").trim(),
        weeklyCost: parseNum(r["Weekly Cost"] ?? r._label_weeklyCost ?? 0),
        monthlyCost: parseNum(r["Monthly Cost"] ?? r._label_monthlyCost ?? 0),
        yearlyCost: parseNum(r["Yearly Cost"] ?? r._label_yearlyCost ?? 0),
      }));

    console.log("[Expenses Debug] line items:", expenseItems.length, "categories:", [...new Set(expenseItems.map(i => i.category))]);

    const catMap: Record<string, ExpenseItem[]> = {};
    for (const item of expenseItems) {
      if (!catMap[item.category]) catMap[item.category] = [];
      catMap[item.category].push(item);
    }
    const expenseCategories: ExpenseCategoryGroup[] = Object.entries(catMap).map(([cat, items]) => ({
      category: cat,
      items,
      totalWeekly: items.reduce((s, i) => s + i.weeklyCost, 0),
      totalMonthly: items.reduce((s, i) => s + i.monthlyCost, 0),
      totalYearly: items.reduce((s, i) => s + i.yearlyCost, 0),
    }));

    // Grand total row
    const grandTotalRow = rawExpenses.find((r: any) => String(r["Category"] ?? "").toUpperCase() === "GRAND TOTAL");
    const grandTotalExpense: GrandTotalExpense | null = grandTotalRow ? {
      weeklyCost: parseNum(grandTotalRow["Weekly Cost"] ?? 0),
      monthlyCost: parseNum(grandTotalRow["Monthly Cost"] ?? 0),
      yearlyCost: parseNum(grandTotalRow["Yearly Cost"] ?? 0),
    } : null;

    // ===== EXPENSE ALLOCATION (PIE) =====
    let fillIdx = 0;
    const expenseAllocation: ExpenseAllocationItem[] = expenseItems.map((item) => ({
      name: item.name,
      value: item.monthlyCost,
      fill: CATEGORY_FILLS[item.name] ?? FALLBACK_FILLS[fillIdx++ % FALLBACK_FILLS.length],
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

    // Determine current month for future detection
    const now = new Date();
    const currentMonthIdx = now.getMonth();
    const currentYear = now.getFullYear();
    const MONTH_ABBR_LIST = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const parseMonthLabel = (label: string) => {
      const match = label.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2})$/i);
      if (!match) return null;
      return { month: MONTH_ABBR_LIST.indexOf(match[1]), year: 2000 + parseInt(match[2]) };
    };

    // Income vs Outgoings bar chart
    const incomeOutgoingsData: IncomeOutgoingsPoint[] = months
      .filter((m) => {
        const inc = sv(cs?.totalIncome, m);
        const outRaw = totalOutgoingsRow ? parseNum(totalOutgoingsRow[m] ?? 0) : (Math.abs(sv(cs?.totalCostOfSales, m)) + Math.abs(sv(cs?.totalOperatingExpenses, m)));
        const anticipated = sv(cs?.anticipatedSurplus, m);
        return inc !== 0 || outRaw !== 0 || anticipated !== 0;
      })
      .map((m) => {
        const inc = sv(cs?.totalIncome, m);
        const out = totalOutgoingsRow
          ? Math.abs(parseNum(totalOutgoingsRow[m] ?? 0))
          : (Math.abs(sv(cs?.totalCostOfSales, m)) + Math.abs(sv(cs?.totalOperatingExpenses, m)));
        const parsed = parseMonthLabel(m);
        const isFuture = parsed ? (parsed.year > currentYear || (parsed.year === currentYear && parsed.month > currentMonthIdx)) : false;
        // For future months: derive probable income from anticipatedSurplus + totalOutgoings
        // This reconstructs the forecast model's implied income
        const anticipated = sv(cs?.anticipatedSurplus, m);
        const probableIncome = isFuture ? Math.max(0, anticipated + out) : 0;
        return {
          month: m,
          income: inc,
          outgoings: out,
          surplus: isFuture ? (probableIncome - out) : (inc - out),
          probableIncome,
          isFuture,
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

    // Compute formula cache with full DataStore — detect changes
    const prevResults = { ...formulaCacheInstance.getAll() };
    formulaCacheInstance.invalidate();
    const changedFormulas: string[] = [];
    if (formulas.length > 0) {
      formulaCacheInstance.compute(formulas, storeSnapshot, kpiVariables);
      const newResults = formulaCacheInstance.getAll();
      for (const f of formulas) {
        const prev = prevResults[f.id]?.value;
        const next = newResults[f.id]?.value;
        if (prev != null && next != null && prev !== 0) {
          const pctChange = Math.abs((next - prev) / prev) * 100;
          if (pctChange > 1) changedFormulas.push(f.name);
        } else if (prev == null && next != null) {
          changedFormulas.push(f.name);
        }
      }
    }

    return {
      quotedJobs, revenueProjects, expenseCategories, grandTotalExpense,
      kpiStats, incomeOutgoingsData, profitMarginData, forecastChartData, expenseAllocation,
      kpiVariables, dataStore: storeSnapshot, formulaCache: formulaCacheInstance, changedFormulas,
      formulas, addFormula, updateFormula, deleteFormula,
      dataHealth, quotesDebug, isLoading, hasLiveData, connectedCount, lastUpdated,
      sources: ds.sources, toggleConnection: ds.toggleConnection,
      updateWebhookUrl: ds.updateWebhookUrl, saveAndTest: ds.saveAndTest, syncNow: ds.syncNow,
    };
  }, [liveData, hasLiveData, connectedCount, isLoading, ds, formulas, addFormula, updateFormula, deleteFormula]);

  return <DashboardDataContext.Provider value={data}>{children}</DashboardDataContext.Provider>;
}

export function useDashboardData(): DashboardData {
  const ctx = useContext(DashboardDataContext);
  if (!ctx) {
    return {
      quotedJobs: [], revenueProjects: [], expenseCategories: [], grandTotalExpense: null,
      kpiStats: [], incomeOutgoingsData: [], profitMarginData: [],
      forecastChartData: [], expenseAllocation: [], kpiVariables: {},
      dataStore: { quotes: [], qtsSmmry: [], cashflow: [], revenue: [], expenses: [], labour: [], stock: [], quotesSummary: {}, cashflowSummary: {}, revenueSummary: {}, expensesSummary: {} },
      formulaCache: formulaCacheInstance,
      changedFormulas: [],
      formulas: [], addFormula: () => {}, updateFormula: () => {}, deleteFormula: () => {},
      dataHealth: {
        quotes: { status: "disconnected", rawCount: 0, mappedCount: 0 },
        cashflow: { status: "disconnected", rawCount: 0, mappedCount: 0 },
        revenue: { status: "disconnected", rawCount: 0, mappedCount: 0 },
        expenses: { status: "disconnected", rawCount: 0, mappedCount: 0 },
      },
      quotesDebug: {
        rawResponseType: "undefined",
        topLevelKeys: [],
        hasTopLevelQuotes: false,
        rawQuotesLength: 0,
        afterFilterLength: 0,
        row0ContractValue: null,
        row0UnderscoreValue: null,
        row0Keys: [],
        firstQuoteTopLevel: null,
        rawQuotesSample: [],
        valuePaths: {},
      },
      isLoading: false, hasLiveData: false, connectedCount: 0, lastUpdated: null,
      sources: [], toggleConnection: () => {}, updateWebhookUrl: () => {},
      saveAndTest: async () => ({ success: false, error: "Not initialized" }), syncNow: () => {},
    } as DashboardData;
  }
  return ctx;
}
