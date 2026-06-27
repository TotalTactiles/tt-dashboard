import React, { useState, useMemo, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  CalendarClock,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Wallet,
  ChevronDown,
  CheckCircle2,
  Clock,
  Users,
  ListChecks,
  AlertTriangle,
  X,
  RefreshCw,
  FolderCheck,
  ExternalLink,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import {
  buildPeriodOptions,
  computeExecutionKPIs,
  type PeriodSpec,
  type KPIResult,
} from "@/lib/projectExecutionKpis";
import type { ProjectKPIData } from "@/hooks/useDataSources";
import SectionHeader from "@/components/dashboard/SectionHeader";
import SectionPeriodHeader from "@/components/dashboard/SectionPeriodHeader";
import { scopeLabel as moneyScopeLabel, monthLabel } from "@/lib/moneyPeriod";
import { formatMetricValue } from "@/lib/formatMetricValue";

const PE_MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/** Convert a project invoiceDate ("June 2026", "Jun-26", "08-02-2026", ISO) → "Mon-YY" key. */
function invoiceToMonKey(s?: string | null): string | null {
  if (!s) return null;
  const str = String(s).trim();
  let m = str.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (m) {
    const idx = PE_MONTH_ABBR.findIndex(a => a.toLowerCase() === m![1].slice(0, 3).toLowerCase());
    if (idx >= 0) return `${PE_MONTH_ABBR[idx]}-${m[2].slice(-2)}`;
  }
  m = str.match(/^([A-Za-z]{3})-(\d{2})$/);
  if (m) {
    const idx = PE_MONTH_ABBR.findIndex(a => a.toLowerCase() === m![1].toLowerCase());
    if (idx >= 0) return `${PE_MONTH_ABBR[idx]}-${m[2]}`;
  }
  m = str.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/);
  if (m) {
    const monIdx = parseInt(m[2], 10) - 1;
    if (monIdx >= 0 && monIdx < 12) return `${PE_MONTH_ABBR[monIdx]}-${m[3].slice(-2)}`;
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) return `${PE_MONTH_ABBR[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
  return null;
}

type PEProject = NonNullable<ProjectKPIData["projects"]>[number];


// ── Inline style objects for fluid typography (cqi units) ──────────

const cardContainerStyle: React.CSSProperties = {
  containerType: 'inline-size',
  padding: "clamp(0.65rem, 1.5vw, 1.1rem)",
  minHeight: "90px",
};

const titleStyle: React.CSSProperties = {
  fontSize: 'clamp(0.48rem, 1.6cqi, 0.62rem)',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
  maxWidth: '100%',
  fontWeight: 500,
};

const valueShortStyle: React.CSSProperties = {
  fontSize: 'clamp(0.95rem, 4cqi, 1.6rem)',
  lineHeight: '1.2',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
  display: 'block',
  maxWidth: '100%',
  fontWeight: 600,
  letterSpacing: '-0.02em',
};

const valueLongStyle: React.CSSProperties = {
  fontSize: 'clamp(0.75rem, 3cqi, 1.3rem)',
  lineHeight: '1.2',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
  display: 'block',
  maxWidth: '100%',
  fontWeight: 600,
  letterSpacing: '-0.015em',
};

const sublineStyle: React.CSSProperties = {
  fontSize: 'clamp(0.58rem, 1.5cqi, 0.7rem)',
  lineHeight: '1.45',
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  minWidth: 0,
  fontWeight: 400,
};

const noteStyle: React.CSSProperties = {
  fontSize: 'clamp(0.55rem, 1.4cqi, 0.65rem)',
  fontStyle: 'italic',
  opacity: 0.7,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
};

const trendStyle: React.CSSProperties = {
  fontSize: "clamp(10px, 1.4cqi, 12px)",
};

// ── Helpers ────────────────────────────────────────────────────────

function decodeHtml(html: string): string {
  const txt = document.createElement("textarea");
  txt.innerHTML = html;
  return txt.value;
}

function isShortValue(str: string): boolean {
  return str.length <= 8;
}

const GM_TARGET_KEY = "gross_margin_target";

function loadGPTarget(): number {
  const fromLocal = localStorage.getItem(GM_TARGET_KEY);
  const fromSession = sessionStorage.getItem(GM_TARGET_KEY);
  const raw = fromLocal ?? fromSession ?? '30';
  const parsed = parseFloat(raw);
  return isNaN(parsed) ? 30 : parsed;
}

// ── Legacy ExecKPICard (for unchanged cards) ──────────────────────

interface ExecKPICardProps {
  title: string;
  group: string;
  icon: React.ReactNode;
  kpi: KPIResult;
  index: number;
  colorByValue?: boolean;
}

function ExecKPICard({ title, group, icon, kpi, index, colorByValue }: ExecKPICardProps) {
  const isUnavailable = kpi.value === null;
  // colorByValue: use sign of primary value (not trend) for primary color
  const isPositive = colorByValue
    ? (kpi.value !== null ? kpi.value >= 0 : true)
    : (kpi.change !== null ? kpi.change >= 0 : true);
  const trendPositive = kpi.change !== null ? kpi.change >= 0 : true;
  const displayVal = kpi.formatted ?? "--";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      className="stat-card relative overflow-hidden flex flex-col min-w-0"
      style={cardContainerStyle}
    >
      <div className="flex items-center justify-between gap-1 mb-1" style={{ minWidth: 0, overflow: 'hidden' }}>
        <div className="flex items-center gap-1.5" style={{ minWidth: 0, overflow: 'hidden' }}>
          <span className="text-muted-foreground shrink-0">{icon}</span>
          <p className="text-muted-foreground font-mono font-medium" style={titleStyle} title={title}>
            {title}
          </p>
        </div>
        <span className="text-[8px] font-mono text-muted-foreground/60 bg-secondary/60 rounded px-1 py-0.5 leading-none whitespace-nowrap" style={{ flexShrink: 0 }}>
          {group}
        </span>
      </div>

      <div className="my-auto" style={{ minWidth: 0, overflow: 'hidden' }}>
        {isUnavailable ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="font-mono font-bold text-muted-foreground/50 cursor-help" style={valueShortStyle}>
                --
              </p>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs font-mono max-w-[250px]">
              {kpi.unavailableReason ?? "Data unavailable"}
            </TooltipContent>
          </Tooltip>
        ) : (
          <p
            className={`font-mono font-bold ${isPositive ? "text-chart-green" : "text-chart-red"}`}
            style={isShortValue(displayVal) ? valueShortStyle : valueLongStyle}
            title={displayVal}
          >
            {displayVal}
          </p>
        )}
      </div>

      <div className="mt-auto space-y-0.5" style={{ minWidth: 0, overflow: 'hidden' }}>
        {!isUnavailable && kpi.changeFormatted !== "--" && (
          <div
            className={`flex items-center gap-0.5 font-mono ${trendPositive ? "text-chart-green" : "text-chart-red"}`}
            style={trendStyle}
          >
            {trendPositive ? (
              <TrendingUp className="w-3 h-3 shrink-0" />
            ) : (
              <TrendingDown className="w-3 h-3 shrink-0" />
            )}
            <span className="truncate">{kpi.changeFormatted}</span>
          </div>
        )}
        <p className="font-mono text-muted-foreground" style={sublineStyle} title={kpi.context}>
          {kpi.context}
        </p>
      </div>

      <div className="mt-2 h-[3px] bg-secondary rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{
            width: isUnavailable ? "0%" : `${Math.min(100, Math.max(10, kpi.value ?? 0))}%`,
          }}
          transition={{ duration: 0.8, delay: 0.3 + index * 0.06 }}
          className={`h-full rounded-full ${
            isUnavailable
              ? "bg-muted-foreground/20"
              : isPositive
              ? "bg-chart-green"
              : "bg-chart-red"
          }`}
        />
      </div>
    </motion.div>
  );
}

// ── Zoho KPI Skeleton Card ────────────────────────────────────────

function ZohoKPISkeleton({ index }: { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      className="stat-card relative overflow-hidden flex flex-col min-w-0"
      style={cardContainerStyle}
    >
      <div className="flex items-start justify-between gap-1 mb-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-14" />
      </div>
      <Skeleton className="h-8 w-20 my-2" />
      <div className="mt-auto space-y-1">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-full" />
      </div>
      <Skeleton className="mt-2 h-[3px] w-full rounded-full" />
    </motion.div>
  );
}

// ── Zoho KPI Disabled Card ────────────────────────────────────────

function ZohoKPIDisabled({ title, icon, group, index }: { title: string; icon: React.ReactNode; group: string; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      className="stat-card relative overflow-hidden flex flex-col opacity-60 min-w-0"
      style={cardContainerStyle}
    >
      <div className="flex items-center justify-between gap-1 mb-1" style={{ minWidth: 0, overflow: 'hidden' }}>
        <div className="flex items-center gap-1.5" style={{ minWidth: 0, overflow: 'hidden' }}>
          <span className="text-muted-foreground shrink-0">{icon}</span>
          <p className="text-muted-foreground font-mono font-medium" style={titleStyle}>{title}</p>
        </div>
        <span className="text-[8px] font-mono text-muted-foreground/60 bg-secondary/60 rounded px-1 py-0.5 leading-none whitespace-nowrap" style={{ flexShrink: 0 }}>{group}</span>
      </div>
      <p className="font-mono font-bold text-muted-foreground/40 my-auto" style={valueShortStyle}>--</p>
      <p className="font-mono text-muted-foreground mt-auto" style={sublineStyle}>Enable in Settings → Data Sources</p>
      <div className="mt-2 h-[3px] bg-secondary rounded-full" />
    </motion.div>
  );
}

// ── Zoho KPI Error Card ───────────────────────────────────────────

function ZohoKPIError({ title, icon, group, index }: { title: string; icon: React.ReactNode; group: string; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      className="stat-card relative overflow-hidden flex flex-col min-w-0"
      style={cardContainerStyle}
    >
      <div className="flex items-center justify-between gap-1 mb-1" style={{ minWidth: 0, overflow: 'hidden' }}>
        <div className="flex items-center gap-1.5" style={{ minWidth: 0, overflow: 'hidden' }}>
          <span className="text-muted-foreground shrink-0">{icon}</span>
          <p className="text-muted-foreground font-mono font-medium" style={titleStyle}>{title}</p>
        </div>
        <span className="text-[8px] font-mono text-muted-foreground/60 bg-secondary/60 rounded px-1 py-0.5 leading-none whitespace-nowrap" style={{ flexShrink: 0 }}>{group}</span>
      </div>
      <p className="font-mono font-bold text-muted-foreground/40 my-auto" style={valueShortStyle}>--</p>
      <p className="font-mono text-chart-amber mt-auto" style={sublineStyle}>Sync failed · Check Settings</p>
      <div className="mt-2 h-[3px] bg-secondary rounded-full" />
    </motion.div>
  );
}

// ── ZOHO TO BE BUILT CARD ─────────────────────────────────────────

function ZohoToBeBuiltCard({
  title, icon, group, index, note,
}: { title: string; icon: React.ReactNode; group: string; index: number; note?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      className="stat-card relative overflow-hidden flex flex-col min-w-0 opacity-70"
      style={cardContainerStyle}
    >
      <div className="flex items-center justify-between gap-1 mb-1" style={{ minWidth: 0, overflow: "hidden" }}>
        <div className="flex items-center gap-1.5" style={{ minWidth: 0, overflow: "hidden" }}>
          <span className="text-muted-foreground shrink-0">{icon}</span>
          <p className="text-muted-foreground font-mono font-medium" style={titleStyle}>{title}</p>
        </div>
        <span className="text-[8px] font-mono text-muted-foreground/60 bg-secondary/60 rounded px-1 py-0.5 leading-none whitespace-nowrap" style={{ flexShrink: 0 }}>{group}</span>
      </div>

      <div className="flex items-center my-1">
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-secondary/60 text-muted-foreground border border-border">To Be Built</span>
      </div>

      <p className="font-mono text-muted-foreground mt-auto" style={sublineStyle}>
        {note ?? "Setup pending in Zoho Projects"}
      </p>

      <div className="mt-2 h-[3px] bg-secondary rounded-full" />
    </motion.div>
  );
}

// ── ON-TIME DELIVERY CARD ─────────────────────────────────────────

function OnTimeDeliveryCard({ data, index }: { data: ProjectKPIData["kpis"]["onTimeDelivery"]; index: number }) {
  const barFill = data.value ?? 0;
  const barColor = barFill >= 80 ? "bg-chart-green" : barFill >= 60 ? "bg-chart-amber" : "bg-chart-red";

  let trendColor = "text-muted-foreground";
  let trendText = "No completions yet";
  if (data.lateTaskCount > 0) {
    trendColor = "text-chart-red";
    trendText = `↓ ${data.lateTaskCount} late`;
  } else if (data.completedTasks > 0) {
    trendColor = "text-chart-green";
    trendText = "↑ All on time";
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      className="stat-card relative overflow-hidden flex flex-col min-w-0"
      style={cardContainerStyle}
    >
      <div className="flex items-center justify-between gap-1 mb-1" style={{ minWidth: 0, overflow: 'hidden' }}>
        <div className="flex items-center gap-1.5" style={{ minWidth: 0, overflow: 'hidden' }}>
          <CheckCircle2 className="w-4 h-4 text-muted-foreground shrink-0" />
          <p className="text-muted-foreground font-mono font-medium" style={titleStyle}>On-Time Delivery</p>
        </div>
        <span className="text-[8px] font-mono text-muted-foreground/60 bg-secondary/60 rounded px-1 py-0.5 leading-none whitespace-nowrap" style={{ flexShrink: 0 }}>DELIVERY</span>
      </div>

      <p
        className={`font-mono font-bold my-auto ${barFill >= 80 ? "text-chart-green" : barFill >= 60 ? "text-chart-amber" : "text-chart-red"}`}
        style={isShortValue(data.label) ? valueShortStyle : valueLongStyle}
        title={data.label}
      >
        {data.label}
      </p>

      <div className="mt-auto space-y-0.5" style={{ minWidth: 0, overflow: 'hidden' }}>
        <div className={`flex items-center gap-0.5 font-mono ${trendColor}`} style={trendStyle}>
          <span>{trendText}</span>
        </div>
        <p className="font-mono text-muted-foreground" style={sublineStyle} title={data.detail}>{data.detail}</p>
      </div>

      <div className="mt-2 h-[3px] bg-secondary rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, Math.max(0, barFill))}%` }}
          transition={{ duration: 0.8, delay: 0.3 + index * 0.06 }}
          className={`h-full rounded-full ${barColor}`}
        />
      </div>
    </motion.div>
  );
}

