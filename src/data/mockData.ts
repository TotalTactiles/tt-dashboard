// ============================================================
// Data model aligned to actual Google Sheets structure
// Interfaces matching the 4 sheet tabs:
//   1. Quotes   2. Cashflow   3. Expected Revenue   4. Business Expenses
// ============================================================

// ---- QUOTES TAB ----
export interface QuotedJob {
  id: string;
  quoteNumber: string;
  company: string;
  project: string;
  value: number;
  totalPOs: number;
  status: "won" | "lost" | "pending" | "yellow";
  dateQuoted: string;
  notes?: string;
}

export interface QuoteSummary {
  totalQuoted: number;
  totalQuotedCount: number;
  totalWon: number;
  totalWonCount: number;
  totalLost: number;
  totalLostCount: number;
  totalYellow: number;
  totalYellowCount: number;
  quotedRemaining: number;
  quotedRemainingCount: number;
  conversionRate: number;
  grossRevenue: number;
  costOfGoods: number;
  labourCost: number;
  netRevenue: number;
}

// ---- CASHFLOW TAB ----
export interface CashflowMonth {
  month: string;
  openingBalance: number;
  totalIncome: number;
  costOfSales: {
    labour: number;
    tactile: number;
    otherProducts: number;
    total: number;
  };
  grossProfit: number;
  employmentExpenses: {
    [person: string]: number;
  };
  totalEmploymentExpenses: number;
  operatingExpenses: {
    [item: string]: number;
  };
  totalOperatingExpenses: number;
  totalOutgoings: number;
  gstCollected: number;
  gstPaid: number;
  gstOwing: number;
  cashSurplus: number;
  closingBalance: number;
}

// ---- EXPECTED REVENUE / REVENUE & COGS TAB ----
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
  otherProducts: number;
  totalCOGS: number;
  grossProfit: number;
  status: "invoiced" | "pending" | "overdue";
}

// ---- BUSINESS EXPENSES TAB ----
export interface ExpenseItem {
  name: string;
  paymentDate?: string;
  weeklyCost: number;
  monthlyCost: number;
  yearlyCost: number;
}

export interface ExpenseCategory {
  category: string;
  items: ExpenseItem[];
  totalWeekly: number;
  totalMonthly: number;
  totalYearly: number;
}

// ============================================================
// n8n Data Sources — used by Settings page
// ============================================================
export const n8nDataSources = [
  {
    id: "google_sheets",
    name: "Google Sheets",
    description: "Quotes, Cashflow, Revenue & COGS, Business Expenses",
    icon: "📊",
    connected: false,
    dataMapping: [
      "Quotes tab → KPI Stats + Quoted Jobs table",
      "Cashflow tab → Income vs Outgoings chart + Cash Surplus chart",
      "Revenue & COGS tab → Revenue Projects table",
      "Business Expenses tab → Expense Breakdown + Pie chart",
    ],
  },
  {
    id: "zoho_crm",
    name: "Zoho CRM",
    description: "Deals pipeline, contacts, sales activities & forecasting",
    icon: "💼",
    connected: false,
    dataMapping: [
      "Active deals & pipeline stages",
      "Client contacts & communication logs",
      "Sales forecasts & win rates",
      "Revenue attribution by source",
    ],
  },
  {
    id: "zoho_projects",
    name: "Zoho Projects",
    description: "Project timelines, milestones, task tracking & resource allocation",
    icon: "📋",
    connected: false,
    dataMapping: [
      "Project status & milestones",
      "Task completion & burndown",
      "Resource utilisation rates",
      "Deadline tracking & alerts",
    ],
  },
];
