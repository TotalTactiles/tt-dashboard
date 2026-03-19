import { useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface FormulaInfo {
  name: string;
  expression: string;
  lastComputed: number | null;
}

interface StatCardProps {
  label: string;
  value: string;
  change: string;
  positive: boolean;
  index: number;
  noData?: boolean;
  formulaDriven?: FormulaInfo | null;
  altValue?: string;
  altChange?: string;
  altPositive?: boolean;
  altDiff?: string;
  goalAdjusted?: boolean;
  toggleLabelBase?: string;
  toggleLabelAlt?: string;
  momDelta?: string;
  momContext?: string;
}

function timeAgo(ts: number | null): string {
  if (!ts) return "never";
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function abbreviateValue(raw: string): { display: string; abbreviated: boolean } {
  const numeric = parseFloat(raw.replace(/[^0-9.-]/g, ""));
  if (isNaN(numeric)) return { display: raw, abbreviated: false };
  const abs = Math.abs(numeric);
  const sign = numeric < 0 ? "-" : "";
  if (abs >= 1_000_000) return { display: `${sign}$${(abs / 1_000_000).toFixed(2)}M`, abbreviated: true };
  if (abs >= 1_000) return { display: `${sign}$${(abs / 1_000).toFixed(1)}K`, abbreviated: true };
  return { display: raw, abbreviated: false };
}

const StatCard = ({ label, value, change, positive, index, noData, formulaDriven, altValue, altChange, altPositive, altDiff, goalAdjusted, toggleLabelBase, toggleLabelAlt, momDelta, momContext }: StatCardProps) => {
  const [showAlt, setShowAlt] = useState(false);
  const hasToggle = !!altValue;

  const displayValue = showAlt && altValue ? altValue : value;
  const displayChange = showAlt && altChange ? altChange : change;
  const displayPositive = showAlt && altPositive !== undefined ? altPositive : positive;

  const isYellow = hasToggle && showAlt;
  const accentColor = isYellow ? "text-amber-400" : displayPositive ? "text-chart-green" : "text-chart-red";
  const accentGlow = isYellow ? "" : displayPositive ? "glow-green" : "glow-red";
  const barColor = isYellow ? "bg-amber-400" : displayPositive ? "bg-chart-green" : "bg-chart-red";
  const pillActiveClass = isYellow
    ? "bg-amber-400/20 text-amber-400 shadow-sm"
    : "bg-primary text-primary-foreground shadow-sm";

  const { display: abbreviatedDisplay } = abbreviateValue(displayValue);

  // Yellow glow on card container when YLW toggle is active
  const ylwGlowClass = isYellow ? "ring-1 ring-amber-400/40 shadow-[0_0_12px_-3px_hsl(38,92%,55%,0.3)]" : "";

  const isShortValue = abbreviatedDisplay.length <= 6;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className={`stat-card relative overflow-hidden flex flex-col gap-0.5 [container-type:inline-size] ${ylwGlowClass}`}
      style={{ minHeight: "100px" }}
    >
      {/* ROW 1 — Label + badges */}
      <div className="flex items-start justify-between gap-1 min-w-0">
        <div className="min-w-0 flex-1">
          <p
            className="kpi-title font-mono text-muted-foreground font-medium"
            title={label}
          >
            {label}
          </p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0 flex-wrap justify-end" style={{ maxWidth: "50%" }}>
          {goalAdjusted && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-[9px] font-mono text-amber-400/70 bg-amber-400/10 border border-amber-400/20 rounded px-1 py-0.5 leading-none cursor-help whitespace-nowrap">
                  adj.
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs font-mono max-w-[250px]">
                Value includes active goal scenarios. Toggle goals off to see baseline.
              </TooltipContent>
            </Tooltip>
          )}
          {formulaDriven && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-[9px] font-mono text-chart-green/70 bg-chart-green/10 border border-chart-green/20 rounded px-1 py-0.5 leading-none whitespace-nowrap">
                  f(x)
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs font-mono max-w-[250px]">
                <p className="font-semibold">Formula: {formulaDriven.name}</p>
                <p className="text-muted-foreground mt-0.5">Expression: {formulaDriven.expression}</p>
                <p className="text-muted-foreground mt-0.5">Last computed: {timeAgo(formulaDriven.lastComputed)}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Toggle pills — own row below label when present */}
      {hasToggle && !noData && (
        <div className="flex mt-0.5 mb-0.5">
          <div className="flex rounded-full bg-secondary/80 p-0.5 leading-none" style={{ fontSize: "clamp(8px, 0.85vw, 10px)" }}>
            <button
              onClick={() => setShowAlt(false)}
              className={`px-1.5 py-0.5 rounded-full transition-all duration-150 font-mono whitespace-nowrap ${
                !showAlt
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="hidden sm:inline">{toggleLabelBase ?? "Confirmed"}</span>
              <span className="sm:hidden">✓</span>
            </button>
            <button
              onClick={() => setShowAlt(true)}
              className={`px-1.5 py-0.5 rounded-full transition-all duration-150 font-mono whitespace-nowrap ${
                showAlt
                  ? pillActiveClass
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="hidden xl:inline">{toggleLabelAlt ?? "With YLWs"}</span>
              <span className="xl:hidden">{toggleLabelAlt ? toggleLabelAlt.slice(0, 4) : "YLW"}</span>
            </button>
          </div>
        </div>
      )}

      {/* ROW 2 — Main value */}
      <div className="min-w-0 my-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <p
              className={`font-mono font-bold whitespace-nowrap min-w-0 ${noData ? "text-muted-foreground" : `${accentGlow} ${accentColor}`}`}
              style={{ fontSize: "clamp(20px, 3.5vw, 32px)", lineHeight: 1.15 }}
              title={displayValue}
            >
              {abbreviatedDisplay}
            </p>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs font-mono">
            {displayValue}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* ROW 3 — MoM delta */}
      {!noData && momDelta && (
        <p
          className="font-mono text-muted-foreground truncate leading-snug"
          style={{ fontSize: "clamp(9px, 0.9vw, 11px)" }}
          title={momDelta}
        >
          {momDelta}
        </p>
      )}

      {/* ROW 3b — Monthly context */}
      {!noData && momContext && (
        <p
          className="font-mono text-muted-foreground/80 truncate leading-snug"
          style={{ fontSize: "clamp(8px, 0.85vw, 10px)" }}
          title={momContext}
        >
          {momContext}
        </p>
      )}

      {/* ROW 4 — Secondary metric / change + alt diff */}
      <div className="min-w-0 mt-auto pt-1">
        {showAlt && altDiff && !noData && (
          <p className="font-mono text-amber-400/80 truncate" style={{ fontSize: "clamp(9px, 1vw, 11px)" }} title={`${altDiff} with YLWs`}>
            ↑ {altDiff} with YLWs
          </p>
        )}
        {!noData && displayChange !== "--" && (
          <div className={`flex items-center gap-0.5 font-mono ${accentColor}`} style={{ fontSize: "clamp(9px, 1vw, 12px)" }}>
            {displayPositive ? <TrendingUp className="w-3 h-3 shrink-0" /> : <TrendingDown className="w-3 h-3 shrink-0" />}
            <span className="truncate" title={displayChange}>{displayChange}</span>
          </div>
        )}
      </div>

      {/* ROW 5 — Progress bar */}
      <div className="mt-1.5 h-[3px] bg-secondary rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: noData ? "0%" : displayPositive ? "72%" : "45%" }}
          transition={{ duration: 1, delay: 0.5 + index * 0.1 }}
          className={`h-full rounded-full ${barColor}`}
        />
      </div>
    </motion.div>
  );
};

export default StatCard;
