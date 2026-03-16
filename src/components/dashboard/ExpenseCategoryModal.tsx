import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Period = "weekly" | "monthly" | "yearly";

const PERIOD_LABELS: Record<Period, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

interface LineItem {
  name: string;
  weekly: number;
  monthly: number;
  yearly: number;
}

const HARDCODED_LINE_ITEMS: Record<string, Record<string, LineItem[]>> = {
  "Business Expenses": {
    Essentials: [
      { name: "Website", weekly: 7.5, monthly: 30, yearly: 360 },
      { name: "Business Gmail & Drive", weekly: 3.13, monthly: 12.5, yearly: 150 },
      { name: "Zoho CRM", weekly: 8.25, monthly: 33, yearly: 396 },
      { name: "Zoho Projects", weekly: 3.75, monthly: 15, yearly: 180 },
      { name: "Zapier", weekly: 13.75, monthly: 55, yearly: 660 },
      { name: "ChatGPT", weekly: 7.75, monthly: 31, yearly: 372 },
      { name: "Voipline", weekly: 11.13, monthly: 44.5, yearly: 534 },
      { name: "NRMA Public Liability Insurance", weekly: 47.5, monthly: 190, yearly: 2280 },
      { name: "Icare Workers Comp", weekly: 500, monthly: 2000, yearly: 24000 },
      { name: "Xero", weekly: 25, monthly: 100, yearly: 1200 },
      { name: "Small PDF", weekly: 5.5, monthly: 22, yearly: 264 },
      { name: "Google Ads", weekly: 112.5, monthly: 450, yearly: 5400 },
      { name: "Accountants", weekly: 275, monthly: 1100, yearly: 13200 },
    ],
    "Office & Misc": [
      { name: "Rent", weekly: 337.21, monthly: 1450, yearly: 17400 },
      { name: "Motor Vehicle Expenses (Finance)", weekly: 2000, monthly: 8000, yearly: 96000 },
      { name: "Petrol (Petrol Card)", weekly: 150, monthly: 600, yearly: 7200 },
      { name: "Loan Repayment", weekly: 1057.31, monthly: 4229.24, yearly: 50750.88 },
    ],
    "Shared Expenses": [
      { name: "Phone", weekly: 81.4, monthly: 350, yearly: 4200 },
      { name: "Gym", weekly: 50, monthly: 215, yearly: 2580 },
      { name: "Entertainment", weekly: 500, monthly: 2150, yearly: 25800 },
    ],
  },
  "Personal Expenses": {
    Krishan: [
      { name: "Wages", weekly: 2500, monthly: 10000, yearly: 120000 },
    ],
    Mehmet: [
      { name: "Wages", weekly: 2500, monthly: 10000, yearly: 120000 },
    ],
    "Shared Expenses": [
      { name: "Food/Meal Preps", weekly: 200, monthly: 860, yearly: 10320 },
    ],
  },
};

// Map category group names to source tags
const CATEGORY_SOURCE_MAP: Record<string, string> = {
  Essentials: "Business Expenses",
  "Office & Misc": "Business Expenses",
  "Shared Expenses": "Business Expenses", // default; could also be Personal
  Krishan: "Personal Expenses",
  Mehmet: "Personal Expenses",
};

function resolveLineItems(categoryGroup: string, cardName: string): { items: LineItem[]; sourceTag: string } {
  // Try Business Expenses first
  const bizItems = HARDCODED_LINE_ITEMS["Business Expenses"]?.[cardName];
  if (bizItems) return { items: bizItems, sourceTag: "Business Expenses" };
  const persItems = HARDCODED_LINE_ITEMS["Personal Expenses"]?.[cardName];
  if (persItems) return { items: persItems, sourceTag: "Personal Expenses" };
  // Fallback: check if categoryGroup itself is a key
  for (const [source, groups] of Object.entries(HARDCODED_LINE_ITEMS)) {
    if (groups[categoryGroup]) return { items: groups[categoryGroup], sourceTag: source };
  }
  return { items: [], sourceTag: categoryGroup };
}

function getVal(item: LineItem, period: Period): number {
  return period === "weekly" ? item.weekly : period === "yearly" ? item.yearly : item.monthly;
}

function fmtCurrency(v: number): string {
  return `$${v.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface ExpenseCategoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardName: string;
  categoryGroup: string;
  activePeriod: Period;
}

export default function ExpenseCategoryModal({
  open,
  onOpenChange,
  cardName,
  categoryGroup,
  activePeriod,
}: ExpenseCategoryModalProps) {
  const [period, setPeriod] = useState<Period>(activePeriod);
  const { items, sourceTag } = resolveLineItems(categoryGroup, cardName);

  const subtotal = items.reduce((s, i) => s + getVal(i, period), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px] p-0 border-border bg-card rounded-2xl overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-5 pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1.5">
              <DialogTitle className="text-lg font-bold text-foreground">{cardName}</DialogTitle>
              <Badge variant="outline" className="text-[10px] border-border text-muted-foreground font-mono">
                {sourceTag}
              </Badge>
            </div>
          </div>
          {/* Period toggle */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary/30 p-0.5 mt-3 w-fit">
            {(["weekly", "monthly", "yearly"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-xs font-mono rounded-md transition-colors ${
                  period === p
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </DialogHeader>

        {/* Line items table */}
        <div className="px-5 pb-2">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No line items available for this category.</p>
          ) : (
            <div className="space-y-0">
              {items.map((item) => (
                <div key={item.name} className="flex items-center justify-between py-2 border-b border-border/50 last:border-b-0">
                  <span className="text-sm text-foreground">{item.name}</span>
                  <span className="text-sm font-mono text-foreground">{fmtCurrency(getVal(item, period))}</span>
                </div>
              ))}
              {/* Subtotal */}
              <div className="flex items-center justify-between py-3 border-t-2 border-border mt-1">
                <span className="text-sm font-bold text-foreground">SUBTOTAL</span>
                <span className="text-sm font-mono font-bold text-foreground">{fmtCurrency(subtotal)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer strip — all periods */}
        <div className="flex items-center justify-between px-5 py-3 bg-destructive/10 border-t border-destructive/30">
          <div className="flex gap-4">
            <div className="text-center">
              <p className="text-[9px] font-mono text-muted-foreground uppercase">Weekly</p>
              <p className={`text-xs font-mono font-bold ${period === "weekly" ? "text-foreground" : "text-muted-foreground"}`}>
                {fmtCurrency(items.reduce((s, i) => s + i.weekly, 0))}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[9px] font-mono text-muted-foreground uppercase">Monthly</p>
              <p className={`text-xs font-mono font-bold ${period === "monthly" ? "text-foreground" : "text-muted-foreground"}`}>
                {fmtCurrency(items.reduce((s, i) => s + i.monthly, 0))}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[9px] font-mono text-muted-foreground uppercase">Yearly</p>
              <p className={`text-xs font-mono font-bold ${period === "yearly" ? "text-foreground" : "text-muted-foreground"}`}>
                {fmtCurrency(items.reduce((s, i) => s + i.yearly, 0))}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
