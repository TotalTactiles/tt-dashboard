import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Phone, Mail, SkipForward, PhoneOff, Clock } from "lucide-react";
import { bandFor, claimLead, Lead, releaseClaim, useCrmRefs, useLeadQueue } from "@/hooks/useCrmLeads";
import LogCallDialog from "./LogCallDialog";
import SetNextStepDialog from "./SetNextStepDialog";

const db = supabase as any;

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-AU", { month: "short", year: "numeric" });
}

interface CompanyHistory {
  total_leads: number; converted: number; ever_responded: number;
  response_rate_pct: number; conversion_rate_pct: number; last_contacted: string | null;
}
interface SilenceRow {
  days_silent: number; silence_rule_code: string | null; silence_rule_label: string | null; action_prompt: string | null;
}
interface EventRow { id: number; kind: string; detail: string | null; occurred_at: string; }
interface CallRow { id: string; called_at: string; outcome_code: string; notes: string | null; }

export default function LeadQueue({ operator }: { operator: string }) {
  const refs = useCrmRefs();
  const { rows, loading, reload } = useLeadQueue(operator);
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [logOpen, setLogOpen] = useState(false);
  const [stepOpen, setStepOpen] = useState(false);
  const [badOpen, setBadOpen] = useState(false);
  const [badReason, setBadReason] = useState("");
  const [advanceEnabled, setAdvanceEnabled] = useState(false);

  const lead = rows[idx];

  // Session progress baseline
  useEffect(() => {
    if (rows.length && progress.total === 0) setProgress({ done: 0, total: rows.length });
  }, [rows.length, progress.total]);

  // Claim on lead change
  useEffect(() => {
    if (!lead || !operator) return;
    claimLead(lead.id, operator);
    setAdvanceEnabled(false);
  }, [lead?.id, operator]);

  // Side data
  const [history, setHistory] = useState<CompanyHistory | null>(null);
  const [silence, setSilence] = useState<SilenceRow | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [calls, setCalls] = useState<CallRow[]>([]);

  useEffect(() => {
    if (!lead) return;
    let cancel = false;
    (async () => {
      const [h, s, e, c] = await Promise.all([
        db.from("v_company_history").select("*").eq("company", lead.company_builder).maybeSingle(),
        db.from("v_lead_silence").select("*").eq("id", lead.id).maybeSingle(),
        db.from("lead_events").select("id,kind,detail,occurred_at").eq("lead_id", lead.id).eq("kind", "note").order("occurred_at", { ascending: false }).limit(3),
        db.from("lead_calls").select("id,called_at,outcome_code,notes").eq("lead_id", lead.id).order("called_at", { ascending: false }).limit(2),
      ]);
      if (cancel) return;
      setHistory(h.data ?? null);
      setSilence(s.data ?? null);
      setEvents(e.data ?? []);
      setCalls(c.data ?? []);
    })();
    return () => { cancel = true; };
  }, [lead?.id]);

  const band = useMemo(() => bandFor(lead?.rating_score, refs?.bands), [lead?.rating_score, refs?.bands]);
  const outcomeLabel = (code: string) => refs?.outcomes.find((o) => o.code === code)?.label ?? code;

  function next(bump = true) {
    if (bump) setProgress((p) => ({ ...p, done: p.done + 1 }));
    setIdx((i) => i + 1);
    setAdvanceEnabled(false);
  }

  async function skip() {
    if (!lead) return;
    await releaseClaim(lead.id);
    next(false);
  }

  async function markBad() {
    if (!lead || !badReason.trim()) return;
    const now = new Date().toISOString();
    await db.from("leads").update({ stage: "needs_attention", claimed_by: null, claimed_at: null }).eq("id", lead.id);
    await db.from("lead_events").insert({
      lead_id: lead.id, kind: "status_changed",
      detail: `Bad data / can't reach: ${badReason.trim()}`,
      occurred_at: now, created_by: operator,
    });
    setBadOpen(false); setBadReason("");
    next();
  }

  if (loading && !rows.length) {
    return <div className="p-8 text-sm text-muted-foreground font-mono">Loading queue…</div>;
  }

  if (!lead) {
    return (
      <Card className="p-10 text-center">
        <div className="text-lg font-mono uppercase tracking-wider mb-2">Queue empty</div>
        <p className="text-sm text-muted-foreground">No leads currently in <span className="font-mono">ready_to_call</span>.</p>
        <Button variant="outline" className="mt-4" onClick={reload}>Refresh</Button>
      </Card>
    );
  }

  const pct = progress.total ? Math.min(100, (progress.done / progress.total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Header strip */}
      <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">
        <span>Working as <span className="text-foreground font-semibold normal-case">{operator}</span></span>
        <span>·</span>
        <span>{rows.length - idx} leads in queue</span>
        <div className="flex-1 min-w-[120px]">
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <span className="normal-case">{progress.done}/{progress.total} done</span>
      </div>

      <Card className="p-6 space-y-6">
        {/* Company / project */}
        <div>
          <div className="flex items-start gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-mono font-semibold tracking-tight truncate">{lead.company_builder}</h1>
              <div className="text-base text-muted-foreground truncate">{lead.project_name || <span className="italic">No project name</span>}</div>
            </div>
            {lead.state && (
              <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded border border-border bg-muted/40">
                {lead.state}
              </span>
            )}
          </div>
        </div>

        {/* Rating */}
        <div>
          {band ? (
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded"
                style={{ backgroundColor: `${band.colour ?? "#3D89DA"}22`, color: band.colour ?? undefined, border: `1px solid ${band.colour ?? "#3D89DA"}55` }}
              >
                {band.label}
              </span>
              <span className="text-sm font-mono">{lead.rating_score}</span>
            </div>
          ) : (
            <span className="text-xs font-mono text-muted-foreground">Not yet rated</span>
          )}
          {lead.rating_reason && (
            <div className="text-xs text-muted-foreground mt-1">{lead.rating_reason}</div>
          )}
        </div>

        {/* Contact */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1">Contact</div>
            <div className="text-sm font-semibold">{lead.project_contact_name || <span className="text-muted-foreground italic">Not captured</span>}</div>
            {lead.role && <div className="text-xs text-muted-foreground">{lead.role}</div>}
            <div className="mt-2 space-y-1">
              {lead.phone && (
                <a href={`tel:${lead.phone}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <Phone className="w-3.5 h-3.5" /> {lead.phone}
                </a>
              )}
              {lead.direct_email && (
                <a href={`mailto:${lead.direct_email}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <Mail className="w-3.5 h-3.5" /> {lead.direct_email}
                </a>
              )}
            </div>
          </div>
          {(!lead.direct_email && (lead.reception_name || lead.reception_email)) && (
            <div className="border-l border-border pl-4">
              <div className="text-[10px] uppercase tracking-widest text-chart-orange font-mono mb-1">Reception only</div>
              {lead.reception_name && <div className="text-sm">{lead.reception_name}</div>}
              {lead.reception_email && (
                <a href={`mailto:${lead.reception_email}`} className="flex items-center gap-2 text-xs text-primary hover:underline mt-1">
                  <Mail className="w-3 h-3" /> {lead.reception_email}
                </a>
              )}
            </div>
          )}
        </div>

        {/* Company history — the flagship line */}
        <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
          {history && history.total_leads > 0 ? (
            <div className="font-mono text-sm">
              <span className="font-semibold">{history.total_leads}</span> previous leads
              {" · "}<span className="font-semibold">{history.converted}</span> converted
              {" · "}<span className="font-semibold">{Math.round(history.response_rate_pct)}%</span> response rate
              {history.last_contacted && <> · last contacted <span className="font-semibold">{formatDate(history.last_contacted)}</span></>}
            </div>
          ) : (
            <div className="text-muted-foreground italic">First contact with this company</div>
          )}
        </div>

        {/* Silence banner */}
        {silence?.silence_rule_code && silence.action_prompt && (
          <div className="rounded-md border border-chart-orange/40 bg-chart-orange/10 px-3 py-2 flex items-start gap-2 text-sm text-chart-orange">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold">{silence.days_silent}d silent — {silence.silence_rule_label}</div>
              <div className="text-xs opacity-90">{silence.action_prompt}</div>
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-2">Notes & recent activity</div>
          {lead.notes && <div className="text-sm mb-3 whitespace-pre-wrap">{lead.notes}</div>}
          <div className="space-y-2">
            {events.map((e) => (
              <div key={e.id} className="text-xs border-l-2 border-border pl-2">
                <span className="text-muted-foreground font-mono">{new Date(e.occurred_at).toLocaleDateString("en-AU")}</span>
                <span className="ml-2">{e.detail}</span>
              </div>
            ))}
            {calls.map((c) => (
              <div key={c.id} className="text-xs border-l-2 border-primary/40 pl-2">
                <span className="text-muted-foreground font-mono">{new Date(c.called_at).toLocaleDateString("en-AU")}</span>
                <span className="ml-2 font-semibold">{outcomeLabel(c.outcome_code)}</span>
                {c.notes && <span className="ml-2 text-muted-foreground">— {c.notes}</span>}
              </div>
            ))}
            {!events.length && !calls.length && !lead.notes && (
              <div className="text-xs text-muted-foreground italic">No prior activity</div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2">
          <Button size="lg" className="min-h-[44px]" onClick={() => setLogOpen(true)}>
            <Phone className="w-4 h-4 mr-1" /> Log Call
          </Button>
          <Button size="lg" variant="secondary" className="min-h-[44px]" onClick={() => setStepOpen(true)}>
            <Clock className="w-4 h-4 mr-1" /> Set Next Step
          </Button>
          <Button size="lg" variant="outline" className="min-h-[44px]" onClick={skip}>
            <SkipForward className="w-4 h-4 mr-1" /> Skip
          </Button>
          <Button size="lg" variant="outline" className="min-h-[44px] text-chart-orange border-chart-orange/40 hover:bg-chart-orange/10" onClick={() => setBadOpen(true)}>
            <PhoneOff className="w-4 h-4 mr-1" /> Can't reach
          </Button>
        </div>

        <div className="flex justify-end pt-2">
          <Button disabled={!advanceEnabled} onClick={() => next()}>Next lead →</Button>
        </div>
      </Card>

      <LogCallDialog
        open={logOpen}
        onOpenChange={setLogOpen}
        lead={lead}
        operator={operator}
        onSaved={() => setAdvanceEnabled(true)}
      />
      <SetNextStepDialog
        open={stepOpen}
        onOpenChange={setStepOpen}
        lead={lead}
        operator={operator}
        onSaved={() => { setAdvanceEnabled(true); next(); reload(); }}
      />

      <Dialog open={badOpen} onOpenChange={setBadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Flag for attention</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Why is this lead unreachable or invalid?</p>
          <Textarea value={badReason} onChange={(e) => setBadReason(e.target.value)} rows={3} placeholder="Short reason (required)" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBadOpen(false)}>Cancel</Button>
            <Button disabled={!badReason.trim()} onClick={markBad}>Flag & move on</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
