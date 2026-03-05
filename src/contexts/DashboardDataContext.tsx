import React, { createContext, useContext, useMemo } from "react";
import { useDataSources, LiveData } from "@/hooks/useDataSources";
import type {
  QuotedJob,
  QuoteSummary,
  CashflowMonth,
  RevenueProject,
  ExpenseCategory,
} from "@/data/mockData";

// Helper to flexibly get a value from an object regardless of key casing
function flexGet(obj: any, ...keys: string[]): any {
  if (!obj || typeof obj !== "object") return undefined;
  for (const k of keys) {
    if (obj[k] !== undefined) return obj[k];
  }
  // Try case-insensitive match on first key
  const lower = keys[0].toLowerCase();
  for (const k of Object.keys(obj)) {
    if (k.toLowerCase() === lower) return obj[k];
  }
  return undefined;
}

function parseNum(v: any): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[$,\s]/g, "");
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

// ---- Row validation: skip blank/spacer rows ----

function isBlankRow(row: any, requiredKeys: string[][]): boolean {
  if (!row || typeof row !== "object") return true;
  // A row is blank if ALL of its required fields are empty/undefined
  return requiredKeys.every((keys) => {
    const val = flexGet(row, ...keys);
    return val === undefined || val === null || val === "" || val === 0;
  });
}

// ---- Mappers with row validation ----

function mapQuotes(raw: any[]): QuotedJob[] {
  return raw
    .filter((r) => !isBlankRow(r, [["quoteNumber", "Quote Number", "quote_number"], ["value", "Value (excl GST)", "Amount"]]))
    .map((r, i) => ({
      id: flexGet(r, "id", "ID") || `Q${i}`,
      quoteNumber: flexGet(r, "quoteNumber", "Quote Number", "quote_number") || "",
      company: flexGet(r, "company", "Company", "Client") || "",
      project: flexGet(r, "project", "Project", "Project Name", "Description") || "",
      value: parseNum(flexGet(r, "value", "Value (excl GST)", "Value", "value_excl_gst", "Amount")),
      totalPOs: parseNum(flexGet(r, "totalPOs", "Total POs", "POs", "total_pos")),
      status: normalizeQuoteStatus(flexGet(r, "status", "Status") || "pending"),
      dateQuoted: flexGet(r, "dateQuoted", "Date Quoted", "date_quoted", "Date") || "",
      notes: flexGet(r, "notes", "Notes") || undefined,
    }));
}

function normalizeQuoteStatus(s: string): "won" | "lost" | "pending" | "yellow" {
  const lower = s.toLowerCase().trim();
  if (lower === "won" || lower === "accepted") return "won";
  if (lower === "lost" || lower === "declined" || lower === "rejected") return "lost";
  if (lower === "yellow" || lower === "90%" || lower === "90% likely" || lower === "likely") return "yellow";
  return "pending";
}

function mapCashflow(raw: any[]): CashflowMonth[] {
  return raw
    .filter((r) => !isBlankRow(r, [["month", "Month"], ["totalIncome", "Total Income", "Income"]]))
    .map((r) => {
      const totalIncome = parseNum(flexGet(r, "totalIncome", "Total Income", "total_income", "Income"));
      const labour = parseNum(flexGet(r, "Labour", "labour", "COS Labour"));
      const tactile = parseNum(flexGet(r, "Tactile", "tactile", "COS Tactile"));
      const otherProducts = parseNum(flexGet(r, "Other Products", "otherProducts", "COS Other"));
      const cosTotal = parseNum(flexGet(r, "Total COS", "costOfSalesTotal")) || (labour + tactile + otherProducts);
      const grossProfit = parseNum(flexGet(r, "grossProfit", "Gross Profit", "gross_profit")) || (totalIncome - cosTotal);
      const totalEmployment = parseNum(flexGet(r, "totalEmploymentExpenses", "Total Employment", "Total Wages"));
      const totalOperating = parseNum(flexGet(r, "totalOperatingExpenses", "Total Operating", "Total Opex"));
      const totalOutgoings = parseNum(flexGet(r, "totalOutgoings", "Total Outgoings")) || (cosTotal + totalEmployment + totalOperating);

      return {
        month: flexGet(r, "month", "Month") || "",
        openingBalance: parseNum(flexGet(r, "openingBalance", "Opening Balance", "opening_balance")),
        totalIncome,
        costOfSales: { labour, tactile, otherProducts, total: cosTotal },
        grossProfit,
        employmentExpenses: {},
        totalEmploymentExpenses: totalEmployment,
        operatingExpenses: {},
        totalOperatingExpenses: totalOperating,
        totalOutgoings,
        gstCollected: parseNum(flexGet(r, "gstCollected", "GST Collected")),
        gstPaid: parseNum(flexGet(r, "gstPaid", "GST Paid")),
        gstOwing: parseNum(flexGet(r, "gstOwing", "GST Owing")),
        cashSurplus: parseNum(flexGet(r, "cashSurplus", "Cash Surplus", "Surplus")),
        closingBalance: parseNum(flexGet(r, "closingBalance", "Closing Balance", "closing_balance")),
      };
    });
}

