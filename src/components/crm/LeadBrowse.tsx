import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertTriangle, Trash2, Plus, MoreHorizontal, Sparkles } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { bandFor, Lead, useCrmRefs, useLeadBrowse, useLeadsIncomplete, deleteLeads, enrichLead } from "@/hooks/useCrmLeads";
import { useToast } from "@/hooks/use-toast";
import LeadDrawer from "./LeadDrawer";
import AddLeadDialog from "./AddLeadDialog";

const db = supabase as any;
const DASH = "-";

const STAGES = ["new","enriching","ready_to_call","actioned","responded","needs_attention","converted","archived"];
const STATUS_PILL: Record<string, string> = {
  new: "bg-muted text-muted-foreground",
  ready_to_call: "bg-chart-orange/20 text-chart-orange border border-chart-orange/40",
  actioned: "bg-primary/20 text-primary border border-primary/40",
  responded: "bg-chart-green/20 text-chart-green border border-chart-green/40",
  needs_attention: "bg-chart-orange/20 text-chart-orange border border-chart-orange/40",
  converted: "bg-chart-green/20 text-chart-green border border-chart-green/40",
  archived: "bg-muted text-muted-foreground",
  enriching: "bg-muted text-muted-foreground",
};

function KpiTile({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-4">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">{label}</div>
      <div className="text-2xl font-mono font-semibold mt-1">{value}</div>
    </Card>
  );
}

