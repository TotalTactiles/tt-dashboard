import { motion } from "framer-motion";
import { revenueProjects } from "@/data/mockData";

const statusStyles: Record<string, string> = {
  invoiced: "bg-chart-green/20 text-chart-green",
  pending: "bg-chart-amber/20 text-chart-amber",
  overdue: "bg-chart-red/20 text-chart-red",
};

const RevenueProjectsTable = () => {
  const totalRevenue = revenueProjects.reduce((sum, p) => sum + p.valueExclGST, 0);
  const totalCOGS = revenueProjects.reduce((sum, p) => sum + p.totalCOGS, 0);
  const totalGP = revenueProjects.reduce((sum, p) => sum + p.grossProfit, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.7 }}
      className="chart-container col-span-full"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">Expected Revenue & COGS</h3>
        <div className="flex items-center gap-4 text-xs font-mono">
          <span className="text-muted-foreground">
            Revenue: <span className="text-chart-green">${totalRevenue.toLocaleString()}</span>
          </span>
          <span className="text-muted-foreground">
            COGS: <span className="text-chart-red">${totalCOGS.toLocaleString()}</span>
          </span>
          <span className="text-muted-foreground">
            GP: <span className="text-chart-blue">${totalGP.toLocaleString()}</span>
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground font-mono border-b border-border">
              <th className="pb-3 pr-4">Company</th>
              <th className="pb-3 pr-4">Project</th>
              <th className="pb-3 pr-4 text-right">Value (excl GST)</th>
              <th className="pb-3 pr-4 text-right">Labour</th>
              <th className="pb-3 pr-4 text-right">Tactile</th>
              <th className="pb-3 pr-4 text-right">Other</th>
              <th className="pb-3 pr-4 text-right">Gross Profit</th>
              <th className="pb-3 pr-4">Due</th>
              <th className="pb-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {revenueProjects.map((proj, i) => (
              <motion.tr
                key={proj.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 + i * 0.05 }}
                className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
              >
                <td className="py-3 pr-4 font-medium">{proj.company}</td>
                <td className="py-3 pr-4 text-muted-foreground">{proj.project}</td>
                <td className="py-3 pr-4 text-right font-mono">${proj.valueExclGST.toLocaleString()}</td>
                <td className="py-3 pr-4 text-right font-mono text-chart-red">${proj.labourCost.toLocaleString()}</td>
                <td className="py-3 pr-4 text-right font-mono text-chart-red">${proj.tactileCost.toLocaleString()}</td>
                <td className="py-3 pr-4 text-right font-mono text-chart-red">${proj.otherProducts.toLocaleString()}</td>
                <td className="py-3 pr-4 text-right font-mono text-chart-green">${proj.grossProfit.toLocaleString()}</td>
                <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{proj.dueDate}</td>
                <td className="py-3 text-center">
                  <span className={`text-xs px-2 py-1 rounded-full font-mono capitalize ${statusStyles[proj.status]}`}>
                    {proj.status}
                  </span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

export default RevenueProjectsTable;
