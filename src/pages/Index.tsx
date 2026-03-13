import { RefreshCw } from "lucide-react";
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
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Unplug, Loader2 } from "lucide-react";

const DashboardContent = () => {
  const { goals } = useGoals();
  const { formulas } = useFormulas();
  const { kpiStats, hasLiveData, connectedCount, dataHealth, isLoading, lastUpdated, sources, syncNow } = useDashboardData();

  const handleRefresh = () => {
    const gSheets = sources.find((s) => s.id === "google_sheets");
    if (gSheets) syncNow(gSheets.id);
  };

  const formatLastUpdated = (ts: string | null) => {
    if (!ts) return null;
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return ts;
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Business Dashboard</h1>
          <p className="text-sm text-muted-foreground font-mono">FY 2026 Overview — Quotes · Cashflow · Revenue · Expenses</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs font-mono text-muted-foreground">
              Last updated: {formatLastUpdated(lastUpdated)}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading} className="gap-1.5">
            {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Refresh
          </Button>
          <Badge
            variant={hasLiveData ? "default" : "secondary"}
            className={`font-mono text-xs ${hasLiveData ? "bg-chart-green/20 text-chart-green border-chart-green/30" : ""}`}
          >
            {hasLiveData ? (
              <>
                <CheckCircle className="w-3 h-3 mr-1" />
                Live
              </>
            ) : (
              <>
                <Unplug className="w-3 h-3 mr-1" />
                No Data
              </>
            )}
          </Badge>
        </div>
      </div>

      {isLoading && !hasLiveData && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground font-mono">Loading data...</span>
        </div>
      )}

      {!isLoading && !hasLiveData && (() => {
        const gSheets = sources.find((s) => s.id === "google_sheets");
        const hasWebhook = !!(gSheets?.webhookUrl);
        return (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Unplug className="w-12 h-12 text-muted-foreground/40 mb-4" />
            <p className="text-lg text-muted-foreground mb-2">
              {hasWebhook ? "Webhook configured — click Refresh to load data" : "No data source connected"}
            </p>
            <p className="text-sm text-muted-foreground font-mono mb-4">
              {hasWebhook ? "Your n8n webhook URL is saved. Hit Refresh to pull the latest data." : "Add your n8n webhook URL in Settings to get started"}
            </p>
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="w-4 h-4 mr-2" /> {hasWebhook ? "Refresh" : "Retry"}
            </Button>
          </div>
        );
      })()}

      {hasLiveData && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
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
        </>
      )}
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
