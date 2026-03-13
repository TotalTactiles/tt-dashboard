import { motion } from "framer-motion";
import { BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart } from "recharts";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import NoData from "./NoData";

const PortfolioChart = () => {
  const { incomeOutgoingsData, dataHealth } = useDashboardData();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="chart-container col-span-2"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Income vs Outgoings</h3>
          <p className="text-xl font-mono font-bold text-foreground">Monthly Cash Flow</p>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-chart-blue" />
            <span className="text-muted-foreground">Income</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-chart-red" />
            <span className="text-muted-foreground">Outgoings</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-0.5 rounded bg-chart-green" />
            <span className="text-muted-foreground">Surplus</span>
          </div>
        </div>
      </div>
      {incomeOutgoingsData.length === 0 ? (
        <NoData message="No cashflow data" healthStatus={dataHealth.cashflow.status} />
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={incomeOutgoingsData} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
            <XAxis dataKey="month" stroke="hsl(215, 12%, 50%)" fontSize={11} fontFamily="JetBrains Mono" />
            <YAxis stroke="hsl(215, 12%, 50%)" fontSize={11} fontFamily="JetBrains Mono" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(220, 18%, 10%)",
                border: "1px solid hsl(220, 14%, 18%)",
                borderRadius: "8px",
                fontFamily: "JetBrains Mono",
                fontSize: "12px",
              }}
              formatter={(value: number, name: string) => {
                const labels: Record<string, string> = { income: "Income", outgoings: "Outgoings", surplus: "Surplus/(Deficit)" };
                return [`$${value.toLocaleString()}`, labels[name] || name];
              }}
            />
            <Bar dataKey="income" fill="hsl(200, 80%, 50%)" radius={[3, 3, 0, 0]} animationDuration={1500} />
            <Bar dataKey="outgoings" fill="hsl(0, 72%, 55%)" radius={[3, 3, 0, 0]} animationDuration={1500} />
            <Line type="monotone" dataKey="surplus" stroke="hsl(160, 70%, 45%)" strokeWidth={2} dot={{ r: 3, fill: "hsl(160, 70%, 45%)" }} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </motion.div>
  );
};

export default PortfolioChart;
