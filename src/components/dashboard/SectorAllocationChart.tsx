import React from "react";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import NoData from "./NoData";

const SectorAllocationChart = React.memo(() => {
  const { expenseAllocation, dataHealth } = useDashboardData();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="chart-container"
    >
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Expense Breakdown by Category</h3>
      {expenseAllocation.length === 0 ? (
        <NoData message="No expense data" healthStatus={dataHealth.expenses.status} />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={expenseAllocation}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
                animationBegin={500}
                animationDuration={1200}
              >
                {expenseAllocation.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const entry = payload[0].payload;
                  const { name, value, fill } = entry;
                  const total = expenseAllocation.reduce((s, e) => s + e.value, 0);
                  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "";
                  return (
                    <div className="bg-popover border border-border rounded-lg shadow-lg" style={{ padding: '10px 14px', minWidth: 140 }}>
                      <div className="font-bold text-[13px] text-foreground mb-0.5">{name}</div>
                      <div className="font-semibold text-[15px]" style={{ color: fill }}>${value.toLocaleString()}/yr</div>
                      {pct && <div className="text-[12px] text-muted-foreground mt-0.5">{pct}% of total</div>}
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-2">
            {expenseAllocation.map((s) => (
              <div key={s.name} className="flex items-center gap-1.5 text-xs">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.fill }} />
                <span className="text-muted-foreground">{s.name}</span>
                <span className="font-mono text-foreground">${s.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </motion.div>
  );
});

SectorAllocationChart.displayName = "SectorAllocationChart";

export default SectorAllocationChart;
