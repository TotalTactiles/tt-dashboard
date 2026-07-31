import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Phone, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCrmRefs, type NextStepRow } from "@/hooks/useCrmLeads";
import { useToast } from "@/hooks/use-toast";
import {
  postOvenWebhook,
  isPlaceholderBuilder,
  DASH,
  fmtDay,
  useLeadCardContext,
} from "./NewLeadsView";

const db = supabase as any;

export interface ColdLead {
  id: string;
  company_builder: string;
  project_name: string | null;
  state: string | null;
  organisation_id: string | null;
  phone: string | null;
  call_number: string | null;
  callable: boolean | null;
  direct_email: string | null;
  project_contact_name: string | null;
  role: string | null;
  reception_name: string | null;
  notes: string | null;
  next_step_code: string | null;
  stage: string;
  attempts: number | null;
  last_called_at: string | null;
  last_outcome: string | null;
  next_callback_at: string | null;
  deals_completed: number | null;
  deals_live: number | null;
  prior_leads: number | null;
  claim_actor_id: string | null;
  claim_holder: string | null;
  claim_active: boolean | null;
  pass_no: number | null;
  bucket: number | null;
  lead_timezone: string | null;
}

export interface CallRow {
  id: string;
  lead_id: string;
  called_at: string;
  outcome_code: string;
  outcome_label: string | null;
  spoke_with: string | null;
  notes: string | null;
  created_by: string | null;
  is_contact: boolean | null;
}

export interface OutcomeRow {
  code: string;
  label: string;
  is_contact: boolean;
  sort_order: number;
}

/** Outcomes that can never produce an email, flagged in the UI. */
const NO_EMAIL_OUTCOMES = new Set([
  "callback_requested",
  "left_message",
  "no_answer",
  "not_interested",
  "wrong_number",
]);

// Which next steps a logged outcome can honestly support. This exists to stop a
// caller selecting a step the conversation does not support, which would corrupt
// the downstream email chain. Outcomes absent from this map get no next steps.
const NEXT_STEPS_BY_OUTCOME: Record<string, string[]> = {
  spoke_contact: ["eoi_sent", "ready_to_award", "nry_follow_up_later", "already_completed_future_work"],
  // No award decision comes from reception, so READY TO AWARD is not offered here.
  spoke_gatekeeper: ["eoi_sent", "nry_follow_up_later", "already_completed_future_work"],
};

const QUEUE_COLS =
  "id,company_builder,project_name,state,organisation_id,phone,call_number,callable,direct_email," +
  "project_contact_name,role,reception_name,notes,next_step_code,stage,attempts,last_called_at," +
  "last_outcome,next_callback_at,deals_completed,deals_live,prior_leads,claim_actor_id,claim_holder," +
  "claim_active,pass_no,bucket,lead_timezone";

export function useColdCallLeads() {
  const [rows, setRows] = useState<ColdLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await db
      .from("v_oven_call_queue")
      .select(QUEUE_COLS)
      .order("bucket")
      .order("pass_no")
      .order("id")
      .range(0, 4999);
    setRows((data as ColdLead[]) ?? []);
    setLoading(false);
    setTick((t) => t + 1);
  }, []);

  useEffect(() => { load(); }, [load]);
  // calls is kept for the existing call signature; call detail is now fetched
  // lazily for the current lead only.
  return { rows, calls: {} as Record<string, CallRow[]>, loading, reload: load, tick };
}

function useOutcomes() {
  const [rows, setRows] = useState<OutcomeRow[]>([]);
  useEffect(() => {
    let cancel = false;
    db.from("lead_call_outcomes").select("code,label,is_contact,sort_order").eq("is_active", true).order("sort_order")
      .then((r: any) => { if (!cancel) setRows((r?.data as OutcomeRow[]) ?? []); });
    return () => { cancel = true; };
  }, []);
  return rows;
}

/** Full call history for one lead, fetched only for the current lead. */
function useLeadCalls(leadId: string | null, tick: number) {
  const [rows, setRows] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!leadId) { setRows([]); return; }
    let cancel = false;
    setLoading(true);
    db.from("v_lead_calls")
      .select("id,lead_id,called_at,outcome_code,outcome_label,spoke_with,notes,created_by,is_contact")
      .eq("lead_id", leadId)
      .order("called_at", { ascending: false })
      .then((r: any) => {
        if (cancel) return;
        setRows((r?.data as CallRow[]) ?? []);
        setLoading(false);
      });
    return () => { cancel = true; };
  }, [leadId, tick]);

  return { rows, loading };
}

