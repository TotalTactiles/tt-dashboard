import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Mail, Phone, Sparkles, Loader2, ChevronRight, ChevronDown, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { enrichLead, Lead, useCrmRefs } from "@/hooks/useCrmLeads";
import { useToast } from "@/hooks/use-toast";
import SetNextStepDialog from "./SetNextStepDialog";
import OvenTabs, { type OvenTab } from "./OvenTabs";
import ColdCallView, { useColdCallLeads } from "./ColdCallView";

const db = supabase as any;

const FragmentRow = ({ children }: { children: ReactNode }) => <Fragment>{children}</Fragment>;

export const DASH = "-";

const SKIP_TIMING_STATUSES = ["no_email", "no_org", "all_known", "duplicate"] as const;

const WEBHOOK_BASE = "https://n8n.srv1437130.hstgr.cloud/webhook/";

export interface OvenWebhookResult {
  ok: boolean;
  blocked: boolean;
  reason: string;
  body: any;
}

/** POST { lead_id, operator } to an n8n oven webhook and normalise the reply. */
export async function postOvenWebhook(
  path: string,
  body: { lead_id: string; operator: string; [k: string]: any },
  timeoutMs = 45_000,
): Promise<OvenWebhookResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(WEBHOOK_BASE + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    let json: any = null;
    try { json = await res.json(); } catch { json = null; }
    if (json && json.ok === false && json.blocked === true) {
      return { ok: false, blocked: true, reason: String(json.reason ?? "This action was blocked."), body: json };
    }
    if (!res.ok) {
      return { ok: false, blocked: false, reason: String(json?.reason ?? json?.error ?? `HTTP ${res.status}`), body: json };
    }
    if (json && json.ok === false) {
      return { ok: false, blocked: false, reason: String(json.reason ?? json.error ?? "The workflow reported a failure."), body: json };
    }
    return { ok: true, blocked: false, reason: "", body: json };
  } catch {
    return { ok: false, blocked: false, reason: "The workflow did not respond.", body: null };
  } finally {
    clearTimeout(timer);
  }
}

const PLACEHOLDER_BUILDERS = new Set(["-", "--", "tbc", "t.b.c", "unknown", "reception only", "n/a", "na"]);

export function isPlaceholderBuilder(name: string | null | undefined): boolean {
  const s = (name ?? "").trim().toLowerCase();
  if (!s) return true;
  if (PLACEHOLDER_BUILDERS.has(s)) return true;
  if (s.startsWith("unknown")) return true;
  if (s.includes("reception only")) return true;
  return false;
}

interface CompanyHistory {
  total_leads: number; converted: number; ever_responded: number;
  response_rate_pct: number; conversion_rate_pct: number; last_contacted: string | null;
}

export interface WorkRow {
  project: string | null;
  contact: string | null;
  stage_label: string | null;
  prior_work_state: string | null;
  selectable: boolean;
  closing_date: string | null;
  is_forecast: boolean;
  contract_value: number | null;
}

export interface PrevLeadRow {
  lead_id: string;
  project: string | null;
  stage: string | null;
  emailed_at: string | null;
  responded_at: string | null;
}

export interface BlockESlot {
  project: string | null;
  contact: string | null;
  state: string | null;
  stages: number | null;
}

export interface LeadCardContext {
  lead_count: number;
  replied_count: number;
  emailed_count: number;
  deal_count: number;
  completed_count: number;
  live_count: number;
  closed_lost_count: number;
  response_rate_pct: number | null;
  work: WorkRow[];
  leads: PrevLeadRow[];
  block_e: { state?: string | null; slots?: BlockESlot[] } | null;
}

export interface PriorWorkSlot {
  project: string;
  contact: string;
  state: "completed" | "in_progress";
  stages: number;
}

export interface TimingRow {
  lead_id: string;
  due_date: string | null;
  date_precision: string | null;
  days_away: number | null;
  days_overdue: number | null;
  timing_band: string | null;
  guidance: string | null;
  date_source: string | null;
  source_text?: string | null;
}

/** A row from v_oven_new_leads: lead columns plus timing, prior work and status. */
export interface OvenNewLead extends Lead {
  timing_band: string | null;
  days_overdue: number | null;
  due_date: string | null;
  guidance: string | null;
  date_source: string | null;
  deals_completed: number | null;
  deals_live: number | null;
  deals_lost: number | null;
  prior_leads: number | null;
  prior_emailed: number | null;
  prior_replied: number | null;
  is_placeholder_builder: boolean | null;
  work_status: string | null;
  band_rank: number | null;
  enrichment_status: string | null;
  claim_active: boolean | null;
}


function formatTs(iso?: string | null) {
  if (!iso) return DASH;
  return new Date(iso).toLocaleString("en-AU");
}
function monthYear(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-AU", { month: "short", year: "numeric" });
}
function dayMonthYear(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-AU", { month: "short", day: "numeric", year: "numeric" });
}
export function fmtDay(iso?: string | null) {
  if (!iso) return DASH;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return DASH;
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}
function money(v?: number | null) {
  if (v == null) return DASH;
  return "$" + Math.round(v).toLocaleString("en-AU");
}

const STAGE_BADGE: Record<string, string> = {
  "Completed": "bg-emerald-700/40 text-emerald-300",
  "PO Received (GRN)": "bg-green-500/30 text-green-300",
  "Awarded/Won": "bg-green-500/30 text-green-300",
  "Verbal Confirmation (YLW)": "bg-yellow-400/30 text-yellow-300",
  "Negotiation/Review": "bg-pink-400/20 text-pink-300",
  "Quote Sent": "bg-slate-400/15 text-slate-300",
  "Lost/Dead": "bg-red-500/25 text-red-400",
};

function StageBadge({ label }: { label: string | null }) {
  if (!label) return <span className="text-muted-foreground">{DASH}</span>;
  const cls = STAGE_BADGE[label] ?? "bg-slate-400/15 text-slate-300";
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
}

const BAND_ORDER: Record<string, number> = { past: 0, soon: 1, far: 2, unknown: 3 };

const BAND_STYLE: Record<string, string> = {
  past: "bg-red-500/25 text-red-300",
  soon: "bg-yellow-400/25 text-yellow-200",
  far: "bg-slate-400/15 text-slate-300",
  unknown: "bg-muted text-muted-foreground",
};

function TimingBadge({ t }: { t: TimingRow | undefined }) {
  const band = t?.timing_band ?? "unknown";
  const cls = BAND_STYLE[band] ?? BAND_STYLE.unknown;
  let text = "no date";
  if (band === "past") text = `${t?.days_overdue ?? 0}d overdue`;
  else if (t?.due_date) text = `${band} - ${monthYear(t.due_date)}`;
  else text = band;
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono whitespace-nowrap ${cls}`}>{text}</span>
  );
}

function shortCompany(name: string): string {
  let s = (name || "").trim();
  const original = s;
  s = s.replace(/\s*\(?\b(NSW|QLD|VIC|SA|WA|TAS|NT|ACT|AUSTRALIA)\b\)?\s*$/i, "").trim();
  s = s.replace(/\s*\b(Pty\s+Ltd|Pty\s+Limited|Pty|Ltd|Limited)\b\.?\s*$/i, "").trim();
  const tail = /\s+\b(Constructions|Construction|Group|Projects|Project|Building|Builders|Developments|Development|Contracting|Contractors)\b\.?$/i;
  while (tail.test(s)) s = s.replace(tail, "").trim();
  return s || original;
}

const WORK_STATUS_STYLE: Record<string, string> = {
  "contact ready": "bg-emerald-500/25 text-emerald-300",
  "duplicate": "bg-red-500/25 text-red-300",
  "needs a contact": "bg-yellow-400/25 text-yellow-200",
  "no builder": "bg-yellow-400/25 text-yellow-200",
  "check timing": "bg-yellow-400/25 text-yellow-200",
  "not started": "bg-muted text-muted-foreground",
};

function WorkStatusChip({ status }: { status: string | null }) {
  if (!status) return <span className="text-muted-foreground">{DASH}</span>;
  const cls = WORK_STATUS_STYLE[status] ?? "bg-muted text-muted-foreground";
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono whitespace-nowrap ${cls}`}>{status}</span>
  );
}

