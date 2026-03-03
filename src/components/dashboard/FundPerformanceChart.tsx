import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { profitabilityData } from "@/data/mockData";

const FundPerformanceChart = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.6 }}
      className="chart-container"
    >
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Profitability Margins (%)</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={profitabilityData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
          <XAxis dataKey="month" stroke="hsl(215, 12%, 50%)" fontSize={11} fontFamily="JetBrains Mono" />
          <YAxis stroke="hsl(215, 12%, 50%)" fontSize={11} fontFamily="JetBrains Mono" tickFormatter={(v) => `${v}%`} />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(220, 18%, 10%)",
              border: "1px solid hsl(220, 14%, 18%)",
              borderRadius: "8px",
              fontFamily: "JetBrains Mono",
              fontSize: "12px",
            }}
            formatter={(value: number) => [`${value}%`, ""]}
          />
          <Line type="monotone" dataKey="gross" stroke="hsl(160, 70%, 45%)" strokeWidth={2} dot={false} animationDuration={2000} />
          <Line type="monotone" dataKey="ebitda" stroke="hsl(200, 80%, 50%)" strokeWidth={2} dot={false} animationDuration={2000} />
          <Line type="monotone" dataKey="net" stroke="hsl(38, 92%, 55%)" strokeWidth={2} dot={false} animationDuration={2000} />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-3 text-xs font-mono">
        <div className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-chart-green rounded" /> Gross</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-chart-blue rounded" /> EBITDA</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-chart-amber rounded" /> Net</div>
      </div>
    </motion.div>
  );
};

export default FundPerformanceChart;
