import { motion } from "framer-motion";
import { dealPipeline } from "@/data/mockData";

const stageColors: Record<string, string> = {
  "Screening": "bg-chart-amber/20 text-chart-amber",
  "Due Diligence": "bg-chart-blue/20 text-chart-blue",
  "Term Sheet": "bg-chart-purple/20 text-chart-purple",
  "LOI Signed": "bg-chart-green/20 text-chart-green",
  "Closed": "bg-muted text-muted-foreground",
};

const DealPipeline = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className="chart-container col-span-full"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">Deal Pipeline</h3>
        <div className="flex items-center gap-2">
          <span className="pulse-dot bg-chart-green" />
          <span className="text-xs text-muted-foreground font-mono">Live</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground font-mono border-b border-border">
              <th className="pb-3 pr-4">Company</th>
              <th className="pb-3 pr-4">Sector</th>
              <th className="pb-3 pr-4">Stage</th>
              <th className="pb-3 pr-4 text-right">Enterprise Value</th>
              <th className="pb-3 text-right">Target IRR</th>
            </tr>
          </thead>
          <tbody>
            {dealPipeline.map((deal, i) => (
              <motion.tr
                key={deal.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + i * 0.08 }}
                className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
              >
                <td className="py-3 pr-4 font-medium">{deal.company}</td>
                <td className="py-3 pr-4 text-muted-foreground">{deal.sector}</td>
                <td className="py-3 pr-4">
                  <span className={`text-xs px-2 py-1 rounded-full font-mono ${stageColors[deal.stage] || ""}`}>
                    {deal.stage}
                  </span>
                </td>
                <td className="py-3 pr-4 text-right font-mono">{deal.value}</td>
                <td className="py-3 text-right font-mono text-chart-green">{deal.irr}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

export default DealPipeline;
