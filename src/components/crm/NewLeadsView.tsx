import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Phone, SkipForward, Sparkles, Loader2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { enrichLead, Lead, useCrmRefs } from "@/hooks/useCrmLeads";
import { useToast } from "@/hooks/use-toast";
import SetNextStepDialog from "./SetNextStepDialog";

const db = supabase as any;

interface CompanyHistory {
  total_leads: number; converted: number; ever_responded: number;
  response_rate_pct: number; conversion_rate_pct: number; last_contacted: string | null;
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-AU", { month: "short", year: "numeric" });
}
function formatTs(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-AU");
}

export function useNewLeads() {
  const [rows, setRows] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await db
      .from("leads")
      .select("*")
      .in("stage", ["new", "enriching"])
      .order("created_at", { ascending: true })
      .range(0, 4999);
    setRows((data as Lead[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  return { rows, loading, reload: load };
}

export default function NewLeadsView({ operator }: { operator: string }) {
  const refs = useCrmRefs();
  const { rows, loading, reload } = useNewLeads();
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [busy, setBusy] = useState(false);
  const [stepOpen, setStepOpen] = useState(false);
  const [history, setHistory] = useState<CompanyHistory | null>(null);
  const { toast } = useToast();

  const lead = rows[idx];

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

  const hasContactDetails = useMemo(() => {
    if (!lead) return false;
    return !!(lead.project_contact_name || lead.role || lead.direct_email || lead.phone);
  }, [lead]);

  const hasEmail = !!lead?.direct_email;

  function next(bump = true) {
    if (bump) setProgress((p) => ({ ...p, done: p.done + 1 }));
    setIdx((i) => i + 1);
  }

  async function findDetails() {
    if (!lead || busy) return;
    setBusy(true);
    try {
      const r = await enrichLead(lead.id, operator, "full");
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
        </div>

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
        onSaved={() => { setStepOpen(false); reload(); next(); }}
      />
    </div>
  );
}
