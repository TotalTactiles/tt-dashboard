import { useState } from "react";
import { CalendarDays, Building2, User, Phone, MapPin, FileText, Pencil } from "lucide-react";
import { useProjectDetail } from "@/hooks/useProjects";
import { useRole } from "@/hooks/useRole";
import { formatDateShort } from "@/lib/projects/dateRules";
import { formatMetricValue } from "@/lib/formatMetricValue";
import { DateCascadeModal } from "./DateCascadeModal";
import { Ring } from "./Ring";

interface Props {
  projectId: string | null;
  onChanged?: () => void;
  /** Client-derived progress percentage — takes precedence over server view. */
  progressPct?: number;
  totalTasks?: number;
  doneTasks?: number;
  openTasks?: number;
}

export function ProjectHeader({
  projectId,
  onChanged,
  progressPct,
  totalTasks,
  doneTasks,
  openTasks,
}: Props) {
  const { role } = useRole();
  const { project, financials, agg, refresh } = useProjectDetail(projectId);
  const [cascadeOpen, setCascadeOpen] = useState(false);

  if (!projectId || !project) {
    return (
      <div
        className="border-b px-6 py-4 text-sm text-muted-foreground"
        style={{ borderColor: "#1F2224" }}
      >
        Select a project.
      </div>
    );
  }

  const marginPct =
    role === "office" && financials?.contract_value && financials.total_costs
      ? ((financials.contract_value - financials.total_costs) / financials.contract_value) * 100
      : null;

  const pct = progressPct ?? agg.progress_pct ?? 0;
  const total = totalTasks ?? agg.total_tasks;
  const done = doneTasks ?? agg.done_tasks;
  const open = openTasks ?? agg.open_tasks;

  return (
    <div className="border-b" style={{ borderColor: "#1F2224", background: "#0F1113" }}>
      <div className="px-3 md:px-6 pt-4 md:pt-5 pb-4">
        <div className="flex items-start gap-3 md:gap-4 mb-1">
          <div className="shrink-0 pt-0.5">
            <Ring pct={pct} size={44} stroke={4} showLabel labelSize={11} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 md:gap-3 flex-wrap">
              <h1
                className="text-[15px] md:text-[20px] font-semibold tracking-tight text-foreground truncate"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                {project.name}
              </h1>
              <span
                className="text-[10px] font-mono tracking-widest uppercase px-2 py-0.5 rounded-sm"
                style={{ background: "#22C55E20", color: "#22C55E" }}
              >
                {project.status.replace("_", " ")}
              </span>
              {agg.template_name && (
                <span
                  className="text-[10px] font-mono tracking-widest uppercase px-2 py-0.5 rounded-sm border"
                  style={{ borderColor: "#1F2224", color: "#B0B8BF" }}
                >
                  Template · {agg.template_name}
                </span>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-[11.5px] text-muted-foreground font-mono">
              {project.client_name && (
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="h-3 w-3" />
                  {project.client_name}
                </span>
              )}
              {project.contact_name && (
                <span className="inline-flex items-center gap-1.5">
                  <User className="h-3 w-3" />
                  {project.contact_name}
                </span>
              )}
              {project.contact_phone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3 w-3" />
                  {project.contact_phone}
                </span>
              )}
              {project.site_address && (
                <span className="inline-flex items-center gap-1.5 max-w-[420px] truncate">
                  <MapPin className="h-3 w-3" />
                  {project.site_address}
                </span>
              )}
              {project.quote_number && (
                <span className="inline-flex items-center gap-1.5">
                  <FileText className="h-3 w-3" />
                  {project.quote_number}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard
            label="Est. Start"
            value={formatDateShort(project.estimated_start)}
            sub={project.project_start ? `Proj ${formatDateShort(project.project_start)}` : undefined}
            action={
              role === "office" ? (
                <button
                  onClick={() => setCascadeOpen(true)}
                  className="text-[10px] font-mono text-primary hover:underline inline-flex items-center gap-1"
                >
                  <Pencil className="h-2.5 w-2.5" /> Shift
                </button>
              ) : null
            }
          />
          <StatCard
            label="Open Tasks"
            value={String(open)}
            sub={`${done}/${total} done`}
          />
          <StatCard
            label="Hours Logged"
            value={agg.billable_hours.toFixed(1)}
            sub={`${agg.total_hours.toFixed(1)} total`}
            icon={<CalendarDays className="h-3 w-3" />}
          />
          {role === "office" && (
            <>
              <StatCard
                label="Contract"
                value={
                  financials?.contract_value != null
                    ? formatMetricValue(financials.contract_value, "currency")
                    : "—"
                }
                sub={
                  marginPct !== null
                    ? `Margin ${marginPct.toFixed(1)}%`
                    : "no cost data"
                }
                accent={marginPct !== null && marginPct < 15 ? "#EF4444" : "#22C55E"}
              />
              <StatCard
                label="Invoiced"
                value={
                  agg.invoiced_total != null
                    ? formatMetricValue(agg.invoiced_total, "currency")
                    : "—"
                }
                sub={
                  financials?.contract_value && agg.invoiced_total != null
                    ? `${Math.round((agg.invoiced_total / financials.contract_value) * 100)}% of contract`
                    : undefined
                }
              />
            </>
          )}
        </div>
      </div>

      {cascadeOpen && projectId && (
        <DateCascadeModal
          projectId={projectId}
          currentEstStart={project.estimated_start}
          onClose={() => setCascadeOpen(false)}
          onApplied={() => {
            setCascadeOpen(false);
            refresh();
            onChanged?.();
          }}
        />
      )}
    </div>
  );
}

interface StatProps {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  accent?: string;
}

function StatCard({ label, value, sub, icon, action, accent }: StatProps) {
  return (
    <div
      className="rounded-md border px-3 py-2.5"
      style={{ borderColor: "#1F2224", background: "#0A0A0A" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[9.5px] font-mono tracking-widest uppercase text-muted-foreground inline-flex items-center gap-1">
          {icon}
          {label}
        </span>
        {action}
      </div>
      <div
        className="mt-1 text-[18px] font-semibold tabular-nums"
        style={{
          fontFamily: "JetBrains Mono, monospace",
          color: accent ?? "#E6EEF3",
        }}
      >
        {value}
      </div>
      {sub && (
        <div className="text-[10px] text-muted-foreground font-mono truncate">{sub}</div>
      )}
    </div>
  );
}