function WorkCell({ row }: { row: OvenNewLead }) {
  const done = row.deals_completed ?? 0;
  const live = row.deals_live ?? 0;
  const priors = row.prior_leads ?? 0;
  if (done > 0 || live > 0) {
    return (
      <span className="font-mono text-xs whitespace-nowrap">
        <span className="text-emerald-400">{done}</span>
        <span className="text-emerald-400">{"\u2713"}</span>
        {" "}
        <span className="text-green-300">{live}</span>
        <span className="text-green-300">{"\u25CF"}</span>
      </span>
    );
  }
  if (priors > 0) {
    return <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">{priors} leads</span>;
  }
  return <span className="font-mono text-xs text-muted-foreground/50">-</span>;
}

export function useNewLeads() {
  const [rows, setRows] = useState<OvenNewLead[]>([]);
  const [timing, setTiming] = useState<Record<string, TimingRow>>({});
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await db.from("v_oven_new_leads").select("*").range(0, 4999);
    const list = (data as OvenNewLead[]) ?? [];
    setRows(list);

    const map: Record<string, TimingRow> = {};
    list.forEach((r) => {
      map[r.id] = {
        lead_id: r.id,
        due_date: r.due_date ?? null,
        date_precision: null,
        days_away: null,
        days_overdue: r.days_overdue ?? null,
        timing_band: r.timing_band ?? null,
        guidance: r.guidance ?? null,
        date_source: r.date_source ?? null,
      };
    });
    setTiming(map);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  return { rows, timing, loading, reload: load };

}

/**
 * Context for a builder. `error` is true only when the fetch itself failed,
 * so "no history" and "we could not read the history" stay distinguishable.
 */
export function useLeadCardContext(organisationId: string | null) {
  const [ctx, setCtx] = useState<LeadCardContext | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!organisationId) { setCtx(null); setError(false); setLoading(false); return; }
    let cancel = false;
    setLoading(true);
    db.from("v_lead_card_context")
      .select("*")
      .eq("organisation_id", organisationId)
      .maybeSingle()
      .then((r: any) => {
        if (cancel) return;
        setLoading(false);
        if (r?.error) { setCtx(null); setError(true); return; }
        setError(false);
        if (!r?.data) { setCtx(null); return; }
        const d = r.data;
        setCtx({
          ...d,
          work: Array.isArray(d.work) ? d.work : [],
          leads: Array.isArray(d.leads) ? d.leads : [],
          block_e: d.block_e ?? null,
        } as LeadCardContext);
      });
    return () => { cancel = true; };
  }, [organisationId]);

  return { ctx, error, loading };
}

// ---------------- Block E composer ----------------

interface SlotState {
  project: string;
  projectMode: "select" | "custom";
  contact: string;
  contactMode: "select" | "custom";
  state: "completed" | "in_progress";
  stages: number;
}

const EMPTY_SLOT: SlotState = { project: "", projectMode: "select", contact: "", contactMode: "select", state: "completed", stages: 1 };

function slotFromBlockE(s: BlockESlot | undefined): SlotState {
  if (!s) return { ...EMPTY_SLOT };
  const st = (s.state === "in_progress" || s.state === "currently working" || s.state === "live") ? "in_progress" : "completed";
  return {
    project: s.project ?? "",
    projectMode: "select",
    contact: s.contact ?? "",
    contactMode: "select",
    state: st,
    stages: s.stages ?? 1,
  };
}

function phraseFor(s: SlotState) {
  return s.stages > 2 ? `${s.project} across multiple stages` : s.project;
}

function buildPreview(slots: SlotState[], company: string): string | null {
  const filled = slots.filter((s) => s.project.trim());
  if (!filled.length) return null;

  const live = filled.filter((s) => s.state === "in_progress");
  const done = filled.filter((s) => s.state === "completed");

  let liveClause = "";
  if (live.length === 1) {
    const s = live[0];
    liveClause = s.contact.trim()
      ? `We're currently working with ${s.contact} on ${phraseFor(s)}`
      : `We're currently working on ${phraseFor(s)}`;
  } else if (live.length >= 2) {
    const [a, b] = live;
    liveClause = a.contact.trim() && a.contact === b.contact
      ? `We're currently working with ${a.contact} on ${phraseFor(a)} and ${phraseFor(b)}`
      : `We're currently working with ${a.contact || "the team"} on ${phraseFor(a)} and ${b.contact || "the team"} on ${phraseFor(b)}`;
  }

  let doneClause = "";
  if (done.length === 1) {
    const s = done[0];
    doneClause = s.contact.trim()
      ? `recently completed ${phraseFor(s)} with ${s.contact}`
      : `recently completed ${phraseFor(s)}`;
  } else if (done.length >= 2) {
    const [a, b] = done;
    doneClause = a.contact.trim() && a.contact === b.contact
      ? `recently completed ${phraseFor(a)} and ${phraseFor(b)} with ${a.contact}`
      : `recently completed ${phraseFor(a)} with ${a.contact || "the team"} and ${phraseFor(b)} with ${b.contact || "the team"}`;
  }

  if (!liveClause && doneClause) doneClause = "We " + doneClause;

  const joined = [liveClause, doneClause].filter(Boolean).join(", and ") + ".";
  const tail = ` I'd hope we can continue working with the ${shortCompany(company)} team on another project here too.`;
  return joined + tail;
}

const SELECT_CLS =
  "bg-transparent border border-border rounded px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary";

function SlotRow({
  label, slot, onChange, work,
}: {
  label: string;
  slot: SlotState;
  onChange: (s: SlotState) => void;
  work: WorkRow[];
}) {
  const projectOptions = work.filter((w) => w.selectable && w.project);
  const contacts = Array.from(new Set(work.map((w) => w.contact).filter((c): c is string => !!c)));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10.5px] font-mono uppercase tracking-[0.13em] text-muted-foreground w-14 shrink-0">{label}</span>

      {slot.projectMode === "custom" ? (
        <input
          className={SELECT_CLS + " min-w-[160px]"}
          placeholder="Project name"
          value={slot.project}
          onChange={(e) => onChange({ ...slot, project: e.target.value, stages: 1 })}
        />
      ) : (
        <select
          className={SELECT_CLS + " min-w-[160px]"}
          value={slot.project}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "__custom__") { onChange({ ...slot, projectMode: "custom", project: "", stages: 1 }); return; }
            const hit = projectOptions.find((w) => w.project === v);
            onChange({
              ...slot,
              project: v,
              state: hit?.prior_work_state === "in_progress" ? "in_progress" : hit?.prior_work_state === "completed" ? "completed" : slot.state,
              contact: hit?.contact ?? slot.contact,
            });
          }}
        >
          <option value="">- none -</option>
          {projectOptions.map((w, i) => (
            <option key={i} value={w.project ?? ""}>
              {w.project}{w.closing_date ? ` - ${w.is_forecast ? "due " : ""}${monthYear(w.closing_date)}` : ""}
            </option>
          ))}
          <option value="__custom__">Custom project...</option>
        </select>
      )}

      {slot.contactMode === "custom" ? (
        <input
          className={SELECT_CLS + " min-w-[130px]"}
          placeholder="Contact name"
          value={slot.contact}
          onChange={(e) => onChange({ ...slot, contact: e.target.value })}
        />
      ) : (
        <select
          className={SELECT_CLS + " min-w-[130px]"}
          value={slot.contact}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "__custom__") { onChange({ ...slot, contactMode: "custom", contact: "" }); return; }
            onChange({ ...slot, contact: v });
          }}
        >
          <option value="">- no name -</option>
          {contacts.map((c) => <option key={c} value={c}>{c}</option>)}
          <option value="__custom__">Custom name...</option>
        </select>
      )}

      <select
        className={SELECT_CLS}
        value={slot.state}
        onChange={(e) => onChange({ ...slot, state: e.target.value as SlotState["state"] })}
      >
        <option value="completed">completed</option>
        <option value="in_progress">currently working</option>
      </select>
    </div>
  );
}

