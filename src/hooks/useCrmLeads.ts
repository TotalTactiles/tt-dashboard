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
  }, [filters.search, filters.stage, filters.status, filters.nextStep, filters.source, filters.state, filters.band, filters.page]);

  return { rows, count, loading };
}
