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
          "font-mono text-[10px] font-semibold px-2.5 py-1 rounded-full transition-colors " +
          (active
            ? "bg-white/10 text-foreground"
            : "border border-border text-muted-foreground hover:text-foreground bg-transparent")
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

  const zoho = SOURCE_THEME.zohoParent.accent;

  return (
    <div className="flex-1 min-h-0 min-w-0 flex flex-col">
      {showPills && (
        <div className="flex items-center gap-1.5 mb-2 shrink-0">
          {pill("active-during", "Currently Active")}
          {pill("this-month", "This month")}
        </div>
      )}
      <div
        className="flex-1 min-h-0 space-y-1 max-h-[320px] overflow-y-auto pr-1"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.15) transparent",
        }}
      >
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <FolderKanban className="w-5 h-5 text-muted-foreground/50 mb-2" />
            <p className="text-[11.5px] text-muted-foreground/70 leading-relaxed">
              {emptyMessage}
            </p>
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
                className="group relative flex items-center gap-2.5 py-2 pl-3 pr-2.5 rounded-xl cursor-pointer transition-colors hover:bg-white/[0.04] aria-disabled:cursor-default min-w-0"
              >
                <span
                  className="absolute left-0 top-2 bottom-2 w-[2.5px] rounded-full"
                  style={{ background: zoho }}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[12.5px] font-medium text-foreground/85 truncate group-hover:text-foreground transition-colors"
                    title={p.name}
                  >
                    {p.name}
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground mt-0.5 truncate">
                    {label}
                  </p>
                </div>
                <span
                  className="font-mono text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap"
                  style={{ background: zoho + "29", color: zoho }}
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
