import { useMemo } from "react";
import { FolderKanban } from "lucide-react";
import { type ZohoProject } from "@/contexts/DashboardDataContext";
import { SOURCE_THEME } from "./eventColors";

export type ProjectsFilterMode = "this-month" | "active-during";

interface UpcomingProjectsPanelProps {
  projects: ZohoProject[];
  emptyMessage?: string;
  mode?: ProjectsFilterMode;
  onModeChange?: (mode: ProjectsFilterMode) => void;
}

function parseDate(raw: unknown): Date | null {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  const d = s.includes("T") ? new Date(s) : new Date(`${s}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

export default function UpcomingProjectsPanel({
  projects,
  emptyMessage = "No upcoming projects",
  mode,
  onModeChange,
}: UpcomingProjectsPanelProps) {
  const showPills = !!mode && !!onModeChange;
  const pill = (m: ProjectsFilterMode, label: string) => {
    const active = mode === m;
    return (
      <button
        key={m}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onModeChange?.(m);
        }}
        className={
          "px-2.5 py-1 rounded-full text-[10px] font-mono font-medium transition-colors " +
          (active
            ? "text-white"
            : "bg-muted/60 text-muted-foreground hover:bg-muted")
        }
        style={
          active
            ? {
                background: SOURCE_THEME.zohoParent.accent,
                color: SOURCE_THEME.zohoParent.accent ? "#fff" : undefined,
              }
            : undefined
        }
      >
        {label}
      </button>
    );
  };
  const sorted = useMemo(() => {
    return [...projects]
      .map((p) => {
        const start = parseDate(p.startDate);
        const end = parseDate(p.endDate);
        const sortDate = start ?? end ?? null;
        return { ...p, start, end, sortDate };
      })
      .sort((a, b) => {
        if (a.sortDate && b.sortDate) return a.sortDate.getTime() - b.sortDate.getTime();
        if (a.sortDate) return -1;
        if (b.sortDate) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [projects]);

  const buildDateLabel = (start: Date | null, end: Date | null) => {
    if (start && end) return `${fmtDate(start)} – ${fmtDate(end)}`;
    if (start) return `Starts ${fmtDate(start)}`;
    if (end) return `Ends ${fmtDate(end)}`;
    return "No date";
  };

  return (
    <div className="flex-1 min-h-0 min-w-0 flex flex-col">
      {showPills && (
        <div className="flex items-center gap-1.5 mb-2 shrink-0">
          {pill("this-month", "This month")}
          {pill("active-during", "Active during")}
        </div>
      )}
      <div
        className="flex-1 min-h-0 space-y-2 overflow-y-auto pr-1"
        style={{ maxHeight: 320, scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.15) transparent" }}
      >
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <FolderKanban className="w-5 h-5 text-muted-foreground/50 mb-2" />
          <p className="text-xs text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : (
        sorted.map((p) => {
          const label = buildDateLabel(p.start, p.end);
          const hasLink = !!p.link && p.link !== "#";
          return (
            <a
              key={p.id}
              href={p.link || "#"}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!hasLink}
              onClick={(e) => {
                if (!hasLink) e.preventDefault();
              }}
              className="group flex items-center gap-3 p-2.5 rounded-[10px] bg-muted/40 hover:bg-secondary/60 transition-all cursor-pointer aria-disabled:cursor-default aria-disabled:hover:bg-muted/40 min-w-0"
              style={{ borderLeft: `3px solid ${SOURCE_THEME.zohoParent.accent}` }}
            >
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors"
                  title={p.name}
                >
                  {p.name}
                </p>
                <p className="text-[11px] font-mono text-muted-foreground mt-1 truncate">{label}</p>
              </div>
              <span
                className="text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap"
                style={{
                  background: SOURCE_THEME.zohoParent.accent + "22",
                  color: SOURCE_THEME.zohoParent.accent,
                }}
              >
                Zoho
              </span>
            </a>
          );
        })
      )}
      </div>
    </div>
  );
}
