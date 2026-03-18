import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Briefcase,
  AlertTriangle,
  CalendarClock,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Wallet,
  ChevronDown,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import {
  buildPeriodOptions,
  computeExecutionKPIs,
  type PeriodSpec,
  type KPIResult,
} from "@/lib/projectExecutionKpis";

// ── Card sub-component ─────────────────────────────────────────────

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
            className="text-muted-foreground font-mono uppercase tracking-wide truncate"
            style={{ fontSize: "clamp(8px, 0.85vw, 10px)" }}
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
                style={{ fontSize: "clamp(16px, 2.8vw, 26px)", lineHeight: 1.15 }}
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
            style={{ fontSize: "clamp(16px, 2.8vw, 26px)", lineHeight: 1.15 }}
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
            style={{ fontSize: "clamp(9px, 0.9vw, 11px)" }}
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
          className="font-mono text-muted-foreground truncate"
          style={{ fontSize: "clamp(8px, 0.8vw, 10px)" }}
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

// ── Section component ──────────────────────────────────────────────

export default function ProjectExecutionKPIs() {
  const { quotedJobs, revenueProjects, incomeOutgoingsData } = useDashboardData();
  const periodOptions = useMemo(() => buildPeriodOptions(quotedJobs), [quotedJobs]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const period = periodOptions[selectedIdx] ?? null;

  const kpis = useMemo(
    () => period ? computeExecutionKPIs(quotedJobs, revenueProjects, incomeOutgoingsData, period) : null,
    [quotedJobs, revenueProjects, incomeOutgoingsData, period]
  );

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

  const gmIsForecast = (kpis.weightedGrossMargin as any).isForecast === true;

  const cards: ExecKPICardProps[] = [
    {
      title: "Active Jobs",
      group: "DELIVERY",
      icon: <Briefcase className="w-4 h-4" />,
      kpi: kpis.activeJobs,
      index: 0,
    },
    {
      title: "Overdue Jobs",
      group: "DELIVERY",
      icon: <AlertTriangle className="w-4 h-4" />,
      kpi: kpis.overdueJobs,
      index: 1,
    },
    {
      title: "Jobs Due",
      group: "DELIVERY",
      icon: <CalendarClock className="w-4 h-4" />,
      kpi: kpis.jobsDuePeriod,
      index: 2,
    },
    {
      title: gmIsForecast ? "Forecast Margin" : "Gross Margin",
      group: "PROFIT",
      icon: <BarChart3 className="w-4 h-4" />,
      kpi: kpis.weightedGrossMargin,
      index: 3,
    },
    {
      title: "Rev / Job",
      group: "PROFIT",
      icon: <DollarSign className="w-4 h-4" />,
      kpi: kpis.revenuePerJob,
      index: 4,
    },
    {
      title: "GP / Job",
      group: "PROFIT",
      icon: <DollarSign className="w-4 h-4" />,
      kpi: kpis.grossProfitPerJob,
      index: 5,
    },
    {
      title: "Cash Expected",
      group: "CASHFLOW",
      icon: <Wallet className="w-4 h-4" />,
      kpi: kpis.cashExpected,
      index: 6,
    },
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
                onClick={() => setSelectedIdx(i)}
                className={`font-mono text-xs ${i === selectedIdx ? "bg-accent" : ""}`}
              >
                {opt.label} ({opt.mode})
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div
        className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 items-stretch"
        style={{ gap: "clamp(8px, 1vw, 16px)" }}
      >
        {cards.map((card) => (
          <ExecKPICard key={card.title} {...card} />
        ))}
      </div>
    </div>
  );
}
