import { useState, useCallback } from "react";

export interface MetricFormula {
  id: string;
  name: string;
  expression: string;
  description: string;
  unit: string;
  category: string;
  screenshotUrl?: string;
  dashboardCard?: string;
  dataSource?: string;
}

export const DASHBOARD_CARDS = [
  "Total Quoted",
  "Total Won",
  "Conversion Rate",
  "Cash Position",
  "Portfolio Chart",
  "Sector Allocation",
  "Cashflow Chart",
  "Fund Performance",
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

const DEFAULT_FORMULAS: Omit<MetricFormula, "id">[] = [
  { name: "Total Quoted", expression: "TotalQuoted", description: "Sum of all quoted project values", unit: "$", category: "Financial", dashboardCard: "Total Quoted", dataSource: "Google Sheets" },
  { name: "Total Won", expression: "TotalWon", description: "Sum of all won project values", unit: "$", category: "Financial", dashboardCard: "Total Won", dataSource: "Google Sheets" },
  { name: "Conversion Rate", expression: "TotalWon / TotalQuoted * 100", description: "Won vs quoted percentage", unit: "%", category: "Growth", dashboardCard: "Conversion Rate", dataSource: "Google Sheets" },
  { name: "Cash Position", expression: "CashPosition", description: "Current available cash", unit: "$", category: "Financial", dashboardCard: "Cash Position", dataSource: "Xero" },
  { name: "Gross Margin", expression: "GrossRevenue - CostOfGoods", description: "Revenue minus cost of goods", unit: "$", category: "Financial", dashboardCard: "Portfolio Chart", dataSource: "Google Sheets" },
  { name: "Net Revenue", expression: "GrossRevenue - CostOfGoods - LabourCost", description: "Revenue minus all costs", unit: "$", category: "Financial", dashboardCard: "Fund Performance", dataSource: "Google Sheets" },
  { name: "Burn Rate", expression: "MonthlyExpenses", description: "Monthly operating expenses", unit: "$", category: "Operational", dashboardCard: "Expense Breakdown", dataSource: "Xero" },
  { name: "OpEx Ratio", expression: "MonthlyExpenses / GrossRevenue * 100", description: "Operating expenses as % of revenue", unit: "%", category: "Efficiency", dashboardCard: "Cashflow Chart", dataSource: "Google Sheets" },
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

export const AVAILABLE_VARIABLES = [
  "TotalQuoted",
  "TotalWon",
  "TotalLost",
  "GrossRevenue",
  "CostOfGoods",
  "LabourCost",
  "NetRevenue",
  "ConversionRate",
  "CashPosition",
  "MonthlyExpenses",
];

function loadFormulas(): MetricFormula[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
    
    // Seed defaults on first load
    if (!localStorage.getItem(SEED_KEY)) {
      const seeded = DEFAULT_FORMULAS.map((f) => ({ ...f, id: crypto.randomUUID() }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      localStorage.setItem(SEED_KEY, "true");
      return seeded;
    }
    return [];
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
