import { useState, useEffect, useMemo } from "react";
import { MetricFormula, getAvailableVariables, DASHBOARD_CARDS, DATA_SOURCES } from "@/hooks/useFormulas";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import FieldPicker from "@/components/goals/FieldPicker";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { formatMetricValue } from "@/lib/formatMetricValue";
import { validateFormula, ValidationResult } from "@/lib/formulaValidation";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

const CATEGORIES = ["Financial", "Operational", "Growth", "Efficiency", "Custom"];
const UNITS = ["$", "%", "#", "x"];

interface FormulaFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (formula: Omit<MetricFormula, "id">) => void;
  initial?: MetricFormula;
  kpiVariables?: Record<string, number>;
}

export default function FormulaForm({ open, onOpenChange, onSubmit, initial, kpiVariables }: FormulaFormProps) {
  const availableVars = getAvailableVariables(kpiVariables);
  const { dataStore, kpiVariables: ctxKpi } = useDashboardData();
  const resolvedKpi = kpiVariables ?? ctxKpi;

  const [name, setName] = useState(initial?.name ?? "");
  const [expression, setExpression] = useState(initial?.expression ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "%");
  const [category, setCategory] = useState(initial?.category ?? "Financial");
  const [dashboardCard, setDashboardCard] = useState(initial?.dashboardCard ?? "");
  const [dataSource, setDataSource] = useState(initial?.dataSource ?? "Google Sheets");
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (initial) {
      setName(initial.name ?? "");
      setExpression(initial.expression ?? "");
      setDescription(initial.description ?? "");
      setUnit(initial.unit ?? "%");
      setCategory(initial.category ?? "Financial");
      setDashboardCard(initial.dashboardCard ?? "");
      setDataSource(initial.dataSource ?? "Google Sheets");
    } else {
      setName("");
      setExpression("");
      setDescription("");
      setUnit("%");
      setCategory("Financial");
      setDashboardCard("");
      setDataSource("Google Sheets");
    }
  }, [initial]);

  // Live Values: parse expression tokens and match against kpiVariables
  const liveValues = useMemo(() => {
    if (!expression || !resolvedKpi || Object.keys(resolvedKpi).length === 0) return [];
    const tokens = expression
      .split(/[+\-*/() ]+/)
      .map(t => t.trim())
      .filter(t => t && isNaN(Number(t)));
    const seen = new Set<string>();
    return tokens
      .filter(t => t in resolvedKpi && !seen.has(t) && (seen.add(t), true))
      .map(t => ({ name: t, value: resolvedKpi[t] }));
  }, [expression, resolvedKpi]);

  // Validation
  const validation: ValidationResult = useMemo(() => {
    if (!expression.trim()) return { valid: false, errors: [], warnings: [] };
    return validateFormula(expression, resolvedKpi);
  }, [expression, resolvedKpi]);

  const canSave = !!name.trim() && !!expression.trim() && validation.valid;

  const handleSubmit = () => {
    if (!canSave) return;
    onSubmit({
      name, expression, description, unit, category,
      dashboardCard: dashboardCard || undefined,
      dataSource: dataSource || undefined,
    });
    onOpenChange(false);
  };

  const handleInsertToken = (token: string) => {
    setExpression((prev) => (prev ? prev + " " + token : token));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">{initial ? "Edit Formula" : "New Formula"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Row 1: Dashboard Card + Data Source */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Dashboard Card</Label>
              <Select value={dashboardCard} onValueChange={setDashboardCard}>
                <SelectTrigger><SelectValue placeholder="Select card..." /></SelectTrigger>
                <SelectContent>
                  {DASHBOARD_CARDS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data Source</Label>
              <Select value={dataSource} onValueChange={setDataSource}>
                <SelectTrigger><SelectValue placeholder="Select source..." /></SelectTrigger>
                <SelectContent>
                  {DATA_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Net Revenue, Burn Rate, Conversion Rate" />
          </div>

          {/* Expression */}
          <div className="space-y-1.5">
            <Label className="text-xs">Expression</Label>
            <Input
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              placeholder='e.g. GrossRevenue - TotalCOGS  or  FIND(cashflow, "OPENING BALANCES", CURRENT_MONTH)'
              className="font-mono text-xs"
            />

            {/* Quick variable badges */}
            <div className="flex flex-wrap gap-1 mt-1">
              {availableVars.slice(0, 12).map((v) => (
                <Badge
                  key={v}
                  variant="outline"
                  className="text-[10px] cursor-pointer hover:bg-accent/20 border-border text-muted-foreground"
                  onClick={() => handleInsertToken(v)}
                >
                  {v}
                </Badge>
              ))}
              {availableVars.length > 12 && (
                <Badge variant="outline" className="text-[10px] border-border text-muted-foreground/50">
                  +{availableVars.length - 12} more in picker
                </Badge>
              )}
            </div>

            {/* Validation feedback */}
            {expression.trim() && (
              <div className="mt-2 space-y-1">
                {validation.valid && validation.warnings.length === 0 && (
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" />
                    Expression syntax valid
                  </div>
                )}
                {validation.errors.map((err, i) => (
                  <div key={`e-${i}`} className="flex items-start gap-1.5 text-[10px] font-mono text-destructive">
                    <XCircle className="h-3 w-3 mt-0.5 shrink-0" />
                    {err}
                  </div>
                ))}
                {validation.warnings.map((w, i) => (
                  <div key={`w-${i}`} className="flex items-start gap-1.5 text-[10px] font-mono text-amber-400">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                    {w}
                  </div>
                ))}
              </div>
            )}

            {/* Live Values */}
            {liveValues.length > 0 && (
              <div className="mt-2">
                <p className="text-[10px] text-muted-foreground font-mono mb-1">Live Values</p>
                <div className="flex flex-wrap gap-1">
                  {liveValues.map(({ name: vName, value }) => (
                    <span key={vName} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 bg-secondary text-[10px] font-mono">
                      <span className="text-muted-foreground">{vName}</span>
                      <span className="text-emerald-400">= {formatMetricValue(value, "currency")}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Field Picker toggle */}
            <Collapsible open={pickerOpen} onOpenChange={setPickerOpen}>
              <CollapsibleTrigger className="text-[10px] font-mono text-muted-foreground hover:text-foreground cursor-pointer mt-2 inline-block">
                {pickerOpen ? "▾ Field Picker & Templates" : "▸ Field Picker & Templates"}
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <FieldPicker
                  store={dataStore}
                  kpiVariables={resolvedKpi}
                  onInsert={handleInsertToken}
                />
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Description — upgraded to textarea with guidance */}
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={`Describe what this formula calculates, how it works, and why it matters.\n\nExample: "Calculates the current month opening balance from the CASHFLOW sheet using the OPENING BALANCES row and current month key (Mon-YY). Used to show current available cash position on the dashboard."`}
              className="text-xs min-h-[80px] resize-y"
              rows={3}
            />
            <p className="text-[9px] text-muted-foreground/60 font-mono">
              Include: what is calculated · how it is derived · which source rows/fields are used
            </p>
          </div>

          {/* Unit + Category */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Save button */}
          <Button onClick={handleSubmit} className="w-full" disabled={!canSave}>
            {initial ? "Save Changes" : "Create Formula"}
          </Button>
          {!canSave && name.trim() && expression.trim() && !validation.valid && (
            <p className="text-[10px] text-destructive font-mono text-center">
              Fix expression errors before saving
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
