import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Users, Clock, DollarSign, TrendingUp, ChevronDown, PlugZap, Plus, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

// ─────────────────────────────────────────────────────────────────────────────
// Employee Centre — office-only. Rates live in employee_rates. Hours live in
// time_entries (logged via Project Management). No Zoho Projects, no Upwork
// data path yet. Rates are read at invoice time by v_project_labour_actual.
// ─────────────────────────────────────────────────────────────────────────────

const db = supabase as any;

const RATE_MAX = 500;
const AMBER = "#BA7517";
const ERROR = "#E24B4A";
const INTERACTIVE = "#3D89DA";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2026-06-14" or ISO → { key: "2026-06", label: "Jun 2026" }
function monthKeyFromDate(d: string): { key: string; label: string } | null {
  if (!d) return null;
  const m = d.match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  const y = m[1];
  const mi = parseInt(m[2], 10) - 1;
  if (mi < 0 || mi > 11) return null;
  return { key: `${y}-${m[2]}`, label: `${MONTH_ABBR[mi]} ${y}` };
}
function monthLabelFromKey(k: string): string {
  const m = k.match(/^(\d{4})-(\d{2})$/);
  if (!m) return k;
  const mi = parseInt(m[2], 10) - 1;
  if (mi < 0 || mi > 11) return k;
  return `${MONTH_ABBR[mi]} ${m[1]}`;
}
function fmtDate(d: string): string {
  if (!d) return "";
  const [y, mo, da] = d.split("-");
  const mi = parseInt(mo, 10) - 1;
  if (isNaN(mi) || mi < 0 || mi > 11) return d;
  return `${da} ${MONTH_ABBR[mi]} ${y}`;
}
function fmtAUD(n: number): string {
  return `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface Profile {
  id: string;
  full_name: string;
  role: string;
  active: boolean;
}
interface Rate {
  user_id: string;
  hourly_rate: number;
}
interface Entry {
  id: string;
  project_id: string;
  user_id: string;
  work_date: string;
  hours: number;
  note: string | null;
  billable: boolean;
}
interface ProjectRow {
  id: string;
  name: string;
}

// ============= STAT CARD =============
const StatCard = ({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
}) => (
  <Card className="p-5">
    <div className="flex items-start justify-between mb-3">
      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</span>
      <Icon className="h-4 w-4 text-muted-foreground/70" />
    </div>
    <div className="text-3xl font-semibold tabular-nums leading-none">{value}</div>
    {sub ? <div className="text-[11px] font-mono text-muted-foreground mt-2">{sub}</div> : null}
  </Card>
);

// ============= RATE INPUT =============
function RateInput({
  userId,
  initial,
  onSaved,
}: {
  userId: string;
  initial: number | null;
  onSaved: (rate: number) => void;
}) {
  const [raw, setRaw] = useState<string>(initial != null ? initial.toFixed(2) : "");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const initialRef = useRef<number | null>(initial);

  useEffect(() => {
    initialRef.current = initial;
    setRaw(initial != null ? initial.toFixed(2) : "");
  }, [initial]);

  const commit = useCallback(async () => {
    const trimmed = raw.trim();
    if (trimmed === "") {
      setErr(null);
      setRaw(initialRef.current != null ? initialRef.current.toFixed(2) : "");
      return;
    }
    const n = Number(trimmed);
    if (!isFinite(n)) {
      setErr("Not a number");
      return;
    }
    if (n <= 0) {
      setErr("Rate must be greater than 0");
      return;
    }
    if (n > RATE_MAX) {
      setErr(`Rate must be ≤ $${RATE_MAX}`);
      return;
    }
    setErr(null);
    if (initialRef.current != null && Math.abs(n - initialRef.current) < 0.005) return;
    setSaving(true);
    // Optimistic: bubble up first, roll back on failure.
    const prev = initialRef.current;
    initialRef.current = n;
    onSaved(n);
    const { error } = await db
      .from("employee_rates")
      .upsert(
        { user_id: userId, hourly_rate: n, effective_from: new Date().toISOString().slice(0, 10) },
        { onConflict: "user_id" },
      );
    setSaving(false);
    if (error) {
      initialRef.current = prev;
      onSaved(prev ?? 0);
      setRaw(prev != null ? prev.toFixed(2) : "");
      toast.error("Could not save rate — please try again");
    } else {
      setRaw(n.toFixed(2));
    }
  }, [raw, userId, onSaved]);

  return (
    <div className="flex flex-col items-end">
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground text-xs">$</span>
        <Input
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            if (err) setErr(null);
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
            if (e.key === "Escape") {
              setRaw(initialRef.current != null ? initialRef.current.toFixed(2) : "");
              setErr(null);
              e.currentTarget.blur();
            }
          }}
          inputMode="decimal"
          disabled={saving}
          className="h-8 w-24 text-right font-mono tabular-nums"
          placeholder="—"
        />
      </div>
      {err ? (
        <span className="text-[10px] font-mono mt-1" style={{ color: ERROR }}>
          {err}
        </span>
      ) : null}
    </div>
  );
}

// ============= PAGE =============
const EmployeeTracking = () => {
  const { role } = useRole();
  const officeOnly = role === "office";

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [entries, setEntries] = useState<Entry[]>([]);
  const [projects, setProjects] = useState<Record<string, ProjectRow>>({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);
  const [workerFilterOpen, setWorkerFilterOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!officeOnly) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: p }, { data: r }, { data: t }, { data: pj }] = await Promise.all([
      db.from("profiles").select("id, full_name, role, active").order("full_name", { ascending: true }),
      db.from("employee_rates").select("user_id, hourly_rate"),
      db
        .from("time_entries")
        .select("id, project_id, user_id, work_date, hours, note, billable")
        .order("work_date", { ascending: false })
        .limit(1000),
      db.from("projects").select("id, name"),
    ]);
    setProfiles((p as Profile[]) ?? []);
    const rmap: Record<string, number> = {};
    for (const row of (r as Rate[]) ?? []) rmap[row.user_id] = Number(row.hourly_rate);
    setRates(rmap);
    setEntries((t as Entry[]) ?? []);
    const pmap: Record<string, ProjectRow> = {};
    for (const row of (pj as ProjectRow[]) ?? []) pmap[row.id] = row;
    setProjects(pmap);
    setLoading(false);
  }, [officeOnly]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleRateSaved = useCallback((userId: string, rate: number) => {
    setRates((prev) => ({ ...prev, [userId]: rate }));
  }, []);

  // Merge profile lookup
  const profileById = useMemo(() => {
    const m: Record<string, Profile> = {};
    for (const p of profiles) m[p.id] = p;
    return m;
  }, [profiles]);

  // Months present in the data
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) {
      const mk = monthKeyFromDate(e.work_date);
      if (mk) set.add(mk.key);
    }
    return Array.from(set).sort().reverse();
  }, [entries]);

  // Filtered entries (by month + worker)
  const filteredEntries = useMemo(() => {
    const activeSet = selectedWorkers.length === 0 ? null : new Set(selectedWorkers);
    return entries.filter((e) => {
      if (activeSet && !activeSet.has(e.user_id)) return false;
      if (monthFilter !== "all") {
        const mk = monthKeyFromDate(e.work_date);
        if (!mk || mk.key !== monthFilter) return false;
      }
      return true;
    });
  }, [entries, monthFilter, selectedWorkers]);

  // KPIs — computed off filtered set
  const kpis = useMemo(() => {
    const workerIds = new Set<string>();
    let totalHours = 0;
    let pricedHours = 0;
    let unpricedHours = 0;
    let spend = 0;
    for (const e of filteredEntries) {
      workerIds.add(e.user_id);
      const h = Number(e.hours) || 0;
      totalHours += h;
      const rate = rates[e.user_id];
      if (rate != null) {
        pricedHours += h;
        spend += h * rate;
      } else {
        unpricedHours += h;
      }
    }
    const avgRate = pricedHours > 0 ? spend / pricedHours : 0;
    return {
      activeWorkers: workerIds.size,
      totalHours,
      pricedHours,
      unpricedHours,
      spend,
      avgRate,
    };
  }, [filteredEntries, rates]);

  // Monthly chart data — bar hours, line cost
  const monthlyChart = useMemo(() => {
    const byMonth = new Map<string, { key: string; label: string; hours: number; cost: number }>();
    for (const e of filteredEntries) {
      const mk = monthKeyFromDate(e.work_date);
      if (!mk) continue;
      const cur = byMonth.get(mk.key) ?? { key: mk.key, label: mk.label, hours: 0, cost: 0 };
      const h = Number(e.hours) || 0;
      cur.hours += h;
      const rate = rates[e.user_id];
      if (rate != null) cur.cost += h * rate;
      byMonth.set(mk.key, cur);
    }
    return Array.from(byMonth.values()).sort((a, b) => (a.key < b.key ? -1 : 1));
  }, [filteredEntries, rates]);

  // Workers missing a rate
  const workersMissingRate = useMemo(
    () => profiles.filter((p) => p.active !== false && rates[p.id] == null),
    [profiles, rates],
  );

  const toggleWorker = useCallback((id: string) => {
    setSelectedWorkers((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const workerFilterLabel = (() => {
    if (selectedWorkers.length === 0) return "All Workers";
    if (selectedWorkers.length === 1) return profileById[selectedWorkers[0]]?.full_name ?? "1 worker";
    return `${selectedWorkers.length} workers`;
  })();

  if (!officeOnly) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center text-sm text-muted-foreground font-mono">
          Employee Centre is office-only.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Employee Centre</h1>
            <p className="text-xs font-mono text-muted-foreground mt-1">
              Rates &amp; timesheets · Hours logged in Project Management, costed at Employee Centre rates
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
            <PlugZap className="h-3.5 w-3.5" />
            Upwork sync — not connected yet
          </div>
        </div>

        {/* Missing rate banner */}
        {workersMissingRate.length > 0 ? (
          <div
            className="text-xs font-mono px-3 py-2 rounded-md border"
            style={{ color: AMBER, borderColor: AMBER + "55", background: AMBER + "10" }}
          >
            {workersMissingRate.length} worker{workersMissingRate.length === 1 ? "" : "s"} without a rate — their
            logged hours cannot be costed
          </div>
        ) : null}

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="ACTIVE WORKERS" value={String(kpis.activeWorkers)} icon={Users} />
          <StatCard
            label="TOTAL HOURS LOGGED"
            value={kpis.totalHours.toFixed(1)}
            sub={
              kpis.unpricedHours > 0
                ? `${kpis.unpricedHours.toFixed(1)} hrs unpriced`
                : undefined
            }
            icon={Clock}
          />
          <StatCard
            label="TOTAL SPEND (AUD)"
            value={fmtAUD(kpis.spend)}
            sub={
              kpis.unpricedHours > 0
                ? `excludes ${kpis.unpricedHours.toFixed(1)} hrs with no rate set`
                : undefined
            }
            icon={DollarSign}
          />
          <StatCard
            label="AVG HOURLY RATE"
            value={kpis.avgRate > 0 ? fmtAUD(kpis.avgRate) : "—"}
            sub="AUD/hr · weighted across priced hours"
            icon={TrendingUp}
          />
        </div>

        {/* Monthly chart */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Monthly hours &amp; spend</h3>
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
              Bars: hours · Line: cost (AUD)
            </span>
          </div>
          {monthlyChart.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground font-mono">
              No hours logged for this period.
            </div>
          ) : (
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyChart} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    label={{ value: "Hours", angle: -90, position: "insideLeft", fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                    formatter={(v: number, name: string) =>
                      name === "Cost (AUD)" ? [fmtAUD(v), name] : [v.toFixed(1), name]
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="left" dataKey="hours" name="Hours" fill={INTERACTIVE} radius={[3, 3, 0, 0]} />
                  <Line
                    yAxisId="right"
                    dataKey="cost"
                    name="Cost (AUD)"
                    stroke={AMBER}
                    strokeWidth={2}
                    dot={{ r: 3, fill: AMBER }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Worker rates */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Worker rates</h3>
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
              {profiles.length} profile{profiles.length === 1 ? "" : "s"}
            </span>
          </div>
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground font-mono">Loading…</div>
          ) : profiles.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground font-mono">No profiles yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground border-b">
                    <th className="text-left py-2 pr-3">Worker</th>
                    <th className="text-left py-2 pr-3">Role</th>
                    <th className="text-right py-2 pr-3">Hourly rate (AUD)</th>
                    <th className="text-left py-2 pl-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((p) => {
                    const rate = rates[p.id];
                    return (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="py-2 pr-3">{p.full_name}</td>
                        <td className="py-2 pr-3 text-muted-foreground capitalize">{p.role}</td>
                        <td className="py-2 pr-3">
                          <div className="flex justify-end">
                            <RateInput
                              userId={p.id}
                              initial={rate ?? null}
                              onSaved={(v) => handleRateSaved(p.id, v)}
                            />
                          </div>
                        </td>
                        <td className="py-2 pl-3">
                          {rate == null ? (
                            <span
                              className="text-[10px] font-mono px-2 py-0.5 rounded"
                              style={{ color: AMBER, background: AMBER + "18", border: `1px solid ${AMBER}55` }}
                            >
                              NO RATE
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Timesheet log */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <h3 className="text-sm font-semibold">Timesheet log</h3>
            <div className="flex items-center gap-2">
              {/* Worker multi-select */}
              <Popover open={workerFilterOpen} onOpenChange={setWorkerFilterOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs font-mono">
                    {workerFilterLabel}
                    <ChevronDown className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-56 p-2">
                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {profiles.map((p) => (
                      <label
                        key={p.id}
                        className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 px-2 py-1 rounded"
                      >
                        <Checkbox
                          checked={selectedWorkers.includes(p.id)}
                          onCheckedChange={() => toggleWorker(p.id)}
                        />
                        <span>{p.full_name}</span>
                      </label>
                    ))}
                    {selectedWorkers.length > 0 ? (
                      <button
                        onClick={() => setSelectedWorkers([])}
                        className="text-[11px] font-mono text-muted-foreground hover:text-foreground mt-1 w-full text-left px-2 py-1"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                </PopoverContent>
              </Popover>
              {/* Month filter */}
              <Select value={monthFilter} onValueChange={setMonthFilter}>
                <SelectTrigger className="h-8 text-xs font-mono w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All months</SelectItem>
                  {availableMonths.map((mk) => (
                    <SelectItem key={mk} value={mk}>
                      {monthLabelFromKey(mk)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground font-mono">Loading…</div>
          ) : filteredEntries.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground font-mono">
              No time entries logged{monthFilter !== "all" ? " for this month" : ""}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground border-b">
                    <th className="text-left py-2 pr-3">Date</th>
                    <th className="text-left py-2 pr-3">Worker</th>
                    <th className="text-left py-2 pr-3">Project</th>
                    <th className="text-right py-2 pr-3">Hours</th>
                    <th className="text-right py-2 pr-3">Cost (AUD)</th>
                    <th className="text-left py-2 pl-3">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((e) => {
                    const worker = profileById[e.user_id];
                    const project = projects[e.project_id];
                    const rate = rates[e.user_id];
                    const h = Number(e.hours) || 0;
                    return (
                      <tr key={e.id} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-mono tabular-nums text-xs">{fmtDate(e.work_date)}</td>
                        <td className="py-2 pr-3">{worker?.full_name ?? "—"}</td>
                        <td className="py-2 pr-3">
                          {project ? (
                            <Link
                              to={`/projects?p=${encodeURIComponent(project.id)}`}
                              className="hover:underline"
                              style={{ color: INTERACTIVE }}
                            >
                              {project.name}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono tabular-nums">{h.toFixed(1)}</td>
                        <td className="py-2 pr-3 text-right font-mono tabular-nums">
                          {rate != null ? (
                            fmtAUD(h * rate)
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <span className="text-muted-foreground">—</span>
                              <span
                                className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                                style={{ color: AMBER, background: AMBER + "18", border: `1px solid ${AMBER}55` }}
                              >
                                NO RATE
                              </span>
                            </span>
                          )}
                        </td>
                        <td className="py-2 pl-3 text-xs text-muted-foreground">{e.note ?? ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t font-mono text-xs">
                    <td colSpan={3} className="py-2 pr-3 text-right text-muted-foreground uppercase tracking-widest">
                      Totals
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{kpis.totalHours.toFixed(1)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{fmtAUD(kpis.spend)}</td>
                    <td className="py-2 pl-3">
                      {kpis.unpricedHours > 0 ? (
                        <span style={{ color: AMBER }}>
                          {kpis.unpricedHours.toFixed(1)} hrs unpriced
                        </span>
                      ) : null}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <p className="text-[10px] font-mono text-muted-foreground/70 mt-4">
            Hours logged in Project Management, costed at Employee Centre rates. Read by the revenue engine via{" "}
            <span className="font-mono">v_project_labour_actual</span>.
          </p>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default EmployeeTracking;
