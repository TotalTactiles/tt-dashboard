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
}

function timeAgo(ts: number | null): string {
  if (!ts) return "never";
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

/** Abbreviate a dollar string for display when it overflows */
function abbreviateValue(raw: string): { display: string; abbreviated: boolean } {
  // Extract numeric value from string like "$1,234,567" or "$45,123.45"
  const numeric = parseFloat(raw.replace(/[^0-9.-]/g, ""));
  if (isNaN(numeric)) return { display: raw, abbreviated: false };
  const abs = Math.abs(numeric);
  const sign = numeric < 0 ? "-" : "";
  if (abs >= 1_000_000) return { display: `${sign}$${(abs / 1_000_000).toFixed(2)}M`, abbreviated: true };
  if (abs >= 1_000) return { display: `${sign}$${(abs / 1_000).toFixed(1)}K`, abbreviated: true };
  return { display: raw, abbreviated: false };
}

const StatCard = ({ label, value, change, positive, index, noData, formulaDriven, altValue, altChange, altPositive, altDiff }: StatCardProps) => {
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

  const { display: abbreviatedDisplay, abbreviated } = abbreviateValue(displayValue);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="stat-card relative min-w-0 overflow-hidden"
      style={{ padding: "clamp(10px, 1.5vw, 20px)" }}
    >
      {formulaDriven && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="absolute top-2 right-2 flex items-center gap-1">
              <span className="text-[9px] font-mono text-chart-green/70 bg-chart-green/10 border border-chart-green/20 rounded px-1 py-0.5 leading-none">
                f(x)
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs font-mono max-w-[250px]">
            <p className="font-semibold">Formula: {formulaDriven.name}</p>
            <p className="text-muted-foreground mt-0.5">Expression: {formulaDriven.expression}</p>
            <p className="text-muted-foreground mt-0.5">Last computed: {timeAgo(formulaDriven.lastComputed)}</p>
          </TooltipContent>
        </Tooltip>
      )}

      <div className="flex items-center justify-between mb-1 gap-1 min-w-0">
        <p className="text-muted-foreground truncate" style={{ fontSize: "clamp(9px, 1vw, 11px)" }}>{label}</p>
        {hasToggle && !noData && (
          <div className="flex rounded-full bg-secondary/80 p-0.5 leading-none shrink-0" style={{ fontSize: "clamp(8px, 0.9vw, 10px)" }}>
            <button
              onClick={() => setShowAlt(false)}
              className={`px-1.5 py-0.5 rounded-full transition-all duration-150 font-mono whitespace-nowrap ${
                !showAlt
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Confirmed
            </button>
            <button
              onClick={() => setShowAlt(true)}
              className={`px-1.5 py-0.5 rounded-full transition-all duration-150 font-mono whitespace-nowrap ${
                showAlt
                  ? pillActiveClass
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              With YLWs
            </button>
          </div>
        )}
      </div>

      <div className="flex items-end justify-between gap-1 min-w-0">
        <div className="flex items-baseline gap-1 min-w-0 overflow-hidden">
          <Tooltip>
            <TooltipTrigger asChild>
              <p
                className={`font-mono font-bold truncate min-w-0 ${noData ? "text-muted-foreground" : `${accentGlow} ${accentColor}`}`}
                style={{ fontSize: "clamp(16px, 2.5vw, 28px)", lineHeight: 1.2 }}
              >
                {abbreviated ? abbreviatedDisplay : displayValue}
              </p>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs font-mono">
              {displayValue}
            </TooltipContent>
          </Tooltip>
          {showAlt && altDiff && !noData && (
            <span className="font-mono text-amber-400/60 shrink-0" style={{ fontSize: "clamp(10px, 1.2vw, 14px)" }}>{altDiff}</span>
          )}
        </div>
        {!noData && displayChange !== "--" && (
          <div className={`flex items-center gap-0.5 font-mono shrink-0 ${accentColor}`} style={{ fontSize: "clamp(9px, 1vw, 12px)" }}>
            {displayPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span className="whitespace-nowrap" style={{ wordBreak: "keep-all" }}>{displayChange}</span>
          </div>
        )}
      </div>
      <div className="mt-3 h-1 bg-secondary rounded-full overflow-hidden">
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
