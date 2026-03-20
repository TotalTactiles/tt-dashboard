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
  "Total Quoted",
  "Total Won",
  "Quoted Remaining",
  "Conversion Rate",
  "Net Revenue",
  "Cashflow Position",
  "Monthly Expenses",
  "Gross Profit Margin",
  "Forecast Chart",
  "Deal Pipeline",
  "Revenue Projects Table",
  "Expense Breakdown",
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
const FORMULA_MIGRATION_KEY = "meridian_formulas_v6_investor_metrics";

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
  // Business Overview
  { name: "Total Quoted", expression: "TotalQuoted", description: "Sum of all quoted project values", unit: "$", category: "Financial", dashboardCard: "Total Quoted", dataSource: "Google Sheets", section: "Business Overview" },
  { name: "Total Won", expression: "TotalWon", description: "Sum of all won project values", unit: "$", category: "Financial", dashboardCard: "Total Won", dataSource: "Google Sheets", section: "Business Overview" },
  { name: "Quoted Remaining", expression: "QuotedRemaining", description: "Value of quotes still pending", unit: "$", category: "Financial", dashboardCard: "Quoted Remaining", dataSource: "Google Sheets", section: "Business Overview" },
  { name: "Conversion Rate (Confirmed)", expression: "ConversionRateConfirmed", description: "PO Received (GRN) + Completed jobs only divided by total quoted. Excludes Verbal Confirmation (YLW) stage.", unit: "%", category: "Growth", dashboardCard: "Conversion Rate", dataSource: "Google Sheets", section: "Business Overview" },
  { name: "Conversion Rate (With YLWs)", expression: "ConversionRate", description: "YLW + GRN confirmed + verbal wins divided by total quoted. Includes Verbal Confirmation (YLW) stage jobs.", unit: "%", category: "Growth", dashboardCard: "Conversion Rate", dataSource: "Google Sheets", section: "Business Overview" },
  { name: "Net Revenue", expression: "NetRevenue", description: "Revenue minus cost of sales", unit: "$", category: "Financial", dashboardCard: "Net Revenue", dataSource: "Google Sheets", section: "Business Overview" },
  { name: "Cashflow Position", expression: "CashPosition", description: "Current available cash position", unit: "$", category: "Financial", dashboardCard: "Cashflow Position", dataSource: "Google Sheets", section: "Business Overview" },
  { name: "Monthly Expenses", expression: "MonthlyExpenses", description: "Total monthly operating expenses", unit: "$", category: "Operational", dashboardCard: "Monthly Expenses", dataSource: "Google Sheets", section: "Business Overview" },
  { name: "Gross Profit Margin", expression: "GrossProfitMargin", description: GROSS_PROFIT_MARGIN_DESCRIPTION, unit: "%", category: "Growth", dashboardCard: "Gross Profit Margin", dataSource: "Google Sheets", section: "Business Overview" },
  { name: "Total Won (With YLWs)", expression: "YLWplusGRN", description: "Total won value including Verbal Confirmation (YLW) jobs", unit: "$", category: "Financial", dashboardCard: "Total Won", dataSource: "Google Sheets", section: "Business Overview" },
  // Project Execution
  { name: "On-Time Delivery", expression: "onTimeDelivery", description: "% of milestones and tasks completed on or before due date", unit: "%", category: "Delivery", dataSource: "Zoho Projects", section: "Project Execution" },
  { name: "Schedule Slippage", expression: "scheduleSlippage", description: "Average days overdue across all active overdue milestones", unit: "days", category: "Delivery", dataSource: "Zoho Projects", section: "Project Execution" },
  { name: "Margin Variance", expression: "marginVariance", description: "Actual GP% minus target GP%. Positive = above target, negative = below.", unit: "%", category: "Profit", dataSource: "Zoho Projects", section: "Project Execution" },
  { name: "Labour Efficiency", expression: "labourEfficiency", description: "Estimated hours vs actual logged hours. 100% = on budget. Requires task durations set in Zoho Projects.", unit: "%", category: "Delivery", dataSource: "Zoho Projects", section: "Project Execution" },
  // Investor Metrics
  { name: "EBITDA (Estimated)", expression: "investorMetrics.ebitda", description: `What is calculated:\n• Earnings Before Interest, Tax, Depreciation & Amortisation — estimated from operational data\n\nHow it is calculated:\n• EBITDA = Gross Profit (YTD) − Total Operating Expenses (annualised)\n• Gross Profit = Revenue ex GST − Total COGS (from REVENUE sheet)\n• Operating Expenses = Grand Total from EXPENSES sheet (yearly)\n\nSource fields:\n• REVENUE sheet: Value (incl. GST) ÷ 1.1, Total COGS\n• EXPENSES sheet: Grand Total yearly cost row\n\nNote: Computed by n8n investorMetrics block, not the formula engine. Value reflects annual expense base vs YTD revenue.`, unit: "$", category: "Profitability", dataSource: "Google Sheets", section: "Investor Metrics" },
  { name: "EBITDA Margin %", expression: "investorMetrics.ebitdaMargin", description: `What is calculated:\n• EBITDA as a percentage of total revenue YTD\n\nHow it is calculated:\n• EBITDA Margin = EBITDA ÷ Revenue YTD × 100\n• Revenue YTD = total revenue ex GST from REVENUE sheet\n• EBITDA = Gross Profit − Operating Expenses (see EBITDA formula)\n\nBenchmark: 15%+ is healthy for a contracting business. Negative indicates expenses exceed gross profit.\n\nSource: Computed by n8n investorMetrics block.`, unit: "%", category: "Profitability", dataSource: "Google Sheets", section: "Investor Metrics" },
  { name: "Gross Profit Margin %", expression: "investorMetrics.grossMarginPct", description: `What is calculated:\n• Gross Profit as a percentage of revenue, excluding GST\n\nHow it is calculated:\n• GP Margin = (Revenue ex GST − Total COGS) ÷ Revenue ex GST × 100\n• Revenue ex GST = Value (incl. GST) ÷ 1.1 per revenue line item\n• Total COGS = Labour Cost + Tactile Cost + Other Products per job\n• Calculated across all revenue line items YTD\n\nSource fields:\n• REVENUE sheet: Value (incl. GST), Labour Cost, Tactile Cost (GST N/A), Other Products (incl. GST), Total COGS\n• Computed by n8n investorMetrics block.`, unit: "%", category: "Profitability", dataSource: "Google Sheets", section: "Investor Metrics" },
  { name: "Revenue Growth (MoM)", expression: "investorMetrics.revenueGrowthMoM", description: `What is calculated:\n• Month-on-month revenue growth rate as a percentage\n\nHow it is calculated:\n• Growth = (Current Month Revenue − Prior Month Revenue) ÷ Prior Month Revenue × 100\n• Current Month = most recent month with non-zero Total Income in CASHFLOW sheet\n• Prior Month = the month immediately before current with non-zero income\n\nSource fields:\n• CASHFLOW sheet: Total Income row, all month columns\n• Only months with income > 0 are considered\n• Computed by n8n investorMetrics block.`, unit: "%", category: "Growth", dataSource: "Google Sheets", section: "Investor Metrics" },
  { name: "Pipeline Coverage Ratio", expression: "investorMetrics.pipelineCoverage", description: `What is calculated:\n• How many times over the active pipeline covers current YTD revenue\n\nHow it is calculated:\n• Pipeline Coverage = Active Pipeline Value ÷ Revenue YTD\n• Active Pipeline = GRAND TOTAL (Active) row from QTS SMMRY sheet\n• Revenue YTD = total revenue ex GST from REVENUE sheet\n• Result expressed as a multiplier (e.g. 2.4x)\n\nBenchmark: 2x+ indicates strong forward revenue runway.\n\nSource fields:\n• QTS SMMRY sheet: GRAND TOTAL (Active) row\n• REVENUE sheet: total Value (incl. GST) ÷ 1.1\n• Computed by n8n investorMetrics block.`, unit: "x", category: "Pipeline", dataSource: "Google Sheets", section: "Investor Metrics" },
  { name: "Average Contract Value", expression: "investorMetrics.avgContractValue", description: `What is calculated:\n• Average value per quoted job across all pipeline stages\n\nHow it is calculated:\n• Avg Contract Value = Grand Total Quoted Value ÷ Total Job Count\n• Grand Total = GRAND TOTAL row from QTS SMMRY sheet\n• Count = total number of jobs across all stages\n\nSource fields:\n• QTS SMMRY sheet: GRAND TOTAL row — Total Value ($) and Count columns\n• Computed by n8n investorMetrics block.`, unit: "$", category: "Pipeline", dataSource: "Google Sheets", section: "Investor Metrics" },
  { name: "Operating Expense Ratio", expression: "investorMetrics.operatingExpRatio", description: `What is calculated:\n• Total operating expenses as a percentage of revenue YTD\n\nHow it is calculated:\n• Op Expense Ratio = Total Annual Expenses ÷ Revenue YTD × 100\n• Total Annual Expenses = Grand Total yearly cost from EXPENSES sheet\n• Revenue YTD = total revenue ex GST from REVENUE sheet\n\nBenchmark: Below 60% is healthy. Above 100% means expenses exceed revenue.\n\nSource fields:\n• EXPENSES sheet: Grand Total row — Yearly Cost column\n• REVENUE sheet: total Value (incl. GST) ÷ 1.1\n• Computed by n8n investorMetrics block.`, unit: "%", category: "Profitability", dataSource: "Google Sheets", section: "Investor Metrics" },
  { name: "Labour Cost Ratio", expression: "investorMetrics.labourCostRatio", description: `What is calculated:\n• Total labour and salary costs as a percentage of revenue YTD\n\nHow it is calculated:\n• Labour Cost Ratio = Effective Labour Cost (yearly) ÷ Revenue YTD × 100\n• Effective Labour Cost = Personal Expenses (wages/salaries) from EXPENSES sheet\n• Falls back to rows containing 'Wage' or 'Salary' in sub-category\n• Revenue YTD = total revenue ex GST from REVENUE sheet\n\nBenchmark: Below 35% is efficient for a contracting business.\n\nSource fields:\n• EXPENSES sheet: Personal Expenses category, yearly cost\n• REVENUE sheet: total Value (incl. GST) ÷ 1.1\n• Computed by n8n investorMetrics block.`, unit: "%", category: "Profitability", dataSource: "Google Sheets", section: "Investor Metrics" },
  { name: "Revenue Per Job Won", expression: "investorMetrics.revenuePerJobWon", description: `What is calculated:\n• Average revenue generated per won (PO Received) job\n\nHow it is calculated:\n• Revenue Per Job = Revenue YTD ÷ Won Job Count\n• Won Job Count = PO Received (GRN) count from QTS SMMRY sheet\n• Revenue YTD = total revenue ex GST from REVENUE sheet\n\nHigher values indicate larger, more complex contracts being won.\n\nSource fields:\n• QTS SMMRY sheet: PO Received (GRN) row — Count column\n• REVENUE sheet: total Value (incl. GST) ÷ 1.1\n• Computed by n8n investorMetrics block.`, unit: "$", category: "Pipeline", dataSource: "Google Sheets", section: "Investor Metrics" },
  { name: "CAC Per Client", expression: "investorMetrics.cacPerClient", description: `What is calculated:\n• Cost to acquire one new client via paid advertising\n\nHow it is calculated:\n• CAC = Monthly Google Ads Spend ÷ Average Jobs Won Per Month\n• Google Ads Spend = Advertising sub-category from EXPENSES sheet (monthly cost)\n• Avg Jobs Won Per Month = Total Won Jobs (GRN) ÷ 12\n• Returns 'N/A (no ad spend)' when Google Ads monthly cost is $0\n\nNote: Set a monthly Google Ads budget in the EXPENSES sheet (Business Expenses → Advertising → Google Ads) to activate this metric.\n\nSource fields:\n• EXPENSES sheet: Business Expenses → Advertising sub-category or Item containing 'Google Ads'\n• QTS SMMRY sheet: PO Received (GRN) row — Count column\n• Computed by n8n investorMetrics block.`, unit: "$", category: "Growth", dataSource: "Google Sheets", section: "Investor Metrics" },
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
