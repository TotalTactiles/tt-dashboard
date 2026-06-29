export const SECTION_COLORS: Record<string, string> = {
  "Cost of Sales":      "hsl(200, 80%, 50%)",
  "Salaries & Wages":   "hsl(160, 70%, 45%)",
  "Operating Expenses": "hsl(270, 60%, 55%)",
  "Tax & Obligations":  "hsl(38, 92%, 55%)",
  "Finance":            "hsl(340, 65%, 50%)",
  "Debt":               "hsl(0, 70%, 55%)",
  "Finance / Debt":     "hsl(340, 65%, 50%)",
};

const FALLBACK = ["hsl(190,60%,45%)","hsl(30,60%,50%)","hsl(120,50%,40%)","hsl(252,56%,67%)"];

export function getSectionColor(title: string, idx = 0): string {
  return SECTION_COLORS[title] ?? FALLBACK[idx % FALLBACK.length];
}
