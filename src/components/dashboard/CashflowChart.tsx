import { useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
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

const CashflowChart = () => {
  const { incomeOutgoingsData, dataHealth } = useDashboardData();

  const [showForecast, setShowForecast] = useState(() => loadPref("surplus_show_forecast", false));
  const [quarter, setQuarter] = useState<QuarterFilter>(() => loadPref("surplus_quarter_filter", "all"));

  const toggleForecast = useCallback(() => {
    setShowForecast((prev) => {
      const next = !prev;
      localStorage.setItem("surplus_show_forecast", JSON.stringify(next));
      return next;
    });
  }, []);

  const setQuarterFilter = useCallback((q: QuarterFilter) => {
    setQuarter(q);
    localStorage.setItem("surplus_quarter_filter", JSON.stringify(q));
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

  const hasNegative = useMemo(() => filteredData.some((d) => d.surplus < 0), [filteredData]);

  const gradientOffset = useMemo(() => {
    if (filteredData.length === 0) return 1;
    const values = filteredData.map((d) => d.surplus);
    const max = Math.max(...values);
    const min = Math.min(...values);
    if (max <= 0) return 0;
    if (min >= 0) return 1;
    return max / (max - min);
  }, [filteredData]);

  const hasCurrentMonth = useMemo(() => filteredData.some((d) => d.month === currentMonthLabel), [filteredData, currentMonthLabel]);

  const currentMonthData = useMemo(() => filteredData.find((d) => d.month === currentMonthLabel), [filteredData, currentMonthLabel]);

  const titleColor = currentMonthData
    ? currentMonthData.surplus >= 0 ? "text-emerald-500" : "text-red-500"
    : "text-muted-foreground";

  const quarterButtons: { key: QuarterFilter; label: string }[] = [
    { key: "all", label: "All" }, { key: "Q1", label: "Q1" }, { key: "Q2", label: "Q2" }, { key: "Q3", label: "Q3" }, { key: "Q4", label: "Q4" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className="chart-container"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="min-w-0">
          <h3 className={`text-sm font-medium mb-0.5 ${titleColor}`}>Cash Surplus / Deficit</h3>
          <p className="text-[10px] text-muted-foreground font-mono">Monthly trend</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="flex items-center gap-0.5">
            {quarterButtons.map((q) => (
              <button
                key={q.key}
                onClick={() => setQuarterFilter(q.key)}
                className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-medium transition-all ${
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
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-medium transition-all ${
              showForecast
                ? "bg-emerald-600/90 text-white"
                : "bg-transparent border border-border text-muted-foreground hover:border-muted-foreground/50"
            }`}
          >
            {showForecast ? <TrendingDown className="w-2.5 h-2.5" /> : <TrendingUp className="w-2.5 h-2.5" />}
            {showForecast ? "Hide" : "Forecast"}
          </button>
        </div>
      </div>

      {incomeOutgoingsData.length === 0 ? (
        <NoData message="No cashflow data" healthStatus={dataHealth.cashflow.status} />
      ) : quarterIsFuture ? (
        <div className="flex flex-col items-center justify-center h-[220px] gap-3">
          <p className="text-xs text-muted-foreground font-mono">{quarter} {quarterYear} is in the future</p>
          <button
            onClick={toggleForecast}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono font-medium bg-emerald-600/90 text-white hover:bg-emerald-600 transition-all"
          >
            <TrendingUp className="w-3 h-3" />
            Enable forecast
          </button>
        </div>
      ) : filteredData.length === 0 ? (
        <div className="flex items-center justify-center h-[220px]">
          <p className="text-xs text-muted-foreground font-mono">No data for this period</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={filteredData}>
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
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 15%)" strokeOpacity={0.5} />
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
                  </div>
                );
              }}
            />
            <ReferenceLine y={0} stroke="hsl(215, 12%, 25%)" strokeDasharray="3 3" />
            {hasCurrentMonth && showForecast && (
              <ReferenceLine
                x={currentMonthLabel}
                stroke="hsl(215, 12%, 40%)"
                strokeDasharray="4 4"
                strokeWidth={0.5}
                strokeOpacity={0.5}
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
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </motion.div>
  );
};

export default CashflowChart;
