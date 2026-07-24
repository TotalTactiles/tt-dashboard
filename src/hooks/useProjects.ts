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

export function useProjects(statusFilter: "active" | "all" = "active") {
  const [projects, setProjects] = useState<Project[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    let q = db.from("projects").select("*").order("created_at", { ascending: false });
    if (statusFilter === "active") q = q.eq("status", "active");
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