function mapRevenue(raw: any[]): RevenueProject[] {
  return raw
    .filter((r) => !isBlankRow(r, [["company", "Company", "Client"], ["valueExclGST", "Value (excl GST)", "Value"]]))
    .map((r, i) => ({
      id: flexGet(r, "id", "ID") || `R${i}`,
      company: flexGet(r, "company", "Company", "Client") || "",
      project: flexGet(r, "project", "Project", "Project Name") || "",
      valueInclGST: parseNum(flexGet(r, "valueInclGST", "Value (incl GST)", "Value Incl GST")),
      valueExclGST: parseNum(flexGet(r, "valueExclGST", "Value (excl GST)", "Value Excl GST", "Value")),
      invoiceDate: flexGet(r, "invoiceDate", "Invoice Date", "invoice_date") || "",
      dueDate: flexGet(r, "dueDate", "Due Date", "due_date") || "",
      labourCost: parseNum(flexGet(r, "labourCost", "Labour Cost", "Labour")),
      tactileCost: parseNum(flexGet(r, "tactileCost", "Tactile Cost", "Tactile")),
      otherProducts: parseNum(flexGet(r, "otherProducts", "Other Products", "Other")),
      totalCOGS: parseNum(flexGet(r, "totalCOGS", "Total COGS", "COGS")),
      grossProfit: parseNum(flexGet(r, "grossProfit", "Gross Profit")),
      status: normalizeRevenueStatus(flexGet(r, "status", "Status") || "pending"),
    }));
}

function normalizeRevenueStatus(s: string): "invoiced" | "pending" | "overdue" {
  const lower = s.toLowerCase().trim();
  if (lower === "invoiced" || lower === "paid") return "invoiced";
  if (lower === "overdue" || lower === "late") return "overdue";
  return "pending";
}

function mapExpenses(raw: any[]): ExpenseCategory[] {
  const validRows = raw.filter((r) => !isBlankRow(r, [["name", "Name", "Item", "Expense"], ["monthlyCost", "Monthly Cost", "Monthly"]]));
  const groups: Record<string, { name: string; paymentDate?: string; weeklyCost: number; monthlyCost: number; yearlyCost: number }[]> = {};
  for (const r of validRows) {
    const cat = flexGet(r, "category", "Category") || "Uncategorised";
    const item = {
      name: flexGet(r, "name", "Name", "Item", "Expense") || "",
      paymentDate: flexGet(r, "paymentDate", "Payment Date") || undefined,
      weeklyCost: parseNum(flexGet(r, "weeklyCost", "Weekly Cost", "Weekly")),
      monthlyCost: parseNum(flexGet(r, "monthlyCost", "Monthly Cost", "Monthly")),
      yearlyCost: parseNum(flexGet(r, "yearlyCost", "Yearly Cost", "Yearly", "Annual")),
    };
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  }
  return Object.entries(groups).map(([category, items]) => ({
    category,
    items,
    totalWeekly: items.reduce((s, i) => s + i.weeklyCost, 0),
    totalMonthly: items.reduce((s, i) => s + i.monthlyCost, 0),
    totalYearly: items.reduce((s, i) => s + i.yearlyCost, 0),
  }));
}

// ---- Data Health ----

export type DataHealthStatus = "disconnected" | "connected-empty" | "connected-header-mismatch" | "healthy";

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

