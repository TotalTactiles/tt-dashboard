import { useState } from "react";
import { Goal } from "@/hooks/useGoals";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const CATEGORIES = ["Revenue", "Operations", "Growth", "Profitability", "Customer", "Product"];
const UNITS = ["$", "%", "#"];

interface GoalFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (goal: Omit<Goal, "id" | "createdAt">) => void;
  initial?: Goal;
}

export default function GoalForm({ open, onOpenChange, onSubmit, initial }: GoalFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [targetValue, setTargetValue] = useState(initial?.targetValue?.toString() ?? "");
  const [currentValue, setCurrentValue] = useState(initial?.currentValue?.toString() ?? "0");
  const [unit, setUnit] = useState(initial?.unit ?? "$");
  const [category, setCategory] = useState(initial?.category ?? "Revenue");
  const [startDate, setStartDate] = useState<Date | undefined>(initial?.startDate ? new Date(initial.startDate) : new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(initial?.endDate ? new Date(initial.endDate) : undefined);

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
              <Label className="text-xs">Current</Label>
              <Input type="number" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} placeholder="0" />
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
