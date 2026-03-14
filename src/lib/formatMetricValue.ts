/**
 * Shared formatting utility for metric values across the dashboard.
 */

export function formatMetricValue(value: number, type: "currency" | "percentage"): string {
  if (type === "percentage") {
    return `${value.toFixed(1)}%`;
  }

  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (abs >= 1_000_000) {
    return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  }
  return `${sign}$${Math.round(abs).toLocaleString("en-AU")}`;
}
