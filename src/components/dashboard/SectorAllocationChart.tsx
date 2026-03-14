import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import NoData from "./NoData";

const SectorAllocationChart = () => {
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
                    <div style={{ background: '#fff', borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', minWidth: 140 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#111', marginBottom: 2 }}>{name}</div>
                      <div style={{ fontWeight: 600, fontSize: 15, color: fill }}>${value.toLocaleString()}/yr</div>
                      {pct && <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{pct}% of total</div>}
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
};

export default SectorAllocationChart;
