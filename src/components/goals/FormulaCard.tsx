import { MetricFormula, evaluateExpression } from "@/hooks/useFormulas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Calculator } from "lucide-react";

interface FormulaCardProps {
  formula: MetricFormula;
  onEdit: (formula: MetricFormula) => void;
  onDelete: (id: string) => void;
}

export default function FormulaCard({ formula, onEdit, onDelete }: FormulaCardProps) {
  const result = evaluateExpression(formula.expression);

  const formatResult = (v: number | null) => {
    if (v === null) return "Error";
    if (formula.unit === "$") return `$${v >= 1000 ? (v / 1000).toFixed(1) + "K" : v.toFixed(2)}`;
    if (formula.unit === "%") return `${v.toFixed(1)}%`;
    return v.toFixed(2);
  };

  return (
    <div className="stat-card space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Calculator className="h-3.5 w-3.5 text-accent" />
            <h3 className="text-sm font-semibold text-foreground">{formula.name}</h3>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-1">{formula.description}</p>
        </div>
        <Badge variant="outline" className="text-[10px] shrink-0 border-border text-muted-foreground">
          {formula.category}
        </Badge>
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
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(formula)}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onDelete(formula.id)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
