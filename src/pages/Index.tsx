import StatCard from "@/components/dashboard/StatCard";
import PortfolioChart from "@/components/dashboard/PortfolioChart";
import SectorAllocationChart from "@/components/dashboard/SectorAllocationChart";
import DealPipeline from "@/components/dashboard/DealPipeline";
import CashflowChart from "@/components/dashboard/CashflowChart";
import FundPerformanceChart from "@/components/dashboard/FundPerformanceChart";
import ForecastChart from "@/components/dashboard/ForecastChart";
import RevenueProjectsTable from "@/components/dashboard/RevenueProjectsTable";
import ExpenseBreakdown from "@/components/dashboard/ExpenseBreakdown";
import DashboardLayout from "@/components/DashboardLayout";
import GoalsDashboardWidgets from "@/components/goals/GoalsDashboardWidgets";
import { useGoals } from "@/hooks/useGoals";
import { useFormulas } from "@/hooks/useFormulas";
import { DashboardDataProvider, useDashboardData } from "@/contexts/DashboardDataContext";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, Unplug } from "lucide-react";

const healthIcon = {
  healthy: <CheckCircle className="w-3 h-3 text-chart-green" />,
  "connected-empty": <AlertTriangle className="w-3 h-3 text-amber-400" />,
  "connected-header-mismatch": <AlertTriangle className="w-3 h-3 text-destructive" />,
  disconnected: <Unplug className="w-3 h-3 text-muted-foreground" />,
};

const healthLabel = {
  healthy: "OK",
  "connected-empty": "Empty",
  "connected-header-mismatch": "Headers",
  disconnected: "Off",
};

const DashboardContent = () => {
  const { goals } = useGoals();
  const { formulas } = useFormulas();
  const { kpiStats, hasLiveData, connectedCount, dataHealth } = useDashboardData();

  const sections = [
    { key: "quotes" as const, label: "Quotes" },
    { key: "cashflow" as const, label: "Cashflow" },
    { key: "revenue" as const, label: "Revenue" },
    { key: "expenses" as const, label: "Expenses" },
  ];

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Business Dashboard</h1>
          <p className="text-sm text-muted-foreground font-mono">FY 2025 Overview — Quotes · Cashflow · Revenue · Expenses</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2">
            {sections.map((s) => {
              const h = dataHealth[s.key];
              return (
                <div key={s.key} className="flex items-center gap-1 text-xs font-mono text-muted-foreground" title={`${s.label}: ${h.mappedCount} rows mapped from ${h.rawCount} raw`}>
                  {healthIcon[h.status]}
                  <span>{s.label}</span>
                </div>
              );
            })}
          </div>
          <Badge
            variant={hasLiveData ? "default" : "secondary"}
            className={`font-mono text-xs ${hasLiveData ? "bg-chart-green/20 text-chart-green border-chart-green/30" : ""}`}
          >
            {hasLiveData ? `● Live — ${connectedCount} source${connectedCount !== 1 ? "s" : ""}` : "No Data Source"}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpiStats.map((stat, i) => (
          <StatCard key={stat.label} {...stat} index={i} />
        ))}
      </div>

      <GoalsDashboardWidgets goals={goals} formulas={formulas} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <PortfolioChart />
        <SectorAllocationChart />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <CashflowChart />
        <FundPerformanceChart />
      </div>

      <div className="mb-6">
        <ForecastChart />
      </div>

      <div className="space-y-6">
        <DealPipeline />
        <RevenueProjectsTable />
        <ExpenseBreakdown />
      </div>
    </DashboardLayout>
  );
};

const Index = () => {
  return (
    <DashboardDataProvider>
      <DashboardContent />
    </DashboardDataProvider>
  );
};

export default Index;
