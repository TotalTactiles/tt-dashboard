import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCrmRefs, Lead, NextStepRow } from "@/hooks/useCrmLeads";
import { useToast } from "@/hooks/use-toast";

const db = supabase as any;

const STAGE_LABEL: Record<string, string> = {
  new: "New",
  enriching: "Enriching",
  ready_to_call: "Ready to call",
  actioned: "Actioned",
  responded: "Responded",
  needs_attention: "Needs attention",
  converted: "Converted",
  archived: "Archived",
};

function formatDate(d: Date) {
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

export default function SetNextStepDialog({
  open, onOpenChange, lead, operator, onSaved,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; lead: Lead; operator: string; onSaved: () => void;
}) {
  const refs = useCrmRefs();
  const allSteps = refs?.nextSteps ?? [];
  const templates = refs?.templates ?? [];

  // Filter by stage; never offer system-only steps.
  const steps: NextStepRow[] = useMemo(
    () => allSteps.filter(
      (s) => !s.is_system && (s.applies_to_stage == null || s.applies_to_stage === lead.stage),
    ),
    [allSteps, lead.stage],
  );

  const [projectName, setProjectName] = useState(lead.project_name ?? "");
  const [state, setState] = useState(lead.state ?? "");
  const [email, setEmail] = useState(lead.direct_email ?? "");
  const [phone, setPhone] = useState(lead.phone ?? "");
  const [selected, setSelected] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    setProjectName(lead.project_name ?? "");
    setState(lead.state ?? "");
    setEmail(lead.direct_email ?? "");
    setPhone(lead.phone ?? "");
    setSelected("");
  }, [open, lead.id]);

  const step = useMemo(() => steps.find((s) => s.code === selected), [selected, steps]);

  const missing = useMemo(() => {
    if (!step) return { project_name: false, state: false, email: false };
    return {
      project_name: !projectName.trim(),
      state: !!step.requires_state && !state.trim(),
      email: !!step.requires_email && !email.trim(),
    };
  }, [step, projectName, state, email]);

  const ready = !!step && !missing.project_name && !missing.state && !missing.email;

  const followUpDate = useMemo(() => {
    if (!step?.follow_up_days) return null;
    const d = new Date();
    d.setDate(d.getDate() + step.follow_up_days);
    return d;
  }, [step]);

  const templateExists = useMemo(() => {
    if (!step || !step.requires_email) return false;
    return templates.some((t) => t.next_step_code === step.code && (!t.state || t.state === state));
  }, [step, templates, state]);

  const targetStage = step?.moves_to_stage ?? "actioned";

  async function commitLeadFieldPatch() {
    const patch: any = {};
    if (projectName !== (lead.project_name ?? "")) patch.project_name = projectName.trim() || null;
    if (state !== (lead.state ?? "")) patch.state = state.trim() || null;
    if (email !== (lead.direct_email ?? "")) patch.direct_email = email.trim() || null;
    if (phone !== (lead.phone ?? "")) patch.phone = phone.trim() || null;
    if (Object.keys(patch).length) await db.from("leads").update(patch).eq("id", lead.id);
  }

  async function confirm() {
    if (!ready || !step) return;
    setSaving(true);
    await commitLeadFieldPatch();
    const now = new Date().toISOString();
    await db.from("leads").update({
      next_step_code: step.code,
      stage: targetStage,
      claimed_by: null,
      claimed_at: null,
    }).eq("id", lead.id);
    await db.from("lead_events").insert({
      lead_id: lead.id, kind: "status_changed",
      detail: `Next step → ${step.label}`,
      occurred_at: now, created_by: operator,
    });

    const { data: fresh } = await db.from("leads").select("*").eq("id", lead.id).maybeSingle();
    const l: any = fresh ?? { ...lead, project_name: projectName, state, direct_email: email, phone };

    const sheetValue = step.sheet_value ?? step.label;
    const body = {
      lead_id: lead.id,
      project_name: l.project_name ?? null,
      next_step_label: sheetValue,
      source_system: l.source_system ?? null,
      company_builder: l.company_builder ?? null,
      state: l.state ?? null,
      project_contact_name: l.project_contact_name ?? null,
      role: l.role ?? null,
      phone: l.phone ?? null,
      direct_email: l.direct_email ?? null,
      reception_name: l.reception_name ?? null,
      reception_email: l.reception_email ?? null,
      cc_bcc: l.cc_bcc ?? null,
      notes: l.notes ?? null,
      who_spoke_with: l.who_spoke_with ?? null,
    };

    let mirror:
      | { kind: "ok"; path: string }
      | { kind: "anomaly"; reason: string }
      | { kind: "network" } = { kind: "network" };

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15_000);
      const res = await fetch("https://n8n.srv1437130.hstgr.cloud/webhook/tt-lead-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const json = await res.json();
      if (json?.ok === true) {
        mirror = { kind: "ok", path: String(json.path ?? "") };
      } else if (json?.ok === false && json?.path === "anomaly") {
        mirror = { kind: "anomaly", reason: String(json.reason ?? "Unknown anomaly") };
      }
    } catch {
      mirror = { kind: "network" };
    }

    setSaving(false);

    if (mirror.kind === "ok") {
      toast({ title: "Next step set", description: "Email automation queued." });
    } else if (mirror.kind === "anomaly") {
      toast({
        title: "Lead flagged for attention",
        description: mirror.reason,
        className: "border-chart-orange/40 bg-chart-orange/10 text-chart-orange",
      });
    } else {
      toast({
        title: "Saved, but sheet sync did not confirm",
        description: "Check the lead before relying on the email going out.",
        className: "border-chart-orange/40 bg-chart-orange/10 text-chart-orange",
      });
    }

    onSaved();
    onOpenChange(false);
  }

  const anyMissing = step && (missing.project_name || missing.state || missing.email);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Set next step — {lead.company_builder}</DialogTitle>
        </DialogHeader>

        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Next step</Label>
          {steps.length === 0 ? (
            <div className="mt-2 text-sm text-muted-foreground italic border border-border rounded-md px-3 py-4 text-center">
              No actions available at this stage
            </div>
          ) : (
            <RadioGroup value={selected} onValueChange={setSelected} className="mt-2 grid gap-2">
              {steps.map((s) => (
                <label
                  key={s.code}
                  className="flex items-center gap-2 border border-border rounded-md px-3 py-2 cursor-pointer hover:bg-muted/40"
                >
                  <RadioGroupItem value={s.code} />
                  <span className="text-sm">{s.label}</span>
                  {s.follow_up_days ? (
                    <span className="ml-auto text-[10px] font-mono text-muted-foreground">+{s.follow_up_days}d</span>
                  ) : null}
                </label>
              ))}
            </RadioGroup>
          )}
        </div>

        {step && anyMissing && (
          <div className="rounded-md border border-chart-orange/40 bg-chart-orange/10 p-3 space-y-3">
            <div className="flex items-center gap-2 text-chart-orange text-sm font-semibold">
              <AlertCircle className="w-4 h-4" /> Fill these in to confirm this step
            </div>
            {missing.project_name && (
              <div>
                <Label className="text-xs">Project name (required — Zoho Last_Name)</Label>
                <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} className="mt-1" />
              </div>
            )}
            {missing.state && (
              <div>
                <Label className="text-xs">State (required — email routing)</Label>
                <Input value={state} onChange={(e) => setState(e.target.value.toUpperCase())} placeholder="e.g. NSW" className="mt-1" maxLength={4} />
              </div>
            )}
            {missing.email && (
              <div>
                <Label className="text-xs">Direct email (required — this step sends an email)</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
              </div>
            )}
          </div>
        )}

        {step && ready && (
          <div className="rounded-md border border-chart-green/40 bg-chart-green/10 px-3 py-2 flex items-center gap-2 text-sm text-chart-green">
            <CheckCircle2 className="w-4 h-4" /> Ready to confirm
          </div>
        )}

        {step && ready && (
          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm space-y-1">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">This will:</div>
            {step.requires_email ? (
              templateExists ? (
                <div>· queue the <span className="font-semibold">{step.label}</span> email for <span className="font-semibold">{state || "—"}</span></div>
              ) : (
                <div className="text-chart-orange">
                  · No email template exists for {step.label} / {state || "—"} — the lead will be flagged for attention instead of sending.
                </div>
              )
            ) : (
              <div>· record <span className="font-semibold">{step.label}</span> against this lead (no email sent)</div>
            )}
            {followUpDate && (
              <div>· create a follow-up task due <span className="font-semibold">{formatDate(followUpDate)}</span> ({step.follow_up_days} days)</div>
            )}
            <div>· move this lead to <span className="font-semibold">{STAGE_LABEL[targetStage] ?? targetStage}</span></div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!ready || saving} onClick={confirm}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