const INPUT_CLS =
  "w-full bg-transparent border border-border rounded px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1">{label}</div>
      {children}
    </div>
  );
}

/**
 * The full picture for a builder: deals, contacts on file and previous leads.
 * Mounted only when the dropdown is opened, so the fetch happens on open.
 */
function LeadHistoryStrip({ organisationId, leadId }: { organisationId: string | null; leadId: string }) {
  const { ctx, error, loading } = useLeadCardContext(organisationId);

  if (loading) return <div className="text-xs font-mono text-muted-foreground italic">Loading the full picture...</div>;
  if (error) {
    return (
      <div className="text-xs font-mono" style={{ color: "#e5934b" }}>
        The history for this builder could not be loaded. Do not treat this as a first approach.
      </div>
    );
  }
  if (!organisationId || !ctx) {
    return <div className="text-xs font-mono text-muted-foreground italic">First contact with this company.</div>;
  }

  const work = ctx.work ?? [];
  const prevLeads = (ctx.leads ?? []).filter((l) => l.lead_id !== leadId);

  return (
    <div className="space-y-3">
      <div className="font-mono text-xs">
        <span className="font-semibold">{ctx.deal_count}</span> deals
        {", "}<span className="font-semibold">{ctx.completed_count}</span> completed
        {", "}<span className="font-semibold">{ctx.live_count}</span> live
        {", "}<span className="font-semibold">{ctx.lead_count}</span> previous leads
        {", "}<span className="font-semibold">{ctx.replied_count}</span> replied
      </div>

      {work.length > 0 && (
        <div className="overflow-x-auto">
          <div className="font-mono uppercase text-[10.5px] tracking-[0.13em] text-muted-foreground mb-1">Deals and contacts on file</div>
          <table className="w-full text-xs font-mono">
            <tbody>
              {work.map((w, i) => (
                <tr key={i} className="border-t border-border/50">
                  <td className="py-1.5 pr-3">{w.project || DASH}</td>
                  <td className="py-1.5 pr-3 text-muted-foreground">{w.contact || DASH}</td>
                  <td className="py-1.5 pr-3 text-muted-foreground">{w.stage_label || DASH}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
                  <td className="py-1.5 pr-3 text-muted-foreground">{l.stage || DASH}</td>
                  <td className="py-1.5 whitespace-nowrap text-muted-foreground">
                    {l.responded_at ? `replied ${fmtDay(l.responded_at)}` : l.emailed_at ? `emailed ${fmtDay(l.emailed_at)}` : "no contact recorded"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {work.length === 0 && prevLeads.length === 0 && (
        <div className="text-xs font-mono text-muted-foreground italic">Nothing else on file for this builder.</div>
      )}
    </div>
  );
}

export default function ColdCallView({
  operator, rows, loading, reload,
}: {
  operator: string;
  rows: ColdLead[];
  calls?: Record<string, CallRow[]>;
  loading: boolean;
  reload: () => Promise<void> | void;
}) {
  // Leads the operator has logged a call against in this session. The queue
  // order is the point, so there is no jumping around it.
  const [worked, setWorked] = useState<string[]>([]);
  const workedSet = useMemo(() => new Set(worked), [worked]);

  const current = useMemo(() => rows.find((l) => !workedSet.has(l.id)) ?? null, [rows, workedSet]);
  const upcoming = useMemo(() => {
    if (!current) return [];
    const i = rows.findIndex((l) => l.id === current.id);
    return rows.slice(i + 1).filter((l) => !workedSet.has(l.id));
  }, [rows, current, workedSet]);

  const [showAll, setShowAll] = useState(false);
  const displayUpcoming = showAll ? upcoming : upcoming.slice(0, 30);

  const done = worked.length;
  const total = rows.length;


  return (
    <div className="space-y-3">
      <div className="text-xs font-mono text-muted-foreground tabular-nums">
        {done} of {total} worked
      </div>

      {loading && !rows.length && (
        <div className="rounded-md border border-border bg-card px-3 py-8 text-center text-sm text-muted-foreground">
          Loading cold call queue...
        </div>
      )}

      {!loading && !current && (
        <div className="rounded-md border border-border bg-card px-3 py-8 text-center text-sm text-muted-foreground">
          {total === 0 ? "Nothing to call." : "Every lead in the queue has been worked this session."}
        </div>
      )}

      {current && (
        <ColdCallCard
          key={current.id}
          lead={current}
          operator={operator}
          onLogged={() => setWorked((w) => (w.includes(current.id) ? w : [...w, current.id]))}
          onDone={async () => { await reload(); }}
        />
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
                <th className="text-left px-2 py-2">Phone</th>
                <th className="text-left px-3 py-2">Last outcome</th>
              </tr>
            </thead>
            <tbody>
              {displayUpcoming.length === 0 && (
                <tr><td colSpan={5} className="text-center py-6 text-muted-foreground text-sm">Nothing else queued.</td></tr>
              )}
              {displayUpcoming.map((l, i) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">{i + 2}</td>
                  <td className="px-2 py-2">{l.company_builder || DASH}</td>
                  <td className="px-2 py-2 text-muted-foreground">{l.project_name || DASH}</td>
                  <td className="px-2 py-2 font-mono text-xs">
                    {l.call_number || <span className="text-muted-foreground">no number</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {l.last_outcome
                      ? `${l.last_outcome}${l.last_called_at ? ` - ${fmtDay(l.last_called_at)}` : ""}`
                      : "not called yet"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {upcoming.length > 30 && (
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-muted-foreground">
          <span>Showing {displayUpcoming.length} of {upcoming.length} still to call.</span>
          <Button size="sm" variant="outline" onClick={() => setShowAll(!showAll)}>
            {showAll ? "Show 30" : "Show all"}
          </Button>
        </div>
      )}
    </div>
  );
}


function ColdCallCard({
  lead, operator, onDone, onLogged,
}: {
  lead: ColdLead;
  operator: string;
  onDone: () => Promise<void>;
  onLogged: () => void;
}) {
  const outcomes = useOutcomes();
  const refs = useCrmRefs();
  const { ctx, error: ctxError } = useLeadCardContext(lead.organisation_id);
  const { toast } = useToast();

  const [historyTick, setHistoryTick] = useState(0);
  const { rows: history } = useLeadCalls(lead.id, historyTick);

  const [outcome, setOutcome] = useState<string>("");
  const [spokeTo, setSpokeTo] = useState("");
  const [contactName, setContactName] = useState(lead.project_contact_name ?? "");
  const [contactRole, setContactRole] = useState(lead.role ?? "");
  const [contactEmail, setContactEmail] = useState(lead.direct_email ?? "");
  const [contactPhone, setContactPhone] = useState("");
  const [callbackAt, setCallbackAt] = useState("");
  const [bestTime, setBestTime] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [notes, setNotes] = useState("");
  const [messageLeft, setMessageLeft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [pictureOpen, setPictureOpen] = useState(false);
  const [lookup, setLookup] = useState<{ saved: boolean; phone: string | null; reason: string | null } | null>(null);
  // Set only once an insert into lead_calls has succeeded for this lead.
  const [loggedOutcome, setLoggedOutcome] = useState<string | null>(null);


  const isGatekeeper = outcome === "spoke_gatekeeper";
  const isContactOutcome = outcome === "spoke_contact";
  const needsCallback = outcome === "callback_requested";
  const needsMessage = outcome === "left_message";

  const gaps: string[] = [];
  if (isContactOutcome) {
    if (!contactName.trim()) gaps.push("contact name");
    if (!contactEmail.trim()) gaps.push("email");
  }
  if (isGatekeeper && !spokeTo.trim()) gaps.push("who you spoke to");
  if (needsCallback && !callbackAt) gaps.push("a callback time");
  if (needsMessage && !messageLeft.trim()) gaps.push("what you said in the message");
  const captureIncomplete = gaps.length > 0;

  // Only ever a company switchboard, never a personal number, and only a number
  // the workflow actually saved.
  const savedLookupPhone = lookup?.saved ? lookup.phone : null;
  const callable = lead.callable !== false && !!lead.call_number;
  const displayPhone = callable ? lead.call_number : savedLookupPhone;
  const attempts = Number(lead.attempts ?? 0);
  const attemptChip = attempts === 0 ? "first call" : `attempt ${attempts + 1}`;

  async function findCompanyLine() {
    if (busy) return;
    setBusy("company_phone");
    const r = await postOvenWebhook("tt-company-phone", { lead_id: lead.id, operator });
    setBusy(null);
    const body: any = r.body ?? {};
    if (r.blocked || (!r.ok && !body.reason)) {
      toast({
        title: "Blocked",
        description: r.reason,
        className: "border-chart-orange/40 bg-chart-orange/10 text-chart-orange",
      });
      return;
    }
    const saved = !!body.saved;
    setLookup({ saved, phone: saved ? (body.phone ?? null) : null, reason: body.reason ?? body.note ?? r.reason ?? null });
    await onDone();
  }

  const steps: NextStepRow[] = useMemo(
    () => (refs?.nextSteps ?? []).filter((s) => !s.is_system && s.applies_to_stage === "ready_to_call"),
    [refs],
  );

  const stepsForOutcome = useCallback(
    (outcomeCode: string | null): NextStepRow[] => {
      if (!outcomeCode) return [];
      const allowed = NEXT_STEPS_BY_OUTCOME[outcomeCode];
      if (!allowed?.length) return [];
      const hasEmail = !!contactEmail.trim();
      return steps.filter((s) => allowed.includes(s.code) && (!s.requires_email || hasEmail));
    },
    [steps, contactEmail],
  );

  const applicableSteps = useMemo(
    () => stepsForOutcome(loggedOutcome),
    [stepsForOutcome, loggedOutcome],
  );


  const askFor = lead.project_contact_name || lead.reception_name || null;

  const opener = useMemo(() => {
    const work = (ctx?.work ?? []).filter((w) => w.project && w.stage_label !== "Lost/Dead");
    if (!work.length) return null;
    const names = work.slice(0, 2).map((w) => w.project).filter(Boolean).join(" and ");
    return `We have worked with you on ${names} - I am calling about ${lead.project_name || "a new project"}.`;
  }, [ctx, lead.project_name]);

  function missingFor(s: NextStepRow): string[] {
    const missing: string[] = [];
    if (s.requires_email && !contactEmail.trim()) missing.push("email");
    if ((s as any).requires_contact_name && !contactName.trim()) missing.push("contact name");
    if ((s as any).requires_conversation && !(isContactOutcome || isGatekeeper)) missing.push("a logged conversation");
    if ((s as any).requires_follow_up_date && !followUp) missing.push("follow-up date");
    if ((s as any).requires_note && !notes.trim()) missing.push("a note");
    if (s.requires_state && !lead.state) missing.push("state");
    return missing;
  }

  async function logCall() {
    if (!outcome || busy || captureIncomplete) return;
    setBusy("call");
    const parts: string[] = [];
    if (needsMessage && messageLeft.trim()) parts.push(`Message: ${messageLeft.trim()}`);
    if (needsCallback && bestTime.trim()) parts.push(`Best time: ${bestTime.trim()}`);
    if (notes.trim()) parts.push(notes.trim());
    // spoke_with is the person who answered the phone (the receptionist), which
    // renders as {{receptionist}} in the EOI. It is never the contact name.
    const payload: any = {
      lead_id: lead.id,
      called_at: new Date().toISOString(),
      outcome_code: outcome,
      spoke_with: isGatekeeper ? spokeTo.trim() || null : null,
      notes: parts.length ? parts.join("\n") : null,
      created_by: operator,
      contact_name: contactName.trim() || null,
      contact_role: contactRole.trim() || null,
      contact_email: contactEmail.trim() || null,
      contact_phone: contactPhone.trim() || null,
      callback_at: callbackAt ? new Date(callbackAt).toISOString() : null,
    };
    const { error } = await db.from("lead_calls").insert(payload);
    setBusy(null);
    if (error) {
      toast({
        title: "Could not log the call",
        description: error.message ?? "Nothing was saved.",
        className: "border-chart-orange/40 bg-chart-orange/10 text-chart-orange",
      });
      return;
    }
    toast({ title: "Call logged" });
    setHistoryTick((t) => t + 1);
    setLoggedOutcome(outcome);
    // Stay on the lead when a next step is possible, otherwise move on.
    if (stepsForOutcome(outcome).length === 0) onLogged();
    await onDone();
  }


  async function applyStep(s: NextStepRow) {
    if (busy) return;
    setBusy(s.code);
    const patch: any = { next_step_code: s.code };
    if (contactName.trim()) patch.project_contact_name = contactName.trim();
    if (contactRole.trim()) patch.role = contactRole.trim();
    if (contactEmail.trim()) patch.direct_email = contactEmail.trim().toLowerCase();
    if (followUp) patch.follow_up_date = followUp;
    await db.from("leads").update(patch).eq("id", lead.id);

    const r = await postOvenWebhook("tt-lead-send", { lead_id: lead.id, operator });
    setBusy(null);
    if (r.blocked) {
      toast({
        title: "Blocked",
        description: r.reason,
        className: "border-chart-orange/40 bg-chart-orange/10 text-chart-orange",
      });
    } else if (!r.ok) {
      toast({
        title: "Next step saved, but the send workflow did not complete",
        description: r.reason,
        className: "border-chart-orange/40 bg-chart-orange/10 text-chart-orange",
      });
    } else {
      toast({ title: `${s.label} recorded` });
    }
    await onDone();
  }

  return (
    <div className="rounded-md border border-border bg-card p-4 space-y-4">
      {/* who and where */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xl font-semibold leading-tight">
            <Link to={`/crm/lead/${lead.id}`} className="hover:underline">
              {isPlaceholderBuilder(lead.company_builder)
                ? <span style={{ color: "#e5934b" }}>{lead.company_builder || "no builder"}</span>
                : (lead.company_builder || DASH)}
            </Link>
          </div>
          <div className="text-sm text-muted-foreground">{lead.project_name || DASH}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {lead.state && (
            <span className="rounded border border-border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground">
              {lead.state}
            </span>
          )}
          <span className="rounded border border-border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground">
            {attemptChip}
          </span>
        </div>
      </div>

      {/* call it */}
      <div className="rounded-md border border-border bg-muted/10 px-3 py-3 space-y-2">
        {displayPhone ? (
          <a
            href={`tel:${displayPhone}`}
            className="inline-flex items-center gap-2 text-2xl font-mono font-semibold text-primary hover:underline"
          >
            <Phone className="w-5 h-5" /> {displayPhone}
          </a>
        ) : (
          <div className="space-y-2">
            <div className="text-sm italic" style={{ color: "#e5934b" }}>no number on file</div>
            {/* Company switchboard only. Never an individual's mobile or direct line. */}
            <Button size="sm" variant="outline" disabled={busy === "company_phone"} onClick={findCompanyLine}>
              {busy === "company_phone"
                ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                : <Search className="w-3.5 h-3.5 mr-1" />}
              Find the company main line
            </Button>
            <div className="text-[11px] font-mono text-muted-foreground">
              Publicly listed switchboard for the builder only. It returns nothing rather than guess.
            </div>
            {lookup && !lookup.saved && (
              <div className="text-xs font-mono" style={{ color: "#e5934b" }}>
                {lookup.reason || "No company main line could be verified."}
              </div>
            )}
          </div>
        )}
        {displayPhone && lookup?.saved && lookup.reason && (
          <div className="text-xs font-mono text-muted-foreground">{lookup.reason}</div>
        )}

        <div className="text-sm">
          <span className="text-muted-foreground font-mono text-[10.5px] uppercase tracking-widest mr-2">Ask for</span>
          {askFor ? <span className="font-semibold">{askFor}{lead.role ? ` - ${lead.role}` : ""}</span>
                  : <span className="text-muted-foreground italic">whoever handles the tender</span>}
        </div>

        {ctxError ? (
          <div className="text-xs font-mono" style={{ color: "#e5934b" }}>
            Prior work could not be loaded, so this opener may be incomplete.
          </div>
        ) : opener ? (
          <div
            className="rounded-md px-3 py-2 text-sm"
            style={{ background: "rgba(61,137,218,0.09)", border: "1px solid rgba(61,137,218,0.30)" }}
          >
            {opener}
          </div>
        ) : null}

        {/* the full picture - collapsed by default, fetched only when opened */}
        <div className="pt-1">
          <button
            className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground"
            onClick={() => setPictureOpen((v) => !v)}
          >
            {pictureOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            The full picture
          </button>
          {pictureOpen && (
            <div className="mt-2 rounded-md border border-border/60 px-3 py-2">
              <LeadHistoryStrip organisationId={lead.organisation_id} leadId={lead.id} />
            </div>
          )}
        </div>
      </div>

      {/* previous calls */}
      <div className="rounded-md border border-border bg-muted/10 px-3 py-3">
        <div className="font-mono uppercase text-[10.5px] tracking-[0.13em] text-muted-foreground mb-2">Previous calls</div>
        {history.length === 0 ? (
          <div className="text-sm text-muted-foreground italic">No calls logged yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <tbody>
                {history.map((c) => (
                  <tr key={c.id} className="border-t border-border/50">
                    <td className="py-1.5 pr-3 whitespace-nowrap">{fmtDay(c.called_at)}</td>
                    <td className="py-1.5 pr-3">{c.outcome_label ?? c.outcome_code}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground">{c.spoke_with || DASH}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground">{c.notes || DASH}</td>
                    <td className="py-1.5 text-right text-muted-foreground whitespace-nowrap">{c.created_by || DASH}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* outcome + capture */}
      <div className="rounded-md border border-border bg-muted/10 px-3 py-3 space-y-3">
        <div className="font-mono uppercase text-[10.5px] tracking-[0.13em] text-muted-foreground">Outcome</div>
        <div className="flex flex-wrap gap-2">
          {outcomes.map((o) => (
            <Button
              key={o.code}
              size="sm"
              variant={outcome === o.code ? "default" : "outline"}
              onClick={() => setOutcome(outcome === o.code ? "" : o.code)}
            >
              {o.label}
              {NO_EMAIL_OUTCOMES.has(o.code) && (
                <span className="ml-2 text-[9px] font-mono uppercase tracking-widest opacity-70">no email</span>
              )}
            </Button>
          ))}
        </div>

        {!outcome ? (
          <div className="text-xs font-mono text-muted-foreground italic">
            Pick an outcome and the fields that matter will appear.
          </div>
        ) : (
          <>
            {(isGatekeeper || isContactOutcome) && (
              <div className="grid gap-3 md:grid-cols-2">
                {isGatekeeper && (
                  <Field label="Spoke to (who answered)">
                    <input
                      className={INPUT_CLS}
                      placeholder="Receptionist or whoever picked up"
                      value={spokeTo}
                      onChange={(e) => setSpokeTo(e.target.value)}
                    />
                  </Field>
                )}
                <Field label={isContactOutcome ? "Contact name (required)" : "Contact name"}>
                  <input className={INPUT_CLS} value={contactName} onChange={(e) => setContactName(e.target.value)} />
                </Field>
                <Field label="Role">
                  <input className={INPUT_CLS} value={contactRole} onChange={(e) => setContactRole(e.target.value)} />
                </Field>
                <Field label={isContactOutcome ? "Email (required)" : "Email"}>
                  <input className={INPUT_CLS} value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
                </Field>
                <Field label="Direct phone">
                  <input className={INPUT_CLS} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
                </Field>
              </div>
            )}

            {needsCallback && (
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Callback at (required)">
                  <input type="datetime-local" className={INPUT_CLS} value={callbackAt} onChange={(e) => setCallbackAt(e.target.value)} />
                </Field>
                <Field label="Best time">
                  <input className={INPUT_CLS} placeholder="e.g. mornings before 10" value={bestTime} onChange={(e) => setBestTime(e.target.value)} />
                </Field>
              </div>
            )}

            {needsMessage && (
              <Field label="Message left (required)">
                <input
                  className={INPUT_CLS}
                  placeholder="What you actually said, e.g. asked reception to pass on that we tender tactiles for Stage 2"
                  value={messageLeft}
                  onChange={(e) => setMessageLeft(e.target.value)}
                />
              </Field>
            )}

            {(isGatekeeper || isContactOutcome) && (
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Follow-up date">
                  <input type="date" className={INPUT_CLS} value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
                </Field>
              </div>
            )}

            <Field label="Notes">
              <textarea className={INPUT_CLS} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </>
        )}

        <div className="flex items-center gap-3">
          <Button size="sm" disabled={!outcome || captureIncomplete || busy === "call"} onClick={logCall}>
            {busy === "call" ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
            Log it and move on
          </Button>

          {!outcome && <span style={{ color: "#e5934b", fontSize: "11.5px" }}>Pick an outcome to log the call</span>}
          {outcome && captureIncomplete && (
            <span style={{ color: "#e5934b", fontSize: "11.5px" }}>Needs {gaps.join(", ")}</span>
          )}
        </div>
      </div>

      {/* next step - only once a call has been logged and the outcome supports one */}
      {loggedOutcome && applicableSteps.length > 0 && (
        <div className="rounded-md border border-border bg-muted/10 px-3 py-3 space-y-2">
          <div className="font-mono uppercase text-[10.5px] tracking-[0.13em] text-muted-foreground">Next step</div>
          <div className="space-y-2">
            {applicableSteps.map((s) => {
              const missing = missingFor(s);
              return (
                <div key={s.code} className="flex flex-wrap items-center gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={missing.length > 0 || busy === s.code}
                    onClick={() => applyStep(s)}
                  >
                    {busy === s.code ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
                    {s.label}
                  </Button>
                  {missing.length > 0 && (
                    <span style={{ color: "#e5934b", fontSize: "11.5px" }}>Needs {missing.join(", ")}</span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="pt-1">
            <Button size="sm" variant="ghost" onClick={onLogged}>Next lead</Button>
          </div>
        </div>
      )}
    </div>
  );
}
