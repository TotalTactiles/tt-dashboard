import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import NoData from "./NoData";

const SERIES = [
  { key: "totalOutgoings", label: "Total Outgoings", color: "hsl(0, 70%, 55%)" },
  { key: "anticipatedSurplus", label: "Anticipated Cash Surplus/(Deficit)", color: "hsl(160, 70%, 45%)" },
  { key: "costProbableJobs", label: "Cost of Jobs Probable To Be Won", color: "hsl(30, 85%, 55%)" },
  { key: "probableJobs", label: "Jobs Probable To Be Won", color: "hsl(210, 75%, 55%)" },
  { key: "surplusIncludingProbable", label: "Surplus Including Probable Jobs", color: "hsl(45, 90%, 55%)" },
] as const;

const ForecastChart = () => {
  const { forecastChartData, dataHealth } = useDashboardData();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.7 }}
      className="chart-container"
    >
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Forecasts</h3>
      {forecastChartData.length === 0 ? (
        <NoData message="No forecast data" healthStatus={dataHealth.cashflow.status} />
      ) : (
        <>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-4">
            {SERIES.map((s) => (
              <div key={s.key} className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                <span className="w-3 h-0.5 rounded" style={{ backgroundColor: s.color }} />
                {s.label}
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={forecastChartData}>
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
                  const series = SERIES.find((s) => s.key === name);
                  return [`$${value.toLocaleString()}`, series?.label || name];
                }}
              />
              {SERIES.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={{ r: 2, fill: s.color }}
                  animationDuration={2000}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </motion.div>
  );
};

export default ForecastChart;
