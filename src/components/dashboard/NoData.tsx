import { Link } from "react-router-dom";
import { Database, AlertTriangle, Unplug } from "lucide-react";
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
    label: "Connected — sheet is empty",
    hint: "Add rows to your Google Sheet to see data here",
  },
  "connected-header-mismatch": {
    icon: AlertTriangle,
    label: "Connected — headers not recognised",
    hint: "Check your sheet column headers match the expected format →",
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
  const displayMessage = message || config.label;
  const displayHint = config.hint;

  return (
    <div className={`flex flex-col items-center justify-center py-10 text-center ${className}`}>
      <Icon className="w-8 h-8 text-muted-foreground/40 mb-3" />
      <p className="text-sm text-muted-foreground font-mono mb-1">{displayMessage}</p>
      {displayHint && (
        <Link
          to="/settings"
          className="text-xs text-primary hover:underline font-mono"
        >
          {displayHint}
        </Link>
      )}
    </div>
  );
};

export default NoData;
