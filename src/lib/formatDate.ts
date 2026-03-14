/**
 * Normalise any date string to "Month YYYY" format.
 * Handles: "August 2026", "08-03-2026 5:45:07", ISO strings, "Mar-26", etc.
 */
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const MONTH_ABBR: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

export function formatDateMonthYear(raw: string): string {
  if (!raw || !raw.trim()) return "";
  const s = raw.trim();

  // Already "Month YYYY" — e.g. "August 2026"
  const monthYearMatch = s.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (monthYearMatch) {
    const idx = MONTH_ABBR[monthYearMatch[1].slice(0, 3).toLowerCase()];
    if (idx !== undefined) return `${MONTH_NAMES[idx]} ${monthYearMatch[2]}`;
  }

  // "Mar-26" style (abbrev-YY)
  const abbrevMatch = s.match(/^([A-Za-z]{3})-(\d{2})$/);
  if (abbrevMatch) {
    const idx = MONTH_ABBR[abbrevMatch[1].toLowerCase()];
    if (idx !== undefined) return `${MONTH_NAMES[idx]} 20${abbrevMatch[2]}`;
  }

  // DD-MM-YYYY or DD/MM/YYYY with optional time
  const dmyMatch = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/);
  if (dmyMatch) {
    const monthIdx = parseInt(dmyMatch[2], 10) - 1;
    if (monthIdx >= 0 && monthIdx < 12) return `${MONTH_NAMES[monthIdx]} ${dmyMatch[3]}`;
  }

  // ISO / standard Date parse fallback
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  }

  return s; // return as-is if unparseable
}
