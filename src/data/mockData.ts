// Mock data for single-business operational dashboard

export const revenueData = [
  { month: "Jul", revenue: 1.8, target: 1.6 },
  { month: "Aug", revenue: 2.0, target: 1.7 },
  { month: "Sep", revenue: 1.7, target: 1.8 },
  { month: "Oct", revenue: 2.3, target: 1.9 },
  { month: "Nov", revenue: 2.5, target: 2.0 },
  { month: "Dec", revenue: 2.2, target: 2.1 },
  { month: "Jan", revenue: 2.6, target: 2.2 },
  { month: "Feb", revenue: 2.9, target: 2.3 },
  { month: "Mar", revenue: 2.7, target: 2.4 },
  { month: "Apr", revenue: 3.1, target: 2.5 },
  { month: "May", revenue: 3.4, target: 2.6 },
  { month: "Jun", revenue: 3.6, target: 2.7 },
];

export const serviceAllocation = [
  { name: "Consulting", value: 38, fill: "hsl(160, 70%, 45%)" },
  { name: "Software Licensing", value: 26, fill: "hsl(200, 80%, 50%)" },
  { name: "Managed Services", value: 20, fill: "hsl(270, 60%, 55%)" },
  { name: "Training", value: 10, fill: "hsl(38, 92%, 55%)" },
  { name: "Support", value: 6, fill: "hsl(0, 72%, 55%)" },
];

export const projectPipeline = [
  { id: 1, name: "ERP Migration — Phase 2", owner: "Sarah Chen", stage: "In Progress", value: "$340K", completion: "68%", status: "active" },
  { id: 2, name: "Cloud Infrastructure Upgrade", owner: "James Park", stage: "Planning", value: "$180K", completion: "15%", status: "active" },
  { id: 3, name: "CRM Integration (Zoho)", owner: "Priya Sharma", stage: "Review", value: "$95K", completion: "90%", status: "pending" },
  { id: 4, name: "Data Analytics Platform", owner: "Marcus Webb", stage: "Proposal", value: "$520K", completion: "5%", status: "active" },
  { id: 5, name: "Security Audit & Compliance", owner: "Linda Ortiz", stage: "Completed", value: "$75K", completion: "100%", status: "closed" },
];

export const profitabilityData = [
  { month: "Jul", gross: 62, net: 18, ebitda: 28 },
  { month: "Aug", gross: 64, net: 19, ebitda: 30 },
  { month: "Sep", gross: 60, net: 16, ebitda: 26 },
  { month: "Oct", gross: 65, net: 21, ebitda: 32 },
  { month: "Nov", gross: 67, net: 23, ebitda: 34 },
  { month: "Dec", gross: 63, net: 20, ebitda: 30 },
  { month: "Jan", gross: 66, net: 22, ebitda: 33 },
  { month: "Feb", gross: 68, net: 24, ebitda: 35 },
  { month: "Mar", gross: 65, net: 21, ebitda: 31 },
  { month: "Apr", gross: 69, net: 25, ebitda: 36 },
  { month: "May", gross: 71, net: 27, ebitda: 38 },
  { month: "Jun", gross: 70, net: 26, ebitda: 37 },
];

export const cashflowData = [
  { month: "Jan", inflow: 2.6, outflow: -1.9 },
  { month: "Feb", inflow: 2.9, outflow: -2.1 },
  { month: "Mar", inflow: 2.7, outflow: -2.0 },
  { month: "Apr", inflow: 3.1, outflow: -2.2 },
  { month: "May", inflow: 3.4, outflow: -2.3 },
  { month: "Jun", inflow: 3.6, outflow: -2.5 },
  { month: "Jul", inflow: 3.2, outflow: -2.4 },
  { month: "Aug", inflow: 3.8, outflow: -2.6 },
];

export const kpiStats = [
  { label: "Revenue (MRR)", value: "$3.6M", change: "+14.2%", positive: true },
  { label: "Gross Profit", value: "$2.5M", change: "+11.8%", positive: true },
  { label: "Operating Expenses", value: "$1.8M", change: "+6.3%", positive: false },
  { label: "Net Profit", value: "$940K", change: "+18.5%", positive: true },
];

export const n8nDataSources = [
  {
    id: "google_sheets",
    name: "Google Sheets",
    description: "Financial reports, KPI tracking, budget spreadsheets",
    icon: "📊",
    connected: false,
    dataMapping: [
      "Monthly revenue & expense reports",
      "KPI scorecards & targets",
      "Budget vs actuals tracking",
      "Cash flow projections",
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
