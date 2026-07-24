import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjects } from "@/hooks/useProjects";
import { Ring } from "./Ring";
import { formatDateShort } from "@/lib/projects/dateRules";

interface Props {
  activeProjectId: string | null;
  onSelect: (id: string) => void;
}

export function ProjectRail({ activeProjectId, onSelect }: Props) {
  const { projects, progress, loading } = useProjects("active");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return projects;
    return projects.filter((p) =>
      [p.name, p.client_name, p.quote_number, p.zoho_deal_id]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle)),
    );
  }, [projects, q]);

  useEffect(() => {
    if (!activeProjectId && filtered.length > 0) onSelect(filtered[0].id);
  }, [activeProjectId, filtered, onSelect]);

  return (
    <aside
      className="w-full md:w-[280px] md:shrink-0 md:border-r flex flex-col min-h-0"
      style={{ borderColor: "#1F2224", background: "#0A0A0A" }}
    >
      <div className="px-3 py-3 border-b" style={{ borderColor: "#1F2224" }}>
        <div className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground mb-2">
          Active Projects · {filtered.length}
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
        {loading && (
          <div className="p-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Loading…
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="p-4 text-xs text-muted-foreground">No projects.</div>
        )}
        {filtered.map((p) => {
          const active = p.id === activeProjectId;
          const pct = progress[p.id] ?? 0;
          const completion = p.project_end ?? p.estimated_start ?? null;
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className={cn(
                "w-full text-left px-3 py-2.5 border-l-2 transition-colors flex items-center gap-3",
                active ? "bg-white/[0.04]" : "hover:bg-white/[0.02]",
              )}
              style={{ borderLeftColor: active ? "#3D89DA" : "transparent" }}
            >
              <Ring pct={pct} size={36} stroke={3} showLabel labelSize={10} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Circle
                    className="h-2 w-2 shrink-0"
                    style={{ color: "#22C55E", fill: "#22C55E" }}
                  />
                  <span className="text-[12.5px] font-semibold text-foreground/90 truncate">
                    {p.name}
                  </span>
                </div>
                <div className="text-[10.5px] text-muted-foreground truncate font-mono mt-0.5">
                  Completion · {completion ? formatDateShort(completion) : "—"}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
