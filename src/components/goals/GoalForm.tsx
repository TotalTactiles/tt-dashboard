import { useState, useEffect } from "react";
import { Goal } from "@/hooks/useGoals";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { CalendarIcon, Info } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const EXPENDITURE_CATEGORIES = ["Operating Expense", "Capital Expense", "Payroll", "Marketing", "Other"];
const REVENUE_CATEGORIES = ["Revenue", "Customer", "Sales Target", "Other"];

function suggestCategory(name: string, goalType: "expenditure" | "revenue" | ""): string {
  const n = name.toLowerCase();
  if (n.includes("salary") || n.includes("wage") || n.includes("pay")) return "Payroll";
  if (n.includes("rent") || n.includes("lease") || n.includes("office")) return "Operating Expense";
  if (n.includes("marketing") || n.includes("ads") || n.includes("google")) return "Marketing";
  if (n.includes("customer") || n.includes("client") || n.includes("chevy") || n.includes("ram")) return "Customer";
  if (n.includes("revenue") || n.includes("sales") || n.includes("target") || n.includes("win")) return "Revenue";
  if (goalType === "expenditure") return "Other";
  if (goalType === "revenue") return "Revenue";
  return "Other";
}

function fmtCurrency(n: number): string {
  return `$${n.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

interface GoalFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (goal: Omit<Goal, "id" | "createdAt">) => void;
  initial?: Goal;
}

export default function GoalForm({ open, onOpenChange, onSubmit, initial }: GoalFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [goalType, setGoalType] = useState<"expenditure" | "revenue" | "">("");
  const [amountStructure, setAmountStructure] = useState<"lump_sum" | "recurring" | "">("");
  const [totalAmount, setTotalAmount] = useState("");
  const [period, setPeriod] = useState<"weekly" | "monthly" | "yearly">("monthly");
  const [lumpSumDate, setLumpSumDate] = useState<Date | undefined>();
  const [category, setCategory] = useState("Other");
  const [categorySuggested, setCategorySuggested] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [merge, setMerge] = useState(false);

  useEffect(() => {
    if (initial) {
      setName(initial.name ?? "");
      setDescription(initial.description ?? "");
      setGoalType(initial.goalType ?? "");
      setAmountStructure(initial.amountStructure ?? "");
      setTotalAmount(initial.targetValue?.toString() ?? "");
      setPeriod(initial.period ?? "monthly");
      setLumpSumDate(initial.lumpSumDate ? new Date(initial.lumpSumDate) : undefined);
      setCategory(initial.category ?? "Other");
      setCategorySuggested(false);
      setStartDate(initial.startDate ? new Date(initial.startDate) : new Date());
      setEndDate(initial.endDate ? new Date(initial.endDate) : undefined);
      setMerge(initial.merge ?? false);
    } else {
      setName("");
      setDescription("");
      setGoalType("");
      setAmountStructure("");
      setTotalAmount("");
      setPeriod("monthly");
      setLumpSumDate(undefined);
      setCategory("Other");
      setCategorySuggested(false);
      setStartDate(new Date());
      setEndDate(undefined);
      setMerge(false);
    }
  }, [initial, open]);

  const handleNameBlur = () => {
    if (!name.trim()) return;
    const suggested = suggestCategory(name, goalType as any);
    setCategory(suggested);
    setCategorySuggested(true);
  };

  const amt = parseFloat(totalAmount) || 0;

  const periodCalc = (() => {
    if (amountStructure !== "recurring" || amt <= 0) return null;
    if (period === "weekly") return { weekly: amt, monthly: amt * 4.33, yearly: amt * 52 };
    if (period === "monthly") return { weekly: amt / 4.33, monthly: amt, yearly: amt * 12 };
    return { weekly: amt / 52, monthly: amt / 12, yearly: amt };
  })();

  const categories = goalType === "expenditure" ? EXPENDITURE_CATEGORIES : goalType === "revenue" ? REVENUE_CATEGORIES : [...EXPENDITURE_CATEGORIES, ...REVENUE_CATEGORIES].filter((v, i, a) => a.indexOf(v) === i);

  const handleSubmit = () => {
    if (!name || !totalAmount || !goalType) return;
    onSubmit({
      name,
      description,
      targetValue: amt,
      currentValue: 0,
      unit: "$",
      category,
      startDate: (startDate ?? new Date()).toISOString(),
      endDate: (endDate ?? new Date()).toISOString(),
      goalType: goalType as "expenditure" | "revenue",
      amountStructure: (amountStructure || "lump_sum") as "lump_sum" | "recurring",
      period: amountStructure === "recurring" ? period : undefined,
      lumpSumDate: amountStructure === "lump_sum" && lumpSumDate ? lumpSumDate.toISOString() : undefined,
      merge,
    });
    onOpenChange(false);
  };

  const PillGroup = ({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) => (
    <div className="flex gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
            value === opt.value
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-secondary/50 text-muted-foreground border-border hover:bg-secondary"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">{initial ? "Edit Goal" : "New Goal"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={handleNameBlur} placeholder="e.g. Q2 Revenue Target" />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description (optional)" className="min-h-[60px]" />
          </div>

          {/* Goal Type */}
          <div className="space-y-1.5">
            <Label className="text-xs">Goal Type</Label>
            <PillGroup
              value={goalType}
              options={[
                { value: "expenditure", label: "Expenditure" },
                { value: "revenue", label: "Revenue" },
              ]}
              onChange={(v) => setGoalType(v as any)}
            />
          </div>

          {/* Amount Structure */}
          {goalType && (
            <div className="space-y-1.5">
              <Label className="text-xs">Amount Structure</Label>
              <PillGroup
                value={amountStructure}
                options={[
                  { value: "lump_sum", label: "Lump Sum" },
                  { value: "recurring", label: "Recurring" },
                ]}
                onChange={(v) => setAmountStructure(v as any)}
              />
            </div>
          )}

          {/* Lump Sum fields */}
          {amountStructure === "lump_sum" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Total Amount</Label>
                <Input type="number" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="$0" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left text-xs font-normal", !lumpSumDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {lumpSumDate ? format(lumpSumDate, "PPP") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={lumpSumDate} onSelect={setLumpSumDate} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </>
          )}

          {/* Recurring fields */}
          {amountStructure === "recurring" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Total Amount</Label>
                <Input type="number" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="$0" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Period</Label>
                <PillGroup
                  value={period}
                  options={[
                    { value: "weekly", label: "Weekly" },
                    { value: "monthly", label: "Monthly" },
                    { value: "yearly", label: "Yearly" },
                  ]}
                  onChange={(v) => setPeriod(v as any)}
                />
              </div>
              {periodCalc && (
                <p className="text-[11px] text-muted-foreground font-mono">
                  ≈ {fmtCurrency(periodCalc.weekly)}/wk · {fmtCurrency(periodCalc.monthly)}/mo · {fmtCurrency(periodCalc.yearly)}/yr
                </p>
              )}
            </>
          )}

          {/* Category */}
          {goalType && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs">Category</Label>
                {categorySuggested && (
                  <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 bg-primary/10 text-primary border-primary/20">
                    suggested
                  </Badge>
                )}
              </div>
              <Select value={category} onValueChange={(v) => { setCategory(v); setCategorySuggested(false); }}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Date range */}
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

          {/* Merge toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Merge with Business Data</Label>
              <Switch checked={merge} onCheckedChange={setMerge} />
            </div>
            {merge && (
              <div className="flex gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/15">
                <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  This goal will be reflected in cashflow and revenue charts.{" "}
                  {goalType === "expenditure" ? "Expenditure goals reduce cashflow." : "Revenue goals increase projected income."}
                </p>
              </div>
            )}
          </div>

          <Button onClick={handleSubmit} className="w-full" disabled={!name || !totalAmount || !goalType}>
            {initial ? "Save Changes" : "Add Goal"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
