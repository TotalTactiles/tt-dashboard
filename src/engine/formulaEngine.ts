/**
 * Formula Engine Core — v1
 *
 * Exported functions:
 *   1. resolvePath
 *   2. evaluateFormula
 *   3. createFormulaCache
 *   4. resolveKpiVariables
 *   5. SUM
 *   6. FIND
 *   7. AVG
 *   8. COUNT
 *   9. MAX
 *  10. MIN
 */

// ---- Types ----

export type DataStore = {
  quotes: Record<string, any>[];
  qtsSmmry: Record<string, any>[];
  cashflow: Record<string, any>[];
  revenue: Record<string, any>[];
  expenses: Record<string, any>[];
  labour: Record<string, any>[];
  stock: Record<string, any>[];
  quotesSummary: Record<string, any>;
  cashflowSummary: Record<string, any>;
  revenueSummary: Record<string, any>;
  expensesSummary: Record<string, any>;
};

export type FormulaResult = {
  value: number | null;
  error: string | null;
  resolvedAt: number;
};

export type EvaluationCache = Record<string, FormulaResult>;

// ---- Helpers ----

function parseNum(v: any): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[$,\s]/g, "");
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

const MONTH_ORDER = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthKeyToDate(key: string): Date | null {
  const m = key.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2})$/i);
  if (!m) return null;
  const mi = MONTH_ORDER.indexOf(m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase());
  const year = 2000 + parseInt(m[2]);
  return new Date(year, mi, 1);
}

function resolveCurrentMonth(store: DataStore): string | null {
  const cs = store.cashflowSummary as any;
  const months: string[] = cs?.months ?? [];
  for (let i = months.length - 1; i >= 0; i--) {
    if (parseNum(cs?.totalIncome?.[months[i]] ?? 0) !== 0) return months[i];
  }
  return months.length > 0 ? months[months.length - 1] : null;
}

function resolvePrevMonth(store: DataStore): string | null {
  const cs = store.cashflowSummary as any;
  const months: string[] = cs?.months ?? [];
  const current = resolveCurrentMonth(store);
  if (!current) return null;
  const idx = months.indexOf(current);
  return idx > 0 ? months[idx - 1] : null;
}

function resolveLast3Months(store: DataStore): string[] {
  const cs = store.cashflowSummary as any;
  const months: string[] = cs?.months ?? [];
  const result: string[] = [];
  for (let i = months.length - 1; i >= 0 && result.length < 3; i--) {
    if (parseNum(cs?.totalIncome?.[months[i]] ?? 0) !== 0) result.push(months[i]);
  }
  return result;
}

function resolveMonthToken(token: string, store: DataStore): string | string[] | null {
  if (token === "CURRENT_MONTH") return resolveCurrentMonth(store);
  if (token === "PREV_MONTH") return resolvePrevMonth(store);
  if (token === "LAST_3_MONTHS") return resolveLast3Months(store);
  return token;
}

