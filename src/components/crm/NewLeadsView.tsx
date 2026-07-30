import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Phone, SkipForward, Sparkles, Loader2, Clock, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { enrichLead, Lead, useCrmRefs } from "@/hooks/useCrmLeads";
import { useToast } from "@/hooks/use-toast";
import SetNextStepDialog from "./SetNextStepDialog";

const db = supabase as any;

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

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-AU", { month: "short", year: "numeric" });
}
function formatTs(iso?: string | null) {
  if (!iso) return "—";
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
function money(v?: number | null) {
  if (v == null) return "—";
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
  if (!label) return <span className="text-muted-foreground">—</span>;
  const cls = STAGE_BADGE[label] ?? "bg-slate-400/15 text-slate-300";
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono whitespace-nowrap ${cls}`}>
      {label}
    </span>
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

export function useNewLeads() {
  const [rows, setRows] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await db
      .from("leads")
      .select("*, organisation_id")
      .in("stage", ["new", "enriching"])
      .order("created_at", { ascending: true })
      .range(0, 4999);
    setRows((data as Lead[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  return { rows, loading, reload: load };
}

export function useLeadCardContext(organisationId: string | null) {
  const [ctx, setCtx] = useState<LeadCardContext | null>(null);

  useEffect(() => {
    if (!organisationId) { setCtx(null); return; }
    let cancel = false;
    db.from("v_lead_card_context")
      .select("*")
      .eq("organisation_id", organisationId)
      .maybeSingle()
      .then((r: any) => {
        if (cancel) return;
        if (r?.error || !r?.data) { setCtx(null); return; }
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

  return ctx;
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
          <option value="">— none —</option>
          {projectOptions.map((w, i) => (
            <option key={i} value={w.project ?? ""}>
              {w.project}{w.closing_date ? ` · ${w.is_forecast ? "due " : ""}${monthYear(w.closing_date)}` : ""}
            </option>
          ))}
          <option value="__custom__">Custom project…</option>
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
          <option value="">— no name —</option>
          {contacts.map((c) => <option key={c} value={c}>{c}</option>)}
          <option value="__custom__">Custom name…</option>
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

function ManualContactPanel({
  onCancel, onSave,
}: {
  onCancel: () => void;
  onSave: (v: { name: string; email: string; role: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const nameOk = name.trim().length >= 2;
  const emailOk = EMAIL_RE.test(email.trim());
  const canSave = nameOk && emailOk && !saving;

  const nameBad = nameTouched && name.length > 0 && !nameOk;
  const emailBad = emailTouched && email.length > 0 && !emailOk;

  return (
    <div className="mt-3 rounded-md border border-border bg-muted/10 px-3 py-3 space-y-3">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1">Name</div>
        <input
          className={MANUAL_INPUT_CLS + (nameBad ? " border-red-500" : " border-border")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setNameTouched(true)}
        />
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1">Email</div>
        <input
          className={MANUAL_INPUT_CLS + (emailBad ? " border-red-500" : " border-border")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setEmailTouched(true)}
        />
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1">Role</div>
        <input
          className={MANUAL_INPUT_CLS + " border-border"}
          value={role}
          onChange={(e) => setRole(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button
          size="sm"
          disabled={!canSave}
          style={canSave ? { backgroundColor: "#3D89DA", color: "#fff" } : undefined}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave({ name, email, role });
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
          Save contact
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
        {!(nameOk && emailOk) && (
          <span style={{ color: "#e5934b", fontSize: "11.5px" }}>Name and a valid email are required</span>
        )}
      </div>
    </div>
  );
}



export default function NewLeadsView({ operator }: { operator: string }) {
  const refs = useCrmRefs();
  const { rows, loading, reload } = useNewLeads();
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [busy, setBusy] = useState(false);
  const [stepOpen, setStepOpen] = useState(false);
  const [history, setHistory] = useState<CompanyHistory | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [slots, setSlots] = useState<SlotState[]>([{ ...EMPTY_SLOT }, { ...EMPTY_SLOT }]);
  const [manualOpenFor, setManualOpenFor] = useState<string | null>(null);
  const [enrichStatusById, setEnrichStatusById] = useState<Record<string, string>>({});
  const { toast } = useToast();


  const lead = rows[idx];
  const ctx = useLeadCardContext(lead?.organisation_id ?? null);

  useEffect(() => {
    if (rows.length && progress.total === 0) setProgress({ done: 0, total: rows.length });
  }, [rows.length, progress.total]);

  useEffect(() => {
    if (!lead) { setHistory(null); return; }
    let cancel = false;
    db.from("v_company_history").select("*").eq("company", lead.company_builder).maybeSingle()
      .then((r: any) => { if (!cancel) setHistory(r.data ?? null); });
    return () => { cancel = true; };
  }, [lead?.id, lead?.company_builder]);

  useEffect(() => { setExpanded(false); }, [lead?.id]);

  useEffect(() => {
    const be = ctx?.block_e?.slots ?? [];
    setSlots([slotFromBlockE(be[0]), slotFromBlockE(be[1])]);
  }, [ctx]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setExpanded(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  const hasContactDetails = useMemo(() => {
    if (!lead) return false;
    return !!(lead.project_contact_name || lead.role || lead.direct_email || lead.phone);
  }, [lead]);

  const hasEmail = !!lead?.direct_email;

  const manualEligible = useMemo(() => {
    if (!lead) return false;
    if (lead.project_contact_name && lead.direct_email) return false;
    const st = enrichStatusById[lead.id] ?? (lead as any).enrichment_status ?? null;
    const enrichDeadEnd = st === "no_org" || st === "no_email";
    const bare = !lead.project_contact_name && !lead.direct_email;
    return enrichDeadEnd || bare;
  }, [lead, enrichStatusById]);

  async function saveManualContact(v: { name: string; email: string; role: string }) {
    if (!lead) return;
    const name = v.name.trim();
    const email = v.email.trim().toLowerCase();
    const role = v.role.trim() || null;

    const { error } = await db
      .from("leads")
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

    await reload();
    setManualOpenFor(null);
    toast({ title: "Contact saved — you can now send an EOI" });
  }


  const priorWorkSlots: PriorWorkSlot[] | undefined = useMemo(() => {
    if (!ctx?.block_e) return undefined;
    return slots
      .filter((s) => s.project.trim())
      .map((s) => ({
        project: s.project.trim(),
        contact: s.contact.trim(),
        state: s.state,
        stages: s.stages,
      }));
  }, [ctx, slots]);

  const preview = useMemo(
    () => (lead ? buildPreview(slots, lead.company_builder) : null),
    [slots, lead?.company_builder],
  );

  function next(bump = true) {
    if (bump) setProgress((p) => ({ ...p, done: p.done + 1 }));
    setIdx((i) => i + 1);
  }

  async function findDetails() {
    if (!lead || busy) return;
    setBusy(true);
    try {
      const r = await enrichLead(lead.id, operator, "full");
      const st = (r as any).enrichment_status ?? (r as any).status ?? null;
      if (st === "no_org" || st === "no_email") {
        setEnrichStatusById((p) => ({ ...p, [lead.id]: st }));
      }
      if (r.ok && r.matched && r.draft === "created") {
        const name = r.contact?.name?.trim() || "contact";
        toast({ title: `Found ${name} — draft created`, description: "Email drafted in sales@ and Zoho lead created." });
        await reload();
        next();
      } else if (r.ok && r.matched && r.draft && r.draft !== "created") {
        const name = r.contact?.name?.trim() || "contact";
        toast({
          title: `Found ${name} but the draft failed`,
          description: r.detail || "Contact captured; the send workflow did not complete.",
          className: "border-chart-orange/40 bg-chart-orange/10 text-chart-orange",
        });
        await reload();
      } else if (r.ok && r.matched === false) {
        toast({
          title: "No match",
          description: r.detail || "Apollo could not find a matching contact.",
          className: "border-chart-orange/40 bg-chart-orange/10 text-chart-orange",
        });
        await reload();
        next(false);
      } else {
        toast({
          title: "Apollo did not respond",
          description: r.detail || "The lead is unchanged.",
          className: "border-chart-orange/40 bg-chart-orange/10 text-chart-orange",
        });
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading && !rows.length) {
    return <div className="p-8 text-sm text-muted-foreground font-mono">Loading new leads…</div>;
  }

  if (!lead) {
    return (
      <Card className="p-10 text-center">
        <div className="text-lg font-mono uppercase tracking-wider mb-2">Nothing new</div>
        <p className="text-sm text-muted-foreground">All scraped leads have been actioned.</p>
        <Button variant="outline" className="mt-4" onClick={reload}>Refresh</Button>
      </Card>
    );
  }

  const pct = progress.total ? Math.min(100, (progress.done / progress.total) * 100) : 0;

  const work = ctx?.work ?? [];
  const prevLeads = (ctx?.leads ?? []).filter((l) => l.lead_id !== lead.id);
  const priorBits: string[] = [];
  if ((ctx?.completed_count ?? 0) > 0) priorBits.push(`${ctx!.completed_count} completed`);
  if ((ctx?.live_count ?? 0) > 0) priorBits.push(`${ctx!.live_count} live`);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">
        <span>Working as <span className="text-foreground font-semibold normal-case">{operator}</span></span>
        <span>·</span>
        <span>{rows.length} new leads</span>
        <div className="flex-1 min-w-[120px]">
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <span className="normal-case">{progress.done}/{progress.total} done</span>
      </div>

      <Card className="p-6 space-y-6">
        <div>
          <div className="flex items-start gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-mono font-semibold tracking-tight truncate">{lead.company_builder}</h1>
              <div className="text-base text-muted-foreground truncate">
                {lead.project_name || <span className="italic">No project name</span>}
              </div>
            </div>
            {lead.state && (
              <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded border border-border bg-muted/40">
                {lead.state}
              </span>
            )}
          </div>
        </div>

        {lead.stage === "enriching" && (
          <div className="text-xs font-mono text-muted-foreground italic flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" /> Apollo is searching…
            {(lead as any).enriched_at && <span>· since {formatTs((lead as any).enriched_at)}</span>}
          </div>
        )}

        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-2">Contact</div>
          {hasContactDetails ? (
            <div className="space-y-1">
              {lead.project_contact_name && (
                <div className="text-sm font-semibold">
                  {lead.project_contact_name}
                  {lead.role && <span className="text-muted-foreground font-normal"> · {lead.role}</span>}
                </div>
              )}
              {lead.direct_email && (
                <a href={`mailto:${lead.direct_email}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <Mail className="w-3.5 h-3.5" /> {lead.direct_email}
                </a>
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

          {manualEligible && (
            manualOpenFor === lead.id ? (
              <ManualContactPanel
                key={lead.id}
                onCancel={() => setManualOpenFor(null)}
                onSave={saveManualContact}
              />
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => setManualOpenFor(lead.id)}
              >
                Enter contact manually
              </Button>
            )
          )}
        </div>


        <div>
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls="lead-card-context-panel"
            onClick={() => setExpanded((v) => !v)}
            className="w-full text-left rounded-md border border-border bg-muted/20 px-3 py-2 text-sm flex items-center gap-2"
          >
            {ctx ? (
              <div className="font-mono text-sm flex-1 min-w-0">
                <span className="font-semibold">{ctx.lead_count}</span> previous leads
                {" · "}<span className="font-semibold">{ctx.replied_count}</span> replied
                {ctx.response_rate_pct != null && (
                  <> · <span className="font-semibold">{Math.round(ctx.response_rate_pct)}%</span> response rate</>
                )}
                {" · "}
                {priorBits.length
                  ? <>prior work: <span className="font-semibold">{priorBits.join(", ")}</span></>
                  : <span className="text-muted-foreground">no work history</span>}
              </div>
            ) : (
              <div className="flex-1 min-w-0 text-muted-foreground italic">First contact with this company</div>
            )}
            <ChevronRight
              className="w-4 h-4 shrink-0 transition-transform"
              style={{ color: "#3D89DA", transform: expanded ? "rotate(90deg)" : "none" }}
            />
          </button>

          {expanded && ctx && (
            <div id="lead-card-context-panel" className="mt-2 space-y-4">
              {/* 4a — work with this company */}
              <div className="rounded-md border border-border bg-muted/10 px-3 py-3">
                <div className="flex items-baseline justify-between gap-3 mb-2">
                  <div className="font-mono uppercase text-[10.5px] tracking-[0.13em] text-muted-foreground">
                    Work with this company
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono">
                    {ctx.deal_count} projects, most recent first
                  </div>
                </div>
                {work.length === 0 ? (
                  <div className="text-sm text-muted-foreground italic">
                    No projects with this company yet — this is a first approach.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono">
                      <tbody>
                        {work.map((w, i) => (
                          <tr key={i} className="border-t border-border/50">
                            <td className="py-1.5 pr-3">{w.project || "—"}</td>
                            <td className="py-1.5 pr-3 text-muted-foreground">{w.contact || "—"}</td>
                            <td className="py-1.5 pr-3"><StageBadge label={w.stage_label} /></td>
                            <td className="py-1.5 pr-3 text-muted-foreground whitespace-nowrap">
                              {w.closing_date ? `${w.is_forecast ? "due " : ""}${monthYear(w.closing_date)}` : "—"}
                            </td>
                            <td className="py-1.5 text-right whitespace-nowrap">{money(w.contract_value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 4b — block E composer */}
              {work.length > 0 && ctx.block_e && (
                <div
                  className="rounded-lg"
                  style={{
                    background: "rgba(61,137,218,0.09)",
                    border: "1px solid rgba(61,137,218,0.30)",
                    padding: "13px 14px",
                  }}
                >
                  <div
                    className="font-mono uppercase text-[10.5px] tracking-[0.13em] mb-3"
                    style={{ color: "#8fb8e4" }}
                  >
                    What the EOI will say
                  </div>
                  <div className="space-y-2">
                    <SlotRow label="Mention" slot={slots[0]} work={work}
                      onChange={(s) => setSlots((p) => [s, p[1]])} />
                    <SlotRow label="and" slot={slots[1]} work={work}
                      onChange={(s) => setSlots((p) => [p[0], s])} />
                  </div>
                  <div
                    className="mt-3 rounded-md px-3 py-2 text-sm"
                    style={{ background: "rgba(3,8,15,0.55)", border: "1px solid rgba(61,137,218,0.22)" }}
                  >
                    {preview
                      ? <span>{preview}</span>
                      : <span className="italic text-muted-foreground">Nothing selected — the EOI goes out without this paragraph.</span>}
                  </div>
                </div>
              )}

              {/* 4c — previous leads */}
              <div className="rounded-md border border-border bg-muted/10 px-3 py-3">
                <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
                  <div className="font-mono uppercase text-[10.5px] tracking-[0.13em] text-muted-foreground">
                    Previous leads
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    reply dates are real; send dates start recording from now
                  </div>
                </div>
                {prevLeads.length === 0 ? (
                  <div className="text-sm text-muted-foreground italic">No other leads for this company.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono">
                      <tbody>
                        {prevLeads.map((l) => (
                          <tr key={l.lead_id} className="border-t border-border/50">
                            <td className="py-1.5 pr-3">{l.project || "—"}</td>
                            <td className="py-1.5 pr-3 whitespace-nowrap">
                              {l.emailed_at
                                ? `emailed ${dayMonthYear(l.emailed_at)}`
                                : <span className="text-muted-foreground">send not recorded</span>}
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
            </div>
          )}
        </div>

        {lead.notes && (
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1">Notes</div>
            <div className="text-sm whitespace-pre-wrap">{lead.notes}</div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-2">
          <Button size="lg" className="min-h-[44px]" onClick={findDetails} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
            {busy ? "Searching Apollo…" : "Find Details"}
          </Button>
          {hasEmail && (
            <Button size="lg" variant="secondary" className="min-h-[44px]" onClick={() => setStepOpen(true)} disabled={busy}>
              <Clock className="w-4 h-4 mr-1" /> Set Next Step
            </Button>
          )}
          <Button
            size="lg"
            variant="outline"
            className={`min-h-[44px] ${hasEmail ? "" : "md:col-start-3"}`}
            onClick={() => next()}
            disabled={busy}
          >
            <SkipForward className="w-4 h-4 mr-1" /> Skip
          </Button>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => next(false)} disabled={busy}>Next lead →</Button>
        </div>
      </Card>

      <SetNextStepDialog
        open={stepOpen}
        onOpenChange={setStepOpen}
        lead={lead}
        operator={operator}
        priorWorkSlots={priorWorkSlots}
        onSaved={() => { setStepOpen(false); reload(); next(); }}
      />
    </div>
  );
}
