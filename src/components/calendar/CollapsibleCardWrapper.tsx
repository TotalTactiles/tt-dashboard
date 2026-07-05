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
        <ChevronRight className="h-3 w-3 text-muted-foreground/60 mb-3 flex-shrink-0" />
        <div
          className="flex-1 flex items-center justify-center"
          style={{
            writingMode: "vertical-rl",
            textOrientation: "mixed",
            transform: "rotate(180deg)",
          }}
        >
          <span className="text-[13px] font-semibold tracking-tight text-foreground whitespace-nowrap">
            {title}
          </span>
          {badge !== undefined && (
            <span className="font-mono text-[10px] ml-2 text-muted-foreground/60">({badge})</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="stat-card flex-1 min-w-0 flex flex-col overflow-hidden">
      <button
        onClick={() => setOpen(false)}
        className="flex items-center gap-2 w-full shrink-0 border-b border-border pb-2.5 mb-2.5"
      >
        <ChevronDown className="h-3 w-3 text-muted-foreground/60 shrink-0" />
        <span className="flex-1 min-w-0 text-left text-[13px] font-semibold tracking-tight text-foreground truncate">
          {title}
        </span>
        {badge !== undefined && (
          <span className="font-mono text-[10px] font-semibold text-muted-foreground bg-white/[0.06] px-2 py-0.5 rounded-full min-w-[22px] text-center shrink-0">
            {badge}
          </span>
        )}
      </button>
      {children}
    </div>
  );
}
