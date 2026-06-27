import React from "react";

interface SectionHeaderProps {
  /** Section label text, e.g. "DOING THE DEED" */
  title: string;
  /** Optional right-side controls (sync button, period dropdown, etc.) */
  children?: React.ReactNode;
  className?: string;
}

/**
 * Standard dashboard section header.
 * Visual reference: the existing "Quick Look Sales" header.
 * Uppercase label + thin divider line + optional right-side controls.
 */
export default function SectionHeader({ title, children, className = "" }: SectionHeaderProps) {
  return (
    <div className={`flex items-center gap-2 mb-3 px-1 ${className}`}>
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
        {title}
      </span>
      <div className="flex-1 h-px bg-border" />
      {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
    </div>
  );
}
