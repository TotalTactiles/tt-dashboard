import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useCrmRefs, Lead } from "@/hooks/useCrmLeads";
import { useToast } from "@/hooks/use-toast";

const db = supabase as any;

export default function LogCallDialog({
  open, onOpenChange, lead, operator, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: Lead;
  operator: string;
  onSaved: () => void;
}) {
  const refs = useCrmRefs();
  const outcomes = refs?.outcomes ?? [];
  const [outcome, setOutcome] = useState<string>("");
  const [spokeWith, setSpokeWith] = useState("");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [sentiment, setSentiment] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const selectedOutcome = useMemo(() => outcomes.find((o) => o.code === outcome), [outcome, outcomes]);
  const showSpokeWith = !!selectedOutcome && (selectedOutcome.is_contact || outcome === "spoke_gatekeeper");

  async function save() {
    if (!outcome) return;
    setSaving(true);
    const now = new Date().toISOString();
    await db.from("lead_calls").insert({
      lead_id: lead.id,
      called_at: now,
      outcome_code: outcome,
      spoke_with: showSpokeWith ? spokeWith || null : null,
      duration_seconds: duration ? Math.round(Number(duration) * 60) : null,
      notes: notes || null,
      sentiment: sentiment || null,
      created_by: operator,
    });
    if (notes.trim()) {
      await db.from("lead_events").insert({
        lead_id: lead.id, kind: "note", detail: notes.trim(), occurred_at: now, created_by: operator,
      });
    }
    setSaving(false);
    toast({ title: "Call logged" });
    onSaved();
    onOpenChange(false);
    setOutcome(""); setSpokeWith(""); setDuration(""); setNotes(""); setSentiment("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Log call — {lead.company_builder}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Outcome *</Label>
            <RadioGroup value={outcome} onValueChange={setOutcome} className="mt-2 grid gap-2">
              {outcomes.map((o) => (
                <label key={o.code} className="flex items-center gap-2 border border-border rounded-md px-3 py-2 cursor-pointer hover:bg-muted/40">
                  <RadioGroupItem value={o.code} />
                  <span className="text-sm">{o.label}</span>
                </label>
              ))}
            </RadioGroup>
          </div>
          {showSpokeWith && (
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Spoke with</Label>
              <Input value={spokeWith} onChange={(e) => setSpokeWith(e.target.value)} placeholder="Name" className="mt-1" />
            </div>
          )}
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Duration (minutes)</Label>
            <Input type="number" min={0} value={duration} onChange={(e) => setDuration(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Sentiment</Label>
            <div className="flex gap-2 mt-2">
              {["positive", "neutral", "negative"].map((s) => (
                <Button
                  key={s}
                  variant={sentiment === s ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSentiment(sentiment === s ? "" : s)}
                  className="capitalize"
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!outcome || saving} onClick={save}>Save call</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
