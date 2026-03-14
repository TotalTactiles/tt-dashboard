import { useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, ReferenceLine, Cell } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { formatMetricValue } from "@/lib/formatMetricValue";
import NoData from "./NoData";

const MONTH_ABBR_LIST = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

type QuarterFilter = "all" | "Q1" | "Q2" | "Q3" | "Q4";

const QUARTER_MONTHS: Record<string, number[]> = {
  Q1: [0, 1, 2], Q2: [3, 4, 5], Q3: [6, 7, 8], Q4: [9, 10, 11],
};

function parseMonth(label: string): { month: number; year: number } | null {
  const match = label.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2})$/i);
  if (!match) return null;
  return { month: MONTH_ABBR_LIST.indexOf(match[1]), year: 2000 + parseInt(match[2]) };
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

  const [showForecast, setShowForecast] = useState(() => loadPref("cashflow_show_forecast", false));
  const [quarter, setQuarter] = useState<QuarterFilter>(() => loadPref("cashflow_quarter_filter", "all"));

  const toggleForecast = useCallback(() => {
    setShowForecast((prev) => {
      const next = !prev;
      localStorage.setItem("cashflow_show_forecast", JSON.stringify(next));
      return next;
    });
  }, []);

  const setQuarterFilter = useCallback((q: QuarterFilter) => {
    setQuarter(q);
    localStorage.setItem("cashflow_quarter_filter", JSON.stringify(q));
  }, []);

  const now = new Date();
  const currentMonthIdx = now.getMonth();
  const currentMonthAbbr = now.toLocaleString("en-US", { month: "short" });
  const currentYearShort = String(now.getFullYear()).slice(-2);
  const currentMonthLabel = `${currentMonthAbbr}-${currentYearShort}`;

  const filteredData = useMemo(() => {
    let data = incomeOutgoingsData;
    if (!showForecast) data = data.filter((d) => !d.isFuture);
    if (quarter !== "all") {
      const qMonths = QUARTER_MONTHS[quarter];
      data = data.filter((d) => { const p = parseMonth(d.month); return p ? qMonths.includes(p.month) : false; });
    }
    return data;
  }, [incomeOutgoingsData, showForecast, quarter]);

  const quarterIsFuture = useMemo(() => {
    if (quarter === "all" || showForecast) return false;
    return QUARTER_MONTHS[quarter].every((m) => m > currentMonthIdx);
  }, [quarter, showForecast, currentMonthIdx]);

  const quarterYear = useMemo(() => {
    if (quarter === "all") return "";
    const first = incomeOutgoingsData.find((d) => { const p = parseMonth(d.month); return p && QUARTER_MONTHS[quarter].includes(p.month); });
    if (first) { const p = parseMonth(first.month); return p ? String(p.year) : String(now.getFullYear()); }
    return String(now.getFullYear());
  }, [quarter, incomeOutgoingsData]);

  const hasCurrentMonth = useMemo(() => filteredData.some((d) => d.month === currentMonthLabel), [filteredData, currentMonthLabel]);

  const barDomain = useMemo(() => {
    if (filteredData.length === 0) return [0, 100000];
    let maxBar = 0;
    for (const d of filteredData) maxBar = Math.max(maxBar, d.income, d.outgoings, d.probableIncome);
    return [0, Math.ceil(maxBar * 1.15 / 10000) * 10000 || 10000];
  }, [filteredData]);

  const renderSurplusDot = (props: any) => {
    const { cx, cy } = props;
    if (cx == null || cy == null) return null;
    return <circle cx={cx} cy={cy} r={2.5} fill="hsl(160, 70%, 45%)" stroke="none" />;
  };

  const quarterButtons: { key: QuarterFilter; label: string }[] = [
    { key: "all", label: "All" }, { key: "Q1", label: "Q1" }, { key: "Q2", label: "Q2" }, { key: "Q3", label: "Q3" }, { key: "Q4", label: "Q4" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="chart-container col-span-2"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-muted-foreground">Income vs Outgoings</h3>
          <p className="text-lg font-mono font-bold text-foreground">Monthly Cash Flow</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1">
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
          <button
            onClick={toggleForecast}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-medium transition-all ${
              showForecast
                ? "bg-emerald-600/90 text-white"
                : "bg-transparent border border-border text-muted-foreground hover:border-muted-foreground/50"
            }`}
          >
            {showForecast ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
            {showForecast ? "Hide Forecast" : "Show Forecast"}
          </button>
        </div>
      </div>

      {/* Legend — 3 items only */}
      <div className="flex items-center gap-x-4 text-xs font-mono mb-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "hsl(200, 80%, 50%)" }} />
          <span className="text-muted-foreground">Income</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "hsl(0, 72%, 55%)" }} />
          <span className="text-muted-foreground">Outgoings</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-0.5 rounded" style={{ backgroundColor: "hsl(160, 70%, 45%)" }} />
          <span className="text-muted-foreground">Surplus</span>
        </div>
      </div>

      {incomeOutgoingsData.length === 0 ? (
        <NoData message="No cashflow data" healthStatus={dataHealth.cashflow.status} />
      ) : quarterIsFuture ? (
        <div className="flex flex-col items-center justify-center h-[240px] gap-3">
          <p className="text-sm text-muted-foreground font-mono">{quarter} {quarterYear} is in the future</p>
          <button
            onClick={toggleForecast}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-mono font-medium bg-emerald-600/90 text-white hover:bg-emerald-600 transition-all"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Enable forecast to view {quarter} data
          </button>
        </div>
      ) : filteredData.length === 0 ? (
        <div className="flex items-center justify-center h-[240px]">
          <p className="text-sm text-muted-foreground font-mono">No data for this period</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={filteredData} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 15%)" strokeOpacity={0.5} />
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
                        <p style={{ color: isNeg ? "hsl(0, 84%, 60%)" : "hsl(160, 70%, 45%)", marginTop: 4, borderTop: "1px solid hsl(220, 14%, 25%)", paddingTop: 4 }}>
                          Projected {isNeg ? "Deficit" : "Surplus"}: {formatMetricValue(surplusVal, "currency")}
                        </p>
                      </>
                    ) : (
                      <>
                        <p style={{ color: "hsl(200, 80%, 50%)" }}>Income: {formatMetricValue(point.income, "currency")}</p>
                        <p style={{ color: "hsl(0, 72%, 55%)" }}>Outgoings: {formatMetricValue(point.outgoings, "currency")}</p>
                        <p style={{ color: isNeg ? "hsl(0, 84%, 60%)" : "hsl(160, 70%, 45%)", marginTop: 4, borderTop: "1px solid hsl(220, 14%, 25%)", paddingTop: 4 }}>
                          {isNeg ? "Deficit" : "Surplus"}: {formatMetricValue(surplusVal, "currency")}
                        </p>
                      </>
                    )}
                  </div>
                );
              }}
            />
            {/* Today indicator — very subtle */}
            {hasCurrentMonth && showForecast && (
              <ReferenceLine
                yAxisId="bars"
                x={currentMonthLabel}
                stroke="hsl(215, 12%, 40%)"
                strokeDasharray="4 4"
                strokeWidth={0.5}
                strokeOpacity={0.5}
              />
            )}
            <Bar yAxisId="bars" dataKey="income" radius={[3, 3, 0, 0]} animationDuration={800}>
              {filteredData.map((entry, index) => (
                <Cell key={`income-${index}`} fill="hsl(200, 80%, 50%)" fillOpacity={entry.isFuture ? 0 : 1} />
              ))}
            </Bar>
            <Bar yAxisId="bars" dataKey="probableIncome" radius={[3, 3, 0, 0]} animationDuration={800}>
              {filteredData.map((entry, index) => (
                <Cell key={`probable-${index}`} fill="hsl(200, 80%, 50%)" fillOpacity={entry.isFuture ? 0.35 : 0} />
              ))}
            </Bar>
            <Bar yAxisId="bars" dataKey="outgoings" fill="hsl(0, 72%, 55%)" radius={[3, 3, 0, 0]} animationDuration={800} />
            <Line
              yAxisId="bars"
              type="monotone"
              dataKey="surplus"
              stroke="hsl(160, 70%, 45%)"
              strokeWidth={2}
              dot={renderSurplusDot}
              animationDuration={800}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </motion.div>
  );
};

export default PortfolioChart;