// ---------------- Manual contact entry ----------------

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const MANUAL_INPUT_CLS =
  "w-full bg-transparent border rounded px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary";


// ---------------- shell: the two Oven sub-tabs ----------------

export default function NewLeadsView({ operator }: { operator: string }) {
  const [tab, setTab] = useState<OvenTab>("new");
  const newLeads = useNewLeads();
  const cold = useColdCallLeads();

  return (
    <div className="space-y-4">
      <OvenTabs value={tab} onChange={setTab} newCount={newLeads.rows.length} coldCount={cold.rows.length} />
      {tab === "new" ? (
        <NewLeadsQueue operator={operator} {...newLeads} />
      ) : (
        <ColdCallView
          operator={operator}
          rows={cold.rows}
          calls={cold.calls}
          loading={cold.loading}
          reload={cold.reload}
        />
      )}
    </div>
  );
}

// ---------------- New Leads queue: one lead at a time ----------------

function NewLeadsQueue({
  operator, rows, timing, loading, reload,
}: {
  operator: string;
  rows: OvenNewLead[];
  timing: Record<string, TimingRow>;
  loading: boolean;
  reload: () => Promise<void> | void;
}) {
  // Leads dealt with in this session. The order is the point, so there is no
  // jumping around it. Skipped leads come back on the next load.
  const [actioned, setActioned] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);

  const seen = useMemo(() => new Set([...actioned, ...skipped]), [actioned, skipped]);

  const sorted = useMemo(() => {
    return rows.slice().sort((a, b) => {
      const ba = a.band_rank ?? 99;
      const bb = b.band_rank ?? 99;
      if (ba !== bb) return ba - bb;
      const oa = a.days_overdue;
      const ob = b.days_overdue;
      if (oa == null && ob != null) return 1;
      if (ob == null && oa != null) return -1;
      if (oa != null && ob != null && oa !== ob) return ob - oa;
      return (a.company_builder ?? "").localeCompare(b.company_builder ?? "");
    });
  }, [rows]);

  const current = useMemo(() => sorted.find((l) => !seen.has(l.id)) ?? null, [sorted, seen]);
  const upcoming = useMemo(() => {
    if (!current) return [];
    const i = sorted.findIndex((l) => l.id === current.id);
    return sorted.slice(i + 1).filter((l) => !seen.has(l.id));
  }, [sorted, current, seen]);

  const displayUpcoming = showAll ? upcoming : upcoming.slice(0, 30);

  const done = actioned.length;
  const total = sorted.length;

  const placeholder = current ? isPlaceholderBuilder(current.company_builder) : false;

  return (
    <div className="space-y-3">
      <div className="text-xs font-mono text-muted-foreground tabular-nums">
        Working as <span className="text-foreground font-semibold">{operator}</span> - {done} of {total} worked
      </div>

      {loading && !sorted.length && (
        <div className="rounded-md border border-border bg-card px-3 py-8 text-center text-sm text-muted-foreground">
          Loading new leads...
        </div>
      )}

      {!loading && !current && (
        <div className="rounded-md border border-border bg-card px-3 py-8 text-center text-sm text-muted-foreground">
          {total === 0 ? "All scraped leads have been actioned." : "Every new lead has been worked or skipped this session."}
        </div>
      )}

      {current && (
        <div className="rounded-md border border-border bg-card px-3 py-3 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold leading-tight">
                <Link to={`/crm/lead/${current.id}`} className="hover:underline">
                  {placeholder
                    ? <span style={{ color: "#e5934b" }}>{current.company_builder || "no builder"}</span>
                    : current.company_builder}
                </Link>
              </div>
              <div className="text-sm text-muted-foreground">{current.project_name || DASH}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground">
                {current.state || DASH}
              </span>
              <WorkStatusChip status={current.work_status} />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSkipped((s) => (s.includes(current.id) ? s : [...s, current.id]))}
              >
                Skip for now
              </Button>
            </div>
          </div>

          <LeadPanel
            key={current.id}
            lead={current}
            timing={timing[current.id]}
            operator={operator}
            reload={async () => {
              setActioned((a) => (a.includes(current.id) ? a : [...a, current.id]));
              await reload();
            }}
            refresh={async () => { await reload(); }}
          />
        </div>
      )}

      {/* Read only. The order is deliberate, so clicking a row does nothing. */}
      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="px-3 py-2 border-b border-border font-mono uppercase text-[10.5px] tracking-[0.13em] text-muted-foreground">
          Coming up
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-right px-3 py-2 w-10">#</th>
                <th className="text-left px-2 py-2">Builder</th>
                <th className="text-left px-2 py-2">Project</th>
                <th className="text-left px-2 py-2">Work</th>
                <th className="text-left px-2 py-2">Timing</th>
                <th className="text-left px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {displayUpcoming.length === 0 && (
                <tr><td colSpan={6} className="text-center py-6 text-muted-foreground text-sm">Nothing else queued.</td></tr>
              )}
              {displayUpcoming.map((l, i) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">{i + 2}</td>
                  <td className="px-2 py-2">{l.company_builder || DASH}</td>
                  <td className="px-2 py-2 text-muted-foreground">{l.project_name || DASH}</td>
                  <td className="px-2 py-2 text-xs"><WorkCell row={l} /></td>
                  <td className="px-2 py-2"><TimingBadge t={timing[l.id]} /></td>
                  <td className="px-3 py-2"><WorkStatusChip status={l.work_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {upcoming.length > 30 && (
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-muted-foreground">
          <span>Showing {displayUpcoming.length} of {upcoming.length} still to work.</span>
          <Button size="sm" variant="outline" onClick={() => setShowAll(!showAll)}>
            {showAll ? "Show 30" : "Show all"}
          </Button>
        </div>
      )}
    </div>
  );
}


// ---------------- expansion: one step on screen at a time ----------------

/** Progress bar only. Deliberately not clickable, so a step cannot be jumped. */
function Stepper({ current }: { current: "builder" | "timing" | "contact" | "send" }) {
  const steps: { key: "builder" | "timing" | "contact" | "send"; label: string }[] = [
    { key: "builder", label: "Builder" },
    { key: "timing", label: "Timing" },
    { key: "contact", label: "Contact" },
    { key: "send", label: "Send" },
  ];
  const currentIdx = steps.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center gap-2 font-mono uppercase text-[10.5px] tracking-[0.13em]">
      {steps.map((s, i) => {
        const state = i < currentIdx ? "done" : i === currentIdx ? "active" : "future";
        const style =
          state === "done"
            ? { color: "#3fb950", borderBottom: "2px solid #3fb950" }
            : state === "active"
              ? { color: "#3D89DA", fontWeight: 600, borderBottom: "2px solid #3D89DA" }
              : { color: "#6e7681", borderBottom: "2px solid #1d242e" };
        return (
          <Fragment key={s.key}>
            {i > 0 && <span className="text-muted-foreground/40">/</span>}
            <span style={{ ...style, paddingBottom: "2px" }}>{s.label}</span>
          </Fragment>
        );
      })}
    </div>
  );
}

