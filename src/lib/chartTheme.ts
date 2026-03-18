/**
 * Resolves CSS custom property values at runtime for use in chart style props.
 * Charts use inline `style` objects so Tailwind classes won't work — we read
 * the computed HSL values from the current theme's CSS variables.
 */

function getVar(name: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return raw ? `hsl(${raw})` : "";
}

export function chartColors() {
  return {
    grid: getVar("--chart-grid"),
    axis: getVar("--chart-axis"),
    tooltipBg: getVar("--chart-tooltip-bg"),
    tooltipBorder: getVar("--chart-tooltip-border"),
    tooltipText: getVar("--chart-tooltip-text"),
    zeroLine: getVar("--chart-zero-line"),
    refLine: getVar("--chart-ref-line"),
    refText: getVar("--chart-ref-text"),
    dotStroke: getVar("--chart-dot-stroke"),
    green: getVar("--chart-green"),
    red: getVar("--chart-red"),
    blue: getVar("--chart-blue"),
    amber: getVar("--chart-amber"),
    purple: getVar("--chart-purple"),
    orange: getVar("--chart-orange"),
    card: getVar("--card"),
    border: getVar("--border"),
    foreground: getVar("--foreground"),
    mutedFg: getVar("--muted-foreground"),
  };
}

export type ChartColors = ReturnType<typeof chartColors>;