function getNestedValue(obj: any, path: string): any {
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function getArrayFromStore(store: DataStore, name: string): Record<string, any>[] {
  const key = name as keyof DataStore;
  const val = store[key];
  return Array.isArray(val) ? val : [];
}

// ---- Filter parsing ----

interface Filter {
  field: string;
  op: string;
  value: string;
}

function parseFilter(f: string): Filter | null {
  for (const op of [">=", "<=", "!=", "="]) {
    const idx = f.indexOf(op);
    if (idx > 0) {
      const field = f.slice(0, idx).trim().replace(/^"|"$/g, "");
      let value = f.slice(idx + op.length).trim().replace(/^"|"$/g, "");
      return { field, op: op === "=" ? "==" : op, value };
    }
  }
  return null;
}

function matchesFilter(row: Record<string, any>, filter: Filter): boolean {
  const raw = row[filter.field] ?? row[`_label_${filter.field}`] ?? "";
  const rowVal = String(raw).trim();
  const filterVal = filter.value.trim();

  // Date comparison
  const rowDate = monthKeyToDate(rowVal);
  const filterDate = monthKeyToDate(filterVal);
  if (rowDate && filterDate) {
    switch (filter.op) {
      case "==": return rowDate.getTime() === filterDate.getTime();
      case ">=": return rowDate.getTime() >= filterDate.getTime();
      case "<=": return rowDate.getTime() <= filterDate.getTime();
      case "!=": return rowDate.getTime() !== filterDate.getTime();
    }
  }

  // String/number comparison
  switch (filter.op) {
    case "==": return rowVal.toLowerCase() === filterVal.toLowerCase();
    case "!=": return rowVal.toLowerCase() !== filterVal.toLowerCase();
    case ">=": return parseNum(rowVal) >= parseNum(filterVal);
    case "<=": return parseNum(rowVal) <= parseNum(filterVal);
  }
  return false;
}

function filterRows(rows: Record<string, any>[], filters: Filter[]): Record<string, any>[] {
  return rows.filter((row) => filters.every((f) => matchesFilter(row, f)));
}

// ---- Aggregation functions ----

export function SUM(store: DataStore, arrayName: string, field: string, ...filterStrs: string[]): number {
  const rows = getArrayFromStore(store, arrayName);
  const filters = filterStrs.map(parseFilter).filter(Boolean) as Filter[];
  const filtered = filterRows(rows, filters);
  return filtered.reduce((sum, row) => sum + parseNum(row[field] ?? row[`_label_${field}`] ?? 0), 0);
}

export function AVG(store: DataStore, arrayName: string, field: string, ...filterStrs: string[]): number {
  const rows = getArrayFromStore(store, arrayName);
  const filters = filterStrs.map(parseFilter).filter(Boolean) as Filter[];
  const filtered = filterRows(rows, filters);
  if (filtered.length === 0) return 0;
  const total = filtered.reduce((sum, row) => sum + parseNum(row[field] ?? row[`_label_${field}`] ?? 0), 0);
  return total / filtered.length;
}

export function COUNT(store: DataStore, arrayName: string, ...filterStrs: string[]): number {
  const rows = getArrayFromStore(store, arrayName);
  const filters = filterStrs.map(parseFilter).filter(Boolean) as Filter[];
  return filterRows(rows, filters).length;
}

export function FIND(store: DataStore, arrayName: string, labelValue: string, monthKey?: string): number {
  const rows = getArrayFromStore(store, arrayName);
  const row = rows.find(
    (r) => (r._label_rowLabel ?? r.col_1 ?? "").toString().trim().toLowerCase() === labelValue.trim().toLowerCase()
  );
  if (!row) return 0;

  if (monthKey) {
    const resolved = resolveMonthToken(monthKey, store);
    if (Array.isArray(resolved)) {
      // LAST_3_MONTHS → average
      const vals = resolved.map((m) => parseNum(row[m] ?? 0));
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    }
    if (resolved) return parseNum(row[resolved] ?? 0);
    return 0;
  }

  // No month key: return first numeric value
  for (const key of Object.keys(row)) {
    if (key.startsWith("_")) continue;
    const v = parseNum(row[key]);
    if (v !== 0) return v;
  }
  return 0;
}

export function MAX(store: DataStore, arrayName: string, field: string, ...filterStrs: string[]): number {
  const rows = getArrayFromStore(store, arrayName);
  const filters = filterStrs.map(parseFilter).filter(Boolean) as Filter[];
  const filtered = filterRows(rows, filters);
  if (filtered.length === 0) return 0;
  return Math.max(...filtered.map((row) => parseNum(row[field] ?? row[`_label_${field}`] ?? 0)));
}

export function MIN(store: DataStore, arrayName: string, field: string, ...filterStrs: string[]): number {
  const rows = getArrayFromStore(store, arrayName);
  const filters = filterStrs.map(parseFilter).filter(Boolean) as Filter[];
  const filtered = filterRows(rows, filters);
  if (filtered.length === 0) return 0;
  return Math.min(...filtered.map((row) => parseNum(row[field] ?? row[`_label_${field}`] ?? 0)));
}

// ---- resolvePath ----

export function resolvePath(path: string, store: DataStore): number {
  // Arithmetic between two paths: detect +, -, *, / at the top level (not inside brackets)
  const arithmeticMatch = path.match(/^(.+?)\s*([+\-*/])\s*([a-zA-Z].+)$/);
  if (arithmeticMatch) {
    // Make sure it's not a month sum (e.g., Jan-26+Feb-26)
    const left = arithmeticMatch[1].trim();
    const op = arithmeticMatch[2];
    const right = arithmeticMatch[3].trim();
    // If left contains a dot, it's a path arithmetic, not month sum
    if (left.includes(".") && right.includes(".")) {
      const lv = resolvePath(left, store);
      const rv = resolvePath(right, store);
      switch (op) {
        case "+": return lv + rv;
        case "-": return lv - rv;
        case "*": return lv * rv;
        case "/": return rv !== 0 ? lv / rv : 0;
      }
    }
  }

  // Array bracket syntax: cashflow[label=Total Income].Mar-26
  const bracketMatch = path.match(/^(\w+)\[(\w+)=(.+?)\]\.(.+)$/);
  if (bracketMatch) {
    const [, arrayName, filterField, filterValue, monthPart] = bracketMatch;
    const rows = getArrayFromStore(store, arrayName);
    const fieldLookup = filterField === "label" ? "_label_rowLabel" : filterField;
    const row = rows.find(
      (r) => (r[fieldLookup] ?? "").toString().trim().toLowerCase() === filterValue.trim().toLowerCase()
    );
    if (!row) return 0;

    // monthPart could be a month token or sum of months
    const resolved = resolveMonthToken(monthPart, store);
    if (Array.isArray(resolved)) {
      const vals = resolved.map((m) => parseNum(row[m] ?? 0));
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    }
    if (resolved) {
      // Could be sum of months: Jan-26+Feb-26+Mar-26
      if (resolved.includes("+")) {
        const keys = resolved.split("+").map((k) => k.trim());
        return keys.reduce((sum, k) => sum + parseNum(row[k] ?? 0), 0);
      }
      return parseNum(row[resolved] ?? 0);
    }
    return 0;
  }

  // Dot notation: quotesSummary.totalQuoted.value
  // Last segment could be a month key or month token
  const parts = path.split(".");
  if (parts.length < 2) return 0;

  const rootKey = parts[0] as keyof DataStore;
  const root = store[rootKey];
  if (root == null) return 0;

  // If root is array, not supported via dot notation (use bracket syntax)
  if (Array.isArray(root)) return 0;

  const lastPart = parts[parts.length - 1];

  // Check for month sum: cashflowSummary.totalIncome.Jan-26+Feb-26+Mar-26
  if (lastPart.includes("+")) {
    const monthKeys = lastPart.split("+").map((k) => k.trim());
    const parent = getNestedValue(root, parts.slice(1, -1).join("."));
    if (parent == null) return 0;
    return monthKeys.reduce((sum, k) => {
      const resolved = resolveMonthToken(k, store);
      if (typeof resolved === "string") return sum + parseNum(parent[resolved] ?? 0);
      return sum;
    }, 0);
  }

  // Check for month token
  const resolved = resolveMonthToken(lastPart, store);
  if (resolved !== lastPart) {
    const parent = getNestedValue(root, parts.slice(1, -1).join("."));
    if (parent == null) return 0;
    if (Array.isArray(resolved)) {
      // LAST_3_MONTHS → average
      const vals = resolved.map((m) => parseNum(parent[m] ?? 0));
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    }
    if (resolved) return parseNum(parent[resolved] ?? 0);
    return 0;
  }

  // Plain nested access
  const value = getNestedValue(root, parts.slice(1).join("."));
  return parseNum(value);
}

// ---- Expression tokenizer & parser ----

function tokenizeExpression(expr: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) { i++; continue; }

    // Operators and parens
    if ("+-*/()".includes(ch)) {
      tokens.push(ch);
      i++;
      continue;
    }

    // Aggregation function call: NAME(...)
    const funcMatch = expr.slice(i).match(/^(SUM|AVG|COUNT|FIND|MAX|MIN)\s*\(/);
    if (funcMatch) {
      // Find matching closing paren
      let depth = 0;
      let j = i + funcMatch[0].length - 1; // position of '('
      const start = i;
      for (; j < expr.length; j++) {
        if (expr[j] === "(") depth++;
        if (expr[j] === ")") { depth--; if (depth === 0) break; }
      }
      tokens.push(expr.slice(start, j + 1));
      i = j + 1;
      continue;
    }

    // Number (including negative handled by parser)
    const numMatch = expr.slice(i).match(/^\d+(\.\d+)?/);
    if (numMatch) {
      tokens.push(numMatch[0]);
      i += numMatch[0].length;
      continue;
    }

    // Variable or path: letters, digits, dots, underscores, hyphens, brackets, =, +, spaces inside brackets
    let token = "";
    let inBracket = false;
    while (i < expr.length) {
      const c = expr[i];
      if (c === "[") inBracket = true;
      if (c === "]") { token += c; inBracket = false; i++; continue; }
      if (inBracket) { token += c; i++; continue; }
      if (/[a-zA-Z0-9_.\-]/.test(c)) { token += c; i++; }
      else break;
    }
    if (token) tokens.push(token);
  }
  return tokens;
}

