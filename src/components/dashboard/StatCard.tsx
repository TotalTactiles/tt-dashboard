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

const StatCard = ({ label, value, change, positive, index, noData, formulaDriven, altValue, altChange, altPositive, altDiff }: StatCardProps) => {
  const [showAlt, setShowAlt] = useState(false);
  const hasToggle = !!altValue;

  const displayValue = showAlt && altValue ? altValue : value;
  const displayChange = showAlt && altChange ? altChange : change;
  const displayPositive = showAlt && altPositive !== undefined ? altPositive : positive;

  // Yellow theme when "With YLWs" is active
  const isYellow = hasToggle && showAlt;
  const accentColor = isYellow ? "text-amber-400" : displayPositive ? "text-chart-green" : "text-chart-red";
  const accentGlow = isYellow ? "" : displayPositive ? "glow-green" : "glow-red";
  const barColor = isYellow ? "bg-amber-400" : displayPositive ? "bg-chart-green" : "bg-chart-red";
  const pillActiveClass = isYellow
    ? "bg-amber-400/20 text-amber-400 shadow-sm"
    : "bg-primary text-primary-foreground shadow-sm";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="stat-card relative"
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

      <div className="flex items-center justify-between mb-1 gap-1">
        <p className="text-fluid-xs text-muted-foreground truncate">{label}</p>
        {hasToggle && !noData && (
          <div className="flex rounded-full bg-secondary/80 p-0.5 text-[10px] font-mono leading-none">
            <button
              onClick={() => setShowAlt(false)}
              className={`px-2 py-1 rounded-full transition-all duration-150 ${
                !showAlt
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Confirmed
            </button>
            <button
              onClick={() => setShowAlt(true)}
              className={`px-2 py-1 rounded-full transition-all duration-150 ${
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

      <div className="flex items-end justify-between">
        <div className="flex items-baseline gap-2">
          <p className={`text-2xl font-mono font-bold ${noData ? "text-muted-foreground" : `${accentGlow} ${accentColor}`}`}>
            {displayValue}
          </p>
          {showAlt && altDiff && !noData && (
            <span className="text-sm font-mono text-amber-400/60">{altDiff}</span>
          )}
        </div>
        {!noData && displayChange !== "--" && (
          <div className={`flex items-center gap-1 text-xs font-mono ${accentColor}`}>
            {displayPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {displayChange}
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
