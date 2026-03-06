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
  // Try exact substring match first
  const exact = Object.keys(obj).find((k) => k.toUpperCase().includes(substring.toUpperCase()));
  if (exact) return exact;
  // Fallback aliases for common column names
  const ALIASES: Record<string, string[]> = {
    "QUOTED": ["Total Value", "Value", "Amount", "QUOTED_VALUE", "Quote Value"],
  };
  const aliasKeys = ALIASES[substring.toUpperCase()] || [];
  for (const alias of aliasKeys) {
    const match = Object.keys(obj).find((k) => k.toLowerCase() === alias.toLowerCase());
    if (match) return match;
  }
  return undefined;
}

function isSummaryRow(row: any): boolean {
  // Prefer n8n pre-computed label
  if (row?._label_isSummaryRow === true) return true;
  const values = Object.values(row).map((v) => String(v).toUpperCase().trim());
  return values.some((v) => v === "TOTAL" || v === "SUB TOTAL" || v.startsWith("TOTAL ") || v.startsWith("SUB TOTAL"));
}

function mapQuotes(raw: any[]): QuotedJob[] {
  return raw
    .filter((r) => {
      if (!r || typeof r !== "object") return false;
      if (r._label_isSummaryRow === true) return false;
      if (r._label_isHeader === true) return false;
      if (isSummaryRow(r)) return false;
      // Use _label_ field if available; also check _company (n8n convention)
      const company = r._label_company ?? r._company ?? flexGet(r, "Company Name", "company", "Company", "Client");
      return company && String(company).trim() !== "";
    })
    .map((r, i) => {
      // Prefer n8n pre-computed values
      const hasLabels = r._label_dollarValue !== undefined;
      const value = hasLabels ? r._label_dollarValue : (() => {
        const valueKey = findKeyContaining(r, "QUOTED");
        return valueKey ? parseNum(r[valueKey]) : parseNum(flexGet(r, "value", "Value", "Amount"));
      })();

      return {
        id: `Q${i}`,
        quoteNumber: `Q-${String(i + 1).padStart(3, "0")}`,
        company: (r._label_company ?? flexGet(r, "Company Name", "company", "Company", "Client")) || "",
        project: (r._label_project ?? flexGet(r, "Project Name", "project", "Project", "Description")) || "",
        value,
        totalPOs: hasLabels ? (r._label_countValue || 0) : parseNum(flexGet(r, "Total POs", "totalPOs", "POs", "total_pos")),
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
    // Prefer n8n pre-computed label
    let label = "";
    if (row._label_rowLabel) {
      label = row._label_rowLabel;
    } else {
      const labelKey = Object.keys(row).find((k) =>
        ["col_1", "Fortnight Ending", "Category", "Item", "Label", "Description"].some(
          (h) => k.toLowerCase() === h.toLowerCase()
        )
      ) || Object.keys(row).filter(k => k !== "row_number" && !k.startsWith("_label_"))[0] || Object.keys(row)[0];
      label = String(row[labelKey] || "").trim();
    }
    if (!label || label.toUpperCase() === "FORTNIGHT ENDING:" || label.toUpperCase() === "FORTNIGHT ENDING") continue;
    const key = label.toUpperCase();
    // When duplicate labels exist, prefer the row with the higher row_number (final total)
    if (lookup[key] && row.row_number !== undefined) {
      const existingRowNum = lookup[key].row_number ?? 0;
      if (row.row_number > existingRowNum) {
        lookup[key] = row;
      }
    } else {
      lookup[key] = row;
    }
  }
  return lookup;
}

function getMetricValue(lookup: Record<string, any>, monthKey: string, ...labelVariants: string[]): number {
  for (const label of labelVariants) {
    const row = lookup[label.toUpperCase()];
    if (!row) continue;
    // Prefer n8n pre-parsed _label_monthData
    if (row._label_monthData && row._label_monthData[monthKey] !== undefined) {
      return typeof row._label_monthData[monthKey] === "number" ? row._label_monthData[monthKey] : parseNum(row._label_monthData[monthKey]);
    }
    if (row[monthKey] !== undefined) {
      return parseNum(row[monthKey]);
    }
  }
  return 0;
}

function getMetricValueFuzzy(lookup: Record<string, any>, monthKey: string, partialKeys: string[], ...labelVariants: string[]): number {
  // Try exact match first
  const exact = getMetricValue(lookup, monthKey, ...labelVariants);
  if (exact !== 0) return exact;
  // Fuzzy: find a key containing ALL partial strings (uppercase)
  const upperPartials = partialKeys.map(p => p.toUpperCase());
  const matchKey = Object.keys(lookup).find(k => upperPartials.every(p => k.includes(p)));
  if (matchKey && lookup[matchKey][monthKey] !== undefined) {
    return parseNum(lookup[matchKey][monthKey]);
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
      // Skip headers and totals
      if (r._label_isHeader === true) return false;
      if (r._label_isTotalRow === true) return false;
      if (r._label_isTotal === true) return false;
      // Prefer _label_isLineItem if present
      if (r._label_isLineItem !== undefined) return r._label_isLineItem === true;
      if (isSummaryRow(r)) return false;
      const company = r._label_company ?? flexGet(r, "COMPANY", "Company", "company", "Client");
      return company && String(company).trim() !== "";
    })
    .map((r, i) => {
      const hasLabels = r._label_value !== undefined;

      const valueInclGST = hasLabels ? r._label_value : parseNum(flexGet(r, "VALUE (INCL. GST)", "Value (incl GST)", "Value (Incl. GST)", "valueInclGST", "Value"));
      const valueExclGST = parseNum(flexGet(r, "Value (excl GST)", "valueExclGST")) || (valueInclGST / 1.1);
      const labourCost = hasLabels ? r._label_labourCost : parseNum(flexGet(r, "LABOUR COST", "Labour Cost", "labourCost", "Labour"));
      const tactileCost = hasLabels ? r._label_tactileCost : parseNum(flexGet(r, "TACTILE COST (GST N/A)", "Tactile Cost", "tactileCost", "Tactile"));
      const otherProducts = hasLabels ? r._label_otherCost : parseNum(flexGet(r, "OTHER PRODUCTS (INCL GST)", "Other Products", "otherProducts", "Other"));
      const totalCOGS = hasLabels ? r._label_totalCost : (labourCost + tactileCost + otherProducts);
      const grossProfit = valueExclGST - totalCOGS;

      return {
        id: `R${i}`,
        company: (r._label_company ?? flexGet(r, "COMPANY", "Company", "company", "Client")) || "",
        project: (r._label_project ?? flexGet(r, "PROJECT", "Project", "project", "Project Name")) || "",
        valueInclGST,
        valueExclGST: Math.round(valueExclGST * 100) / 100,
        invoiceDate: (r._label_invoiceDate ?? flexGet(r, "INVOICE DATE", "Invoice Date", "invoiceDate", "invoice_date")) || "",
        dueDate: (r._label_dueDate ?? flexGet(r, "DUE DATE", "Due Date", "dueDate", "due_date")) || "",
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
  // Check if data has n8n _label_* fields
  const hasLabels = raw.length > 0 && raw[0]._label_name !== undefined;

  if (hasLabels) {
    // Use pre-computed labels — group by _label_category
    const categoryMap: Record<string, { name: string; paymentDate?: string; weeklyCost: number; monthlyCost: number; yearlyCost: number }[]> = {};
    for (const r of raw) {
      if (!r._label_isLineItem) continue;
      const cat = r._label_category || "Uncategorised";
      if (!categoryMap[cat]) categoryMap[cat] = [];
      categoryMap[cat].push({
        name: r._label_name,
        weeklyCost: r._label_weeklyCost || 0,
        monthlyCost: r._label_monthlyCost || 0,
        yearlyCost: r._label_yearlyCost || 0,
      });
    }
    return Object.entries(categoryMap).map(([category, items]) => ({
      category,
      items,
      totalWeekly: items.reduce((s, i) => s + i.weeklyCost, 0),
      totalMonthly: items.reduce((s, i) => s + i.monthlyCost, 0),
      totalYearly: items.reduce((s, i) => s + i.yearlyCost, 0),
    }));
  }

  // Fallback: original parsing logic
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

    if (monthly === 0 && weekly === 0 && yearly === 0) continue;

    currentItems.push({
      name: nameStr,
      paymentDate: flexGet(r, "Payment Date", "#", "paymentDate") || undefined,
      weeklyCost: weekly,
      monthlyCost: monthly,
      yearlyCost: yearly,
    });
  }

  flushCategory();
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

export interface ForecastChartPoint {
  month: string;
  totalOutgoings: number;
  anticipatedSurplus: number;
  costProbableJobs: number;
  probableJobs: number;
  surplusIncludingProbable: number;
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
  forecastChartData: ForecastChartPoint[];
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

// ---- Extract summary totals from raw quote rows before filtering ----
function extractQuoteSummaryFromRaw(raw: any[]): Partial<QuoteSummary> | null {
  if (!raw || !raw.length) return null;
  const result: Partial<QuoteSummary> = {};
  let found = false;

  for (const row of raw) {
    if (!row || typeof row !== "object") continue;

    // ---- Prefer n8n pre-computed _label_ booleans ----
    if (row._label_isTotalQuoted === true) {
      result.totalQuoted = row._label_dollarValue ?? 0;
      result.totalQuotedCount = row._label_countValue ?? 0;
      found = true;
      continue;
    }
    if (row._label_isTotalWon === true) {
      result.totalWon = row._label_dollarValue ?? 0;
      result.totalWonCount = row._label_countValue ?? 0;
      found = true;
      continue;
    }
    if (row._label_isTotalLost === true) {
      result.totalLost = row._label_dollarValue ?? 0;
      result.totalLostCount = row._label_countValue ?? 0;
      found = true;
      continue;
    }
    if (row._label_isTotalYellow === true) {
      result.totalYellow = row._label_dollarValue ?? 0;
      result.totalYellowCount = row._label_countValue ?? 0;
      found = true;
      continue;
    }
    if (row._label_isQuotedRemaining === true) {
      result.quotedRemaining = row._label_dollarValue ?? 0;
      result.quotedRemainingCount = row._label_countValue ?? 0;
      found = true;
      continue;
    }

    // ---- Fallback: string-scan for non-labelled payloads ----
    const values = Object.values(row).map((v) => String(v).toUpperCase().trim());
    const valueKey = findKeyContaining(row, "QUOTED");
    
    const countKeyDirect = Object.keys(row).find((k) => k.toUpperCase().includes("QUOTED_COUNT") || k.toUpperCase() === "COUNT" || k.toUpperCase() === "JOBS" || k.toUpperCase() === "QTY");
    
    const allKeys = Object.keys(row);
    const countKey = countKeyDirect || allKeys.find((k) => {
      if (k === valueKey) return false;
      const val = row[k];
      const str = String(val).toUpperCase().trim();
      if (values.includes(str)) return false;
      const num = parseNum(val);
      return num > 0 && num < 1000;
    });

    for (const v of values) {
      const normalized = v.replace(/\s+/g, " ").trim();
      if (normalized === "TOTAL QUOTED" || normalized === "TOTAL QUOTED JOBS" || normalized === "TOTAL QUOTES") {
        result.totalQuoted = valueKey ? parseNum(row[valueKey]) : 0;
        result.totalQuotedCount = countKey ? parseNum(row[countKey]) : 0;
        found = true;
      } else if (normalized === "TOTAL QUOTED WON" || normalized === "TOTAL WON" || normalized === "WON" || normalized === "TOTAL ACCEPTED") {
        result.totalWon = valueKey ? parseNum(row[valueKey]) : 0;
        result.totalWonCount = countKey ? parseNum(row[countKey]) : 0;
        found = true;
      } else if (normalized === "TOTAL QUOTED LOST" || normalized === "TOTAL LOST" || normalized === "LOST" || normalized === "TOTAL DECLINED") {
        result.totalLost = valueKey ? parseNum(row[valueKey]) : 0;
        result.totalLostCount = countKey ? parseNum(row[countKey]) : 0;
        found = true;
      } else if (normalized === "TOTAL YELLOW" || normalized === "YELLOW TOTAL" || normalized === "90% LIKELY" || normalized === "TOTAL 90% LIKELY") {
        result.totalYellow = valueKey ? parseNum(row[valueKey]) : 0;
        result.totalYellowCount = countKey ? parseNum(row[countKey]) : 0;
        found = true;
      } else if (normalized === "QUOTED REMAINING" || normalized === "REMAINING" || normalized === "TOTAL REMAINING" || normalized === "OUTSTANDING") {
        result.quotedRemaining = valueKey ? parseNum(row[valueKey]) : 0;
        result.quotedRemainingCount = countKey ? parseNum(row[countKey]) : 0;
        found = true;
      }
    }
  }

  return found ? result : null;
}

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

    // ---- Extract quote summary from raw rows (before isSummaryRow filtering) ----
    const extractedQuoteSummary = extractQuoteSummaryFromRaw(liveData.quotes || []);

    // Quote summary: prefer extracted sheet totals, fallback to row calculations
    const quoteSummary: QuoteSummary | null = (quotedJobs.length || extractedQuoteSummary)
      ? (() => {
          // Fallback: calculate from individual rows
          const calcTotalQuoted = quotedJobs.reduce((s, q) => s + q.value, 0);
          const calcTotalWon = quotedJobs.filter((q) => q.status === "won").reduce((s, q) => s + q.value, 0);
          const calcTotalLost = quotedJobs.filter((q) => q.status === "lost").reduce((s, q) => s + q.value, 0);
          const calcTotalYellow = quotedJobs.filter((q) => q.status === "yellow").reduce((s, q) => s + q.value, 0);

          // Use extracted values if available, otherwise fallback
          const totalQuoted = extractedQuoteSummary?.totalQuoted ?? calcTotalQuoted;
          const totalWon = extractedQuoteSummary?.totalWon ?? calcTotalWon;
          const totalLost = extractedQuoteSummary?.totalLost ?? calcTotalLost;
          const totalYellow = extractedQuoteSummary?.totalYellow ?? calcTotalYellow;
          const quotedRemaining = extractedQuoteSummary?.quotedRemaining ?? (totalQuoted - totalWon - totalLost);

          // Counts
          const totalQuotedCount = extractedQuoteSummary?.totalQuotedCount ?? quotedJobs.length;
          const totalWonCount = extractedQuoteSummary?.totalWonCount ?? quotedJobs.filter((q) => q.status === "won").length;
          const totalLostCount = extractedQuoteSummary?.totalLostCount ?? quotedJobs.filter((q) => q.status === "lost").length;
          const totalYellowCount = extractedQuoteSummary?.totalYellowCount ?? quotedJobs.filter((q) => q.status === "yellow").length;
          const quotedRemainingCount = extractedQuoteSummary?.quotedRemainingCount ?? (totalQuotedCount - totalWonCount - totalLostCount);

          // Conversion rate: count-based from rows
          const conversionRate = totalQuotedCount > 0 ? Math.round(((totalWonCount / totalQuotedCount) * 100) * 10) / 10 : 0;

          const totalCOGS = revenueProjects.reduce((s, p) => s + p.totalCOGS, 0);
          const labourCost = revenueProjects.reduce((s, p) => s + p.labourCost, 0);

          return {
            totalQuoted,
            totalQuotedCount,
            totalWon,
            totalWonCount,
            totalLost,
            totalLostCount,
            totalYellow,
            totalYellowCount,
            quotedRemaining,
            quotedRemainingCount,
            conversionRate,
            grossRevenue: totalWon,
            costOfGoods: totalCOGS,
            labourCost,
            netRevenue: totalWon - totalCOGS,
          };
        })()
      : null;

    // ---- Net Revenue & Cashflow Position from Cashflow tab ----
    const populatedMonths = cashflowMonths.filter(
      (m) => m.totalIncome !== 0 || m.totalOutgoings !== 0 || m.closingBalance !== 0 || m.openingBalance !== 0
    );
    const netRevenueCashflow = populatedMonths.reduce((s, m) => s + m.totalIncome - m.costOfSales.total, 0);
    const cashflowPosition = populatedMonths.length
      ? populatedMonths[populatedMonths.length - 1].closingBalance
      : 0;

    // Cashflow chart data — only months with at least one non-zero value
    const cashflowChartData: CashflowChartPoint[] = populatedMonths.map((m) => ({
      month: m.month,
      income: m.totalIncome,
      outgoings: m.totalOutgoings,
      surplus: m.cashSurplus,
      openingBalance: m.openingBalance,
      closingBalance: m.closingBalance,
    }));

    // Profit margin data
    const profitMarginData: ProfitMarginPoint[] = populatedMonths.map((m) => ({
      month: m.month,
      grossMargin: m.totalIncome > 0 ? Math.round((m.grossProfit / m.totalIncome) * 100) : 0,
      cashSurplus: m.cashSurplus,
    }));

    // Forecast chart data — extract 5 series from cashflow lookup across ALL months
    const forecastChartData: ForecastChartPoint[] = (() => {
      const monthCols = liveData.cashflow?.length ? detectMonthColumns(liveData.cashflow) : [];
      if (monthCols.length === 0) return [];
      const lookup = buildRowLookup(liveData.cashflow || []);
      console.log("[Forecast] Cashflow lookup keys:", Object.keys(lookup));
      return monthCols.map((mk) => ({
        month: mk,
        totalOutgoings: Math.abs(getMetricValue(lookup, mk, "Total Outgoings", "TOTAL OUTGOINGS", "Total outgoings")),
        anticipatedSurplus: getMetricValue(lookup, mk, "Anticipated Cash Surplus/(Deficit)", "ANTICIPATED CASH SURPLUS/(DEFICIT)", "Anticipated Cash Surplus / (Deficit)", "Anticipated Cash Surplus/(deficit)", "Anticipated Cash Surplus/ (Deficit)"),
        costProbableJobs: Math.abs(getMetricValue(lookup, mk, "Cost of Jobs Probable To Be Won", "COST OF JOBS PROBABLE TO BE WON", "Cost Of Jobs Probable To Be Won", "Cost of jobs probable to be won")),
        probableJobs: getMetricValue(lookup, mk, "Jobs Probable To Be Won", "JOBS PROBABLE TO BE WON", "Jobs probable to be won", "Revenue From Jobs Probable To Be Won", "REVENUE FROM JOBS PROBABLE TO BE WON", "Probable Jobs", "PROBABLE JOBS", "Revenue from Probable Jobs"),
        surplusIncludingProbable: (() => {
          const val = getMetricValueFuzzy(lookup, mk, ["SURPLUS", "PROBABLE"], "Anticipated Cash Surplus/(Deficit) Including Probable Jobs", "ANTICIPATED CASH SURPLUS/(DEFICIT) INCLUDING PROBABLE JOBS", "Anticipated Cash Surplus / (Deficit) Including Probable Jobs", "Anticipated Cash Surplus/(deficit) Including Probable Jobs", "Anticipated Cash Surplus/(Deficit) including Probable Jobs");
          if (val !== 0) return val;
          // Computed fallback: surplus + probable revenue - probable cost
          const s = getMetricValue(lookup, mk, "Anticipated Cash Surplus/(Deficit)", "ANTICIPATED CASH SURPLUS/(DEFICIT)", "Anticipated Cash Surplus / (Deficit)", "Anticipated Cash Surplus/(deficit)", "Anticipated Cash Surplus/ (Deficit)");
          const p = getMetricValue(lookup, mk, "Jobs Probable To Be Won", "JOBS PROBABLE TO BE WON", "Revenue From Jobs Probable To Be Won", "REVENUE FROM JOBS PROBABLE TO BE WON", "Probable Jobs", "PROBABLE JOBS");
          const c = Math.abs(getMetricValue(lookup, mk, "Cost of Jobs Probable To Be Won", "COST OF JOBS PROBABLE TO BE WON"));
          return (s !== 0 || p !== 0 || c !== 0) ? s + p - c : 0;
        })(),
      }));
    })();

    // Expense allocation
    const expenseAllocation: ExpenseAllocationItem[] = expenseCategories.map((cat, i) => ({
      name: cat.category,
      value: cat.totalMonthly,
      fill: FILLS[i % FILLS.length],
    }));

    // KPI variables for formula engine
    const monthlyExpenses = expenseCategories.reduce((s, c) => s + c.totalMonthly, 0);
    const kpiVariables: Record<string, number> = {
      TotalQuoted: quoteSummary?.totalQuoted || 0,
      TotalQuotedCount: quoteSummary?.totalQuotedCount || 0,
      TotalWon: quoteSummary?.totalWon || 0,
      TotalWonCount: quoteSummary?.totalWonCount || 0,
      TotalLost: quoteSummary?.totalLost || 0,
      TotalLostCount: quoteSummary?.totalLostCount || 0,
      TotalYellow: quoteSummary?.totalYellow || 0,
      TotalYellowCount: quoteSummary?.totalYellowCount || 0,
      QuotedRemaining: quoteSummary?.quotedRemaining || 0,
      QuotedRemainingCount: quoteSummary?.quotedRemainingCount || 0,
      GrossRevenue: quoteSummary?.grossRevenue || 0,
      CostOfGoods: quoteSummary?.costOfGoods || 0,
      LabourCost: quoteSummary?.labourCost || 0,
      NetRevenue: netRevenueCashflow,
      ConversionRate: quoteSummary?.conversionRate || 0,
      CashPosition: cashflowPosition,
      MonthlyExpenses: monthlyExpenses,
    };

    // KPI stat cards
    const fmt = (n: number) => {
      if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}K`;
      return `$${n.toLocaleString()}`;
    };

    const noData = !hasLiveData;
    const kpiStats: KPIStat[] = [
      { label: "Total Quoted", value: noData ? "--" : fmt(kpiVariables.TotalQuoted), change: noData ? "--" : `${kpiVariables.TotalQuotedCount} jobs`, positive: true, noData },
      { label: "Total Won", value: noData ? "--" : fmt(kpiVariables.TotalWon), change: noData ? "--" : `${kpiVariables.TotalWonCount} jobs`, positive: true, noData },
      { label: "Quoted Remaining", value: noData ? "--" : fmt(kpiVariables.QuotedRemaining), change: noData ? "--" : `${kpiVariables.QuotedRemainingCount} jobs`, positive: kpiVariables.QuotedRemaining >= 0, noData },
      { label: "Net Revenue", value: noData ? "--" : fmt(kpiVariables.NetRevenue), change: "--", positive: kpiVariables.NetRevenue >= 0, noData },
      { label: "Cashflow Position", value: noData ? "--" : fmt(kpiVariables.CashPosition), change: "--", positive: kpiVariables.CashPosition >= 0, noData },
      { label: "Conversion Rate", value: noData ? "--" : `${kpiVariables.ConversionRate}%`, change: noData ? "--" : `${kpiVariables.TotalWonCount}/${kpiVariables.TotalQuotedCount}`, positive: kpiVariables.ConversionRate >= 20, noData },
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
      forecastChartData,
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
