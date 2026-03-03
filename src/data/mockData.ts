// ============================================================
// Data model aligned to actual Google Sheets structure
// Interfaces + realistic mock data matching the 4 sheet tabs:
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
  status: "won" | "lost" | "pending" | "yellow"; // yellow = 90% likely
  dateQuoted: string;
  notes?: string;
}

export interface QuoteSummary {
  totalQuoted: number;
  totalWon: number;
  totalLost: number;
  quotedRemaining: number;
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
// MOCK DATA — Quotes
// ============================================================
export const quotedJobs: QuotedJob[] = [
  { id: "Q001", quoteNumber: "QT-2025-001", company: "Apex Construction", project: "Office Fitout Level 3", value: 42500, totalPOs: 2, status: "won", dateQuoted: "2025-01-12" },
  { id: "Q002", quoteNumber: "QT-2025-002", company: "Metro Developments", project: "Residential Complex Signage", value: 18700, totalPOs: 1, status: "won", dateQuoted: "2025-01-18" },
  { id: "Q003", quoteNumber: "QT-2025-003", company: "Greenfield Corp", project: "Warehouse Wayfinding System", value: 31200, totalPOs: 0, status: "pending", dateQuoted: "2025-02-03" },
  { id: "Q004", quoteNumber: "QT-2025-004", company: "Summit Hotels", project: "Hotel Lobby Feature Wall", value: 67800, totalPOs: 3, status: "yellow", dateQuoted: "2025-02-10" },
  { id: "Q005", quoteNumber: "QT-2025-005", company: "Coastal Living", project: "Display Suite Graphics", value: 12400, totalPOs: 0, status: "lost", dateQuoted: "2025-02-14" },
  { id: "Q006", quoteNumber: "QT-2025-006", company: "TechPark Industries", project: "Corporate Branding Package", value: 28900, totalPOs: 1, status: "won", dateQuoted: "2025-02-22" },
  { id: "Q007", quoteNumber: "QT-2025-007", company: "Riverstone Retail", project: "Shopping Centre Directory", value: 54300, totalPOs: 0, status: "pending", dateQuoted: "2025-03-01" },
  { id: "Q008", quoteNumber: "QT-2025-008", company: "BlueWave Logistics", project: "Fleet Vehicle Wraps", value: 19600, totalPOs: 2, status: "won", dateQuoted: "2025-03-05" },
  { id: "Q009", quoteNumber: "QT-2025-009", company: "Harbour Point", project: "External Building Signage", value: 85000, totalPOs: 0, status: "yellow", dateQuoted: "2025-03-12" },
  { id: "Q010", quoteNumber: "QT-2025-010", company: "Central Health", project: "Hospital Wayfinding Phase 2", value: 39500, totalPOs: 0, status: "pending", dateQuoted: "2025-03-18" },
];

export const quoteSummary: QuoteSummary = {
  totalQuoted: 399900,
  totalWon: 109700,
  totalLost: 12400,
  quotedRemaining: 277800,
  conversionRate: 27.4,
  grossRevenue: 109700,
  costOfGoods: 43880,
  labourCost: 27425,
  netRevenue: 38395,
};

// ============================================================
// MOCK DATA — Cashflow (monthly)
// ============================================================
export const cashflowMonthly: CashflowMonth[] = [
  {
    month: "Jul",
    openingBalance: 45000,
    totalIncome: 62000,
    costOfSales: { labour: 12000, tactile: 8500, otherProducts: 3200, total: 23700 },
    grossProfit: 38300,
    employmentExpenses: { "Director 1": 8000, "Director 2": 8000, "Employee 1": 5200, "Employee 2": 4800 },
    totalEmploymentExpenses: 26000,
    operatingExpenses: { Rent: 3200, Insurance: 800, "Software & Subs": 1200, Utilities: 600, Vehicle: 1400, Marketing: 500 },
    totalOperatingExpenses: 7700,
    totalOutgoings: 57400,
    gstCollected: 6200, gstPaid: 3600, gstOwing: 2600,
    cashSurplus: 4600,
    closingBalance: 49600,
  },
  {
    month: "Aug",
    openingBalance: 49600,
    totalIncome: 58000,
    costOfSales: { labour: 11000, tactile: 7800, otherProducts: 2900, total: 21700 },
    grossProfit: 36300,
    employmentExpenses: { "Director 1": 8000, "Director 2": 8000, "Employee 1": 5200, "Employee 2": 4800 },
    totalEmploymentExpenses: 26000,
    operatingExpenses: { Rent: 3200, Insurance: 800, "Software & Subs": 1200, Utilities: 550, Vehicle: 1400, Marketing: 700 },
    totalOperatingExpenses: 7850,
    totalOutgoings: 55550,
    gstCollected: 5800, gstPaid: 3400, gstOwing: 2400,
    cashSurplus: 2450,
    closingBalance: 52050,
  },
  {
    month: "Sep",
    openingBalance: 52050,
    totalIncome: 71000,
    costOfSales: { labour: 14500, tactile: 9200, otherProducts: 4100, total: 27800 },
    grossProfit: 43200,
    employmentExpenses: { "Director 1": 8000, "Director 2": 8000, "Employee 1": 5200, "Employee 2": 4800 },
    totalEmploymentExpenses: 26000,
    operatingExpenses: { Rent: 3200, Insurance: 800, "Software & Subs": 1200, Utilities: 620, Vehicle: 1400, Marketing: 450 },
    totalOperatingExpenses: 7670,
    totalOutgoings: 61470,
    gstCollected: 7100, gstPaid: 4100, gstOwing: 3000,
    cashSurplus: 9530,
    closingBalance: 61580,
  },
  {
    month: "Oct",
    openingBalance: 61580,
    totalIncome: 55000,
    costOfSales: { labour: 10500, tactile: 7200, otherProducts: 2600, total: 20300 },
    grossProfit: 34700,
    employmentExpenses: { "Director 1": 8000, "Director 2": 8000, "Employee 1": 5200, "Employee 2": 4800 },
    totalEmploymentExpenses: 26000,
    operatingExpenses: { Rent: 3200, Insurance: 800, "Software & Subs": 1200, Utilities: 580, Vehicle: 1400, Marketing: 600 },
    totalOperatingExpenses: 7780,
    totalOutgoings: 54080,
    gstCollected: 5500, gstPaid: 3200, gstOwing: 2300,
    cashSurplus: 920,
    closingBalance: 62500,
  },
  {
    month: "Nov",
    openingBalance: 62500,
    totalIncome: 78000,
    costOfSales: { labour: 16000, tactile: 10500, otherProducts: 4800, total: 31300 },
    grossProfit: 46700,
    employmentExpenses: { "Director 1": 8000, "Director 2": 8000, "Employee 1": 5200, "Employee 2": 4800 },
    totalEmploymentExpenses: 26000,
    operatingExpenses: { Rent: 3200, Insurance: 800, "Software & Subs": 1200, Utilities: 640, Vehicle: 1400, Marketing: 800 },
    totalOperatingExpenses: 8040,
    totalOutgoings: 65340,
    gstCollected: 7800, gstPaid: 4500, gstOwing: 3300,
    cashSurplus: 12660,
    closingBalance: 75160,
  },
  {
    month: "Dec",
    openingBalance: 75160,
    totalIncome: 48000,
    costOfSales: { labour: 9000, tactile: 6200, otherProducts: 2100, total: 17300 },
    grossProfit: 30700,
    employmentExpenses: { "Director 1": 8000, "Director 2": 8000, "Employee 1": 5200, "Employee 2": 4800 },
    totalEmploymentExpenses: 26000,
    operatingExpenses: { Rent: 3200, Insurance: 800, "Software & Subs": 1200, Utilities: 500, Vehicle: 1400, Marketing: 300 },
    totalOperatingExpenses: 7400,
    totalOutgoings: 50700,
    gstCollected: 4800, gstPaid: 2800, gstOwing: 2000,
    cashSurplus: -2700,
    closingBalance: 72460,
  },
  {
    month: "Jan",
    openingBalance: 72460,
    totalIncome: 43000,
    costOfSales: { labour: 8200, tactile: 5500, otherProducts: 1800, total: 15500 },
    grossProfit: 27500,
    employmentExpenses: { "Director 1": 8000, "Director 2": 8000, "Employee 1": 5200, "Employee 2": 4800 },
    totalEmploymentExpenses: 26000,
    operatingExpenses: { Rent: 3200, Insurance: 800, "Software & Subs": 1200, Utilities: 520, Vehicle: 1400, Marketing: 400 },
    totalOperatingExpenses: 7520,
    totalOutgoings: 49020,
    gstCollected: 4300, gstPaid: 2500, gstOwing: 1800,
    cashSurplus: -6020,
    closingBalance: 66440,
  },
  {
    month: "Feb",
    openingBalance: 66440,
    totalIncome: 69000,
    costOfSales: { labour: 13500, tactile: 9000, otherProducts: 3600, total: 26100 },
    grossProfit: 42900,
    employmentExpenses: { "Director 1": 8000, "Director 2": 8000, "Employee 1": 5200, "Employee 2": 4800 },
    totalEmploymentExpenses: 26000,
    operatingExpenses: { Rent: 3200, Insurance: 800, "Software & Subs": 1200, Utilities: 590, Vehicle: 1400, Marketing: 650 },
    totalOperatingExpenses: 7840,
    totalOutgoings: 59940,
    gstCollected: 6900, gstPaid: 3900, gstOwing: 3000,
    cashSurplus: 9060,
    closingBalance: 75500,
  },
];

// Chart-friendly cashflow data derived from monthly
export const cashflowChartData = cashflowMonthly.map((m) => ({
  month: m.month,
  income: m.totalIncome,
  outgoings: m.totalOutgoings,
  surplus: m.cashSurplus,
  openingBalance: m.openingBalance,
  closingBalance: m.closingBalance,
}));

// Gross profit margin trend
export const profitMarginData = cashflowMonthly.map((m) => ({
  month: m.month,
  grossMargin: Math.round((m.grossProfit / m.totalIncome) * 100),
  cashSurplus: m.cashSurplus,
}));

// ============================================================
// MOCK DATA — Expected Revenue / Revenue & COGS
// ============================================================
export const revenueProjects: RevenueProject[] = [
  { id: "R001", company: "Apex Construction", project: "Office Fitout Level 3", valueInclGST: 46750, valueExclGST: 42500, invoiceDate: "2025-02-15", dueDate: "2025-03-15", labourCost: 10600, tactileCost: 7500, otherProducts: 2800, totalCOGS: 20900, grossProfit: 21600, status: "invoiced" },
  { id: "R002", company: "Metro Developments", project: "Residential Complex Signage", valueInclGST: 20570, valueExclGST: 18700, invoiceDate: "2025-02-28", dueDate: "2025-03-28", labourCost: 4700, tactileCost: 3200, otherProducts: 1100, totalCOGS: 9000, grossProfit: 9700, status: "invoiced" },
  { id: "R003", company: "TechPark Industries", project: "Corporate Branding Package", valueInclGST: 31790, valueExclGST: 28900, invoiceDate: "2025-03-10", dueDate: "2025-04-10", labourCost: 7200, tactileCost: 5100, otherProducts: 1900, totalCOGS: 14200, grossProfit: 14700, status: "pending" },
  { id: "R004", company: "BlueWave Logistics", project: "Fleet Vehicle Wraps", valueInclGST: 21560, valueExclGST: 19600, invoiceDate: "2025-03-20", dueDate: "2025-04-20", labourCost: 5800, tactileCost: 4200, otherProducts: 800, totalCOGS: 10800, grossProfit: 8800, status: "pending" },
  { id: "R005", company: "Summit Hotels", project: "Hotel Lobby Feature Wall", valueInclGST: 74580, valueExclGST: 67800, invoiceDate: "2025-01-20", dueDate: "2025-02-20", labourCost: 16900, tactileCost: 12000, otherProducts: 4500, totalCOGS: 33400, grossProfit: 34400, status: "overdue" },
];

// ============================================================
// MOCK DATA — Business Expenses
// ============================================================
export const expenseCategories: ExpenseCategory[] = [
  {
    category: "Essentials",
    items: [
      { name: "Rent / Lease", paymentDate: "1st", weeklyCost: 800, monthlyCost: 3200, yearlyCost: 38400 },
      { name: "Insurance (Public Liability)", paymentDate: "Monthly", weeklyCost: 200, monthlyCost: 800, yearlyCost: 9600 },
      { name: "Utilities (Power/Water)", paymentDate: "Monthly", weeklyCost: 150, monthlyCost: 600, yearlyCost: 7200 },
    ],
    totalWeekly: 1150, totalMonthly: 4600, totalYearly: 55200,
  },
  {
    category: "Office & Misc",
    items: [
      { name: "Software & Subscriptions", paymentDate: "Monthly", weeklyCost: 300, monthlyCost: 1200, yearlyCost: 14400 },
      { name: "Office Supplies", paymentDate: "Weekly", weeklyCost: 75, monthlyCost: 300, yearlyCost: 3600 },
      { name: "Phone / Internet", paymentDate: "Monthly", weeklyCost: 100, monthlyCost: 400, yearlyCost: 4800 },
      { name: "Marketing & Advertising", paymentDate: "Monthly", weeklyCost: 150, monthlyCost: 600, yearlyCost: 7200 },
    ],
    totalWeekly: 625, totalMonthly: 2500, totalYearly: 30000,
  },
  {
    category: "Shared Expenses",
    items: [
      { name: "Vehicle Costs (Fuel/Rego)", paymentDate: "Weekly", weeklyCost: 350, monthlyCost: 1400, yearlyCost: 16800 },
      { name: "Equipment Maintenance", paymentDate: "Monthly", weeklyCost: 125, monthlyCost: 500, yearlyCost: 6000 },
    ],
    totalWeekly: 475, totalMonthly: 1900, totalYearly: 22800,
  },
  {
    category: "Employee Expenses",
    items: [
      { name: "Director 1 — Salary", paymentDate: "Fortnightly", weeklyCost: 2000, monthlyCost: 8000, yearlyCost: 96000 },
      { name: "Director 2 — Salary", paymentDate: "Fortnightly", weeklyCost: 2000, monthlyCost: 8000, yearlyCost: 96000 },
      { name: "Employee 1 — Wages", paymentDate: "Weekly", weeklyCost: 1300, monthlyCost: 5200, yearlyCost: 62400 },
      { name: "Employee 2 — Wages", paymentDate: "Weekly", weeklyCost: 1200, monthlyCost: 4800, yearlyCost: 57600 },
    ],
    totalWeekly: 6500, totalMonthly: 26000, totalYearly: 312000,
  },
];

// ============================================================
// KPI Stats (derived from sheet data)
// ============================================================
export const kpiStats = [
  { label: "Total Quoted", value: "$399.9K", change: "+12.5%", positive: true },
  { label: "Net Revenue (excl GST)", value: "$38.4K", change: "+8.3%", positive: true },
  { label: "Cash Position", value: "$75.5K", change: "+13.7%", positive: true },
  { label: "Conversion Rate", value: "27.4%", change: "-3.1%", positive: false },
];

// ============================================================
// Expense allocation for pie chart
// ============================================================
export const expenseAllocation = expenseCategories.map((cat, i) => {
  const fills = [
    "hsl(160, 70%, 45%)",
    "hsl(200, 80%, 50%)",
    "hsl(270, 60%, 55%)",
    "hsl(38, 92%, 55%)",
  ];
  return { name: cat.category, value: cat.totalMonthly, fill: fills[i] || fills[0] };
});

// ============================================================
// n8n Data Sources — updated with per-tab mapping
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
