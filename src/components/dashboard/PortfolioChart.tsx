import { useMemo } from "react";
import { motion } from "framer-motion";
import { BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, ReferenceLine, Cell } from "recharts";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { formatMetricValue } from "@/lib/formatMetricValue";
import NoData from "./NoData";

const PortfolioChart = () => {
  const { incomeOutgoingsData, dataHealth } = useDashboardData();

  // Current month label for today indicator
  const now = new Date();
  const currentMonthAbbr = now.toLocaleString("en-US", { month: "short" });
  const currentYearShort = String(now.getFullYear()).slice(-2);
  const currentMonthLabel = `${currentMonthAbbr}-${currentYearShort}`;

  const hasCurrentMonth = useMemo(
    () => incomeOutgoingsData.some((d) => d.month === currentMonthLabel),
    [incomeOutgoingsData, currentMonthLabel]
  );

  // Custom dot renderer for surplus line — no change needed, just styling
  const renderSurplusDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null) return null;
    return (
      <circle
        cx={cx}
        cy={cy}
        r={3}
        fill="hsl(160, 70%, 45%)"
        stroke="none"
      />
    );
  };

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
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(200, 80%, 50%)" }} />
            <span className="text-muted-foreground">Income</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(200, 80%, 50%)", opacity: 0.35 }} />
            <span className="text-muted-foreground">Income (Probable)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(0, 72%, 55%)" }} />
            <span className="text-muted-foreground">Outgoings</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-0.5 rounded" style={{ backgroundColor: "hsl(160, 70%, 45%)" }} />
            <span className="text-muted-foreground">Surplus</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-0.5 rounded" style={{ backgroundColor: "hsl(160, 70%, 45%)", borderTop: "1px dashed hsl(160, 70%, 45%)", height: 0 }} />
            <span className="text-muted-foreground" style={{ borderBottom: "1px dashed hsl(160, 70%, 45%)", lineHeight: "1" }}>Surplus (Projected)</span>
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
            <YAxis
              stroke="hsl(215, 12%, 50%)"
              fontSize={11}
              fontFamily="JetBrains Mono"
              tickFormatter={(v) => {
                const abs = Math.abs(v);
                const label = abs >= 1000 ? `$${(abs / 1000).toFixed(0)}K` : `$${abs}`;
                return v < 0 ? `-${label}` : label;
              }}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || payload.length === 0) return null;
                const point = payload[0]?.payload;
                if (!point) return null;
                const isFuture = point.isFuture;
                const surplusVal = point.surplus ?? 0;
                const isNeg = surplusVal < 0;
                return (
                  <div style={{
                    backgroundColor: "hsl(220, 18%, 10%)",
                    border: "1px solid hsl(220, 14%, 18%)",
                    borderRadius: "8px",
                    fontFamily: "JetBrains Mono",
                    fontSize: "12px",
                    padding: "8px 12px",
                  }}>
                    <p style={{ color: "hsl(215, 12%, 70%)", marginBottom: 4 }}>{label}</p>
                    {isFuture ? (
                      <>
                        <p style={{ color: "hsl(200, 80%, 50%)" }}>Income (Probable): {formatMetricValue(point.probableIncome, "currency")}</p>
                        <p style={{ color: "hsl(0, 72%, 55%)" }}>Outgoings (Estimated): {formatMetricValue(point.outgoings, "currency")}</p>
                        <p style={{
                          color: isNeg ? "hsl(0, 84%, 60%)" : "hsl(160, 70%, 45%)",
                          marginTop: 4, borderTop: "1px solid hsl(220, 14%, 25%)", paddingTop: 4,
                        }}>
                          Projected {isNeg ? "Deficit" : "Surplus"}: {formatMetricValue(surplusVal, "currency")}
                        </p>
                      </>
                    ) : (
                      <>
                        <p style={{ color: "hsl(200, 80%, 50%)" }}>Income: {formatMetricValue(point.income, "currency")}</p>
                        <p style={{ color: "hsl(0, 72%, 55%)" }}>Outgoings: {formatMetricValue(point.outgoings, "currency")}</p>
                        <p style={{
                          color: isNeg ? "hsl(0, 84%, 60%)" : "hsl(160, 70%, 45%)",
                          marginTop: 4, borderTop: "1px solid hsl(220, 14%, 25%)", paddingTop: 4,
                        }}>
                          {isNeg ? "Deficit" : "Surplus"}: {formatMetricValue(surplusVal, "currency")}
                        </p>
                      </>
                    )}
                  </div>
                );
              }}
            />
            {/* Today indicator */}
            {hasCurrentMonth && (
              <ReferenceLine
                x={currentMonthLabel}
                stroke="hsl(215, 12%, 45%)"
                strokeDasharray="4 4"
                strokeWidth={1}
                label={{
                  value: currentMonthLabel,
                  position: "top",
                  fill: "hsl(215, 12%, 55%)",
                  fontSize: 10,
                  fontFamily: "JetBrains Mono",
                }}
              />
            )}
            {/* Income bars — solid for past, faded for future (probable) */}
            <Bar dataKey="income" radius={[3, 3, 0, 0]} animationDuration={1500}>
              {incomeOutgoingsData.map((entry, index) => (
                <Cell
                  key={`income-${index}`}
                  fill="hsl(200, 80%, 50%)"
                  fillOpacity={entry.isFuture ? 0 : 1}
                />
              ))}
            </Bar>
            {/* Probable income bars — only visible for future months */}
            <Bar dataKey="probableIncome" radius={[3, 3, 0, 0]} animationDuration={1500}>
              {incomeOutgoingsData.map((entry, index) => (
                <Cell
                  key={`probable-${index}`}
                  fill="hsl(200, 80%, 50%)"
                  fillOpacity={entry.isFuture ? 0.35 : 0}
                />
              ))}
            </Bar>
            {/* Outgoings bars */}
            <Bar dataKey="outgoings" fill="hsl(0, 72%, 55%)" radius={[3, 3, 0, 0]} animationDuration={1500} />
            {/* Surplus line */}
            <Line
              type="monotone"
              dataKey="surplus"
              stroke="hsl(160, 70%, 45%)"
              strokeWidth={2}
              dot={renderSurplusDot}
              animationDuration={1500}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </motion.div>
  );
};

export default PortfolioChart;
