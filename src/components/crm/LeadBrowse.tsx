import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { bandFor, Lead, useCrmRefs, useLeadBrowse } from "@/hooks/useCrmLeads";
import LeadDrawer from "./LeadDrawer";

const db = supabase as any;

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
  const [funnel, setFunnel] = useState<any | null>(null);
  const [filters, setFilters] = useState({
    search: "", stage: "", status: "", nextStep: "", source: "", state: "", band: "", page: 0,
  });
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [silence, setSilence] = useState<Record<string, { days_silent: number }>>({});

  useEffect(() => {
    db.from("v_lead_funnel_summary").select("*").maybeSingle().then((r: any) => setFunnel(r.data ?? null));
  }, []);

  const { rows, count, loading } = useLeadBrowse(filters);

  useEffect(() => {
    if (!rows.length) return;
    const ids = rows.map((r) => r.id);
    db.from("v_lead_silence").select("id,days_silent").in("id", ids).then((r: any) => {
      const m: Record<string, { days_silent: number }> = {};
      (r.data ?? []).forEach((s: any) => { m[s.id] = { days_silent: s.days_silent }; });
      setSilence(m);
    });
  }, [rows]);

  const stateOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.state).filter(Boolean))) as string[], [rows]);
  const pages = Math.ceil(count / 50);

  const setF = (k: keyof typeof filters, v: any) => setFilters({ ...filters, [k]: v, page: 0 });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <KpiTile label="Total Leads" value={funnel?.total_leads ?? "—"} />
        <KpiTile label="Awaiting Call" value={funnel?.awaiting_call ?? "—"} />
        <KpiTile label="Actioned" value={funnel?.actioned ?? "—"} />
        <KpiTile label="Responded" value={funnel?.responded ?? "—"} />
        <KpiTile label="Hot" value={funnel?.hot ?? "—"} />
        <KpiTile label="Open Rate" value={funnel?.open_rate_pct != null ? `${Math.round(funnel.open_rate_pct)}%` : "—"} />
        <KpiTile label="Reply Rate" value={funnel?.reply_rate_pct != null ? `${Math.round(funnel.reply_rate_pct)}%` : "—"} />
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
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
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
            {loading && <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>}
            {!loading && !rows.length && <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground italic">No leads match</TableCell></TableRow>}
            {rows.map((l: Lead) => {
              const band = bandFor(l.rating_score, refs?.bands);
              const status = refs?.statuses.find((s) => s.code === l.status_code);
              const silRow = silence[l.id];
              const days = silRow?.days_silent;
              const isStale = days != null && days > 35;
              const claimed = l.claimed_by && l.claimed_at && (Date.now() - new Date(l.claimed_at).getTime()) < 30 * 60 * 1000;
              return (
                <TableRow key={l.id} className="cursor-pointer" onClick={() => setDrawerId(l.id)}>
                  <TableCell className="font-medium">
                    {l.company_builder}
                    {claimed && <span className="ml-2 text-[10px] font-mono text-muted-foreground">Claimed by {l.claimed_by}</span>}
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
                  <TableCell />
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

      <LeadDrawer leadId={drawerId} open={!!drawerId} onOpenChange={(v) => !v && setDrawerId(null)} operator={operator} />
    </div>
  );
}
