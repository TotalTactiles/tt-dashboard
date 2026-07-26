import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";

// Types kept minimal — the generated Database types cover this, but we want to
// keep the office-only filtering in the hook layer per the spec.
export interface Project {
  id: string;
  zoho_deal_id: string;
  name: string;
  client_name: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  site_address: string | null;
  quote_number: string | null;
  description: string | null;
  estimated_start: string | null;
  project_start: string | null;
  project_end: string | null;
  template_id: string | null;
  status: "active" | "awaiting_signoff" | "completed" | "cancelled";
  onedrive_folder_id: string | null;
  completed_at: string | null;
  completion_notes: string | null;
}

export interface ProjectFinancials {
  contract_value: number | null;
  total_costs: number | null;
}

export interface ProjectAggregates {
  progress_pct: number | null;
  total_tasks: number;
  done_tasks: number;
  open_tasks: number;
  billable_hours: number;
  total_hours: number;
  invoiced_total: number | null;
  template_name: string | null;
}

const db = supabase as any;

export type ProjectStatusFilter = "active" | "completed" | "all";

export function useProjects(statusFilter: ProjectStatusFilter = "active") {
  const [projects, setProjects] = useState<Project[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    let q = db.from("projects").select("*").order("created_at", { ascending: false });
    if (statusFilter === "active") {
      q = q.eq("status", "active").is("completed_at", null);
    } else if (statusFilter === "completed") {
      q = q.not("completed_at", "is", null);
    }
    const { data } = await q;
    setProjects((data as Project[]) ?? []);

    const { data: prog } = await db.from("v_project_progress").select("project_id,pct");
    const map: Record<string, number> = {};
    for (const r of (prog as Array<{ project_id: string; pct: number | null }>) ?? []) {
      map[r.project_id] = r.pct ?? 0;
    }
    setProgress(map);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { projects, progress, loading, refresh };
}

export function useProjectDetail(projectId: string | null) {
  const { role } = useRole();
  const [project, setProject] = useState<Project | null>(null);
  const [financials, setFinancials] = useState<ProjectFinancials | null>(null);
  const [agg, setAgg] = useState<ProjectAggregates>({
    progress_pct: null,
    total_tasks: 0,
    done_tasks: 0,
    open_tasks: 0,
    billable_hours: 0,
    total_hours: 0,
    invoiced_total: null,
    template_name: null,
  });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) {
      setProject(null);
      setFinancials(null);
      return;
    }
    setLoading(true);
    const [{ data: p }, { data: prog }, { data: hrs }, { data: tsks }] =
      await Promise.all([
        db.from("projects").select("*").eq("id", projectId).maybeSingle(),
        db.from("v_project_progress").select("*").eq("project_id", projectId).maybeSingle(),
        db.from("v_project_hours").select("*").eq("project_id", projectId).maybeSingle(),
        db.from("tasks").select("id,status,office_only").eq("project_id", projectId),
      ]);

    setProject(p as Project | null);

    let templateName: string | null = null;
    if (p?.template_id) {
      const { data: t } = await db
        .from("project_templates")
        .select("name")
        .eq("id", p.template_id)
        .maybeSingle();
      templateName = t?.name ?? null;
    }

    // Office-only content is filtered HERE, not in JSX.
    let contractValue: number | null = null;
    let invoicedTotal: number | null = null;
    if (role === "office") {
      const { data: fin } = await db
        .from("project_financials")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();
      setFinancials(fin as ProjectFinancials | null);
      contractValue = fin?.contract_value ?? null;

      const { data: invs } = await db
        .from("invoices")
        .select("total")
        .eq("project_id", projectId);
      invoicedTotal = ((invs as Array<{ total: number }>) ?? []).reduce(
        (s, r) => s + Number(r.total ?? 0),
        0,
      );
    } else {
      setFinancials(null);
    }

    const taskList = (tsks as Array<{ status: string; office_only: boolean }>) ?? [];
    const visible = role === "office" ? taskList : taskList.filter((t) => !t.office_only);
    const open = visible.filter((t) => t.status === "open").length;

    setAgg({
      progress_pct: prog?.pct ?? null,
      total_tasks: visible.length,
      done_tasks: visible.filter((t) => t.status === "done").length,
      open_tasks: open,
      billable_hours: Number(hrs?.billable_hours ?? 0),
      total_hours: Number(hrs?.total_hours ?? 0),
      invoiced_total: invoicedTotal,
      template_name: templateName,
    });

    // Attach contract_value into financials shim when role=office
    if (role === "office" && !financials && contractValue !== null) {
      setFinancials({ contract_value: contractValue, total_costs: null });
    }

    setLoading(false);
  }, [projectId, role]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  return { project, financials, agg, loading, refresh: load };
}

