export type DateRule =
  | "none"
  | "project_start_end"
  | "est_start"
  | "est_start_minus_10w"
  | "est_start_minus_8w"
  | "est_start_minus_6w"
  | "est_start_minus_2w"
  | "est_start_plus_10d";

export const DATE_RULE_LABELS: Record<DateRule, string> = {
  none: "No date",
  project_start_end: "Project start → end (quote PDF)",
  est_start_minus_10w: "Est. start − 10 weeks · 4-day window",
  est_start_minus_8w: "Est. start − 8 weeks · 4-day window",
  est_start_minus_6w: "Est. start − 6 weeks · 4-day window",
  est_start_minus_2w: "Est. start − 2 weeks · 4-day window",
  est_start: "Est. start",
  est_start_plus_10d: "Est. start + 10 days",
};

export const DATE_RULE_SHORT: Record<DateRule, string> = {
  none: "no date",
  project_start_end: "project start → end",
  est_start_minus_10w: "est. start − 10w",
  est_start_minus_8w: "est. start − 8w",
  est_start_minus_6w: "est. start − 6w",
  est_start_minus_2w: "est. start − 2w",
  est_start: "est. start",
  est_start_plus_10d: "est. start + 10d",
};

export function formatDateShort(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d + (d.length === 10 ? "T00:00:00" : ""));
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-AU", { day: "2-digit", month: "short" });
}

export function daysUntil(d: string | null | undefined): number | null {
  if (!d) return null;
  const dt = new Date(d + (d.length === 10 ? "T00:00:00" : ""));
  if (isNaN(dt.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((dt.getTime() - today.getTime()) / 86_400_000);
}
