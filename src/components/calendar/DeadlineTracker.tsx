import { motion } from "framer-motion";
import { fundDeadlines, deadlineCategoryLabels } from "@/data/calendarMockData";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Circle, AlertTriangle } from "lucide-react";

const statusConfig = {
  overdue: { icon: AlertTriangle, class: "text-destructive" },
  upcoming: { icon: Circle, class: "text-muted-foreground" },
  completed: { icon: CheckCircle, class: "text-primary" },
};

const DeadlineTracker = () => {
  const sorted = [...fundDeadlines].sort((a, b) => a.daysRemaining - b.daysRemaining);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="stat-card"
    >
      <h3 className="text-sm font-semibold text-foreground mb-4">Fund Deadlines & Obligations</h3>
      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
        {sorted.map((d) => {
          const cfg = statusConfig[d.status];
          const Icon = cfg.icon;
          const isOverdue = d.status === "overdue";
          return (
            <div
              key={d.id}
              className="flex items-center gap-3 p-3 rounded-[10px] bg-muted/50 hover:bg-secondary/60 transition-all duration-150"
              style={isOverdue ? { borderLeft: "3px solid hsl(var(--destructive))" } : {}}
            >
              <Icon className={`h-4 w-4 shrink-0 ${cfg.class}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{d.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-mono text-muted-foreground">{d.fund}</span>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 rounded-full">
                    {deadlineCategoryLabels[d.category]}
                  </Badge>
                </div>
              </div>
              <div className="text-right shrink-0">
                {d.amount && <p className="text-xs font-mono text-foreground">{d.amount}</p>}
                <p className={`text-[10px] font-mono ${d.daysRemaining < 0 ? "text-destructive" : d.daysRemaining <= 7 ? "text-chart-amber" : "text-muted-foreground"}`}>
                  {d.daysRemaining < 0 ? `${Math.abs(d.daysRemaining)}d overdue` : d.daysRemaining === 0 ? "Today" : `${d.daysRemaining}d left`}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default DeadlineTracker;
