import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { ExpenseGroup, ExpenseGroupItem } from "@/contexts/DashboardDataContext";

type Period = "weekly" | "monthly" | "yearly";

const suffix = (p: Period) => (p === "weekly" ? "/wk" : p === "yearly" ? "/yr" : "/mo");
const itemCost = (i: ExpenseGroupItem, p: Period) =>
  p === "weekly" ? i.weeklyCost : p === "yearly" ? i.yearlyCost : i.monthlyCost;
const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;

export default function ExpenseGroupAccordion({
  groups,
  period,
  excludedKeys,
  onToggle,
}: {
  groups: ExpenseGroup[];
  period: Period;
  excludedKeys: Set<string>;
  onToggle: (key: string) => void;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (t: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  const xKey = (g: string, n: string) => `${g}::${n}`;
  const isIncluded = (g: string, n: string) => !excludedKeys.has(xKey(g, n));
  const groupTotalSel = (g: ExpenseGroup, p: Period) =>
    g.items.filter((i) => isIncluded(g.title, i.name)).reduce((s, i) => s + itemCost(i, p), 0);
  const includedCount = (g: ExpenseGroup) => g.items.filter((i) => isIncluded(g.title, i.name)).length;
  const grandTotal = (p: Period) => groups.reduce((s, g) => s + groupTotalSel(g, p), 0);

  return (
    <div>
      <div className="space-y-3">
        {groups.map((g) => {
          const isOpen = open.has(g.title);
          return (
            <div
              key={g.title}
              className="rounded-lg border border-border bg-secondary/20 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggle(g.title)}
                className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-secondary/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? "" : "-rotate-90"}`}
                  />
                  <span className="text-sm font-mono font-semibold text-foreground uppercase tracking-wider">
                    {g.title}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                    {includedCount(g)}/{g.items.length}
                  </span>
                </div>
                <div className="text-base font-mono font-bold text-foreground shrink-0">
                  {fmt(groupTotalSel(g, period))}
                  <span className="text-xs text-muted-foreground">{suffix(period)}</span>
                </div>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-1 border-t border-border space-y-2">
                      <p className="text-[10px] font-mono text-muted-foreground italic">
                        tick to include in totals — saved on this browser
                      </p>

                      {g.items.map((item) => {
                        const included = isIncluded(g.title, item.name);
                        return (
                          <div
                            key={item.name}
                            className="flex items-center justify-between gap-3 py-2 border-b border-border/40 last:border-0"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <input
                                type="checkbox"
                                checked={included}
                                onChange={() => onToggle(xKey(g.title, item.name))}
                                className="h-4 w-4 shrink-0 accent-primary cursor-pointer"
                              />
                              <div className="flex-1 min-w-0">
                                <p
                                  className={`text-xs font-mono truncate ${
                                    included ? "text-muted-foreground" : "text-muted-foreground/50 line-through"
                                  }`}
                                >
                                  {item.name}
                                </p>
                                <p className="text-sm font-mono font-bold text-foreground">
                                  {fmt(itemCost(item, period))}
                                  <span className="text-[10px] text-muted-foreground">{suffix(period)}</span>
                                </p>
                              </div>
                            </div>

                            {period !== "yearly" && (
                              <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                                {fmt(item.yearlyCost)}/yr
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* TOTAL footer */}
      <div className="mt-3 md:mt-4 rounded-xl border border-primary/40 bg-secondary/40 p-4 flex items-center justify-between gap-3">
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-mono uppercase tracking-wider text-foreground">Total</span>
          <span className="text-[10px] font-mono text-muted-foreground/70">
            selected line items, live from CASHFLOW
          </span>
        </div>
        <span className="font-mono font-bold text-lg text-foreground whitespace-nowrap">
          {fmt(grandTotal(period))}
          <span className="text-[10px] text-muted-foreground">{suffix(period)}</span>
        </span>
      </div>
    </div>
  );
}
