import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, Circle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjects } from "@/hooks/useProjects";
import { Ring } from "./Ring";
import { formatDateShort } from "@/lib/projects/dateRules";

interface Props {
  activeProjectId: string | null;
  onSelect: (id: string) => void;
  onOpen?: (id: string) => void;
  fullWidth?: boolean;
  /** Bump to force a re-fetch (e.g. after a project completes). */
  refreshTick?: number;
}

type Tab = "active" | "completed" | "templates";

export function ProjectRail({ activeProjectId, onSelect, onOpen, fullWidth, refreshTick }: Props) {
  const [tab, setTab] = useState<Tab>("active");
  const activeQ = useProjects("active");
  const completedQ = useProjects("completed");
  const current = tab === "completed" ? completedQ : activeQ;
  const projects = tab === "templates" ? [] : current.projects;
  const progress = current.progress;
  const loading = current.loading;
  const [q, setQ] = useState("");

  useEffect(() => {
    if (refreshTick === undefined) return;
    activeQ.refresh();
    completedQ.refresh();
  }, [refreshTick, activeQ.refresh, completedQ.refresh]);

  const filtered = useMemo(() => {
    if (tab === "templates") return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return projects;
    return projects.filter((p) =>
      [p.name, p.client_name, p.quote_number, p.zoho_deal_id]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle)),
    );
  }, [projects, q, tab]);

  useEffect(() => {
    // On mobile (fullWidth) do NOT auto-select — user should see the list first.
    if (fullWidth) return;
    if (tab !== "active") return;
    if (!activeProjectId && filtered.length > 0) onSelect(filtered[0].id);
  }, [activeProjectId, filtered, onSelect, fullWidth, tab]);

  const activeCount = activeQ.projects.length;
  const completedCount = completedQ.projects.length;

  return (
    <aside
      className={cn(
        "flex flex-col min-h-0 border-r",
        fullWidth ? "w-full" : "w-full md:w-[280px] md:shrink-0",
      )}
      style={{ borderColor: "#1F2224", background: "#0A0A0A" }}
    >
      <div className="px-2 pt-2 border-b" style={{ borderColor: "#1F2224" }}>
        <div className="flex items-stretch w-full">
          <RailTab active={tab === "active"} onClick={() => setTab("active")} count={activeCount}>
            Active
          </RailTab>
          <RailTab active={tab === "completed"} onClick={() => setTab("completed")} count={completedCount}>
            Completed
          </RailTab>
          <RailTab active={tab === "templates"} onClick={() => setTab("templates")} soon>
            Templates
          </RailTab>
        </div>
      </div>

      <div className="px-3 py-3 border-b" style={{ borderColor: "#1F2224" }}>
        <div className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground mb-2">
          {tab === "completed" ? "Recently Completed" : tab === "templates" ? "Templates" : "Active Projects"}
          {" · "}
          {filtered.length}
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/70" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search projects…"
            className="w-full h-8 pl-7 pr-2 rounded-md bg-black/40 border text-[12px] font-medium outline-none focus:border-primary/50"
            style={{ borderColor: "#1F2224" }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {tab === "templates" && (
          <div className="p-4 text-xs text-muted-foreground">Templates coming soon.</div>
        )}
        {tab !== "templates" && loading && (
          <div className="p-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Loading…
          </div>
        )}
        {tab !== "templates" && !loading && filtered.length === 0 && (
          <div className="p-4 text-xs text-muted-foreground">
            {tab === "completed" ? "No projects completed in the last 7 days." : "No projects."}
          </div>
        )}
        {tab !== "templates" && filtered.map((p) => {
          const active = p.id === activeProjectId;
          const isCompleted = !!p.completed_at;
          const pct = isCompleted ? 100 : (progress[p.id] ?? 0);
          const hasEnd = !!p.project_end;
          const dateIso = isCompleted
            ? p.completed_at
            : (p.project_end ?? p.estimated_start ?? null);
          const dateLabel = isCompleted ? "Completed" : hasEnd ? "Completion" : "Est. start";
          return (
            <button
              key={p.id}
              onClick={() => { onSelect(p.id); onOpen?.(p.id); }}
              className={cn(
                "w-full text-left px-3 py-2.5 border-l-2 transition-colors flex items-center gap-3",
                active ? "bg-white/[0.04]" : "hover:bg-white/[0.02]",
              )}
              style={{ borderLeftColor: active ? "#3D89DA" : "transparent" }}
            >
              <Ring pct={pct} size={36} stroke={3} showLabel labelSize={10} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {isCompleted ? (
                    <CheckCircle2 className="h-3 w-3 shrink-0" style={{ color: "#22C55E" }} />
                  ) : (
                    <Circle
                      className="h-2 w-2 shrink-0"
                      style={{ color: "#22C55E", fill: "#22C55E" }}
                    />
                  )}
                  <span className="text-[12.5px] font-semibold text-foreground/90 truncate">
                    {p.name}
                  </span>
                  {isCompleted && (
                    <span
                      className="ml-auto text-[8.5px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded-sm shrink-0"
                      style={{ background: "rgba(34,197,94,0.12)", color: "#22C55E" }}
                    >
                      Completed
                    </span>
                  )}
                </div>
                <div className="text-[10.5px] text-muted-foreground truncate font-mono mt-0.5">
                  {dateIso ? `${dateLabel} · ${formatDateShort(dateIso)}` : "No dates set"}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function RailTab({
  active,
  onClick,
  children,
  soon,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  soon?: boolean;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      disabled={soon}
      className={cn(
        "relative flex-1 min-w-0 h-8 inline-flex items-center justify-center gap-1 text-[10px] font-mono uppercase whitespace-nowrap transition-colors",
        active ? "text-foreground" : "text-foreground hover:text-foreground",
      )}
      style={{
        letterSpacing: "0.8px",
        opacity: soon ? 0.28 : active ? 1 : 0.45,
        cursor: soon ? "not-allowed" : "pointer",
      }}
    >
      <span className="truncate">{children}</span>
      {typeof count === "number" && count > 0 && (
        <span className="opacity-70">· {count}</span>
      )}
      {soon && (
        <sup className="text-[7.5px] normal-case tracking-normal opacity-80 ml-0.5">soon</sup>
      )}
      {active && (
        <span
          className="absolute left-2 right-2 -bottom-px h-[2px] rounded-full"
          style={{ background: "#3D89DA" }}
        />
      )}
    </button>
  );
}
