import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import NoData from "./NoData";

const FundPerformanceChart = () => {
  const { profitMarginData, dataHealth } = useDashboardData();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.6 }}
      className="chart-container"
    >
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Gross Profit Margin (%)</h3>
      {profitMarginData.length === 0 ? (
        <NoData message="No profit margin data" healthStatus={dataHealth.cashflow.status} />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={profitMarginData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
              <XAxis dataKey="month" stroke="hsl(215, 12%, 50%)" fontSize={11} fontFamily="JetBrains Mono" />
              <YAxis stroke="hsl(215, 12%, 50%)" fontSize={11} fontFamily="JetBrains Mono" tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(220, 18%, 10%)",
                  border: "1px solid hsl(220, 14%, 18%)",
                  borderRadius: "8px",
                  fontFamily: "JetBrains Mono",
                  fontSize: "12px",
                }}
                formatter={(value: number) => [`${value}%`, "Gross Margin"]}
              />
              <ReferenceLine y={30} stroke="hsl(38, 92%, 55%)" strokeDasharray="5 5" label={{ value: "Target 30%", position: "right", fill: "hsl(38, 92%, 55%)", fontSize: 10, fontFamily: "JetBrains Mono" }} />
              <Line type="monotone" dataKey="grossMargin" stroke="hsl(160, 70%, 45%)" strokeWidth={2} dot={{ r: 3, fill: "hsl(160, 70%, 45%)" }} animationDuration={2000} />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-3 text-xs font-mono">
            <div className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-chart-green rounded" /> Gross Margin</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-chart-amber rounded" style={{ borderTop: "1px dashed" }} /> Target 30%</div>
          </div>
        </>
      )}
    </motion.div>
  );
};

export default FundPerformanceChart;