export default function LeadBrowse({ operator }: { operator: string }) {
  const refs = useCrmRefs();
  const { toast } = useToast();
  const [funnel, setFunnel] = useState<any | null>(null);
  const [filters, setFilters] = useState({
    search: "", stage: "", status: "", nextStep: "", source: "", state: "", band: "", page: 0,
  });
  const [incompleteOnly, setIncompleteOnly] = useState(false);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [silence, setSilence] = useState<Record<string, { days_silent: number }>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkReason, setBulkReason] = useState("");
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    db.from("v_lead_funnel_summary").select("*").maybeSingle().then((r: any) => setFunnel(r.data ?? null));
  }, [reloadTick]);

  const { rows: rawRows, count: rawCount, loading } = useLeadBrowse({ ...filters, _tick: reloadTick } as any);
  const { map: incompleteMap, reload: reloadIncomplete } = useLeadsIncomplete();

  const rows = useMemo(
    () => (incompleteOnly ? rawRows.filter((r) => incompleteMap[r.id]) : rawRows),
    [rawRows, incompleteOnly, incompleteMap],
  );
  const count = incompleteOnly ? rows.length : rawCount;

  useEffect(() => {
    if (!rows.length) return;
    const ids = rows.map((r) => r.id);
    db.from("v_lead_silence").select("id,days_silent").in("id", ids).then((r: any) => {
      const m: Record<string, { days_silent: number }> = {};
      (r.data ?? []).forEach((s: any) => { m[s.id] = { days_silent: s.days_silent }; });
      setSilence(m);
    });
  }, [rows]);

  // Clear stale selections that no longer exist on the current page
  useEffect(() => {
    setSelected((prev) => {
      const visible = new Set(rows.map((r) => r.id));
      const next = new Set<string>();
      prev.forEach((id) => { if (visible.has(id)) next.add(id); });
      return next.size === prev.size ? prev : next;
    });
  }, [rows]);

  const pages = Math.ceil(count / 50);
  const setF = (k: keyof typeof filters, v: any) => setFilters({ ...filters, [k]: v, page: 0 });

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allSelected) rows.forEach((r) => next.delete(r.id));
    else rows.forEach((r) => next.add(r.id));
    setSelected(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  async function confirmBulkDelete() {
    const ids = Array.from(selected);
    if (!ids.length || !bulkReason.trim()) return;
    setBulkDeleting(true);
    try {
      await deleteLeads(ids, bulkReason.trim(), operator);
      toast({ title: `Deleted ${ids.length} lead${ids.length === 1 ? "" : "s"}`, description: "All history removed." });
      setBulkOpen(false);
      setBulkReason("");
      setSelected(new Set());
      setReloadTick((t) => t + 1);
      reloadIncomplete();
    } catch (err: any) {
      toast({
        title: "Delete failed",
        description: err?.message ?? "Try again",
        className: "border-destructive/40 bg-destructive/10 text-destructive",
      });
    } finally {
      setBulkDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <KpiTile label="Total Leads" value={funnel?.total_leads ?? DASH} />
        <KpiTile label="Awaiting Call" value={funnel?.awaiting_call ?? DASH} />
        <KpiTile label="Actioned" value={funnel?.actioned ?? DASH} />
        <KpiTile label="Responded" value={funnel?.responded ?? DASH} />
        <KpiTile label="Hot" value={funnel?.hot ?? DASH} />
        <KpiTile label="Open Rate" value={funnel?.open_rate_pct != null ? `${Math.round(funnel.open_rate_pct)}%` : DASH} />
        <KpiTile label="Reply Rate" value={funnel?.reply_rate_pct != null ? `${Math.round(funnel.reply_rate_pct)}%` : DASH} />
      </div>

      <Card className="p-3">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          <Input placeholder="Search company / project / contact" value={filters.search} onChange={(e) => setF("search", e.target.value)} className="lg:col-span-2" />
          <Select value={filters.stage || "__all"} onValueChange={(v) => setF("stage", v === "__all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Stage" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All stages</SelectItem>
              {STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.status || "__all"} onValueChange={(v) => setF("status", v === "__all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All statuses</SelectItem>
              {(refs?.statuses ?? []).map((s) => <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.nextStep || "__all"} onValueChange={(v) => setF("nextStep", v === "__all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Next step" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Any</SelectItem>
              {(refs?.nextSteps ?? []).map((s) => <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.source || "__all"} onValueChange={(v) => setF("source", v === "__all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Any</SelectItem>
              {(refs?.sources ?? []).map((s) => <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.band || "__all"} onValueChange={(v) => setF("band", v === "__all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Rating" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Any rating</SelectItem>
              {(refs?.bands ?? []).map((b) => <SelectItem key={b.code} value={b.code}>{b.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between gap-3 mt-2">
          <label className="flex items-center gap-2 text-xs font-mono cursor-pointer">
            <Checkbox checked={incompleteOnly} onCheckedChange={(v) => setIncompleteOnly(!!v)} />
            <span className="text-chart-orange">Incomplete only</span>
            <span className="text-muted-foreground">({Object.keys(incompleteMap).length})</span>
          </label>
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => { setBulkReason(""); setBulkOpen(true); }}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete {selected.size} selected
              </Button>
            )}
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Add lead
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
              </TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last activity</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>}
            {!loading && !rows.length && <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground italic">No leads match</TableCell></TableRow>}
            {rows.map((l: Lead) => {
              const band = bandFor(l.rating_score, refs?.bands);
              const status = refs?.statuses.find((s) => s.code === l.status_code);
              const silRow = silence[l.id];
              const days = silRow?.days_silent;
              const isStale = days != null && days > 35;
              const claimed = l.claimed_by && l.claimed_at && (Date.now() - new Date(l.claimed_at).getTime()) < 30 * 60 * 1000;
              const missing = incompleteMap[l.id];
              const isSelected = selected.has(l.id);
              return (
                <TableRow key={l.id} className="cursor-pointer" onClick={() => setDrawerId(l.id)}>
                  <TableCell className="w-8" onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={isSelected} onCheckedChange={() => toggleOne(l.id)} aria-label={`Select ${l.company_builder}`} />
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link to={`/crm/lead/${l.id}`} className="hover:underline text-primary" onClick={(e) => e.stopPropagation()}>{l.company_builder}</Link>
                      {missing && missing.length > 0 && (
                        <span
                          title={`Missing: ${missing.join(", ")}`}
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded uppercase bg-chart-orange/15 text-chart-orange border border-chart-orange/40 flex items-center gap-1"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          {missing.join(" · ")}
                        </span>
                      )}
                      {claimed && <span className="text-[10px] font-mono text-muted-foreground">Claimed by {l.claimed_by}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{l.project_name || "—"}</TableCell>
                  <TableCell><span className="text-xs font-mono">{l.state || "—"}</span></TableCell>
                  <TableCell>
                    {band ? (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded uppercase"
                            style={{ backgroundColor: `${band.colour ?? "#3D89DA"}22`, color: band.colour ?? undefined, border: `1px solid ${band.colour ?? "#3D89DA"}55` }}>
                        {band.label} · {l.rating_score}
                      </span>
                    ) : <span className="text-xs text-muted-foreground italic">Not yet rated</span>}
                  </TableCell>
                  <TableCell>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${STATUS_PILL[l.stage] ?? "bg-muted"}`}>{l.stage}</span>
                  </TableCell>
                  <TableCell className="text-xs">{status?.label ?? "—"}</TableCell>
                  <TableCell className={`text-xs font-mono ${isStale ? "text-chart-orange" : "text-muted-foreground"}`}>
                    {days != null ? `${days}d ago` : "—"}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={async () => {
                              const r = await enrichLead(l.id, operator, "enrich");
                              if (r.ok && r.matched) {
                                const name = r.contact?.name?.trim() || "contact";
                                const email = r.contact?.email?.trim();
                                toast({ title: email ? `Found ${name} ${DASH} ${email}` : `Found ${name}` });
                                setReloadTick((t) => t + 1);
                              } else {
                                toast({
                                  title: r.matched === false ? "No match" : "Enrichment failed",
                                  description: r.detail || `Apollo did not respond ${DASH} the lead is unchanged`,
                                  className: "border-chart-orange/40 bg-chart-orange/10 text-chart-orange",
                                });
                              }
                            }}
                          >
                          <Sparkles className="w-3.5 h-3.5 mr-2" /> Enrich with Apollo
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {pages > 1 && (
          <div className="flex items-center justify-between p-3 border-t border-border text-xs font-mono">
            <span className="text-muted-foreground">Page {filters.page + 1} of {pages} · {count} leads</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={filters.page === 0} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Prev</Button>
              <Button variant="outline" size="sm" disabled={filters.page + 1 >= pages} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Next</Button>
            </div>
          </div>
        )}
      </Card>

      <LeadDrawer
        leadId={drawerId}
        open={!!drawerId}
        onOpenChange={(v) => !v && setDrawerId(null)}
        operator={operator}
        onDeleted={() => { setReloadTick((t) => t + 1); reloadIncomplete(); }}
      />

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" /> Delete {selected.size} lead{selected.size === 1 ? "" : "s"} permanently?
            </DialogTitle>
            <DialogDescription>
              This removes every selected lead and all their calls, notes, tasks and rating history. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label className="text-xs">Reason (required)</Label>
            <Input
              className="mt-1"
              value={bulkReason}
              onChange={(e) => setBulkReason(e.target.value)}
              placeholder="e.g. duplicate batch, out of scope"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={bulkDeleting}>Cancel</Button>
            <Button variant="destructive" disabled={!bulkReason.trim() || bulkDeleting} onClick={confirmBulkDelete}>
              {bulkDeleting ? "Deleting…" : `Delete ${selected.size} permanently`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddLeadDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={(id) => { setReloadTick((t) => t + 1); reloadIncomplete(); setDrawerId(id); }}
        onOpenLead={(id) => { setAddOpen(false); setDrawerId(id); }}
      />
    </div>
  );
}
