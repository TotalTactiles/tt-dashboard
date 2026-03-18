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
const FORMULA_MIGRATION_KEY = "meridian_formulas_v4_gross_margin_split";

const GROSS_PROFIT_MARGIN_DESCRIPTION = `What is calculated:
• Gross Profit Margin % for each month shown in the chart
• The formula card result mirrors the latest available chart month

How it is calculated:
• Source: REVENUE sheet (deal-level rows)
• Month grouping: Other Date, fallback Invoice Date, normalised to Mon-YY
• Revenue used: Value ex GST (valueExclGST)
• Cost used: Total COGS (totalCOGS)
• Gross Profit = Revenue ex GST − Total COGS
• Monthly GP% = Σ(monthly Gross Profit) ÷ Σ(monthly Revenue ex GST) × 100
• This is a weighted monthly GP%, not a simple average of row GP%s

Why it matters:
• Shows how efficiently project revenue converts into gross profit before operating expenses
• Lets the dashboard compare monthly delivery margin against the saved target threshold

Source fields / rows used:
• REVENUE line-item rows only
• Other Date / Invoice Date
• _label_value, _label_totalCost, _label_labourCost, _label_tactileCost, _label_otherCost`;

const DEFAULT_FORMULAS: Omit<MetricFormula, "id">[] = [
  { name: "Total Quoted", expression: "TotalQuoted", description: "Sum of all quoted project values", unit: "$", category: "Financial", dashboardCard: "Total Quoted", dataSource: "Google Sheets" },
  { name: "Total Won", expression: "TotalWon", description: "Sum of all won project values", unit: "$", category: "Financial", dashboardCard: "Total Won", dataSource: "Google Sheets" },
  { name: "Quoted Remaining", expression: "QuotedRemaining", description: "Value of quotes still pending", unit: "$", category: "Financial", dashboardCard: "Quoted Remaining", dataSource: "Google Sheets" },
  { name: "Conversion Rate", expression: "ConversionRate", description: "Won vs quoted percentage", unit: "%", category: "Growth", dashboardCard: "Conversion Rate", dataSource: "Google Sheets" },
  { name: "Net Revenue", expression: "NetRevenue", description: "Revenue minus cost of sales", unit: "$", category: "Financial", dashboardCard: "Net Revenue", dataSource: "Google Sheets" },
  { name: "Cashflow Position", expression: "CashPosition", description: "Current available cash position", unit: "$", category: "Financial", dashboardCard: "Cashflow Position", dataSource: "Google Sheets" },
  { name: "Monthly Expenses", expression: "MonthlyExpenses", description: "Total monthly operating expenses", unit: "$", category: "Operational", dashboardCard: "Monthly Expenses", dataSource: "Google Sheets" },
  { name: "Gross Profit Margin", expression: "GrossProfitMargin", description: GROSS_PROFIT_MARGIN_DESCRIPTION, unit: "%", category: "Growth", dashboardCard: "Gross Profit Margin", dataSource: "Google Sheets" },
  { name: "Conversion Rate (Incl. Verbal)", expression: "YLWplusGRN / TotalQuoted * 100", description: "Won + Verbal Confirmation vs total quoted percentage", unit: "%", category: "Growth", dashboardCard: "Conversion Rate", dataSource: "Google Sheets" },
  { name: "Total Won (With YLWs)", expression: "YLWplusGRN", description: "Total won value including Verbal Confirmation (YLW) jobs", unit: "$", category: "Financial", dashboardCard: "Total Won", dataSource: "Google Sheets" },
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
  "ConversionRate", "NetRevenue", "CashPosition", "MonthlyExpenses",
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

  for (const systemFormulaName of ["Gross Profit Margin", "Gross Margin Target"]) {
    const systemFormula = DEFAULT_FORMULAS.find((formula) => formula.name === systemFormulaName);
    if (!systemFormula) continue;
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
