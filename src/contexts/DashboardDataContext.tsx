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

// ---- QUOTES MAPPER ----
// Sheet columns: (value col named "2025 QUOTED JOBS" or similar) | Company Name | Project Name | Total POs
// Status comes from row color (not readable via standard API) — default to "pending"

function findKeyContaining(obj: any, substring: string): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  return Object.keys(obj).find((k) => k.toUpperCase().includes(substring.toUpperCase()));
}

function isSummaryRow(row: any): boolean {
  const values = Object.values(row).map((v) => String(v).toUpperCase().trim());
  return values.some((v) => v === "TOTAL" || v === "SUB TOTAL" || v.startsWith("TOTAL ") || v.startsWith("SUB TOTAL"));
}

function mapQuotes(raw: any[]): QuotedJob[] {
  return raw
    .filter((r) => {
      if (!r || typeof r !== "object") return false;
      if (isSummaryRow(r)) return false;
      // Must have a company name
      const company = flexGet(r, "Company Name", "company", "Company", "Client");
      return company && String(company).trim() !== "";
    })
    .map((r, i) => {
      // The value column key contains "QUOTED" (e.g. "2025 QUOTED JOBS", "2026 QUOTED JOBS")
      const valueKey = findKeyContaining(r, "QUOTED");
      const value = valueKey ? parseNum(r[valueKey]) : parseNum(flexGet(r, "value", "Value", "Amount"));

      return {
        id: `Q${i}`,
        quoteNumber: `Q-${String(i + 1).padStart(3, "0")}`,
        company: flexGet(r, "Company Name", "company", "Company", "Client") || "",
        project: flexGet(r, "Project Name", "project", "Project", "Description") || "",
        value,
        totalPOs: parseNum(flexGet(r, "Total POs", "totalPOs", "POs", "total_pos")),
        status: normalizeQuoteStatus(flexGet(r, "Status", "status") || "pending"),
        dateQuoted: flexGet(r, "Date Quoted", "dateQuoted", "date_quoted", "Date") || "",
        notes: flexGet(r, "Notes", "notes") || undefined,
      };
    });
}

function normalizeQuoteStatus(s: string): "won" | "lost" | "pending" | "yellow" {
  const lower = s.toLowerCase().trim();
  if (lower === "won" || lower === "accepted") return "won";
  if (lower === "lost" || lower === "declined" || lower === "rejected") return "lost";
  if (lower === "yellow" || lower === "90%" || lower === "90% likely" || lower === "likely") return "yellow";
  return "pending";
}

// ---- CASHFLOW MAPPER ----
// Sheet is TRANSPOSED: months are columns (Feb-26, Mar-26 etc.), rows are metrics.
// First column key is "Fortnight Ending" or similar label column.

const MONTH_PATTERN = /^[A-Za-z]{3}-\d{2}$/; // e.g. "Feb-26", "Mar-26"

function detectMonthColumns(rows: any[]): string[] {
  if (!rows.length) return [];
  const firstRow = rows[0];
  const months = Object.keys(firstRow).filter((k) => MONTH_PATTERN.test(k.trim()));
  return months;
}

function buildRowLookup(rows: any[]): Record<string, any> {
  const lookup: Record<string, any> = {};
  for (const row of rows) {
    // The label is in the first column — find it by checking common key names
    const labelKey = Object.keys(row).find((k) =>
      ["col_1", "Fortnight Ending", "Category", "Item", "Label", "Description"].some(
        (h) => k.toLowerCase() === h.toLowerCase()
      )
    ) || Object.keys(row).filter(k => k !== "row_number")[0] || Object.keys(row)[0];
    
    const label = String(row[labelKey] || "").trim();
    // Skip metadata header rows
    if (!label || label.toUpperCase() === "FORTNIGHT ENDING:" || label.toUpperCase() === "FORTNIGHT ENDING") continue;
    lookup[label.toUpperCase()] = row;
  }
  return lookup;
}

function getMetricValue(lookup: Record<string, any>, monthKey: string, ...labelVariants: string[]): number {
  for (const label of labelVariants) {
    const row = lookup[label.toUpperCase()];
    if (row && row[monthKey] !== undefined) {
      return parseNum(row[monthKey]);
    }
  }
  return 0;
}