// ── SCHEDULE SLIPPAGE CARD ────────────────────────────────────────

function ScheduleSlippageCard({ data, index }: { data: ProjectKPIData["kpis"]["scheduleSlippage"]; index: number }) {
  const [showDetail, setShowDetail] = useState(false);
  const [mode, setMode] = useState<"milestone" | "project">("milestone");
  const barFill = Math.max(0, Math.min(100, 100 - (data.value * 2)));
  const barColor = data.value <= 0 ? "bg-chart-green" : data.value < 15 ? "bg-chart-amber" : "bg-chart-red";

  // Per-project grouping
  const projectGroups = useMemo(() => {
    const groups: Record<string, typeof data.overdueDetail> = {};
    for (const item of data.overdueDetail) {
      const proj = decodeHtml(item.project);
      if (!groups[proj]) groups[proj] = [];
      groups[proj].push(item);
    }
    return Object.entries(groups)
      .map(([project, items]) => ({
        project,
        worstDays: Math.max(...items.map(m => m.daysOverdue)),
        milestoneCount: items.length,
      }))
      .sort((a, b) => b.worstDays - a.worstDays);
  }, [data.overdueDetail]);

  const uniqueProjectCount = projectGroups.length;

  const primaryLabel = mode === "project"
    ? `${uniqueProjectCount} projects`
    : data.label;

  const sublineText = mode === "project"
    ? `${data.overdueMillestones} overdue milestones`
    : data.detail;

  // Colour logic: red if avg slippage > 14d, green if 0, amber in between
  const isHealthy = data.value <= 0;
  const isWarning = data.value > 0 && data.value < 15;
  const isDanger = data.value >= 15;

  // Period-over-period change (if available from data)
  const hasPrevious = (data as any).previousValue !== undefined && (data as any).previousValue !== null;
  const periodDelta = hasPrevious ? Math.round((data.value - (data as any).previousValue) * 10) / 10 : null;
  const deltaLabel = periodDelta !== null
    ? (periodDelta > 0 ? `+${periodDelta}d vs prior period` : periodDelta < 0 ? `${periodDelta}d vs prior period` : `No change vs prior period`)
    : null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: index * 0.06 }}
        className="stat-card relative overflow-hidden flex flex-col min-w-0 cursor-pointer select-none"
        style={cardContainerStyle}
        onClick={() => data.overdueDetail.length > 0 && setShowDetail(true)}
      >
        {/* Row 1 — label + badge */}
        <div className="flex items-center justify-between gap-1 mb-1" style={{ minWidth: 0, overflow: 'hidden' }}>
          <span className="text-muted-foreground font-mono font-medium" style={titleStyle}>
            Schedule Slippage
          </span>
          <span className="text-[8px] font-mono text-muted-foreground/60 bg-secondary/60 rounded px-1 py-0.5 leading-none whitespace-nowrap" style={{ flexShrink: 0 }}>DELIVERY</span>
        </div>

        {/* Toggle pills */}
        <div className="flex gap-1 flex-wrap mb-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => { e.stopPropagation(); setMode("milestone"); }}
            className={`px-1.5 py-0.5 rounded-full transition-all duration-150 font-mono whitespace-nowrap ${
              mode === "milestone"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            style={titleStyle}
          >
            Per Milestone
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setMode("project"); }}
            className={`px-1.5 py-0.5 rounded-full transition-all duration-150 font-mono whitespace-nowrap ${
              mode === "project"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            style={titleStyle}
          >
            Per Project
          </button>
        </div>

        {/* Main value */}
        <p
          className={`font-mono font-bold my-auto tabular-nums ${isDanger ? "text-chart-red" : isHealthy ? "text-chart-green" : "text-amber-400"}`}
          style={isShortValue(primaryLabel) ? valueShortStyle : valueLongStyle}
          title={primaryLabel}
        >
          {primaryLabel}
        </p>

        {/* Bottom content pushed down */}
        <div className="mt-auto space-y-0.5" style={{ minWidth: 0, overflow: 'hidden' }}>
          {/* Period delta */}
          {deltaLabel && (
            <span className="text-muted-foreground/60 font-mono truncate block" style={noteStyle}>
              {deltaLabel}
            </span>
          )}
          <p className="font-mono text-muted-foreground" style={sublineStyle} title={sublineText}>{sublineText}</p>
          {data.overdueDetail.length > 0 && (
            <p className="text-muted-foreground/40 font-mono truncate" style={noteStyle}>
              Click to view overdue {mode === "project" ? "projects" : "items"}
            </p>
          )}
        </div>

        {/* Bottom bar */}
        <div className="mt-2 h-[3px] bg-secondary rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, Math.max(0, barFill))}%` }}
            transition={{ duration: 0.8, delay: 0.3 + index * 0.06 }}
            className={`h-full rounded-full ${barColor}`}
          />
        </div>
      </motion.div>

      {/* Popup overlay — same UX pattern as Business Expenses detail modal */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono text-base">Schedule Slippage</DialogTitle>
            <DialogDescription className="font-mono text-xs text-muted-foreground">
              {mode === "project" ? "Per Project" : "Per Milestone"} · {data.overdueDetail.length} overdue items
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1 mt-2">
            {mode === "project" ? (
              projectGroups.map((pg, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-md font-mono text-xs ${
                    pg.worstDays >= 15 ? "text-chart-red bg-chart-red/5" : pg.worstDays >= 7 ? "text-amber-400 bg-amber-400/5" : "text-chart-green bg-chart-green/5"
                  }`}
                >
                  <span className="truncate min-w-0">{pg.project}</span>
                  <span className="shrink-0 tabular-nums">{pg.worstDays}d · {pg.milestoneCount} ms</span>
                </div>
              ))
            ) : (
              data.overdueDetail.map((item, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-md font-mono text-xs ${
                    item.daysOverdue >= 15 ? "text-chart-red bg-chart-red/5" : item.daysOverdue >= 7 ? "text-amber-400 bg-amber-400/5" : "text-chart-green bg-chart-green/5"
                  }`}
                >
                  <span className="truncate min-w-0">{decodeHtml(item.project)} · {decodeHtml(item.name)}</span>
                  <span className="shrink-0 tabular-nums">{item.daysOverdue}d</span>
                </div>
              ))
            )}

            {data.overdueDetail.length === 0 && (
              <p className="text-muted-foreground text-xs font-mono text-center py-4">No overdue items</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── MARGIN VARIANCE CARD ──────────────────────────────────────────

function MarginVarianceCard({ data, index }: { data: import("@/lib/projectExecutionKpis").MarginVarianceResult; index: number }) {
  const [gpTarget, setGpTarget] = useState(loadGPTarget);
  const [showDetail, setShowDetail] = useState(false);
  const [mvMode, setMvMode] = useState<"variance" | "gm">("variance");

  useEffect(() => {
    const handler = () => setGpTarget(loadGPTarget());
    window.addEventListener("storage", handler);
    window.addEventListener("gm-target-update", handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("gm-target-update", handler);
    };
  }, []);

  const isNull = data.actualGP === null || data.actualGP === undefined;
  const actualGP = data.actualGP ?? 0;
  const variance = isNull ? null : Math.round((actualGP - gpTarget) * 10) / 10;
  const isPositiveVariance = variance !== null && variance >= 0;
  const isBelowTarget = variance !== null && variance < 0;
  const displayVal = variance !== null
    ? `${isPositiveVariance ? '+' : ''}${variance}%`
    : 'N/A';
  const barFill = isNull ? 0 : Math.min(100, (actualGP / Math.max(gpTarget, 0.0001)) * 100);
  const barColor = isBelowTarget ? "bg-chart-red" : "bg-chart-green";

  const sublineText = isNull
    ? "Revenue data unavailable"
    : `${actualGP}% actual · target ${gpTarget}%`;

  const belowTarget = data.projects.filter((p) => p.gpPct < gpTarget);
  const atLoss = data.projects.filter((p) => p.gpPct < 0);
  const hasDetail = belowTarget.length > 0;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: index * 0.06 }}
        className={`stat-card relative overflow-hidden flex flex-col min-w-0 ${hasDetail ? "cursor-pointer select-none" : ""}`}
        style={cardContainerStyle}
        onClick={() => hasDetail && setShowDetail(true)}
      >
        <div className="flex items-center justify-between gap-1 mb-1" style={{ minWidth: 0, overflow: 'hidden' }}>
          <div className="flex items-center gap-1.5" style={{ minWidth: 0, overflow: 'hidden' }}>
            <TrendingUp className="w-4 h-4 text-muted-foreground shrink-0" />
            <p className="text-muted-foreground font-mono font-medium" style={titleStyle}>Margin Variance</p>
          </div>
          <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
            {atLoss.length > 0 && (
              <Badge variant="secondary" className="text-[8px] font-mono bg-chart-amber/20 text-chart-amber border-chart-amber/30 px-1 py-0">
                ⚠ {atLoss.length} at loss
              </Badge>
            )}
            <span className="text-[8px] font-mono text-muted-foreground/60 bg-secondary/60 rounded px-1 py-0.5 leading-none whitespace-nowrap">PROFIT</span>
          </div>
        </div>

        <p
          className={`font-mono font-bold my-auto ${isNull ? "text-muted-foreground/40" : isBelowTarget ? "text-chart-red" : "text-chart-green"}`}
          style={isShortValue(displayVal) ? valueShortStyle : valueLongStyle}
          title={displayVal}
        >
          {displayVal}
        </p>

        <div className="mt-auto space-y-0.5" style={{ minWidth: 0, overflow: 'hidden' }}>
          <p className="font-mono text-muted-foreground" style={sublineStyle} title={sublineText}>
            {sublineText}
          </p>
          {hasDetail && (
            <p className="text-muted-foreground/40 font-mono truncate" style={noteStyle}>
              Click to view projects below target
            </p>
          )}
        </div>

        <div className="mt-2 h-[3px] bg-secondary rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, Math.max(0, barFill))}%` }}
            transition={{ duration: 0.8, delay: 0.3 + index * 0.06 }}
            className={`h-full rounded-full ${isNull ? "bg-muted-foreground/20" : barColor}`}
          />
        </div>
      </motion.div>

      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono text-base">Margin Variance</DialogTitle>
            <DialogDescription className="font-mono text-xs text-muted-foreground">
              {belowTarget.length} project{belowTarget.length !== 1 ? "s" : ""} below target · Target {gpTarget}%
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1 mt-2">
            {belowTarget.map((job, i) => {
              const jobVariance = Math.round((job.gpPct - gpTarget) * 10) / 10;
              const severelyNegative = job.gpPct < 0;
              const rowColor = severelyNegative
                ? "text-chart-red bg-chart-red/5"
                : "text-amber-400 bg-amber-400/5";
              const reason = severelyNegative
                ? "Negative gross profit"
                : job.gpPct < gpTarget * 0.5
                ? "Costs exceed revenue margin"
                : "GP below target";

              return (
                <div key={i} className={`px-3 py-2 rounded-md font-mono text-xs ${rowColor}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-medium truncate block max-w-[220px]">{decodeHtml(job.company)}</span>
                      <span className="text-muted-foreground truncate block max-w-[220px]" style={{ fontSize: '10px' }}>{decodeHtml(job.project)}</span>
                    </div>
                    <span className="shrink-0 tabular-nums font-bold">{job.gpPct.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center justify-between mt-1 text-muted-foreground" style={{ fontSize: '10px' }}>
                    <span>{reason}</span>
                    <span className="tabular-nums">{jobVariance > 0 ? "+" : ""}{jobVariance}% vs target</span>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── TASK PROGRESS CARD ───────────────────────────────────────────

function TaskCompletionCard({ completed, total, index }: { completed: number; total: number; index: number }) {
  const pct = total > 0 ? (completed / total) * 100 : 0;
  const remaining = Math.max(0, total - completed);
  const hasData = total > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      className="stat-card relative overflow-hidden flex flex-col min-w-0"
      style={cardContainerStyle}
    >
      <div className="flex items-center justify-between gap-1 mb-1" style={{ minWidth: 0, overflow: "hidden" }}>
        <div className="flex items-center gap-1.5" style={{ minWidth: 0, overflow: "hidden" }}>
          <span className="text-muted-foreground shrink-0"><ListChecks className="w-4 h-4" /></span>
          <p className="text-muted-foreground font-mono font-medium" style={titleStyle}>Project Progress</p>
        </div>
        <span className="text-[8px] font-mono text-muted-foreground/60 bg-secondary/60 rounded px-1 py-0.5 leading-none whitespace-nowrap" style={{ flexShrink: 0 }}>DELIVERY</span>
      </div>

      <p className="font-mono font-bold text-foreground my-1" style={valueShortStyle}>
        {hasData ? `${pct.toFixed(pct > 0 && pct < 10 ? 1 : 0)}%` : "N/A"}
      </p>

      <div className="mt-auto">
        <p className="font-mono text-foreground/80" style={sublineStyle}>
          {hasData ? `${completed} of ${total} tasks done` : "No tasks found"}
        </p>
        <p className="font-mono text-muted-foreground" style={sublineStyle}>
          {hasData ? `${remaining} remaining` : "Awaiting Zoho Projects sync"}
        </p>
      </div>

      <div className="mt-2 h-[3px] bg-secondary rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, pct)}%` }}
          transition={{ duration: 0.8, delay: 0.3 + index * 0.06 }}
          className="h-full rounded-full bg-accent"
        />
      </div>
    </motion.div>
  );
}

// ── LABOUR EFFICIENCY CARD ────────────────────────────────────────

function LabourEfficiencyCard({ data, index }: { data: ProjectKPIData["kpis"]["labourEfficiency"]; index: number }) {
  const [view, setView] = useState<"hours" | "efficiency">("hours");

  const logged = data.loggedHours ?? 0;
  const estimated = data.estimatedHours ?? 0;
  const hasLogged = logged > 0;
  const hasEstimate = estimated > 0;

  const burnPct = hasEstimate ? (logged / estimated) * 100 : 0;
  const remaining = Math.max(0, estimated - logged);
  const fmtH = (h: number) => `${Math.round(h * 10) / 10}h`;

  // ----- Hours (burn) view : logged vs estimate, % done, hours left -----
  const hoursValue = !hasEstimate ? "—" : `${burnPct.toFixed(burnPct > 0 && burnPct < 10 ? 1 : 0)}%`;
  const hoursDetail = hasLogged ? `${fmtH(logged)} of ${fmtH(estimated)} logged` : "No hours logged yet";
  const hoursSub = !hasEstimate
    ? "Set task durations in Zoho Projects"
    : hasLogged ? `${fmtH(remaining)} to go` : `${fmtH(estimated)} estimated`;

  // ----- Efficiency view : est ÷ actual ratio, only meaningful once tasks complete -----
  const effReady = data.dataReady && data.value != null;
  const effValue = effReady ? `${Math.round(data.value as number)}%` : "—";
  const effColor = !effReady ? "text-muted-foreground/60" : data.isEfficient ? "text-chart-green" : "text-chart-amber";
  const effDetail = effReady ? "Est \u00f7 actual hours" : "Activates once tasks are completed";
  const effSub = hasLogged ? `${fmtH(logged)} logged \u00b7 ${fmtH(estimated)} est` : "Awaiting logged hours";

  const isHours = view === "hours";
  const headlineValue = isHours ? hoursValue : effValue;
  const headlineColor = isHours ? "text-foreground" : effColor;
  const detailText = isHours ? hoursDetail : effDetail;
  const subText = isHours ? hoursSub : effSub;
  const barPct = isHours ? Math.min(100, burnPct) : (effReady ? Math.min(100, data.value as number) : 0);
  const barColor = isHours
    ? "bg-accent"
    : !effReady ? "bg-muted-foreground/20" : data.isEfficient ? "bg-chart-green" : "bg-chart-amber";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      className="stat-card relative overflow-hidden flex flex-col min-w-0"
      style={cardContainerStyle}
    >
      <div className="flex items-center justify-between gap-1 mb-1" style={{ minWidth: 0, overflow: 'hidden' }}>
        <div className="flex items-center gap-1.5" style={{ minWidth: 0, overflow: 'hidden' }}>
          <span className="text-muted-foreground shrink-0"><Users className="w-4 h-4" /></span>
          <p className="text-muted-foreground font-mono font-medium" style={titleStyle}>Labour Efficiency</p>
        </div>
        <span className="text-[8px] font-mono text-muted-foreground/60 bg-secondary/60 rounded px-1 py-0.5 leading-none whitespace-nowrap" style={{ flexShrink: 0 }}>DELIVERY</span>
      </div>

      {/* Hours / Efficiency toggle */}
      <div className="flex items-center gap-1 mb-1">
        {(["hours", "efficiency"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`text-[9px] font-mono px-1.5 py-0.5 rounded transition-colors ${
              view === v
                ? "bg-accent/20 text-accent border border-accent/40"
                : "text-muted-foreground/60 border border-transparent hover:text-muted-foreground"
            }`}
          >
            {v === "hours" ? "Hours" : "Efficiency"}
          </button>
        ))}
      </div>

      <p className={`font-mono font-bold my-1 ${headlineColor}`} style={valueShortStyle}>{headlineValue}</p>

      <div className="mt-auto">
        <p className="font-mono text-foreground/80" style={sublineStyle}>{detailText}</p>
        <p className="font-mono text-muted-foreground" style={sublineStyle}>{subText}</p>
      </div>

      <div className="mt-2 h-[3px] bg-secondary rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${barPct}%` }}
          transition={{ duration: 0.8, delay: 0.3 + index * 0.06 }}
          className={`h-full rounded-full ${barColor}`}
        />
      </div>
    </motion.div>
  );
}

// ── CASH EXPECTED CARD ─────────────────────────────────────────────

function CashExpectedCard({
  kpi,
  index,
  invoiceFilter,
  onInvoiceFilterChange,
}: {
  kpi: KPIResult;
  index: number;
  invoiceFilter: "invoiced" | "to_be_invoiced";
  onInvoiceFilterChange: (f: "invoiced" | "to_be_invoiced") => void;
}) {
  const isUnavailable = kpi.value === null;
  const isPositive = kpi.value !== null ? kpi.value >= 0 : true;
  const trendPositive = kpi.change !== null ? kpi.change >= 0 : true;
  const displayVal = kpi.formatted ?? "--";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      className="stat-card relative overflow-hidden flex flex-col min-w-0"
      style={cardContainerStyle}
    >
      <div className="flex items-center justify-between gap-1 mb-1" style={{ minWidth: 0, overflow: 'hidden' }}>
        <div className="flex items-center gap-1.5" style={{ minWidth: 0, overflow: 'hidden' }}>
          <Wallet className="w-4 h-4 text-muted-foreground shrink-0" />
          <p className="text-muted-foreground font-mono font-medium" style={titleStyle} title="Cash Expected">
            Cash Expected
          </p>
        </div>
        <span className="text-[8px] font-mono text-muted-foreground/60 bg-secondary/60 rounded px-1 py-0.5 leading-none whitespace-nowrap" style={{ flexShrink: 0 }}>
          CASHFLOW
        </span>
      </div>

      {/* Toggle pills */}
      <div className="flex gap-1 flex-wrap mb-1">
        <button
          onClick={() => onInvoiceFilterChange("invoiced")}
          className={`px-1.5 py-0.5 rounded-full transition-all duration-150 font-mono whitespace-nowrap ${
            invoiceFilter === "invoiced"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          style={titleStyle}
        >
          To Be Paid
        </button>
        <button
          onClick={() => onInvoiceFilterChange("to_be_invoiced")}
          className={`px-1.5 py-0.5 rounded-full transition-all duration-150 font-mono whitespace-nowrap ${
            invoiceFilter === "to_be_invoiced"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          style={titleStyle}
        >
          To Be Invoiced
        </button>
      </div>

      <div className="my-auto" style={{ minWidth: 0, overflow: 'hidden' }}>
        {isUnavailable ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="font-mono font-bold text-muted-foreground/50 cursor-help" style={valueShortStyle}>
                --
              </p>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs font-mono max-w-[250px]">
              {kpi.unavailableReason ?? "Data unavailable"}
            </TooltipContent>
          </Tooltip>
        ) : (
          <p
            className={`font-mono font-bold ${isPositive ? "text-chart-green" : "text-chart-red"}`}
            style={isShortValue(displayVal) ? valueShortStyle : valueLongStyle}
            title={displayVal}
          >
            {displayVal}
          </p>
        )}
      </div>

      <div className="mt-auto space-y-0.5" style={{ minWidth: 0, overflow: 'hidden' }}>
        {!isUnavailable && kpi.changeFormatted !== "--" && (
          <div
            className={`flex items-center gap-0.5 font-mono ${trendPositive ? "text-chart-green" : "text-chart-red"}`}
            style={trendStyle}
          >
            {trendPositive ? (
              <TrendingUp className="w-3 h-3 shrink-0" />
            ) : (
              <TrendingDown className="w-3 h-3 shrink-0" />
            )}
            <span className="truncate">{kpi.changeFormatted}</span>
          </div>
        )}
        <p className="font-mono text-muted-foreground" style={sublineStyle} title={kpi.context}>
          {kpi.context}
        </p>
      </div>

      <div className="mt-2 h-[3px] bg-secondary rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{
            width: isUnavailable ? "0%" : `${Math.min(100, Math.max(10, kpi.value ?? 0))}%`,
          }}
          transition={{ duration: 0.8, delay: 0.3 + index * 0.06 }}
          className={`h-full rounded-full ${
            isUnavailable
              ? "bg-muted-foreground/20"
              : isPositive
              ? "bg-chart-green"
              : "bg-chart-red"
          }`}
        />
      </div>
    </motion.div>
  );
}

