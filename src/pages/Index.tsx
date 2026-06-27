import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { filterByPeriod, type QuarterFilter } from "@/lib/periodFilter";

import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import {
  BarChart, Bar, ReferenceLine, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import StatCard from "@/components/dashboard/StatCard";
import { chartColors } from "@/lib/chartTheme";
import { formatMetricValue } from "@/lib/formatMetricValue";
import PortfolioChart from "@/components/dashboard/PortfolioChart";
import SectorAllocationChart from "@/components/dashboard/SectorAllocationChart";
import DealPipeline from "@/components/dashboard/DealPipeline";
import FundPerformanceChart from "@/components/dashboard/FundPerformanceChart";
import ForecastChart from "@/components/dashboard/ForecastChart";
import ProjectExecutionKPIs from "@/components/dashboard/ProjectExecutionKPIs";
import RevenueProjectsTable from "@/components/dashboard/RevenueProjectsTable";
import ExpenseBreakdown from "@/components/dashboard/ExpenseBreakdown";
import SectionHeader from "@/components/dashboard/SectionHeader";
import SectionPeriodHeader from "@/components/dashboard/SectionPeriodHeader";
import DashboardLayout from "@/components/DashboardLayout";
import GoalsDashboardWidgets from "@/components/goals/GoalsDashboardWidgets";
import TargetsGoalsSection from "@/components/goals/TargetsGoalsSection";
import DataIntegrityPanel from "@/components/DataIntegrityPanel";
import GoalScenarioBar from "@/components/dashboard/GoalScenarioBar";
import { useGoals } from "@/hooks/useGoals";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { applyGoalMerge } from "@/lib/goalMerge";
import { buildPeriodOptions, getCurrentMonthKey } from "@/lib/projectExecutionKpis";
import { parseMonthKey } from "@/lib/reportDataAssembler";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, Unplug, Loader2 } from "lucide-react";
import { computeMoneyMetrics, scopeLabel as moneyScopeLabel, availableMonthKeys, monthLabel, type MoneyScope } from "@/lib/moneyPeriod";

const fmtAUD = (n: number) => formatMetricValue(n, "currency");
const fmtKAxis = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1000) return `$${Math.round(v / 1000)}k`;
  return `$${v}`;
};
const TOOLTIP_STYLE = {
  backgroundColor: "#1a1a2e",
  border: "1px solid #ffffff20",
  borderRadius: "8px",
  fontSize: "12px",
} as const;

const CACHE_WEBHOOK = "https://n8n.srv1437130.hstgr.cloud/webhook/dashboard-cache";

const GpTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      backgroundColor: "#0f172a",
      border: "1px solid rgba(255,255,255,0.25)",
      borderRadius: "10px",
      padding: "10px 14px",
      boxShadow: "0 4px 24px rgba(0,0,0,0.5)"
    }}>
      <p style={{ color: "#94a3b8", fontSize: "11px", marginBottom: "4px", fontFamily: "monospace" }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: "#ffffff", fontSize: "13px", fontWeight: 600, margin: 0 }}>
          {p.name}: <span style={{ color: p.value >= 0 ? "#22c55e" : "#ef4444" }}>
            {p.value < 0 ? "-" : ""}${Math.abs(p.value / 1000).toFixed(1)}k
          </span>
        </p>
      ))}
    </div>
  );
};

const GpBarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value ?? 0;
  const isPositive = value >= 0;
  return (
    <div style={{
      backgroundColor: "#0f172a",
      border: "1px solid rgba(255,255,255,0.3)",
      borderRadius: "10px",
      padding: "10px 16px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
      minWidth: "160px"
    }}>
      <p style={{
        color: "#94a3b8",
        fontSize: "11px",
        fontFamily: "monospace",
        marginBottom: "6px",
        marginTop: 0
      }}>{label}</p>
      <p style={{
        color: isPositive ? "#22c55e" : "#ef4444",
        fontSize: "15px",
        fontWeight: 700,
        margin: 0,
        fontFamily: "monospace"
      }}>
        {value < 0 ? "-" : ""}${Math.abs(value / 1000).toFixed(1)}k
      </p>
      <p style={{
        color: "#64748b",
        fontSize: "10px",
        margin: "4px 0 0 0"
      }}>Gross Profit</p>
    </div>
  );
};