function resolveTokenValue(token: string, store: DataStore, variables: Record<string, number>): number {
  // Number literal
  const num = parseFloat(token);
  if (!isNaN(num) && /^\d+(\.\d+)?$/.test(token)) return num;

  // Aggregation function
  if (/^(SUM|AVG|COUNT|FIND|MAX|MIN)\s*\(/.test(token)) {
    return evaluateAggregation(token, store);
  }

  // Variable lookup
  if (token in variables) return variables[token];

  // Path lookup
  if (token.includes(".") || token.includes("[")) return resolvePath(token, store);

  // Unknown
  throw new Error(`Unknown variable or path: ${token}`);
}

function evaluateAggregation(call: string, store: DataStore): number {
  const match = call.match(/^(\w+)\((.+)\)$/s);
  if (!match) throw new Error(`Invalid function call: ${call}`);
  const funcName = match[1];
  const argsStr = match[2];

  // Parse arguments respecting quoted strings
  const args: string[] = [];
  let current = "";
  let inQuotes = false;
  let quoteChar = "";
  for (const ch of argsStr) {
    if (!inQuotes && (ch === '"' || ch === "'")) { inQuotes = true; quoteChar = ch; continue; }
    if (inQuotes && ch === quoteChar) { inQuotes = false; continue; }
    if (!inQuotes && ch === ",") { args.push(current.trim()); current = ""; continue; }
    current += ch;
  }
  if (current.trim()) args.push(current.trim());

  const arrayName = args[0];

  switch (funcName) {
    case "SUM": return SUM(store, arrayName, args[1], ...args.slice(2));
    case "AVG": return AVG(store, arrayName, args[1], ...args.slice(2));
    case "COUNT": return COUNT(store, arrayName, ...args.slice(1));
    case "FIND": return FIND(store, arrayName, args[1], args[2]);
    case "MAX": return MAX(store, arrayName, args[1], ...args.slice(2));
    case "MIN": return MIN(store, arrayName, args[1], ...args.slice(2));
    default: throw new Error(`Unknown function: ${funcName}`);
  }
}

// ---- evaluateFormula ----

export function evaluateFormula(
  expression: string,
  store: DataStore,
  variables: Record<string, number>
): FormulaResult {
  try {
    const tokens = tokenizeExpression(expression);
    if (tokens.length === 0) return { value: null, error: "Empty expression", resolvedAt: Date.now() };

    // Convert tokens to values and operators, respecting precedence
    const values: number[] = [];
    const ops: string[] = [];

    let expectValue = true;
    for (const t of tokens) {
      if (t === "(") {
        // Find matching ) in remaining tokens — handled by recursive sub-expression
        // For simplicity, we handle parens via a shunting-yard approach below
        ops.push(t);
        expectValue = true;
      } else if (t === ")") {
        ops.push(t);
        expectValue = false;
      } else if ("+-*/".includes(t) && !expectValue) {
        ops.push(t);
        expectValue = true;
      } else {
        values.push(resolveTokenValue(t, store, variables));
        expectValue = false;
      }
    }

    // Shunting-yard evaluation with operator precedence
    const outputQueue: number[] = [];
    const opStack: string[] = [];

    const precedence: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2 };

    let vi = 0;
    for (const t of tokens) {
      if (t === "(" || t === ")") {
        if (t === "(") {
          opStack.push(t);
        } else {
          while (opStack.length > 0 && opStack[opStack.length - 1] !== "(") {
            const op = opStack.pop()!;
            const b = outputQueue.pop()!;
            const a = outputQueue.pop()!;
            outputQueue.push(applyOp(op, a, b));
          }
          opStack.pop(); // remove "("
        }
      } else if ("+-*/".includes(t) && vi > 0) {
        while (
          opStack.length > 0 &&
          opStack[opStack.length - 1] !== "(" &&
          (precedence[opStack[opStack.length - 1]] ?? 0) >= (precedence[t] ?? 0)
        ) {
          const op = opStack.pop()!;
          const b = outputQueue.pop()!;
          const a = outputQueue.pop()!;
          outputQueue.push(applyOp(op, a, b));
        }
        opStack.push(t);
      } else {
        outputQueue.push(resolveTokenValue(t, store, variables));
        vi++;
      }
    }

    while (opStack.length > 0) {
      const op = opStack.pop()!;
      const b = outputQueue.pop()!;
      const a = outputQueue.pop()!;
      outputQueue.push(applyOp(op, a, b));
    }

    const result = outputQueue[0];
    if (result == null || isNaN(result)) {
      return { value: null, error: "Evaluation produced NaN", resolvedAt: Date.now() };
    }
    return { value: Math.round(result * 100) / 100, error: null, resolvedAt: Date.now() };
  } catch (e: any) {
    return { value: null, error: e.message ?? String(e), resolvedAt: Date.now() };
  }
}

