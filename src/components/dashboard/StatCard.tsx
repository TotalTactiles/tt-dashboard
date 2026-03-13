import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Calculator } from "lucide-react";
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
}

function timeAgo(ts: number | null): string {
  if (!ts) return "never";
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

const StatCard = ({ label, value, change, positive, index, noData, formulaDriven }: StatCardProps) => {
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
      <p className="text-sm text-muted-foreground mb-1">{label}</p>
      <div className="flex items-end justify-between">
        <p className={`text-2xl font-mono font-bold ${noData ? "text-muted-foreground" : positive ? "glow-green text-chart-green" : "glow-red text-chart-red"}`}>
          {value}
        </p>
        {!noData && change !== "--" && (
          <div className={`flex items-center gap-1 text-xs font-mono ${positive ? "text-chart-green" : "text-chart-red"}`}>
            {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {change}
          </div>
        )}
      </div>
      <div className="mt-3 h-1 bg-secondary rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: noData ? "0%" : positive ? "72%" : "45%" }}
          transition={{ duration: 1, delay: 0.5 + index * 0.1 }}
          className={`h-full rounded-full ${positive ? "bg-chart-green" : "bg-chart-red"}`}
        />
      </div>
    </motion.div>
  );
};

export default StatCard;
