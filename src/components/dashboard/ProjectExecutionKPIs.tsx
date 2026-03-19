import { useState, useMemo } from "react";
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
  AlertTriangle,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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

// ── Helpers ────────────────────────────────────────────────────────

function decodeHtml(html: string): string {
  const txt = document.createElement("textarea");
  txt.innerHTML = html;
  return txt.value;
}

// ── Legacy ExecKPICard (for unchanged cards) ──────────────────────

interface ExecKPICardProps {
  title: string;
  group: string;
  icon: React.ReactNode;
  kpi: KPIResult;
  index: number;
}

function ExecKPICard({ title, group, icon, kpi, index }: ExecKPICardProps) {
  const isUnavailable = kpi.value === null;
  const isPositive = kpi.change !== null ? kpi.change >= 0 : true;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      className="stat-card relative overflow-hidden flex flex-col"
      style={{ padding: "clamp(12px, 1.8vw, 20px)", minHeight: "110px" }}
    >
      <div className="flex items-start justify-between gap-1 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-muted-foreground shrink-0">{icon}</span>
          <p
            className="text-muted-foreground font-mono uppercase tracking-wider truncate font-medium"
            style={{ fontSize: "clamp(9px, 1vw, 11px)" }}
            title={title}
          >
            {title}
          </p>
        </div>
        <span className="text-[8px] font-mono text-muted-foreground/60 bg-secondary/60 rounded px-1 py-0.5 leading-none whitespace-nowrap shrink-0">
          {group}
        </span>
      </div>

      <div className="my-auto">
        {isUnavailable ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <p
                className="font-mono font-bold text-muted-foreground/50 cursor-help"
                style={{ fontSize: "clamp(20px, 3.2vw, 30px)", lineHeight: 1.15 }}
              >
                --
              </p>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs font-mono max-w-[250px]">
              {kpi.unavailableReason ?? "Data unavailable"}
            </TooltipContent>
          </Tooltip>
        ) : (
          <p
            className={`font-mono font-bold whitespace-nowrap ${
              isPositive ? "text-chart-green" : "text-chart-red"
            }`}
            style={{ fontSize: "clamp(20px, 3.2vw, 30px)", lineHeight: 1.15 }}
          >
            {kpi.formatted}
          </p>
        )}
      </div>

      <div className="mt-auto space-y-0.5">
        {!isUnavailable && kpi.changeFormatted !== "--" && (
          <div
            className={`flex items-center gap-0.5 font-mono ${
              isPositive ? "text-chart-green" : "text-chart-red"
            }`}
            style={{ fontSize: "clamp(10px, 1vw, 12px)" }}
          >
            {isPositive ? (
              <TrendingUp className="w-3 h-3 shrink-0" />
            ) : (
              <TrendingDown className="w-3 h-3 shrink-0" />
            )}
            <span className="truncate">{kpi.changeFormatted}</span>
          </div>
        )}
        <p
          className="font-mono text-muted-foreground truncate leading-snug"
          style={{ fontSize: "clamp(9px, 0.95vw, 11px)" }}
          title={kpi.context}
        >
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
      className="stat-card relative overflow-hidden flex flex-col"
      style={{ padding: "clamp(12px, 1.8vw, 20px)", minHeight: "110px" }}
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
      className="stat-card relative overflow-hidden flex flex-col opacity-60"
      style={{ padding: "clamp(12px, 1.8vw, 20px)", minHeight: "110px" }}
    >
      <div className="flex items-start justify-between gap-1 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-muted-foreground shrink-0">{icon}</span>
          <p className="text-muted-foreground font-mono uppercase tracking-wider truncate font-medium" style={{ fontSize: "clamp(9px, 1vw, 11px)" }}>{title}</p>
        </div>
        <span className="text-[8px] font-mono text-muted-foreground/60 bg-secondary/60 rounded px-1 py-0.5 leading-none whitespace-nowrap shrink-0">{group}</span>
      </div>
      <p className="font-mono font-bold text-muted-foreground/40 my-auto" style={{ fontSize: "clamp(20px, 3.2vw, 30px)", lineHeight: 1.15 }}>--</p>
      <p className="font-mono text-muted-foreground mt-auto" style={{ fontSize: "clamp(9px, 0.95vw, 11px)" }}>Enable in Settings → Data Sources</p>
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
      className="stat-card relative overflow-hidden flex flex-col"
      style={{ padding: "clamp(12px, 1.8vw, 20px)", minHeight: "110px" }}
    >
      <div className="flex items-start justify-between gap-1 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-muted-foreground shrink-0">{icon}</span>
          <p className="text-muted-foreground font-mono uppercase tracking-wider truncate font-medium" style={{ fontSize: "clamp(9px, 1vw, 11px)" }}>{title}</p>
        </div>
        <span className="text-[8px] font-mono text-muted-foreground/60 bg-secondary/60 rounded px-1 py-0.5 leading-none whitespace-nowrap shrink-0">{group}</span>
      </div>
      <p className="font-mono font-bold text-muted-foreground/40 my-auto" style={{ fontSize: "clamp(20px, 3.2vw, 30px)", lineHeight: 1.15 }}>--</p>
      <p className="font-mono text-chart-amber mt-auto" style={{ fontSize: "clamp(9px, 0.95vw, 11px)" }}>Sync failed · Check Settings</p>
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
      className="stat-card relative overflow-hidden flex flex-col"
      style={{ padding: "clamp(12px, 1.8vw, 20px)", minHeight: "110px" }}
    >
      <div className="flex items-start justify-between gap-1 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <CheckCircle2 className="w-4 h-4 text-muted-foreground shrink-0" />
          <p className="text-muted-foreground font-mono uppercase tracking-wider truncate font-medium" style={{ fontSize: "clamp(9px, 1vw, 11px)" }}>On-Time Delivery</p>
        </div>
        <span className="text-[8px] font-mono text-muted-foreground/60 bg-secondary/60 rounded px-1 py-0.5 leading-none whitespace-nowrap shrink-0">DELIVERY</span>
      </div>

      <p
        className={`font-mono font-bold whitespace-nowrap my-auto ${barFill >= 80 ? "text-chart-green" : barFill >= 60 ? "text-chart-amber" : "text-chart-red"}`}
        style={{ fontSize: "clamp(20px, 3.2vw, 30px)", lineHeight: 1.15 }}
      >
        {data.label}
      </p>

      <div className="mt-auto space-y-0.5">
        <div className={`flex items-center gap-0.5 font-mono ${trendColor}`} style={{ fontSize: "clamp(10px, 1vw, 12px)" }}>
          <span>{trendText}</span>
        </div>
        <p className="font-mono text-muted-foreground truncate leading-snug" style={{ fontSize: "clamp(9px, 0.95vw, 11px)" }} title={data.detail}>{data.detail}</p>
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
  const [showTooltip, setShowTooltip] = useState(false);
  const barFill = Math.max(0, Math.min(100, 100 - (data.value * 2)));
  const barColor = data.value <= 0 ? "bg-chart-green" : data.value < 15 ? "bg-chart-amber" : "bg-chart-red";

  return (
    <Tooltip open={showTooltip} onOpenChange={setShowTooltip}>
      <TooltipTrigger asChild>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: index * 0.06 }}
          className="stat-card relative overflow-hidden flex flex-col cursor-help"
          style={{ padding: "clamp(12px, 1.8vw, 20px)", minHeight: "110px" }}
          onMouseEnter={() => data.overdueDetail.length > 0 && setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <div className="flex items-start justify-between gap-1 mb-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
              <p className="text-muted-foreground font-mono uppercase tracking-wider truncate font-medium" style={{ fontSize: "clamp(9px, 1vw, 11px)" }}>Schedule Slippage</p>
            </div>
            <span className="text-[8px] font-mono text-muted-foreground/60 bg-secondary/60 rounded px-1 py-0.5 leading-none whitespace-nowrap shrink-0">DELIVERY</span>
          </div>

          <p
            className={`font-mono font-bold whitespace-nowrap my-auto ${data.isOverdue ? "text-chart-amber" : "text-chart-green"}`}
            style={{ fontSize: "clamp(20px, 3.2vw, 30px)", lineHeight: 1.15 }}
          >
            {data.label}
          </p>

          <div className="mt-auto space-y-0.5">
            <p className="font-mono text-muted-foreground truncate leading-snug" style={{ fontSize: "clamp(9px, 0.95vw, 11px)" }} title={data.detail}>{data.detail}</p>
          </div>

          <div className="mt-2 h-[3px] bg-secondary rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${barFill}%` }}
              transition={{ duration: 0.8, delay: 0.3 + index * 0.06 }}
              className={`h-full rounded-full ${barColor}`}
            />
          </div>
        </motion.div>
      </TooltipTrigger>
      {data.overdueDetail.length > 0 && (
        <TooltipContent side="bottom" className="max-w-[320px] p-3">
          <p className="text-xs font-mono font-semibold mb-1.5">Overdue Items</p>
          <div className="space-y-1">
            {data.overdueDetail.slice(0, 5).map((item, i) => (
              <div key={i} className="text-[11px] font-mono text-muted-foreground leading-snug">
                <span className="text-foreground">{decodeHtml(item.project)}</span> · {decodeHtml(item.name)} · <span className="text-chart-amber">{item.daysOverdue}d overdue</span>
              </div>
            ))}
            {data.overdueDetail.length > 5 && (
              <p className="text-[10px] font-mono text-muted-foreground">+ {data.overdueDetail.length - 5} more</p>
            )}
          </div>
        </TooltipContent>
      )}
    </Tooltip>
  );
}