function applyOp(op: string, a: number, b: number): number {
  switch (op) {
    case "+": return a + b;
    case "-": return a - b;
    case "*": return a * b;
    case "/": return b !== 0 ? a / b : 0;
    default: return 0;
  }
}

// ---- Cache layer ----

export function createFormulaCache() {
  let cache: EvaluationCache = {};
  let lastComputedAt: number | null = null;

  return {
    compute(
      formulas: { id: string; expression: string }[],
      store: DataStore,
      variables: Record<string, number>
    ): EvaluationCache {
      cache = {};
      for (const f of formulas) {
        cache[f.id] = evaluateFormula(f.expression, store, variables);
      }
      lastComputedAt = Date.now();
      return cache;
    },
    get(id: string): FormulaResult | null {
      return cache[id] ?? null;
    },
    getAll(): EvaluationCache {
      return { ...cache };
    },
    invalidate(): void {
      cache = {};
      lastComputedAt = null;
    },
    get lastComputedAt_value() {
      return lastComputedAt;
    },
  };
}

// ---- resolveKpiVariables ----

export function resolveKpiVariables(store: DataStore): Record<string, number> {
  // Read gross margin target from localStorage
  let grossMarginTarget = 30;
  try {
    const stored = localStorage.getItem("gross_margin_target");
    if (stored !== null) {
      const n = parseFloat(stored);
      if (!isNaN(n) && n >= 0 && n <= 100) grossMarginTarget = n;
    }
  } catch {}

  return {
    TotalQuoted: resolvePath("quotesSummary.totalQuoted.value", store),
    TotalWon: resolvePath("quotesSummary.totalWon.value", store),
    QuotedRemaining: resolvePath("quotesSummary.remaining.value", store),
    TotalLost: resolvePath("quotesSummary.totalLost.value", store),
    TotalYellow: resolvePath("quotesSummary.totalYellow.value", store),
    ConversionRate: resolvePath("quotesSummary.conversionRate", store),
    YLWplusGRN: resolvePath("quotesSummary.ylwPlusGrn.value", store),
    GrossRevenue: resolvePath("revenueSummary.totalValue", store),
    TotalCOGS: resolvePath("revenueSummary.totalCOGS", store),
    TotalLabourCost: resolvePath("revenueSummary.totalLabour", store),
    NetRevenue: (() => {
      const totalValue = resolvePath("revenueSummary.totalValue", store);
      const totalCOGS = resolvePath("revenueSummary.totalCOGS", store);
      return totalValue - totalCOGS;
    })(),
    MonthlyExpenses: resolvePath("expensesSummary.totalMonthly", store),
    YearlyExpenses: resolvePath("expensesSummary.totalYearly", store),
    CashPosition: resolvePath("cashflowSummary.anticipatedSurplus.CURRENT_MONTH", store),
    TotalIncome_Current: resolvePath("cashflowSummary.totalIncome.CURRENT_MONTH", store),
    TotalOutgoings_Current: resolvePath("cashflowSummary.totalOutgoings.CURRENT_MONTH", store),
    GrossProfit_Current: resolvePath("cashflowSummary.grossProfit.CURRENT_MONTH", store),
    GrossMarginTarget: grossMarginTarget,
  };
}
