import { useEffect, useState } from "react";
import {
  CalendarDays,
  Building2,
  User,
  Phone,
  MapPin,
  FileText,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import {
  useProjectDetail,
  useIsPmMobile,
  syncEstStartToZoho,
} from "@/hooks/useProjects";
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

// Per-project unsync state kept in-module so it survives header re-mounts while
// the user navigates task drawers etc. Cleared on successful retry.
type UnsyncEntry = { estimatedStart: string; error: string };
const unsyncMap = new Map<string, UnsyncEntry>();

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
  const isMobile = useIsPmMobile();
  const [cascadeOpen, setCascadeOpen] = useState(false);
  // Force re-render when unsync state changes for this project.
  const [, setUnsyncTick] = useState(0);
  const bumpUnsync = () => setUnsyncTick((t) => t + 1);

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

  const isCompleted = project.status === "completed";
  const canEdit = role === "office" && !isCompleted;
  const unsync = unsyncMap.get(project.id) ?? null;

  const pushZoho = async (estimatedStart: string) => {
    const result = await syncEstStartToZoho({
      projectId: project.id,
      zohoDealId: project.zoho_deal_id ?? null,
      estimatedStart,
    });
    if (result.ok) {
      if (unsyncMap.has(project.id)) {
        unsyncMap.delete(project.id);
        bumpUnsync();
      }
      if (project.zoho_deal_id) {
        toast.success("Est. start updated · Zoho synced");
      } else {
        toast.success("Est. start updated");
      }
    } else {
      unsyncMap.set(project.id, {
        estimatedStart,
        error: result.error ?? "unknown",
      });
      bumpUnsync();
      toast.error("Saved — Zoho not updated", {
        style: { background: "#E24B4A", color: "#fff", border: "none" },
        action: {
          label: "Retry",
          onClick: () => {
            pushZoho(estimatedStart);
          },
        },
      });
    }
  };

  const retryZoho = () => {
    const entry = unsyncMap.get(project.id);
    if (!entry) return;
    pushZoho(entry.estimatedStart);
  };

  const estStartCardProps = {
    project,
    canEdit,
    locked: role === "office" && isCompleted,
    unsync,
    onEdit: () => setCascadeOpen(true),
    onLocked: () => toast("Locked — deal completed"),
    onRetry: retryZoho,
  };

  return (
    <div className="border-b" style={{ borderColor: "#1F2224", background: "#0F1113" }}>
      {isMobile ? (
        <>
          {/* Compact identity strip — no ring/title/status, those live in the sticky bar */}
          <div
            className="flex items-center gap-3 overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden"
            style={{
              scrollbarWidth: "none",
              padding: "8px 14px",
              borderBottom: "1px solid #14161A",
            }}
          >
            {agg.template_name && (
              <span
                className="text-[10px] font-mono uppercase tracking-widest"
                style={{ color: "rgba(229,233,234,0.55)" }}
              >
                Template · {agg.template_name}
              </span>
            )}
            {[
              project.client_name,
              project.contact_name,
              project.contact_phone,
              project.site_address,
              project.quote_number,
            ]
              .filter(Boolean)
              .map((v, i) => (
                <span
                  key={i}
                  className="text-[10px] font-mono"
                  style={{ color: "rgba(229,233,234,0.45)" }}
                >
                  {i > 0 || agg.template_name ? "· " : ""}
                  {v}
                </span>
              ))}
          </div>

          {/* Stat card snap row */}
          <div
            className="flex gap-2 overflow-x-auto snap-x snap-mandatory px-[14px] scroll-pl-[14px] py-3 [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: "none" }}
          >
            <EstStartCard mobile {...estStartCardProps} />
            <StatCard mobile label="Open" value={String(open)} sub={`${done}/${total} done`} />
            <StatCard
              mobile
              label="Hours"
              value={agg.billable_hours.toFixed(1)}
              sub={`${agg.total_hours.toFixed(1)} total`}
            />
            {role === "office" && (
              <>
                <StatCard
                  mobile
                  label="Contract"
                  value={
                    financials?.contract_value != null
                      ? formatMetricValue(financials.contract_value, "currency")
                      : "—"
                  }
                  sub={
                    marginPct !== null ? `Margin ${marginPct.toFixed(1)}%` : "no cost data"
                  }
                  accent={marginPct !== null && marginPct < 15 ? "#EF4444" : "#22C55E"}
                />
                <StatCard
                  mobile
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
        </>
      ) : (
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

          <div className="mt-4 grid gap-3 md:grid-cols-3 lg:grid-cols-5">
            <EstStartCard {...estStartCardProps} />
            <StatCard label="Open Tasks" value={String(open)} sub={`${done}/${total} done`} />
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
                    marginPct !== null ? `Margin ${marginPct.toFixed(1)}%` : "no cost data"
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
      )}

      {cascadeOpen && projectId && (
        <DateCascadeModal
          projectId={projectId}
          currentEstStart={project.estimated_start}
          contractValue={financials?.contract_value ?? null}
          onClose={() => setCascadeOpen(false)}
          onApplied={() => {
            setCascadeOpen(false);
            refresh();
            onChanged?.();
            // After cascade applied, read the latest estimated_start from local
            // project row via refresh; we rely on the applied value being what
            // the modal was previewing. Push to Zoho asynchronously.
            // The modal writes projects.estimated_start server-side; we push
            // that same value here.
            (async () => {
              // Small delay to let refresh settle; not strictly needed for the
              // Zoho call itself since we push the value the user just applied.
              // The modal doesn't hand back the new date, so we re-read.
              try {
                const { supabase } = await import("@/integrations/supabase/client");
                const { data } = await (supabase as any)
                  .from("projects")
                  .select("estimated_start")
                  .eq("id", project.id)
                  .maybeSingle();
                const applied = data?.estimated_start as string | null;
                if (applied) pushZoho(applied);
              } catch {
                // ignore — Supabase update itself already succeeded in the modal
              }
            })();
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
  mobile?: boolean;
}

function StatCard({ label, value, sub, icon, action, accent, mobile }: StatProps) {
  if (mobile) {
    return (
      <div
        className="snap-start flex-none min-w-[104px] max-w-[132px] rounded-[10px] border"
        style={{
          borderColor: "rgba(255,255,255,0.06)",
          background: "#0A0A0A",
          padding: "9px 11px",
        }}
      >
        <div className="flex items-center justify-between">
          <span
            className="font-mono uppercase truncate"
            style={{
              fontSize: "9px",
              letterSpacing: "0.9px",
              color: "rgba(229,233,234,0.28)",
            }}
          >
            {label}
          </span>
          {action}
        </div>
        <div
          className="mt-1 font-mono font-semibold tabular-nums"
          style={{
            fontSize: "14px",
            letterSpacing: "-0.3px",
            color: accent ?? "#E6EEF3",
          }}
        >
          {value}
        </div>
        {sub && (
          <div
            className="font-mono truncate"
            style={{ fontSize: "9px", color: "rgba(229,233,234,0.28)" }}
          >
            {sub}
          </div>
        )}
      </div>
    );
  }
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

/**
 * Est. Start stat card. Office role: whole card is a tap target that opens the
 * cascade modal, with ✎ affordance and a hover border. Worker role: display
 * only, no affordance. Renders a persistent ZOHO NOT SYNCED chip when the last
 * Zoho write-back failed.
 */
function EstStartCard({
  project,
  canEdit,
  locked,
  unsync,
  onEdit,
  onLocked,
  onRetry,
  mobile,
}: {
  project: {
    id: string;
    estimated_start: string | null;
    project_start: string | null;
    zoho_deal_id: string | null;
  };
  canEdit: boolean;
  locked?: boolean;
  unsync: UnsyncEntry | null;
  onEdit: () => void;
  onLocked?: () => void;
  onRetry: () => void;
  mobile?: boolean;
}) {
  const value = formatDateShort(project.estimated_start);
  const sub = project.project_start
    ? `Proj ${formatDateShort(project.project_start)}`
    : undefined;

  const label = "Est. Start";
  const interactive = canEdit || locked;
  const editableStyle: React.CSSProperties = canEdit
    ? { cursor: "pointer", transition: "border-color 120ms ease" }
    : locked
      ? { cursor: "not-allowed" }
      : {};

  const handleClick = () => {
    if (canEdit) onEdit();
    else if (locked) onLocked?.();
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (!canEdit) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onEdit();
    }
  };

  const chip = unsync ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onRetry();
      }}
      className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm font-mono uppercase tracking-widest hover:brightness-125"
      style={{
        fontSize: "9px",
        background: "rgba(226,75,74,0.14)",
        color: "#E24B4A",
        letterSpacing: "0.8px",
      }}
      title={unsync.error}
    >
      Zoho not synced · Retry
    </button>
  ) : null;

  if (mobile) {
    return (
      <div
        role={interactive ? "button" : undefined}
        tabIndex={canEdit ? 0 : undefined}
        aria-label={canEdit ? "Edit estimated start" : locked ? "Locked — deal completed" : undefined}
        title={locked ? "Locked — deal completed" : undefined}
        onClick={handleClick}
        onKeyDown={handleKey}
        className={`snap-start flex-none min-w-[104px] max-w-[132px] rounded-[10px] border relative ${
          canEdit ? "hover:border-[#3D89DA]/40 focus:border-[#3D89DA]/40 group" : ""
        }`}
        style={{
          borderColor: "rgba(255,255,255,0.06)",
          background: "#0A0A0A",
          padding: "9px 11px",
          minHeight: 44,
          ...editableStyle,
        }}
      >
        <div className="flex items-center justify-between">
          <span
            className="font-mono uppercase truncate"
            style={{
              fontSize: "9px",
              letterSpacing: "0.9px",
              color: "rgba(229,233,234,0.28)",
            }}
          >
            {label}
          </span>
          {canEdit && (
            <Pencil
              className="h-2.5 w-2.5 opacity-40 group-hover:opacity-80"
              style={{ color: "#3D89DA" }}
            />
          )}
        </div>
        <div
          className="mt-1 font-mono font-semibold tabular-nums"
          style={{ fontSize: "14px", letterSpacing: "-0.3px", color: "#E6EEF3" }}
        >
          {value}
        </div>
        {sub && (
          <div
            className="font-mono truncate"
            style={{ fontSize: "9px", color: "rgba(229,233,234,0.28)" }}
          >
            {sub}
          </div>
        )}
        {chip}
      </div>
    );
  }

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={canEdit ? 0 : undefined}
      aria-label={canEdit ? "Edit estimated start" : locked ? "Locked — deal completed" : undefined}
      title={locked ? "Locked — deal completed" : undefined}
      onClick={handleClick}
      onKeyDown={handleKey}
      className={`rounded-md border px-3 py-2.5 relative ${
        canEdit ? "hover:border-[#3D89DA]/40 focus:border-[#3D89DA]/40 group" : ""
      }`}
      style={{ borderColor: "#1F2224", background: "#0A0A0A", ...editableStyle }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[9.5px] font-mono tracking-widest uppercase text-muted-foreground inline-flex items-center gap-1">
          {label}
        </span>
        {canEdit && (
          <Pencil
            className="h-3 w-3 opacity-40 group-hover:opacity-90 transition-opacity"
            style={{ color: "#3D89DA" }}
          />
        )}
      </div>
      <div
        className="mt-1 text-[18px] font-semibold tabular-nums"
        style={{ fontFamily: "JetBrains Mono, monospace", color: "#E6EEF3" }}
      >
        {value}
      </div>
      {sub && (
        <div className="text-[10px] text-muted-foreground font-mono truncate">{sub}</div>
      )}
      {chip}
    </div>
  );
}
