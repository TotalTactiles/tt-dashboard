// Mock data for the PE dashboard

export const portfolioData = [
  { month: "Jul", value: 2.4, benchmark: 2.1 },
  { month: "Aug", value: 2.6, benchmark: 2.2 },
  { month: "Sep", value: 2.3, benchmark: 2.3 },
  { month: "Oct", value: 2.8, benchmark: 2.4 },
  { month: "Nov", value: 3.1, benchmark: 2.5 },
  { month: "Dec", value: 2.9, benchmark: 2.5 },
  { month: "Jan", value: 3.2, benchmark: 2.6 },
  { month: "Feb", value: 3.5, benchmark: 2.7 },
  { month: "Mar", value: 3.4, benchmark: 2.8 },
  { month: "Apr", value: 3.8, benchmark: 2.9 },
  { month: "May", value: 4.1, benchmark: 3.0 },
  { month: "Jun", value: 4.3, benchmark: 3.1 },
];

export const sectorAllocation = [
  { name: "Technology", value: 32, fill: "hsl(160, 70%, 45%)" },
  { name: "Healthcare", value: 22, fill: "hsl(200, 80%, 50%)" },
  { name: "Financial", value: 18, fill: "hsl(270, 60%, 55%)" },
  { name: "Industrial", value: 15, fill: "hsl(38, 92%, 55%)" },
  { name: "Energy", value: 13, fill: "hsl(0, 72%, 55%)" },
];

export const dealPipeline = [
  { id: 1, company: "NovaTech Systems", sector: "Technology", stage: "Due Diligence", value: "$420M", irr: "28%", status: "active" },
  { id: 2, company: "MedCore Holdings", sector: "Healthcare", stage: "Term Sheet", value: "$185M", irr: "22%", status: "active" },
  { id: 3, company: "Apex Industrial", sector: "Industrial", stage: "LOI Signed", value: "$310M", irr: "19%", status: "pending" },
  { id: 4, company: "FinEdge Capital", sector: "Financial", stage: "Screening", value: "$95M", irr: "31%", status: "active" },
  { id: 5, company: "GreenVolt Energy", sector: "Energy", stage: "Closed", value: "$560M", irr: "24%", status: "closed" },
];

export const fundPerformance = [
  { quarter: "Q1 '24", nav: 1.42, tvpi: 1.65, dpi: 0.45 },
  { quarter: "Q2 '24", nav: 1.48, tvpi: 1.72, dpi: 0.52 },
  { quarter: "Q3 '24", nav: 1.55, tvpi: 1.81, dpi: 0.58 },
  { quarter: "Q4 '24", nav: 1.61, tvpi: 1.89, dpi: 0.64 },
  { quarter: "Q1 '25", nav: 1.68, tvpi: 1.95, dpi: 0.71 },
  { quarter: "Q2 '25", nav: 1.73, tvpi: 2.02, dpi: 0.78 },
  { quarter: "Q3 '25", nav: 1.79, tvpi: 2.10, dpi: 0.85 },
  { quarter: "Q4 '25", nav: 1.84, tvpi: 2.18, dpi: 0.92 },
];

export const cashflowData = [
  { month: "Jan", inflow: 45, outflow: -32 },
  { month: "Feb", inflow: 28, outflow: -41 },
  { month: "Mar", inflow: 62, outflow: -25 },
  { month: "Apr", inflow: 35, outflow: -38 },
  { month: "May", inflow: 51, outflow: -29 },
  { month: "Jun", inflow: 43, outflow: -47 },
  { month: "Jul", inflow: 58, outflow: -33 },
  { month: "Aug", inflow: 72, outflow: -28 },
];

export const kpiStats = [
  { label: "Total AUM", value: "$4.3B", change: "+12.4%", positive: true },
  { label: "Active Deals", value: "14", change: "+3", positive: true },
  { label: "Avg. IRR", value: "24.8%", change: "+2.1%", positive: true },
  { label: "Dry Powder", value: "$890M", change: "-15.2%", positive: false },
];

export const dataSources = [
  { id: "bloomberg", name: "Bloomberg Terminal", description: "Real-time market data, news, and analytics", category: "Market Data", icon: "📊", connected: false },
  { id: "pitchbook", name: "PitchBook", description: "PE/VC deal flow, valuations, and fund data", category: "Deal Data", icon: "📈", connected: false },
  { id: "preqin", name: "Preqin", description: "Alternative assets data and fund benchmarks", category: "Fund Data", icon: "🏦", connected: false },
  { id: "capitaliq", name: "S&P Capital IQ", description: "Financial intelligence and company data", category: "Market Data", icon: "💹", connected: false },
  { id: "refinitiv", name: "Refinitiv Eikon", description: "Financial analysis and trading platform data", category: "Market Data", icon: "📉", connected: false },
  { id: "cobalt", name: "Cobalt LP", description: "Fund administration and portfolio monitoring", category: "Fund Admin", icon: "⚙️", connected: false },
  { id: "custom_api", name: "Custom REST API", description: "Connect your own data endpoints", category: "Custom", icon: "🔗", connected: false },
  { id: "spreadsheet", name: "Excel / Google Sheets", description: "Import from spreadsheet sources", category: "File Import", icon: "📋", connected: false },
];
