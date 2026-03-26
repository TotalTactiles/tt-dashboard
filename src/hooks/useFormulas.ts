import { useState, useCallback } from "react";

export interface MetricFormula {
  id: string;
  name: string;
  expression: string;
  description: string;
  unit: string;
  category: string;
  dashboardCard?: string;
  dataSource?: string;
  section?: string;
}

export const DASHBOARD_CARDS = [
  // Business Overview KPI cards
  "Total Quoted",
  "Total Won",
  "Quoted Remaining",
  "Net Revenue",
  "Cashflow Position",
  "Conversion Rate",
  // Cashflow & Forecasts
  "Cashflow Opening Balance",
  "Cashflow Today Estimate",
  "Cashflow Actual (Manual)",
  "Forecast Anticipated Surplus",
  "Forecast With Probable Jobs",
  // Investor Metrics
  "Profitability",
  "Gross Profit Margin",
  "Revenue Growth",
  "Pipeline Coverage",
  "Avg Contract Value",
  "Operating Expense Ratio",
  "Labour Cost Ratio",
  "Revenue Per Job",
  "CAC Per Client",
  "Win Rate",
];

export const DATA_SOURCES = [
  "Google Sheets",
  "Zoho CRM",
  "Zoho Projects",
  "Xero",
  "Manual",
];

const STORAGE_KEY = "meridian_formulas";
const SEED_KEY = "meridian_formulas_seeded";
const FORMULA_MIGRATION_KEY = "meridian_formulas_v9_full_alignment";

const GROSS_PROFIT_MARGIN_DESCRIPTION = `What is calculated:
• Gross Profit Margin % for each month shown in the chart
• The formula card result mirrors the latest available chart month

How Gross Profit is calculated:
• Source: REVENUE sheet (deal-level rows)
• Month grouping: Other Date, fallback Invoice Date, normalised to Mon-YY
• Revenue used: Value ex GST (valueExclGST)
• Cost used: Total COGS (totalCOGS)
• Gross Profit = Revenue ex GST − Total COGS
• Monthly GP% = Σ(monthly Gross Profit) ÷ Σ(monthly Revenue ex GST) × 100
• This is a weighted monthly GP%, not a simple average of row GP%s

How Net Profit Margin is calculated (same chart):
• Source: CASHFLOW sheet → "Anticipated Cash Surplus/(Deficit)" row
• Each month's Net Profit = value from that row's month column
• Revenue denominator: same REVENUE tab monthly grouping as GP%
• Net Profit % = Net Profit(month) ÷ Σ(Revenue ex GST for month) × 100
• Both lines share the same month keys and revenue denominator

Source fields / rows used:
• REVENUE line-item rows: Other Date, Invoice Date, _label_value, _label_totalCost
• CASHFLOW row: "Anticipated Cash Surplus/(Deficit)"
• Month key format: Mon-YY (e.g. Jan-26)`;