function mapCashflow(raw: any[]): CashflowMonth[] {
  // Detect if data is transposed (months as columns)
  const monthCols = detectMonthColumns(raw);

  if (monthCols.length > 0) {
    // TRANSPOSED FORMAT — pivot columns to rows
    const lookup = buildRowLookup(raw);

    return monthCols.map((mk) => {
      const totalIncome = getMetricValue(lookup, mk, "Total Income", "TOTAL INCOME");
      const labour = Math.abs(getMetricValue(lookup, mk, "Labour Costs", "Labour Cost", "LABOUR COSTS", "COS Labour"));
      const tactile = Math.abs(getMetricValue(lookup, mk, "Tactile Costs", "Tactile Cost", "TACTILE COSTS", "COS Tactile"));
      const otherProducts = Math.abs(getMetricValue(lookup, mk, "Other Costs", "Other Products", "OTHER COSTS", "COS Other"));
      const cosTotal = Math.abs(getMetricValue(lookup, mk, "Total Cost of Sales", "TOTAL COST OF SALES", "Total COS")) || (labour + tactile + otherProducts);
      const grossProfit = getMetricValue(lookup, mk, "Gross Profit", "GROSS PROFIT") || (totalIncome - cosTotal);
      const totalEmployment = Math.abs(getMetricValue(lookup, mk, "Total Salaries", "TOTAL SALARIES", "Total Employment", "Total Wages"));
      const totalOperating = Math.abs(getMetricValue(lookup, mk, "Total Operating Expenses", "TOTAL OPERATING EXPENSES", "Total Opex"));
      const totalOutgoings = Math.abs(getMetricValue(lookup, mk, "Total Outgoings", "TOTAL OUTGOINGS")) || (cosTotal + totalEmployment + totalOperating);

      return {
        month: mk,
        openingBalance: getMetricValue(lookup, mk, "Opening Balances", "OPENING BALANCES", "Opening Balance"),
        totalIncome,
        costOfSales: { labour, tactile, otherProducts, total: cosTotal },
        grossProfit,
        employmentExpenses: {},
        totalEmploymentExpenses: totalEmployment,
        operatingExpenses: {},
        totalOperatingExpenses: totalOperating,
        totalOutgoings,
        gstCollected: getMetricValue(lookup, mk, "GST Collected", "GST COLLECTED"),
        gstPaid: getMetricValue(lookup, mk, "GST Paid", "GST PAID"),
        gstOwing: getMetricValue(lookup, mk, "GST Owing", "GST OWING"),
        cashSurplus: getMetricValue(lookup, mk, "Anticipated Cash Surplus/(Deficit)", "ANTICIPATED CASH SURPLUS/(DEFICIT)", "Net Operating Cash from Operations", "Cash Surplus", "Surplus"),
        closingBalance: getMetricValue(lookup, mk, "Closing Balance", "CLOSING BALANCE", "Closing Balances"),
      };
    });
  }

  // FALLBACK: original row-per-month format
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

// ---- REVENUE & COGS MAPPER ----
// Sheet columns: COMPANY | PROJECT | VALUE (INCL. GST) | INVOICE DATE | DUE DATE | LABOUR COST | MONTH | TACTILE COST (GST N/A) | MONTH | OTHER PRODUCTS (INCL GST) | MONTH

function mapRevenue(raw: any[]): RevenueProject[] {
  return raw
    .filter((r) => {
      if (!r || typeof r !== "object") return false;
      if (isSummaryRow(r)) return false;
      const company = flexGet(r, "COMPANY", "Company", "company", "Client");
      return company && String(company).trim() !== "";
    })
    .map((r, i) => {
      const valueInclGST = parseNum(flexGet(r, "VALUE (INCL. GST)", "Value (incl GST)", "Value (Incl. GST)", "valueInclGST", "Value"));
      const valueExclGST = parseNum(flexGet(r, "Value (excl GST)", "valueExclGST")) || (valueInclGST / 1.1);
      const labourCost = parseNum(flexGet(r, "LABOUR COST", "Labour Cost", "labourCost", "Labour"));
      const tactileCost = parseNum(flexGet(r, "TACTILE COST (GST N/A)", "Tactile Cost", "tactileCost", "Tactile"));
      const otherProducts = parseNum(flexGet(r, "OTHER PRODUCTS (INCL GST)", "Other Products", "otherProducts", "Other"));
      const totalCOGS = labourCost + tactileCost + otherProducts;
      const grossProfit = valueExclGST - totalCOGS;

      return {
        id: `R${i}`,
        company: flexGet(r, "COMPANY", "Company", "company", "Client") || "",
        project: flexGet(r, "PROJECT", "Project", "project", "Project Name") || "",
        valueInclGST,
        valueExclGST: Math.round(valueExclGST * 100) / 100,
        invoiceDate: flexGet(r, "INVOICE DATE", "Invoice Date", "invoiceDate", "invoice_date") || "",
        dueDate: flexGet(r, "DUE DATE", "Due Date", "dueDate", "due_date") || "",
        labourCost,
        tactileCost,
        otherProducts,
        totalCOGS,
        grossProfit: Math.round(grossProfit * 100) / 100,
        status: normalizeRevenueStatus(flexGet(r, "Status", "status") || "pending"),
      };
    });
}

function normalizeRevenueStatus(s: string): "invoiced" | "pending" | "overdue" {
  const lower = s.toLowerCase().trim();
  if (lower === "invoiced" || lower === "paid") return "invoiced";
  if (lower === "overdue" || lower === "late") return "overdue";
  return "pending";
}

// ---- EXPENSES MAPPER ----
// Sheet: Main Expenses | # | Payment Date | Weekly Cost | Monthly Cost | Yearly Cost
// Categories are section header rows (e.g. "Essentials") with no cost values

const KNOWN_CATEGORIES = ["ESSENTIALS", "OFFICE & MISC", "OFFICE AND MISC", "SHARED EXPENSES", "EMPLOYEE EXPENSES", "OFFICE", "MISC"];

function isExpenseCategoryHeader(row: any): string | null {
  const name = flexGet(row, "Main Expenses", "Name", "Item", "Expense", "Category") || "";
  const nameStr = String(name).trim();
  if (!nameStr) return null;

  // Check if cost columns are all empty/zero
  const weekly = parseNum(flexGet(row, "Weekly Cost", "Weekly", "weeklyCost"));
  const monthly = parseNum(flexGet(row, "Monthly Cost", "Monthly", "monthlyCost"));
  const yearly = parseNum(flexGet(row, "Yearly Cost", "Yearly", "yearlyCost", "Annual"));

  if (weekly === 0 && monthly === 0 && yearly === 0) {
    // Check against known category names or if it looks like a header (short, no numbers)
    if (KNOWN_CATEGORIES.includes(nameStr.toUpperCase()) || nameStr.length < 25) {
      return nameStr;
    }
  }
  return null;
}

function mapExpenses(raw: any[]): ExpenseCategory[] {
  const categories: ExpenseCategory[] = [];
  let currentCategory = "Uncategorised";
  let currentItems: { name: string; paymentDate?: string; weeklyCost: number; monthlyCost: number; yearlyCost: number }[] = [];

  const flushCategory = () => {
    if (currentItems.length > 0) {
      categories.push({
        category: currentCategory,
        items: [...currentItems],
        totalWeekly: currentItems.reduce((s, i) => s + i.weeklyCost, 0),
        totalMonthly: currentItems.reduce((s, i) => s + i.monthlyCost, 0),
        totalYearly: currentItems.reduce((s, i) => s + i.yearlyCost, 0),
      });
    }
    currentItems = [];
  };

  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    if (isSummaryRow(r)) continue;

    // Check if this is a category header
    const catHeader = isExpenseCategoryHeader(r);
    if (catHeader) {
      flushCategory();
      currentCategory = catHeader;
      continue;
    }

    const name = flexGet(r, "Main Expenses", "Name", "Item", "Expense") || "";
    const nameStr = String(name).trim();
    if (!nameStr) continue;

    const monthly = parseNum(flexGet(r, "Monthly Cost", "Monthly", "monthlyCost"));
    const weekly = parseNum(flexGet(r, "Weekly Cost", "Weekly", "weeklyCost"));
    const yearly = parseNum(flexGet(r, "Yearly Cost", "Yearly", "yearlyCost", "Annual"));

    // Skip rows with no cost data at all
    if (monthly === 0 && weekly === 0 && yearly === 0) continue;

    currentItems.push({
      name: nameStr,
      paymentDate: flexGet(r, "Payment Date", "#", "paymentDate") || undefined,
      weeklyCost: weekly,
      monthlyCost: monthly,
      yearlyCost: yearly,
    });
  }

  flushCategory(); // flush last category
  return categories;
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
