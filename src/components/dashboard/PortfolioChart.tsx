import { useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, ReferenceLine, Cell } from "recharts";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { formatMetricValue } from "@/lib/formatMetricValue";
import NoData from "./NoData";

const MONTH_ABBR_LIST = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

type QuarterFilter = "all" | "Q1" | "Q2" | "Q3" | "Q4";

const QUARTER_MONTHS: Record<string, number[]> = {
  Q1: [0, 1, 2],
  Q2: [3, 4, 5],
  Q3: [6, 7, 8],
  Q4: [9, 10, 11],
};

const QUARTER_LABELS: Record<string, string> = {
  Q1: "Jan–Mar",
  Q2: "Apr–Jun",
  Q3: "Jul–Sep",
  Q4: "Oct–Dec",
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

const PortfolioChart = () => {
  const { incomeOutgoingsData, dataHealth } = useDashboardData();

  const [quarter, setQuarter] = useState<QuarterFilter>(() => loadPref("cashflow_quarter_filter", getCurrentQuarter()));

  const setQuarterFilter = useCallback((q: QuarterFilter) => {
    setQuarter(q);
    localStorage.setItem("cashflow_quarter_filter", JSON.stringify(q));
  }, []);

  // Current month
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthAbbr = now.toLocaleString("en-US", { month: "short" });
  const currentYearShort = String(currentYear).slice(-2);
  const currentMonthLabel = `${currentMonthAbbr}-${currentYearShort}`;

  // Filter data — always include all data (forecast always on), just filter by quarter
  const filteredData = useMemo(() => {
    let data = incomeOutgoingsData;

    if (quarter !== "all") {
      const qMonths = QUARTER_MONTHS[quarter];
      data = data.filter((d) => {
        const parsed = parseMonth(d.month);
        return parsed ? qMonths.includes(parsed.month) : false;
      });
    }

    return data;
  }, [incomeOutgoingsData, quarter]);

  // Determine the year(s) spanned for quarter label
  const quarterYear = useMemo(() => {
    if (quarter === "all") return "";
    const first = incomeOutgoingsData.find((d) => {
      const p = parseMonth(d.month);
      return p && QUARTER_MONTHS[quarter].includes(p.month);
    });
    if (first) {
      const p = parseMonth(first.month);
      return p ? String(p.year) : String(currentYear);
    }
    return String(currentYear);
  }, [quarter, incomeOutgoingsData, currentYear]);

  const hasCurrentMonth = useMemo(
    () => filteredData.some((d) => d.month === currentMonthLabel),
    [filteredData, currentMonthLabel]
  );

  // Compute bar-friendly Y-axis domain
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
    const { cx, cy } = props;
    if (cx == null || cy == null) return null;
    return <circle cx={cx} cy={cy} r={3} fill="hsl(160, 70%, 45%)" stroke="none" />;
  };

  // Build range label for footer
  const rangeLabel = useMemo(() => {
    if (filteredData.length === 0) return "";
    const first = filteredData[0].month;
    const last = filteredData[filteredData.length - 1].month;
    return `${first} – ${last}`;
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
      {/* Header row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-start justify-between mb-2 gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-muted-foreground">Income vs Outgoings</h3>
          <p className="text-xl font-mono font-bold text-foreground">Monthly Cash Flow</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {quarterButtons.map((q) => (
            <button
              key={q.key}
              onClick={() => setQuarterFilter(q.key)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-medium transition-all ${
                quarter === q.key
                  ? "bg-emerald-600/90 text-white"
                  : "bg-transparent border border-border text-muted-foreground hover:border-muted-foreground/50"
              }`}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono mb-3">
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
      </div>

      {incomeOutgoingsData.length === 0 ? (
        <NoData message="No cashflow data" healthStatus={dataHealth.cashflow.status} />
      ) : filteredData.length === 0 ? (
        <div className="flex items-center justify-center h-[220px]">
          <p className="text-sm text-muted-foreground font-mono">No data for this period</p>
        </div>
      ) : (
        <div className="relative">
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={filteredData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
              <XAxis dataKey="month" stroke="hsl(215, 12%, 50%)" fontSize={11} fontFamily="JetBrains Mono" />
              <YAxis
                yAxisId="bars"
                stroke="hsl(215, 12%, 50%)"
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
                stroke="hsl(215, 12%, 50%)"
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
                  yAxisId="bars"
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
              {/* Income bars */}
              <Bar yAxisId="bars" dataKey="income" radius={[3, 3, 0, 0]} animationDuration={800}>
                {filteredData.map((entry, index) => (
                  <Cell
                    key={`income-${index}`}
                    fill="hsl(200, 80%, 50%)"
                    fillOpacity={entry.isFuture ? 0 : 1}
                  />
                ))}
              </Bar>
              {/* Probable income bars */}
              <Bar yAxisId="bars" dataKey="probableIncome" radius={[3, 3, 0, 0]} animationDuration={800}>
                {filteredData.map((entry, index) => (
                  <Cell
                    key={`probable-${index}`}
                    fill="hsl(200, 80%, 50%)"
                    fillOpacity={entry.isFuture ? 0.35 : 0}
                  />
                ))}
              </Bar>
              {/* Outgoings bars */}
              <Bar yAxisId="bars" dataKey="outgoings" fill="hsl(0, 72%, 55%)" radius={[3, 3, 0, 0]} animationDuration={800} />
              {/* Zero line on surplus axis */}
              <ReferenceLine yAxisId="surplus" y={0} stroke="hsl(215, 12%, 25%)" strokeDasharray="3 3" />
              {/* Surplus line */}
              <Line
                yAxisId="surplus"
                type="monotone"
                dataKey="surplus"
                stroke="hsl(160, 70%, 45%)"
                strokeWidth={2}
                dot={renderSurplusDot}
                animationDuration={800}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Footer label */}
      <div className="mt-2 text-[10px] font-mono text-muted-foreground/60">
        {quarter !== "all" ? (
          <span>Viewing {quarter} {quarterYear} · {QUARTER_LABELS[quarter]}</span>
        ) : (
          <span>Showing {rangeLabel}</span>
        )}
      </div>
    </motion.div>
  );
};

export default PortfolioChart;
