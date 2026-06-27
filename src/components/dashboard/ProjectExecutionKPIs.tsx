import { useState, useMemo, useEffect, useCallback } from "react";
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

function MarginVarianceCard({ data, index }: { data: ProjectKPIData["kpis"]["marginVariance"]; index: number }) {
  const [gpTarget, setGpTarget] = useState(loadGPTarget);
  const [showDetail, setShowDetail] = useState(false);

  // Listen for GP target changes from the chart
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
  const barFill = isNull ? 0 : Math.min(100, (actualGP / gpTarget) * 100);
  const barColor = isBelowTarget ? "bg-chart-red" : "bg-chart-green";

  const sublineText = isNull
    ? "Revenue data unavailable"
    : `${actualGP}% actual · target ${gpTarget}%`;

  const hasDetail = data.negativeGPJobs.length > 0;

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
            {data.negativeGPJobs.length > 0 && (
              <Badge variant="secondary" className="text-[8px] font-mono bg-chart-amber/20 text-chart-amber border-chart-amber/30 px-1 py-0">
                ⚠ {data.negativeGPJobs.length} at loss
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
              Click to view jobs at loss
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

      {/* Modal — same pattern as Schedule Slippage */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono text-base">Margin Variance</DialogTitle>
            <DialogDescription className="font-mono text-xs text-muted-foreground">
              {data.negativeGPJobs.length} job{data.negativeGPJobs.length !== 1 ? "s" : ""} below target · Target {gpTarget}%
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1 mt-2">
            {data.negativeGPJobs.map((job, i) => {
              const jobVariance = Math.round((job.gpPct - gpTarget) * 10) / 10;
              const severelyNegative = job.gpPct < 0;
              const belowTarget = job.gpPct < gpTarget;
              const rowColor = severelyNegative
                ? "text-chart-red bg-chart-red/5"
                : belowTarget
                ? "text-amber-400 bg-amber-400/5"
                : "text-chart-green bg-chart-green/5";
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

// ── LABOUR EFFICIENCY CARD ────────────────────────────────────────

function LabourEfficiencyCard({ data, index }: { data: ProjectKPIData["kpis"]["labourEfficiency"]; index: number }) {
  const [showDetail, setShowDetail] = useState(false);
  const barFill = !data.dataReady ? 0 : Math.min(100, data.value ?? 0);
  const barColor = !data.dataReady ? "bg-muted-foreground/20" : (data.value ?? 0) >= 100 ? "bg-chart-green" : "bg-chart-amber";
  const valueColor = !data.dataReady ? "text-muted-foreground/60" : data.isEfficient ? "text-chart-green" : "text-chart-amber";

  const effPct = data.value ?? 0;
  const hasDetail = data.dataReady && data.loggedHours > 0;

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
            <Users className="w-4 h-4 text-muted-foreground shrink-0" />
            <p className="text-muted-foreground font-mono font-medium" style={titleStyle}>Labour Efficiency</p>
          </div>
          <span className="text-[8px] font-mono text-muted-foreground/60 bg-secondary/60 rounded px-1 py-0.5 leading-none whitespace-nowrap" style={{ flexShrink: 0 }}>DELIVERY</span>
        </div>

        <p
          className={`font-mono font-bold my-auto ${valueColor}`}
          style={isShortValue(data.label) ? valueShortStyle : valueLongStyle}
          title={data.label}
        >
          {data.label}
        </p>

        <div className="mt-auto space-y-0.5" style={{ minWidth: 0, overflow: 'hidden' }}>
          <p className="font-mono text-muted-foreground" style={sublineStyle} title={data.detail}>{data.detail}</p>
          {data.note && (
            <p className="font-mono text-muted-foreground" style={noteStyle}>{data.note}</p>
          )}
          {hasDetail && (
            <p className="text-muted-foreground/40 font-mono truncate" style={noteStyle}>
              Click to view breakdown
            </p>
          )}
        </div>

        <div className="mt-2 h-[3px] bg-secondary rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: data.dataReady ? `${Math.min(100, Math.max(0, barFill))}%` : "0%" }}
            transition={{ duration: 0.8, delay: 0.3 + index * 0.06 }}
            className={`h-full rounded-full ${barColor}`}
          />
        </div>
      </motion.div>

      {/* Modal — same pattern as Schedule Slippage */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono text-base">Labour Efficiency</DialogTitle>
            <DialogDescription className="font-mono text-xs text-muted-foreground">
              Estimated vs actual logged hours
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 mt-2">
            {/* Summary rows */}
            <div className="flex items-center justify-between px-3 py-1.5 rounded-md font-mono text-xs bg-secondary/40">
              <span className="text-muted-foreground">Estimated Hours</span>
              <span className="tabular-nums text-foreground">{data.estimatedHours.toFixed(1)}h</span>
            </div>
            <div className="flex items-center justify-between px-3 py-1.5 rounded-md font-mono text-xs bg-secondary/40">
              <span className="text-muted-foreground">Logged Hours</span>
              <span className="tabular-nums text-foreground">{data.loggedHours.toFixed(1)}h</span>
            </div>
            <div className="flex items-center justify-between px-3 py-1.5 rounded-md font-mono text-xs bg-secondary/40">
              <span className="text-muted-foreground">Variance</span>
              <span className={`tabular-nums ${data.estimatedHours - data.loggedHours >= 0 ? "text-chart-green" : "text-chart-red"}`}>
                {data.estimatedHours - data.loggedHours >= 0 ? "+" : ""}{(data.estimatedHours - data.loggedHours).toFixed(1)}h
              </span>
            </div>
            <div
              className={`flex items-center justify-between px-3 py-2 rounded-md font-mono text-sm font-bold ${
                effPct >= 100 ? "text-chart-green bg-chart-green/5" : effPct >= 85 ? "text-amber-400 bg-amber-400/5" : "text-chart-red bg-chart-red/5"
              }`}
            >
              <span>Efficiency</span>
              <span className="tabular-nums">{effPct.toFixed(1)}%</span>
            </div>

            {/* Contextual note */}
            <p className="text-muted-foreground font-mono mt-1" style={{ fontSize: '11px', lineHeight: '1.4' }}>
              {effPct >= 100
                ? "Work is completing within or under estimated hours — on budget."
                : effPct >= 85
                ? "Slightly over estimated hours. Monitor for scope creep."
                : "Significantly over estimated hours. Review estimates and workload."}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
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

  if (!kpis || !period) {
    return (
      <div className="mb-4 md:mb-6">
        <SectionHeader title="DOING THE DEED" />
      </div>
    );
  }

  // 4 Zoho-driven cards
  const zohoCardDefs = [
    { title: "On-Time Delivery", icon: <CheckCircle2 className="w-4 h-4" />, group: "DELIVERY" },
    { title: "Schedule Slippage", icon: <Clock className="w-4 h-4" />, group: "DELIVERY" },
    { title: "Margin Variance", icon: <TrendingUp className="w-4 h-4" />, group: "PROFIT" },
    { title: "Labour Efficiency", icon: <Users className="w-4 h-4" />, group: "DELIVERY" },
  ];

  // Jobs Due card (only remaining non-Zoho card)
  const existingCards: ExecKPICardProps[] = [
    { title: "Jobs Due", group: "DELIVERY", icon: <CalendarClock className="w-4 h-4" />, kpi: kpis.jobsDuePeriod, index: 4 },
  ];

  return (
    <div className="mb-4 md:mb-6">
      <SectionHeader title="DOING THE DEED">
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 font-mono text-xs">
              {period.label}
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
            {periodOptions.map((opt, i) => (
              <DropdownMenuItem
                key={opt.key}
                onClick={() => onPeriodChange(i)}
                className={`font-mono text-xs ${i === selectedPeriodIdx ? "bg-accent" : ""}`}
              >
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SectionHeader>

      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 items-stretch"
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
            case 0: return <OnTimeDeliveryCard key={def.title} data={projectKPIData.kpis.onTimeDelivery} index={i} />;
            case 1: return <ScheduleSlippageCard key={def.title} data={projectKPIData.kpis.scheduleSlippage} index={i} />;
            case 2: return <MarginVarianceCard key={def.title} data={projectKPIData.kpis.marginVariance} index={i} />;
            case 3: return <LabourEfficiencyCard key={def.title} data={projectKPIData.kpis.labourEfficiency} index={i} />;
            default: return null;
          }
        })}

        {/* Jobs Due — untouched */}
        {existingCards.map((card) => (
          <ExecKPICard key={card.title} {...card} />
        ))}
      </div>
    </div>
  );
}