function calcSectionHealth(rawArr: any[] | undefined, mappedArr: any[]): SectionHealth {
  if (!rawArr || rawArr.length === 0) {
    return { status: "disconnected", rawCount: 0, mappedCount: 0 };
  }
  if (mappedArr.length === 0 && rawArr.length > 0) {
    return { status: "connected-header-mismatch", rawCount: rawArr.length, mappedCount: 0 };
  }
  if (mappedArr.length > 0) {
    return { status: "healthy", rawCount: rawArr.length, mappedCount: mappedArr.length };
  }
  return { status: "connected-empty", rawCount: 0, mappedCount: 0 };
}

// ---- Derived data ----

export interface KPIStat {
  label: string;
  value: string;
  change: string;
  positive: boolean;
  noData?: boolean;
}

export interface ExpenseAllocationItem {
  name: string;
  value: number;
  fill: string;
}

export interface CashflowChartPoint {
  month: string;
  income: number;
  outgoings: number;
  surplus: number;
  openingBalance: number;
  closingBalance: number;
}

export interface ProfitMarginPoint {
  month: string;
  grossMargin: number;
  cashSurplus: number;
}

export interface DashboardData {
  // Raw mapped data
  quotedJobs: QuotedJob[];
  quoteSummary: QuoteSummary | null;
  cashflowMonths: CashflowMonth[];
  revenueProjects: RevenueProject[];
  expenseCategories: ExpenseCategory[];

  // Derived
  kpiStats: KPIStat[];
  cashflowChartData: CashflowChartPoint[];
  profitMarginData: ProfitMarginPoint[];
  expenseAllocation: ExpenseAllocationItem[];
  kpiVariables: Record<string, number>;

  // Health
  dataHealth: DataHealth;

  // Status
  isLoading: boolean;
  hasLiveData: boolean;
  connectedCount: number;

  // Source hooks
  sources: ReturnType<typeof useDataSources>["sources"];
  toggleConnection: ReturnType<typeof useDataSources>["toggleConnection"];
  updateWebhookUrl: ReturnType<typeof useDataSources>["updateWebhookUrl"];
  saveAndTest: ReturnType<typeof useDataSources>["saveAndTest"];
  syncNow: ReturnType<typeof useDataSources>["syncNow"];
}

const DashboardDataContext = createContext<DashboardData | null>(null);

const FILLS = [
  "hsl(160, 70%, 45%)",
  "hsl(200, 80%, 50%)",
  "hsl(270, 60%, 55%)",
  "hsl(38, 92%, 55%)",
  "hsl(340, 65%, 50%)",
  "hsl(120, 50%, 40%)",
];