function WinLossSummaryCard({
  quotedJobs,
  index,
  emphasis,
}: {
  quotedJobs: Array<{ status: string; value: number }>;
  index: number;
  emphasis?: boolean;
}) {
  const [mode, setMode] = useState<"total" | "avg">("total");

  // FY-scoped from qtsSmmry (matches sheet); fall back to quotedJobs derivation
  const ctx = useDashboardData();
  const wonJobs = quotedJobs.filter((j) => j.status === "won");
  const lostJobs = quotedJobs.filter((j) => j.status === "lost");

  const wonValue = ctx.wonValueFY || wonJobs.reduce((s, j) => s + (j.value || 0), 0);
  const lostValue = ctx.lostValueFY || lostJobs.reduce((s, j) => s + (j.value || 0), 0);

  const wonCount = ctx.wrWonFY || wonJobs.length;
  const lostCount = ctx.wrLostFY || lostJobs.length;
  const totalJobs = wonCount + lostCount;


  const wonBarWidth = totalJobs > 0 ? `${(wonCount / totalJobs) * 100}%` : "0%";

  const fmtCompact = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `$${(abs / 1_000).toFixed(1)}K`;
    return `$${Math.round(abs).toLocaleString()}`;
  };

  const topVal = mode === "total" ? wonValue : (wonCount ? wonValue / wonCount : 0);
  const bottomVal = mode === "total" ? lostValue : (lostCount ? lostValue / lostCount : 0);
  const topLabel = mode === "total" ? "WON" : "AVG WON";
  const bottomLabel = mode === "total" ? "LOST" : "AVG LOST";

  const figureStyle: React.CSSProperties = emphasis
    ? { fontSize: 'clamp(1.25rem, 1.6vw, 1.5rem)', lineHeight: 1.15, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.015em' }
    : {};

  const titleClass = emphasis
    ? "font-mono font-semibold uppercase text-foreground/70 tracking-[0.12em] text-[0.7rem] whitespace-normal break-words leading-tight text-center"
    : "font-mono text-muted-foreground font-medium";

  const subClass = emphasis ? "text-[0.65rem] leading-tight text-muted-foreground font-mono whitespace-normal break-words text-center" : "text-[10px] text-muted-foreground font-mono";
  const labelClass = emphasis ? "text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-foreground/80 font-mono text-center" : "text-[10px] text-muted-foreground uppercase tracking-wider font-mono";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className={`stat-card relative overflow-hidden flex flex-col ${emphasis ? "items-center text-center h-full p-3 gap-1" : "gap-0.5"}`}
      style={{ minHeight: emphasis ? undefined : "100px", containerType: 'inline-size' }}
    >
      {/* HEADER — fixed height, 2-line capable, never truncate */}
      <div className={emphasis ? "w-full min-h-[1.5rem] flex items-center justify-center px-1" : "w-full"}>
        <p
          className={titleClass}
          style={emphasis ? { whiteSpace: 'normal', overflow: 'visible' } : {
            fontSize: 'clamp(0.5rem, 1.8cqi, 0.65rem)',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
            maxWidth: '100%',
          }}
        >
          WIN / LOSS SUMMARY
        </p>
      </div>
      {/* PILLS — reserved row */}
      <div className={`${emphasis ? "min-h-[1.5rem]" : ""} flex ${emphasis ? "justify-center items-center" : ""}`}>
        <div className="flex rounded-full bg-secondary/80 p-0.5 leading-none" style={{ fontSize: "clamp(8px, 0.85vw, 10px)" }}>
          <button
            onClick={() => setMode("total")}
            className={`px-1.5 py-0.5 rounded-full transition-all duration-150 font-mono whitespace-nowrap ${
              mode === "total" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >Total</button>
          <button
            onClick={() => setMode("avg")}
            className={`px-1.5 py-0.5 rounded-full transition-all duration-150 font-mono whitespace-nowrap ${
              mode === "avg" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >Avg</button>
        </div>
      </div>

      {/* BODY — figures + subs, divider, centred */}
      <div className={`${emphasis ? "flex-1 flex flex-col items-center justify-center gap-0.5" : ""} w-full min-w-0`}>
        <div className={`min-w-0 ${emphasis ? "w-full" : ""}`}>
          <p className={labelClass}>{topLabel}</p>
          <p className={`font-bold font-mono text-chart-green break-words leading-tight ${emphasis ? '' : 'text-xl'}`} style={figureStyle}>{fmtCompact(topVal)}</p>
          <p className={subClass}>{wonCount} jobs</p>
        </div>

        <div className={`h-px bg-white/10 my-1 ${emphasis ? "w-2/3 mx-auto" : ""}`} />

        <div className={`min-w-0 ${emphasis ? "w-full" : ""}`}>
          <p className={labelClass}>{bottomLabel}</p>
          <p className={`font-bold font-mono text-chart-red break-words leading-tight ${emphasis ? '' : 'text-xl'}`} style={figureStyle}>{fmtCompact(bottomVal)}</p>
          <p className={subClass}>{lostCount} jobs</p>
        </div>
      </div>
    </motion.div>
  );
}

// ── INVOICES PAID / TO-BE-PAID CARD ────────────────────────────────
// Paid (top)        = last calendar month's invoices (received THIS month)
// To be paid (bot.) = this calendar month's invoices (received NEXT month)
// Source: revenueProjects (REVENUE tab), valueInclGST, invoiceDate.
function InvoicesPaidCard({ index, onJumpToMonth }: { index: number; onJumpToMonth?: (target: { year: number; month: number; label: string }) => void }) {
  const { revenueProjects } = useDashboardData();

  const { paid, toBePaid, paidCount, toBePaidCount } = useMemo(() => {
    const now = new Date();
    const curY = now.getFullYear();
    const curM = now.getMonth();
    const prev = new Date(curY, curM - 1, 1);
    const prevY = prev.getFullYear();
    const prevM = prev.getMonth();

    let paid = 0, toBePaid = 0, paidCount = 0, toBePaidCount = 0;
    for (const rp of revenueProjects) {
      if (!rp.invoiceDate) continue;
      const d = new Date(rp.invoiceDate);
      if (isNaN(d.getTime())) continue;
      const y = d.getFullYear();
      const m = d.getMonth();
      const v = rp.valueInclGST || 0;
      if (y === prevY && m === prevM) { paid += v; paidCount++; }
      else if (y === curY && m === curM) { toBePaid += v; toBePaidCount++; }
    }
    return { paid, toBePaid, paidCount, toBePaidCount };
  }, [revenueProjects]);

  const fmtCompact = (n: number) => {
    const abs = Math.abs(n);
    const sign = n < 0 ? "-" : "";
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
    return `${sign}$${Math.round(abs).toLocaleString()}`;
  };

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const MONTHS_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const paidCtx = MONTHS[prev.getMonth()];
  const toBeCtx = MONTHS[now.getMonth()];
  const paidJumpLabel = `${MONTHS_FULL[prev.getMonth()]} ${prev.getFullYear()}`;
  const toBeJumpLabel = `${MONTHS_FULL[now.getMonth()]} ${now.getFullYear()}`;

  const titleClass = "font-mono font-semibold uppercase text-foreground/70 tracking-[0.12em] text-[0.7rem] whitespace-normal break-words leading-tight text-center";
  const labelClass = "text-[0.7rem] font-semibold tracking-wide text-foreground/80 font-mono text-center";
  const subClass = "text-[0.65rem] leading-tight text-muted-foreground font-mono whitespace-normal break-words text-center";
  const subLinkClass = subClass + " cursor-pointer hover:text-foreground hover:underline underline-offset-2 transition-colors";
  const figureStyle: React.CSSProperties = { fontSize: 'clamp(1.25rem, 1.6vw, 1.5rem)', lineHeight: 1.15, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.015em' };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="stat-card relative overflow-hidden flex flex-col items-center text-center h-full p-3 gap-1"
      style={{ containerType: 'inline-size' }}
    >
      <div className="w-full min-h-[1.5rem] flex items-center justify-center px-1">
        <p className={titleClass}>INVOICES</p>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-1.5 w-full min-w-0 text-center">
        <div className="w-full min-w-0">
          <p className={labelClass}>To be Paid</p>
          <p className="leading-tight break-words flex items-baseline justify-center gap-1.5 flex-wrap">
            <span className="font-bold font-mono text-chart-green" style={figureStyle}>{fmtCompact(paid)}</span>
            <button
              type="button"
              onClick={() => onJumpToMonth?.({ year: prev.getFullYear(), month: prev.getMonth(), label: paidJumpLabel })}
              className={subLinkClass}
              title={`Filter Revenue & COGS to ${paidJumpLabel}`}
            >· {paidCount} inv · {paidCtx}</button>
          </p>
        </div>
        <div className="h-px bg-white/10 my-1 w-2/3 mx-auto" />
        <div className="w-full min-w-0">
          <p className={labelClass}>To be Invoiced</p>
          <p className="leading-tight break-words flex items-baseline justify-center gap-1.5 flex-wrap">
            <span className="font-bold font-mono text-foreground/90" style={figureStyle}>{fmtCompact(toBePaid)}</span>
            <button
              type="button"
              onClick={() => onJumpToMonth?.({ year: now.getFullYear(), month: now.getMonth(), label: toBeJumpLabel })}
              className={subLinkClass}
              title={`Filter Revenue & COGS to ${toBeJumpLabel}`}
            >· {toBePaidCount} inv · {toBeCtx}</button>
          </p>
        </div>
      </div>
    </motion.div>
  );
}


// ── AVG CONTRACT VALUE — split (Won top / Quoted bottom), Invoices-style ────────────
function AvgContractCard({
  acvQuoted,
  acvWon,
  acvLost,
  index,
}: {
  acvQuoted: { avg: number; count: number };
  acvWon: { avg: number; count: number };
  acvLost: { avg: number; count: number };
  index: number;
}) {
  const [mode, setMode] = useState<"qw" | "wl">("qw");

  const fmtCompact = (n: number) => {
    const abs = Math.abs(n);
    const sign = n < 0 ? "-" : "";
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
    return `${sign}$${Math.round(abs).toLocaleString()}`;
  };

  const figureStyle: React.CSSProperties = { fontSize: 'clamp(1.25rem, 1.6vw, 1.5rem)', lineHeight: 1.15, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.015em' };
  const titleClass = "font-mono font-semibold uppercase text-foreground/70 tracking-[0.12em] text-[0.7rem] whitespace-normal break-words leading-tight text-center";
  const subClass = "text-[0.65rem] leading-tight text-muted-foreground font-mono whitespace-normal break-words text-center";
  const labelClass = "text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-foreground/80 font-mono text-center";

  // Mode-driven top/bottom
  const top = mode === "qw" ? acvQuoted : acvWon;
  const bottom = mode === "qw" ? acvWon : acvLost;
  const topLabel = mode === "qw" ? "QUOTED" : "WON";
  const bottomLabel = mode === "qw" ? "WON" : "LOST";
  const topNoun = mode === "qw" ? "quoted" : "won";
  const bottomNoun = mode === "qw" ? "won" : "lost";
  // Colour: red only ever for Lost
  const topColor = "text-chart-green";
  const bottomColor = mode === "wl" ? "text-chart-red" : "text-chart-green";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="stat-card relative overflow-hidden flex flex-col items-center text-center h-full p-3 gap-1"
      style={{ containerType: 'inline-size' }}
    >
      <div className="w-full min-h-[1.5rem] flex items-center justify-center px-1">
        <p className={titleClass}>AVG CONTRACT VALUE</p>
      </div>
      {/* PILLS */}
      <div className="min-h-[1.5rem] flex justify-center items-center">
        <div className="flex rounded-full bg-secondary/80 p-0.5 leading-none" style={{ fontSize: "clamp(8px, 0.85vw, 10px)" }}>
          <button
            onClick={() => setMode("qw")}
            className={`px-1.5 py-0.5 rounded-full transition-all duration-150 font-mono whitespace-nowrap ${
              mode === "qw" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >Quoted vs Won</button>
          <button
            onClick={() => setMode("wl")}
            className={`px-1.5 py-0.5 rounded-full transition-all duration-150 font-mono whitespace-nowrap ${
              mode === "wl" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >Won vs Lost</button>
        </div>
      </div>
      {/* BODY */}
      <div className="flex-1 flex flex-col items-center justify-center gap-0.5 w-full min-w-0">
        <div className="min-w-0 w-full">
          <p className={labelClass}>{topLabel}</p>
          <p className={`font-bold font-mono ${topColor} break-words leading-tight`} style={figureStyle}>{fmtCompact(top.avg)}</p>
          <p className={subClass}>{top.count} jobs {topNoun}</p>
        </div>
        <div className="h-px bg-white/10 my-1 w-2/3 mx-auto" />
        <div className="min-w-0 w-full">
          <p className={labelClass}>{bottomLabel}</p>
          <p className={`font-bold font-mono ${bottomColor} break-words leading-tight`} style={figureStyle}>{fmtCompact(bottom.avg)}</p>
          <p className={subClass}>{bottom.count} jobs {bottomNoun}</p>
        </div>
      </div>
    </motion.div>
  );
}


// ── REVENUE GROWTH — scope-aware (% growth or $ total) ─────────────────
function RevenueGrowthCard({ scope, index, defaultView = "pct", dollarOverride }: { scope: "ytd" | "quarter"; index: number; defaultView?: "pct" | "dollar"; dollarOverride?: { value: number; label: string } | null }) {
  const { incomeOutgoingsData } = useDashboardData();
  const [view, setView] = useState<"pct" | "dollar">(defaultView);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const fmtCompact = (n: number) => {
    const abs = Math.abs(n);
    const sign = n < 0 ? "-" : "";
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
    return `${sign}$${Math.round(abs).toLocaleString()}`;
  };

  const data = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();

    const monthly: { monthIdx: number; income: number }[] = [];
    for (const pt of incomeOutgoingsData) {
      const k = parseMonthKey(pt.month);
      if (!k) continue;
      if (k.year !== curYear) continue;
      if (k.monthIdx > curMonth) continue;
      monthly.push({ monthIdx: k.monthIdx, income: pt.income || 0 });
    }
    monthly.sort((a, b) => a.monthIdx - b.monthIdx);

    // YTD pct
    const rates: number[] = [];
    for (let i = 1; i < monthly.length; i++) {
      const prev = monthly[i - 1].income;
      const cur = monthly[i].income;
      if (prev > 0 && cur > 0) rates.push(((cur - prev) / prev) * 100);
    }
    const ytdPctNA = rates.length === 0;
    const ytdPct = ytdPctNA ? 0 : rates.reduce((s, r) => s + r, 0) / rates.length;
    const ytdTotal = monthly.reduce((s, m) => s + m.income, 0);
    const firstM = monthly[0]?.monthIdx ?? 0;
    const lastM = monthly[monthly.length - 1]?.monthIdx ?? curMonth;

    // Quarter
    const qIdx = Math.floor(curMonth / 3);
    const qStart = qIdx * 3;
    const prevQStart = qStart - 3;
    const qTotal = monthly.filter(m => m.monthIdx >= qStart && m.monthIdx < qStart + 3).reduce((s, m) => s + m.income, 0);
    const prevTotal = prevQStart >= 0
      ? monthly.filter(m => m.monthIdx >= prevQStart && m.monthIdx < prevQStart + 3).reduce((s, m) => s + m.income, 0)
      : 0;
    const qPctNA = prevTotal <= 0;
    const qPct = qPctNA ? 0 : ((qTotal - prevTotal) / prevTotal) * 100;
    const qDelta = qTotal - prevTotal;

    return {
      monthly,
      ytdPct, ytdPctNA, ytdTotal,
      firstM, lastM,
      qIdx, qPct, qPctNA, qTotal, prevTotal, qDelta,
    };
  }, [incomeOutgoingsData]);

  const isYTD = scope === "ytd";
  const isPct = view === "pct";

  // Headline + sub + color
  let headline = "—";
  let sub = "";
  let positive = true;
  let isNA = false;

  if (isYTD && isPct) {
    isNA = data.ytdPctNA;
    positive = data.ytdPct >= 0;
    headline = isNA ? "—" : `${data.ytdPct >= 0 ? "+" : ""}${data.ytdPct.toFixed(1)}%`;
    sub = `${MONTH_ABBR[data.firstM]}–${MONTH_ABBR[data.lastM]} · avg MoM`;
  } else if (isYTD && !isPct) {
    positive = true;
    isNA = data.ytdTotal <= 0;
    headline = isNA ? "—" : fmtCompact(data.ytdTotal);
    sub = `${MONTH_ABBR[data.firstM]}–${MONTH_ABBR[data.lastM]} YTD`;
  } else if (!isYTD && isPct) {
    isNA = data.qPctNA;
    positive = data.qPct >= 0;
    const prevQName = data.qIdx > 0 ? `Q${data.qIdx}` : "—";
    headline = isNA ? "—" : `${data.qPct >= 0 ? "+" : ""}${data.qPct.toFixed(1)}%`;
    sub = isNA ? `Q${data.qIdx + 1} vs ${prevQName}` : `Q${data.qIdx + 1} vs ${prevQName}`;
  } else {
    positive = data.qDelta >= 0;
    isNA = data.qTotal <= 0;
    const prevQName = data.qIdx > 0 ? `Q${data.qIdx}` : "—";
    headline = isNA ? "—" : fmtCompact(data.qTotal);
    sub = data.qIdx > 0
      ? `Q${data.qIdx + 1} · ${data.qDelta >= 0 ? "+" : ""}${fmtCompact(data.qDelta)} vs ${prevQName}`
      : `Q${data.qIdx + 1} total`;
  }

  if (!isPct && dollarOverride) {
    isNA = !(dollarOverride.value > 0);
    positive = dollarOverride.value >= 0;
    headline = isNA ? "—" : fmtCompact(dollarOverride.value);
    sub = dollarOverride.label;
  }

  const titleClass = "font-mono font-semibold uppercase text-foreground/70 tracking-[0.12em] text-[0.7rem] whitespace-normal break-words leading-tight text-center";
  const subClass = "text-[0.65rem] leading-tight text-muted-foreground font-mono whitespace-normal break-words text-center";
  const figureStyle: React.CSSProperties = { fontSize: 'clamp(1.35rem, 1.9vw, 1.7rem)', lineHeight: 1.15, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.015em' };
  const colorClass = isNA ? "text-muted-foreground" : positive ? "text-chart-green" : "text-chart-red";

  // Chart: in YTD scope show monthly bars; in Quarter scope show prev-Q vs cur-Q bars
  const chartBars: { label: string; value: number }[] = isYTD
    ? data.monthly.map(m => ({ label: MONTH_ABBR[m.monthIdx], value: m.income }))
    : (() => {
        const prevQName = data.qIdx > 0 ? `Q${data.qIdx}` : "—";
        return [
          { label: prevQName, value: data.prevTotal },
          { label: `Q${data.qIdx + 1}`, value: data.qTotal },
        ];
      })();

  const chartCaption = isYTD
    ? "Monthly revenue — the months making up this growth"
    : "Quarterly revenue — current quarter vs prior quarter";

  const chartTitle = hoverIdx != null && chartBars[hoverIdx]
    ? `${chartBars[hoverIdx].label} • ${fmtCompact(chartBars[hoverIdx].value)}`
    : chartCaption;

  const chartSvg = (() => {
    if (chartBars.length === 0) return null;
    const W = 120, H = 28, P = 1;
    const max = Math.max(...chartBars.map(b => b.value), 1);
    const bw = (W - P * 2) / chartBars.length;
    return (
      <div className="w-full mt-1 cursor-pointer" title={chartTitle}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-7"
          preserveAspectRatio="none"
          onMouseLeave={() => setHoverIdx(null)}
        >
          {chartBars.map((b, i) => {
            const h = max > 0 ? (b.value / max) * (H - 2) : 0;
            const fill = isYTD
              ? (positive ? "fill-chart-green/70" : "fill-chart-red/70")
              : (i === chartBars.length - 1
                  ? (positive ? "fill-chart-green/70" : "fill-chart-red/70")
                  : "fill-muted-foreground/40");
            return (
              <g key={i}>
                <rect
                  x={P + i * bw + bw * 0.15}
                  y={H - h - 1}
                  width={Math.max(1, bw * 0.7)}
                  height={Math.max(1, h)}
                  className={`${fill} ${hoverIdx === i ? "opacity-100" : "opacity-90"}`}
                />
                {/* hover hit area covering full column height */}
                <rect
                  x={P + i * bw}
                  y={0}
                  width={bw}
                  height={H}
                  fill="transparent"
                  onMouseEnter={() => setHoverIdx(i)}
                  onTouchStart={() => setHoverIdx(i)}
                  style={{ cursor: 'pointer' }}
                >
                  <title>{`${b.label} • ${fmtCompact(b.value)}`}</title>
                </rect>
              </g>
            );
          })}
        </svg>
        <p className={subClass + " mt-0.5"} style={{ minHeight: '0.85rem' }}>
          {hoverIdx != null && chartBars[hoverIdx]
            ? `${chartBars[hoverIdx].label} • ${fmtCompact(chartBars[hoverIdx].value)}`
            : ""}
        </p>
      </div>
    );
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="stat-card relative overflow-hidden flex flex-col items-center text-center h-full p-3 gap-1"
      style={{ containerType: 'inline-size' }}
    >
      <div className="w-full min-h-[1.5rem] flex items-center justify-center px-1">
        <p className={titleClass}>REVENUE GROWTH</p>
      </div>
      {/* % | $ toggle — same styling as PerJob/Op.Expense pill */}
      <div className="min-h-[1.5rem] flex justify-center items-center">
        <div className="flex rounded-full bg-secondary/80 p-0.5 leading-none" style={{ fontSize: "clamp(8px, 0.85vw, 10px)" }}>
          <button
            onClick={() => setView("dollar")}
            className={`px-1.5 py-0.5 rounded-full transition-all duration-150 font-mono whitespace-nowrap ${view === "dollar" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >$</button>
          <button
            onClick={() => setView("pct")}
            className={`px-1.5 py-0.5 rounded-full transition-all duration-150 font-mono whitespace-nowrap ${view === "pct" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >%</button>
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center w-full min-w-0 text-center gap-0.5">
        <span className={`font-bold font-mono ${colorClass}`} style={figureStyle}>{headline}</span>
        <span className={subClass}>{sub}</span>
        {chartSvg}
      </div>
    </motion.div>
  );
}





function PerJobCard({
  grossRevPerJob,
  netRevPerJob,
  grossProfitPerJob,
  netProfitPerJob,
  wonCount,
  index,
}: {
  grossRevPerJob: number;
  netRevPerJob: number;
  grossProfitPerJob: number;
  netProfitPerJob: number;
  wonCount: number;
  index: number;
}) {
  const [mode, setMode] = useState<"revenue" | "profit">("revenue");

  const fmtCompact = (n: number) => {
    const abs = Math.abs(n);
    const sign = n < 0 ? "-" : "";
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
    return `${sign}$${Math.round(abs).toLocaleString()}`;
  };

  const isRevenue = mode === "revenue";
  const topVal = isRevenue ? grossRevPerJob : grossProfitPerJob;
  const bottomVal = isRevenue ? netRevPerJob : netProfitPerJob;
  const topLabel = isRevenue ? "GROSS REV / JOB" : "GROSS PROFIT / JOB";
  const bottomLabel = isRevenue ? "NET REV / JOB" : "NET PROFIT / JOB";
  const topColor = isRevenue ? "text-chart-green" : (topVal >= 0 ? "text-chart-green" : "text-chart-red");
  const bottomColor = isRevenue ? "text-chart-green" : (bottomVal >= 0 ? "text-chart-green" : "text-chart-red");

  const titleClass = "font-mono font-semibold uppercase text-foreground/70 tracking-[0.12em] text-[0.7rem] whitespace-normal break-words leading-tight text-center";
  const labelClass = "text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-foreground/80 font-mono text-center";
  const subClass = "text-[0.65rem] leading-tight text-muted-foreground font-mono text-center";
  const figureStyle: React.CSSProperties = { fontSize: 'clamp(1.25rem, 1.6vw, 1.5rem)', lineHeight: 1.15, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.015em' };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="stat-card relative overflow-hidden flex flex-col items-center text-center h-full p-3 gap-1"
      style={{ containerType: 'inline-size' }}
    >
      <div className="w-full min-h-[1.5rem] flex items-center justify-center px-1">
        <p className={titleClass}>PER JOB</p>
      </div>
      <div className="min-h-[1.5rem] flex justify-center items-center">
        <div className="flex rounded-full bg-secondary/80 p-0.5 leading-none" style={{ fontSize: "clamp(8px, 0.85vw, 10px)" }}>
          <button
            onClick={() => setMode("revenue")}
            className={`px-1.5 py-0.5 rounded-full transition-all duration-150 font-mono whitespace-nowrap ${mode === "revenue" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >Revenue</button>
          <button
            onClick={() => setMode("profit")}
            className={`px-1.5 py-0.5 rounded-full transition-all duration-150 font-mono whitespace-nowrap ${mode === "profit" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >Profit</button>
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-0.5 w-full min-w-0 text-center">
        <div className="w-full min-w-0">
          <p className={labelClass}>{topLabel}</p>
          <p className={`font-bold font-mono break-words leading-tight ${topColor}`} style={figureStyle}>{fmtCompact(topVal)}</p>
        </div>
        <div className="h-px bg-white/10 my-1 w-2/3 mx-auto" />
        <div className="w-full min-w-0">
          <p className={labelClass}>{bottomLabel}</p>
          <p className={`font-bold font-mono break-words leading-tight ${bottomColor}`} style={figureStyle}>{fmtCompact(bottomVal)}</p>
        </div>
        <p className={subClass + " mt-1"}>{wonCount} jobs won</p>
      </div>
    </motion.div>
  );
}


type RevPeriodData = { gross: number; net: number; cogs: number; grossProfit: number };

function RevenueProfitCard({
  grossRevenue,
  netRevenue,
  grossProfit,
  netProfit,
  rev2026,
  revYTD,
  netProfit2026,
  netProfitYTD,
  index,
  emphasis,
}: {
  grossRevenue: number;
  netRevenue: number;
  grossProfit: number;
  netProfit: number;
  rev2026?: RevPeriodData;
  revYTD?: RevPeriodData;
  netProfit2026?: number;
  netProfitYTD?: number;
  index: number;
  emphasis?: boolean;
}) {
  const [mode, setMode] = useState<"revenue" | "profit">("revenue");
  const [period, setPeriod] = useState<"2026" | "ytd">("ytd");
  

  const fmtCompact = (n: number) => {
    const abs = Math.abs(n);
    const sign = n < 0 ? "-" : "";
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
    return `${sign}$${Math.round(abs).toLocaleString()}`;
  };

  // Resolve period-scoped figures (fallback to legacy props if extras absent)
  const fallback2026: RevPeriodData = { gross: grossRevenue, net: netRevenue, cogs: 0, grossProfit };
  const fallbackYTD: RevPeriodData = { gross: grossRevenue, net: netRevenue, cogs: 0, grossProfit };
  const periodData = period === "ytd" ? (revYTD ?? fallbackYTD) : (rev2026 ?? fallback2026);
  const periodNetProfit = period === "ytd" ? (netProfitYTD ?? netProfit) : (netProfit2026 ?? netProfit);

  const isRevenue = mode === "revenue";
  const topVal = isRevenue ? periodData.gross : periodData.grossProfit;
  const bottomVal = isRevenue ? periodData.net : periodNetProfit;
  const topLabel = isRevenue ? "GROSS REVENUE" : "GROSS PROFIT";
  const bottomLabel = isRevenue ? "NET REVENUE" : "NET PROFIT";

  const topColor = isRevenue ? "text-chart-green" : (topVal >= 0 ? "text-chart-green" : "text-chart-red");
  const bottomColor = isRevenue ? "text-chart-green" : (bottomVal >= 0 ? "text-chart-green" : "text-chart-red");

  const figureStyle: React.CSSProperties = emphasis
    ? { fontSize: 'clamp(1.25rem, 1.6vw, 1.5rem)', lineHeight: 1.15, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.015em' }
    : {};

  const titleClass = emphasis
    ? "font-mono font-semibold uppercase text-foreground/70 tracking-[0.12em] text-[0.7rem] whitespace-normal break-words leading-tight text-center"
    : "font-mono text-muted-foreground font-medium";
  const labelClass = emphasis ? "text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-foreground/80 font-mono text-center" : "text-[10px] text-muted-foreground uppercase tracking-wider font-mono";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className={`stat-card relative overflow-hidden flex flex-col ${emphasis ? "items-center text-center h-full p-3 gap-1" : "gap-0.5"}`}
      style={{ minHeight: emphasis ? undefined : "100px", containerType: 'inline-size' }}
    >
      {/* HEADER */}
      <div className={emphasis ? "w-full min-h-[1.5rem] flex items-center justify-center px-1" : "w-full"}>
        <p
          className={titleClass}
          style={emphasis ? { whiteSpace: 'normal', overflow: 'visible' } : {
            fontSize: 'clamp(0.5rem, 1.8cqi, 0.65rem)',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
            maxWidth: '100%',
          }}
        >
          REVENUE / PROFIT
        </p>
      </div>
      {/* PILLS */}
      <div className={`${emphasis ? "min-h-[1.5rem]" : ""} flex justify-between items-center gap-1 flex-wrap`}>
        <div className="flex rounded-full bg-secondary/80 p-0.5 leading-none" style={{ fontSize: "clamp(8px, 0.85vw, 10px)" }}>
          <button
            onClick={() => setMode("revenue")}
            className={`px-1.5 py-0.5 rounded-full transition-all duration-150 font-mono whitespace-nowrap ${
              mode === "revenue" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >Revenue</button>
          <button
            onClick={() => setMode("profit")}
            className={`px-1.5 py-0.5 rounded-full transition-all duration-150 font-mono whitespace-nowrap ${
              mode === "profit" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >Profit</button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPeriod("ytd")}
            className={`text-[11px] font-mono transition-colors ${
              period === "ytd"
                ? "px-2.5 py-1 rounded-full border bg-chart-green/20 text-chart-green border-chart-green/40"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            YTD
          </button>
          <button
            onClick={() => setPeriod("2026")}
            className={`text-[11px] font-mono transition-colors ${
              period === "2026"
                ? "px-2.5 py-1 rounded-full border bg-chart-green/20 text-chart-green border-chart-green/40"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            2026
          </button>
        </div>
      </div>

      {/* BODY */}
      <div className={`${emphasis ? "flex-1 flex flex-col items-center justify-center gap-0.5" : ""} w-full min-w-0`}>
        <div className={`min-w-0 ${emphasis ? "w-full" : ""}`}>
          <p className={labelClass}>{topLabel}</p>
          <p className={`font-bold font-mono break-words leading-tight ${topColor} ${emphasis ? '' : 'text-xl'}`} style={figureStyle}>{fmtCompact(topVal)}</p>
        </div>

        <div className={`h-px bg-white/10 my-1 ${emphasis ? "w-2/3 mx-auto" : ""}`} />

        <div className={`min-w-0 ${emphasis ? "w-full" : ""}`}>
          <p className={labelClass}>{bottomLabel}</p>
          <p className={`font-bold font-mono break-words leading-tight ${bottomColor} ${emphasis ? '' : 'text-xl'}`} style={figureStyle}>{fmtCompact(bottomVal)}</p>
        </div>
      </div>
    </motion.div>
  );
}




function PipelineSummaryCard({
  topCount,
  topSub,
  bottomCount,
  bottomValue,
  index,
  emphasis,
  noData,
}: {
  topCount: string;
  topSub: string;
  bottomCount: number;
  bottomValue: number;
  index: number;
  emphasis?: boolean;
  noData?: boolean;
}) {
  const fmtCompact = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `$${(abs / 1_000).toFixed(1)}K`;
    return `$${Math.round(abs).toLocaleString()}`;
  };

  const figureStyle: React.CSSProperties = emphasis
    ? { fontSize: 'clamp(1.25rem, 1.6vw, 1.5rem)', lineHeight: 1.15, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.015em' }
    : {};

  const titleClass = emphasis
    ? "font-mono font-semibold uppercase text-foreground/70 tracking-[0.12em] text-[0.7rem] whitespace-normal break-words leading-tight text-center"
    : "font-mono text-muted-foreground font-medium";
  const subClass = emphasis ? "text-[0.65rem] leading-tight text-muted-foreground font-mono whitespace-normal break-words text-center" : "text-[10px] text-muted-foreground font-mono";
  const labelClass = emphasis ? "text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-foreground/80 font-mono text-center" : "text-[10px] text-muted-foreground uppercase tracking-wider font-mono";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className={`stat-card relative overflow-hidden flex flex-col ${emphasis ? "items-center text-center h-full p-3 gap-1" : "gap-0.5"}`}
      style={{ minHeight: emphasis ? undefined : "100px", containerType: 'inline-size' }}
    >
      {/* HEADER */}
      <div className={emphasis ? "w-full min-h-[1.5rem] flex items-center justify-center px-1" : "w-full"}>
        <p
          className={titleClass}
          style={emphasis ? { whiteSpace: 'normal', overflow: 'visible' } : {
            fontSize: 'clamp(0.5rem, 1.8cqi, 0.65rem)',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
            maxWidth: '100%',
          }}
        >
          PIPELINE
        </p>
      </div>
      {/* BODY */}
      <div className={`${emphasis ? "flex-1 flex flex-col items-center justify-center gap-0.5" : ""} w-full min-w-0`}>
        <div className={`min-w-0 ${emphasis ? "w-full" : ""}`}>
          <p className={labelClass}>QUOTING OPPS</p>
          <p className={`font-bold font-mono text-chart-green break-words leading-tight ${emphasis ? '' : 'text-xl'}`} style={figureStyle}>{noData ? "—" : topCount}</p>
        </div>

        <div className={`h-px bg-white/10 my-1 ${emphasis ? "w-2/3 mx-auto" : ""}`} />

        <div className={`min-w-0 ${emphasis ? "w-full" : ""}`}>
          <p className={labelClass}>IN THE RUNNING</p>
          <p className={`font-bold font-mono text-chart-green break-words leading-tight ${emphasis ? '' : 'text-xl'}`} style={figureStyle}>{String(bottomCount)}</p>
          <p className={subClass}>{`${fmtCompact(bottomValue)} · active quotes`}</p>
        </div>
      </div>
    </motion.div>
  );
}



function ConversionRatesCard({
  quotedJobs,
  noData,
  index,
  emphasis,
}: {
  quotedJobs: Array<{ status: string }>;
  noData?: boolean;
  index: number;
  emphasis?: boolean;
}) {
  const [mode, setMode] = useState<"confirmed" | "ylw" | "pipeline">("confirmed");

  // FY-scoped from qtsSmmry (matches sheet); fall back to legacy quotedJobs derivation
  const ctx = useDashboardData();
  const legacyWon  = quotedJobs.filter((j) => j.status === "won").length;
  const legacyLost = quotedJobs.filter((j) => j.status === "lost").length;
  const legacyYlw  = quotedJobs.filter((j) => j.status === "yellow").length;
  const wrWon  = ctx.wrWonFY  || legacyWon;
  const wrLost = ctx.wrLostFY || legacyLost;
  const wrYlw  = ctx.wrYlwFY  || legacyYlw;
  const totalOpps = ctx.totalOpps || quotedJobs.length;

  const winRateConfirmed = (wrWon + wrLost) > 0 ? (wrWon / (wrWon + wrLost)) * 100 : 0;
  const winRateWithYlw = (wrWon + wrYlw + wrLost) > 0 ? ((wrWon + wrYlw) / (wrWon + wrYlw + wrLost)) * 100 : 0;
  const pipelineConversion = totalOpps > 0 ? (wrWon / totalOpps) * 100 : 0;


  let figure: string;
  let sub: string;
  let figureColor: string;

  if (mode === "confirmed") {
    figure = noData ? "--" : `${winRateConfirmed.toFixed(1)}%`;
    sub = noData ? "" : `${wrWon} won / ${wrLost} lost`;
    figureColor = "text-chart-green";
  } else if (mode === "ylw") {
    figure = noData ? "--" : `${winRateWithYlw.toFixed(1)}%`;
    sub = noData ? "" : `${wrWon + wrYlw} won incl YLW / ${wrLost} lost`;
    figureColor = "text-amber-400";
  } else {
    figure = noData ? "--" : `${pipelineConversion.toFixed(1)}%`;
    sub = noData ? "" : `${wrWon} won of ${totalOpps} total`;
    figureColor = "text-chart-green";
  }

  const figureStyle: React.CSSProperties = emphasis
    ? { fontSize: 'clamp(1.25rem, 1.6vw, 1.5rem)', lineHeight: 1.15, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.015em' }
    : {};

  const titleClass = emphasis
    ? "font-mono font-semibold uppercase text-foreground/70 tracking-[0.12em] text-[0.7rem] whitespace-normal break-words leading-tight text-center"
    : "font-mono text-muted-foreground font-medium";

  const pillClass = (active: boolean, color: "blue" | "yellow") =>
    `px-1.5 py-0.5 rounded-full transition-all duration-150 font-mono whitespace-nowrap ${
      active ? (color === "yellow" ? "text-black shadow-sm" : "text-white shadow-sm") : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className={`stat-card relative overflow-hidden flex flex-col ${emphasis ? "items-center text-center h-full p-3 gap-1" : "gap-0.5"}`}
      style={{ minHeight: emphasis ? undefined : "100px", containerType: 'inline-size' }}
    >
      {/* HEADER */}
      <div className={emphasis ? "w-full min-h-[1.5rem] flex items-center justify-center px-1" : "w-full"}>
        <p className={titleClass} style={emphasis ? { whiteSpace: 'normal', overflow: 'visible' } : undefined}>
          CONVERSION RATES
        </p>
      </div>
      {/* PILLS */}
      <div className={`${emphasis ? "min-h-[1.5rem]" : ""} flex ${emphasis ? "justify-center items-center" : ""}`}>
        <div className="flex rounded-full bg-secondary/80 p-0.5 leading-none" style={{ fontSize: "clamp(8px, 0.85vw, 10px)" }}>
          <button
            onClick={() => setMode("confirmed")}
            className={pillClass(mode === "confirmed", "blue")}
            style={mode === "confirmed" ? { backgroundColor: "#3D89DA" } : undefined}
          >
            Confirmed
          </button>
          <button
            onClick={() => setMode("ylw")}
            className={pillClass(mode === "ylw", "yellow")}
            style={mode === "ylw" ? { backgroundColor: "#E8B931" } : undefined}
          >
            With YLWs
          </button>
          <button
            onClick={() => setMode("pipeline")}
            className={pillClass(mode === "pipeline", "blue")}
            style={mode === "pipeline" ? { backgroundColor: "#3D89DA" } : undefined}
          >
            Pipeline
          </button>
        </div>
      </div>

      {/* BODY */}
      <div className={`${emphasis ? "flex-1 flex flex-col items-center justify-center gap-0.5" : ""} w-full min-w-0`}>
        <p className={`font-mono font-bold break-words leading-tight ${figureColor} ${emphasis ? '' : 'text-xl'}`} style={figureStyle}>
          {figure}
        </p>
        <p className="text-[0.65rem] leading-tight text-muted-foreground font-mono whitespace-normal break-words text-center">
          {sub}
        </p>
      </div>
    </motion.div>
  );
}



function MonthlyInvoicesVsTargetChart({
  monthlyInvoicesData,
  invoicesTarget,
  onInvoicesTargetChange,
  year,
  quarter,
}: {
  monthlyInvoicesData: Array<{ month: string; invoiced: number; revenueCheck: number }>;
  invoicesTarget: number;
  onInvoicesTargetChange: (v: number) => void;
  year: string;
  quarter: QuarterFilter;
}) {
  const data = useMemo(
    () => filterByPeriod(monthlyInvoicesData, year, quarter),
    [monthlyInvoicesData, year, quarter],
  );

  const handleTargetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onInvoicesTargetChange(Number(e.target.value) || 0);
  };

  const maxInvoiced = data.reduce((m, d) => Math.max(m, d.invoiced || 0), 0);
  const scaleMax = Math.max(invoicesTarget, maxInvoiced, 1);
  const totalInvoiced = data.reduce((s, d) => s + (d.invoiced || 0), 0);
  const totalTarget = invoicesTarget * data.length;
  const pct = totalTarget > 0 ? (totalInvoiced / totalTarget) * 100 : 0;
  const pctClamped = Math.min(100, Math.max(0, pct));
  const fmtMoney = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;

  const periodLabel =
    quarter === "all"
      ? (year === "all" ? "All periods" : year)
      : `${quarter} ${year}`;

  return (
    <div className="chart-container h-full min-h-[340px]">
      <div className="flex flex-col h-full">
        <div className="flex items-start justify-between gap-3 mb-3 flex-shrink-0">
          <div>
            <h3 className="text-sm font-medium text-foreground">Monthly Invoices</h3>
          </div>

          <label className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
            Monthly Invoice Target $
            <input
              type="number"
              value={invoicesTarget}
              onChange={handleTargetChange}
              className="bg-white/5 border border-white/10 rounded px-2 py-1 text-sm w-32 text-right font-mono text-foreground"
            />
          </label>
        </div>

        {/* Period KPI line */}
        <div className="mb-3 flex-shrink-0">
          <p className="text-xs font-mono text-muted-foreground">
            <span className="text-foreground">{periodLabel}</span> invoiced:{" "}
            <span className="text-foreground">{fmtMoney(totalInvoiced)}</span> of{" "}
            <span className="text-foreground">{fmtMoney(totalTarget)}</span> target{" "}
            <span style={{ color: pct >= 100 ? "#22C55E" : "#f59e0b" }}>({pct.toFixed(0)}%)</span>
          </p>
          <div className="mt-1 h-1 w-full rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pctClamped}%`, backgroundColor: "#22C55E" }}
            />
          </div>
        </div>

        {/* Bullet rows */}
        {data.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground font-mono">No data for this period</p>
          </div>
        ) : (
          <div
            className={`flex-1 flex flex-col ${
              data.length > 6 ? "justify-start gap-3 overflow-hidden" : "justify-evenly"
            }`}
          >
            {data.map((d) => {
              const invoiced = d.invoiced || 0;
              const barPct = Math.min(100, (invoiced / scaleMax) * 100);
              const targetPct = Math.min(100, (invoicesTarget / scaleMax) * 100);
              const hitTarget = invoiced >= invoicesTarget;
              return (
                <div key={d.month} className="flex items-center gap-3 min-h-[44px] px-1">
                  <span
                    className="text-[11px] font-mono text-muted-foreground text-left shrink-0"
                    style={{ width: 60 }}
                  >
                    {d.month}
                  </span>
                  <div className="relative flex-1 h-full rounded-sm bg-white/[0.04] overflow-hidden">
                    {/* invoiced bar */}
                    <div
                      className="absolute inset-y-0 left-0 rounded-sm transition-all"
                      style={{
                        width: `${barPct}%`,
                        backgroundColor: "#22C55E",
                        opacity: hitTarget ? 1 : 0.4,
                      }}
                    />
                    {/* target tick */}
                    <div
                      className="absolute inset-y-0"
                      style={{
                        left: `${targetPct}%`,
                        width: 2,
                        backgroundColor: "#F5A623",
                        transform: "translateX(-1px)",
                      }}
                      title={`Target ${fmtMoney(invoicesTarget)}`}
                    />
                  </div>
                  <span
                    className="text-[11px] font-mono text-foreground text-right shrink-0 tabular-nums"
                    style={{ width: 80 }}
                  >
                    {fmtMoney(invoiced)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function MonthlyNetProfitChart({
  monthlyNetProfitData,
  year,
  quarter,
  isOverridden,
  onOverrideQuarter,
}: {
  monthlyNetProfitData: Array<{ month: string; netProfit: number }>;
  year: string;
  quarter: QuarterFilter;
  isOverridden: boolean;
  onOverrideQuarter: (q: QuarterFilter) => void;
}) {
  const data = useMemo(
    () => filterByPeriod(monthlyNetProfitData, year, quarter),
    [monthlyNetProfitData, year, quarter],
  );
  const tc = chartColors();

  const periodLabel =
    quarter === "all" ? (year === "all" ? "All periods" : year) : `${quarter} ${year}`;
  const periodTotal = data.reduce((sum, d) => sum + d.netProfit, 0);

  return (
    <div className="chart-container h-full">
      <div className="flex flex-col h-full">
        <div className="flex items-start justify-between gap-3 mb-3 flex-shrink-0">
          <div>
            <h3 className="text-sm font-medium text-foreground">Monthly Net Profit</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Profit each month after all expenses and debt.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isOverridden && (
              <span className="text-[10px] font-mono text-muted-foreground">• custom</span>
            )}
            <Select value={quarter} onValueChange={(v) => onOverrideQuarter(v as QuarterFilter)}>
              <SelectTrigger className="h-7 w-[90px] text-xs bg-white/5 border-white/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Q1">Q1</SelectItem>
                <SelectItem value="Q2">Q2</SelectItem>
                <SelectItem value="Q3">Q3</SelectItem>
                <SelectItem value="Q4">Q4</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mb-3 flex-shrink-0">
          <p className="text-xs font-mono text-muted-foreground">
            <span className="text-foreground">{periodLabel}</span> net profit:{" "}
            <span className="text-foreground">{formatMetricValue(periodTotal, "currency")}</span>
          </p>
        </div>

        {data.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground font-mono">No data for this period</p>
          </div>
        ) : (
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke={tc.grid} strokeOpacity={0.6} />
                <XAxis dataKey="month" stroke={tc.axis} fontSize={11} fontFamily="JetBrains Mono" />
                <YAxis
                  stroke={tc.axis}
                  fontSize={11}
                  fontFamily="JetBrains Mono"
                  tickFormatter={(v) => `$${Math.round(v / 1000)}k`}
                  domain={[(min) => Math.min(0, min), (max) => Math.ceil((max * 1.12) / 1000) * 1000]}
                />
                <Tooltip
                  formatter={(v) => [formatMetricValue(Number(v), "currency"), "Net Profit"]}
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #ffffff30",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <ReferenceLine y={0} stroke={tc.zeroLine || "#555"} strokeDasharray="3 3" />
                <Bar dataKey="netProfit" radius={[3, 3, 0, 0]} animationDuration={800}>
                  {data.map((d, i) => (
                    <Cell key={i} fill={d.netProfit >= 0 ? "#15803D" : "#7F1D1D"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}




function timeAgo(ts: number | null): string {
  if (!ts) return "never";
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

const ACTIVE_GOALS_KEY = "tt_active_goal_ids";

function loadActiveGoalIds(allGoals: {id: string;merge?: boolean;}[]): Set<string> {
  try {
    const raw = localStorage.getItem(ACTIVE_GOALS_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set(allGoals.filter((g) => g.merge).map((g) => g.id));
}

const DashboardContent = () => {
  const { goals, updateGoal } = useGoals();
  const { formulas, kpiStats, hasLiveData, connectedCount, dataHealth, isLoading, isRefreshing, lastUpdated, sources, syncNow, syncCalendar, formulaCache, incomeOutgoingsData, forecastChartData, quotedJobs, investorMetrics, isOffline, lastCachedAt, revenueProjects, dataStore, liveData, inRunningCount, inRunningValue, monthlyInvoicesData, monthlyNetProfitData } = useDashboardData();

  // ── Shared period selector across PortfolioChart / MonthlyInvoices / MonthlyNetProfit ──
  const [periodYear, setPeriodYear] = useState<string>(() => String(new Date().getFullYear()));
  const [periodQuarter, setPeriodQuarter] = useState<QuarterFilter>(() => {
    const q = ["Q1","Q1","Q1","Q2","Q2","Q2","Q3","Q3","Q3","Q4","Q4","Q4"][new Date().getMonth()];
    return q as QuarterFilter;
  });

  // Independent override for the lower pair (Invoices + Net Profit). Not persisted.
  const [lowerOverride, setLowerOverride] = useState<{ year: string; quarter: QuarterFilter } | null>(null);
  const lowerPeriod = lowerOverride ?? { year: periodYear, quarter: periodQuarter };

  // Cash-flow pills re-link the lower pair on use.
  const handleSharedYearChange = useCallback((y: string) => {
    setPeriodYear(y);
    setLowerOverride(null);
  }, []);
  const handleSharedQuarterChange = useCallback((q: QuarterFilter) => {
    setPeriodQuarter(q);
    setLowerOverride(null);
  }, []);
  const handleLowerOverrideQuarter = useCallback((q: QuarterFilter) => {
    setLowerOverride({ year: String(new Date().getFullYear()), quarter: q });
  }, []);


  // ── Shared period state — resets to current month on every mount/data change ──
  const periodOptions = useMemo(() => buildPeriodOptions(quotedJobs, revenueProjects), [quotedJobs, revenueProjects]);
  const defaultPeriodIdx = useMemo(() => {
    const currentKey = getCurrentMonthKey();
    // 1. Current month if available
    const exactIdx = periodOptions.findIndex((p) => p.mode === "month" && p.months.includes(currentKey));
    if (exactIdx >= 0) return exactIdx;

    // 2. Latest available month in current year up to today
    const now = new Date();
    const curYr2 = String(now.getFullYear()).slice(-2);
    const curMonNum = now.getMonth();
    const ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    let bestIdx = -1;
    let bestMon = -1;
    for (let i = 0; i < periodOptions.length; i++) {
      const p = periodOptions[i];
      if (p.mode !== "month") continue;
      const mk = p.months[0]; // e.g. "Mar-26"
      const match = mk?.match(/^([A-Za-z]{3})-(\d{2})$/);
      if (!match) continue;
      const mIdx = ABBR.indexOf(match[1]);
      const yr = match[2];
      if (yr === curYr2 && mIdx <= curMonNum && mIdx > bestMon) {
        bestMon = mIdx;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) return bestIdx;

    // 3. Current-year YTD
    const ytdIdx = periodOptions.findIndex((p) => p.mode === "ytd" && p.key === `YTD-${curYr2}`);
    if (ytdIdx >= 0) return ytdIdx;

    // 4. Latest valid available option
    const monthOptions = periodOptions.filter((p) => p.mode === "month");
    if (monthOptions.length > 0) {
      return periodOptions.indexOf(monthOptions[monthOptions.length - 1]);
    }
    return 0;
  }, [periodOptions]);

  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState(defaultPeriodIdx);

  // Reset to default on every data reload / remount
  useEffect(() => {
    setSelectedPeriodIdx(defaultPeriodIdx);
    setShowAllTables(false);
  }, [defaultPeriodIdx]);

  const selectedPeriod = periodOptions[selectedPeriodIdx] ?? null;

  // ── Shared "All" toggle for both tables — always starts OFF ──
  const [showAllTables, setShowAllTables] = useState(false);
  const [invoiceFilter, setInvoiceFilter] = useState<"invoiced" | "to_be_invoiced">("invoiced");
  const [investorScope, setInvestorScope] = useState<"ytd" | "quarter">("ytd");
  const [moneyScope, setMoneyScope] = useState<MoneyScope>("quarter");
  const [moneyMonth, setMoneyMonth] = useState<string | null>(null);
  const [revenueTableMonth, setRevenueTableMonth] = useState<{ year: number; month: number; label: string } | null>(null);
  const [revenueTableJumpToken, setRevenueTableJumpToken] = useState(0);
  const revenueCogsRef = useRef<HTMLDivElement | null>(null);
  const jumpToRevenueCogsMonth = useCallback((target: { year: number; month: number; label: string }) => {
    setShowAllTables(true);
    setRevenueTableMonth(target);
    setRevenueTableJumpToken((t) => t + 1);
    requestAnimationFrame(() => {
      revenueCogsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);
  
  

  

  // ── GP target — synced via webhook cache ─────────────────────────
  const [gpTarget, setGpTarget] = useState(30000);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    fetch(CACHE_WEBHOOK)
      .then((r) => r.json())
      .then((rows: any[]) => {
        const row = rows.find((r) => r.key === "gp_monthly_target");
        if (row) setGpTarget(parseFloat(row.value) || 30000);
      })
      .catch(() => {
        const saved = localStorage.getItem("tt_gp_monthly_target");
        if (saved) setGpTarget(parseFloat(saved) || 30000);
      });
  }, []);

  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }
    fetch(CACHE_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "gp_monthly_target", value: String(gpTarget) }),
    }).catch(() => {});
    localStorage.setItem("tt_gp_monthly_target", String(gpTarget));
  }, [gpTarget]);

  // ── Monthly Invoice target — synced via webhook cache ────────────
  const [invoicesTarget, setInvoicesTarget] = useState(80000);
  const isFirstLoadInvoices = useRef(true);

  useEffect(() => {
    fetch(CACHE_WEBHOOK)
      .then((r) => r.json())
      .then((rows: any[]) => {
        const row = rows.find((r) => r.key === "tt_monthly_invoices_target");
        if (row) setInvoicesTarget(parseFloat(row.value) || 80000);
      })
      .catch(() => {
        const saved = localStorage.getItem("tt_monthly_invoices_target");
        if (saved) setInvoicesTarget(parseFloat(saved) || 80000);
      });
  }, []);

  useEffect(() => {
    if (isFirstLoadInvoices.current) {
      isFirstLoadInvoices.current = false;
      return;
    }
    fetch(CACHE_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "tt_monthly_invoices_target", value: String(invoicesTarget) }),
    }).catch(() => {});
    localStorage.setItem("tt_monthly_invoices_target", String(invoicesTarget));
  }, [invoicesTarget]);

  // ── Compute date windows from real current date ──────────────────
  const investorDateWindows = useMemo(() => {
    const now = new Date();
    const yr = now.getFullYear();
    const mo = now.getMonth(); // 0-indexed
    const ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const yr2 = String(yr).slice(-2);

    // YTD: Jan of current year → current month inclusive
    const ytdMonths: string[] = [];
    for (let i = 0; i <= mo; i++) ytdMonths.push(`${ABBR[i]}-${yr2}`);

    // Current quarter: Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec
    const qNum = Math.floor(mo / 3) + 1;
    const qStart = (qNum - 1) * 3;
    const qMonths: string[] = [];
    for (let i = qStart; i < qStart + 3 && i <= mo; i++) qMonths.push(`${ABBR[i]}-${yr2}`);
    const qLabel = `Q${qNum} ${yr} (${ABBR[qStart]}–${ABBR[Math.min(qStart + 2, 11)]})`;

    return { ytdMonths, qMonths, qLabel, yr, yr2, mo, ABBR };
  }, []);

  // ── Filter source data to active scope ───────────────────────────
  const scopedInvestorData = useMemo(() => {
    const { ytdMonths, qMonths } = investorDateWindows;
    const activeMonths = investorScope === "ytd" ? ytdMonths : qMonths;
    const activeMonthSet = new Set(activeMonths);

    const dateToMK = (s: string): string | null => {
      if (!s) return null;
      const d = new Date(s);
      if (isNaN(d.getTime())) return null;
      const A = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      return `${A[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
    };

    // Revenue projects in scope
    const scopedRevenue = revenueProjects.filter(rp => {
      const mk = dateToMK(rp.invoiceDate) ?? dateToMK(rp.otherDate);
      return mk ? activeMonthSet.has(mk) : false;
    });

    // Quoted jobs in scope (by dateQuoted)
    const scopedQuotes = quotedJobs.filter(j => {
      const mk = dateToMK(j.dateQuoted);
      return mk ? activeMonthSet.has(mk) : false;
    });

    // Won jobs in scope
    const scopedWonOnly = scopedQuotes.filter(j => j.status === "won");

    // Revenue metrics
    const revenueExGST = scopedRevenue.reduce((s, r) => s + r.valueExclGST, 0);
    const revenueInclGST = scopedRevenue.reduce((s, r) => s + (r.valueInclGST || 0), 0);
    const totalCOGS = scopedRevenue.reduce((s, r) => s + r.totalCOGS, 0);
    const grossProfit = revenueExGST - totalCOGS;
    const grossMarginPct = revenueExGST > 0 ? (grossProfit / revenueExGST) * 100 : 0;

    // Expenses from cashflow
    const rawCF = (liveData as any)?.cashflow as any[] ?? [];
    const findCFRow = (label: string) => rawCF.find((r: any) => {
      const l = String(r._label_rowLabel ?? r.col_1 ?? "").toUpperCase().trim();
      return l === label.toUpperCase();
    });
    const opexRow = findCFRow("TOTAL OPERATING EXPENSES (INCL. SALARIES)");
    const labourRow = findCFRow("TOTAL COST OF SALES");
    const parseN = (v: any) => { const n = parseFloat(String(v ?? "0").replace(/[$,()]/g, "")); return isNaN(n) ? 0 : Math.abs(n); };
    const totalExpenses = activeMonths.reduce((s, mk) => s + parseN(opexRow?.[mk]), 0);
    const totalLabour = activeMonths.reduce((s, mk) => s + parseN(labourRow?.[mk]), 0);
    const netProfit = revenueExGST - totalExpenses;
    const opExpRatio = revenueExGST > 0 ? (totalExpenses / revenueExGST) * 100 : 0;
    const labourRatio = revenueExGST > 0 ? (totalLabour / revenueExGST) * 100 : 0;

    // Job metrics
    const wonCount = scopedWonOnly.length;
    const totalCount = scopedQuotes.length;
    const avgWon = wonCount > 0 ? scopedWonOnly.reduce((s, j) => s + j.value, 0) / wonCount : 0;
    const avgQuoted = totalCount > 0 ? scopedQuotes.reduce((s, j) => s + j.value, 0) / totalCount : 0;
    const revPerJobWon = wonCount > 0 ? revenueExGST / wonCount : 0;
    const revPerJobQuoted = totalCount > 0 ? revenueExGST / totalCount : 0;

    // Pipeline coverage: current open pipeline / YTD revenue run rate
    // Pipeline value = all pending + yellow jobs (always a current snapshot — not time-scoped)
    // Denominator = always YTD revenue (not quarter) — gives meaningful "months of work ahead" ratio
    const pipelineVal = quotedJobs
      .filter(j => j.status === "pending" || j.status === "yellow")
      .reduce((s, j) => s + j.value, 0);
    const nowDate = new Date();
    const todayEnd = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate() + 1);
    const ytdRevenueForCoverage = revenueProjects
      .filter(rp => {
        const dateStr = rp.invoiceDate || rp.otherDate;
        if (!dateStr) return false;
        const d = new Date(dateStr);
        return !isNaN(d.getTime()) && d.getFullYear() === nowDate.getFullYear() && d <= todayEnd;
      })
      .reduce((s, rp) => s + rp.valueExclGST, 0);
    const pipelineCoverage = ytdRevenueForCoverage > 0 ? pipelineVal / ytdRevenueForCoverage : 0;

    // Debt service ratio
    const im_full = investorMetrics as any;
    const bizLoan = im_full?.bizLoanMonthly ?? 4318;
    const carLoan = im_full?.carLoanMonthly ?? 1223;
    const monthlyDebt = bizLoan + carLoan;
    const annualDebt = monthlyDebt * 12;
    const dsrValue = revenueExGST > 0 ? (annualDebt / revenueExGST) * 100 : 0;

    return {
      revenueExGST, revenueInclGST, totalCOGS, grossProfit, grossMarginPct,
      totalExpenses, totalLabour, netProfit, opExpRatio, labourRatio,
      wonCount, totalCount, avgWon, avgQuoted, revPerJobWon, revPerJobQuoted,
      pipelineVal, pipelineCoverage, dsrValue, bizLoan, carLoan, monthlyDebt, annualDebt,
      scopedMonthCount: activeMonths.length,
    };
  }, [investorScope, investorDateWindows, revenueProjects, quotedJobs, liveData, investorMetrics]);

  // Find current-year YTD index for auto-switch
  const currentYearYtdIdx = useMemo(() => {
    const yr2 = String(new Date().getFullYear()).slice(-2);
    return periodOptions.findIndex((p) => p.mode === "ytd" && p.key === `YTD-${yr2}`);
  }, [periodOptions]);

  // When user clicks "All" on either table → both tables enter/exit All mode
  const handleTableAllToggle = useCallback((allOn: boolean) => {
    setShowAllTables(allOn);
    if (allOn && currentYearYtdIdx >= 0) {
      setSelectedPeriodIdx(currentYearYtdIdx);
    }
  }, [currentYearYtdIdx]);

  // When user changes the period selector → exit All mode for both tables
  const handlePeriodChange = useCallback((idx: number) => {
    setSelectedPeriodIdx(idx);
    setShowAllTables(false);
  }, []);

  const [activeGoalIds, setActiveGoalIds] = useState<Set<string>>(() => loadActiveGoalIds(goals));

  const setAndPersistActiveIds = useCallback((ids: Set<string>) => {
    setActiveGoalIds(ids);
    localStorage.setItem(ACTIVE_GOALS_KEY, JSON.stringify([...ids]));
  }, []);

  const handleToggleGoal = useCallback((id: string) => {
    setActiveGoalIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);else
      next.add(id);
      localStorage.setItem(ACTIVE_GOALS_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const handleSetAll = useCallback(() => {
    const ids = new Set(goals.filter((g) => g.merge).map((g) => g.id));
    setAndPersistActiveIds(ids);
  }, [goals, setAndPersistActiveIds]);

  const handleClearAll = useCallback(() => {
    setAndPersistActiveIds(new Set());
  }, [setAndPersistActiveIds]);

  const handleToggleMerge = useCallback((id: string, mergeOn: boolean) => {
    updateGoal(id, { merge: mergeOn });
    if (mergeOn) {
      setActiveGoalIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        localStorage.setItem(ACTIVE_GOALS_KEY, JSON.stringify([...next]));
        return next;
      });
    }
  }, [updateGoal]);

  const { adjustedData, adjustments, netMonthlyEffect } = useMemo(
    () => applyGoalMerge(incomeOutgoingsData, goals, activeGoalIds),
    [incomeOutgoingsData, goals, activeGoalIds]
  );

  const hasActiveGoals = useMemo(() => {
    return goals.some((g) => g.merge && activeGoalIds.has(g.id));
  }, [goals, activeGoalIds]);

  const adjustedKpiStats = useMemo(() => {
    if (!hasActiveGoals) return kpiStats;

    const now = new Date();
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonthKey = `${MONTHS[now.getMonth()]}-${String(now.getFullYear()).slice(-2)}`;

    let adjustedCashflowPos = 0;
    const currentPoint = adjustedData.find((p) => p.month === currentMonthKey);
    if (currentPoint && currentPoint.surplus !== 0) {
      adjustedCashflowPos = currentPoint.surplus;
    } else {
      const currentIdx = adjustedData.findIndex((p) => p.month === currentMonthKey);
      const startIdx = currentIdx >= 0 ? currentIdx : 0;
      for (let i = startIdx; i < adjustedData.length; i++) {
        if (adjustedData[i].surplus !== 0) {adjustedCashflowPos = adjustedData[i].surplus;break;}
      }
      if (adjustedCashflowPos === 0) {
        for (let i = adjustedData.length - 1; i >= 0; i--) {
          if (adjustedData[i].surplus !== 0) {adjustedCashflowPos = adjustedData[i].surplus;break;}
        }
      }
    }

    let netRevenueAdj = 0;
    const activeGoals = goals.filter((g) => g.merge && activeGoalIds.has(g.id));
    for (const goal of activeGoals) {
      const goalType = goal.goalType ?? "expenditure";
      if (goal.amountStructure === "lump_sum" && goal.lumpSumDate) {
        const lumpDate = new Date(goal.lumpSumDate);
        if (lumpDate <= now) {
          netRevenueAdj += goalType === "revenue" ? goal.targetValue : -goal.targetValue;
        }
      } else if (goal.amountStructure === "recurring") {
        const start = new Date(goal.startDate);
        if (start <= now) {
          const monthsElapsed = Math.max(1, (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth() + 1);
          let monthly = goal.targetValue || 0;
          if (goal.period === "weekly") monthly = monthly * 4.33;else
          if (goal.period === "yearly") monthly = monthly / 12;
          netRevenueAdj += goalType === "revenue" ? monthly * monthsElapsed : -monthly * monthsElapsed;
        }
      }
    }

    return kpiStats.map((stat) => {
      if (stat.label === "Cashflow Position") {
        return { ...stat, value: fmtAUD(adjustedCashflowPos), positive: adjustedCashflowPos >= 0, goalAdjusted: true };
      }
      if (stat.label === "Net Revenue") {
        const baseValue = parseFloat(stat.value.replace(/[^0-9.-]/g, "")) || 0;
        const adjustedNetRev = baseValue + netRevenueAdj;
        return { ...stat, value: fmtAUD(adjustedNetRev), positive: adjustedNetRev >= 0, goalAdjusted: true };
      }
      return stat;
    });
  }, [kpiStats, adjustedData, goals, activeGoalIds, hasActiveGoals]);

  const handleRefresh = useCallback(() => {
    // 1) Re-pull every connected n8n source (Google Sheets main payload, Zoho Projects KPIs, etc.)
    sources
      .filter((s) => s.connected && s.webhookUrl)
      .forEach((s) => syncNow(s.id));

    // Safety net: always include the core Google Sheets payload even if a flag is odd
    if (!sources.some((s) => s.id === "google_sheets" && s.connected && s.webhookUrl)) {
      syncNow("google_sheets");
    }

    // 2) Refresh the calendar feed (separate poll)
    syncCalendar?.();

    // 3) Refresh standalone islands (CRM Quoting Opps / leads) via a global event
    window.dispatchEvent(new Event("tt:refresh-all"));
  }, [sources, syncNow, syncCalendar]);

  const formatLastUpdated = (ts: string | null) => {
    if (!ts) return null;
    try {return new Date(ts).toLocaleString();} catch {return ts;}
  };

  const getFormulaForCard = (cardLabel: string) => {
    const formula = formulas.find((f) => f.dashboardCard === cardLabel);
    if (!formula) return null;
    const cached = formulaCache.get(formula.id);
    if (!cached || cached.value === null) return null;
    return { formula, cached };
  };

  const getCardValue = (stat: any) => {
    const match = getFormulaForCard(stat.label);
    if (match) {
      let baseValue = match.cached.value!;
      if (stat.goalAdjusted) {
        const rawStatNum = parseFloat(kpiStats.find((s) => s.label === stat.label)?.value?.replace(/[^0-9.-]/g, "") ?? "0") || 0;
        const adjustedNum = parseFloat(stat.value.replace(/[^0-9.-]/g, "")) || 0;
        const goalDelta = adjustedNum - rawStatNum;
        baseValue = baseValue + goalDelta;
      }
      if (stat.label === "Conversion Rate") return `${baseValue.toFixed(1)}%`;
      return fmtAUD(baseValue);
    }
    return stat.value;
  };

  const getFormulaInfo = (cardLabel: string) => {
    const formula = formulas.find((f) => f.dashboardCard === cardLabel);
    if (!formula) return null;
    const cached = formulaCache.get(formula.id);
    if (!cached || cached.value === null) return null;
    return {
      name: formula.name,
      expression: formula.expression,
      lastComputed: formulaCache.lastComputedAt_value
    };
  };

  const allResults = formulaCache.getAll();
  const activeFormulaCount = Object.values(allResults).filter((r) => r.value !== null).length;
  const formulaLastComputed = formulaCache.lastComputedAt_value;

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-4 md:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-semibold" style={{ fontSize: "clamp(20px, 3vw, 32px)" }}>TT Biz Dashboard</h1>
          <p className="text-muted-foreground font-mono" style={{ fontSize: "clamp(9px, 1vw, 11px)" }}>K & M Legacy View</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            {lastUpdated &&
            <span className="text-xs font-mono text-muted-foreground block">
                Last updated: {formatLastUpdated(lastUpdated)}
              </span>
            }
            {activeFormulaCount > 0 &&
            <span className="text-[10px] font-mono text-muted-foreground/70 block">
                Formulas: {activeFormulaCount} active · last computed {timeAgo(formulaLastComputed)}
              </span>
            }
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading || isRefreshing} className="gap-1.5">
            {isLoading || isRefreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {isRefreshing ? "Refreshing…" : "Refresh"}
          </Button>
          <Badge
            variant={hasLiveData ? "default" : "secondary"}
            className={`font-mono text-xs ${hasLiveData ? "bg-chart-green/20 text-chart-green border-chart-green/30" : ""}`}>
            
            {hasLiveData ?
            <><CheckCircle className="w-3 h-3 mr-1" />Live</> :

            <><Unplug className="w-3 h-3 mr-1" />No Data</>
            }
          </Badge>
        </div>
      </div>

      {isOffline && (lastCachedAt || hasLiveData) && (
        <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 px-4 py-2.5 mb-4">
          <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
            <span>⚡</span>
            <span className="font-medium">Offline mode</span>
            <span className="text-amber-600 dark:text-amber-400">
              {lastCachedAt
                ? `Showing cached data from ${new Date(lastCachedAt).toLocaleString("en-AU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`
                : "Showing last known data"}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => syncNow("google_sheets")} className="text-amber-700 border-amber-300 hover:bg-amber-100 dark:text-amber-200 dark:border-amber-600 dark:hover:bg-amber-900/40">
            Retry
          </Button>
        </div>
      )}

      {isLoading && !hasLiveData &&
      <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground font-mono">Loading data...</span>
        </div>
      }

      {!isLoading && !hasLiveData && (() => {
        const gSheets = sources.find((s) => s.id === "google_sheets");
        const hasWebhook = !!gSheets?.webhookUrl;
        return (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Unplug className="w-12 h-12 text-muted-foreground/40 mb-4" />
            <p className="text-lg text-muted-foreground mb-2">
              {hasWebhook ? "Webhook configured — click Refresh to load data" : "No data source connected"}
            </p>
            <p className="text-sm text-muted-foreground font-mono mb-4">
              {hasWebhook ? "Your n8n webhook URL is saved. Hit Refresh to pull the latest data." : "Add your n8n webhook URL in Settings to get started"}
            </p>
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="w-4 h-4 mr-2" /> {hasWebhook ? "Refresh" : "Retry"}
            </Button>
          </div>);

      })()}

      {hasLiveData &&
      <>
          {/* Quick Look Sales — top KPI row */}
          <SectionHeader title="Quick Look Sales" />
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 items-stretch mb-4 md:mb-6" style={{ gap: "clamp(8px, 1vw, 16px)" }}>
            {adjustedKpiStats.map((stat, i) => {
              if (stat.label === "Pipeline") {
                return (
                  <PipelineSummaryCard
                    key="pipeline"
                    topCount={String(stat.value ?? "—")}
                    topSub={String(stat.change ?? "")}
                    bottomCount={inRunningCount}
                    bottomValue={inRunningValue}
                    index={i}
                    emphasis
                    noData={stat.noData}
                  />
                );
              }
              if (stat.label === "Win / Loss Summary") {
                return (
                  <WinLossSummaryCard
                    key="win-loss-summary"
                    quotedJobs={quotedJobs}
                    index={i}
                    emphasis
                  />
                );
              }
              if (stat.label === "CONVERSION RATES") {
                return (
                  <ConversionRatesCard
                    key="conversion-rates"
                    quotedJobs={quotedJobs}
                    noData={stat.noData}
                    index={i}
                    emphasis
                  />
                );
              }

              if (stat.label === "Revenue / Profit") {
                const e = stat.extras ?? {};
                return (
                  <RevenueProfitCard
                    key="revenue-profit"
                    grossRevenue={e.grossRevenue ?? 0}
                    netRevenue={e.netRevenue ?? 0}
                    grossProfit={e.grossProfit ?? 0}
                    netProfit={e.netProfit ?? 0}
                    rev2026={e.rev2026}
                    revYTD={e.revYTD}
                    netProfit2026={e.netProfit2026}
                    netProfitYTD={e.netProfitYTD}
                    index={i}
                    emphasis
                  />
                );
              }
              const formulaInfo = stat.label === "Total Won" ? null : getFormulaInfo(stat.label);
              return (
                <StatCard
                  key={stat.label}
                  {...stat}
                  value={getCardValue(stat)}
                  index={i}
                  formulaDriven={formulaInfo}
                  altValue={stat.altValue}
                  altChange={stat.altChange}
                  altPositive={stat.altPositive}
                  emphasis
                />
              );

            })}
          </div>

          {(() => {
            const rpStat = adjustedKpiStats.find((s) => s.label === "Revenue / Profit");
            const currentRevenue = (rpStat?.extras as any)?.grossRevenue ?? 0;
            const wonJobs = quotedJobs.filter((j) => j.status === "won");
            const wonValueTotal = wonJobs.reduce((s, j) => s + (j.value || 0), 0);
            return (
              <TargetsGoalsSection
                currentRevenue={currentRevenue}
                wonValueTotal={wonValueTotal}
                wonCount={wonJobs.length}
              />
            );
          })()}

          {/* Quoted Jobs — moved here, under Targets/Goals, above Let's Talk Money */}
          <div className="mb-4 md:mb-6">
            <DealPipeline
              periodFilter={selectedPeriod}
              showAll={showAllTables}
              onAllToggle={handleTableAllToggle}
            />
          </div>

          {investorMetrics && (() => {
            const sd = scopedInvestorData;
            const { yr, mo, ABBR } = investorDateWindows;

            const fmtVal = (n: number) => {
              const abs = Math.abs(n);
              const sign = n < 0 ? '-' : '';
              if (abs >= 1_000_000) return `${sign}$${(abs/1_000_000).toFixed(2).replace(/\.?0+$/,'')}M`;
              if (abs >= 1_000)     return `${sign}$${(abs/1_000).toFixed(1).replace(/\.?0+$/,'')}K`;
              return `${sign}$${Math.round(abs).toLocaleString()}`;
            };

            const scopeLabel = investorScope === "ytd"
              ? `Jan–${ABBR[mo]} ${yr} YTD`
              : investorDateWindows.qLabel;

            const ebitdaMarginPct = sd.revenueExGST > 0
              ? `${((sd.grossProfit / sd.revenueExGST) * 100).toFixed(1)}% margin`
              : "--";
            const netProfitMarginPct = sd.revenueExGST > 0
              ? `${((sd.netProfit / sd.revenueExGST) * 100).toFixed(1)}% margin`
              : "--";
            const gmPct = sd.grossMarginPct.toFixed(2);

            const money = computeMoneyMetrics({
              scope: moneyScope,
              monthsOverride: moneyMonth ? new Set([moneyMonth]) : undefined,
              revenueProjects,
              cashflowRows: (dataStore as any)?.cashflow ?? [],
            });
            const moneyLabels = moneyScopeLabel(moneyScope);
            const monthOptions = availableMonthKeys(revenueProjects);
            const subtitleText = moneyMonth ? monthLabel(moneyMonth) : moneyLabels.subtitle;

            return (
            <div className="mt-4 mb-4">
              <SectionPeriodHeader
                title="Let's Talk Money"
                pills={[
                  { key: "quarter", label: moneyScopeLabel("quarter").pill },
                  { key: "ytd", label: "YTD" },
                  { key: "all", label: "All" },
                ]}
                activeKey={moneyScope}
                onPill={(k) => { setMoneyScope(k as MoneyScope); setMoneyMonth(null); }}
                months={monthOptions.map((k) => ({ key: k, label: monthLabel(k) }))}
                selectedMonth={moneyMonth}
                onMonth={(k) => setMoneyMonth(k)}
                subtitle={subtitleText}
              />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3" style={{ containerType: 'inline-size' }}>
                {/* 1. Cash Position — relocated. StatCard internals detect label and wire Open/Today/Actual */}
                <StatCard
                  label="Cash Position"
                  value="—"
                  change=""
                  positive={true}
                  index={9}
                  altValue="—"
                  altChange=""
                  altPositive={true}
                  toggleLabelBase="Open"
                  toggleLabelAlt="Today"
                  toggleLabelAlt2="Actual"
                  greenAltPill={true}
                  emphasis
                />
                {/* 2. Invoices Paid / To-be-paid — relocated/built from REVENUE tab */}
                <InvoicesPaidCard index={10} onJumpToMonth={jumpToRevenueCogsMonth} />
                {/* 3. PER JOB — merged Revenue/Profit per-job card */}
                {(() => {
                  const wc = sd.wonCount;
                  const grossRevPerJob = wc > 0 ? sd.revenueInclGST / wc : 0;
                  const netRevPerJob = wc > 0 ? sd.revenueExGST / wc : 0;
                  const grossProfitPerJob = wc > 0 ? sd.grossProfit / wc : 0;
                  const netProfitPerJob = wc > 0 ? sd.netProfit / wc : 0;
                  return (
                    <PerJobCard
                      grossRevPerJob={grossRevPerJob}
                      netRevPerJob={netRevPerJob}
                      grossProfitPerJob={grossProfitPerJob}
                      netProfitPerJob={netProfitPerJob}
                      wonCount={wc}
                      index={11}
                    />
                  );
                })()}
                {/* 4. Avg Contract Value — dual-mode (Quoted vs Won | Won vs Lost), overall */}
                {(() => {
                  const qs = (dataStore as any)?.quotesSummary ?? {};
                  const avgOf = (o: any) => (Number(o?.count) > 0 ? Number(o.value) / Number(o.count) : 0);
                  const acvQuoted = { avg: avgOf(qs.totalQuoted), count: Number(qs?.totalQuoted?.count ?? 0) };
                  const acvWon    = { avg: avgOf(qs.totalWon),    count: Number(qs?.totalWon?.count ?? 0) };
                  const acvLost   = { avg: avgOf(qs.totalLost),   count: Number(qs?.totalLost?.count ?? 0) };
                  return (
                    <AvgContractCard
                      acvQuoted={acvQuoted}
                      acvWon={acvWon}
                      acvLost={acvLost}
                      index={12}
                    />
                  );
                })()}

                {/* 5. Revenue Growth — scope-aware (YTD avg MoM% w/ sparkline, or QoQ%) */}
                <RevenueGrowthCard
                  scope={investorScope}
                  index={13}
                  defaultView="dollar"
                  dollarOverride={{ value: money.revenueExGST, label: `${moneyLabels.pill} revenue` }}
                />
                {/* Row 2 */}
                <StatCard
                  label="Pipeline Coverage"
                  value={`${sd.pipelineCoverage.toFixed(1)}x`}
                  change={fmtVal(sd.pipelineVal) + " pipeline"}
                  positive={sd.pipelineCoverage >= 2}
                  index={15}
                  variant="centered"
                  momContext="vs YTD revenue run rate"
                />
                <StatCard
                  label="Op. Expense Ratio"
                  value={money.opExpRatio !== null ? `${money.opExpRatio.toFixed(1)}%` : "N/A"}
                  change="Expenses / Revenue"
                  positive={(money.opExpRatio ?? 0) < 60}
                  index={16}
                  variant="centered"
                  altValue={fmtVal(money.opEx)}
                  altChange={`${moneyLabels.pill} operating expenses`}
                  altPositive={(money.opExpRatio ?? 0) < 60}
                  toggleLabelBase="%"
                  toggleLabelAlt="$"
                  greenAltPill={true}
                />

                <StatCard
                  label="Labour Cost Ratio"
                  value={money.labourCostRatio !== null ? `${money.labourCostRatio.toFixed(1)}%` : "N/A"}
                  change="Labour / Revenue"
                  positive={(money.labourCostRatio ?? 0) < 35}
                  index={16}
                  variant="centered"
                  altValue={fmtVal(money.labour)}
                  altChange={`${moneyLabels.pill} labour`}
                  altPositive={(money.labourCostRatio ?? 0) < 35}
                  toggleLabelBase="%"
                  toggleLabelAlt="$"
                  greenAltPill={true}
                />
                <StatCard
                  label="Lifestyle Expense Ratio"
                  value={money.lifestyleExpenseRatio != null ? `${money.lifestyleExpenseRatio.toFixed(1)}%` : "N/A"}
                  change="Owners' pay + vehicles + super ÷ total cost"
                  positive={true}
                  index={17}
                  variant="centered"
                  altValue={money.lifestyleExpense ? fmtVal(money.lifestyleExpense) : "–"}
                  altChange="Salaries + MV repayments + super"
                  altPositive={true}
                  toggleLabelBase="%"
                  toggleLabelAlt="$"
                  greenAltPill={true}
                />
              </div>

            </div>
            );
          })()}

          {/* Active Goals */}
          <GoalsDashboardWidgets
          goals={goals}
          formulas={formulas}
          activeGoalIds={activeGoalIds}
          onToggleGoal={handleToggleGoal}
          onToggleMerge={handleToggleMerge} />
        

          {/* Goal Scenarios */}
          <GoalScenarioBar
          goals={goals}
          activeGoalIds={activeGoalIds}
          onToggleGoal={handleToggleGoal}
          onSetAll={handleSetAll}
          onClearAll={handleClearAll}
          netMonthlyEffect={netMonthlyEffect} />
        

          {/* Charts */}
          <div className="grid grid-cols-1 gap-3 md:gap-4 mb-4 md:mb-6">
            <PortfolioChart
              adjustedData={adjustedData}
              adjustments={adjustments}
              year={periodYear}
              quarter={periodQuarter}
              onYearChange={handleSharedYearChange}
              onQuarterChange={handleSharedQuarterChange}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-4 md:mb-6">
            <MonthlyInvoicesVsTargetChart
              monthlyInvoicesData={monthlyInvoicesData}
              invoicesTarget={invoicesTarget}
              onInvoicesTargetChange={setInvoicesTarget}
              year={lowerPeriod.year}
              quarter={lowerPeriod.quarter}
            />
            <MonthlyNetProfitChart
              monthlyNetProfitData={monthlyNetProfitData}
              year={lowerPeriod.year}
              quarter={lowerPeriod.quarter}
              isOverridden={lowerOverride !== null}
              onOverrideQuarter={handleLowerOverrideQuarter}
            />



          </div>

          <div className="mb-4 md:mb-6">
            <ForecastChart />
          </div>

          <ProjectExecutionKPIs selectedPeriodIdx={selectedPeriodIdx} onPeriodChange={handlePeriodChange} invoiceFilter={invoiceFilter} onInvoiceFilterChange={setInvoiceFilter} />

          <div className="space-y-4 md:space-y-6">
            <FundPerformanceChart />
            <div ref={revenueCogsRef} id="revenue-cogs-section" style={{ scrollMarginTop: 80 }}>
              <RevenueProjectsTable
                periodFilter={selectedPeriod}
                showAll={showAllTables}
                onAllToggle={handleTableAllToggle}
                invoiceFilter={invoiceFilter}
                externalMonthFilter={revenueTableMonth}
                externalMonthFilterToken={revenueTableJumpToken}
              />
            </div>

            <div style={{ display: "flex", gap: "24px", alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 55%", minWidth: 0 }}>
                <ExpenseBreakdown goals={goals} activeGoalIds={activeGoalIds} />
              </div>
              <div style={{ flex: "1 1 calc(45% - 24px)", minWidth: 0 }}>
                <SectorAllocationChart />
              </div>
            </div>
          </div>

          <DataIntegrityPanel />
        </>
      }
    </DashboardLayout>);

};

const Index = () => {
  return <DashboardContent />;
};

export default Index;
