// Calendar & date-related mock data for PE dashboard

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // ISO date
  endDate?: string;
  time?: string;
  type: "meeting" | "deadline" | "milestone" | "call" | "filing" | "distribution" | "valuation";
  calendar: "google" | "zoho";
  priority: "high" | "medium" | "low";
  description?: string;
}

export interface FundDeadline {
  id: string;
  title: string;
  date: string;
  daysRemaining: number;
  category: "capital-call" | "distribution" | "reporting" | "regulatory" | "exit";
  fund: string;
  amount?: string;
  status: "upcoming" | "overdue" | "completed";
}

export interface QuarterlyMilestone {
  quarter: string;
  events: { label: string; date: string; status: "done" | "in-progress" | "upcoming" }[];
}

export const calendarEvents: CalendarEvent[] = [
  { id: "e1", title: "IC Meeting — NovaTech", date: "2026-03-03", time: "09:00", type: "meeting", calendar: "google", priority: "high", description: "Investment committee review for NovaTech acquisition" },
  { id: "e2", title: "LP Advisory Board Call", date: "2026-03-04", time: "14:00", type: "call", calendar: "google", priority: "high", description: "Quarterly LP update and Q&A session" },
  { id: "e3", title: "MedCore Due Diligence Report", date: "2026-03-05", type: "deadline", calendar: "zoho", priority: "high", description: "Final DD report submission deadline" },
  { id: "e4", title: "Fund III Valuation Date", date: "2026-03-07", type: "valuation", calendar: "zoho", priority: "medium" },
  { id: "e5", title: "SEC Form PF Filing", date: "2026-03-10", type: "filing", calendar: "zoho", priority: "high", description: "Quarterly SEC filing deadline" },
  { id: "e6", title: "Capital Call — Tranche 4", date: "2026-03-12", type: "deadline", calendar: "google", priority: "high", description: "$45M capital call notice" },
  { id: "e7", title: "Board Meeting — Apex Industrial", date: "2026-03-14", time: "10:00", type: "meeting", calendar: "google", priority: "medium" },
  { id: "e8", title: "Q1 Distribution", date: "2026-03-15", type: "distribution", calendar: "zoho", priority: "high", description: "$12.8M distribution to LPs" },
  { id: "e9", title: "Portfolio Review — GreenVolt", date: "2026-03-17", time: "11:00", type: "meeting", calendar: "google", priority: "medium" },
  { id: "e10", title: "Investor Relations Dinner", date: "2026-03-19", time: "19:00", type: "meeting", calendar: "google", priority: "low" },
  { id: "e11", title: "FinEdge Term Sheet Review", date: "2026-03-20", time: "15:00", type: "meeting", calendar: "zoho", priority: "high" },
  { id: "e12", title: "Fund III Annual Report Due", date: "2026-03-25", type: "filing", calendar: "zoho", priority: "high" },
  { id: "e13", title: "Co-Invest Close — NovaTech", date: "2026-03-28", type: "milestone", calendar: "google", priority: "high" },
  { id: "e14", title: "Tax K-1 Distribution", date: "2026-03-31", type: "filing", calendar: "zoho", priority: "medium" },
  { id: "e15", title: "Compliance Review", date: "2026-03-06", time: "13:00", type: "meeting", calendar: "google", priority: "medium" },
  { id: "e16", title: "Apex Industrial Exit Planning", date: "2026-03-21", time: "09:30", type: "meeting", calendar: "zoho", priority: "high" },
];

export const fundDeadlines: FundDeadline[] = [
  { id: "d1", title: "Capital Call — Tranche 4", date: "2026-03-12", daysRemaining: 9, category: "capital-call", fund: "Fund III", amount: "$45M", status: "upcoming" },
  { id: "d2", title: "Q1 LP Distribution", date: "2026-03-15", daysRemaining: 12, category: "distribution", fund: "Fund III", amount: "$12.8M", status: "upcoming" },
  { id: "d3", title: "SEC Form PF Filing", date: "2026-03-10", daysRemaining: 7, category: "regulatory", fund: "Fund III", status: "upcoming" },
  { id: "d4", title: "Annual Audited Financials", date: "2026-03-25", daysRemaining: 22, category: "reporting", fund: "Fund III", status: "upcoming" },
  { id: "d5", title: "Fund II Final Exit — GreenVolt", date: "2026-04-15", daysRemaining: 43, category: "exit", fund: "Fund II", amount: "$560M", status: "upcoming" },
  { id: "d6", title: "K-1 Tax Distribution", date: "2026-03-31", daysRemaining: 28, category: "reporting", fund: "Fund III", status: "upcoming" },
  { id: "d7", title: "LP Commitment Expiry", date: "2026-02-28", daysRemaining: -3, category: "capital-call", fund: "Fund III", amount: "$20M", status: "overdue" },
  { id: "d8", title: "Q4 '25 Quarterly Report", date: "2026-02-15", daysRemaining: -16, category: "reporting", fund: "Fund III", status: "completed" },
];

export const quarterlyTimeline: QuarterlyMilestone[] = [
  {
    quarter: "Q1 2026",
    events: [
      { label: "Fund III — Capital Call 4", date: "Mar 12", status: "upcoming" },
      { label: "SEC Form PF Filing", date: "Mar 10", status: "upcoming" },
      { label: "Q1 LP Distribution", date: "Mar 15", status: "upcoming" },
      { label: "Annual Report", date: "Mar 25", status: "upcoming" },
    ],
  },
  {
    quarter: "Q2 2026",
    events: [
      { label: "Fund II Exit Close", date: "Apr 15", status: "upcoming" },
      { label: "IC Review — FinEdge", date: "Apr 22", status: "upcoming" },
      { label: "Q2 LP Distribution", date: "Jun 15", status: "upcoming" },
      { label: "Mid-Year Valuation", date: "Jun 30", status: "upcoming" },
    ],
  },
];

export const eventTypeColors: Record<CalendarEvent["type"], string> = {
  meeting: "hsl(var(--chart-blue))",
  deadline: "hsl(var(--chart-red))",
  milestone: "hsl(var(--chart-green))",
  call: "hsl(var(--chart-purple))",
  filing: "hsl(var(--chart-amber))",
  distribution: "hsl(var(--primary))",
  valuation: "hsl(var(--accent))",
};

export const deadlineCategoryLabels: Record<FundDeadline["category"], string> = {
  "capital-call": "Capital Call",
  distribution: "Distribution",
  reporting: "Reporting",
  regulatory: "Regulatory",
  exit: "Exit",
};

// Monthly event density for heatmap
export const monthlyEventDensity = [
  { day: 1, count: 0 }, { day: 2, count: 1 }, { day: 3, count: 3 }, { day: 4, count: 2 },
  { day: 5, count: 1 }, { day: 6, count: 2 }, { day: 7, count: 1 }, { day: 8, count: 0 },
  { day: 9, count: 0 }, { day: 10, count: 3 }, { day: 11, count: 1 }, { day: 12, count: 2 },
  { day: 13, count: 0 }, { day: 14, count: 2 }, { day: 15, count: 3 }, { day: 16, count: 0 },
  { day: 17, count: 2 }, { day: 18, count: 0 }, { day: 19, count: 1 }, { day: 20, count: 2 },
  { day: 21, count: 2 }, { day: 22, count: 0 }, { day: 23, count: 0 }, { day: 24, count: 1 },
  { day: 25, count: 3 }, { day: 26, count: 0 }, { day: 27, count: 0 }, { day: 28, count: 2 },
  { day: 29, count: 0 }, { day: 30, count: 0 }, { day: 31, count: 2 },
];