// ── MARGIN VARIANCE CARD ──────────────────────────────────────────

function MarginVarianceCard({ data, index }: { data: ProjectKPIData["kpis"]["marginVariance"]; index: number }) {
  const isNull = data.value === null;
  const barFill = isNull ? 0 : Math.min(100, ((data.actualGP ?? 0) / data.targetGP) * 100);
  const barColor = data.isBelowTarget ? "bg-chart-red" : "bg-chart-green";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      className="stat-card relative overflow-hidden flex flex-col"
      style={{ padding: "clamp(12px, 1.8vw, 20px)", minHeight: "110px" }}
    >
      <div className="flex items-start justify-between gap-1 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <TrendingUp className="w-4 h-4 text-muted-foreground shrink-0" />
          <p className="text-muted-foreground font-mono uppercase tracking-wider truncate font-medium" style={{ fontSize: "clamp(9px, 1vw, 11px)" }}>Margin Variance</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {data.negativeGPJobs.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="text-[8px] font-mono bg-chart-amber/20 text-chart-amber border-chart-amber/30 cursor-help px-1 py-0">
                  ⚠ {data.negativeGPJobs.length} at loss
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[300px] p-3">
                <p className="text-xs font-mono font-semibold mb-1.5">Jobs at Loss</p>
                <div className="space-y-1">
                  {data.negativeGPJobs.slice(0, 5).map((job, i) => (
                    <div key={i} className="text-[11px] font-mono text-muted-foreground leading-snug">
                      <span className="text-foreground">{decodeHtml(job.company)}</span> · {decodeHtml(job.project)} · <span className="text-chart-red">{job.gpPct.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          )}
          <span className="text-[8px] font-mono text-muted-foreground/60 bg-secondary/60 rounded px-1 py-0.5 leading-none whitespace-nowrap">PROFIT</span>
        </div>
      </div>

      <p
        className={`font-mono font-bold whitespace-nowrap my-auto ${isNull ? "text-muted-foreground/40" : data.isBelowTarget ? "text-chart-red" : "text-chart-green"}`}
        style={{ fontSize: "clamp(20px, 3.2vw, 30px)", lineHeight: 1.15 }}
      >
        {isNull ? "N/A" : data.label}
      </p>

      <div className="mt-auto space-y-0.5">
        <p className="font-mono text-muted-foreground truncate leading-snug" style={{ fontSize: "clamp(9px, 0.95vw, 11px)" }} title={data.detail}>
          {isNull ? "Revenue data unavailable" : data.detail}
        </p>
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
  );
}

// ── LABOUR EFFICIENCY CARD ────────────────────────────────────────

function LabourEfficiencyCard({ data, index }: { data: ProjectKPIData["kpis"]["labourEfficiency"]; index: number }) {
  const barFill = !data.dataReady ? 0 : Math.min(100, data.value ?? 0);
  const barColor = !data.dataReady ? "bg-muted-foreground/20" : (data.value ?? 0) >= 100 ? "bg-chart-green" : "bg-chart-amber";
  const valueColor = !data.dataReady ? "text-muted-foreground/60" : data.isEfficient ? "text-chart-green" : "text-chart-amber";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      className="stat-card relative overflow-hidden flex flex-col"
      style={{ padding: "clamp(12px, 1.8vw, 20px)", minHeight: "110px" }}
    >
      <div className="flex items-start justify-between gap-1 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <Users className="w-4 h-4 text-muted-foreground shrink-0" />
          <p className="text-muted-foreground font-mono uppercase tracking-wider truncate font-medium" style={{ fontSize: "clamp(9px, 1vw, 11px)" }}>Labour Efficiency</p>
        </div>
        <span className="text-[8px] font-mono text-muted-foreground/60 bg-secondary/60 rounded px-1 py-0.5 leading-none whitespace-nowrap shrink-0">DELIVERY</span>
      </div>

      <p
        className={`font-mono font-bold whitespace-nowrap my-auto ${valueColor}`}
        style={{ fontSize: "clamp(20px, 3.2vw, 30px)", lineHeight: 1.15 }}
      >
        {data.label}
      </p>

      <div className="mt-auto space-y-0.5">
        <p className="font-mono text-muted-foreground truncate leading-snug" style={{ fontSize: "clamp(9px, 0.95vw, 11px)" }} title={data.detail}>{data.detail}</p>
        {data.note && (
          <p className="font-mono text-muted-foreground/70 italic truncate leading-snug" style={{ fontSize: "clamp(8px, 0.85vw, 10px)" }}>{data.note}</p>
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
  );
}

// ── Section component ──────────────────────────────────────────────

interface ProjectExecutionKPIsProps {
  selectedPeriodIdx: number;
  onPeriodChange: (idx: number) => void;
}

export default function ProjectExecutionKPIs({ selectedPeriodIdx, onPeriodChange }: ProjectExecutionKPIsProps) {
  const { quotedJobs, revenueProjects, incomeOutgoingsData, projectKPIData, sources } = useDashboardData();
  const periodOptions = useMemo(() => buildPeriodOptions(quotedJobs), [quotedJobs]);
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

  if (!kpis || !period) {
    return (
      <div className="mb-4 md:mb-6">
        <h2 className="font-semibold text-foreground font-mono" style={{ fontSize: "clamp(14px, 1.8vw, 20px)" }}>
          Project Execution
        </h2>
        <p className="text-muted-foreground font-mono mt-1" style={{ fontSize: "clamp(10px, 1vw, 12px)" }}>
          No quoted jobs data available
        </p>
      </div>
    );
  }

  const gmIsForecast = kpis.weightedGrossMargin.isForecast === true;

  // 4 Zoho-driven cards
  const zohoCardDefs = [
    { title: "On-Time Delivery", icon: <CheckCircle2 className="w-4 h-4" />, group: "DELIVERY" },
    { title: "Schedule Slippage", icon: <Clock className="w-4 h-4" />, group: "DELIVERY" },
    { title: "Margin Variance", icon: <TrendingUp className="w-4 h-4" />, group: "PROFIT" },
    { title: "Labour Efficiency", icon: <Users className="w-4 h-4" />, group: "DELIVERY" },
  ];

  // 4 existing cards kept untouched
  const existingCards: ExecKPICardProps[] = [
    { title: "Jobs Due", group: "DELIVERY", icon: <CalendarClock className="w-4 h-4" />, kpi: kpis.jobsDuePeriod, index: 4 },
    { title: gmIsForecast ? "Forecast Margin" : "Gross Margin", group: "PROFIT", icon: <BarChart3 className="w-4 h-4" />, kpi: kpis.weightedGrossMargin, index: 5 },
    { title: "GP / Job", group: "PROFIT", icon: <DollarSign className="w-4 h-4" />, kpi: kpis.grossProfitPerJob, index: 6 },
    { title: "Cash Expected", group: "CASHFLOW", icon: <Wallet className="w-4 h-4" />, kpi: kpis.cashExpected, index: 7 },
  ];

  return (
    <div className="mb-4 md:mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2
            className="font-semibold text-foreground font-mono"
            style={{ fontSize: "clamp(14px, 1.8vw, 20px)" }}
          >
            Project Execution
          </h2>
          <p
            className="text-muted-foreground font-mono"
            style={{ fontSize: "clamp(10px, 1vw, 12px)" }}
          >
            Delivery, profitability &amp; cashflow KPIs
          </p>
        </div>

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
      </div>

      <div
        className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 items-stretch"
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

          // Render actual data cards
          switch (i) {
            case 0: return <OnTimeDeliveryCard key={def.title} data={projectKPIData.kpis.onTimeDelivery} index={i} />;
            case 1: return <ScheduleSlippageCard key={def.title} data={projectKPIData.kpis.scheduleSlippage} index={i} />;
            case 2: return <MarginVarianceCard key={def.title} data={projectKPIData.kpis.marginVariance} index={i} />;
            case 3: return <LabourEfficiencyCard key={def.title} data={projectKPIData.kpis.labourEfficiency} index={i} />;
            default: return null;
          }
        })}

        {/* 4 existing cards — untouched */}
        {existingCards.map((card) => (
          <ExecKPICard key={card.title} {...card} />
        ))}
      </div>
    </div>
  );
}
