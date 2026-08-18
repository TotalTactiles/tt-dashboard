import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { bandFor, Lead, useCrmRefs } from "@/hooks/useCrmLeads";
import { AlertTriangle, ExternalLink } from "lucide-react";

const db = supabase as any;
const DASH = "-";

function useLead(id: string | null) {
  const [lead, setLead] = useState<Lead | null>(null);
  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await db.from("leads").select("*").eq("id", id).maybeSingle();
    setLead(data ?? null);
  }, [id]);
  useEffect(() => { load(); }, [load]);
  return { lead, reload: load, setLead };
}

function ReadField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">{label}</div>
      <div className="text-sm mt-0.5 break-words">{value?.trim() ? value : <span className="text-muted-foreground/60">{DASH}</span>}</div>
    </div>
  );
}

/**
 * Read-only preview of a lead. Every write path lives on the full profile
 * page at /crm/lead/:id, so this drawer holds no inputs and no writes.
 */
export default function LeadDrawer({
  leadId, open, onOpenChange, operator, onDeleted,
}: { leadId: string | null; open: boolean; onOpenChange: (v: boolean) => void; operator: string; onDeleted?: () => void }) {
  const refs = useCrmRefs();
  const { lead } = useLead(leadId);
  const [history, setHistory] = useState<any | null>(null);
  const [silence, setSilence] = useState<any | null>(null);
  const [incomplete, setIncomplete] = useState<string[] | null>(null);

  const load = useCallback(async () => {
    if (!leadId || !lead) return;
    const [h, s, inc] = await Promise.all([
      db.from("v_company_history").select("*").eq("company", lead.company_builder).maybeSingle(),
      db.from("v_lead_silence").select("*").eq("id", leadId).maybeSingle(),
      db.from("v_leads_incomplete").select("missing_fields").eq("id", leadId).maybeSingle(),
    ]);
    setHistory(h.data ?? null); setSilence(s.data ?? null);
    setIncomplete(inc.data?.missing_fields ?? null);
  }, [leadId, lead?.company_builder]);

  useEffect(() => { load(); }, [load]);

  if (!lead) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto" />
      </Sheet>
    );
  }

  const band = bandFor(lead.rating_score, refs?.bands);
  const statusLabel = refs?.statuses.find((s) => s.code === lead.status_code)?.label ?? lead.status_code ?? DASH;
  const sourceLabel = refs?.sources.find((s) => s.code === lead.source_code)?.label ?? lead.source_code ?? DASH;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-mono">{lead.company_builder}</SheetTitle>
          <div className="text-sm text-muted-foreground">{lead.project_name}</div>
        </SheetHeader>

        <div className="mt-4">
          <Link
            to={`/crm/lead/${lead.id}`}
            className="inline-flex items-center gap-2 rounded-md border border-primary/50 bg-primary/10 px-3 py-2 text-sm font-mono uppercase tracking-widest text-primary hover:bg-primary/20"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Open full profile
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
          {/* Left rail */}
          <div className="space-y-3">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Rating</div>
              {band ? (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] px-2 py-0.5 rounded font-mono uppercase"
                        style={{ backgroundColor: `${band.colour ?? "#3D89DA"}22`, color: band.colour ?? undefined, border: `1px solid ${band.colour ?? "#3D89DA"}55` }}>
                    {band.label}
                  </span>
                  <span className="text-sm font-mono">{lead.rating_score}</span>
                </div>
              ) : <div className="text-xs text-muted-foreground mt-1">Not yet rated</div>}
              {lead.rating_reason && <div className="text-xs text-muted-foreground mt-1">{lead.rating_reason}</div>}
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Stage</div>
              <div className="text-sm font-mono">{lead.stage ?? DASH}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Status</div>
              <div className="text-sm font-mono">{statusLabel}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Source</div>
              <div className="text-sm font-mono">{sourceLabel}</div>
            </div>
          </div>

          {/* Read-only body */}
          <div className="space-y-4">
            {lead.next_best_action && (
              <div className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
                <span className="font-semibold">Next best action:</span> {lead.next_best_action}
              </div>
            )}
            {incomplete && incomplete.length > 0 && (
              <div className="rounded-md border border-chart-orange/40 bg-chart-orange/10 px-3 py-2 text-xs text-chart-orange flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold">Incomplete lead: needs {incomplete.join(", ")}</div>
                  {incomplete.includes("company") && (
                    <div className="opacity-90 mt-0.5">Builder is a placeholder. Find out who the builder actually is.</div>
                  )}
                </div>
              </div>
            )}
            {history && history.total_leads > 0 && (
              <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs font-mono">
                <span className="font-semibold">{history.total_leads}</span> previous leads · <span className="font-semibold">{history.converted}</span> converted · <span className="font-semibold">{Math.round(history.response_rate_pct)}%</span> response
              </div>
            )}
            {silence?.silence_rule_code && (
              <div className="rounded-md border border-chart-orange/40 bg-chart-orange/10 px-3 py-2 text-xs text-chart-orange">
                {silence.days_silent}d silent · {silence.action_prompt}
              </div>
            )}

            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Contact details</div>
            <div className="grid grid-cols-2 gap-3">
              <ReadField label="Company" value={lead.company_builder} />
              <ReadField label="Project name" value={lead.project_name} />
              <ReadField label="Contact name" value={lead.project_contact_name} />
              <ReadField label="Role" value={lead.role} />
              <ReadField label="Phone" value={lead.phone} />
              <ReadField label="Direct email" value={lead.direct_email} />
              <ReadField label="Reception name" value={lead.reception_name} />
              <ReadField label="Reception email" value={lead.reception_email} />
              <ReadField label="State" value={lead.state} />
              <ReadField label="Site address" value={lead.site_address} />
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Notes</div>
              <div className="text-sm mt-0.5 whitespace-pre-line break-words">
                {lead.notes?.trim() ? lead.notes : <span className="text-muted-foreground/60">{DASH}</span>}
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
