const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export type MoneyScope = "quarter" | "ytd" | "all";

function monKey(d: Date): string {
  return `${MONTH_ABBR[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
}
function parseDate(s?: string): Date | null {
  if (!s) return null;
  const t = String(s).trim();
  const dmy = t.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/);
  if (dmy) return new Date(+dmy[3], +dmy[2] - 1, +dmy[1]);
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d;
}
function normMonth(s: string): string {
  return String(s).toUpperCase().replace(/[^A-Z0-9]/g, "");
}
const MONTH_COL_RE = /^[A-Za-z]{3}[-\s]?\d{2}$/;

/** Month-key set for the scope. null = all months (no filter). */
export function scopeMonths(scope: MoneyScope, now = new Date()): Set<string> | null {
  if (scope === "all") return null;
  const y = now.getFullYear();
  const m = now.getMonth();
  const startIdx = scope === "quarter" ? Math.floor(m / 3) * 3 : 0;
  const keys = new Set<string>();
  for (let i = startIdx; i <= m; i++) keys.add(`${MONTH_ABBR[i]}-${String(y).slice(-2)}`);
  return keys;
}

export function scopeLabel(scope: MoneyScope, now = new Date()): { pill: string; subtitle: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  if (scope === "all") return { pill: "All", subtitle: "All time" };
  if (scope === "ytd") {
    const n = m + 1;
    return { pill: "YTD", subtitle: `Jan–${MONTH_ABBR[m]} ${y} YTD · ${n} month${n > 1 ? "s" : ""}` };
  }
  const q = Math.floor(m / 3) + 1;
  const qStart = Math.floor(m / 3) * 3;
  const n = m - qStart + 1;
  return {
    pill: `Q${q} ${y}`,
    subtitle: `Q${q} ${y} (${MONTH_ABBR[qStart]}–${MONTH_ABBR[qStart + 2]}) · ${n} month${n > 1 ? "s" : ""} to date`,
  };
}

function findCashflowRow(rows: any[], label: string): any | null {
  if (!Array.isArray(rows)) return null;
  const want = normMonth(label);
  return (
    rows.find((r) => {
      const lbl = String(r?._label_rowLabel ?? r?.col_1 ?? r?.Cashflow ?? Object.values(r ?? {})[0] ?? "");
      const n = normMonth(lbl);
      return n === want || n.includes(want);
    }) ?? null
  );
}
function sumRowMonths(row: any, months: Set<string> | null): number {
  if (!row) return 0;
  let total = 0;
  const wanted = months ? new Set(Array.from(months).map(normMonth)) : null;
  for (const [k, v] of Object.entries(row)) {
    if (!MONTH_COL_RE.test(String(k))) continue;
    if (wanted && !wanted.has(normMonth(k))) continue;
    total += Math.abs(Number(String(v).replace(/[^0-9.-]/g, "")) || 0);
  }
  return total;
}

export interface MoneyMetrics {
  scope: MoneyScope;
  revenueExGST: number;
  cogs: number;
  opEx: number;
  labour: number;
  opExpRatio: number | null;
  labourCostRatio: number | null;
  grossMarginPct: number | null;
  lifestyleExpense: number;
  lifestyleExpenseRatio: number | null;
}

export function computeMoneyMetrics(params: {
  scope: MoneyScope;
  monthsOverride?: Set<string> | null;
  revenueProjects: Array<{ valueExclGST: number; totalCOGS: number; invoiceDate?: string; otherDate?: string }>;
  cashflowRows: any[];
  now?: Date;
}): MoneyMetrics {
  const { scope, revenueProjects, cashflowRows } = params;
  const now = params.now ?? new Date();
  const months = params.monthsOverride !== undefined ? params.monthsOverride : scopeMonths(scope, now);

  const inPeriod = (rp: any) => {
    if (months === null) return true;
    const d = parseDate(rp.invoiceDate) || parseDate(rp.otherDate);
    return d ? months.has(monKey(d)) : false;
  };
  const rev = (revenueProjects ?? []).filter(inPeriod);
  const revenueExGST = rev.reduce((s, r) => s + (Number(r.valueExclGST) || 0), 0);
  const cogs = rev.reduce((s, r) => s + (Number(r.totalCOGS) || 0), 0);

  const opExRow = findCashflowRow(cashflowRows, "Total Operating Expenses (incl. Salaries)");
  const salaryRow = findCashflowRow(cashflowRows, "Total Salaries");
  const opEx = sumRowMonths(opExRow, months);
  const labour = sumRowMonths(salaryRow, months);

  return {
    scope,
    revenueExGST,
    cogs,
    opEx,
    labour,
    opExpRatio: revenueExGST > 0 ? (opEx / revenueExGST) * 100 : null,
    labourCostRatio: revenueExGST > 0 ? (labour / revenueExGST) * 100 : null,
    grossMarginPct: revenueExGST > 0 ? ((revenueExGST - cogs) / revenueExGST) * 100 : null,
  };
}

export function availableMonthKeys(
  revenueProjects: Array<{ invoiceDate?: string; otherDate?: string }>
): string[] {
  const set = new Set<string>();
  for (const r of revenueProjects ?? []) {
    const s = r.invoiceDate || r.otherDate;
    if (!s) continue;
    const d = parseDate(s);
    if (d) set.add(monKey(d));
  }
  return Array.from(set).sort((a, b) => {
    const [ma, ya] = a.split("-");
    const [mb, yb] = b.split("-");
    return (Number("20" + yb) - Number("20" + ya)) || (MONTH_ABBR.indexOf(mb) - MONTH_ABBR.indexOf(ma));
  });
}

export function monthLabel(key: string): string {
  const [m, y] = key.split("-");
  return `${m} 20${y}`;
}
