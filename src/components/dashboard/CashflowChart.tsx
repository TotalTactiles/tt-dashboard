import { useMemo } from "react";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { formatMetricValue } from "@/lib/formatMetricValue";
import NoData from "./NoData";

const CashflowChart = () => {
  const { incomeOutgoingsData, dataHealth } = useDashboardData();

  const hasNegative = useMemo(() => incomeOutgoingsData.some((d) => d.surplus < 0), [incomeOutgoingsData]);

  // Compute the fraction along the Y-axis where zero sits (for gradient split)
  const gradientOffset = useMemo(() => {
    if (incomeOutgoingsData.length === 0) return 1;
    const values = incomeOutgoingsData.map((d) => d.surplus);
    const max = Math.max(...values);
    const min = Math.min(...values);
    if (max <= 0) return 0;
    if (min >= 0) return 1;
    return max / (max - min);
  }, [incomeOutgoingsData]);

  const lastValue = incomeOutgoingsData.length > 0 ? incomeOutgoingsData[incomeOutgoingsData.length - 1].surplus : 0;
  const isDeficit = lastValue < 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className={`chart-container ${isDeficit ? "border-l-2 border-l-destructive" : ""}`}
    >
      <h3 className={`text-sm font-medium mb-1 ${isDeficit ? "text-destructive" : "text-muted-foreground"}`}>
        Cash Surplus / Deficit
      </h3>
      <p className="text-xs text-muted-foreground font-mono mb-4">Monthly surplus / deficit trend</p>
      {incomeOutgoingsData.length === 0 ? (
        <NoData message="No cashflow data" healthStatus={dataHealth.cashflow.status} />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={incomeOutgoingsData}>
            <defs>
              <linearGradient id="splitFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(160, 70%, 45%)" stopOpacity={0.3} />
                <stop offset={`${gradientOffset * 100}%`} stopColor="hsl(160, 70%, 45%)" stopOpacity={0.05} />
                <stop offset={`${gradientOffset * 100}%`} stopColor="hsl(0, 84%, 60%)" stopOpacity={0.05} />
                <stop offset="100%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.4} />
              </linearGradient>
              <linearGradient id="splitStroke" x1="0" y1="0" x2="0" y2="1">
                <stop offset={`${gradientOffset * 100}%`} stopColor="hsl(160, 70%, 45%)" />
                <stop offset={`${gradientOffset * 100}%`} stopColor="hsl(0, 84%, 60%)" />
              </linearGradient>
            </defs>
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
              domain={hasNegative ? ["auto", "auto"] : [0, "auto"]}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || payload.length === 0) return null;
                const point = payload[0]?.payload;
                if (!point) return null;
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
                    <p style={{ color: "hsl(160, 70%, 45%)" }}>Income: {formatMetricValue(point.income, "currency")}</p>
                    <p style={{ color: "hsl(0, 84%, 60%)" }}>Outgoings: {formatMetricValue(point.outgoings, "currency")}</p>
                    <p style={{ color: isNeg ? "hsl(0, 84%, 60%)" : "hsl(160, 70%, 45%)", marginTop: 4, borderTop: "1px solid hsl(220, 14%, 25%)", paddingTop: 4 }}>
                      {isNeg ? "Deficit" : "Surplus"}: {formatMetricValue(surplusVal, "currency")}
                    </p>
                  </div>
                );
              }}
            />
            <ReferenceLine y={0} stroke="hsl(215, 12%, 30%)" strokeDasharray="3 3" />
            <Area
              type="monotone"
              dataKey="surplus"
              stroke="url(#splitStroke)"
              fill="url(#splitFill)"
              strokeWidth={2}
              animationDuration={2000}
              baseValue={0}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </motion.div>
  );
};

export default CashflowChart;
