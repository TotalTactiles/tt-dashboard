import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { cashflowData } from "@/data/mockData";

const CashflowChart = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className="chart-container"
    >
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Cash Flow (Capital Calls vs Distributions)</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={cashflowData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
          <XAxis dataKey="month" stroke="hsl(215, 12%, 50%)" fontSize={11} fontFamily="JetBrains Mono" />
          <YAxis stroke="hsl(215, 12%, 50%)" fontSize={11} fontFamily="JetBrains Mono" tickFormatter={(v) => `$${Math.abs(v)}M`} />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(220, 18%, 10%)",
              border: "1px solid hsl(220, 14%, 18%)",
              borderRadius: "8px",
              fontFamily: "JetBrains Mono",
              fontSize: "12px",
            }}
            formatter={(value: number) => [`$${Math.abs(value)}M`, value >= 0 ? "Inflow" : "Outflow"]}
          />
          <ReferenceLine y={0} stroke="hsl(220, 14%, 22%)" />
          <Bar dataKey="inflow" fill="hsl(160, 70%, 45%)" radius={[3, 3, 0, 0]} animationDuration={1500} />
          <Bar dataKey="outflow" fill="hsl(0, 72%, 55%)" radius={[0, 0, 3, 3]} animationDuration={1500} />
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
};

export default CashflowChart;
