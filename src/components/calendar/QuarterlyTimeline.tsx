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
      className="stat-card max-h-[380px] overflow-y-auto"
    >
      <h3 className="text-sm font-semibold text-foreground mb-4">Quarterly Roadmap</h3>
      <div className="space-y-5">
        {quarterlyTimeline.map((q) => (
          <div key={q.quarter}>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-[10px] font-mono text-primary uppercase tracking-wider font-semibold">{q.quarter}</p>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="space-y-2 ml-1 pl-3">
              {q.events.map((ev, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  {statusIcons[ev.status]}
                  <span className={`text-xs flex-1 ${ev.status === "done" ? "text-muted-foreground line-through" : "text-foreground/80"}`}>
                    {ev.label}
                  </span>
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
