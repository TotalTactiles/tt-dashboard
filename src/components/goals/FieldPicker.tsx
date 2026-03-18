import { useState } from "react";
import { DataStore } from "@/engine/formulaEngine";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FieldPickerProps {
  store: DataStore;
  kpiVariables: Record<string, number>;
  onInsert: (token: string) => void;
}

const SOURCE_TABS = [
  { key: "kpi", label: "KPI Variables" },
  { key: "quotes", label: "Quotes" },
  { key: "cashflow", label: "Cashflow" },
  { key: "revenue", label: "Revenue" },
  { key: "expenses", label: "Expenses" },
  { key: "labour", label: "Labour" },
  { key: "stock", label: "Stock" },
] as const;

type SourceKey = typeof SOURCE_TABS[number]["key"];

const FALLBACK_HEADERS: Record<string, string[]> = {
  quotes: ["Company Name", "Project Name", "Contract Value ($)", "Current Status", "Estimated Job Date", "Stage", "Stage Value ($)", "Date Created"],
  revenue: ["Company", "Project", "Value (incl. GST)", "Invoice Date", "Due Date", "Stage", "Labour Cost", "Total COGS", "Gross Margin $", "GP %"],
  expenses: ["Main Expenses", "Weekly Cost", "Monthly Cost", "Yearly Cost"],
  labour: [],
  stock: [],
};

// ---- Business-oriented template groups ----
interface Template {
  label: string;
  token: string;
  hint: string;
}

interface TemplateGroup {
  name: string;
  templates: Template[];
}

const TEMPLATE_GROUPS: TemplateGroup[] = [
  {
    name: "Totals",
    templates: [
      { label: "Sum field", token: 'SUM(, "")', hint: "SUM(quotes, \"Contract Value ($)\")" },
      { label: "Sum with filter", token: 'SUM(, "", ="")', hint: "SUM(quotes, \"Contract Value ($)\", Status=\"won\")" },
      { label: "A + B", token: " + ", hint: "TotalWon + TotalYellow" },
      { label: "A − B", token: " - ", hint: "GrossRevenue - TotalCOGS" },
    ],
  },
  {
    name: "Counts",
    templates: [
      { label: "Count rows", token: 'COUNT(, ="")', hint: "COUNT(quotes, Status=\"won\")" },
      { label: "Count all", token: "COUNT()", hint: "COUNT(quotes)" },
    ],
  },
  {
    name: "Averages",
    templates: [
      { label: "Average field", token: 'AVG(, "")', hint: "AVG(revenue, \"GP %\")" },
      { label: "Average filtered", token: 'AVG(, "", ="")', hint: "AVG(quotes, \"Contract Value ($)\", Stage=\"won\")" },
    ],
  },
  {
    name: "Current Month",
    templates: [
      { label: "Find row this month", token: 'FIND(cashflow, "", CURRENT_MONTH)', hint: "FIND(cashflow, \"OPENING BALANCES\", CURRENT_MONTH)" },
      { label: "CashPosition variable", token: "CashPosition", hint: "Opening balance for current month" },
      { label: "Total Income (current)", token: "TotalIncome_Current", hint: "Cashflow total income this month" },
      { label: "Total Outgoings (current)", token: "TotalOutgoings_Current", hint: "Cashflow total outgoings this month" },
    ],
  },
  {
    name: "Previous Month",
    templates: [
      { label: "Find row last month", token: 'FIND(cashflow, "", PREV_MONTH)', hint: "FIND(cashflow, \"Total Income\", PREV_MONTH)" },
    ],
  },
  {
    name: "Ratios / %",
    templates: [
      { label: "A / B × 100", token: " / * 100", hint: "TotalWon / TotalQuoted * 100" },
      { label: "Margin %", token: "( - ) /  * 100", hint: "(GrossRevenue - TotalCOGS) / GrossRevenue * 100" },
      { label: "Win rate", token: "ConversionRate", hint: "Pre-calculated conversion rate variable" },
    ],
  },
  {
    name: "Min / Max",
    templates: [
      { label: "Max field", token: 'MAX(, "")', hint: "MAX(quotes, \"Contract Value ($)\")" },
      { label: "Min field", token: 'MIN(, "")', hint: "MIN(revenue, \"GP %\")" },
    ],
  },
  {
    name: "Forecast / Cashflow",
    templates: [
      { label: "Opening Balance", token: 'FIND(cashflow, "OPENING BALANCES", CURRENT_MONTH)', hint: "Current month opening balance" },
      { label: "Anticipated Surplus", token: 'FIND(cashflow, "Anticipated Cash Surplus/(Deficit)", CURRENT_MONTH)', hint: "Current month surplus/deficit" },
      { label: "Surplus incl. Probable", token: 'FIND(cashflow, "Anticipated Cash Surplus/(Deficit) Including Probable Jobs", CURRENT_MONTH)', hint: "Including probable job pipeline" },
    ],
  },
];

