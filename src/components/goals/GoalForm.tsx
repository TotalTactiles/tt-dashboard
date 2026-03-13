import { useState, useEffect } from "react";
import { Goal } from "@/hooks/useGoals";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { useFormulas } from "@/hooks/useFormulas";

const CATEGORIES = ["Revenue", "Operations", "Growth", "Profitability", "Customer", "Product"];
const UNITS = ["$", "%", "#"];

interface GoalFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (goal: Omit<Goal, "id" | "createdAt">) => void;
  initial?: Goal;
}

export default function GoalForm({ open, onOpenChange, onSubmit, initial }: GoalFormProps) {
  const { formulaCache } = useDashboardData();
  const { formulas } = useFormulas();

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [targetValue, setTargetValue] = useState(initial?.targetValue?.toString() ?? "");
  const [currentValue, setCurrentValue] = useState(initial?.currentValue?.toString() ?? "0");
  const [unit, setUnit] = useState(initial?.unit ?? "$");
  const [category, setCategory] = useState(initial?.category ?? "Revenue");
  const [startDate, setStartDate] = useState<Date | undefined>(initial?.startDate ? new Date(initial.startDate) : new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(initial?.endDate ? new Date(initial.endDate) : undefined);
  const [autoFilled, setAutoFilled] = useState(false);

  useEffect(() => {
    if (initial) {
      setName(initial.name ?? "");
      setDescription(initial.description ?? "");
      setTargetValue(initial.targetValue?.toString() ?? "");
      setCurrentValue(initial.currentValue?.toString() ?? "0");
      setUnit(initial.unit ?? "$");
      setCategory(initial.category ?? "Revenue");
      setStartDate(initial.startDate ? new Date(initial.startDate) : new Date());
      setEndDate(initial.endDate ? new Date(initial.endDate) : undefined);
      setAutoFilled(false);
    } else {
      setName("");
      setDescription("");
      setTargetValue("");
      setCurrentValue("0");
      setUnit("$");
      setCategory("Revenue");
      setStartDate(new Date());
      setEndDate(undefined);
      setAutoFilled(false);
    }
  }, [initial]);

  // Auto-populate current value from formula cache when name matches
  useEffect(() => {
    if (!name.trim()) return;
    const nameLower = name.trim().toLowerCase();
    const matchingFormula = formulas.find(
      (f) =>
        f.name.toLowerCase() === nameLower ||
        f.dashboardCard?.toLowerCase() === nameLower
    );
    if (matchingFormula) {
      const cached = formulaCache.get(matchingFormula.id);
      if (cached && cached.value !== null) {
        setCurrentValue(cached.value.toString());
        setAutoFilled(true);
        return;
      }
    }
    setAutoFilled(false);
  }, [name, formulas, formulaCache]);

  const handleSubmit = () => {
    if (!name || !targetValue || !startDate || !endDate) return;
    onSubmit({
      name,
      description,
      targetValue: parseFloat(targetValue),
      currentValue: parseFloat(currentValue) || 0,
      unit,
      category,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">{initial ? "Edit Goal" : "New Goal"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Q2 Revenue Target" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Target</Label>
              <Input type="number" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} placeholder="100" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs">Current</Label>
                {autoFilled && (
                  <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 bg-chart-green/10 text-chart-green border-chart-green/20">
                    from formula
                  </Badge>
                )}
              </div>
              <Input
                type="number"
                value={currentValue}
                onChange={(e) => { setCurrentValue(e.target.value); setAutoFilled(false); }}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left text-xs font-normal", !startDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {startDate ? format(startDate, "PPP") : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left text-xs font-normal", !endDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {endDate ? format(endDate, "PPP") : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <Button onClick={handleSubmit} className="w-full" disabled={!name || !targetValue || !endDate}>
            {initial ? "Save Changes" : "Create Goal"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
