import { useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea } from "recharts";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { formatMetricValue } from "@/lib/formatMetricValue";
import { chartColors } from "@/lib/chartTheme";
import { getMonthAdjustments, type GoalAdjustment } from "@/lib/goalMerge";
import type { IncomeOutgoingsPoint } from "@/contexts/DashboardDataContext";
import NoData from "./NoData";
import { X } from "lucide-react";
import { useTheme } from "next-themes";

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
  const { resolvedTheme } = useTheme();

  const [selStart, setSelStart] = useState<string | null>(null);
  const [selEnd, setSelEnd] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const tc = useMemo(() => chartColors(), [resolvedTheme]);

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
    ? currentMonthData.surplus >= 0 ? "text-chart-green" : "text-chart-red"
    : "text-muted-foreground";

  const enrichedData = useMemo(() => {
    if (adjustments.length === 0) return chartData;
    return chartData.map(point => {
      const monthAdj = getMonthAdjustments(adjustments, point.month);
      if (monthAdj.length === 0) return point;
      const seen = new Set<string>();
      const unique = monthAdj.filter(a => { if (seen.has(a.goalId)) return false; seen.add(a.goalId); return true; });
      return { ...point, _goalAdjustments: unique };
    });
  }, [chartData, adjustments]);

  const handleMouseDown = useCallback((e: any) => {
    if (e?.activeLabel) {
      setSelStart(e.activeLabel);
      setSelEnd(null);
      setDragging(true);
    }
  }, []);

  const handleMouseMove = useCallback((e: any) => {
    if (dragging && e?.activeLabel) {
      setSelEnd(e.activeLabel);
    }
  }, [dragging]);

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  const clearSelection = useCallback(() => {
    setSelStart(null);
    setSelEnd(null);
    setDragging(false);
  }, []);

  const rangeSummary = useMemo(() => {
    if (!selStart || !selEnd) return null;
    const months = enrichedData.map(d => d.month);
    let startIdx = months.indexOf(selStart);
    let endIdx = months.indexOf(selEnd);
    if (startIdx < 0 || endIdx < 0) return null;
    if (startIdx > endIdx) [startIdx, endIdx] = [endIdx, startIdx];
    const rangeData = enrichedData.slice(startIdx, endIdx + 1);
    if (rangeData.length === 0) return null;
    const total = rangeData.reduce((s, d) => s + d.surplus, 0);
    const avg = total / rangeData.length;
    return { start: rangeData[0].month, end: rangeData[rangeData.length - 1].month, total, avg, count: rangeData.length };
  }, [selStart, selEnd, enrichedData]);

  const orderedSel = useMemo(() => {
    if (!selStart) return null;
    const end = selEnd || selStart;
    const months = enrichedData.map(d => d.month);
    const si = months.indexOf(selStart);
    const ei = months.indexOf(end);
    if (si < 0 || ei < 0) return null;
    return si <= ei ? { start: selStart, end } : { start: end, end: selStart };
  }, [selStart, selEnd, enrichedData]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className="chart-container"
    >
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className={`text-sm font-medium ${titleColor}`}>
            Cash Surplus / Deficit
          </h3>
          <p className="text-xs text-muted-foreground font-mono mb-4">
            {rangeSummary ? "Drag to select range" : "Click & drag to analyse a range"}
          </p>
        </div>
        {rangeSummary && (
          <button
            onClick={clearSelection}
            className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground bg-secondary/80 rounded-full px-2 py-0.5 transition-colors"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {chartData.length === 0 ? (
        <NoData message="No cashflow data" healthStatus={dataHealth.cashflow.status} />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={220} minHeight={160}>
            <AreaChart
              data={enrichedData}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              style={{ cursor: dragging ? "col-resize" : "crosshair" }}
            >
              <defs>
                <linearGradient id="splitFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={tc.green} stopOpacity={0.3} />
                  <stop offset={`${gradientOffset * 100}%`} stopColor={tc.green} stopOpacity={0.05} />
                  <stop offset={`${gradientOffset * 100}%`} stopColor={tc.red} stopOpacity={0.05} />
                  <stop offset="100%" stopColor={tc.red} stopOpacity={0.4} />
                </linearGradient>
                <linearGradient id="splitStroke" x1="0" y1="0" x2="0" y2="1">
                  <stop offset={`${gradientOffset * 100}%`} stopColor={tc.green} />
                  <stop offset={`${gradientOffset * 100}%`} stopColor={tc.red} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={tc.grid} strokeOpacity={0.6} />
              <XAxis dataKey="month" stroke={tc.axis} fontSize={11} fontFamily="JetBrains Mono" />
              <YAxis
                stroke={tc.axis}
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
                      backgroundColor: tc.tooltipBg,
                      border: `1px solid ${tc.tooltipBorder}`,
                      borderRadius: "8px",
                      fontFamily: "JetBrains Mono",
                      fontSize: "11px",
                      padding: "8px 12px",
                      maxWidth: 280,
                      boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
                    }}>
                      <p style={{ color: tc.tooltipText, marginBottom: 4 }}>{label}</p>
                      {point.isFuture ? (
                        <>
                          <p style={{ color: tc.blue }}>Income (Probable): {formatMetricValue(point.probableIncome ?? 0, "currency")}</p>
                          <p style={{ color: tc.red }}>Outgoings (Estimated): {formatMetricValue(point.outgoings, "currency")}</p>
                          <p style={{ color: isNeg ? tc.red : tc.green, marginTop: 4, borderTop: `1px solid ${tc.tooltipBorder}`, paddingTop: 4 }}>
                            Projected {isNeg ? "Deficit" : "Surplus"}: {formatMetricValue(surplusVal, "currency")}
                          </p>
                        </>
                      ) : (
                        <>
                          <p style={{ color: tc.green }}>Income: {formatMetricValue(point.income, "currency")}</p>
                          <p style={{ color: tc.red }}>Outgoings: {formatMetricValue(point.outgoings, "currency")}</p>
                          <p style={{ color: isNeg ? tc.red : tc.green, marginTop: 4, borderTop: `1px solid ${tc.tooltipBorder}`, paddingTop: 4 }}>
                            {isNeg ? "Deficit" : "Surplus"}: {formatMetricValue(surplusVal, "currency")}
                          </p>
                        </>
                      )}
                      {goalAdj.length > 0 && (
                        <div style={{ marginTop: 4, borderTop: `1px solid ${tc.tooltipBorder}`, paddingTop: 4 }}>
                          {goalAdj.map((a, i) => (
                            <p key={i} style={{ color: a.goalType === "revenue" ? tc.green : tc.amber, fontSize: 10 }}>
                              Goal: {a.goalName} {a.amount >= 0 ? "+" : ""}{formatMetricValue(a.amount, "currency")}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              <ReferenceLine y={0} stroke={tc.zeroLine} strokeDasharray="3 3" />
              {currentMonthData && (
                <ReferenceLine
                  x={currentMonthLabel}
                  stroke={tc.refLine}
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  label={{
                    value: currentMonthLabel,
                    position: "top",
                    fill: tc.refText,
                    fontSize: 10,
                    fontFamily: "JetBrains Mono",
                  }}
                />
              )}
              {orderedSel && (
                <ReferenceArea
                  x1={orderedSel.start}
                  x2={orderedSel.end}
                  fill={tc.blue}
                  fillOpacity={0.12}
                  stroke={tc.blue}
                  strokeOpacity={0.4}
                  strokeDasharray="3 3"
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
                  const color = adj.goalType === "revenue" ? tc.green : tc.amber;
                  return (
                    <g key={props.key}>
                      <polygon
                        points={`${cx},${cy - 5} ${cx + 4},${cy} ${cx},${cy + 5} ${cx - 4},${cy}`}
                        fill={color}
                        stroke={tc.dotStroke}
                        strokeWidth={1}
                      />
                    </g>
                  );
                }}
              />
            </AreaChart>
          </ResponsiveContainer>

          {rangeSummary && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 p-3 rounded-lg border border-border bg-secondary/50"
            >
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] font-mono font-semibold text-foreground">Selected Range</p>
                <span className="text-[10px] font-mono text-muted-foreground">{rangeSummary.count} months</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div>
                  <p className="text-muted-foreground">Period</p>
                  <p className="text-foreground font-medium">{rangeSummary.start} → {rangeSummary.end}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total {rangeSummary.total >= 0 ? "Surplus" : "Deficit"}</p>
                  <p className={rangeSummary.total >= 0 ? "text-chart-green font-medium" : "text-chart-red font-medium"}>
                    {formatMetricValue(rangeSummary.total, "currency")}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Avg Monthly</p>
                  <p className={rangeSummary.avg >= 0 ? "text-chart-green font-medium" : "text-chart-red font-medium"}>
                    {formatMetricValue(rangeSummary.avg, "currency")}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  );
};

export default CashflowChart;
