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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {expenseCategories.map((cat, ci) => (
            <motion.div
              key={cat.category}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 + ci * 0.08 }}
              className={`rounded-lg border p-4 bg-secondary/20 ${categoryColors[cat.category] || "border-border"}`}
            >
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">{cat.category}</p>
              <p className="text-lg font-mono font-bold text-foreground mb-3">${cat.totalMonthly.toLocaleString()}<span className="text-xs text-muted-foreground">/mo</span></p>
              <div className="space-y-1.5">
                {cat.items.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground truncate mr-2">{item.name}</span>
                    <span className="font-mono text-foreground shrink-0">${item.monthlyCost.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default ExpenseBreakdown;
