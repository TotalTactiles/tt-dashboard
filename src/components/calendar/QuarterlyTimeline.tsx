import { motion } from "framer-motion";
import { quarterlyTimeline } from "@/data/calendarMockData";
import { CheckCircle, Circle, Loader } from "lucide-react";

const statusIcons = {
  done: <CheckCircle className="h-3.5 w-3.5 text-primary" />,
  "in-progress": <Loader className="h-3.5 w-3.5 text-chart-amber animate-spin" />,
  upcoming: <Circle className="h-3.5 w-3.5 text-muted-foreground" />,
};

const QuarterlyTimeline = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="stat-card"
    >
      <h3 className="text-sm font-semibold text-foreground mb-4">Quarterly Roadmap</h3>
      <div className="space-y-5">
        {quarterlyTimeline.map((q) => (
          <div key={q.quarter}>
            <p className="text-[10px] font-mono text-primary uppercase tracking-wider mb-2">{q.quarter}</p>
            <div className="space-y-1.5 ml-1 border-l border-border pl-3">
              {q.events.map((ev, i) => (
                <div key={i} className="flex items-center gap-2">
                  {statusIcons[ev.status]}
                  <span className="text-xs text-foreground/80 flex-1">{ev.label}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">{ev.date}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default QuarterlyTimeline;
