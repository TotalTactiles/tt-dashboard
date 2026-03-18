import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import NoData from "./NoData";

const SERIES = [
  { key: "totalOutgoings", label: "Total Outgoings", color: "hsl(0, 70%, 55%)", dash: undefined },
  { key: "anticipatedSurplus", label: "Anticipated Cash Surplus/(Deficit)", color: "hsl(145, 55%, 55%)", dash: undefined },
  { key: "probableJobs", label: "Jobs Probable To Be Won", color: "hsl(45, 90%, 55%)", dash: "5 5" },
  { key: "costOfJobsProbable", label: "Cost of Jobs Probable To Be Won", color: "hsl(0, 55%, 70%)", dash: "5 5" },
  { key: "surplusIncludingProbable", label: "Anticipated Cash Surplus/(Deficit) Including Probable Jobs", color: "hsl(145, 63%, 32%)", dash: "5 5" },
] as const;

const ForecastChart = () => {
  const { forecastChartData, dataHealth } = useDashboardData();

  // Only show series that have at least one non-zero value
  const activeSeries = SERIES.filter((s) => {
    return forecastChartData.some((d) => (d as any)[s.key] !== 0);
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.7 }}
      className="chart-container"
    >
      <h3 className="text-sm font-medium text-muted-foreground mb-1">Forecasts</h3>
      <p className="text-xs text-muted-foreground font-mono mb-4">Forward-looking forecast from cashflow model</p>
      {forecastChartData.length === 0 ? (
        <NoData message="No forecast data" healthStatus={dataHealth.cashflow.status} />
      ) : (
        <>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-4">
            {activeSeries.map((s) => (
              <div key={s.key} className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                <span
                  className="w-4 h-0.5 rounded"
                  style={{
                    backgroundColor: s.color,
                    ...(s.dash ? { backgroundImage: `repeating-linear-gradient(90deg, ${s.color} 0 3px, transparent 3px 6px)`, backgroundColor: "transparent" } : {}),
                  }}
                />
                {s.label}
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={260} minHeight={200}>
            <LineChart data={forecastChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
              <XAxis dataKey="month" stroke="hsl(215, 12%, 50%)" fontSize={11} fontFamily="JetBrains Mono" />
              <YAxis stroke="hsl(215, 12%, 50%)" fontSize={11} fontFamily="JetBrains Mono" tickFormatter={(v) => {
                const abs = Math.abs(v);
                const label = abs >= 1000 ? `$${(abs / 1000).toFixed(0)}K` : `$${abs}`;
                return v < 0 ? `-${label}` : label;
              }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(220, 18%, 10%)",
                  border: "1px solid hsl(220, 14%, 18%)",
                  borderRadius: "8px",
                  fontFamily: "JetBrains Mono",
                  fontSize: "11px",
                  maxWidth: "320px",
                }}
                formatter={(value: number, name: string) => {
                  const series = activeSeries.find((s) => s.key === name);
                  return [`$${value.toLocaleString()}`, series?.label || name];
                }}
              />
              {activeSeries.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stroke={s.color}
                  strokeWidth={2}
                  strokeDasharray={s.dash}
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
