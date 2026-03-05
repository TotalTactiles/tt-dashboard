import { Link } from "react-router-dom";
import { Database } from "lucide-react";

interface NoDataProps {
  message?: string;
  className?: string;
}

const NoData = ({ message = "No data connected", className = "" }: NoDataProps) => {
  return (
    <div className={`flex flex-col items-center justify-center py-10 text-center ${className}`}>
      <Database className="w-8 h-8 text-muted-foreground/40 mb-3" />
      <p className="text-sm text-muted-foreground font-mono mb-1">{message}</p>
      <Link
        to="/settings"
        className="text-xs text-primary hover:underline font-mono"
      >
        Connect Google Sheets in Settings →
      </Link>
    </div>
  );
};

export default NoData;
