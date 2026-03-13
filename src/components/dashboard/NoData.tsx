import { Link } from "react-router-dom";
import { Database, Unplug } from "lucide-react";
import type { DataHealthStatus } from "@/contexts/DashboardDataContext";

interface NoDataProps {
  message?: string;
  className?: string;
  healthStatus?: DataHealthStatus;
}

const statusConfig: Record<DataHealthStatus, { icon: typeof Database; label: string; hint: string }> = {
  disconnected: {
    icon: Unplug,
    label: "No data source connected",
    hint: "Connect Google Sheets in Settings →",
  },
  "connected-empty": {
    icon: Database,
    label: "Connected — no matching rows",
    hint: "Check your sheet data and n8n workflow",
  },
  healthy: {
    icon: Database,
    label: "No data",
    hint: "",
  },
};

const NoData = ({ message, className = "", healthStatus = "disconnected" }: NoDataProps) => {
  const config = statusConfig[healthStatus];
  const Icon = config.icon;

  return (
    <div className={`flex flex-col items-center justify-center py-10 text-center ${className}`}>
      <Icon className="w-8 h-8 text-muted-foreground/40 mb-3" />
      <p className="text-sm text-muted-foreground font-mono mb-1">{message || config.label}</p>
      {config.hint && (
        <Link to="/settings" className="text-xs text-primary hover:underline font-mono">
          {config.hint}
        </Link>
      )}
    </div>
  );
};

export default NoData;