// ── PROJECTS DUE CARD ─────────────────────────────────────────────

function ProjectsDueCard({ projects, periodLabel, index }: { projects: PEProject[]; periodLabel: string; index: number }) {
  const count = projects.length;
  const totalRev = projects.reduce((s, p) => s + (p.estRevenue ?? 0), 0);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      className="stat-card relative overflow-hidden flex flex-col min-w-0"
      style={cardContainerStyle}
    >
      <div className="flex items-center justify-between gap-1 mb-1" style={{ minWidth: 0, overflow: "hidden" }}>
        <div className="flex items-center gap-1.5" style={{ minWidth: 0, overflow: "hidden" }}>
          <span className="text-muted-foreground shrink-0"><FolderCheck className="w-4 h-4" /></span>
          <p className="text-muted-foreground font-mono font-medium" style={titleStyle}>Projects Due</p>
        </div>
        <span className="text-[8px] font-mono text-muted-foreground/60 bg-secondary/60 rounded px-1 py-0.5 leading-none whitespace-nowrap" style={{ flexShrink: 0 }}>DELIVERY</span>
      </div>

      <p className="font-mono font-bold text-foreground my-1" style={valueShortStyle}>{count}</p>

      <div className="mt-auto">
        <p className="font-mono text-foreground/80" style={sublineStyle}>{periodLabel || "—"}</p>
        <p className="font-mono text-muted-foreground" style={sublineStyle}>
          {totalRev > 0 ? `${formatMetricValue(totalRev, "currency")} to invoice` : "No revenue matched"}
        </p>
      </div>

      <div className="mt-2 h-[3px] bg-secondary rounded-full overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: count > 0 ? "100%" : "0%" }} transition={{ duration: 0.8, delay: 0.3 + index * 0.06 }} className="h-full rounded-full bg-accent" />
      </div>
    </motion.div>
  );
}

