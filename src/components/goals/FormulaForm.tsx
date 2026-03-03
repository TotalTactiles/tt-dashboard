import { useState } from "react";
import { MetricFormula, AVAILABLE_VARIABLES } from "@/hooks/useFormulas";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CATEGORIES = ["Financial", "Operational", "Growth", "Efficiency", "Custom"];
const UNITS = ["$", "%", "#", "x"];

interface FormulaFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (formula: Omit<MetricFormula, "id">) => void;
  initial?: MetricFormula;
}

export default function FormulaForm({ open, onOpenChange, onSubmit, initial }: FormulaFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [expression, setExpression] = useState(initial?.expression ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "%");
  const [category, setCategory] = useState(initial?.category ?? "Financial");

  const handleSubmit = () => {
    if (!name || !expression) return;
    onSubmit({ name, expression, description, unit, category });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">{initial ? "Edit Formula" : "New Formula"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Burn Rate" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Expression</Label>
            <Input value={expression} onChange={(e) => setExpression(e.target.value)} placeholder="e.g. OpEx / Revenue * 100" className="font-mono text-xs" />
            <div className="flex flex-wrap gap-1 mt-1">
              {AVAILABLE_VARIABLES.map((v) => (
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
          <Button onClick={handleSubmit} className="w-full" disabled={!name || !expression}>
            {initial ? "Save Changes" : "Create Formula"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
