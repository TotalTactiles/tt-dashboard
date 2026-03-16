import { useMemo } from "react";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Scatter, ScatterChart, ZAxis } from "recharts";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { formatMetricValue } from "@/lib/formatMetricValue";
import { getMonthAdjustments, type GoalAdjustment } from "@/lib/goalMerge";
import type { IncomeOutgoingsPoint } from "@/contexts/DashboardDataContext";
import NoData from "./NoData";

const MONTH_ABBR: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

function parseMonthLabel(label: string): { month: number; year: number } | null {
  const match = label.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2})$/i);
  if (!match) return null;
  return { month: MONTH_ABBR[match[1]], year: 2000 + parseInt(match[2]) };
}

interface CashflowChartProps {
  adjustedData?: IncomeOutgoingsPoint[];
  adjustments?: GoalAdjustment[];
}

const CashflowChart = ({ adjustedData, adjustments = [] }: CashflowChartProps) => {
  const { incomeOutgoingsData, dataHealth } = useDashboardData();
  const chartData = adjustedData ?? incomeOutgoingsData;

  const hasNegative = useMemo(() => chartData.some((d) => d.surplus < 0), [chartData]);

  const gradientOffset = useMemo(() => {
    if (chartData.length === 0) return 1;
    const values = chartData.map((d) => d.surplus);
    const max = Math.max(...values);
    const min = Math.min(...values);
    if (max <= 0) return 0;
    if (min >= 0) return 1;
    return max / (max - min);
  }, [chartData]);

  const now = new Date();
  const currentMonthAbbr = now.toLocaleString("en-US", { month: "short" });
  const currentYearShort = String(now.getFullYear()).slice(-2);
  const currentMonthLabel = `${currentMonthAbbr}-${currentYearShort}`;

  const currentMonthData = useMemo(
    () => chartData.find((d) => d.month === currentMonthLabel),
    [chartData, currentMonthLabel]
  );

  const titleColor = currentMonthData
    ? currentMonthData.surplus >= 0 ? "text-emerald-500" : "text-red-500"
    : "text-muted-foreground";

  // Build goal marker data for scatter overlay
  const goalMarkers = useMemo(() => {
    if (adjustments.length === 0) return [];
    const markers: { month: string; surplus: number; goalName: string; amount: number; goalType: string }[] = [];
    for (const point of chartData) {
      const monthAdj = getMonthAdjustments(adjustments, point.month);
      if (monthAdj.length > 0) {
        // Deduplicate by goalId for this month
        const seen = new Set<string>();
        for (const adj of monthAdj) {
          if (seen.has(adj.goalId)) continue;
          seen.add(adj.goalId);
          markers.push({
            month: point.month,
            surplus: point.surplus,
            goalName: adj.goalName,
            amount: adj.amount,
            goalType: adj.goalType,
          });
        }
      }
    }
    return markers;
  }, [chartData, adjustments]);

  // Augment chart data with goal marker info for tooltip
  const enrichedData = useMemo(() => {
    if (adjustments.length === 0) return chartData;
    return chartData.map(point => {
      const monthAdj = getMonthAdjustments(adjustments, point.month);
      if (monthAdj.length === 0) return point;
      // Deduplicate
      const seen = new Set<string>();
      const unique = monthAdj.filter(a => { if (seen.has(a.goalId)) return false; seen.add(a.goalId); return true; });
      return { ...point, _goalAdjustments: unique };
    });
  }, [chartData, adjustments]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className="chart-container"
    >
      <h3 className={`text-sm font-medium mb-1 ${titleColor}`}>
        Cash Surplus / Deficit
      </h3>
      <p className="text-xs text-muted-foreground font-mono mb-4">Monthly surplus / deficit trend</p>
      {chartData.length === 0 ? (
        <NoData message="No cashflow data" healthStatus={dataHealth.cashflow.status} />
      ) : (
        <ResponsiveContainer width="100%" height={220} minHeight={160}>
          <AreaChart data={enrichedData}>
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
                const goalAdj: GoalAdjustment[] = point._goalAdjustments ?? [];
                return (
                  <div style={{
                    backgroundColor: "hsl(220, 18%, 10%)",
                    border: "1px solid hsl(220, 14%, 18%)",
                    borderRadius: "8px",
                    fontFamily: "JetBrains Mono",
                    fontSize: "12px",
                    padding: "8px 12px",
                    maxWidth: 280,
                  }}>
                    <p style={{ color: "hsl(215, 12%, 70%)", marginBottom: 4 }}>{label}</p>
                    {point.isFuture ? (
                      <>
                        <p style={{ color: "hsl(200, 80%, 50%)" }}>Income (Probable): {formatMetricValue(point.probableIncome ?? 0, "currency")}</p>
                        <p style={{ color: "hsl(0, 84%, 60%)" }}>Outgoings (Estimated): {formatMetricValue(point.outgoings, "currency")}</p>
                        <p style={{ color: isNeg ? "hsl(0, 84%, 60%)" : "hsl(160, 70%, 45%)", marginTop: 4, borderTop: "1px solid hsl(220, 14%, 25%)", paddingTop: 4 }}>
                          Projected {isNeg ? "Deficit" : "Surplus"}: {formatMetricValue(surplusVal, "currency")}
                        </p>
                      </>
                    ) : (
                      <>
                        <p style={{ color: "hsl(160, 70%, 45%)" }}>Income: {formatMetricValue(point.income, "currency")}</p>
                        <p style={{ color: "hsl(0, 84%, 60%)" }}>Outgoings: {formatMetricValue(point.outgoings, "currency")}</p>
                        <p style={{ color: isNeg ? "hsl(0, 84%, 60%)" : "hsl(160, 70%, 45%)", marginTop: 4, borderTop: "1px solid hsl(220, 14%, 25%)", paddingTop: 4 }}>
                          {isNeg ? "Deficit" : "Surplus"}: {formatMetricValue(surplusVal, "currency")}
                        </p>
                      </>
                    )}
                    {goalAdj.length > 0 && (
                      <div style={{ marginTop: 4, borderTop: "1px solid hsl(220, 14%, 25%)", paddingTop: 4 }}>
                        {goalAdj.map((a, i) => (
                          <p key={i} style={{ color: a.goalType === "revenue" ? "hsl(160, 70%, 45%)" : "hsl(38, 92%, 55%)", fontSize: 10 }}>
                            Goal: {a.goalName} {a.amount >= 0 ? "+" : ""}{formatMetricValue(a.amount, "currency")}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }}
            />
            <ReferenceLine y={0} stroke="hsl(215, 12%, 30%)" strokeDasharray="3 3" />
            {currentMonthData && (
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
            <Area
              type="monotone"
              dataKey="surplus"
              stroke="url(#splitStroke)"
              fill="url(#splitFill)"
              strokeWidth={2}
              animationDuration={800}
              baseValue={0}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                if (!payload?._goalAdjustments?.length) return <g key={props.key} />;
                const adj = payload._goalAdjustments[0];
                const color = adj.goalType === "revenue" ? "hsl(160, 70%, 45%)" : "hsl(38, 92%, 55%)";
                return (
                  <g key={props.key}>
                    <polygon
                      points={`${cx},${cy - 5} ${cx + 4},${cy} ${cx},${cy + 5} ${cx - 4},${cy}`}
                      fill={color}
                      stroke="hsl(220, 18%, 10%)"
                      strokeWidth={1}
                    />
                  </g>
                );
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </motion.div>
  );
};

export default CashflowChart;
