import React, { useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, ReferenceLine, Cell } from "recharts";
import { Download } from "lucide-react";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { formatMetricValue } from "@/lib/formatMetricValue";
import { chartColors } from "@/lib/chartTheme";
import { getMonthAdjustments, type GoalAdjustment } from "@/lib/goalMerge";
import type { IncomeOutgoingsPoint } from "@/contexts/DashboardDataContext";
import NoData from "./NoData";
import { CashflowExportModal } from "@/components/reports/CashflowExportModal";
import { useTheme } from "next-themes";

const MONTH_ABBR_LIST = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

type QuarterFilter = "all" | "Q1" | "Q2" | "Q3" | "Q4";

const QUARTER_MONTHS: Record<string, number[]> = {
  Q1: [0, 1, 2], Q2: [3, 4, 5], Q3: [6, 7, 8], Q4: [9, 10, 11],
};

const QUARTER_LABELS: Record<string, string> = {
  Q1: "Jan–Mar", Q2: "Apr–Jun", Q3: "Jul–Sep", Q4: "Oct–Dec",
};

function parseMonth(label: string): { month: number; year: number } | null {
  const match = label.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2})$/i);
  if (!match) return null;
  return { month: MONTH_ABBR_LIST.indexOf(match[1]), year: 2000 + parseInt(match[2]) };
}

function getCurrentQuarter(): QuarterFilter {
  const m = new Date().getMonth();
  if (m <= 2) return "Q1";
  if (m <= 5) return "Q2";
  if (m <= 8) return "Q3";
  return "Q4";
}

function loadPref<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return JSON.parse(v) as T;
  } catch { return fallback; }
}

interface PortfolioChartProps {
  adjustedData?: IncomeOutgoingsPoint[];
  adjustments?: GoalAdjustment[];
}