type Rung = 1 | 2 | 3;

/** Three pips: passed, current and future rungs of the escalating ladder. */
function RungPips({ rung }: { rung: Rung }) {
  return (
    <div style={{ display: "flex", gap: "4px", marginTop: "4px", marginBottom: "9px" }}>
      {[1, 2, 3].map((p) => (
        <span
          key={p}
          style={{
            flex: 1,
            height: "3px",
            borderRadius: "2px",
            background: p < rung ? "#2b4a6b" : p === rung ? "#3D89DA" : "#26303d",
          }}
        />
      ))}
    </div>
  );
}

function LadderNotice({
  tone, title, detail,
}: {
  tone: "amber" | "red";
  title: string;
  detail: string;
}) {
  const s = tone === "amber"
    ? { background: "#2a2112", border: "1px solid #4a3a14", color: "#e3b341", icon: "!" }
    : { background: "#2a1616", border: "1px solid #4a2020", color: "#f0837f", icon: "x" };
  return (
    <div style={{ background: s.background, border: s.border, color: s.color, borderRadius: "7px", padding: "11px 13px", display: "flex", gap: "10px" }}>
      <span className="font-mono font-bold" style={{ lineHeight: 1.4 }}>{s.icon}</span>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        {detail && <div style={{ color: "#8b949e", fontSize: "11.5px", marginTop: "3px" }}>{detail}</div>}
      </div>
    </div>
  );
}

// ---------------- Part 2: held contacts, hand-found address ----------------

interface HeldContact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  email: string | null;
}

