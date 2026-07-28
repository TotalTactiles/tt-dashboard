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
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!operator) return;
    setLoading(true);
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data } = await db
      .from("leads")
      .select("*")
      .eq("stage", "ready_to_call")
      .order("rating_score", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: true })
      .limit(200);
    const filtered = ((data as Lead[]) ?? []).filter(
      (l) => !l.claimed_by || l.claimed_by === operator || !l.claimed_at || l.claimed_at < cutoff,
    );
    setRows(filtered);
    setLoading(false);
  }, [operator]);

  useEffect(() => { load(); }, [load]);
  return { rows, loading, reload: load };
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

export class DuplicateLeadError extends Error {
  constructor() { super("A live lead with this project name already exists."); }
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
  if (error) {
    const msg = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
    if (msg.includes("leads_project_unique") || (error.code === "23505" && msg.includes("project"))) {
      throw new DuplicateLeadError();
    }
    throw error;
  }
  return data as Lead;
}
