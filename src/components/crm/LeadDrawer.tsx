import { useEffect, useState, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { bandFor, Lead, useCrmRefs, deleteLead } from "@/hooks/useCrmLeads";
import { useToast } from "@/hooks/use-toast";
import { Check, AlertTriangle, Trash2 } from "lucide-react";

const db = supabase as any;

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

function InlineField({
  label, value, onSave, textarea, highlight,
}: { label: string; value: string | null; onSave: (v: string) => Promise<void>; textarea?: boolean; highlight?: boolean }) {
  const [v, setV] = useState(value ?? "");
  const [saved, setSaved] = useState(false);
  useEffect(() => { setV(value ?? ""); }, [value]);
  const commit = async () => {
    if ((v ?? "") === (value ?? "")) return;
    await onSave(v);
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  };
  const cls = `mt-1 ${highlight ? "border-chart-orange/60 ring-1 ring-chart-orange/40" : ""}`;
  return (
    <div>
      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono flex items-center gap-2">
        {label}
        {highlight && <span className="text-chart-orange normal-case">· missing</span>}
        {saved && <span className="text-chart-green normal-case flex items-center gap-1"><Check className="w-3 h-3" /> saved</span>}
      </Label>
      {textarea ? (
        <Textarea className={cls} rows={3} value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} />
      ) : (
        <Input className={cls} value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} />
      )}
    </div>
  );
}

