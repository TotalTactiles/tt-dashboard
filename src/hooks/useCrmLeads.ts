import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export interface Lead {
  id: string;
  company_builder: string;
  project_name: string | null;
  state: string | null;
  site_address: string | null;
  project_contact_name: string | null;
  role: string | null;
  phone: string | null;
  direct_email: string | null;
  reception_name: string | null;
  reception_email: string | null;
  stage: string;
  status_code: string | null;
  next_step_code: string | null;
  source: string | null;
  source_code: string | null;
  notes: string | null;
  rating_score: number | null;
  rating_band: string | null;
  rating_reason: string | null;
  next_best_action: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
  organisation_id: string | null;
  created_at: string;
}

export interface RefRow { code: string; label: string; sort_order: number; is_active: boolean; [k: string]: any; }
export interface RatingBand { code: string; label: string; min_score: number; max_score: number; colour: string | null; sort_order: number; }

export interface NextStepRow extends RefRow {
  follow_up_days: number | null;
  sheet_value: string | null;
  applies_to_stage: string | null;
  moves_to_stage: string | null;
  requires_email: boolean;
  requires_state: boolean;
  is_system: boolean;
}

// -------- reference tables (cached in-module) --------
let refCache: {
  outcomes: RefRow[];
  nextSteps: NextStepRow[];
  statuses: RefRow[];
  sources: RefRow[];
  bands: RatingBand[];
  templates: { next_step_code: string; state: string | null; is_active: boolean }[];
} | null = null;
const refSubs = new Set<(r: typeof refCache) => void>();

async function loadRefs() {
  if (refCache) return refCache;
  const [outcomes, nextSteps, statuses, sources, bands, templates] = await Promise.all([
    db.from("lead_call_outcomes").select("*").eq("is_active", true).order("sort_order"),
    db.from("lead_next_steps").select("*").eq("is_active", true).order("sort_order"),
    db.from("lead_statuses").select("*").eq("is_active", true).order("sort_order"),
    db.from("lead_sources").select("*").eq("is_active", true).order("sort_order"),
    db.from("lead_rating_bands").select("*").eq("is_active", true).order("sort_order"),
    db.from("lead_templates").select("next_step_code,state,is_active").eq("is_active", true),
  ]);
  refCache = {
    outcomes: outcomes.data ?? [],
    nextSteps: nextSteps.data ?? [],
    statuses: statuses.data ?? [],
    sources: sources.data ?? [],
    bands: bands.data ?? [],
    templates: templates.data ?? [],
  };
  refSubs.forEach((fn) => fn(refCache));
  return refCache;
}

export function useCrmRefs() {
  const [refs, setRefs] = useState(refCache);
  useEffect(() => {
    refSubs.add(setRefs);
    loadRefs().then(setRefs);
    return () => { refSubs.delete(setRefs); };
  }, []);
  return refs;
}

export function bandFor(score: number | null | undefined, bands: RatingBand[] | undefined) {
  if (score == null || !bands?.length) return null;
  return bands.find((b) => score >= b.min_score && score <= b.max_score) ?? null;
}

// -------- queue --------
export function useLeadQueue(operator: string | null) {
  const [rows, setRows] = useState<Lead[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!operator) return;
    setLoading(true);
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data, count } = await db
      .from("leads")
      .select("*", { count: "exact" })
      .eq("stage", "ready_to_call")
      .order("rating_score", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: true })
      .range(0, 4999);
    const filtered = ((data as Lead[]) ?? []).filter(
      (l) => !l.claimed_by || l.claimed_by === operator || !l.claimed_at || l.claimed_at < cutoff,
    );
    setRows(filtered);
    setTotalCount(count ?? filtered.length);
    setLoading(false);
  }, [operator]);

  useEffect(() => { load(); }, [load]);
  return { rows, totalCount, loading, reload: load };
}

export async function claimLead(id: string, operator: string) {
  await db.from("leads").update({ claimed_by: operator, claimed_at: new Date().toISOString() }).eq("id", id);
}
export async function releaseClaim(id: string) {
  await db.from("leads").update({ claimed_by: null, claimed_at: null }).eq("id", id);
}