const DEFAULT_FORMULAS: Omit<MetricFormula, "id">[] = [

  // ── BUSINESS OVERVIEW ────────────────────────────────────────────────────
  {
    name: "Total Quoted",
    expression: "TotalQuoted",
    description: `What is calculated:\n• Total value of all active quoted jobs across all pipeline stages\n\nHow it is calculated:\n• Sum of Contract Value for all jobs in Zoho CRM with active stages\n• Includes: Quote Sent, Negotiation/Review, Verbal Confirmation (YLW), PO Received (GRN), Completed\n• Excludes: Lost/Dead\n\nSource: Zoho CRM → QUOTES sheet (QTS SMMRY tab) → GRAND TOTAL row`,
    unit: "$", category: "Financial", dashboardCard: "Total Quoted", dataSource: "Google Sheets", section: "Business Overview",
  },
  {
    name: "Total Won (Confirmed)",
    expression: "TotalWon",
    description: `What is calculated:\n• Total value of confirmed won jobs — PO Received (GRN) + Completed stages only\n\nHow it is calculated:\n• Sum of Contract Value for jobs in PO Received (GRN) and Completed stages\n• Does NOT include Verbal Confirmation (YLW) jobs\n• Use "With YLWs" toggle on the dashboard card to include verbal confirmations\n\nSource: Zoho CRM → QUOTES sheet → PO Received (GRN) + Completed rows`,
    unit: "$", category: "Financial", dashboardCard: "Total Won", dataSource: "Google Sheets", section: "Business Overview",
  },
  {
    name: "Total Won (With YLWs)",
    expression: "YLWplusGRN",
    description: `What is calculated:\n• Total value of won jobs INCLUDING Verbal Confirmation (YLW) stage\n\nHow it is calculated:\n• Sum of PO Received (GRN) + Completed + Verbal Confirmation (YLW) job values\n• Represents best-case pipeline including verbal commitments not yet formalised\n\nSource: Zoho CRM → QUOTES sheet → YLW + GRN combined row`,
    unit: "$", category: "Financial", dashboardCard: "Total Won", dataSource: "Google Sheets", section: "Business Overview",
  },
  {
    name: "Quoted Remaining",
    expression: "QuotedRemaining",
    description: `What is calculated:\n• Value of quotes still active in pipeline — not yet won, lost or completed\n\nHow it is calculated:\n• Total Quoted − Total Won (GRN + Completed)\n• Represents the undecided pipeline: Quote Sent + Negotiation/Review + YLW stages\n\nSource: Zoho CRM → QUOTES sheet → GRAND TOTAL (Active) row`,
    unit: "$", category: "Financial", dashboardCard: "Quoted Remaining", dataSource: "Google Sheets", section: "Business Overview",
  },
  {
    name: "Net Revenue",
    expression: "NetRevenue",
    description: `What is calculated:\n• Revenue from completed/invoiced jobs minus direct cost of sales (COGS)\n\nHow it is calculated:\n• Net Revenue = Total Value ex GST − Total COGS\n• Value ex GST = Value (incl. GST) ÷ 1.1 per revenue line item\n• Total COGS = Labour Cost + Tactile Cost (GST N/A) + Other Products per job\n• Only jobs appearing in the REVENUE sheet are included\n\nSource: REVENUE sheet — Value (incl. GST), Labour Cost, Tactile Cost, Other Products columns`,
    unit: "$", category: "Financial", dashboardCard: "Net Revenue", dataSource: "Google Sheets", section: "Business Overview",
  },
  {
    name: "Cashflow Position (Opening)",
    expression: "CashPosition",
    description: `What is calculated:\n• The opening bank balance for the current month as recorded in the cashflow sheet\n\nHow it is calculated:\n• Reads OPENING BALANCES row (row 2) for the current month column\n• This is the closing balance carried forward from the prior month\n• Represents what the business started the month with\n• Toggle "Today" to see the estimated pre-invoice position after costs paid so far\n• Toggle "Actual" to manually enter the real CBA bank balance\n\nNote: Opening balances are forecast projections until Basiq (CBA open banking) is connected.\n\nSource: CASHFLOW sheet → OPENING BALANCES row → current month column`,
    unit: "$", category: "Financial", dashboardCard: "Cashflow Position", dataSource: "Google Sheets", section: "Business Overview",
  },
  {
    name: "Conversion Rate (Confirmed)",
    expression: "ConversionRateConfirmed",
    description: `What is calculated:\n• Percentage of quoted jobs that converted to confirmed wins (PO Received + Completed)\n\nHow it is calculated:\n• Confirmed Conversion Rate = Won Jobs (GRN + Completed) ÷ Total Quoted Jobs × 100\n• Uses job COUNT not value\n• Excludes Verbal Confirmation (YLW) stage\n• Use "With YLWs" toggle to include verbal confirmations in the rate\n\nBenchmark: 30%+ is strong for a construction/fitout business.\n\nSource: QUOTES sheet → QTS SMMRY tab → stage counts`,
    unit: "%", category: "Growth", dashboardCard: "Conversion Rate", dataSource: "Google Sheets", section: "Business Overview",
  },
  {
    name: "Conversion Rate (With YLWs)",
    expression: "ConversionRate",
    description: `What is calculated:\n• Conversion rate including Verbal Confirmation (YLW) jobs as wins\n\nHow it is calculated:\n• Combined Rate = (Won GRN + Completed + YLW) ÷ Total Quoted × 100\n• Represents optimistic conversion if all verbal commitments convert\n\nSource: QUOTES sheet → QTS SMMRY tab → YLW + GRN combined count`,
    unit: "%", category: "Growth", dashboardCard: "Conversion Rate", dataSource: "Google Sheets", section: "Business Overview",
  },

  // ── CASHFLOW & FORECASTS ──────────────────────────────────────────────────
  {
    name: "Cashflow Opening Balance",
    expression: "CashPosition",
    description: `What is calculated:\n• Current month opening bank balance from cashflow sheet row 2\n\nHow it is calculated:\n• Reads OPENING BALANCES row for the current month\n• March 2026 = $154,514.76\n• Each month's opening = prior month's anticipated closing surplus\n\nNote: Update row 2 with actual CBA bank balance each month for accuracy. Basiq integration will automate this.\n\nSource: CASHFLOW sheet → OPENING BALANCES row (row 2)`,
    unit: "$", category: "Financial", dashboardCard: "Cashflow Opening Balance", dataSource: "Google Sheets", section: "Cashflow & Forecasts",
  },
  {
    name: "Cashflow Today (Pre-Invoice)",
    expression: "CashPosition",
    description: `What is calculated:\n• Estimated conservative cash position today — after costs paid so far, before any invoices clear\n\nHow it is calculated:\n• Today = Opening Balance − Month-to-date costs already paid\n• Payment timing rules:\n  - Fixed OpEx ($7,320): exits day 1 — 100% by any day\n  - Salaries ($14,756): weekly pays — 3/4 done by day 26\n  - Labour/COGS: weekly subcontractors — same as salaries\n  - GST Paid: direct debit — 100%\n  - Car loan: mid-month — 100% if past day 15\n  - Business loan: end of month — 0% before day 28\n  - Income: NOT included — invoices arrive as lump payments\n\nFor March day 26: $154,514 − ~$29,482 costs = ~$125,032\n\nSource: CASHFLOW sheet — individual row values × payment timing fractions`,
    unit: "$", category: "Financial", dashboardCard: "Cashflow Today Estimate", dataSource: "Google Sheets", section: "Cashflow & Forecasts",
  },
  {
    name: "Forecast Anticipated Surplus",
    expression: "CashPosition",
    description: `What is calculated:\n• End-of-month anticipated cash surplus — the full month forecast closing balance\n\nHow it is calculated:\n• Reads Anticipated Cash Surplus/(Deficit) row (row 71) for current month\n• = Opening Balance + Total Income − Total Outgoings for the month\n• March 2026 = $176,026.82\n• This is the accrual-basis forecast — includes all invoiced income for the month\n\nSource: CASHFLOW sheet → Anticipated Cash Surplus/(Deficit) row (row 71) → current month`,
    unit: "$", category: "Financial", dashboardCard: "Forecast Anticipated Surplus", dataSource: "Google Sheets", section: "Cashflow & Forecasts",
  },
  {
    name: "Forecast With Probable Jobs",
    expression: "CashPosition",
    description: `What is calculated:\n• End-of-month cash surplus including income from probable pipeline jobs\n\nHow it is calculated:\n• = Anticipated Surplus + Jobs Probable To Be Won − Cost of Probable Jobs\n• Probable jobs = YLW stage deals with high conversion likelihood\n• Adds expected income from verbal confirmation jobs not yet in cashflow\n\nSource: CASHFLOW sheet → Anticipated Cash Surplus/(Deficit) Including Probable Jobs row (row 76)`,
    unit: "$", category: "Financial", dashboardCard: "Forecast With Probable Jobs", dataSource: "Google Sheets", section: "Cashflow & Forecasts",
  },

  // ── PROJECT EXECUTION ────────────────────────────────────────────────────
  {
    name: "On-Time Delivery",
    expression: "onTimeDelivery",
    description: `What is calculated:\n• Percentage of milestones and tasks completed on or before their due date\n\nHow it is calculated:\n• On-Time % = Completed On-Time Tasks ÷ Total Completed Tasks × 100\n• A task is "on time" if completion date ≤ due date\n• Only completed tasks with a due date are counted\n\nBenchmark: 80%+ is healthy. Below 60% signals systemic scheduling issues.\n\nSource: Zoho Projects — task completion dates vs due dates`,
    unit: "%", category: "Delivery", dataSource: "Zoho Projects", section: "Project Execution",
  },
  {
    name: "Schedule Slippage",
    expression: "scheduleSlippage",
    description: `What is calculated:\n• Average number of days milestones are overdue across all active projects\n\nHow it is calculated:\n• Schedule Slippage = Average (Today − Due Date) for all overdue incomplete milestones\n• Only milestones past their due date and not yet completed are counted\n• Higher numbers = more severe scheduling problems\n\nBenchmark: Under 7 days average is acceptable. Over 30 days requires immediate review.\n\nSource: Zoho Projects — milestone due dates vs today's date`,
    unit: "days", category: "Delivery", dataSource: "Zoho Projects", section: "Project Execution",
  },
  {
    name: "Margin Variance",
    expression: "marginVariance",
    description: `What is calculated:\n• Difference between forecast GP margin and actual GP margin across active projects\n\nHow it is calculated:\n• Margin Variance = Actual GP% − Forecast GP%\n• Positive = better than forecast (ahead of budget)\n• Negative = worse than forecast (over budget on costs)\n\nSource: Zoho Projects cost tracking vs REVENUE sheet GP calculations`,
    unit: "%", category: "Profit", dataSource: "Zoho Projects", section: "Project Execution",
  },
  {
    name: "Labour Efficiency",
    expression: "labourEfficiency",
    description: `What is calculated:\n• Ratio of estimated hours to actual logged hours across active projects\n\nHow it is calculated:\n• Labour Efficiency = Estimated Hours ÷ Actual Logged Hours × 100\n• Above 100% = completed faster than estimated (efficient)\n• Below 100% = taking longer than planned (time overrun)\n\nRequires task duration fields to be set in Zoho Projects.\n\nSource: Zoho Projects — task estimated duration vs logged hours`,
    unit: "%", category: "Delivery", dataSource: "Zoho Projects", section: "Project Execution",
  },

  // ── INVESTOR METRICS ─────────────────────────────────────────────────────
  {
    name: "Profitability — EBITDA",
    expression: "investorMetrics.ebitda",
    description: `What is calculated:\n• EBITDA (Earnings Before Interest, Tax, Depreciation & Amortisation) — estimated from operational data\n\nHow it is calculated:\n• EBITDA = Gross Profit (scope period) − Total Operating Expenses\n• Gross Profit = Revenue ex GST − Total COGS (from REVENUE sheet)\n• Operating Expenses = from EXPENSES sheet (annualised)\n• Scope-aware: changes with This Year / Month / Lifetime filter\n\nBenchmark: 15%+ EBITDA margin is healthy for a contracting business.\n\nSource: REVENUE sheet (GP) + EXPENSES sheet (OpEx) — computed by n8n investorMetrics block`,
    unit: "$", category: "Profitability", dashboardCard: "Profitability", dataSource: "Google Sheets", section: "Investor Metrics",
  },
  {
    name: "Profitability — Net Profit",
    expression: "investorMetrics.ebitda",
    description: `What is calculated:\n• Net Profit = Revenue minus ALL expenses including COGS, salaries, OpEx, loans\n\nHow it is calculated:\n• Net Profit = Revenue ex GST − Total Expenses (all categories)\n• More conservative than EBITDA — includes interest payments and all overhead\n• Scope-aware: changes with This Year / Month / Lifetime filter\n• Toggle between EBITDA and Net Profit on the Profitability card\n\nSource: REVENUE sheet + CASHFLOW sheet total outgoings — computed by n8n`,
    unit: "$", category: "Profitability", dashboardCard: "Profitability", dataSource: "Google Sheets", section: "Investor Metrics",
  },
  {
    name: "Gross Profit Margin %",
    expression: "investorMetrics.grossMarginPct",
    description: GROSS_PROFIT_MARGIN_DESCRIPTION,
    unit: "%", category: "Profitability", dashboardCard: "Gross Profit Margin", dataSource: "Google Sheets", section: "Investor Metrics",
  },
  {
    name: "Revenue Growth",
    expression: "investorMetrics.revenueGrowthMoM",
    description: `What is calculated:\n• Revenue growth — shown as $ YTD total or % growth depending on toggle and scope\n\nHow it is calculated:\n• This Year ($): Total revenue ex GST Jan–current month YTD\n• This Year (%): Average month-on-month growth rate across YTD months\n• Month (%): Current month vs prior month revenue change\n• Lifetime (%): Total revenue growth from first recorded month to now\n\nToggle between $ and % using the pill on the Revenue Growth card.\n\nSource: CASHFLOW sheet → Total Income row (all months) + REVENUE sheet`,
    unit: "%", category: "Growth", dashboardCard: "Revenue Growth", dataSource: "Google Sheets", section: "Investor Metrics",
  },
  {
    name: "Pipeline Coverage Ratio",
    expression: "investorMetrics.pipelineCoverage",
    description: `What is calculated:\n• How many times the active pipeline covers current revenue — forward revenue runway\n\nHow it is calculated:\n• Pipeline Coverage = Active Pipeline Value ÷ Revenue YTD\n• Active Pipeline = GRAND TOTAL (Active) from QTS SMMRY sheet\n• Revenue YTD = total revenue ex GST from REVENUE sheet\n• Expressed as a multiplier (e.g. 1.8x)\n\nBenchmark: 2x+ indicates strong forward revenue runway.\n\nSource: QTS SMMRY sheet + REVENUE sheet — computed by n8n investorMetrics block`,
    unit: "x", category: "Pipeline", dashboardCard: "Pipeline Coverage", dataSource: "Google Sheets", section: "Investor Metrics",
  },
  {
    name: "Average Contract Value",
    expression: "investorMetrics.avgContractValue",
    description: `What is calculated:\n• Average value per won job (PO Received / GRN stage)\n\nHow it is calculated:\n• Avg Contract Value = Revenue YTD ÷ Won Job Count (GRN)\n• Toggle between Won and Quoted average on the dashboard card\n• Won = revenue from jobs on the REVENUE sheet ÷ count of invoiced jobs\n• Quoted = total pipeline value ÷ total quoted job count\n\nSource: REVENUE sheet + QTS SMMRY sheet — computed by n8n investorMetrics block`,
    unit: "$", category: "Pipeline", dashboardCard: "Avg Contract Value", dataSource: "Google Sheets", section: "Investor Metrics",
  },
  {
    name: "Operating Expense Ratio",
    expression: "investorMetrics.operatingExpRatio",
    description: `What is calculated:\n• Total operating expenses as a percentage of revenue — overhead efficiency metric\n\nHow it is calculated:\n• Op Expense Ratio = Total Annual Expenses ÷ Revenue YTD × 100\n• Total Expenses = Grand Total from EXPENSES sheet (yearly cost)\n• Revenue YTD = total revenue ex GST from REVENUE sheet\n\nBenchmark: Below 60% is healthy. The current 19% ratio reflects strong revenue relative to fixed overhead.\n\nSource: EXPENSES sheet (Grand Total row) + REVENUE sheet`,
    unit: "%", category: "Profitability", dashboardCard: "Operating Expense Ratio", dataSource: "Google Sheets", section: "Investor Metrics",
  },
  {
    name: "Labour Cost Ratio",
    expression: "investorMetrics.labourCostRatio",
    description: `What is calculated:\n• Labour and salary costs as a percentage of revenue — workforce cost efficiency\n\nHow it is calculated:\n• Labour Cost Ratio = Total Labour Costs (yearly) ÷ Revenue YTD × 100\n• Labour Costs = salaries (Krishan, Mehmet, Shania, Workers Comp) + subcontractor labour\n• Toggle between Ratio % and $ absolute value on the dashboard card\n\nBenchmark: Below 35% is efficient for a contracting business.\n\nSource: EXPENSES sheet (Personal Expenses) + CASHFLOW sheet salaries rows`,
    unit: "%", category: "Profitability", dashboardCard: "Labour Cost Ratio", dataSource: "Google Sheets", section: "Investor Metrics",
  },
  {
    name: "Revenue Per Job Won",
    expression: "investorMetrics.revenuePerJobWon",
    description: `What is calculated:\n• Average revenue per completed/invoiced job — deal size metric\n\nHow it is calculated:\n• Revenue Per Job = Revenue YTD ÷ Count of invoiced jobs on REVENUE sheet\n• Toggle between Won (invoiced) and Quoted (pipeline average) on the dashboard card\n• Higher values = larger, more complex contracts being won\n\nSource: REVENUE sheet (invoiced jobs) + QTS SMMRY sheet (pipeline count)`,
    unit: "$", category: "Pipeline", dashboardCard: "Revenue Per Job", dataSource: "Google Sheets", section: "Investor Metrics",
  },
  {
    name: "CAC Per Client",
    expression: "investorMetrics.cacPerClient",
    description: `What is calculated:\n• Cost to acquire one new client via paid advertising\n\nHow it is calculated:\n• CAC = Monthly Google Ads Spend ÷ Average Jobs Won Per Month\n• Returns 'N/A (no ad spend)' when Google Ads spend = $0\n• To activate: set a monthly Google Ads budget in EXPENSES sheet under Business Expenses → Advertising\n\nSource: EXPENSES sheet (Advertising sub-category) + QTS SMMRY sheet (GRN count)`,
    unit: "$", category: "Growth", dashboardCard: "CAC Per Client", dataSource: "Google Sheets", section: "Investor Metrics",
  },
  {
    name: "Win Rate",
    expression: "ConversionRateConfirmed",
    description: `What is calculated:\n• Percentage of active quoted jobs that have been won (confirmed GRN)\n\nHow it is calculated:\n• Win Rate = Won Jobs (GRN) ÷ Total Active Jobs × 100\n• Shown on dashboard as count e.g. "10 of 65 active jobs"\n• Lower win rate with high pipeline value = strong quoting volume but selective wins\n\nSource: QUOTES sheet → QTS SMMRY tab — GRN count ÷ active total`,
    unit: "%", category: "Growth", dashboardCard: "Win Rate", dataSource: "Google Sheets", section: "Investor Metrics",
  },
];

