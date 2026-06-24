export type QuarterFilter = "all" | "Q1" | "Q2" | "Q3" | "Q4";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const Q_MONTHS: Record<Exclude<QuarterFilter, "all">, number[]> = {
  Q1: [0, 1, 2],
  Q2: [3, 4, 5],
  Q3: [6, 7, 8],
  Q4: [9, 10, 11],
};

export function parseMonthKey(key: string): { idx: number; yy: string } | null {
  const m = key.match(/^([A-Za-z]{3})-(\d{2})$/);
  if (!m) return null;
  const idx = MONTHS.indexOf(m[1]);
  return idx < 0 ? null : { idx, yy: m[2] };
}

// selectedYear: "all" or a 2-/4-digit year string ("26" or "2026")
export function filterByPeriod<T extends { month: string }>(
  data: T[],
  selectedYear: string,
  quarter: QuarterFilter,
): T[] {
  const yy2 = selectedYear === "all" ? "all" : selectedYear.slice(-2);
  return data.filter((d) => {
    const p = parseMonthKey(d.month);
    if (!p) return false;
    if (yy2 !== "all" && p.yy !== yy2) return false;
    if (quarter !== "all" && !Q_MONTHS[quarter].includes(p.idx)) return false;
    return true;
  });
}

export function availableYearsFrom<T extends { month: string }>(data: T[]): string[] {
  const set = new Set<string>();
  for (const d of data) {
    const p = parseMonthKey(d.month);
    if (p) set.add("20" + p.yy);
  }
  return [...set].sort();
}
