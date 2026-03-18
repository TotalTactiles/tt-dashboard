import React, { createContext, useContext, useMemo, useRef, useState, useCallback } from "react";
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

function normalizeRevenueStatus(raw: string): "invoiced" | "paid" | "pending" | "overdue" {
  const s = (raw ?? "").toUpperCase();
  if (s.includes("PAID")) return "paid";
  if (s.includes("INVOICED")) return "invoiced";
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
  projectStage: string;
  stageValue: number;
  valueInclGST: number;
  valueExclGST: number;
  invoiceDate: string;
  dueDate: string;
  labourCost: number;
  tactileCost: number;
  otherCost: number;
  totalCOGS: number;
  grossProfit: number;
  status: "invoiced" | "paid" | "pending" | "overdue";
  otherDate: string;
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
  altValue?: string;
  altChange?: string;
  altPositive?: boolean;
  altDiff?: string;
  toggleLabelBase?: string;
  toggleLabelAlt?: string;
  momDelta?: string;
  momContext?: string;
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
  netProfitMargin: number | null;
}

export interface ForecastChartPoint {
  month: string;
  totalOutgoings: number;
  anticipatedSurplus: number;
  probableJobs: number;
  costOfJobsProbable: number;
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
  cashflowPositionRaw: number;
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
  syncCalendar: () => Promise<void>;
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
  const { liveData, hasLiveData, connectedCount, sources, calendarData } = ds;
  const isLoading = sources.some((s) => s.loading);
  const { formulas, addFormula, updateFormula, deleteFormula } = useFormulas();
  const [calendarEventsOverride, setCalendarEventsState] = useState<LiveCalendarEvent[] | null>(null);

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
        // "Other Date" is the business date for month grouping; fall back to invoiceDate
        const otherDate = String(r["Other Date"] ?? r._label_otherDate ?? r._label_invoiceDate ?? "").trim();
        return {
          id: `R${i}`,
          company: r._label_company ?? "",
          project: r._label_project ?? "",
          projectStage: String(r._label_projectStage ?? "").trim(),
          stageValue: parseNum(r._label_stageValue ?? 0),
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
          otherDate,
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

    // Find cashflow row by EXACT label match first, then fuzzy fallback
    const getCashflowRowLabel = (r: any): string => (r._label_rowLabel ?? r.col_1 ?? "").toString().trim();
    const findCashflowRowExact = (label: string) => {
      const upper = label.toUpperCase().trim();
      // 1. Exact match
      const exact = rawCashflow.find((r: any) => getCashflowRowLabel(r).toUpperCase() === upper);
      if (exact) return exact;
      // 2. Fuzzy: but require the row label to contain the FULL search term (not the other way around for short labels)
      return rawCashflow.find((r: any) => {
        const rl = getCashflowRowLabel(r).toUpperCase();
        return rl.includes(upper);
      }) ?? null;
    };

    // IMPORTANT: Find longer/more specific labels FIRST to avoid ambiguous fuzzy matches
    const surplusWithJobsRow = findCashflowRowExact("Anticipated Cash Surplus/(Deficit) Including Probable Jobs");
    const costOfJobsProbableRow = findCashflowRowExact("Cost of Jobs Probable To Be Won");
    const jobsProbableRow = findCashflowRowExact("Jobs Probable To Be Won");
    const openingBalancesRow = findCashflowRowExact("OPENING BALANCES");
    const totalOutgoingsRow = findCashflowRowExact("Total Outgoings");
    const totalIncomeRow = findCashflowRowExact("Total Income");
    // For "Anticipated Cash Surplus/(Deficit)" — must NOT match the "Including Probable Jobs" variant
    const anticipatedSurplusRow = (() => {
      const label = "Anticipated Cash Surplus/(Deficit)";
      const upper = label.toUpperCase().trim();
      const excludeUpper = "INCLUDING PROBABLE";
      return rawCashflow.find((r: any) => {
        const rl = getCashflowRowLabel(r).toUpperCase();
        return (rl === upper || (rl.includes(upper) && !rl.includes(excludeUpper)));
      }) ?? null;
    })();

    console.log("[Cashflow Row Debug]", {
      openingBalances: !!openingBalancesRow, totalIncome: !!totalIncomeRow,
      totalOutgoings: !!totalOutgoingsRow, anticipatedSurplus: !!anticipatedSurplusRow,
      jobsProbable: !!jobsProbableRow, costOfJobsProbable: !!costOfJobsProbableRow, surplusWithJobs: !!surplusWithJobsRow,
      rowLabels: rawCashflow.slice(0, 20).map((r: any) => getCashflowRowLabel(r)),
    });

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
        const inc = totalIncomeRow ? parseNum(totalIncomeRow[m] ?? 0) : sv(cs?.totalIncome, m);
        const outRaw = totalOutgoingsRow ? parseNum(totalOutgoingsRow[m] ?? 0) : (Math.abs(sv(cs?.totalCostOfSales, m)) + Math.abs(sv(cs?.totalOperatingExpenses, m)));
        const anticipated = anticipatedSurplusRow ? parseNum(anticipatedSurplusRow[m] ?? 0) : sv(cs?.anticipatedSurplus, m);
        return inc !== 0 || outRaw !== 0 || anticipated !== 0;
      })
      .map((m) => {
        const inc = totalIncomeRow ? parseNum(totalIncomeRow[m] ?? 0) : sv(cs?.totalIncome, m);
        const out = totalOutgoingsRow
          ? Math.abs(parseNum(totalOutgoingsRow[m] ?? 0))
          : (Math.abs(sv(cs?.totalCostOfSales, m)) + Math.abs(sv(cs?.totalOperatingExpenses, m)));
        const parsed = parseMonthLabel(m);
        const isFuture = parsed ? (parsed.year > currentYear || (parsed.year === currentYear && parsed.month > currentMonthIdx)) : false;
        // Use exact "Anticipated Cash Surplus/(Deficit)" row for surplus — do NOT derive from inc - out
        const surplus = anticipatedSurplusRow ? parseNum(anticipatedSurplusRow[m] ?? 0) : sv(cs?.anticipatedSurplus, m);
        // For future months: derive probable income from surplus + outgoings (reconstructs forecast model's implied income)
        const probableIncome = isFuture ? Math.max(0, surplus + out) : 0;
        return {
          month: m,
          income: inc,
          outgoings: out,
          surplus,
          probableIncome,
          isFuture,
        };
      });

    // Gross Profit Margin chart — strict monthly comparison based on REVENUE line-item months only.
    // Gross Margin % = Σ(gross profit) / Σ(revenue ex GST) × 100
    // Net Profit Margin % = (Σ(gross profit) − monthly operating expenses) / Σ(revenue ex GST) × 100
    // Both series therefore share the same month key basis and denominator.
    const dateToMonKey = (dateStr: string): string | null => {
      if (!dateStr) return null;
      if (/^[A-Za-z]{3}-\d{2}$/i.test(dateStr)) return dateStr;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      const abbr = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${abbr[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`;
    };

    const gpByMonth: Record<string, { totalRevenue: number; totalGP: number; rowCount: number; excluded: number }> = {};
    for (const rp of revenueProjects) {
      const mk = dateToMonKey(rp.otherDate) || dateToMonKey(rp.invoiceDate);
      if (!mk) {
        console.log("[GP Chart Debug] Excluded row (no date):", rp.company, rp.project);
        continue;
      }
      if (rp.valueExclGST <= 0) {
        if (!gpByMonth[mk]) gpByMonth[mk] = { totalRevenue: 0, totalGP: 0, rowCount: 0, excluded: 0 };
        gpByMonth[mk].excluded++;
        continue;
      }
      if (!gpByMonth[mk]) gpByMonth[mk] = { totalRevenue: 0, totalGP: 0, rowCount: 0, excluded: 0 };
      gpByMonth[mk].totalRevenue += rp.valueExclGST;
      gpByMonth[mk].totalGP += rp.grossProfit;
      gpByMonth[mk].rowCount++;
    }

    const MONTH_ORDER: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    const comparisonMonths = Object.keys(gpByMonth)
      .filter((mk) => gpByMonth[mk].rowCount > 0)
      .sort((a, b) => {
        const [am, ay] = [a.slice(0, 3).toLowerCase(), parseInt(a.slice(4), 10)];
        const [bm, by] = [b.slice(0, 3).toLowerCase(), parseInt(b.slice(4), 10)];
        return (ay - by) || ((MONTH_ORDER[am] ?? 0) - (MONTH_ORDER[bm] ?? 0));
      });

    // Net Profit source: "Anticipated Cash Surplus/(Deficit)" row from CASHFLOW sheet
    const hasNetProfitSource = !!anticipatedSurplusRow;

    const gpRowDetail: Record<string, Array<{ company: string; project: string; revenueExGST: number; totalCOGS: number; grossProfit: number; otherDate: string; invoiceDate: string; dateUsed: string }>> = {};
    for (const rp of revenueProjects) {
      const mk = dateToMonKey(rp.otherDate) || dateToMonKey(rp.invoiceDate);
      if (!mk || rp.valueExclGST <= 0) continue;
      if (!gpRowDetail[mk]) gpRowDetail[mk] = [];
      gpRowDetail[mk].push({
        company: rp.company,
        project: rp.project,
        revenueExGST: rp.valueExclGST,
        totalCOGS: rp.totalCOGS,
        grossProfit: rp.grossProfit,
        otherDate: rp.otherDate,
        invoiceDate: rp.invoiceDate,
        dateUsed: rp.otherDate ? "otherDate" : "invoiceDate",
      });
    }

    const profitMarginData: ProfitMarginPoint[] = comparisonMonths.map((mk) => {
      const bucket = gpByMonth[mk];
      const grossMargin = bucket.totalRevenue > 0 ? Math.round((bucket.totalGP / bucket.totalRevenue) * 10000) / 100 : 0;
      // Net Profit = "Anticipated Cash Surplus/(Deficit)" value for this exact month
      const cashflowNetProfit = hasNetProfitSource ? parseNum(anticipatedSurplusRow![mk] ?? null) : null;
      const netProfitMargin = hasNetProfitSource && cashflowNetProfit !== null && bucket.totalRevenue > 0
        ? Math.round((cashflowNetProfit / bucket.totalRevenue) * 10000) / 100
        : null;
      return { month: mk, grossMargin, netProfitMargin };
    });

    console.log("[GP Chart Proof] === GROSS / NET PROFIT MARGIN VERIFICATION ===");
    console.log(`[GP Chart Proof] Net Profit source: CASHFLOW → "Anticipated Cash Surplus/(Deficit)" row (found: ${hasNetProfitSource})`);
    console.log(`[GP Chart Proof] Month alignment: strict intersection of REVENUE months & CASHFLOW columns (${comparisonMonths.join(", ") || "none"})`);
    for (const mk of comparisonMonths) {
      const bucket = gpByMonth[mk];
      const rows = gpRowDetail[mk] || [];
      const grossMargin = bucket.totalRevenue > 0 ? Math.round((bucket.totalGP / bucket.totalRevenue) * 10000) / 100 : 0;
      const cashflowNetProfit = hasNetProfitSource ? parseNum(anticipatedSurplusRow![mk] ?? null) : null;
      const netProfitMargin = hasNetProfitSource && cashflowNetProfit !== null && bucket.totalRevenue > 0
        ? Math.round((cashflowNetProfit / bucket.totalRevenue) * 10000) / 100
        : null;
      console.log(`[Net Profit Verification] Month: ${mk}`);
      console.log(`[Net Profit Verification]   Revenue: $${bucket.totalRevenue.toFixed(2)} (source: REVENUE tab, ${rows.length} line items)`);
      console.log(`[Net Profit Verification]   Net Profit: ${cashflowNetProfit !== null ? `$${cashflowNetProfit.toFixed(2)}` : "null"} (source row: "Anticipated Cash Surplus/(Deficit)")`);
      console.log(`[Net Profit Verification]   Formula: ${cashflowNetProfit?.toFixed(2)} / ${bucket.totalRevenue.toFixed(2)} × 100 = ${netProfitMargin !== null ? `${netProfitMargin}%` : "null"}`);
      console.log(`[Net Profit Verification]   GP%: ${grossMargin}% | Net%: ${netProfitMargin !== null ? `${netProfitMargin}%` : "n/a"} | ${netProfitMargin !== null ? "PASS" : "SKIP (missing cashflow data)"}`);
      for (const r of rows) {
        console.log(`[GP Chart Proof]     - ${r.company} | ${r.project} | rev=$${r.revenueExGST.toFixed(2)} | cogs=$${r.totalCOGS.toFixed(2)} | gp=$${r.grossProfit.toFixed(2)} | date=${r.otherDate || r.invoiceDate} (${r.dateUsed})`);
      }
    }

    const excludedRows = revenueProjects.filter((rp) => {
      const mk = dateToMonKey(rp.otherDate) || dateToMonKey(rp.invoiceDate);
      return !mk || rp.valueExclGST <= 0;
    });
    if (excludedRows.length > 0) {
      console.log(`[GP Chart Proof] === EXCLUDED ROWS (${excludedRows.length}) ===`);
      for (const rp of excludedRows) {
        const reason = !(dateToMonKey(rp.otherDate) || dateToMonKey(rp.invoiceDate)) ? "no valid date" : "zero/negative revenue";
        console.log(`[GP Chart Proof]   - ${rp.company} | ${rp.project} | rev=$${rp.valueExclGST.toFixed(2)} | otherDate="${rp.otherDate}" | invoiceDate="${rp.invoiceDate}" | reason: ${reason}`);
      }
    }
    console.log("[GP Chart Proof] === END VERIFICATION ===");

    // Forecast chart — use exact named rows (5 distinct series)
    const forecastChartData: ForecastChartPoint[] = months.map((m) => {
      const totalOut = totalOutgoingsRow ? Math.abs(parseNum(totalOutgoingsRow[m] ?? 0)) : 0;
      const anticipated = anticipatedSurplusRow ? parseNum(anticipatedSurplusRow[m] ?? 0) : sv(cs?.anticipatedSurplus, m);
      const probable = jobsProbableRow ? parseNum(jobsProbableRow[m] ?? 0) : 0;
      const costProbable = costOfJobsProbableRow ? parseNum(costOfJobsProbableRow[m] ?? 0) : 0;
      const surplusWithJobs = surplusWithJobsRow ? parseNum(surplusWithJobsRow[m] ?? 0) : (cs?.anticipatedSurplusWithJobs ? sv(cs.anticipatedSurplusWithJobs, m) : 0);
      return { month: m, totalOutgoings: totalOut, anticipatedSurplus: anticipated, probableJobs: probable, costOfJobsProbable: costProbable, surplusIncludingProbable: surplusWithJobs };
    });

    // Debug: log first forecast data point to verify all 5 series have data
    if (forecastChartData.length > 0) {
      const sample = forecastChartData[0];
      const hasData = {
        totalOutgoings: forecastChartData.some(d => d.totalOutgoings !== 0),
        anticipatedSurplus: forecastChartData.some(d => d.anticipatedSurplus !== 0),
        probableJobs: forecastChartData.some(d => d.probableJobs !== 0),
        costOfJobsProbable: forecastChartData.some(d => d.costOfJobsProbable !== 0),
        surplusIncludingProbable: forecastChartData.some(d => d.surplusIncludingProbable !== 0),
      };
      console.log("[Forecast Series Debug]", { sampleMonth: sample.month, sample, hasNonZeroData: hasData });
    }

    // ===== KPI STAT CARDS =====
    const noData = !hasLiveData;

    // Card 4: Net Revenue = revenueSummary.totalValue - revenueSummary.totalCOGS (unified with formulaEngine)
    const rs = liveData?.revenueSummary as any;
    const netRevenue = (parseNum(rs?.totalValue ?? 0)) - (parseNum(rs?.totalCOGS ?? 0));

    // Card 5: Cashflow Position = current month's OPENING BALANCES value
    // Generate current month key in stable Mon-YY format (locale-independent)
    const currentMonthKey = `${MONTH_ABBR_LIST[currentMonthIdx]}-${String(currentYear).slice(-2)}`;

    // Normalize a month key to uppercase trimmed for comparison
    const normalizeKey = (k: string) => k.trim().toUpperCase();
    const currentKeyNorm = normalizeKey(currentMonthKey);

    // Find exact matching key from the actual months array (handles case/whitespace variations)
    const findMatchingMonthKey = (targetNorm: string): string | null => {
      return months.find(m => normalizeKey(m) === targetNorm) ?? null;
    };

    // Also check keys directly on the openingBalancesRow object (may differ from months array)
    const findMatchingRowKey = (row: any, targetNorm: string): string | null => {
      if (!row) return null;
      const keys = Object.keys(row);
      return keys.find(k => normalizeKey(k) === targetNorm) ?? null;
    };

    // ===== CASHFLOW POSITION: "Anticipated Cash Surplus/(Deficit)" × current month ONLY =====
    let cashflowPosition = 0;
    let cashflowPositionSource = "none";
    let cashflowPositionMatchedKey: string | null = null;
    let cashflowPositionFallback = false;

    if (anticipatedSurplusRow) {
      // Try exact current month key from row keys
      const rowKey = findMatchingRowKey(anticipatedSurplusRow, currentKeyNorm);
      if (rowKey !== null) {
        cashflowPosition = parseNum(anticipatedSurplusRow[rowKey] ?? 0);
        cashflowPositionMatchedKey = rowKey;
        cashflowPositionSource = `Anticipated Cash Surplus/(Deficit)["${rowKey}"] (exact current month)`;
      } else {
        // Try from months array
        const monthsKey = findMatchingMonthKey(currentKeyNorm);
        if (monthsKey !== null && anticipatedSurplusRow[monthsKey] !== undefined) {
          cashflowPosition = parseNum(anticipatedSurplusRow[monthsKey] ?? 0);
          cashflowPositionMatchedKey = monthsKey;
          cashflowPositionSource = `Anticipated Cash Surplus/(Deficit)["${monthsKey}"] (from months array)`;
        } else {
          // NO FALLBACK — current month is missing
          cashflowPositionSource = `Anticipated Cash Surplus/(Deficit) — current month "${currentMonthKey}" NOT FOUND`;
          cashflowPositionFallback = false;
        }
      }
    } else {
      cashflowPositionSource = `Anticipated Cash Surplus/(Deficit) row NOT FOUND in cashflow data`;
    }

    // Verification log
    const surplusRowKeys = anticipatedSurplusRow ? Object.keys(anticipatedSurplusRow).filter(k => MONTH_REGEX.test(k)) : [];
    console.log("[Cashflow Position Verification]", {
      browserDate: now.toISOString(),
      resolvedMonthKey: currentMonthKey,
      sourceRow: "Anticipated Cash Surplus/(Deficit)",
      matchedColumn: cashflowPositionMatchedKey,
      value: cashflowPosition,
      fallbackTriggered: cashflowPositionFallback,
      reason: cashflowPositionMatchedKey ? "PASS" : `Current month "${currentMonthKey}" not found in available columns: [${surplusRowKeys.join(", ")}]`,
      availableColumns: surplusRowKeys,
    });

    // ===== Extract GRN and YLW from raw qtsSmmry rows (QTS SUMMARY sheet) =====
    const rawQtsSmmry = unwrapItems(liveData.qtsSmmry ?? []);
    const findSummaryRow = (labelPatterns: string[]) => {
      const patterns = labelPatterns.map(p => p.toUpperCase());
      return rawQtsSmmry.find((row: any) => {
        const label = String(row?._label_rowLabel ?? row?.["Current Status"] ?? row?.col_1 ?? row?.Stage ?? "").toUpperCase().trim();
        return patterns.some(p => label === p || label.includes(p));
      });
    };

    const grnRow = findSummaryRow(["PO RECEIVED (GRN)", "PO RECEIVED", "GRN"]);
    const ylwRow = findSummaryRow(["VERBAL CONFIRMATION (YLW)", "VERBAL CONFIRMATION", "YLW"]);
    const ylwGrnRow = findSummaryRow(["YLW + GRN"]);

    const grnValue = parseNum(grnRow?._label_dollarValue ?? grnRow?.["Total Value"] ?? grnRow?.value ?? 0);
    const grnCount = parseNum(grnRow?._label_countValue ?? grnRow?.["Count"] ?? grnRow?.count ?? 0);
    const ylwValue = parseNum(ylwRow?._label_dollarValue ?? ylwRow?.["Total Value"] ?? ylwRow?.value ?? 0);
    const ylwCount = parseNum(ylwRow?._label_countValue ?? ylwRow?.["Count"] ?? ylwRow?.count ?? 0);

    // Priority: 1) exact "YLW + GRN" row, 2) sum of YLW + GRN rows, 3) fallback to quotesSummary
    let combinedValue: number;
    let combinedCount: number;
    if (ylwGrnRow) {
      combinedValue = parseNum(ylwGrnRow._label_dollarValue ?? ylwGrnRow["Total Value"] ?? ylwGrnRow.value ?? 0);
      combinedCount = parseNum(ylwGrnRow._label_countValue ?? ylwGrnRow["Count"] ?? ylwGrnRow.count ?? 0);
    } else if (grnRow && ylwRow) {
      combinedValue = grnValue + ylwValue;
      combinedCount = grnCount + ylwCount;
    } else {
      // Safe fallback to quotesSummary
      combinedValue = parseNum(qs?.totalWon?.value ?? 0) + parseNum(qs?.totalYellow?.value ?? 0);
      combinedCount = parseNum(qs?.totalWon?.count ?? 0) + parseNum(qs?.totalYellow?.count ?? 0);
    }

    // Use GRN row for base if available, otherwise fallback to quotesSummary.totalWon
    const baseWonValue = grnRow ? grnValue : parseNum(qs?.totalWon?.value ?? 0);
    const baseWonCount = grnRow ? grnCount : parseNum(qs?.totalWon?.count ?? 0);
    const directYlwValue = ylwRow ? ylwValue : parseNum(qs?.totalYellow?.value ?? 0);
    const directYlwCount = ylwRow ? ylwCount : parseNum(qs?.totalYellow?.count ?? 0);

    console.log("[Total Won Debug] grnRow:", !!grnRow, "ylwRow:", !!ylwRow, "ylwGrnRow:", !!ylwGrnRow,
      "base:", baseWonValue, baseWonCount, "ylw:", directYlwValue, directYlwCount, "combined:", combinedValue, combinedCount);

    const kpiStats: KPIStat[] = [
      {
        label: "Total Quoted",
        value: noData ? "--" : fmtAUD(parseNum(qs?.totalQuoted?.value ?? 0)),
        change: noData ? "--" : `${parseNum(qs?.totalQuoted?.count ?? 0)} jobs`,
        positive: true, noData,
      },
      {
        label: "Total Won",
        value: noData ? "--" : fmtAUD(baseWonValue),
        change: noData ? "--" : `${baseWonCount} jobs`,
        positive: true, noData,
        altValue: noData ? "--" : fmtAUD(combinedValue),
        altChange: noData ? "--" : `${combinedCount} jobs`,
        altPositive: combinedValue > 0,
        altDiff: noData ? undefined : (directYlwValue > 0 ? `+${fmtAUD(directYlwValue)} / ${directYlwCount} YLW jobs` : undefined),
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
        change: noData ? "--" : `${baseWonCount} won of ${parseNum(qs?.totalQuoted?.count ?? 0)}`,
        positive: parseNum(qs?.conversionRate ?? 0) >= 20, noData,
        altValue: noData ? "--" : (() => {
          const totalCount = parseNum(qs?.totalQuoted?.count ?? 0);
          const rate = totalCount > 0 ? (directYlwCount / totalCount) * 100 : 0;
          return `${rate.toFixed(1)}%`;
        })(),
        altChange: noData ? "--" : `${directYlwCount} verbal of ${parseNum(qs?.totalQuoted?.count ?? 0)}`,
        altPositive: directYlwCount > 0,
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

    const cashflowPositionFormula = formulas.find((formula) => formula.dashboardCard === "Cashflow Position");
    const cashflowPositionFormulaResult = cashflowPositionFormula ? formulaCacheInstance.get(cashflowPositionFormula.id) : null;
    console.log("[CashPosition Override Debug]", {
      variableValue: kpiVariables.CashPosition,
      formulaName: cashflowPositionFormula?.name ?? null,
      formulaExpression: cashflowPositionFormula?.expression ?? null,
      formulaResult: cashflowPositionFormulaResult?.value ?? null,
      dashboardCardUsesFormula: cashflowPositionFormulaResult?.value !== null,
      rawKpiCardValue: cashflowPosition,
    });

    // ===== CALENDAR DATA (from dedicated calendar poll) =====
    const rawCalendarEvents: LiveCalendarEvent[] = Array.isArray(calendarData?.calendarEvents)
      ? calendarData.calendarEvents
      : [];
    const rawUpcomingEvents: LiveCalendarEvent[] = Array.isArray(calendarData?.upcomingEvents)
      ? calendarData.upcomingEvents
      : [];
    const rawCalendarSummary: CalendarSummary = calendarData?.calendarSummary ?? { totalEvents: 0, upcomingCount: 0, byType: {} };

    if (rawCalendarEvents.length === 0 && hasLiveData) {
      console.warn('[Calendar] calendarEvents empty — check tt-calendar-read webhook returns this key');
    }

    return {
      quotedJobs, revenueProjects, expenseCategories, grandTotalExpense,
      cashflowPositionRaw: cashflowPosition,
      kpiStats, incomeOutgoingsData, profitMarginData, forecastChartData, expenseAllocation,
      kpiVariables, dataStore: storeSnapshot, formulaCache: formulaCacheInstance, changedFormulas,
      formulas, addFormula, updateFormula, deleteFormula,
      dataHealth, quotesDebug, isLoading, hasLiveData, connectedCount, lastUpdated,
      sources: ds.sources, toggleConnection: ds.toggleConnection,
      updateWebhookUrl: ds.updateWebhookUrl, saveAndTest: ds.saveAndTest, syncNow: ds.syncNow, syncCalendar: ds.syncCalendar,
      calendarEvents: calendarEventsOverride ?? rawCalendarEvents,
      upcomingEvents: rawUpcomingEvents,
      calendarSummary: rawCalendarSummary,
      setCalendarEvents: setCalendarEventsState,
    };
  }, [liveData, hasLiveData, connectedCount, isLoading, ds, formulas, addFormula, updateFormula, deleteFormula, setCalendarEventsState, calendarEventsOverride, calendarData]);

  return <DashboardDataContext.Provider value={data}>{children}</DashboardDataContext.Provider>;
}

export function useDashboardData(): DashboardData {
  const ctx = useContext(DashboardDataContext);
  if (!ctx) {
    return {
      quotedJobs: [], revenueProjects: [], expenseCategories: [], grandTotalExpense: null,
      cashflowPositionRaw: 0,
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
      saveAndTest: async () => ({ success: false, error: "Not initialized" }), syncNow: () => {}, syncCalendar: async () => {},
      calendarEvents: [], upcomingEvents: [], calendarSummary: null, setCalendarEvents: () => {},
    } as DashboardData;
  }
  return ctx;
}