export default function LeadDrawer({
  leadId, open, onOpenChange, operator, onDeleted,
}: { leadId: string | null; open: boolean; onOpenChange: (v: boolean) => void; operator: string; onDeleted?: () => void }) {
  const refs = useCrmRefs();
  const { lead, reload } = useLead(leadId);
  const [events, setEvents] = useState<any[]>([]);
  const [calls, setCalls] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [ratingHistory, setRatingHistory] = useState<any[]>([]);
  const [history, setHistory] = useState<any | null>(null);
  const [silence, setSilence] = useState<any | null>(null);
  const [incomplete, setIncomplete] = useState<string[] | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [newTask, setNewTask] = useState({ title: "", kind: "follow_up", due_date: "" });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    if (!leadId || !lead) return;
    const [e, c, t, r, h, s, inc] = await Promise.all([
      db.from("lead_events").select("*").eq("lead_id", leadId).order("occurred_at", { ascending: false }),
      db.from("lead_calls").select("*").eq("lead_id", leadId).order("called_at", { ascending: false }),
      db.from("lead_tasks").select("*").eq("lead_id", leadId).order("status", { ascending: true }).order("due_date"),
      db.from("lead_rating_history").select("*").eq("lead_id", leadId).order("computed_at", { ascending: false }),
      db.from("v_company_history").select("*").eq("company", lead.company_builder).maybeSingle(),
      db.from("v_lead_silence").select("*").eq("id", leadId).maybeSingle(),
      db.from("v_leads_incomplete").select("missing_fields").eq("id", leadId).maybeSingle(),
    ]);
    setEvents(e.data ?? []); setCalls(c.data ?? []); setTasks(t.data ?? []);
    setRatingHistory(r.data ?? []); setHistory(h.data ?? null); setSilence(s.data ?? null);
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
  const patchLead = async (patch: Record<string, any>) => {
    await db.from("leads").update(patch).eq("id", lead.id);
    await reload();
  };

  const addNote = async () => {
    if (!noteDraft.trim()) return;
    await db.from("lead_events").insert({
      lead_id: lead.id, kind: "note", detail: noteDraft.trim(),
      occurred_at: new Date().toISOString(), created_by: operator,
    });
    setNoteDraft("");
    load();
  };

  const addTask = async () => {
    if (!newTask.title.trim() || !newTask.due_date) return;
    await db.from("lead_tasks").insert({
      lead_id: lead.id, title: newTask.title.trim(), kind: newTask.kind, due_date: newTask.due_date,
      status: "open", auto_generated: false, created_by: operator,
    });
    setNewTask({ title: "", kind: "follow_up", due_date: "" });
    load();
  };

  const toggleTask = async (t: any) => {
    await db.from("lead_tasks").update({
      status: t.status === "open" ? "done" : "open",
      completed_at: t.status === "open" ? new Date().toISOString() : null,
    }).eq("id", t.id);
    load();
  };

  const commsMerged = [
    ...calls.map((c) => ({ t: c.called_at, kind: "call", label: refs?.outcomes.find((o) => o.code === c.outcome_code)?.label ?? c.outcome_code, detail: c.notes })),
    ...events.filter((e) => e.kind?.startsWith("email") || e.kind === "zoho_push").map((e) => ({ t: e.occurred_at, kind: e.kind, label: e.kind, detail: e.detail })),
  ].sort((a, b) => (a.t < b.t ? 1 : -1));

  const timeline = [
    ...events.map((e) => ({ t: e.occurred_at, kind: "event", label: e.kind, detail: e.detail })),
    ...ratingHistory.map((r) => ({ t: r.computed_at, kind: "rating", label: "rating", detail: `${r.previous_score ?? "—"} → ${r.score} · ${r.reason ?? ""}` })),
  ].sort((a, b) => (a.t < b.t ? 1 : -1));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-mono">{lead.company_builder}</SheetTitle>
          <div className="text-sm text-muted-foreground">{lead.project_name}</div>
        </SheetHeader>

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
              <div className="text-sm font-mono">{lead.stage}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Status</div>
              <Select value={lead.status_code ?? ""} onValueChange={(v) => patchLead({ status_code: v || null })}>
                <SelectTrigger className="h-8 mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {(refs?.statuses ?? []).map((s) => <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Source</div>
              <Select value={lead.source_code ?? ""} onValueChange={(v) => patchLead({ source_code: v || null })}>
                <SelectTrigger className="h-8 mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {(refs?.sources ?? []).map((s) => <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tabs */}
          <div>
            <Tabs defaultValue="summary">
              <TabsList>
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
                <TabsTrigger value="tasks">Tasks</TabsTrigger>
                <TabsTrigger value="comms">Comms</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="space-y-4 mt-4">
                {lead.next_best_action && (
                  <div className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
                    <span className="font-semibold">Next best action:</span> {lead.next_best_action}
                  </div>
                )}
                {incomplete && incomplete.length > 0 && (
                  <div className="rounded-md border border-chart-orange/40 bg-chart-orange/10 px-3 py-2 text-xs text-chart-orange flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-semibold">Incomplete lead — needs {incomplete.join(", ")}</div>
                      {incomplete.includes("company") && (
                        <div className="opacity-90 mt-0.5">Builder is a placeholder — find out who the builder actually is.</div>
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
                <div className="grid grid-cols-2 gap-3">
                  <InlineField label="Company" value={lead.company_builder} onSave={(v) => patchLead({ company_builder: v })} highlight={incomplete?.includes("company")} />
                  <InlineField label="Project name" value={lead.project_name} onSave={(v) => patchLead({ project_name: v })} highlight={incomplete?.includes("project_name")} />
                  <InlineField label="Contact name" value={lead.project_contact_name} onSave={(v) => patchLead({ project_contact_name: v })} />
                  <InlineField label="Role" value={lead.role} onSave={(v) => patchLead({ role: v })} />
                  <InlineField label="Phone" value={lead.phone} onSave={(v) => patchLead({ phone: v })} />
                  <InlineField label="Direct email" value={lead.direct_email} onSave={(v) => patchLead({ direct_email: v })} highlight={incomplete?.includes("email")} />
                  <InlineField label="Reception name" value={lead.reception_name} onSave={(v) => patchLead({ reception_name: v })} />
                  <InlineField label="Reception email" value={lead.reception_email} onSave={(v) => patchLead({ reception_email: v })} />
                  <InlineField label="State" value={lead.state} onSave={(v) => patchLead({ state: v.toUpperCase() || null })} highlight={incomplete?.includes("state")} />
                  <InlineField label="Site address" value={lead.site_address} onSave={(v) => patchLead({ site_address: v })} />
                </div>
                <InlineField label="Notes" value={lead.notes} onSave={(v) => patchLead({ notes: v })} textarea />

                <div className="mt-8 pt-6 border-t border-destructive/30">
                  <div className="text-[10px] uppercase tracking-widest text-destructive font-mono mb-2">Danger zone</div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs text-muted-foreground">
                      Permanently delete this lead and all its calls, notes, tasks and rating history. This cannot be undone.
                    </div>
                    <Button variant="destructive" size="sm" onClick={() => { setDeleteReason(""); setDeleteOpen(true); }}>
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete lead
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="notes" className="mt-4 space-y-3">
                <div>
                  <Textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={3} placeholder="Add a note…" />
                  <div className="flex justify-end mt-2"><Button size="sm" onClick={addNote} disabled={!noteDraft.trim()}>Add note</Button></div>
                </div>
                <div className="space-y-2">
                  {events.filter((e) => e.kind === "note").map((e) => (
                    <div key={e.id} className="border border-border rounded-md px-3 py-2">
                      <div className="text-[10px] font-mono text-muted-foreground">{new Date(e.occurred_at).toLocaleString("en-AU")} · {e.created_by ?? "—"}</div>
                      <div className="text-sm mt-1 whitespace-pre-wrap">{e.detail}</div>
                    </div>
                  ))}
                  {!events.some((e) => e.kind === "note") && <div className="text-xs text-muted-foreground italic">No notes yet</div>}
                </div>
              </TabsContent>

              <TabsContent value="tasks" className="mt-4 space-y-3">
                <div className="border border-border rounded-md p-3 space-y-2">
                  <Input placeholder="Task title" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} />
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={newTask.kind} onValueChange={(v) => setNewTask({ ...newTask, kind: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="follow_up">Follow up</SelectItem>
                        <SelectItem value="call">Call</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="meeting">Meeting</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="date" value={newTask.due_date} onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })} />
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" onClick={addTask} disabled={!newTask.title.trim() || !newTask.due_date}>Add task</Button>
                  </div>
                </div>
                <div className="space-y-2">
                  {tasks.map((t) => (
                    <div key={t.id} className={`flex items-start gap-3 border border-border rounded-md px-3 py-2 ${t.status === "done" ? "opacity-60" : ""}`}>
                      <Checkbox checked={t.status === "done"} onCheckedChange={() => toggleTask(t)} className="mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm ${t.status === "done" ? "line-through" : ""}`}>{t.title}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">{t.kind} · due {t.due_date}{t.auto_generated ? " · auto" : ""}</div>
                      </div>
                    </div>
                  ))}
                  {!tasks.length && <div className="text-xs text-muted-foreground italic">No tasks</div>}
                </div>
              </TabsContent>

              <TabsContent value="comms" className="mt-4 space-y-2">
                {commsMerged.map((r, i) => (
                  <div key={i} className="border-l-2 border-border pl-3 py-1">
                    <div className="text-[10px] font-mono text-muted-foreground">{new Date(r.t).toLocaleString("en-AU")} · {r.kind}</div>
                    <div className="text-sm">{r.label}{r.detail ? <> — <span className="text-muted-foreground">{r.detail}</span></> : null}</div>
                  </div>
                ))}
                {!commsMerged.length && <div className="text-xs text-muted-foreground italic">No comms recorded</div>}
              </TabsContent>

              <TabsContent value="timeline" className="mt-4 space-y-2">
                {timeline.map((r, i) => (
                  <div key={i} className={`border-l-2 ${r.kind === "rating" ? "border-primary/60" : "border-border"} pl-3 py-1`}>
                    <div className="text-[10px] font-mono text-muted-foreground">{new Date(r.t).toLocaleString("en-AU")} · {r.label}</div>
                    <div className="text-sm">{r.detail || "—"}</div>
                  </div>
                ))}
                {!timeline.length && <div className="text-xs text-muted-foreground italic">Nothing yet</div>}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
