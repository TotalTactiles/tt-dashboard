import { useState, useEffect } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MetricFormula } from "@/hooks/useFormulas";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Calculator, Camera } from "lucide-react";
import ScreenshotViewer from "@/components/shared/ScreenshotViewer";
import { formatMetricValue } from "@/lib/formatMetricValue";

interface FormulaCardProps {
  formula: MetricFormula;
  onEdit: (formula: MetricFormula) => void;
  onDelete: (id: string) => void;
}

const DATA_SOURCE_COLORS: Record<string, string> = {
  "Google Sheets": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "Zoho CRM": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "Zoho Projects": "bg-sky-500/15 text-sky-400 border-sky-500/30",
  "Xero": "bg-purple-500/15 text-purple-400 border-purple-500/30",
  "Manual": "bg-muted text-muted-foreground border-border",
};

function DebugSection({ kpiVariables, result, expression, errorMsg }: { kpiVariables: Record<string, number>; result: number | null; expression: string; errorMsg: string | null }) {
  const [open, setOpen] = useState(false);

  const tokens = expression
    .split(/[+\-*/() ]+/)
    .map((t) => t.trim())
    .filter((t) => t && isNaN(Number(t)));
  const resolvedTokens = tokens
    .filter((t) => t in kpiVariables)
    .map((t) => `${t}: ${kpiVariables[t]}`);
  const unknownTokens = tokens.filter((t) => !(t in kpiVariables) && t.length > 0);

  const isNetRevenue = expression.includes("NetRevenue");
  const netRevenueDebug = isNetRevenue
    ? `\n--- NetRevenue breakdown ---\nGrossRevenue: ${kpiVariables["GrossRevenue"] ?? "MISSING"}\nTotalCOGS: ${kpiVariables["TotalCOGS"] ?? "MISSING"}\nNetRevenue = GrossRevenue - TotalCOGS = ${(kpiVariables["GrossRevenue"] ?? 0) - (kpiVariables["TotalCOGS"] ?? 0)}`
    : "";

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="text-[9px] font-mono text-muted-foreground hover:text-foreground cursor-pointer">
        {open ? "▾ debug" : "▸ debug"}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="text-[9px] font-mono text-muted-foreground bg-secondary/50 rounded p-2 mt-1 overflow-x-auto whitespace-pre-wrap break-all">
{`expr: ${expression}
result: ${result}${errorMsg ? `\nerror: ${errorMsg}` : ""}
vars: ${resolvedTokens.length > 0 ? resolvedTokens.join(" | ") : "(none)"}${unknownTokens.length > 0 ? `\nunknown tokens: ${unknownTokens.join(", ")}` : ""}${netRevenueDebug}`}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function FormulaCard({ formula, onEdit, onDelete }: FormulaCardProps) {
  const { kpiVariables, formulaCache, changedFormulas } = useDashboardData();

  const cached = formulaCache.get(formula.id);
  const result = cached?.value ?? null;
  const errorMsg = cached?.error ?? null;
  const [viewerOpen, setViewerOpen] = useState(false);
  const [showPulse, setShowPulse] = useState(false);

  const dataLoaded = Object.values(kpiVariables).some((v) => v !== 0);
  const isWaiting = cached === null;
  const hasError = cached !== null && cached.value === null && cached.error !== null;

  // Pulse animation when formula result changed
  useEffect(() => {
    if (changedFormulas.includes(formula.name)) {
      setShowPulse(true);
      const timer = setTimeout(() => setShowPulse(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [changedFormulas, formula.name]);

  const formatResult = (v: number | null) => {
    if (isWaiting) return "Syncing…";
    if (v === null) return errorMsg ?? "Error";
    if (formula.unit === "%") return formatMetricValue(v, "percentage");
    if (formula.unit === "$") return formatMetricValue(v, "currency");
    return v.toFixed(2);
  };

  const sourceClass = formula.dataSource ? DATA_SOURCE_COLORS[formula.dataSource] || DATA_SOURCE_COLORS["Manual"] : "";

  // Error state: amber border + auto-expand debug
  const cardBorderClass = hasError
    ? "stat-card space-y-3 border-amber-500/50 ring-1 ring-amber-500/20"
    : "stat-card space-y-3";

  return (
    <>
      <div className={cardBorderClass}>
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <Calculator className="h-3.5 w-3.5 text-accent shrink-0" />
              <h3 className="text-sm font-semibold text-foreground truncate">{formula.name}</h3>
              {formula.screenshotUrl && (
                <Camera className="h-3 w-3 text-chart-blue shrink-0" />
              )}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-1">{formula.description}</p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
              {formula.category}
            </Badge>
          </div>
        </div>

        {/* Dashboard card & data source badges */}
        <div className="flex flex-wrap gap-1.5">
          {formula.dashboardCard && (
            <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20">
              📊 {formula.dashboardCard}
            </Badge>
          )}
          {formula.dataSource && (
            <Badge variant="outline" className={`text-[10px] ${sourceClass}`}>
              {formula.dataSource}
            </Badge>
          )}
        </div>

        <div className="bg-secondary/50 rounded-md px-3 py-2">
          <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-1">Expression</p>
          <p className="text-xs font-mono text-foreground">{formula.expression}</p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">Result</p>
            <p className={`text-lg font-mono font-bold ${showPulse ? "animate-formula-pulse" : ""} ${isWaiting ? "text-muted-foreground" : result !== null ? "text-primary glow-green" : "text-destructive"}`}>
              {formatResult(result)}
            </p>
            {errorMsg && !isWaiting && (
              <p className="text-[9px] font-mono text-destructive/80 mt-0.5 break-all">{errorMsg}</p>
            )}
          </div>
          <div className="flex gap-1">
            {formula.screenshotUrl && (
              <Button variant="ghost" size="icon" className="h-6 w-6 text-chart-blue" onClick={() => setViewerOpen(true)}>
                <Camera className="h-3 w-3" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(formula)}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onDelete(formula.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {formula.screenshotUrl && (
          <div
            className="cursor-pointer rounded-md overflow-hidden border border-border hover:border-chart-blue/50 transition-colors"
            onClick={() => setViewerOpen(true)}
          >
            <img
              src={formula.screenshotUrl}
              alt="Reference screenshot"
              className="w-full h-16 object-cover opacity-70 hover:opacity-100 transition-opacity"
            />
            <p className="text-[9px] text-muted-foreground font-mono px-2 py-0.5 bg-secondary/50">
              📎 Source of Truth — click to verify
            </p>
          </div>
        )}

        {/* Debug — auto-expand on error */}
        <DebugSection kpiVariables={kpiVariables} result={result} expression={formula.expression} errorMsg={errorMsg} />
        {hasError && (
          <div className="rounded bg-amber-500/10 border border-amber-500/20 px-2 py-1.5">
            <p className="text-[9px] font-mono text-amber-400">⚠ {errorMsg}</p>
          </div>
        )}
      </div>

      {formula.screenshotUrl && (
        <ScreenshotViewer
          open={viewerOpen}
          onOpenChange={setViewerOpen}
          url={formula.screenshotUrl}
          title={`${formula.name} — Reference Data`}
        />
      )}
    </>
  );
}
