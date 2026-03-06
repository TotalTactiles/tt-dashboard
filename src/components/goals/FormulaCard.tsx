import { useState } from "react";
import { MetricFormula, evaluateExpression } from "@/hooks/useFormulas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Calculator, Camera } from "lucide-react";
import ScreenshotViewer from "@/components/shared/ScreenshotViewer";

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

export default function FormulaCard({ formula, onEdit, onDelete }: FormulaCardProps) {
  const result = evaluateExpression(formula.expression);
  const [viewerOpen, setViewerOpen] = useState(false);

  const formatResult = (v: number | null) => {
    if (v === null) return "Error";
    if (formula.unit === "$") return `$${v >= 1000 ? (v / 1000).toFixed(1) + "K" : v.toFixed(2)}`;
    if (formula.unit === "%") return `${v.toFixed(1)}%`;
    return v.toFixed(2);
  };

  const sourceClass = formula.dataSource ? DATA_SOURCE_COLORS[formula.dataSource] || DATA_SOURCE_COLORS["Manual"] : "";

  return (
    <>
      <div className="stat-card space-y-3">
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
            <p className={`text-lg font-mono font-bold ${result !== null ? "text-primary glow-green" : "text-destructive"}`}>
              {formatResult(result)}
            </p>
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
