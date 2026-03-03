import StatCard from "@/components/dashboard/StatCard";
import PortfolioChart from "@/components/dashboard/PortfolioChart";
import SectorAllocationChart from "@/components/dashboard/SectorAllocationChart";
import DealPipeline from "@/components/dashboard/DealPipeline";
import CashflowChart from "@/components/dashboard/CashflowChart";
import FundPerformanceChart from "@/components/dashboard/FundPerformanceChart";
import DashboardLayout from "@/components/DashboardLayout";
import GoalsDashboardWidgets from "@/components/goals/GoalsDashboardWidgets";
import { useGoals } from "@/hooks/useGoals";
import { useFormulas } from "@/hooks/useFormulas";
import { kpiStats } from "@/data/mockData";

const Index = () => {
  const { goals } = useGoals();
  const { formulas } = useFormulas();

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Business Dashboard</h1>
        <p className="text-sm text-muted-foreground font-mono">Meridian Capital — FY 2025 Overview</p>
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

      <DealPipeline />
    </DashboardLayout>
  );
};

export default Index;
