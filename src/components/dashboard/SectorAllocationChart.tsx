import React from "react";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import NoData from "./NoData";

type Slice = { name: string; value: number; fill: string };
const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;

const SectorAllocationChart = React.memo(({ sections }: { sections?: Slice[] }) => {
  const { expenseAllocation, dataHealth } = useDashboardData();
  const data: Slice[] = sections && sections.length > 0 ? sections : (expenseAllocation as Slice[]);
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="chart-container h-full flex flex-col"
    >
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Expense Breakdown by Category</h3>
      {data.length === 0 ? (
        <NoData message="No expense data" healthStatus={dataHealth.expenses.status} />
      ) : (
        <div className="flex-1 flex flex-col justify-center">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
                animationBegin={500}
                animationDuration={1200}
              >
                {data.map((entry, i) => (
                  <Cell key={`cell-${i}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const e = payload[0].payload as Slice;
                  const pct = total > 0 ? ((e.value / total) * 100).toFixed(1) : "";
                  return (
                    <div className="bg-popover border border-border rounded-lg shadow-lg p-2.5 min-w-[140px]">
                      <div className="font-bold text-[13px] text-foreground mb-0.5">{e.name}</div>
                      <div className="font-semibold text-[15px]" style={{ color: e.fill }}>
                        {fmt(e.value)}/mo
                      </div>
                      {pct && <div className="text-[12px] text-muted-foreground mt-0.5">{pct}% of total</div>}
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-2">
            {data.map((s) => (
              <div key={s.name} className="flex items-center gap-1.5 text-xs">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.fill }} />
                <span className="text-muted-foreground">{s.name}</span>
                <span className="font-mono text-foreground">{fmt(s.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
});

SectorAllocationChart.displayName = "SectorAllocationChart";
export default SectorAllocationChart;
