import { useState, useEffect } from "react";
import { MetricFormula, getAvailableVariables, DASHBOARD_CARDS, DATA_SOURCES } from "@/hooks/useFormulas";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import ScreenshotUpload from "@/components/shared/ScreenshotUpload";
import FieldPicker from "@/components/goals/FieldPicker";
import { useDashboardData } from "@/contexts/DashboardDataContext";

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
  const [screenshotUrl, setScreenshotUrl] = useState(initial?.screenshotUrl ?? "");
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
      setScreenshotUrl(initial.screenshotUrl ?? "");
      setDashboardCard(initial.dashboardCard ?? "");
      setDataSource(initial.dataSource ?? "Google Sheets");
    } else {
      setName("");
      setExpression("");
      setDescription("");
      setUnit("%");
      setCategory("Financial");
      setScreenshotUrl("");
      setDashboardCard("");
      setDataSource("Google Sheets");
    }
  }, [initial]);

  const handleSubmit = () => {
    if (!name || !expression) return;
    onSubmit({
      name, expression, description, unit, category,
      screenshotUrl: screenshotUrl || undefined,
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
          <div className="space-y-1.5">
            <Label className="text-xs">Dashboard Card</Label>
            <Select value={dashboardCard} onValueChange={setDashboardCard}>
              <SelectTrigger><SelectValue placeholder="Select dashboard card..." /></SelectTrigger>
              <SelectContent>
                {DASHBOARD_CARDS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Data Source</Label>
            <Select value={dataSource} onValueChange={setDataSource}>
              <SelectTrigger><SelectValue placeholder="Select data source..." /></SelectTrigger>
              <SelectContent>
                {DATA_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Burn Rate" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Expression</Label>
            <Input value={expression} onChange={(e) => setExpression(e.target.value)} placeholder="e.g. OpEx / Revenue * 100" className="font-mono text-xs" />
            <div className="flex flex-wrap gap-1 mt-1">
              {availableVars.map((v) => (
                <Badge
                  key={v}
                  variant="outline"
                  className="text-[10px] cursor-pointer hover:bg-accent/20 border-border text-muted-foreground"
                  onClick={() => setExpression((prev) => (prev ? prev + " " + v : v))}
                >
                  {v}
                </Badge>
              ))}
            </div>

            {/* Field Picker toggle */}
            <Collapsible open={pickerOpen} onOpenChange={setPickerOpen}>
              <CollapsibleTrigger className="text-[10px] font-mono text-muted-foreground hover:text-foreground cursor-pointer mt-2 inline-block">
                {pickerOpen ? "▾ Field Picker" : "▸ Field Picker"}
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
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this metric measures" />
          </div>
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

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Reference Screenshot (where data lives in source)</Label>
            <ScreenshotUpload
              currentUrl={screenshotUrl}
              onUpload={setScreenshotUrl}
              onRemove={() => setScreenshotUrl("")}
            />
          </div>

          <Button onClick={handleSubmit} className="w-full" disabled={!name || !expression}>
            {initial ? "Save Changes" : "Create Formula"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