function fmtVal(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${v < 0 ? "-" : ""}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${v < 0 ? "-" : ""}$${(abs / 1_000).toFixed(0)}K`;
  if (Number.isInteger(v)) return `${v}`;
  return v.toFixed(2);
}

function detectHeaders(rows: Record<string, any>[], fallback: string[], limit = 20): string[] {
  const firstRow = rows.find((r) => r && typeof r === "object" && Object.keys(r).length > 0);
  if (!firstRow) return fallback.length > 0 ? fallback : [];
  return Object.keys(firstRow)
    .filter((k) => !k.startsWith("_"))
    .slice(0, limit);
}

export default function FieldPicker({ store, kpiVariables, onInsert }: FieldPickerProps) {
  const [activeSource, setActiveSource] = useState<SourceKey>("kpi");
  const [hoveredTemplate, setHoveredTemplate] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, token: string) => {
    e.dataTransfer.setData("text/plain", token);
  };

  // Build fields for column 2
  const getFields = (): { label: string; token: string; detail?: string }[] => {
    if (activeSource === "kpi") {
      return Object.entries(kpiVariables).map(([key, val]) => ({
        label: key,
        token: key,
        detail: fmtVal(val),
      }));
    }

    if (activeSource === "cashflow") {
      const fields: { label: string; token: string; detail?: string }[] = [];

      const rowLabels = new Set<string>();
      for (const row of store.cashflow) {
        const rl = row._label_rowLabel ?? row.col_1;
        if (rl && typeof rl === "string" && rl.trim()) rowLabels.add(rl.trim());
      }
      if (rowLabels.size > 0) {
        fields.push({ label: "── Row Labels ──", token: "", detail: "" });
        for (const rl of rowLabels) {
          fields.push({
            label: rl,
            token: `FIND(cashflow, "${rl}", CURRENT_MONTH)`,
            detail: "FIND",
          });
        }
      }

      const months: string[] = (store.cashflowSummary as any)?.months ?? [];
      if (months.length > 0) {
        fields.push({ label: "── Months ──", token: "", detail: "" });
        for (const m of months) {
          fields.push({ label: m, token: m, detail: "month" });
        }
      }

      return fields;
    }

    const arrayMap: Record<string, Record<string, any>[]> = {
      quotes: store.quotes,
      revenue: store.revenue,
      expenses: store.expenses,
      labour: store.labour,
      stock: store.stock,
    };
    const rows = arrayMap[activeSource] ?? [];
    const fallback = FALLBACK_HEADERS[activeSource] ?? [];
    const limit = (activeSource === "labour" || activeSource === "stock") ? 5 : 20;
    const headers = detectHeaders(rows, fallback, limit);

    return headers.map((h) => ({
      label: h,
      token: `SUM(${activeSource}, "${h}")`,
      detail: "SUM",
    }));
  };

  const fields = getFields();

  return (
    <div className="flex border border-border rounded-md overflow-hidden h-[320px] bg-background">
      {/* Column 1 — Sources */}
      <div className="w-[130px] shrink-0 border-r border-border flex flex-col">
        <div className="px-2 py-1.5 border-b border-border">
          <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Source</span>
        </div>
        <ScrollArea className="flex-1">
          <div className="flex flex-col">
            {SOURCE_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveSource(tab.key)}
                className={`text-left px-3 py-2 text-[11px] font-mono transition-colors ${
                  activeSource === tab.key
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Column 2 — Fields */}
      <div className="w-[190px] shrink-0 border-r border-border flex flex-col">
        <div className="px-2 py-1.5 border-b border-border">
          <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Fields</span>
        </div>
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-0.5 p-1">
            {fields.map((f, i) => {
              if (f.token === "") {
                return (
                  <div key={i} className="px-2 py-1 text-[9px] font-mono text-muted-foreground/60 uppercase tracking-wider">
                    {f.label}
                  </div>
                );
              }
              return (
                <button
                  key={i}
                  type="button"
                  draggable
                  onDragStart={(e) => handleDragStart(e, f.token)}
                  onClick={() => onInsert(f.token)}
                  className="flex items-center justify-between gap-1 px-2 py-1.5 rounded text-left text-[10px] font-mono text-foreground hover:bg-accent/50 transition-colors cursor-grab active:cursor-grabbing"
                >
                  <span className="truncate">{f.label}</span>
                  {f.detail && (
                    <span className="text-[9px] text-muted-foreground shrink-0">{f.detail}</span>
                  )}
                </button>
              );
            })}
            {fields.length === 0 && (
              <p className="text-[10px] text-muted-foreground px-2 py-4">No fields available</p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Column 3 — Templates */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-2 py-1.5 border-b border-border">
          <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Templates</span>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-3">
            {TEMPLATE_GROUPS.map((group) => (
              <div key={group.name}>
                <p className="text-[9px] font-mono text-muted-foreground/70 uppercase tracking-wider mb-1.5">
                  {group.name}
                </p>
                <div className="flex flex-wrap gap-1">
                  {group.templates.map((tpl) => (
                    <button
                      key={tpl.label}
                      type="button"
                      onClick={() => onInsert(tpl.token)}
                      onMouseEnter={() => setHoveredTemplate(tpl.hint)}
                      onMouseLeave={() => setHoveredTemplate(null)}
                      className="px-2 py-1 rounded text-[10px] font-mono border border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        {/* Hint bar */}
        <div className="px-2 py-1.5 border-t border-border min-h-[28px]">
          <p className="text-[9px] font-mono text-muted-foreground/70 truncate">
            {hoveredTemplate ? `Example: ${hoveredTemplate}` : "Hover a template for usage example"}
          </p>
        </div>
      </div>
    </div>
  );
}
