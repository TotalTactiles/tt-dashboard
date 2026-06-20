import { useMemo } from "react";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/DashboardLayout";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ArrowDown, AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";

function parseDealDate(raw: string): Date | null {
  if (!raw) return null;
  const s = raw.trim();
  const dmyMatch = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/);
  if (dmyMatch) return new Date(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

const norm = (s: string) => s.trim().toLowerCase();
const isStage = (jobStatus: string, target: string) =>
  norm(jobStatus) === norm(target);

const fmt = (n: number) =>
  "$" + Math.round(n).toLocaleString("en-AU");

const STAGES: { key: string; label: string; colorVar: string }[] = [
  { key: "Quote Sent", label: "Quote Sent", colorVar: "hsl(var(--muted-foreground))" },
  { key: "Negotiation/Review", label: "Negotiation", colorVar: "hsl(var(--chart-blue))" },
  { key: "Verbal Confirmation (YLW)", label: "Verbal (YLW)", colorVar: "hsl(var(--chart-orange))" },
  { key: "PO Received (GRN)", label: "PO Received (GRN)", colorVar: "hsl(var(--chart-green))" },
  { key: "Completed", label: "Completed", colorVar: "hsl(var(--chart-green))" },
];

const STATUS_PILL: Record<string, string> = {
  "Quote Sent": "bg-muted/20 text-muted-foreground border-muted-foreground/30",
  "Negotiation/Review": "bg-chart-blue/20 text-chart-blue border-chart-blue/40",
  "Verbal Confirmation (YLW)": "bg-chart-orange/20 text-chart-orange border-chart-orange/40",
  "PO Received (GRN)": "bg-chart-green/20 text-chart-green border-chart-green/40",
  "Completed": "bg-emerald-700/40 text-emerald-300 border-emerald-600/50",
  "Lost/Dead": "bg-red-500/25 text-red-400 border-red-500/40",
};

const statusPillFor = (status: string) => {
  const key = Object.keys(STATUS_PILL).find(k => isStage(k, status));
  return key ? STATUS_PILL[key] : STATUS_PILL["Quote Sent"];
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const DealFlow = () => {
  const { quotedJobs } = useDashboardData();
  const jobs = quotedJobs ?? [];

  {/* TEMP DEBUG — remove after fix */}
  const debugBlock = (
    <div className="chart-container mb-4 font-mono text-xs text-muted-foreground">
      <p className="text-chart-green mb-2">Status values in quotedJobs (first 20):</p>
      <div className="space-y-0.5">
        {jobs.slice(0, 20).map((j: any, i: number) => (
          <div key={i}>
            <span className="text-foreground">{JSON.stringify(j.status)}</span>
            {" — "}{j.project}
          </div>
        ))}
      </div>
      <p className="mt-2">Total jobs: {jobs.length}</p>
      <p>Unique statuses: {[...new Set(jobs.map((j: any) => j.status))].join(" | ")}</p>
    </div>
  );

  const today = new Date();

  const byStage = useMemo(() => {
    const m: Record<string, any[]> = {};
    STAGES.forEach(s => { m[norm(s.key)] = []; });
    m[norm("Lost/Dead")] = [];
    jobs.forEach((j: any) => {
      const key = STAGES.find(s => isStage(j.status, s.key))?.key ??
        (isStage(j.status, "Lost/Dead") ? "Lost/Dead" : null);
      if (key) m[norm(key)].push(j);
    });
    return m;
  }, [jobs]);

  const stageStats = STAGES.map(s => {
    const items = byStage[norm(s.key)] ?? [];
    const value = items.reduce((a, b) => a + (Number(b.value) || 0), 0);
    return { ...s, count: items.length, value };
  });

  const lostItems = byStage[norm("Lost/Dead")] ?? [];
  const lostValue = lostItems.reduce((a, b) => a + (Number(b.value) || 0), 0);
  const completedItems = byStage[norm("Completed")] ?? [];
  const grnItems = byStage[norm("PO Received (GRN)")] ?? [];
  const grnValue = grnItems.reduce((a, b) => a + (Number(b.value) || 0), 0);
  const completedValue = completedItems.reduce((a, b) => a + (Number(b.value) || 0), 0);

  // Win/Loss
  const closedCount = grnItems.length + lostItems.length;
  const winRate = closedCount > 0 ? (grnItems.length / closedCount) * 100 : 0;
  const avgWon = grnItems.length > 0 ? grnValue / grnItems.length : 0;
  const avgLost = lostItems.length > 0 ? lostValue / lostItems.length : 0;
  const totalValueWon = grnValue + completedValue;

  // Loss reasons
  const lossReasons = useMemo(() => {
    const counts: Record<string, number> = {};
    lostItems.forEach((j: any) => {
      const r = (j.reasonForLoss && String(j.reasonForLoss).trim()) || "Unspecified";
      counts[r] = (counts[r] || 0) + 1;
    });
    const total = lostItems.length || 1;
    return Object.entries(counts)
      .map(([reason, count]) => ({ reason, count, pct: (count / total) * 100 }))
      .sort((a, b) => b.count - a.count);
  }, [lostItems]);

  // Velocity — avg days per active stage
  const ACTIVE = ["Quote Sent", "Negotiation/Review", "Verbal Confirmation (YLW)", "PO Received (GRN)"];
  const velocityData = ACTIVE.map(stage => {
    const items = byStage[norm(stage)] ?? [];
    const days = items
      .map((j: any) => {
        const d = parseDealDate(j.dateQuoted);
        if (!d) return null;
        return Math.max(0, Math.floor((today.getTime() - d.getTime()) / 86400000));
      })
      .filter((x): x is number => x !== null);
    const avg = days.length ? days.reduce((a, b) => a + b, 0) / days.length : 0;
    return { stage: stage.replace(" Confirmation (YLW)", " (YLW)").replace(" Received (GRN)", " (GRN)"), avgDays: Math.round(avg), count: items.length };
  });

  const velocityColor = (d: number) =>
    d < 14 ? "hsl(var(--chart-green))" : d < 30 ? "hsl(var(--chart-orange))" : "hsl(var(--destructive))";

  // Stale deals
  const staleDeals = useMemo(() => {
    return jobs
      .filter((j: any) => !isStage(j.status, "Completed") && !isStage(j.status, "Lost/Dead"))
      .map((j: any) => {
        const d = parseDealDate(j.dateQuoted);
        if (!d) return null;
        const days = Math.floor((today.getTime() - d.getTime()) / 86400000);
        return { ...j, daysOld: days };
      })
      .filter((j: any) => j && j.daysOld > 21)
      .sort((a: any, b: any) => b.daysOld - a.daysOld);
  }, [jobs]);

  const maxStageCount = Math.max(1, ...stageStats.map(s => s.count));

  return (
    <DashboardLayout>
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        {/* Header */}
        <motion.div variants={item}>
          <h1 className="text-fluid-2xl font-semibold tracking-tight">Deal Flow</h1>
          <p className="text-fluid-sm text-muted-foreground mt-1">
            Commercial intelligence — pipeline, win/loss, velocity &amp; cash conversion
          </p>
        </motion.div>

        {debugBlock}

        {/* Section 1: Funnel */}
        <motion.section variants={item} className="chart-container p-5">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-fluid-base font-semibold">Pipeline Funnel</h2>
            <div className="text-fluid-xs text-muted-foreground">
              {jobs.length} total deals
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6">
            <div className="flex flex-col md:flex-row md:items-stretch gap-2">
              {stageStats.map((s, i) => {
                const next = stageStats[i + 1];
                const dropOff = next ? (s.count > 0 ? Math.max(0, ((s.count - next.count) / s.count) * 100) : "—") : null;
                const widthPct = 40 + (s.count / maxStageCount) * 60;
                return (
                  <div key={s.key} className="flex-1 flex flex-col md:flex-row md:items-center gap-2">
                    <div
                      className="rounded-lg border border-border/40 bg-card/40 p-3 flex-1 min-w-0"
                      style={{ borderLeft: `3px solid ${s.colorVar}`, width: `${widthPct}%` }}
                    >
                      <div className="text-fluid-xs text-muted-foreground truncate">{s.label}</div>
                      <div className="font-mono text-fluid-lg font-semibold mt-1">{s.count}</div>
                      <div className="font-mono text-fluid-xs text-muted-foreground">{fmt(s.value)}</div>
                    </div>
                    {next && (
                      <div className="hidden md:flex flex-col items-center text-muted-foreground shrink-0 px-1">
                        <ChevronRight className="w-4 h-4" />
                        {dropOff === "—" && (
                          <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-0.5">
                            <ArrowDown className="w-3 h-3" />
                            —
                          </div>
                        )}
                        {typeof dropOff === "number" && dropOff > 0 && (
                          <div className="text-[10px] font-mono text-destructive flex items-center gap-0.5">
                            <ArrowDown className="w-3 h-3" />
                            {dropOff.toFixed(0)}%
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 md:w-48 self-start">
              <div className="text-fluid-xs text-destructive uppercase tracking-wide">Lost / Dead</div>
              <div className="font-mono text-fluid-lg font-semibold mt-1">{lostItems.length}</div>
              <div className="font-mono text-fluid-xs text-muted-foreground">{fmt(lostValue)} lost</div>
            </div>
          </div>
        </motion.section>

        {/* Section 2: Win/Loss */}
        <motion.section variants={item} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="chart-container p-5">
            <h2 className="text-fluid-base font-semibold mb-4">Win / Loss Summary</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-fluid-xs text-muted-foreground">Win Rate</div>
                <div className="font-mono text-fluid-2xl font-semibold text-chart-green">{winRate.toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-fluid-xs text-muted-foreground">Total Value Won</div>
                <div className="font-mono text-fluid-2xl font-semibold">{fmt(totalValueWon)}</div>
              </div>
              <div>
                <div className="text-fluid-xs text-muted-foreground">Avg Won Deal</div>
                <div className="font-mono text-fluid-base">{fmt(avgWon)}</div>
              </div>
              <div>
                <div className="text-fluid-xs text-muted-foreground">Avg Lost Deal</div>
                <div className="font-mono text-fluid-base">{fmt(avgLost)}</div>
              </div>
              <div className="col-span-2 pt-2 border-t border-border/40">
                <div className="text-fluid-xs text-muted-foreground">Total Value Lost</div>
                <div className="font-mono text-fluid-base text-destructive">{fmt(lostValue)}</div>
              </div>
            </div>
          </div>

          <div className="chart-container p-5">
            <h2 className="text-fluid-base font-semibold mb-4">Loss Reason Breakdown</h2>
            {lossReasons.length === 0 ? (
              <div className="text-fluid-sm text-muted-foreground">No lost deals recorded.</div>
            ) : (
              <LossReasonList reasons={lossReasons} />
            )}
          </div>
        </motion.section>

        {/* Section 3: Velocity */}
        <motion.section variants={item} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="chart-container p-5">
            <h2 className="text-fluid-base font-semibold mb-1">Avg Days Per Stage</h2>
            <p className="text-fluid-xs text-muted-foreground mb-4">Time since quoted, for deals currently in stage</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={velocityData} layout="vertical" margin={{ left: 10, right: 24, top: 4, bottom: 4 }}>
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis dataKey="stage" type="category" stroke="hsl(var(--muted-foreground))" fontSize={11} width={120} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.2)" }}
                  contentStyle={{
                    background: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    fontSize: 12,
                  }}
                  formatter={(v: any, _n, p: any) => [`${v} days (n=${p.payload.count})`, "Avg"]}
                />
                <Bar dataKey="avgDays" radius={[0, 4, 4, 0]}>
                  {velocityData.map((d, i) => (
                    <Cell key={i} fill={velocityColor(d.avgDays)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-container p-5">
            <h2 className="text-fluid-base font-semibold mb-1">Stale Deals</h2>
            <p className="text-fluid-xs text-muted-foreground mb-4">Open deals quoted &gt; 21 days ago</p>
            {staleDeals.length === 0 ? (
              <div className="flex items-center gap-2 text-chart-green text-fluid-sm">
                <CheckCircle2 className="w-4 h-4" /> No stale deals
              </div>
            ) : (
              <ul className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {staleDeals.map((d: any) => {
                  const sev = d.daysOld >= 35 ? "bg-red-500/25 text-red-400 border-red-500/40" : "bg-orange-500/20 text-orange-300 border-orange-500/40";
                  return (
                    <li key={d.id} className="flex items-center justify-between gap-3 p-2 rounded-md border border-border/40 bg-card/30">
                      <div className="min-w-0 flex-1">
                        <div className="text-fluid-sm font-medium truncate">{d.jobName}</div>
                        <div className="text-fluid-xs text-muted-foreground truncate">{d.company}</div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded border ${statusPillFor(d.status)}`}>
                        {d.status}
                      </span>
                      <span className={`font-mono text-[10px] px-2 py-0.5 rounded border ${sev}`}>
                        {d.daysOld}d
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </motion.section>

        {/* Section 4: Quote-to-Cash placeholder */}
        <motion.section variants={item} className="chart-container p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-fluid-base font-semibold">Quote-to-Cash Timeline</h2>
              <p className="text-fluid-xs text-muted-foreground mt-1 max-w-xl">
                Tracks each deal from quoted → won → invoiced → paid, showing true cash conversion cycle
              </p>
            </div>
            <span className="text-[11px] px-2 py-1 rounded border border-chart-orange/40 bg-chart-orange/15 text-chart-orange flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Awaiting Fiskil bank sync
            </span>
          </div>

          <div className="mt-6 flex items-center justify-between gap-2 opacity-60">
            {["Quoted", "Won", "Invoiced", "Paid"].map((label, i, arr) => (
              <div key={label} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-2 flex-1">
                  <div className="w-10 h-10 rounded-full border-2 border-dashed border-muted-foreground/50 flex items-center justify-center font-mono text-fluid-xs text-muted-foreground">
                    {i + 1}
                  </div>
                  <div className="text-fluid-xs text-muted-foreground">{label}</div>
                </div>
                {i < arr.length - 1 && (
                  <div className="flex-1 h-px border-t border-dashed border-muted-foreground/40 mx-1" />
                )}
              </div>
            ))}
          </div>

          <p className="text-fluid-xs text-muted-foreground mt-6">
            This section activates automatically once live bank transactions are matched to revenue jobs.
          </p>
        </motion.section>
      </motion.div>
    </DashboardLayout>
  );
};

const LossReasonList = ({ reasons }: { reasons: { reason: string; count: number; pct: number }[] }) => {
  const top = reasons.slice(0, 6);
  const rest = reasons.slice(6);
  return (
    <div className="space-y-2">
      {top.map(r => (
        <div key={r.reason} className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex justify-between text-fluid-sm">
              <span className="truncate">{r.reason}</span>
              <span className="font-mono text-muted-foreground ml-2">{r.count} · {r.pct.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 mt-1 bg-muted/30 rounded">
              <div className="h-full bg-destructive/70 rounded" style={{ width: `${r.pct}%` }} />
            </div>
          </div>
        </div>
      ))}
      {rest.length > 0 && (
        <details className="text-fluid-xs text-muted-foreground pt-1">
          <summary className="cursor-pointer hover:text-foreground">Show {rest.length} more</summary>
          <div className="space-y-1 mt-2">
            {rest.map(r => (
              <div key={r.reason} className="flex justify-between">
                <span className="truncate">{r.reason}</span>
                <span className="font-mono">{r.count} · {r.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
};

export default DealFlow;
