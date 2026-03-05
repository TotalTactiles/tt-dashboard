import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  change: string;
  positive: boolean;
  index: number;
  noData?: boolean;
}

const StatCard = ({ label, value, change, positive, index, noData }: StatCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="stat-card"
    >
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
