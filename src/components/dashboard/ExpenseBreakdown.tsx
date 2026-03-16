import { useState } from "react";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import NoData from "./NoData";

type Period = "weekly" | "monthly" | "yearly";

const PERIOD_LABELS: Record<Period, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

const PIE_COLORS = [
  "hsl(160, 70%, 45%)",
  "hsl(200, 80%, 50%)",
  "hsl(270, 60%, 55%)",
  "hsl(38, 92%, 55%)",
  "hsl(340, 65%, 50%)",
  "hsl(30, 60%, 50%)",
  "hsl(120, 50%, 40%)",
  "hsl(190, 60%, 45%)",
];

function getCostByPeriod(item: { weeklyCost: number; monthlyCost: number; yearlyCost: number }, period: Period) {
  if (period === "weekly") return item.weeklyCost;
  if (period === "yearly") return item.yearlyCost;
  return item.monthlyCost;
}

const ExpenseBreakdown = () => {
  const { expenseCategories, grandTotalExpense, dataHealth } = useDashboardData();
  const [period, setPeriod] = useState<Period>("monthly");

  const allItems = expenseCategories.flatMap((c) => c.items);
  const pieData = allItems.map((item, i) => ({
    name: item.name,
    value: getCostByPeriod(item, period),
    fill: PIE_COLORS[i % PIE_COLORS.length],
  }));
  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);

  const periodSuffix = period === "weekly" ? "/wk" : period === "yearly" ? "/yr" : "/mo";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.8 }}
      className="chart-container col-span-full"
    >
      {/* Header with toggle */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-medium text-muted-foreground">Business Expenses</h3>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary/30 p-0.5">
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
      </div>

      {expenseCategories.length === 0 ? (
        <NoData message="No expense data" healthStatus={dataHealth.expenses.status} />
      ) : (
        <>
          {/* Category groups */}
          {expenseCategories.map((cat, ci) => (
            <div key={cat.category} className="mb-6">
              <h4 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">
                {cat.category}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                {cat.items.map((item, ii) => (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9 + ci * 0.1 + ii * 0.05 }}
                    className="rounded-lg border border-border p-4 bg-secondary/20"
                  >
                    <p className="text-xs font-mono text-muted-foreground mb-2">{item.name}</p>
                    <p className="text-lg font-mono font-bold text-foreground">
                      ${getCostByPeriod(item, period).toLocaleString()}
                      <span className="text-xs text-muted-foreground">{periodSuffix}</span>
                    </p>
                    {period !== "yearly" && (
                      <p className="text-xs font-mono text-muted-foreground mt-1">
                        ${item.yearlyCost.toLocaleString()}/yr
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          ))}

          {/* Pie Chart */}
          <div className="mt-6 mb-6">
            <h4 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">
              Proportional Spend ({PERIOD_LABELS[period]})
            </h4>
            <div className="flex flex-col lg:flex-row items-center gap-6">
              <ResponsiveContainer width="100%" height={220} className="max-w-[300px]">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    animationBegin={300}
                    animationDuration={800}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const { name, value, fill } = payload[0].payload;
                      const pct = pieTotal > 0 ? ((value / pieTotal) * 100).toFixed(1) : "0";
                      return (
                        <div style={{ background: '#fff', borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#111', marginBottom: 2 }}>{name}</div>
                          <div style={{ fontWeight: 600, fontSize: 15, color: fill }}>${value.toLocaleString()}{periodSuffix}</div>
                          <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{pct}% of total</div>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3">
                {pieData.map((s) => (
                  <div key={s.name} className="flex items-center gap-1.5 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.fill }} />
                    <span className="text-muted-foreground">{s.name}</span>
                    <span className="font-mono text-foreground">
                      {pieTotal > 0 ? ((s.value / pieTotal) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Grand Total Summary Strip */}
          {grandTotalExpense && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 flex flex-wrap items-center justify-between gap-4"
            >
              <span className="text-sm font-mono font-semibold text-destructive-foreground">
                GRAND TOTAL
              </span>
              <div className="flex gap-6">
                <div className="text-center">
                  <p className="text-[10px] font-mono text-muted-foreground uppercase">Weekly</p>
                  <p className={`text-sm font-mono font-bold ${period === "weekly" ? "text-foreground" : "text-muted-foreground"}`}>
                    ${grandTotalExpense.weeklyCost.toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-mono text-muted-foreground uppercase">Monthly</p>
                  <p className={`text-sm font-mono font-bold ${period === "monthly" ? "text-foreground" : "text-muted-foreground"}`}>
                    ${grandTotalExpense.monthlyCost.toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-mono text-muted-foreground uppercase">Yearly</p>
                  <p className={`text-sm font-mono font-bold ${period === "yearly" ? "text-foreground" : "text-muted-foreground"}`}>
                    ${grandTotalExpense.yearlyCost.toLocaleString()}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  );
};

export default ExpenseBreakdown;