export const PM_MOBILE_BREAKPOINT = 900;

export function useIsPmMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && window.innerWidth < PM_MOBILE_BREAKPOINT,
  );
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${PM_MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return isMobile;
}

/**
 * Office-only capability gate for project lifecycle actions (Complete, Split).
 * Workers never see these controls. Kept in the hook layer per the same rule
 * office-only content follows elsewhere (financials, forecast).
 */
export function useCanManageProjectLifecycle() {
  const { role } = useRole();
  return role === "office";
}

/**
 * Push an updated estimated_start back to the Zoho CRM deal's Closing_Date via
 * the n8n bridge. estimated_start is a deliberate exception to "Zoho is source
 * of truth" — after CRM seeds it at project creation, the dashboard is
 * authoritative and pushes on edit. Returns { ok } — never throws.
 */
export async function syncEstStartToZoho(params: {
  projectId: string;
  zohoDealId: string | null;
  estimatedStart: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { projectId, zohoDealId, estimatedStart } = params;
  if (!zohoDealId) return { ok: true }; // nothing to sync — pre-CRM project
  try {
    const res = await fetch(
      "https://n8n.srv1437130.hstgr.cloud/webhook/dashboard-crm-date",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          zoho_deal_id: zohoDealId,
          estimated_start: estimatedStart,
        }),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status} ${body}`.trim() };
    }
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      zoho_code?: string;
      zoho_message?: string;
    };
    if (json.ok === false) {
      return { ok: false, error: json.zoho_message ?? json.zoho_code ?? "zoho_failed" };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "network_error" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Forecast snapshot (BUDGET & FORECAST section)
//
// Read from v_project_forecast, which already resolves original-vs-restated for
// us and carries the pre-split original figures alongside. This data is
// immutable once written by the n8n CRM workflow, so we fetch once and never
// poll. Office-only — workers never see it.
// ─────────────────────────────────────────────────────────────────────────────

export interface ProjectForecast {
  project_id: string;
  zoho_deal_id: string | null;
  effective_type: "original" | "restated";
  effective_captured_at: string | null;
  captured_reason: string | null;
  contract_value: number | null;
  labour_cost: number | null;
  tactile_cost: number | null;
  other_cost: number | null;
  total_cogs: number | null;
  gross_margin: number | null;
  gp_percent: number | null;
  invoice_month: string | null;
  due_month: string | null;
  labour_month: string | null;
  tactile_month: string | null;
  tactile_rem_month: string | null;
  other_month: string | null;
  original_contract_value: number | null;
  original_total_cogs: number | null;
  original_gross_margin: number | null;
  original_captured_at: string | null;
  // Not exposed by v_project_forecast; fetched from project_forecast_snapshots
  // for the same effective row (restated first, else latest original) so the
  // workflow's explanation for a headline-only snapshot surfaces in the UI.
  note: string | null;
}

export function useProjectForecast(projectId: string | null) {
  const { role } = useRole();
  const allowed = role === "office";
  const [forecast, setForecast] = useState<ProjectForecast | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Gate on role in the hook, consistent with useProjectDetail. Workers get
    // an empty result and the component renders nothing.
    if (!allowed || !projectId) {
      setForecast(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await db
        .from("v_project_forecast")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();
      if (cancelled) return;
      if (!data) {
        setForecast(null);
        setLoading(false);
        return;
      }
      // Second read to surface `note` from the effective snapshot. Mirrors the
      // view's ordering: a restated snapshot wins over the original; within
      // a type the newest captured_at wins.
      const { data: snap } = await db
        .from("project_forecast_snapshots")
        .select("note, snapshot_type, captured_at")
        .eq("project_id", projectId)
        .order("captured_at", { ascending: false });
      let note: string | null = null;
      if (Array.isArray(snap) && snap.length) {
        const restated = (snap as any[]).find((s) => s.snapshot_type === "restated");
        const original = (snap as any[]).find((s) => s.snapshot_type === "original");
        note = ((restated ?? original)?.note as string | null) ?? null;
      }
      if (cancelled) return;
      setForecast({ ...(data as any), note } as ProjectForecast);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, allowed]);

  return { forecast, loading, allowed };
}