// ── PROJECTS TABLE ────────────────────────────────────────────────

const ZOHO_PROJECTS_URL = "https://projects.zoho.com.au/portal/totaltactilesprojects";

function ProjectsTable({
  monthProjects,
  allProjects,
  periodLabel,
}: {
  monthProjects: PEProject[];
  allProjects: PEProject[];
  periodLabel: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? allProjects : monthProjects;

  const $ = (n: number) => formatMetricValue(n, "currency");
  const totalRev = rows.reduce((s, p) => s + (p.estRevenue ?? 0), 0);
  const totalCost = rows.reduce((s, p) => s + (p.estCost ?? 0), 0);
  const totalHours = Math.round(rows.reduce((s, p) => s + (p.loggedHours ?? 0), 0) * 10) / 10;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="chart-container col-span-full mt-4 md:mt-6"
    >
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h3 className="text-fluid-sm font-medium text-muted-foreground">Projects to Complete</h3>
          <span className="text-[11px] px-2 py-1 rounded-full border border-border font-mono text-muted-foreground">
            {showAll ? "All active" : (periodLabel || "—")}
          </span>
          <span className="text-xs font-mono text-muted-foreground">
            {rows.length} {rows.length === 1 ? "project" : "projects"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* All / month toggle */}
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            <button
              onClick={() => setShowAll(false)}
              className={`px-2.5 py-1 text-[11px] font-mono transition-colors ${!showAll ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {periodLabel || "Month"}
            </button>
            <button
              onClick={() => setShowAll(true)}
              className={`px-2.5 py-1 text-[11px] font-mono transition-colors ${showAll ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              All
            </button>
          </div>

          {/* Zoho Projects link */}
          <a
            href={ZOHO_PROJECTS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-accent transition-colors"
          >
            View in Zoho Projects
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground font-mono py-6 text-center">
          {showAll ? "No active projects." : `No projects with a job date in ${periodLabel || "this period"}.`}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-muted-foreground border-b border-border/50">
                <th className="text-left font-medium py-2 pr-3">Project</th>
                <th className="text-right font-medium py-2 px-3">% Complete</th>
                <th className="text-right font-medium py-2 px-3">Hours</th>
                <th className="text-right font-medium py-2 px-3">Job Date</th>
                <th className="text-right font-medium py-2 px-3">Est. Cost</th>
                <th className="text-right font-medium py-2 pl-3">Est. Revenue</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => (
                <tr key={i} className="border-b border-border/30">
                  <td className="text-left py-2 pr-3 text-foreground"><span className="block max-w-[260px] truncate">{p.name}</span></td>
                  <td className="text-right py-2 px-3 text-foreground">{p.pctComplete != null ? `${p.pctComplete}%` : "—"}</td>
                  <td className="text-right py-2 px-3 text-muted-foreground">{p.loggedHours ?? 0}h</td>
                  <td className="text-right py-2 px-3 text-muted-foreground">{p.invoiceDate ?? "—"}</td>
                  <td className="text-right py-2 px-3 text-chart-red">{p.estCost != null ? $(p.estCost) : "—"}</td>
                  <td className="text-right py-2 pl-3 text-chart-green">{p.estRevenue != null ? $(p.estRevenue) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border font-bold">
                <td className="text-left py-2 pr-3 text-foreground">Total ({rows.length})</td>
                <td className="text-right py-2 px-3" />
                <td className="text-right py-2 px-3 text-foreground">{totalHours}h</td>
                <td className="text-right py-2 px-3" />
                <td className="text-right py-2 px-3 text-chart-red">{$(totalCost)}</td>
                <td className="text-right py-2 pl-3 text-chart-green">{$(totalRev)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </motion.div>
  );
}

// ── Section component ──────────────────────────────────────────────

interface ProjectExecutionKPIsProps {
  selectedPeriodIdx: number;
  onPeriodChange: (idx: number) => void;
  invoiceFilter: "invoiced" | "to_be_invoiced";
  onInvoiceFilterChange: (filter: "invoiced" | "to_be_invoiced") => void;
}

export default function ProjectExecutionKPIs({ selectedPeriodIdx, onPeriodChange, invoiceFilter: _invoiceFilter, onInvoiceFilterChange: _onInvoiceFilterChange }: ProjectExecutionKPIsProps) {
  const { quotedJobs, revenueProjects, incomeOutgoingsData, projectKPIData, sources, syncProjectKPIs } = useDashboardData();
  const periodOptions = useMemo(() => buildPeriodOptions(quotedJobs, revenueProjects), [quotedJobs, revenueProjects]);
  const period = periodOptions[selectedPeriodIdx] ?? null;

  const kpis = useMemo(
    () => period ? computeExecutionKPIs(quotedJobs, revenueProjects, incomeOutgoingsData, period) : null,
    [quotedJobs, revenueProjects, incomeOutgoingsData, period]
  );

  // Determine Zoho Projects connector state
  const zohoProjectsSource = sources.find((s) => s.id === "zoho_projects");
  const zohoEnabled = zohoProjectsSource?.connected ?? false;
  const zohoHasError = zohoEnabled && !!zohoProjectsSource?.lastError && !zohoProjectsSource?.loading;
  const zohoLoading = zohoEnabled && (zohoProjectsSource?.loading || false) && !projectKPIData;
  const zohoSyncing = zohoProjectsSource?.loading ?? false;
  const zohoLastSync = zohoProjectsSource?.lastSync || "";
  const zohoSyncError = zohoProjectsSource?.lastError || "";

  const periodLabel = period?.label ?? "";
  const monthSet = useMemo(() => new Set(period?.months ?? []), [period]);
  const monthProjects = useMemo(
    () => (projectKPIData?.projects ?? []).filter((p) => {
      const k = invoiceToMonKey(p.invoiceDate);
      return k !== null && monthSet.has(k);
    }),
    [projectKPIData, monthSet]
  );


  if (!kpis || !period) {
    return (
      <div className="mb-4 md:mb-6">
        <SectionHeader title="DOING THE DEED" />
      </div>
    );
  }

  // 4 Zoho-driven cards
  const zohoCardDefs = [
    { title: "Projects Due",     icon: <FolderCheck className="w-4 h-4" />, group: "DELIVERY" },
    { title: "Project Progress", icon: <ListChecks className="w-4 h-4" />,  group: "DELIVERY" },
    { title: "Labour Efficiency",icon: <Users className="w-4 h-4" />,       group: "DELIVERY" },
    { title: "Margin Variance",  icon: <TrendingUp className="w-4 h-4" />,  group: "PROFIT" },
  ];

  // ── Period pills (Quarter / YTD / All) ──
  const _now = new Date();
  const _yy = String(_now.getFullYear()).slice(-2);
  const _curQ = Math.floor(_now.getMonth() / 3) + 1;
  const quarterIdx = periodOptions.findIndex((p) => p.mode === "quarter" && p.key === `Q${_curQ}-${_yy}`);
  const ytdIdx     = periodOptions.findIndex((p) => p.mode === "ytd" && p.key === `YTD-${_yy}`);
  const allIdx     = periodOptions.findIndex((p) => p.mode === "all");
  const pillDefs = [
    { label: `Q${_curQ} ${_now.getFullYear()}`, idx: quarterIdx },
    { label: "YTD", idx: ytdIdx },
    { label: "All", idx: allIdx },
  ].filter((p) => p.idx >= 0);

  const monthOnlyOptions = periodOptions
    .map((opt, i) => ({ opt, i }))
    .filter(({ opt }) => opt.mode === "month");

  return (
    <div className="mb-4 md:mb-6">
      {(() => {
        const cur = periodOptions[selectedPeriodIdx];
        const activePillKey =
          cur?.mode === "quarter" ? "quarter" :
          cur?.mode === "ytd"     ? "ytd" :
          cur?.mode === "all"     ? "all" : null;
        const selectedMonthKey = cur?.mode === "month" ? cur.key : null;
        const ddSubtitle = selectedMonthKey
          ? monthLabel(selectedMonthKey)
          : activePillKey === "ytd"  ? moneyScopeLabel("ytd").subtitle
          : activePillKey === "all"  ? "All time"
          : moneyScopeLabel("quarter").subtitle;

        const syncBtn = (
          <button
            onClick={() => syncProjectKPIs()}
            disabled={zohoSyncing}
            title={
              zohoSyncError
                ? `Sync failed: ${zohoSyncError}`
                : zohoLastSync
                ? `Last synced: ${zohoLastSync}`
                : "Sync Zoho Projects data"
            }
            className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 font-mono text-muted-foreground transition-colors hover:text-foreground hover:border-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontSize: "clamp(10px, 0.9vw, 12px)" }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${zohoSyncing ? "animate-spin" : ""}`} />
            <span>{zohoSyncing ? "Syncing\u2026" : "Sync"}</span>
            {zohoSyncError && !zohoSyncing && (
              <span className="ml-0.5 inline-block w-1.5 h-1.5 rounded-full bg-chart-red" aria-label="Sync error" />
            )}
          </button>
        );

        return (
          <SectionPeriodHeader
            title="Doing The Deed"
            pills={[
              { key: "quarter", label: moneyScopeLabel("quarter").pill },
              { key: "ytd", label: "YTD" },
              { key: "all", label: "All" },
            ]}
            activeKey={activePillKey}
            onPill={(k) => {
              const idx = k === "quarter" ? quarterIdx : k === "ytd" ? ytdIdx : allIdx;
              if (idx >= 0) onPeriodChange(idx);
            }}
            months={periodOptions
              .filter((p) => p.mode === "month")
              .map((p) => ({ key: p.key, label: monthLabel(p.key) }))}
            selectedMonth={selectedMonthKey}
            onMonth={(k) => {
              if (!k) { if (quarterIdx >= 0) onPeriodChange(quarterIdx); return; }
              const idx = periodOptions.findIndex((p) => p.mode === "month" && p.key === k);
              if (idx >= 0) onPeriodChange(idx);
            }}
            subtitle={ddSubtitle}
            rightSlot={syncBtn}
          />
        );
      })()}

      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 items-stretch"
        style={{ gap: "clamp(8px, 1vw, 16px)" }}
      >
        {/* 4 Zoho-driven cards */}
        {zohoCardDefs.map((def, i) => {
          if (!zohoEnabled) {
            return <ZohoKPIDisabled key={def.title} {...def} index={i} />;
          }
          if (zohoLoading) {
            return <ZohoKPISkeleton key={def.title} index={i} />;
          }
          if (zohoHasError && !projectKPIData) {
            return <ZohoKPIError key={def.title} {...def} index={i} />;
          }
          if (!projectKPIData) {
            return <ZohoKPISkeleton key={def.title} index={i} />;
          }

          switch (i) {
            case 0:
              return <ProjectsDueCard key={def.title} projects={monthProjects} periodLabel={periodLabel} index={i} />;
            case 1:
              return <TaskCompletionCard key={def.title} completed={projectKPIData.dataHealth.trackedTasksCompleted ?? projectKPIData.dataHealth.completedTasksFound} total={projectKPIData.dataHealth.trackedTasksTotal ?? projectKPIData.dataHealth.tasks} index={i} />;
            case 2:
              return <LabourEfficiencyCard key={def.title} data={projectKPIData.kpis.labourEfficiency} index={i} />;
            case 3:
              return <MarginVarianceCard key={def.title} data={kpis.marginVariance} index={i} />;
            default:
              return null;
          }
        })}
      </div>

      <ProjectsTable
        monthProjects={monthProjects}
        allProjects={projectKPIData?.projects ?? []}
        periodLabel={periodLabel}
      />
    </div>
  );
}
