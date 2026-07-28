import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCrmRefs, Lead } from "@/hooks/useCrmLeads";
import { useToast } from "@/hooks/use-toast";

const db = supabase as any;

function formatDate(d: Date) {
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

export default function SetNextStepDialog({
  open, onOpenChange, lead, operator, onSaved,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; lead: Lead; operator: string; onSaved: () => void;
}) {
  const refs = useCrmRefs();
  const steps = refs?.nextSteps ?? [];
  const templates = refs?.templates ?? [];

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

  const missing = {
    project_name: !projectName.trim(),
    state: !state.trim(),
    contact: !email.trim() && !phone.trim(),
  };
  const ready = !missing.project_name && !missing.state && !missing.contact;

  const step = useMemo(() => steps.find((s) => s.code === selected), [selected, steps]);
  const followUpDate = useMemo(() => {
    if (!step?.follow_up_days) return null;
    const d = new Date();
    d.setDate(d.getDate() + step.follow_up_days);
    return d;
  }, [step]);
  const templateExists = useMemo(() => {
    if (!step) return false;
    return templates.some((t) => t.next_step_code === step.code && (!t.state || t.state === state));
  }, [step, templates, state]);

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
      stage: "actioned",
      claimed_by: null,
      claimed_at: null,
    }).eq("id", lead.id);
    await db.from("lead_events").insert({
      lead_id: lead.id, kind: "status_changed",
      detail: `Next step → ${step.label}`,
      occurred_at: now, created_by: operator,
    });
    setSaving(false);
    toast({ title: "Lead actioned", description: `Moved to Actioned. Follow-up ${followUpDate ? formatDate(followUpDate) : "scheduled"}.` });
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Set next step — {lead.company_builder}</DialogTitle>
        </DialogHeader>

        {!ready && (
          <div className="rounded-md border border-chart-orange/40 bg-chart-orange/10 p-3 space-y-3">
            <div className="flex items-center gap-2 text-chart-orange text-sm font-semibold">
              <AlertCircle className="w-4 h-4" /> Fix these before selecting a next step
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
            {missing.contact && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Direct email</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Phone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" />
                </div>
              </div>
            )}
          </div>
        )}

        {ready && (
          <div className="rounded-md border border-chart-green/40 bg-chart-green/10 px-3 py-2 flex items-center gap-2 text-sm text-chart-green">
            <CheckCircle2 className="w-4 h-4" /> Ready — project, state and contact confirmed
          </div>
        )}

        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Next step</Label>
          <RadioGroup value={selected} onValueChange={setSelected} className="mt-2 grid gap-2">
            {steps.map((s) => (
              <label
                key={s.code}
                className={`flex items-center gap-2 border rounded-md px-3 py-2 ${ready ? "cursor-pointer hover:bg-muted/40 border-border" : "opacity-50 cursor-not-allowed border-border"}`}
              >
                <RadioGroupItem value={s.code} disabled={!ready} />
                <span className="text-sm">{s.label}</span>
                {s.follow_up_days ? (
                  <span className="ml-auto text-[10px] font-mono text-muted-foreground">+{s.follow_up_days}d</span>
                ) : null}
              </label>
            ))}
          </RadioGroup>
        </div>

        {step && ready && (
          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm space-y-1">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">This will:</div>
            {templateExists ? (
              <div>· queue the <span className="font-semibold">{step.label}</span> email for <span className="font-semibold">{state || "—"}</span></div>
            ) : (
              <div className="text-chart-orange">
                · No email template exists for {step.label} / {state || "—"} — the lead will be flagged for attention instead of sending.
              </div>
            )}
            {followUpDate && (
              <div>· create a follow-up task due <span className="font-semibold">{formatDate(followUpDate)}</span> ({step.follow_up_days} days)</div>
            )}
            <div>· move this lead to <span className="font-semibold">Actioned</span></div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!ready || !selected || saving} onClick={confirm}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
