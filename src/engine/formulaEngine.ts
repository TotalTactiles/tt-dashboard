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
const MONTH_KEY_REGEX = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2})$/i;

function normalizeMonthKey(key: string): string | null {
  const match = key.trim().match(MONTH_KEY_REGEX);
  if (!match) return null;
  const monthIndex = MONTH_ORDER.findIndex((month) => month.toLowerCase() === match[1].slice(0, 3).toLowerCase());
  if (monthIndex === -1) return null;
  return `${MONTH_ORDER[monthIndex]}-${match[2]}`;
}

function buildCurrentMonthKey(now = new Date()): string {
  return `${MONTH_ORDER[now.getMonth()]}-${String(now.getFullYear()).slice(-2)}`;
}

function monthKeyToDate(key: string): Date | null {
  const normalized = normalizeMonthKey(key);
  const m = normalized?.match(MONTH_KEY_REGEX);
  if (!m) return null;
  const mi = MONTH_ORDER.indexOf(m[1]);
  const year = 2000 + parseInt(m[2]);
  return new Date(year, mi, 1);
}

function getCanonicalMonthMap(keys: string[]): Map<string, string> {
  const monthMap = new Map<string, string>();
  for (const key of keys) {
    const normalized = normalizeMonthKey(key);
    if (!normalized) continue;
    const canonical = normalized.toUpperCase();
    if (!monthMap.has(canonical)) monthMap.set(canonical, key);
  }
  return monthMap;
}

function selectCurrentOrPastMonthKey(keys: string[], now = new Date()): { generatedKey: string; matchedKey: string | null; fallbackTriggered: boolean } {
  const generatedKey = buildCurrentMonthKey(now);
  const currentNorm = normalizeMonthKey(generatedKey)?.toUpperCase() ?? generatedKey.toUpperCase();
  const monthMap = getCanonicalMonthMap(keys);
  const exactMatch = monthMap.get(currentNorm) ?? null;
  if (exactMatch) {
    return { generatedKey, matchedKey: exactMatch, fallbackTriggered: false };
  }

  const currentDate = monthKeyToDate(generatedKey);
  let matchedKey: string | null = null;
  let matchedDate: Date | null = null;

  for (const originalKey of monthMap.values()) {
    const parsedDate = monthKeyToDate(originalKey);
    if (!parsedDate || !currentDate || parsedDate.getTime() > currentDate.getTime()) continue;
    if (!matchedDate || parsedDate.getTime() > matchedDate.getTime()) {
      matchedKey = originalKey;
      matchedDate = parsedDate;
    }
  }

  return { generatedKey, matchedKey, fallbackTriggered: matchedKey !== null };
}