// -------- browse --------
export function useLeadBrowse(filters: {
  search: string; stage: string; status: string; nextStep: string; source: string; state: string; band: string; page: number;
  _tick?: number;
}) {
  const [rows, setRows] = useState<Lead[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      let q = db.from("leads").select("*", { count: "exact" });
      if (filters.stage) q = q.eq("stage", filters.stage);
      if (filters.status) q = q.eq("status_code", filters.status);
      if (filters.nextStep) q = q.eq("next_step_code", filters.nextStep);
      if (filters.source) q = q.eq("source_code", filters.source);
      if (filters.state) q = q.eq("state", filters.state);
      if (filters.band) q = q.eq("rating_band", filters.band);
      if (filters.search.trim()) {
        const s = filters.search.trim().replace(/[%,]/g, "");
        q = q.or(`company_builder.ilike.%${s}%,project_name.ilike.%${s}%,project_contact_name.ilike.%${s}%`);
      }
      const from = filters.page * 50;
      q = q.order("created_at", { ascending: false }).range(from, from + 49);
      const { data, count } = await q;
      if (cancel) return;
      setRows((data as Lead[]) ?? []);
      setCount(count ?? 0);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [filters.search, filters.stage, filters.status, filters.nextStep, filters.source, filters.state, filters.band, filters.page, filters._tick]);

  return { rows, count, loading };
}

// -------- incomplete leads --------
export interface IncompleteRow {
  id: string;
  missing_fields: string[];
}
export function useLeadsIncomplete() {
  const [map, setMap] = useState<Record<string, string[]>>({});
  const reload = useCallback(async () => {
    const { data } = await db.from("v_leads_incomplete").select("id,missing_fields");
    const m: Record<string, string[]> = {};
    (data ?? []).forEach((r: any) => { m[r.id] = r.missing_fields ?? []; });
    setMap(m);
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { map, reload };
}

// -------- deletion --------
export async function deleteLead(id: string, reason: string, operator: string) {
  const { error } = await db.rpc("delete_lead", { p_lead: id, p_reason: reason, p_by: operator });
  if (error) throw error;
}
export async function deleteLeads(ids: string[], reason: string, operator: string) {
  const { error } = await db.rpc("delete_leads", { p_leads: ids, p_reason: reason, p_by: operator });
  if (error) throw error;
}

// -------- add lead --------
export interface SimilarLeadRow {
  id: string;
  project_name: string | null;
  company_builder: string | null;
  stage: string;
  score: number;
  exact_project: boolean;
  same_company: boolean;
}

export async function findSimilarLeads(project: string, company: string | null) {
  const { data, error } = await db.rpc("find_similar_leads", {
    p_project: project,
    p_company: company,
    p_threshold: 0.4,
  });
  if (error) throw error;
  return (data ?? []) as SimilarLeadRow[];
}

export interface OrgSuggestion {
  id: string;
  name: string;
  lead_count: number;
}

export async function searchOrganisations(q: string): Promise<OrgSuggestion[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const { data: orgs } = await db
    .from("organisations")
    .select("id,name")
    .ilike("name", `%${term.replace(/[%,]/g, "")}%`)
    .eq("is_active", true)
    .order("name")
    .limit(8);
  const list = (orgs ?? []) as { id: string; name: string }[];
  if (!list.length) return [];
  const ids = list.map((o) => o.id);
  const { data: leads } = await db.from("leads").select("organisation_id").in("organisation_id", ids);
  const counts: Record<string, number> = {};
  ((leads ?? []) as { organisation_id: string }[]).forEach((l) => {
    if (l.organisation_id) counts[l.organisation_id] = (counts[l.organisation_id] ?? 0) + 1;
  });
  return list.map((o) => ({ id: o.id, name: o.name, lead_count: counts[o.id] ?? 0 }));
}

export async function fetchLeadStates(): Promise<string[]> {
  const { data } = await db.from("leads").select("state").not("state", "is", null).limit(2000);
  const set = new Set<string>();
  ((data ?? []) as { state: string | null }[]).forEach((r) => { if (r.state) set.add(r.state.trim().toUpperCase()); });
  const arr = Array.from(set).filter(Boolean);
  const priority = ["NSW", "QLD"];
  arr.sort((a, b) => {
    const ai = priority.indexOf(a); const bi = priority.indexOf(b);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    return a.localeCompare(b);
  });
  // ensure NSW/QLD present even if not in data
  priority.slice().reverse().forEach((p) => { if (!arr.includes(p)) arr.unshift(p); });
  return arr;
}

export interface NewLeadInput {
  project_name: string;
  company_builder: string;
  organisation_id: string | null;
  state: string;
  project_contact_name?: string | null;
  role?: string | null;
  phone?: string | null;
  direct_email?: string | null;
  reception_name?: string | null;
  reception_email?: string | null;
  site_address?: string | null;
  notes?: string | null;
  source_code?: string | null;
}

export async function createLead(input: NewLeadInput): Promise<Lead> {
  const payload: any = {
    project_name: input.project_name.trim(),
    company_builder: input.company_builder.trim(),
    organisation_id: input.organisation_id,
    state: input.state.trim().toUpperCase() || null,
    project_contact_name: input.project_contact_name?.trim() || null,
    role: input.role?.trim() || null,
    phone: input.phone?.trim() || null,
    direct_email: input.direct_email?.trim() || null,
    reception_name: input.reception_name?.trim() || null,
    reception_email: input.reception_email?.trim() || null,
    site_address: input.site_address?.trim() || null,
    notes: input.notes?.trim() || null,
    source_code: input.source_code || null,
    stage: "new",
    source_system: "dashboard",
    source_row_key: null,
  };
  const { data, error } = await db.from("leads").insert(payload).select("*").single();
  if (error) throw error;
  return data as Lead;
}

// -------- Apollo enrichment --------
export type EnrichMode = "full" | "enrich";

export interface EnrichResponse {
  ok: boolean;
  matched?: boolean;
  draft?: "created" | "failed" | string;
  detail?: string;
  contact?: { name?: string | null; email?: string | null } | null;
  [k: string]: any;
}

const ENRICH_URL = "https://n8n.srv1437130.hstgr.cloud/webhook/tt-lead-enrich";

export async function enrichLead(
  leadId: string,
  operator: string,
  mode: EnrichMode,
): Promise<EnrichResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(ENRICH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead_id: leadId, operator, mode }),
      signal: controller.signal,
    });
    let body: any = null;
    try { body = await res.json(); } catch { body = null; }
    if (body?.blocked === true) {
      return { ...body, detail: body.reason ?? body.detail } as EnrichResponse;
    }
    if (!res.ok) {
      return { ok: false, detail: body?.detail ?? `Apollo request failed (${res.status})` };
    }
    return (body ?? { ok: false, detail: "Empty response from Apollo" }) as EnrichResponse;

  } catch (err: any) {
    if (err?.name === "AbortError") {
      return { ok: false, detail: "Apollo did not respond - the lead is unchanged" };
    }
    return { ok: false, detail: err?.message ?? "Apollo did not respond - the lead is unchanged" };
  } finally {
    clearTimeout(timer);
  }
}


