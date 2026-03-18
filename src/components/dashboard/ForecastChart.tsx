import { useState } from "react";
import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import NoData from "./NoData";

const SERIES = [
  { key: "totalOutgoings", label: "Total Outgoings", color: "hsl(0, 70%, 55%)", dash: undefined, strokeWidth: 2.5 },
  { key: "anticipatedSurplus", label: "Anticipated Cash Surplus/(Deficit)", color: "hsl(145, 65%, 55%)", dash: undefined, strokeWidth: 2.5 },
  { key: "probableJobs", label: "Jobs Probable To Be Won", color: "hsl(45, 90%, 55%)", dash: "8 4", strokeWidth: 2 },
  { key: "costOfJobsProbable", label: "Cost of Jobs Probable To Be Won", color: "hsl(15, 70%, 65%)", dash: "4 4", strokeWidth: 2 },
  { key: "surplusIncludingProbable", label: "Anticipated Cash Surplus/(Deficit) Including Probable Jobs", color: "hsl(145, 55%, 35%)", dash: "10 3", strokeWidth: 2.5 },
] as const;

const ForecastChart = () => {
  const { forecastChartData, dataHealth } = useDashboardData();
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(() => new Set(SERIES.map(s => s.key)));

  const toggleSeries = (key: string) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        // Don't allow hiding all series
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Series that have data
  const activeSeries = SERIES.filter((s) =>
    forecastChartData.some((d) => (d as any)[s.key] !== 0)
  );

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
          <div className="flex flex-wrap gap-x-1.5 gap-y-1.5 mb-4">
            {activeSeries.map((s) => {
              const isVisible = visibleKeys.has(s.key);
              return (
                <button
                  key={s.key}
                  onClick={() => toggleSeries(s.key)}
                  className={`flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded-md border transition-all select-none ${
                    isVisible
                      ? "border-border bg-secondary/60 text-foreground"
                      : "border-transparent bg-transparent text-muted-foreground/40 line-through"
                  }`}
                >
                  <span
                    className="w-4 h-0.5 rounded shrink-0"
                    style={{
                      backgroundColor: isVisible ? s.color : "hsl(215, 12%, 30%)",
                      ...(s.dash
                        ? {
                            backgroundImage: isVisible
                              ? `repeating-linear-gradient(90deg, ${s.color} 0 4px, transparent 4px 7px)`
                              : `repeating-linear-gradient(90deg, hsl(215,12%,30%) 0 4px, transparent 4px 7px)`,
                            backgroundColor: "transparent",
                          }
                        : {}),
                    }}
                  />
                  {s.label}
                </button>
              );
            })}
          </div>
          <ResponsiveContainer width="100%" height={300} minHeight={240}>
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
                  maxWidth: "360px",
                }}
                formatter={(value: number, name: string) => {
                  const series = SERIES.find((s) => s.key === name);
                  if (!series || !visibleKeys.has(name)) return null;
                  return [`$${value.toLocaleString()}`, series.label];
                }}
              />
              {SERIES.map((s) =>
                visibleKeys.has(s.key) ? (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    stroke={s.color}
                    strokeWidth={s.strokeWidth}
                    strokeDasharray={s.dash}
                    dot={{ r: 3, fill: s.color, strokeWidth: 1, stroke: "hsl(220, 18%, 10%)" }}
                    activeDot={{ r: 5, fill: s.color, strokeWidth: 2, stroke: "hsl(220, 18%, 10%)" }}
                    animationDuration={1500}
                    connectNulls
                  />
                ) : null
              )}
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </motion.div>
  );
};

export default ForecastChart;
