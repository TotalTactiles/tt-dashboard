import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { LineChart, Line, YAxis, ResponsiveContainer } from "recharts";
import type { ExpenseGroup, ExpenseGroupItem } from "@/contexts/DashboardDataContext";

type Period = "weekly" | "monthly" | "yearly";

const suffix = (p: Period) => (p === "weekly" ? "/wk" : p === "yearly" ? "/yr" : "/mo");
const itemCost = (i: ExpenseGroupItem, p: Period) =>
  p === "weekly" ? i.weeklyCost : p === "yearly" ? i.yearlyCost : i.monthlyCost;
const groupTotal = (g: ExpenseGroup, p: Period) =>
  p === "weekly" ? g.totalWeekly : p === "yearly" ? g.totalYearly : g.totalMonthly;
const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;

export default function ExpenseGroupAccordion({
  groups,
  period,
}: {
  groups: ExpenseGroup[];
  period: Period;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (t: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  const recurringTotal = (p: Period) =>
    groups.filter((g) => !g.tracked).reduce((s, g) => s + groupTotal(g, p), 0);
  const trackedTotal = (p: Period) =>
    groups.filter((g) => g.tracked).reduce((s, g) => s + groupTotal(g, p), 0);

  return (
    <div>
      <div className="space-y-3">
      {groups.map((g) => {
        const isOpen = open.has(g.title);
        return (
          <div key={g.title} className="rounded-lg border border-border bg-secondary/20 overflow-hidden">
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
                  {g.items.length}
                </span>
              </div>
              <div className="text-base font-mono font-bold text-foreground shrink-0">
                {fmt(groupTotal(g, period))}
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
                    {g.tracked && (
                      <p className="text-[10px] font-mono text-muted-foreground italic">
                        latest actuals — tax items are intermittent, not a fixed monthly cost
                      </p>
                    )}
                    {g.items.map((item) => (
                      <div
                        key={item.name}
                        className="flex items-center justify-between gap-3 py-2 border-b border-border/40 last:border-0"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono text-muted-foreground">{item.name}</p>
                          <p className="text-sm font-mono font-bold text-foreground">
                            {fmt(itemCost(item, period))}
                            <span className="text-[10px] text-muted-foreground">{suffix(period)}</span>
                          </p>
                        </div>
                        {item.tracked ? (
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[10px] font-mono text-muted-foreground">
                              avg {fmt(item.avgMonthly ?? 0)}/mo
                            </span>
                            {item.series && item.series.length > 0 && (
                              <div className="w-24 h-8">
                                <ResponsiveContainer width="100%" height={32}>
                                  <LineChart data={item.series}>
                                    <YAxis hide domain={[0, "dataMax"]} />
                                    <Line
                                      type="monotone"
                                      dataKey="value"
                                      stroke="#F59E0B"
                                      strokeWidth={1.5}
                                      dot={false}
                                      isAnimationActive={false}
                                    />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            )}
                          </div>
                        ) : (
                          period !== "yearly" && (
                            <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                              {fmt(item.yearlyCost)}/yr
                            </span>
                          )
                        )}
                      </div>
                    ))}
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
          {trackedTotal("monthly") > 0 && (
            <span className="text-[10px] font-mono text-muted-foreground/70">
              + {fmt(trackedTotal(period))}{suffix(period)} tax &amp; obligations (tracked separately)
            </span>
          )}
        </div>
        <span className="font-mono font-bold text-lg text-foreground whitespace-nowrap">
          {fmt(recurringTotal(period))}
          <span className="text-[10px] text-muted-foreground">{suffix(period)}</span>
        </span>
      </div>
    </div>
  );
}