export function DashboardDataProvider({ children }: { children: React.ReactNode }) {
  const ds = useDataSources();
  const { liveData, hasLiveData, connectedCount, sources } = ds;

  const isLoading = sources.some((s) => s.loading);

  const data = useMemo<DashboardData>(() => {
    const quotedJobs = liveData.quotes?.length ? mapQuotes(liveData.quotes) : [];
    const cashflowMonths = liveData.cashflow?.length ? mapCashflow(liveData.cashflow) : [];
    const revenueProjects = liveData.revenue?.length ? mapRevenue(liveData.revenue) : [];
    const expenseCategories = liveData.expenses?.length ? mapExpenses(liveData.expenses) : [];

    // Data health
    const dataHealth: DataHealth = {
      quotes: calcSectionHealth(liveData.quotes, quotedJobs),
      cashflow: calcSectionHealth(liveData.cashflow, cashflowMonths),
      revenue: calcSectionHealth(liveData.revenue, revenueProjects),
      expenses: calcSectionHealth(liveData.expenses, expenseCategories),
    };

    // Quote summary
    const quoteSummary: QuoteSummary | null = quotedJobs.length
      ? (() => {
          const totalQuoted = quotedJobs.reduce((s, q) => s + q.value, 0);
          const totalWon = quotedJobs.filter((q) => q.status === "won").reduce((s, q) => s + q.value, 0);
          const totalLost = quotedJobs.filter((q) => q.status === "lost").reduce((s, q) => s + q.value, 0);
          const quotedRemaining = totalQuoted - totalWon - totalLost;
          const conversionRate = totalQuoted > 0 ? (totalWon / totalQuoted) * 100 : 0;
          const totalCOGS = revenueProjects.reduce((s, p) => s + p.totalCOGS, 0);
          const labourCost = revenueProjects.reduce((s, p) => s + p.labourCost, 0);
          return {
            totalQuoted,
            totalWon,
            totalLost,
            quotedRemaining,
            conversionRate: Math.round(conversionRate * 10) / 10,
            grossRevenue: totalWon,
            costOfGoods: totalCOGS,
            labourCost,
            netRevenue: totalWon - totalCOGS,
          };
        })()
      : null;

    // Cashflow chart data
    const cashflowChartData: CashflowChartPoint[] = cashflowMonths.map((m) => ({
      month: m.month,
      income: m.totalIncome,
      outgoings: m.totalOutgoings,
      surplus: m.cashSurplus,
      openingBalance: m.openingBalance,
      closingBalance: m.closingBalance,
    }));

    // Profit margin data
    const profitMarginData: ProfitMarginPoint[] = cashflowMonths.map((m) => ({
      month: m.month,
      grossMargin: m.totalIncome > 0 ? Math.round((m.grossProfit / m.totalIncome) * 100) : 0,
      cashSurplus: m.cashSurplus,
    }));

    // Expense allocation
    const expenseAllocation: ExpenseAllocationItem[] = expenseCategories.map((cat, i) => ({
      name: cat.category,
      value: cat.totalMonthly,
      fill: FILLS[i % FILLS.length],
    }));

    // KPI variables for formula engine
    const cashPosition = cashflowMonths.length ? cashflowMonths[cashflowMonths.length - 1].closingBalance : 0;
    const monthlyExpenses = expenseCategories.reduce((s, c) => s + c.totalMonthly, 0);
    const kpiVariables: Record<string, number> = {
      TotalQuoted: quoteSummary?.totalQuoted || 0,
      TotalWon: quoteSummary?.totalWon || 0,
      TotalLost: quoteSummary?.totalLost || 0,
      GrossRevenue: quoteSummary?.grossRevenue || 0,
      CostOfGoods: quoteSummary?.costOfGoods || 0,
      LabourCost: quoteSummary?.labourCost || 0,
      NetRevenue: quoteSummary?.netRevenue || 0,
      ConversionRate: quoteSummary?.conversionRate || 0,
      CashPosition: cashPosition,
      MonthlyExpenses: monthlyExpenses,
    };

    // KPI stat cards
    const fmt = (n: number) => {
      if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}K`;
      return `$${n.toLocaleString()}`;
    };

    const noData = !hasLiveData;
    const kpiStats: KPIStat[] = [
      { label: "Total Quoted", value: noData ? "--" : fmt(kpiVariables.TotalQuoted), change: "--", positive: true, noData },
      { label: "Net Revenue (excl GST)", value: noData ? "--" : fmt(kpiVariables.NetRevenue), change: "--", positive: kpiVariables.NetRevenue >= 0, noData },
      { label: "Cash Position", value: noData ? "--" : fmt(kpiVariables.CashPosition), change: "--", positive: kpiVariables.CashPosition >= 0, noData },
      { label: "Conversion Rate", value: noData ? "--" : `${kpiVariables.ConversionRate}%`, change: "--", positive: kpiVariables.ConversionRate >= 20, noData },
    ];

    return {
      quotedJobs,
      quoteSummary,
      cashflowMonths,
      revenueProjects,
      expenseCategories,
      kpiStats,
      cashflowChartData,
      profitMarginData,
      expenseAllocation,
      kpiVariables,
      dataHealth,
      isLoading,
      hasLiveData,
      connectedCount,
      sources: ds.sources,
      toggleConnection: ds.toggleConnection,
      updateWebhookUrl: ds.updateWebhookUrl,
      saveAndTest: ds.saveAndTest,
      syncNow: ds.syncNow,
    };
  }, [liveData, hasLiveData, connectedCount, isLoading, ds]);

  return <DashboardDataContext.Provider value={data}>{children}</DashboardDataContext.Provider>;
}

export function useDashboardData(): DashboardData {
  const ctx = useContext(DashboardDataContext);
  if (!ctx) throw new Error("useDashboardData must be used within DashboardDataProvider");
  return ctx;
}