/** Lists the addresses already held for this company, with a Use button each. */
function KnownAtCompany({
  organisationId, rows, disabled, onUse,
}: {
  organisationId: string | null;
  /** Fetched once by LeadPanel, so this table is never queried twice. */
  rows: HeldContact[] | null;
  disabled: boolean;
  onUse: (c: HeldContact) => void;
}) {
  const muted = { padding: "10px 12px", fontSize: "11.5px", color: "#6e7681" };


  return (
    <div style={{ border: "1px solid #26303d", borderRadius: "7px", overflow: "hidden" }}>
      <div
        className="font-mono uppercase"
        style={{ background: "#11161d", padding: "7px 12px", fontSize: "10px", letterSpacing: ".07em", color: "#6e7681" }}
      >
        Known at this company
      </div>
      {!organisationId ? (
        <div className="font-mono" style={muted}>No organisation linked to this lead yet.</div>
      ) : rows === null ? (
        <div className="font-mono" style={muted}>Loading...</div>
      ) : rows.length === 0 ? (
        <div className="font-mono" style={muted}>Nothing held for this company yet.</div>
      ) : (
        rows.map((c, i) => {
          const name = [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || "Unnamed";
          const sub = [c.role, c.email].filter(Boolean).join(" \u00b7 ");
          return (
            <div
              key={c.id}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px",
                padding: "9px 12px", borderTop: i === 0 ? undefined : "1px solid #1d242e",
              }}
            >
              <div>
                <div style={{ fontSize: "13px" }}>{name}</div>
                <div className="font-mono" style={{ fontSize: "11.5px", color: "#6e7681" }}>{sub}</div>
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onUse(c)}
                style={{
                  fontSize: "11.5px", padding: "5px 11px", borderRadius: "6px",
                  background: "transparent", border: "1px solid #3D89DA", color: "#3D89DA",
                  opacity: disabled ? 0.6 : 1,
                }}
              >
                Use
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}

const FREE_MAIL_ROOTS = [
  "gmail", "googlemail", "hotmail", "outlook", "yahoo", "icloud", "me", "mac", "live",
  "aol", "msn", "protonmail", "proton", "gmx", "bigpond", "optusnet", "iinet", "tpg",
  "internode", "westnet", "dodo", "ozemail",
];

/** The part of a domain before the first dot, so .com and .com.au compare equal. */
function domainRoot(domain: string): string {
  return (domain || "").trim().toLowerCase().replace(/^www\./, "").split(".")[0] ?? "";
}

function emailDomain(email: string): string {
  const at = email.indexOf("@");
  return at < 0 ? "" : email.slice(at + 1).trim().toLowerCase();
}

function isFreeMail(domain: string): boolean {
  return FREE_MAIL_ROOTS.includes(domainRoot(domain));
}

/** Collapsed by default, on every rung: an address the operator found by hand. */
function FoundOnePanel({
  orgDomain, company, busy, onSave,
}: {
  orgDomain: string | null;
  company: string;
  busy: boolean;
  onSave: (v: { name: string; email: string; role: string }) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");

  const trimmed = email.trim().toLowerCase();
  const dom = emailDomain(trimmed);
  const shaped = EMAIL_RE.test(trimmed);

  const check = useMemo(() => {
    if (!shaped) return { ok: false, tone: "muted" as const, message: "" };
    if (isFreeMail(dom)) return { ok: false, tone: "amber" as const, message: "Personal mailbox - not a company address." };
    if (!orgDomain) return { ok: true, tone: "amber" as const, message: "No company domain on file - this address cannot be checked." };
    if (domainRoot(dom) === domainRoot(orgDomain)) return { ok: true, tone: "green" as const, message: `OK - domain matches ${dom}.` };
    return { ok: false, tone: "amber" as const, message: `${dom} does not belong to ${orgDomain}.` };
  }, [shaped, dom, orgDomain]);

  const canSend = check.ok && name.trim().length >= 2 && !busy;

  return (
    <div style={{ borderTop: "1px dashed #26303d", paddingTop: "10px" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "12.5px", color: "#8b949e" }}
      >
        <span style={{ color: "#3D89DA", fontWeight: 700 }}>{open ? "-" : "+"}</span>
        I found one
      </button>

      {open && (
        <div style={{ border: "1px solid #2b6cb0", background: "#111c28", borderRadius: "7px", padding: "13px", marginTop: "9px" }}>
          <div className="font-mono" style={{ fontSize: "11px", color: "#8b949e", marginBottom: "6px" }}>
            Address found by hand
          </div>
          <input
            className={MANUAL_INPUT_CLS + " border-border"}
            placeholder="name@company.com.au"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2" style={{ marginTop: "8px" }}>
            <input
              className={MANUAL_INPUT_CLS + " border-border"}
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className={MANUAL_INPUT_CLS + " border-border"}
              placeholder="Role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            />
          </div>

          {check.message && (
            <div
              className="font-mono"
              style={{ fontSize: "11.5px", marginTop: "8px", color: check.tone === "green" ? "#3fb950" : "#e3b341" }}
            >
              {check.message}
            </div>
          )}

          <div style={{ marginTop: "10px" }}>
            <button
              type="button"
              disabled={!canSend}
              onClick={() => onSave({ name, email: trimmed, role })}
              style={{
                width: "100%", padding: "10px", borderRadius: "7px", fontWeight: 600,
                background: canSend ? "#3D89DA" : "#1c2430",
                color: canSend ? "#fff" : "#6e7681",
                border: canSend ? "none" : "1px solid #26303d",
              }}
            >
              Use this address
            </button>
            <div className="font-mono" style={{ fontSize: "11px", color: "#6e7681", marginTop: "6px" }}>
              {check.ok
                ? (name.trim().length >= 2
                  ? "Saves the contact and unlocks Send EOI on the next step"
                  : "Add a name for the greeting")
                : `Blocked until the address belongs to ${orgDomain || "this company"}`}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}



function PanelHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline gap-2 mb-2">
      <span className="text-sm font-semibold">{title}</span>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

function LeadPanel({
  lead, timing, operator, reload, refresh,
}: {
  lead: Lead & Partial<OvenNewLead>;
  timing: TimingRow | undefined;
  operator: string;
  /** The lead left New Leads. Advance the queue. */
  reload: () => Promise<void> | void;
  /** A marker was recorded. Reload data but keep this lead on screen. */
  refresh?: () => Promise<void> | void;
}) {
  const { ctx, error: ctxError } = useLeadCardContext(lead.organisation_id ?? null);
  const { toast } = useToast();

  const stay = refresh ?? reload;

  const [slots, setSlots] = useState<SlotState[]>([{ ...EMPTY_SLOT }, { ...EMPTY_SLOT }]);
  const hydratedFor = useRef<string | null>(null);
  const [enrichStatus, setEnrichStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [stepOpen, setStepOpen] = useState(false);
  const [builderInput, setBuilderInput] = useState("");
  const [overrideDate, setOverrideDate] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  // A lead that already carries an enrichment_status has been through timing, so
  // the ladder survives a page refresh instead of hiding behind timing again.
  const [skipTiming, setSkipTiming] = useState<boolean>(
    ((lead as any).enrichment_status ?? null) !== null,
  );
  const [history, setHistory] = useState<CompanyHistory | null>(null);
  const [enrichedDetail, setEnrichedDetail] = useState<string | null>(null);
  const [heldContacts, setHeldContacts] = useState<HeldContact[] | null>(null);
  const [orgDomain, setOrgDomain] = useState<string | null>(null);
  const [earlyDate, setEarlyDate] = useState("");

  // One query for the company's contacts. It feeds the Known at this company
  // list and the domain the hand-found address must match, because the
  // organisations table carries no domain on any row today.
  useEffect(() => {
    if (!lead.organisation_id) { setHeldContacts(null); setOrgDomain(null); return; }
    let cancel = false;
    const orgId = lead.organisation_id;
    (async () => {
      const r: any = await db
        .from("contacts")
        .select("id, first_name, last_name, role, email")
        .eq("organisation_id", orgId);
      if (cancel) return;
      const list: HeldContact[] = (r?.data ?? []).filter((c: HeldContact) => (c.email ?? "").trim());
      setHeldContacts(list);

      // The most common domain wins, since some companies hold more than one.
      const counts = new Map<string, number>();
      list.forEach((c) => {
        const d = emailDomain((c.email ?? "").trim().toLowerCase());
        if (d) counts.set(d, (counts.get(d) ?? 0) + 1);
      });
      let best = "";
      let bestN = 0;
      counts.forEach((n, d) => { if (n > bestN) { best = d; bestN = n; } });
      if (best) { setOrgDomain(best); return; }

      // Fallbacks, in case the organisation record is ever populated.
      const o: any = await db.from("organisations").select("website,email").eq("id", orgId).maybeSingle();
      if (cancel) return;
      const site = (o?.data?.website ?? "").trim();
      const mail = (o?.data?.email ?? "").trim();
      let d = "";
      if (site) d = site.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase();
      if (!d && mail) d = emailDomain(mail.toLowerCase());
      setOrgDomain(d || null);
    })();
    return () => { cancel = true; };
  }, [lead.organisation_id]);




  // Bug fix (a): hydrate Block E once per lead, so a context refetch never
  // wipes edits the user has already made to the slots.
  useEffect(() => {
    if (!ctx) return;
    if (hydratedFor.current === lead.id) return;
    const be = ctx.block_e?.slots ?? [];
    setSlots([slotFromBlockE(be[0]), slotFromBlockE(be[1])]);
    hydratedFor.current = lead.id;
  }, [ctx, lead.id]);

  useEffect(() => {
    let cancel = false;
    db.from("v_company_history").select("*").eq("company", lead.company_builder).maybeSingle()
      .then((r: any) => { if (!cancel) setHistory(r?.data ?? null); });
    return () => { cancel = true; };
  }, [lead.id, lead.company_builder]);

  // The backend writes an accurate sentence on the newest 'enriched' event, so
  // the ladder banner prefers it over the static copy.
  useEffect(() => {
    let cancel = false;
    db.from("lead_events")
      .select("detail,occurred_at")
      .eq("lead_id", lead.id)
      .eq("kind", "enriched")
      .order("occurred_at", { ascending: false })
      .limit(1)
      .then((r: any) => {
        if (cancel) return;
        const d = r?.data?.[0]?.detail;
        setEnrichedDetail(typeof d === "string" && d.trim() ? d.trim() : null);
      });
    return () => { cancel = true; };
  }, [lead.id, lead.next_step_code, (lead as any).enrichment_status]);



  const work = ctx?.work ?? [];
  const prevLeads = (ctx?.leads ?? []).filter((l) => l.lead_id !== lead.id);
  const placeholder = lead.is_placeholder_builder === true || isPlaceholderBuilder(lead.company_builder);
  const band = timing?.timing_band ?? "unknown";
  const hasEmail = !!lead.direct_email;

  const hasContactDetails = !!(lead.project_contact_name || lead.role || lead.direct_email || lead.phone);


  const priorWorkSlots: PriorWorkSlot[] | undefined = useMemo(() => {
    if (!ctx?.block_e) return undefined;
    return slots
      .filter((s) => s.project.trim())
      .map((s) => ({ project: s.project.trim(), contact: s.contact.trim(), state: s.state, stages: s.stages }));
  }, [ctx, slots]);

  const preview = useMemo(() => buildPreview(slots, lead.company_builder), [slots, lead.company_builder]);

  // ---- the escalating ladder ----
  // Derived from enrichment_status and next_step_code only, never work_status,
  // and strictly sequential so a rung can never be skipped forward.
  const enrichmentStatus = enrichStatus ?? ((lead as any).enrichment_status as string | null) ?? null;
  const isDuplicate = enrichmentStatus === "duplicate";
  const nextStepCode = lead.next_step_code ?? null;

  const rung: Rung | null = useMemo(() => {
    if (isDuplicate) return null;
    if (nextStepCode === "nl_company_tracker") return 3;
    if (nextStepCode === "nl_manual_attempt") return 2;
    if (!nextStepCode && enrichmentStatus === "all_known") return 2;
    if (!nextStepCode && (enrichmentStatus === "no_email" || enrichmentStatus === "no_org")) return 1;
    return null;
  }, [isDuplicate, nextStepCode, enrichmentStatus]);

  const rungTwoAfterManualAttempt = rung === 2 && nextStepCode === "nl_manual_attempt";

  const notice = useMemo(() => {
    if (rung === 1) {
      return {
        tone: "amber" as const,
        title: "No contact found",
        detail: enrichedDetail ?? "Automation found nobody with an email at this company.",
      };
    }
    if (rung === 2 && !rungTwoAfterManualAttempt) {
      return {
        tone: "amber" as const,
        title: "Everyone here is already in the directory",
        detail: enrichedDetail ?? "Every qualified person at this company is already held, so the answer is in the tracker.",
      };
    }
    if (rung === 2 && rungTwoAfterManualAttempt) {
      return {
        tone: "amber" as const,
        title: "Manual attempt logged",
        detail: "Tried by hand, still no address. One rung left before this goes to the call queue.",
      };
    }
    if (rung === 3) {
      return {
        tone: "red" as const,
        title: "Company tracker exhausted",
        detail: "Nothing usable by automation, by hand, or in the directory. Email is not the route for this lead.",
      };
    }
    return null;
  }, [rung, rungTwoAfterManualAttempt, enrichedDetail]);

  /** Records a rung marker and keeps the lead on screen. */
  async function markRung(code: "nl_manual_attempt" | "nl_company_tracker", label: string) {
    if (busy) return;
    setBusy(code);
    const { error } = await db.from("leads").update({ next_step_code: code }).eq("id", lead.id);
    setBusy(null);
    if (error) {
      toast({
        title: "Could not record that step",
        description: error.message,
        className: "border-chart-orange/40 bg-chart-orange/10 text-chart-orange",
      });
      return;
    }
    toast({ title: label });
    await stay();
  }

  /** Rung 3. The lead leaves New Leads for the call queue, so the queue advances. */
  async function noEmail() {
    if (busy) return;
    setBusy("nl_no_email");
    const { error } = await db.from("leads")
      .update({ stage: "ready_to_call", next_step_code: "nl_no_email" })
      .eq("id", lead.id);
    setBusy(null);
    if (error) {
      toast({
        title: "Could not move this lead to Cold Call",
        description: error.message,
        className: "border-chart-orange/40 bg-chart-orange/10 text-chart-orange",
      });
      return;
    }
    toast({ title: "Moved to Cold Call" });
    await reload();
  }


  function reportBlocked(r: OvenWebhookResult) {
    toast({
      title: r.blocked ? "Blocked" : "That did not complete",
      description: r.reason,
      className: "border-chart-orange/40 bg-chart-orange/10 text-chart-orange",
    });
  }

  async function searchBuilder() {
    if (busy) return;
    setBusy("builder");
    const r = await postOvenWebhook("tt-lead-builder", { lead_id: lead.id, operator });
    setBusy(null);
    if (!r.ok) { reportBlocked(r); return; }
    toast({ title: "Builder search finished", description: r.body?.detail ?? "The lead has been updated if a builder was found." });
    await stay();
  }

  async function saveBuilder() {
    const v = builderInput.trim();
    if (v.length < 2) return;
    setBusy("builder_manual");
    const { error } = await db.from("leads").update({ company_builder: v }).eq("id", lead.id);
    setBusy(null);
    if (error) {
      toast({ title: "Could not save the builder", description: error.message, className: "border-chart-orange/40 bg-chart-orange/10 text-chart-orange" });
      return;
    }
    toast({ title: "Builder saved" });
    setBuilderInput("");
    await stay();
  }

  async function searchTiming() {
    if (busy) return;
    setBusy("timing");
    const r = await postOvenWebhook("tt-lead-timing", { lead_id: lead.id, operator });
    setBusy(null);
    if (!r.ok) { reportBlocked(r); return; }
    toast({ title: "Completion date search finished", description: r.body?.detail ?? "The timing has been updated if a date was found." });
    await stay();
  }

  async function saveOverride() {
    if (!overrideDate) return;
    setBusy("override");
    const { error } = await db.from("leads").update({
      completion_estimate: overrideDate,
      completion_precision: "month",
      completion_source: "manual",
      completion_checked_at: new Date().toISOString(),
    }).eq("id", lead.id);
    setBusy(null);
    if (error) {
      toast({ title: "Could not save the date", description: error.message, className: "border-chart-orange/40 bg-chart-orange/10 text-chart-orange" });
      return;
    }
    toast({ title: "Completion date overridden" });
    await stay();
  }

  async function schedule() {
    if (busy) return;
    if (!scheduleDate) return;
    setBusy("schedule");
    await db.from("leads").update({ follow_up_date: scheduleDate }).eq("id", lead.id);
    setBusy(null);
    toast({ title: `Scheduled for ${scheduleDate}` });
    await reload();
  }

  async function removeLead() {
    if (busy) return;
    setBusy("remove");
    await db.from("leads").update({ stage: "archived", archived_at: new Date().toISOString() }).eq("id", lead.id);
    setBusy(null);
    toast({ title: "Lead removed from the oven" });
    await reload();
  }

  async function findDetails() {
    if (busy) return;
    setBusy("apollo");
    
    try {
      const r = await enrichLead(lead.id, operator, "full");
      const st = (r as any).enrichment_status ?? (r as any).status ?? null;
      if (st) setEnrichStatus(st);
      if (r.ok && r.matched && r.draft === "created") {
        toast({ title: `Found ${r.contact?.name?.trim() || "contact"} - draft created`, description: "Email drafted in sales@ and Zoho lead created." });
      } else if (r.ok && r.matched) {
        toast({
          title: "Contact found but the draft failed",
          description: r.detail || "Contact captured; the send workflow did not complete.",
          className: "border-chart-orange/40 bg-chart-orange/10 text-chart-orange",
        });
      } else if (r.ok) {
        // A search that found nothing is a normal outcome. The enrichment status
        // gives the lead its rung, and the ladder banner carries the detail.
        toast({ title: r.detail || "Apollo found nobody with an email at this company." });

      } else {
        toast({
          title: "Apollo did not respond",
          description: r.detail || "The lead is unchanged.",
          className: "border-chart-orange/40 bg-chart-orange/10 text-chart-orange",
        });
      }
      await stay();
    } finally {
      setBusy(null);
    }
  }

  async function sendToColdCall() {
    if (busy) return;
    setBusy("cold");
    const { error } = await db.from("leads").update({ stage: "ready_to_call" }).eq("id", lead.id);
    setBusy(null);
    if (error) {
      toast({
        title: "Could not send to Cold Call",
        description: error.message,
        className: "border-chart-orange/40 bg-chart-orange/10 text-chart-orange",
      });
      return;
    }
    toast({ title: "Sent to Cold Call" });
    await reload();
  }

  async function saveManualContact(v: { name: string; email: string; role: string }) {
    const name = v.name.trim();
    const email = v.email.trim().toLowerCase();
    const role = v.role.trim() || null;

    const { error } = await db.from("leads")
      .update({ project_contact_name: name, direct_email: email, role })
      .eq("id", lead.id);

    if (error) {
      toast({
        title: "Could not save the contact",
        description: error.message ?? "The lead is unchanged.",
        className: "border-chart-orange/40 bg-chart-orange/10 text-chart-orange",
      });
      return;
    }

    if (lead.organisation_id) {
      try {
        await db.from("contacts").insert({
          organisation_id: lead.organisation_id,
          first_name: name.split(/\s+/)[0],
          last_name: name.split(/\s+/).slice(1).join(" ") || null,
          email,
          role,
        });
      } catch {
        // a duplicate or constraint failure must never undo the lead update
      }
    }

    await stay();

    toast({ title: "Contact saved - you can now send an EOI" });
  }

  /** Use an address we already hold. Unlocks Send EOI, never advances the lead. */
  async function useHeldContact(c: HeldContact) {
    if (busy) return;
    setBusy("use_held");
    const name = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
    const { error } = await db.from("leads")
      .update({ project_contact_name: name || null, direct_email: (c.email ?? "").trim().toLowerCase(), role: c.role ?? null })
      .eq("id", lead.id);
    setBusy(null);
    if (error) {
      toast({
        title: "Could not use that contact",
        description: error.message,
        className: "border-chart-orange/40 bg-chart-orange/10 text-chart-orange",
      });
      return;
    }
    toast({ title: "Contact set - you can now send an EOI" });
    await stay();
  }

  const projectMissing = !((lead.project_name ?? "").trim());

  /** Early Days leaves New Leads, so the queue advances. */
  async function earlyDays() {
    if (busy || projectMissing) return;
    setBusy("early_days");
    const { error } = await db.from("leads")
      .update({
        next_step_code: "nl_early_days",
        stage: "early_days",
        follow_up_date: earlyDate ? earlyDate : null,
      })
      .eq("id", lead.id);
    setBusy(null);
    if (error) {
      toast({
        title: "Could not set Early Days",
        description: error.message,
        className: "border-chart-orange/40 bg-chart-orange/10 text-chart-orange",
      });
      return;
    }
    toast({ title: earlyDate ? `Early Days - EOI due ${earlyDate}` : "Early Days" });
    await reload();
  }



  // One decision on screen at a time, resolved in a fixed priority order so a
  // step cannot be jumped and the downstream automations stay in sequence.
  const activePanel: "builder" | "timing_unknown" | "timing_past" | "contact" | "send" =
    placeholder
      ? "builder"
      : band === "unknown" && !skipTiming
        ? "timing_unknown"
        : band === "past" && !skipTiming
          ? "timing_past"
          : !hasEmail
            ? "contact"
            : "send";

  const stepperCurrent: "builder" | "timing" | "contact" | "send" =
    activePanel === "builder"
      ? "builder"
      : activePanel === "timing_unknown" || activePanel === "timing_past"
        ? "timing"
        : activePanel === "contact"
          ? "contact"
          : "send";


  // Early Days leaves New Leads and sends no email. The project name guard is a
  // hard requirement, since the early_days stage will not accept a blank one.
  const earlyDaysRow = (
    <div className="space-y-1">
      <div className="flex flex-wrap items-end gap-2">
        <button
          type="button"
          disabled={busy !== null || projectMissing}
          onClick={earlyDays}
          style={{
            padding: "7px 13px", borderRadius: "7px", fontSize: "13px",
            background: "#1c2430", border: "1px solid #26303d", color: "#c9d1d9",
            opacity: busy !== null || projectMissing ? 0.5 : 1,
          }}
        >
          Early Days
        </button>
        <div>
          <div className="font-mono uppercase" style={{ fontSize: "11px", color: "#6e7681", marginBottom: "3px" }}>
            When to send the EOI
          </div>
          <input type="date" className={SELECT_CLS} value={earlyDate} onChange={(e) => setEarlyDate(e.target.value)} />
        </div>
      </div>
      {projectMissing && (
        <div className="font-mono" style={{ fontSize: "11.5px", color: "#e3b341" }}>
          Add a project name first - an EOI cannot be sent without one.
        </div>
      )}
    </div>
  );

  return (

    <div className="space-y-4">
      <Stepper current={stepperCurrent} />

      {/* A duplicate has no rung, and the warning must show on every panel. */}
      {isDuplicate && (
        <div className="space-y-2">
          <LadderNotice
            tone="amber"
            title="Duplicate - review"
            detail={enrichedDetail ?? "This lead matches one we already hold."}
          />
          <div className="font-mono" style={{ fontSize: "11.5px", color: "#6e7681" }}>
            No next step. Stays here until the merge screen exists.
          </div>
        </div>
      )}


      {activePanel === "builder" && (
        <div className="rounded-md border border-border bg-muted/10 px-3 py-3 space-y-2">
          <PanelHeader title="Which builder is this?" />
          <div className="text-sm" style={{ color: "#e5934b" }}>
            No builder recorded on this lead. Nothing can proceed without a company.
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Button size="sm" variant="outline" disabled={busy === "builder"} onClick={searchBuilder}>
              {busy === "builder" ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Search className="w-3.5 h-3.5 mr-1" />}
              Search for the builder
            </Button>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1">Or enter it</div>
              <div className="flex gap-2">
                <input
                  className={SELECT_CLS + " min-w-[200px]"}
                  placeholder="Builder name"
                  value={builderInput}
                  onChange={(e) => setBuilderInput(e.target.value)}
                />
                <Button size="sm" variant="outline" disabled={builderInput.trim().length < 2 || busy === "builder_manual"} onClick={saveBuilder}>
                  Save builder
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activePanel === "timing_unknown" && (
        <div className="rounded-md border border-border bg-muted/10 px-3 py-3 space-y-2">
          <PanelHeader title="When does this project finish?" hint={timing?.guidance ?? undefined} />
          <div className="text-sm text-muted-foreground">No completion date on record, so we cannot tell whether this is worth chasing yet.</div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" disabled={busy === "timing"} onClick={searchTiming}>
              {busy === "timing" ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Search className="w-3.5 h-3.5 mr-1" />}
              Search for a completion date
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSkipTiming(true)}>Skip, find a contact anyway</Button>
          </div>
          {earlyDaysRow}
        </div>
      )}

      {activePanel === "timing_past" && (
        <div className="rounded-md border border-border bg-muted/10 px-3 py-3 space-y-2">
          <PanelHeader
            title={`This project finished ${timing?.days_overdue ?? 0} days ago`}
            hint={timing?.guidance ?? undefined}
          />
          <div className="text-sm" style={{ color: "#e5934b" }}>
            Completion was due {timing?.due_date ? monthYear(timing.due_date) : "earlier"}. This job may already be built.
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Button size="sm" variant="outline" disabled={busy === "remove"} onClick={removeLead}>Remove lead</Button>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1">Override date</div>
              <div className="flex gap-2">
                <input type="date" className={SELECT_CLS} value={overrideDate} onChange={(e) => setOverrideDate(e.target.value)} />
                <Button size="sm" variant="outline" disabled={!overrideDate || busy === "override"} onClick={saveOverride}>Save</Button>
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1">Schedule for</div>
              <div className="flex gap-2">
                <input type="date" className={SELECT_CLS} value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
                <Button size="sm" variant="outline" disabled={!scheduleDate || busy === "schedule"} onClick={schedule}>Set</Button>
              </div>
            </div>
          </div>
          <div>
            <Button size="sm" variant="ghost" onClick={() => setSkipTiming(true)}>It is delayed, find a contact</Button>
          </div>
          <div>
            {earlyDaysRow}
          </div>
        </div>
      )}

      {activePanel === "contact" && (
        <div className="rounded-md border border-border bg-muted/10 px-3 py-3 space-y-3">
          <PanelHeader title="Who do we email?" />

          {hasContactDetails ? (
            <div className="space-y-1">
              {lead.project_contact_name && (
                <div className="text-sm font-semibold">
                  {lead.project_contact_name}
                  {lead.role && <span className="text-muted-foreground font-normal"> - {lead.role}</span>}
                </div>
              )}
              {lead.phone && (
                <a href={`tel:${lead.phone}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <Phone className="w-3.5 h-3.5" /> {lead.phone}
                </a>
              )}
            </div>
          ) : (
            <div className="text-sm text-chart-orange italic">No contact details yet</div>
          )}


          {/* The escalating ladder: exactly one next step, never skipped forward. */}
          {!isDuplicate && rung !== null && (
            <div className="space-y-2">
              {notice && <LadderNotice tone={notice.tone} title={notice.title} detail={notice.detail} />}

              <div>
                <div
                  className="font-mono uppercase"
                  style={{ fontSize: "10px", letterSpacing: ".08em", color: "#6e7681" }}
                >
                  Next step - {rung} of 3
                </div>
                <RungPips rung={rung} />

                {rung === 1 && (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => markRung("nl_manual_attempt", "Manual attempt logged")}
                    style={{
                      width: "100%", padding: "11px", borderRadius: "7px",
                      background: "#3D89DA", color: "#fff", fontWeight: 600,
                      opacity: busy !== null ? 0.6 : 1,
                    }}
                  >
                    Manual Attempt
                  </button>
                )}

                {rung === 2 && (
                  <div style={{ marginBottom: "9px" }}>
                    <KnownAtCompany
                      organisationId={lead.organisation_id ?? null}
                      rows={heldContacts}
                      disabled={busy !== null}
                      onUse={useHeldContact}
                    />
                  </div>
                )}


                {rung === 2 && (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => markRung("nl_company_tracker", "Company tracker step logged")}
                    style={{
                      width: "100%", padding: "11px", borderRadius: "7px",
                      background: "#3D89DA", color: "#fff", fontWeight: 600,
                      opacity: busy !== null ? 0.6 : 1,
                    }}
                  >
                    See Company Tracker
                  </button>
                )}

                {rung === 3 && (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={noEmail}
                    style={{
                      width: "100%", padding: "11px", borderRadius: "7px",
                      background: "transparent", border: "1px solid #4a2020",
                      color: "#f0837f", fontWeight: 600,
                      opacity: busy !== null ? 0.6 : 1,
                    }}
                  >
                    NO EMAIL
                  </button>
                )}

                <div className="text-center" style={{ fontSize: "11.5px", color: "#6e7681", marginTop: "6px" }}>
                  {rung === 1
                    ? "Search LinkedIn and Apollo by hand, then come back"
                    : rung === 2
                      ? "Pick an address we already hold, or hand the lead on"
                      : "Moves this lead to Cold Call. It leaves New Leads."}
                </div>
              </div>
            </div>
          )}

          {/* Present on every rung, collapsed by default. */}
          {!isDuplicate && (
            <FoundOnePanel
              orgDomain={orgDomain}
              company={lead.company_builder}
              busy={busy !== null}
              onSave={saveManualContact}
            />
          )}


          {!isDuplicate && rung === null && (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={findDetails} disabled={busy !== null}>
                {busy === "apollo" ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
                {busy === "apollo" ? "Searching Apollo..." : "Find Details"}
              </Button>
              <Button size="sm" variant="outline" disabled={busy !== null} onClick={sendToColdCall}>
                {busy === "cold" ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
                Send to Cold Call
              </Button>
            </div>
          )}



          {lead.stage === "enriching" && (
            <div className="text-xs font-mono text-muted-foreground italic flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" /> Apollo is searching...
              {(lead as any).enriched_at && <span>since {formatTs((lead as any).enriched_at)}</span>}
            </div>
          )}
        </div>
      )}

      {activePanel === "send" && (
        <div className="rounded-md border border-border bg-muted/10 px-3 py-3 space-y-3">
          <PanelHeader title="Which email?" />

          <div className="space-y-1">
            {lead.project_contact_name && (
              <div className="text-sm font-semibold">
                {lead.project_contact_name}
                {lead.role && <span className="text-muted-foreground font-normal"> - {lead.role}</span>}
              </div>
            )}
            {lead.direct_email && (
              <a href={`mailto:${lead.direct_email}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                <Mail className="w-3.5 h-3.5" /> {lead.direct_email}
              </a>
            )}
          </div>

          {/* A failed context read is not the same as no history. */}
          {ctxError ? (
            <div className="text-sm" style={{ color: "#e5934b" }}>
              The work history for this builder could not be loaded. Do not treat this as a first approach - retry before sending.
            </div>
          ) : !lead.organisation_id || !ctx ? (
            <div className="text-sm text-muted-foreground italic">First contact with this company.</div>
          ) : (
            <div className="space-y-3">
              <div className="font-mono text-xs">
                <span className="font-semibold">{ctx.lead_count}</span> previous leads
                {", "}<span className="font-semibold">{ctx.replied_count}</span> replied
                {ctx.response_rate_pct != null && <>, <span className="font-semibold">{Math.round(ctx.response_rate_pct)}%</span> response rate</>}
                {", "}<span className="font-semibold">{ctx.completed_count}</span> completed, <span className="font-semibold">{ctx.live_count}</span> live
              </div>

              {work.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <tbody>
                      {work.map((w, i) => (
                        <tr key={i} className="border-t border-border/50">
                          <td className="py-1.5 pr-3">{w.project || DASH}</td>
                          <td className="py-1.5 pr-3 text-muted-foreground">{w.contact || DASH}</td>
                          <td className="py-1.5 pr-3"><StageBadge label={w.stage_label} /></td>
                          <td className="py-1.5 pr-3 text-muted-foreground whitespace-nowrap">
                            {w.closing_date ? `${w.is_forecast ? "due " : ""}${monthYear(w.closing_date)}` : DASH}
                          </td>
                          <td className="py-1.5 text-right whitespace-nowrap">{money(w.contract_value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {work.length > 0 && ctx.block_e && (
                <div
                  className="rounded-lg"
                  style={{
                    background: "rgba(61,137,218,0.09)",
                    border: "1px solid rgba(61,137,218,0.30)",
                    padding: "13px 14px",
                  }}
                >
                  <div className="font-mono uppercase text-[10.5px] tracking-[0.13em] mb-3" style={{ color: "#8fb8e4" }}>
                    What the EOI will say
                  </div>
                  <div className="space-y-2">
                    <SlotRow label="Mention" slot={slots[0]} work={work} onChange={(s) => setSlots((p) => [s, p[1]])} />
                    <SlotRow label="and" slot={slots[1]} work={work} onChange={(s) => setSlots((p) => [p[0], s])} />
                  </div>
                  <div
                    className="mt-3 rounded-md px-3 py-2 text-sm"
                    style={{ background: "rgba(3,8,15,0.55)", border: "1px solid rgba(61,137,218,0.22)" }}
                  >
                    {preview
                      ? <span>{preview}</span>
                      : <span className="italic text-muted-foreground">Nothing selected - the EOI goes out without this paragraph.</span>}
                  </div>
                </div>
              )}

              {prevLeads.length > 0 && (
                <div className="overflow-x-auto">
                  <div className="font-mono uppercase text-[10.5px] tracking-[0.13em] text-muted-foreground mb-1">Previous leads</div>
                  <table className="w-full text-xs font-mono">
                    <tbody>
                      {prevLeads.map((l) => (
                        <tr key={l.lead_id} className="border-t border-border/50">
                          <td className="py-1.5 pr-3">{l.project || DASH}</td>
                          <td className="py-1.5 pr-3 whitespace-nowrap">
                            {l.emailed_at ? `emailed ${dayMonthYear(l.emailed_at)}` : <span className="text-muted-foreground">send not recorded</span>}
                          </td>
                          <td className="py-1.5 pr-3"><StageBadge label={l.stage} /></td>
                          <td className="py-1.5 whitespace-nowrap">
                            {l.responded_at
                              ? <span style={{ color: "#a9cbef" }}>replied {dayMonthYear(l.responded_at)}</span>
                              : <span className="text-muted-foreground">no reply</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" onClick={() => setStepOpen(true)} disabled={isDuplicate}>Set next step</Button>
            {isDuplicate && (
              <span className="font-mono" style={{ fontSize: "11.5px", color: "#e3b341" }}>
                Resolve the duplicate before sending.
              </span>
            )}
            {history?.last_contacted && (
              <span className="text-[11px] text-muted-foreground">last contacted {monthYear(history.last_contacted)}</span>
            )}
          </div>

        </div>
      )}

      {lead.notes && (
        <div className="rounded-md border border-border bg-muted/10 px-3 py-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1">Notes</div>
          <div className="text-sm whitespace-pre-wrap">{lead.notes}</div>
        </div>
      )}

      <SetNextStepDialog
        open={stepOpen}
        onOpenChange={setStepOpen}
        lead={lead}
        operator={operator}
        priorWorkSlots={priorWorkSlots}
        onSaved={() => { setStepOpen(false); reload(); }}
      />
    </div>
  );
}