// -------- live-action warning --------
// The one shared live-action warning. Every irreversible control renders THIS constant.
// It is deliberately in one place so that removing every such warning later is one edit.
export const LIVE_ACTION_WARNING =
  "You are working on LIVE business data. This action is permanent and cannot be undone.";

// -------- delete impact --------
export const IMPACT_DESTROYED = "destroyed";
export const IMPACT_BLOCKS = "BLOCKS THE DELETE";
export const IMPACT_REFERENCE_CLEARED = "reference cleared, row kept";

export interface DeleteImpactRow {
  child_table: string;
  rows_affected: number;
  behaviour: string;
}

export async function fetchDeleteImpact(leadId: string): Promise<DeleteImpactRow[]> {
  const { data, error } = await db.rpc("tt_lead_delete_impact", { p_lead: leadId });
  if (error) throw error;
  return (data ?? []) as DeleteImpactRow[];
}

// -------- routed delete --------
const DELETE_URL = "https://n8n.srv1437130.hstgr.cloud/webhook/tt-lead-delete";

export interface DeleteRouteResult {
  ok: boolean;
  blocked?: boolean;
  gate_reason?: string | null;
  held_by?: string | null;
  lead_id?: string;
  company_builder?: string | null;
  project_name?: string | null;
  tombstone_key?: string | null;
  actor_id?: string | null;
  reason?: string | null;
  purged_at?: string | null;
  impact?: DeleteImpactRow[];
  detail?: string;
  [k: string]: any;
}

export async function deleteLeadViaRoute(
  leadId: string,
  operator: string,
  reason: string,
  impactRowCount: number,
): Promise<DeleteRouteResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(DELETE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lead_id: leadId,
        operator,
        reason,
        confirm: true,
        impact_rows: impactRowCount,
      }),
      signal: controller.signal,
    });
    let body: any = null;
    try { body = await res.json(); } catch { body = null; }

    // HTTP 200 IS NOT SUCCESS. The route returns 200 with ok:false when a gate refuses.
    if (body && body.blocked === true) {
      return { ok: false, blocked: true, gate_reason: body.gate_reason ?? null, held_by: body.held_by ?? null,
               detail: body.gate_reason || "The lead is held by another operator or the gate refused." };
    }
    if (!res.ok) {
      return { ok: false, detail: body?.message || body?.detail || ("The delete route returned HTTP " + res.status + ". The lead may be unchanged. Re-open the lead to check.") };
    }
    if (!body || body.ok !== true) {
      return { ok: false, detail: body?.detail || body?.message || "The delete route did not confirm success." };
    }
    return body as DeleteRouteResult;
  } catch (err: any) {
    if (err?.name === "AbortError") {
      return { ok: false, detail: "The delete route did not respond within 60 seconds. Re-open the lead to check whether it was deleted." };
    }
    return { ok: false, detail: err?.message ?? "The delete route could not be reached." };
  } finally {
    clearTimeout(timer);
  }
}
