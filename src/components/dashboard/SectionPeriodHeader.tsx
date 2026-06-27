import React from "react";

export interface PeriodPill {
  key: string;
  label: string;
}

interface SectionPeriodHeaderProps {
  title: string;
  pills: PeriodPill[];
  activeKey: string | null;
  onPill: (key: string) => void;
  months: { key: string; label: string }[];
  selectedMonth: string | null;
  onMonth: (key: string | null) => void;
  subtitle: string;
  rightSlot?: React.ReactNode;
}

/**
 * Shared period-scoped section header.
 * Renders: uppercase title + divider + (rightSlot) + pills + By-month dropdown,
 * with a subtitle band underneath. Both "Let's Talk Money" and "Doing The Deed"
 * use this so they cannot drift apart.
 */
export default function SectionPeriodHeader({
  title,
  pills,
  activeKey,
  onPill,
  months,
  selectedMonth,
  onMonth,
  subtitle,
  rightSlot,
}: SectionPeriodHeaderProps) {
  return (
    <>
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
          {title}
        </span>
        <div className="flex-1 h-px bg-border" />
        <div className="flex items-center gap-2 shrink-0">
          {rightSlot}
          <div
            className="flex rounded-full bg-secondary/80 p-0.5 leading-none"
            style={{ fontSize: "clamp(8px, 0.85vw, 10px)" }}
          >
            {pills.map((p) => (
              <button
                key={p.key}
                onClick={() => onPill(p.key)}
                className={`px-2 py-0.5 rounded-full transition-all duration-150 font-mono whitespace-nowrap text-[11px] ${
                  activeKey === p.key && !selectedMonth
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <select
            value={selectedMonth ?? ""}
            onChange={(e) => onMonth(e.target.value || null)}
            className={`text-[11px] font-mono rounded-full px-2 py-0.5 border transition-colors ${
              selectedMonth
                ? "bg-primary/10 border-primary/40 text-foreground"
                : "bg-secondary/60 border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <option value="">By month…</option>
            {months.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="text-xs font-mono text-muted-foreground/70 bg-secondary/40 border border-border/50 rounded px-3 py-1.5 mb-3">
        {subtitle}
      </div>
    </>
  );
}
