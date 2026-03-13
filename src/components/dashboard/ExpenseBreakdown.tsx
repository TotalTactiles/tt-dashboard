import { motion } from "framer-motion";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import NoData from "./NoData";

const categoryColors: Record<string, string> = {
  Essentials: "border-chart-green/30",
  "Office & Misc": "border-chart-blue/30",
  "Shared Expenses": "border-chart-purple/30",
  "Employee Expenses": "border-chart-amber/30",
};

const ExpenseBreakdown = () => {
  const { expenseCategories, dataHealth } = useDashboardData();

  const grandTotalMonthly = expenseCategories.reduce((sum, c) => sum + c.totalMonthly, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.8 }}
      className="chart-container col-span-full"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">Business Expenses</h3>
        {expenseCategories.length > 0 && (
          <span className="text-xs font-mono text-muted-foreground">
            Total: <span className="text-foreground">${grandTotalMonthly.toLocaleString()}/mo</span>
          </span>
        )}
      </div>
      {expenseCategories.length === 0 ? (
        <NoData message="No expense data" healthStatus={dataHealth.expenses.status} />
      ) : (
        <>
          {/* Category Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {expenseCategories.map((cat, ci) => (
              <motion.div
                key={cat.category}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 + ci * 0.08 }}
                className={`rounded-lg border p-4 bg-secondary/20 ${categoryColors[cat.category] || "border-border"}`}
              >
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">{cat.category}</p>
                <p className="text-lg font-mono font-bold text-foreground mb-1">${cat.totalMonthly.toLocaleString()}<span className="text-xs text-muted-foreground">/mo</span></p>
                <p className="text-xs font-mono text-muted-foreground mb-3">${cat.totalYearly.toLocaleString()}/yr</p>
              </motion.div>
            ))}
          </div>

          {/* Expense Line Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground font-mono border-b border-border">
                  <th className="pb-3 pr-4">Name</th>
                  <th className="pb-3 pr-4">Category</th>
                  <th className="pb-3 pr-4 text-right">Weekly</th>
                  <th className="pb-3 pr-4 text-right">Monthly</th>
                  <th className="pb-3 text-right">Yearly</th>
                </tr>
              </thead>
              <tbody>
                {expenseCategories.flatMap((cat) =>
                  cat.items.map((item, i) => (
                    <tr key={`${cat.category}-${i}`} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="py-2 pr-4 font-medium">{item.name}</td>
                      <td className="py-2 pr-4 text-muted-foreground text-xs">{item.category}</td>
                      <td className="py-2 pr-4 text-right font-mono">${item.weeklyCost.toLocaleString()}</td>
                      <td className="py-2 pr-4 text-right font-mono">${item.monthlyCost.toLocaleString()}</td>
                      <td className="py-2 text-right font-mono">${item.yearlyCost.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </motion.div>
  );
};

export default ExpenseBreakdown;
