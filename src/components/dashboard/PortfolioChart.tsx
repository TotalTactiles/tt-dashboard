import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { portfolioData } from "@/data/mockData";

const PortfolioChart = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="chart-container col-span-2"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Portfolio NAV</h3>
          <p className="text-xl font-mono font-bold text-foreground">$4.3B</p>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="w-3 h-0.5 bg-chart-green rounded" />
            <span className="text-muted-foreground">Fund</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-0.5 bg-chart-blue rounded" />
            <span className="text-muted-foreground">Benchmark</span>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={portfolioData}>
          <defs>
            <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(160, 70%, 45%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(160, 70%, 45%)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(200, 80%, 50%)" stopOpacity={0.15} />
              <stop offset="95%" stopColor="hsl(200, 80%, 50%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
          <XAxis dataKey="month" stroke="hsl(215, 12%, 50%)" fontSize={11} fontFamily="JetBrains Mono" />
          <YAxis stroke="hsl(215, 12%, 50%)" fontSize={11} fontFamily="JetBrains Mono" tickFormatter={(v) => `$${v}B`} />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(220, 18%, 10%)",
              border: "1px solid hsl(220, 14%, 18%)",
              borderRadius: "8px",
              fontFamily: "JetBrains Mono",
              fontSize: "12px",
            }}
          />
          <Area type="monotone" dataKey="value" stroke="hsl(160, 70%, 45%)" fill="url(#greenGrad)" strokeWidth={2} />
          <Area type="monotone" dataKey="benchmark" stroke="hsl(200, 80%, 50%)" fill="url(#blueGrad)" strokeWidth={1.5} strokeDasharray="4 4" />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
};

export default PortfolioChart;