const PortfolioChartInner = ({ adjustedData, adjustments = [] }: PortfolioChartProps) => {
  const { incomeOutgoingsData, dataHealth } = useDashboardData();
  const sourceData = useMemo(() => adjustedData ?? incomeOutgoingsData, [adjustedData, incomeOutgoingsData]);
  const [exportOpen, setExportOpen] = useState(false);
  const { resolvedTheme } = useTheme();

  const [quarter, setQuarter] = useState<QuarterFilter>(() => loadPref("cashflow_quarter_filter", getCurrentQuarter()));

  const setQuarterFilter = useCallback((q: QuarterFilter) => {
    setQuarter(q);
    localStorage.setItem("cashflow_quarter_filter", JSON.stringify(q));
  }, []);

  // Derive available years from data
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const d of sourceData) {
      const p = parseMonth(d.month);
      if (p) years.add(p.year);
    }
    return Array.from(years).sort();
  }, [sourceData]);

  const hasMultipleYears = availableYears.length > 1;

  const [selectedYear, setSelectedYear] = useState<number | null>(() =>
    availableYears.length > 1 ? availableYears[0] : null
  );

  // Keep selectedYear in sync when data changes
  useMemo(() => {
    if (hasMultipleYears && (selectedYear === null || !availableYears.includes(selectedYear))) {
      setSelectedYear(availableYears[0]);
    } else if (!hasMultipleYears) {
      setSelectedYear(null);
    }
  }, [availableYears, hasMultipleYears]);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthAbbr = now.toLocaleString("en-US", { month: "short" });
  const currentYearShort = String(currentYear).slice(-2);
  const currentMonthLabel = `${currentMonthAbbr}-${currentYearShort}`;

  // Resolve colors from CSS variables (theme-aware)
  const tc = useMemo(() => chartColors(), [resolvedTheme]);

  const filteredData = useMemo(() => {
    let data = sourceData.map(d => ({
      ...d,
      outgoings: Math.abs(d.outgoings),
    }));
    // Year filter
    if (selectedYear !== null) {
      data = data.filter((d) => {
        const parsed = parseMonth(d.month);
        return parsed ? parsed.year === selectedYear : false;
      });
    }
    // Quarter filter
    if (quarter !== "all") {
      const qMonths = QUARTER_MONTHS[quarter];
      data = data.filter((d) => {
        const parsed = parseMonth(d.month);
        return parsed ? qMonths.includes(parsed.month) : false;
      });
    }
    if (adjustments.length > 0) {
      data = data.map(point => {
        const monthAdj = getMonthAdjustments(adjustments, point.month);
        if (monthAdj.length === 0) return point;
        const seen = new Set<string>();
        const unique = monthAdj.filter(a => { if (seen.has(a.goalId)) return false; seen.add(a.goalId); return true; });
        return { ...point, _goalAdjustments: unique };
      });
    }
    return data;
  }, [sourceData, quarter, selectedYear, adjustments]);

  const quarterYear = useMemo(() => {
    if (quarter === "all") return "";
    const first = sourceData.find((d) => {
      const p = parseMonth(d.month);
      return p && QUARTER_MONTHS[quarter].includes(p.month);
    });
    if (first) {
      const p = parseMonth(first.month);
      return p ? String(p.year) : String(currentYear);
    }
    return String(currentYear);
  }, [quarter, sourceData, currentYear]);

  const hasCurrentMonth = useMemo(
    () => filteredData.some((d) => d.month === currentMonthLabel),
    [filteredData, currentMonthLabel]
  );

  const barDomain = useMemo(() => {
    if (filteredData.length === 0) return [0, 100000];
    let maxBar = 0;
    for (const d of filteredData) {
      maxBar = Math.max(maxBar, d.income, d.outgoings, d.probableIncome);
    }
    return [0, Math.ceil(maxBar * 1.15 / 10000) * 10000 || 10000];
  }, [filteredData]);

  const surplusDomain = useMemo(() => {
    if (filteredData.length === 0) return [-10000, 10000];
    const vals = filteredData.map((d) => d.surplus);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = Math.max(Math.abs(max - min) * 0.15, 5000);
    return [Math.floor((min - pad) / 5000) * 5000, Math.ceil((max + pad) / 5000) * 5000];
  }, [filteredData]);

  const renderSurplusDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null) return null;
    const goalAdj = (payload as any)?._goalAdjustments;
    if (goalAdj?.length) {
      const color = goalAdj[0].goalType === "revenue" ? tc.green : tc.amber;
      return (
        <polygon
          points={`${cx},${cy - 5} ${cx + 4},${cy} ${cx},${cy + 5} ${cx - 4},${cy}`}
          fill={color}
          stroke={tc.dotStroke}
          strokeWidth={1}
        />
      );
    }
    return <circle cx={cx} cy={cy} r={3} fill={tc.green} stroke="none" />;
  };

  const rangeLabel = useMemo(() => {
    if (filteredData.length === 0) return "";
    return `${filteredData[0].month} – ${filteredData[filteredData.length - 1].month}`;
  }, [filteredData]);

  const quarterButtons: { key: QuarterFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "Q1", label: "Q1" },
    { key: "Q2", label: "Q2" },
    { key: "Q3", label: "Q3" },
    { key: "Q4", label: "Q4" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="chart-container col-span-full lg:col-span-2"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-start justify-between mb-2 gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-muted-foreground">Income vs Outgoings</h3>
          <p className="text-xl font-mono font-bold text-foreground">Monthly Cash Flow</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1">
            {quarterButtons.map((q) => (
              <button
                key={q.key}
                onClick={() => setQuarterFilter(q.key)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-medium transition-all ${
                  quarter === q.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-transparent border border-border text-muted-foreground hover:border-muted-foreground/50"
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setExportOpen(true)}
            className="p-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            title="Export PDF Report"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono mb-3">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-chart-blue" />
          <span className="text-muted-foreground">Income</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-chart-blue/35" />
          <span className="text-muted-foreground">Income (Probable)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-chart-red" />
          <span className="text-muted-foreground">Outgoings</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-0.5 rounded bg-chart-green" />
          <span className="text-muted-foreground">Surplus</span>
        </div>
      </div>

      {incomeOutgoingsData.length === 0 ? (
        <NoData message="No cashflow data" healthStatus={dataHealth.cashflow.status} />
      ) : filteredData.length === 0 ? (
        <div className="flex items-center justify-center h-[220px]">
          <p className="text-sm text-muted-foreground font-mono">No data for this period</p>
        </div>
      ) : (
        <div className="relative">
          <ResponsiveContainer width="100%" height={220} minHeight={180}>
            <ComposedChart data={filteredData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke={tc.grid} strokeOpacity={0.6} />
              <XAxis dataKey="month" stroke={tc.axis} fontSize={11} fontFamily="JetBrains Mono" />
              <YAxis
                yAxisId="bars"
                stroke={tc.axis}
                fontSize={11}
                fontFamily="JetBrains Mono"
                domain={barDomain}
                tickFormatter={(v) => {
                  const abs = Math.abs(v);
                  return abs >= 1000 ? `$${(abs / 1000).toFixed(0)}K` : `$${abs}`;
                }}
              />
              <YAxis
                yAxisId="surplus"
                orientation="right"
                stroke={tc.axis}
                fontSize={10}
                fontFamily="JetBrains Mono"
                domain={surplusDomain}
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
                  const goalAdj: GoalAdjustment[] = (point as any)._goalAdjustments ?? [];
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
                      {isFuture ? (
                        <>
                          <p style={{ color: tc.blue }}>Income (Probable): {formatMetricValue(point.probableIncome, "currency")}</p>
                          <p style={{ color: tc.red }}>Outgoings (Estimated): {formatMetricValue(point.outgoings, "currency")}</p>
                          <p style={{ color: isNeg ? tc.red : tc.green, marginTop: 4, borderTop: `1px solid ${tc.tooltipBorder}`, paddingTop: 4 }}>
                            Projected {isNeg ? "Deficit" : "Surplus"}: {formatMetricValue(surplusVal, "currency")}
                          </p>
                        </>
                      ) : (
                        <>
                          <p style={{ color: tc.blue }}>Income: {formatMetricValue(point.income, "currency")}</p>
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
              {hasCurrentMonth && (
                <ReferenceLine
                  yAxisId="bars"
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
              <Bar yAxisId="bars" dataKey="income" radius={[3, 3, 0, 0]} animationDuration={800}>
                {filteredData.map((entry, index) => (
                  <Cell key={`income-${index}`} fill={tc.blue} fillOpacity={entry.isFuture ? 0 : 1} />
                ))}
              </Bar>
              <Bar yAxisId="bars" dataKey="probableIncome" radius={[3, 3, 0, 0]} animationDuration={800}>
                {filteredData.map((entry, index) => (
                  <Cell key={`probable-${index}`} fill={tc.blue} fillOpacity={entry.isFuture ? 0.35 : 0} />
                ))}
              </Bar>
              <Bar yAxisId="bars" dataKey="outgoings" fill={tc.red} radius={[3, 3, 0, 0]} animationDuration={800} />
              <ReferenceLine yAxisId="surplus" y={0} stroke={tc.zeroLine} strokeDasharray="3 3" />
              <Line
                yAxisId="surplus"
                type="monotone"
                dataKey="surplus"
                stroke={tc.green}
                strokeWidth={2}
                dot={renderSurplusDot}
                animationDuration={800}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-2 text-[10px] font-mono text-muted-foreground/60">
        {quarter !== "all" ? (
          <span>Viewing {quarter} {quarterYear} · {QUARTER_LABELS[quarter]}</span>
        ) : (
          <span>Showing {rangeLabel}</span>
        )}
      </div>
      <CashflowExportModal open={exportOpen} onOpenChange={setExportOpen} />
    </motion.div>
  );
};

const PortfolioChart = React.memo(PortfolioChartInner);
PortfolioChart.displayName = "PortfolioChart";

export default PortfolioChart;
