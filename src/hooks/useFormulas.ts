import { useState, useCallback } from "react";

export interface MetricFormula {
  id: string;
  name: string;
  expression: string;
  description: string;
  unit: string;
  category: string;
}

const STORAGE_KEY = "meridian_formulas";

// KPI variables available for formulas
const KPI_VARIABLES: Record<string, number> = {
  Revenue: 3.6,
  GrossProfit: 2.5,
  OpEx: 1.8,
  NetProfit: 0.94,
  GrossMargin: 70,
  NetMargin: 26,
  EBITDA: 37,
};

function loadFormulas(): MetricFormula[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveFormulas(formulas: MetricFormula[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(formulas));
}

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
  extraVars?: Record<string, number>
): number | null {
  try {
    const vars = { ...KPI_VARIABLES, ...extraVars };
    const tokens = tokenize(expression);
    // Simple left-to-right with * / priority via two-pass
    // Pass 1: resolve all tokens to numbers
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
    // Pass 2: handle * and / first
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
    // Pass 3: handle + and -
    let result = values[0];
    for (let j = 0; j < ops.length; j++) {
      result = ops[j] === "+" ? result + values[j + 1] : result - values[j + 1];
    }
    return isNaN(result) ? null : Math.round(result * 100) / 100;
  } catch {
    return null;
  }
}

export const AVAILABLE_VARIABLES = Object.keys(KPI_VARIABLES);

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