function normalizeRowLabel(label: unknown): string {
  return String(label ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

function findCashflowRow(rows: Record<string, any>[], label: string): Record<string, any> | undefined {
  const target = normalizeRowLabel(label);
  return rows.find((row) => normalizeRowLabel(row._label_rowLabel ?? row.col_1 ?? "") === target)
    ?? rows.find((row) => {
      const rowLabel = normalizeRowLabel(row._label_rowLabel ?? row.col_1 ?? "");
      return rowLabel.includes(target) || target.includes(rowLabel);
    });
}

function getRowMonthKeys(row: Record<string, any> | undefined): string[] {
  if (!row) return [];
  return Object.keys(row).filter((key) => normalizeMonthKey(key) !== null);
}

function resolveCashflowRowCurrentValue(
  rows: Record<string, any>[],
  rowLabel: string,
  fallbackMonthKeys: string[] = [],
  now = new Date(),
): {
  sourceRow: string;
  generatedKey: string;
  matchedKey: string | null;
  fallbackTriggered: boolean;
  availableMonthKeys: string[];
  value: number;
} {
  const row = findCashflowRow(rows, rowLabel);
  const generatedKey = buildCurrentMonthKey(now);
  const availableMonthKeys = getRowMonthKeys(row).length > 0 ? getRowMonthKeys(row) : fallbackMonthKeys.filter((key) => normalizeMonthKey(key) !== null);

  if (!row || availableMonthKeys.length === 0) {
    return {
      sourceRow: rowLabel,
      generatedKey,
      matchedKey: null,
      fallbackTriggered: false,
      availableMonthKeys,
      value: 0,
    };
  }

  const currentNorm = normalizeMonthKey(generatedKey)?.toUpperCase() ?? generatedKey.toUpperCase();
  const monthMap = getCanonicalMonthMap(availableMonthKeys);
  const exactKey = monthMap.get(currentNorm) ?? null;
  if (exactKey) {
    return {
      sourceRow: String(row._label_rowLabel ?? row.col_1 ?? rowLabel),
      generatedKey,
      matchedKey: exactKey,
      fallbackTriggered: false,
      availableMonthKeys,
      value: parseNum(row[exactKey] ?? 0),
    };
  }

  const currentDate = monthKeyToDate(generatedKey);
  let matchedKey: string | null = null;
  let matchedDate: Date | null = null;

  for (const originalKey of monthMap.values()) {
    const parsedDate = monthKeyToDate(originalKey);
    if (!parsedDate || !currentDate || parsedDate.getTime() > currentDate.getTime()) continue;
    const value = parseNum(row[originalKey] ?? 0);
    if (value === 0) continue;
    if (!matchedDate || parsedDate.getTime() > matchedDate.getTime()) {
      matchedKey = originalKey;
      matchedDate = parsedDate;
    }
  }

  return {
    sourceRow: String(row._label_rowLabel ?? row.col_1 ?? rowLabel),
    generatedKey,
    matchedKey,
    fallbackTriggered: matchedKey !== null,
    availableMonthKeys,
    value: matchedKey ? parseNum(row[matchedKey] ?? 0) : 0,
  };
}

function resolveCurrentMonth(store: DataStore): string | null {
  const cs = store.cashflowSummary as any;
  const months: string[] = Array.isArray(cs?.months) ? cs.months : [];
  return selectCurrentOrPastMonthKey(months).matchedKey;
}

function resolvePrevMonth(store: DataStore): string | null {
  const cs = store.cashflowSummary as any;
  const months: string[] = Array.isArray(cs?.months) ? cs.months : [];
  const current = resolveCurrentMonth(store);
  if (!current) return null;
  const idx = months.indexOf(current);
  return idx > 0 ? months[idx - 1] : null;
}

function resolveLast3Months(store: DataStore): string[] {
  const cs = store.cashflowSummary as any;
  const months: string[] = Array.isArray(cs?.months) ? cs.months : [];
  const current = resolveCurrentMonth(store);
  if (!current) return months.slice(-3);
  const idx = months.indexOf(current);
  const end = idx >= 0 ? idx + 1 : months.length;
  return months.slice(Math.max(0, end - 3), end);
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

  const cashflowSummary = store.cashflowSummary as any;
  const summaryMonths: string[] = Array.isArray(cashflowSummary?.months) ? cashflowSummary.months : [];
  const currentSummaryMonthKey = resolveCurrentMonth(store);
  const totalValue = resolvePath("revenueSummary.totalValue", store);
  const totalCOGS = resolvePath("revenueSummary.totalCOGS", store);

  const monthToKey = (dateStr: string): string | null => {
    if (!dateStr) return null;
    if (/^[A-Za-z]{3}-\d{2}$/i.test(dateStr)) return dateStr;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    const abbr = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${abbr[date.getMonth()]}-${String(date.getFullYear()).slice(2)}`;
  };

  const monthOrder: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };

  const revenueRows = Array.isArray(store.revenue) ? (store.revenue as any[]) : [];
  const grossProfitByMonth: Record<string, { revenue: number; grossProfit: number }> = {};

  for (const row of revenueRows) {
    if (row?._label_isLineItem !== true) continue;

    const valueInclGST = parseNum(row._label_value ?? 0);
    const valueExclGST = valueInclGST / 1.1;
    if (valueExclGST <= 0) continue;

    const labourCost = parseNum(row._label_labourCost ?? 0);
    const tactileCost = parseNum(row._label_tactileCost ?? 0);
    const otherCost = parseNum(row._label_otherCost ?? 0);
    const totalCost = parseNum(row._label_totalCost ?? 0) || (labourCost + tactileCost + otherCost);
    const otherDate = String(row["Other Date"] ?? row._label_otherDate ?? row._label_invoiceDate ?? "").trim();
    const invoiceDate = String(row._label_invoiceDate ?? "").trim();
    const monthKey = monthToKey(otherDate) || monthToKey(invoiceDate);

    if (!monthKey) continue;
    if (!grossProfitByMonth[monthKey]) grossProfitByMonth[monthKey] = { revenue: 0, grossProfit: 0 };

    grossProfitByMonth[monthKey].revenue += valueExclGST;
    grossProfitByMonth[monthKey].grossProfit += valueExclGST - totalCost;
  }

  const latestGrossProfitMonth = Object.keys(grossProfitByMonth)
    .sort((a, b) => {
      const [am, ay] = [a.slice(0, 3).toLowerCase(), parseInt(a.slice(4), 10)];
      const [bm, by] = [b.slice(0, 3).toLowerCase(), parseInt(b.slice(4), 10)];
      return (ay - by) || ((monthOrder[am] ?? 0) - (monthOrder[bm] ?? 0));
    })
    .at(-1);

  const latestGrossProfitMargin = latestGrossProfitMonth
    ? grossProfitByMonth[latestGrossProfitMonth].revenue > 0
      ? Math.round((grossProfitByMonth[latestGrossProfitMonth].grossProfit / grossProfitByMonth[latestGrossProfitMonth].revenue) * 10000) / 100
      : 0
    : 0;

  // CashPosition variable = OPENING BALANCES row (row 2) for current month
  // This is the actual bank opening balance, not a forecast surplus
  const openingBalRow = (() => {
    const strict = store.cashflow.find(r => normalizeRowLabel(r._label_rowLabel ?? r.col_1 ?? "") === "OPENING BALANCES");
    if (strict) return strict;
    return store.cashflow.find(r => {
      const lbl = normalizeRowLabel(r._label_rowLabel ?? r.col_1 ?? "");
      return lbl.includes("OPENING") && !lbl.includes("PROBABLE") && !lbl.includes("WITH");
    });
  })();

  const cashPositionMonthKey = buildCurrentMonthKey();
  let cashPositionValue = 0;
  let cashPositionMatchedKey: string | null = null;

  if (openingBalRow) {
    const rowMonthKeys = getRowMonthKeys(openingBalRow);
    const monthMap = getCanonicalMonthMap(rowMonthKeys);
    const currentNorm = normalizeMonthKey(cashPositionMonthKey)?.toUpperCase() ?? cashPositionMonthKey.toUpperCase();
    const exactKey = monthMap.get(currentNorm) ?? null;
    if (exactKey) {
      cashPositionValue = parseNum(openingBalRow[exactKey] ?? 0);
      cashPositionMatchedKey = exactKey;
    }
  }

  console.log("[CashPosition Variable]", {
    sourceRow: "OPENING BALANCES",
    resolvedMonthKey: cashPositionMonthKey,
    matchedColumn: cashPositionMatchedKey,
    value: cashPositionValue,
  });

  // Confirmed-only conversion rate: (PO Received + Completed) / Grand Total
  const wonCount = resolvePath("quotesSummary.totalWon.count", store);
  const totalCount = resolvePath("quotesSummary.totalQuoted.count", store);
  const confirmedCR = totalCount > 0
    ? Math.round((wonCount / totalCount) * 10000) / 100
    : 0;

  return {
    TotalQuoted: resolvePath("quotesSummary.totalQuoted.value", store),
    TotalWon: resolvePath("quotesSummary.totalWon.value", store),
    QuotedRemaining: resolvePath("quotesSummary.remaining.value", store),
    TotalLost: resolvePath("quotesSummary.totalLost.value", store),
    TotalYellow: resolvePath("quotesSummary.totalYellow.value", store),
    ConversionRate: resolvePath("quotesSummary.conversionRate", store),
    ConversionRateConfirmed: confirmedCR,
    YLWplusGRN: resolvePath("quotesSummary.ylwPlusGrn.value", store),
    GrossRevenue: totalValue,
    TotalCOGS: totalCOGS,
    TotalLabourCost: resolvePath("revenueSummary.totalLabour", store),
    NetRevenue: totalValue - totalCOGS,
    MonthlyExpenses: resolvePath("expensesSummary.totalMonthly", store),
    YearlyExpenses: resolvePath("expensesSummary.totalYearly", store),
    CashPosition: cashPositionValue,
    TotalIncome_Current: currentSummaryMonthKey ? parseNum(cashflowSummary?.totalIncome?.[currentSummaryMonthKey] ?? 0) : 0,
    TotalOutgoings_Current: currentSummaryMonthKey ? parseNum(cashflowSummary?.totalOutgoings?.[currentSummaryMonthKey] ?? 0) : 0,
    GrossProfit_Current: currentSummaryMonthKey ? parseNum(cashflowSummary?.grossProfit?.[currentSummaryMonthKey] ?? 0) : 0,
    GrossProfitMargin: latestGrossProfitMargin,
    GrossMarginTarget: grossMarginTarget,
  };
}
