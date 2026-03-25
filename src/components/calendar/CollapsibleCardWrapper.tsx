import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface CollapsibleCardWrapperProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: string | number;
}

export default function CollapsibleCardWrapper({
  title,
  defaultOpen = true,
  children,
  badge,
}: CollapsibleCardWrapperProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (!open) {
    return (
      <div
        className="stat-card flex flex-col items-center justify-start cursor-pointer hover:bg-secondary/40 transition-colors"
        style={{ minWidth: "44px", maxWidth: "52px", padding: "12px 8px" }}
        onClick={() => setOpen(true)}
      >
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground mb-3 flex-shrink-0" />
        <div
          className="flex-1 flex items-center justify-center"
          style={{
            writingMode: "vertical-rl",
            textOrientation: "mixed",
            transform: "rotate(180deg)",
          }}
        >
          <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">{title}</span>
          {badge !== undefined && (
            <span className="text-[10px] font-mono ml-2 text-muted-foreground/60">({badge})</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="stat-card flex-1 min-w-0">
      <button
        onClick={() => setOpen(false)}
        className="flex items-center justify-between w-full mb-4"
      >
        <div className="flex items-center gap-2">
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {badge !== undefined && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {badge}
            </span>
          )}
        </div>
      </button>
      {children}
    </div>
  );
}