// Simple tokenizer and evaluator for arithmetic expressions with named variables
function tokenize(expr: string): string[] {
  const tokens: string[] = [];
  let current = "";
  for (const ch of expr) {
    if ("+-*/()".includes(ch)) {
      if (current.trim()) tokens.push(current.trim());
      tokens.push(ch);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) tokens.push(current.trim());
  return tokens;
}

function resolveToken(token: string, vars: Record<string, number>): number {
  const num = parseFloat(token);
  if (!isNaN(num)) return num;
  if (token in vars) return vars[token];
  throw new Error(`Unknown variable: ${token}`);
}

export function evaluateExpression(
  expression: string,
  kpiVariables?: Record<string, number>
): number | null {
  try {
    const vars = kpiVariables || {};
    const tokens = tokenize(expression);
    const values: number[] = [];
    const ops: string[] = [];
    for (const t of tokens) {
      if ("+-*/".includes(t)) {
        ops.push(t);
      } else if (t === "(" || t === ")") {
        // Skip parens for simplicity
      } else {
        values.push(resolveToken(t, vars));
      }
    }
    let i = 0;
    while (i < ops.length) {
      if (ops[i] === "*" || ops[i] === "/") {
        const result =
          ops[i] === "*" ? values[i] * values[i + 1] : values[i] / values[i + 1];
        values.splice(i, 2, result);
        ops.splice(i, 1);
      } else {
        i++;
      }
    }
    let result = values[0];
    for (let j = 0; j < ops.length; j++) {
      result = ops[j] === "+" ? result + values[j + 1] : result - values[j + 1];
    }
    return isNaN(result) ? null : Math.round(result * 100) / 100;
  } catch {
    return null;
  }
}

// Default variable names shown when no live data is available
const DEFAULT_VARIABLE_NAMES = [
  "TotalQuoted", "TotalWon", "QuotedRemaining",
  "ConversionRate", "ConversionRateConfirmed", "NetRevenue", "CashPosition", "MonthlyExpenses",
  "GrossProfitMargin",
  "onTimeDelivery", "scheduleSlippage", "marginVariance", "labourEfficiency",
];

export function getAvailableVariables(kpiVariables?: Record<string, number>): string[] {
  if (kpiVariables && Object.keys(kpiVariables).length > 0) {
    return Object.keys(kpiVariables);
  }
  return DEFAULT_VARIABLE_NAMES;
}

function upsertSystemFormula(
  formulas: MetricFormula[],
  systemFormula: Omit<MetricFormula, "id">
): { formulas: MetricFormula[]; changed: boolean } {
  const index = formulas.findIndex((formula) => formula.name === systemFormula.name);
  if (index === -1) {
    return {
      formulas: [...formulas, { ...systemFormula, id: crypto.randomUUID() }],
      changed: true,
    };
  }

  const existing = formulas[index];
  const nextFormula: MetricFormula = {
    ...existing,
    expression: systemFormula.expression,
    description: systemFormula.description,
    unit: systemFormula.unit,
    category: systemFormula.category,
    dashboardCard: systemFormula.dashboardCard,
    dataSource: systemFormula.dataSource,
  };

  const changed = JSON.stringify(existing) !== JSON.stringify(nextFormula);
  if (!changed) return { formulas, changed: false };

  const next = [...formulas];
  next[index] = nextFormula;
  return { formulas: next, changed: true };
}

function migrateStoredFormulas(formulas: MetricFormula[]): MetricFormula[] {
  let next = [...formulas];
  let changed = false;

  // Remove "Gross Margin Target" if it exists — it is not a formula
  const targetIdx = next.findIndex((f) => f.name === "Gross Margin Target");
  if (targetIdx !== -1) {
    next.splice(targetIdx, 1);
    changed = true;
  }

  // Upsert all system formulas (ensures new ones are added, existing ones updated)
  for (const systemFormula of DEFAULT_FORMULAS) {
    const result = upsertSystemFormula(next, systemFormula);
    next = result.formulas;
    changed = changed || result.changed;
  }

  return changed ? next : formulas;
}

function loadFormulas(): MetricFormula[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      const seeded = DEFAULT_FORMULAS.map((formula) => ({ ...formula, id: crypto.randomUUID() }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      localStorage.setItem(SEED_KEY, "true");
      localStorage.setItem(FORMULA_MIGRATION_KEY, "true");
      return seeded;
    }

    const parsed = JSON.parse(raw) as MetricFormula[];

    if (!localStorage.getItem(FORMULA_MIGRATION_KEY)) {
      const migrated = migrateStoredFormulas(parsed);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      localStorage.setItem(FORMULA_MIGRATION_KEY, "true");
      return migrated;
    }

    return parsed;
  } catch {
    return [];
  }
}

function saveFormulas(formulas: MetricFormula[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(formulas));
}

export function useFormulas() {
  const [formulas, setFormulas] = useState<MetricFormula[]>(loadFormulas);

  const addFormula = useCallback((formula: Omit<MetricFormula, "id">) => {
    setFormulas((prev) => {
      const next = [...prev, { ...formula, id: crypto.randomUUID() }];
      saveFormulas(next);
      return next;
    });
  }, []);

  const updateFormula = useCallback((id: string, updates: Partial<MetricFormula>) => {
    setFormulas((prev) => {
      const next = prev.map((f) => (f.id === id ? { ...f, ...updates } : f));
      saveFormulas(next);
      return next;
    });
  }, []);

  const deleteFormula = useCallback((id: string) => {
    setFormulas((prev) => {
      const next = prev.filter((f) => f.id !== id);
      saveFormulas(next);
      return next;
    });
  }, []);

  return { formulas, addFormula, updateFormula, deleteFormula };
}
