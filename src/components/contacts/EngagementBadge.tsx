interface Props {
  value: "replied" | "emailed" | "known" | string | null | undefined;
  className?: string;
}

/**
 * Engagement badge — visual anchor of the contacts directory.
 * - replied → solid Havelock Blue (#3D89DA) with white text.
 * - emailed → outline in chart-orange.
 * - known   → muted text, no visible badge.
 */
export default function EngagementBadge({ value, className = "" }: Props) {
  if (value === "replied") {
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider text-white ${className}`}
        style={{ backgroundColor: "#3D89DA" }}
      >
        Replied
      </span>
    );
  }
  if (value === "emailed") {
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-mono font-semibold uppercase tracking-wider ${className}`}
        style={{ borderColor: "hsl(var(--chart-orange))", color: "hsl(var(--chart-orange))" }}
      >
        No reply
      </span>
    );
  }
  return (
    <span className={`text-[10px] font-mono uppercase tracking-wider text-muted-foreground ${className}`}>
      Not contacted
    </span>
  );
}
