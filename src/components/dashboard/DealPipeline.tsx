import { motion } from "framer-motion";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import NoData from "./NoData";

const statusStyles: Record<string, string> = {
  won: "bg-chart-green/20 text-chart-green",
  lost: "bg-chart-red/20 text-chart-red",
  pending: "bg-secondary text-muted-foreground",
  yellow: "bg-chart-amber/20 text-chart-amber",
};

const statusLabels: Record<string, string> = {
  won: "Won",
  lost: "Lost",
  pending: "Pending",
  yellow: "90% Likely",
};

const DealPipeline = () => {
  const { quotedJobs, quoteSummary, dataHealth } = useDashboardData();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className="chart-container col-span-full"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">Quoted Jobs</h3>
        {quoteSummary && (
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-muted-foreground">
              Won: <span className="text-chart-green">${quoteSummary.totalWon.toLocaleString()}</span>
            </span>
            <span className="text-muted-foreground">
              Pipeline: <span className="text-chart-amber">${quoteSummary.quotedRemaining.toLocaleString()}</span>
            </span>
          </div>
        )}
      </div>
      {quotedJobs.length === 0 ? (
        <NoData message="No quote data" healthStatus={dataHealth.quotes.status} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground font-mono border-b border-border">
                <th className="pb-3 pr-4">Quote #</th>
                <th className="pb-3 pr-4">Company</th>
                <th className="pb-3 pr-4">Project</th>
                <th className="pb-3 pr-4 text-right">Value</th>
                <th className="pb-3 pr-4 text-center">POs</th>
                <th className="pb-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {quotedJobs.map((job, i) => (
                <motion.tr
                  key={job.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + i * 0.05 }}
                  className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                >
                  <td className="py-3 pr-4 font-mono text-muted-foreground">{job.quoteNumber}</td>
                  <td className="py-3 pr-4 font-medium">{job.company}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{job.project}</td>
                  <td className="py-3 pr-4 text-right font-mono">${job.value.toLocaleString()}</td>
                  <td className="py-3 pr-4 text-center font-mono">{job.totalPOs}</td>
                  <td className="py-3 text-center">
                    <span className={`text-xs px-2 py-1 rounded-full font-mono ${statusStyles[job.status]}`}>
                      {statusLabels[job.status]}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
};

export default DealPipeline;
