import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/DashboardLayout";
import { useDashboardData, QuotedJob } from "@/contexts/DashboardDataContext";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ArrowDown, AlertTriangle, CheckCircle2, ChevronRight, Info } from "lucide-react";
import { formatMetricValue } from "@/lib/formatMetricValue";

function parseDealDate(raw: string): Date | null {
  if (!raw) return null;
  const s = raw.trim();
  const dmyMatch = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/);
  if (dmyMatch) return new Date(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

const isWon = (s: string) => s === "won";
const isYellow = (s: string) => s === "yellow";
const isLost = (s: string) => s === "lost";
const isPending = (s: string) => s === "pending";
const isCompleted = (s: string) => s === "completed";
const isPipelineWin = (j: QuotedJob) =>
  (j.status === "won" && !String(j.rawStatus ?? "").toLowerCase().includes("completed"))
  || j.status === "yellow";
const isActive = (s: string) => isPending(s) || isYellow(s) || isWon(s);

const fmt = (n: number) =>
  "$" + Math.round(n).toLocaleString("en-AU");

const fmtAUD = (n: number) => formatMetricValue(n, "currency");

const STAGES: { key: string; label: string; colorVar: string }[] = [
  { key: "pending", label: "Active (Pending)", colorVar: "hsl(var(--muted-foreground))" },
  { key: "yellow", label: "Verbal (YLW)", colorVar: "hsl(var(--chart-orange))" },
  { key: "won", label: "GRN", colorVar: "hsl(var(--chart-green))" },
];

const STATUS_PILL: Record<string, string> = {
  pending: "bg-chart-orange/20 text-chart-orange border-chart-orange/40",
  yellow: "bg-chart-orange/20 text-chart-orange border-chart-orange/40",
  won: "bg-chart-green/20 text-chart-green border-chart-green/40",
  lost: "bg-red-500/25 text-red-400 border-red-500/40",
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
  const { quotedJobs, liveData } = useDashboardData();
  const jobs = quotedJobs ?? [];
  const quotesRaw = (liveData?.quotes as any[]) ?? [];
  const [staleSort, setStaleSort] = useState<"oldest" | "newest">("oldest");
  const [staleStatus, setStaleStatus] = useState<"all" | "pending" | "won" | "lost">("all");

  const today = new Date();

  const byStatus = useMemo(() => {
    return {
      pending: jobs.filter((j: any) => isPending(j.status)),
      yellow: jobs.filter((j: any) => isYellow(j.status)),
      won: jobs.filter((j: any) => isWon(j.status)),
      lost: jobs.filter((j: any) => isLost(j.status)),
    };
  }, [jobs]);

  const stageStats = STAGES.map(s => {
    let items;
    if (s.key === "won") {
      items = jobs.filter((j: any) => j.status === "won" && !String(j.rawStatus ?? "").toLowerCase().includes("completed"));
    } else {
      items = byStatus[s.key as keyof typeof byStatus] ?? [];
    }
    const value = items.reduce((a: number, b: any) => a + (Number(b.value) || 0), 0);
    return { ...s, count: items.length, value };
  });

  const lostItems = byStatus.lost;
  const lostValue = lostItems.reduce((a: number, b: any) => a + (Number(b.value) || 0), 0);
  const wonItems = byStatus.won;
  const wonValue = wonItems.reduce((a: number, b: any) => a + (Number(b.value) || 0), 0);

  const completedJobs = jobs.filter((j: any) => String(j.rawStatus ?? "").toUpperCase() === "COMPLETED");
  const completedCount = completedJobs.length;
  const completedValue = completedJobs.reduce((s: number, j: any) => s + (Number(j.value) || 0), 0);

  // Win/Loss

  const pipelineWonJobs = jobs.filter((j: any) => isPipelineWin(j));
  const pipelineWonCount = pipelineWonJobs.length;
  const pipelineWonValue = pipelineWonJobs.reduce((s: number, j: any) => s + (Number(j.value) || 0), 0);

  const wonAndCompleted = (liveData?.quotes ?? []).filter((j: any) =>
    j["Current Status"] === "PO Received (GRN)" ||
    j["Current Status"] === "Completed"
  );

  const avgWonDeal = wonAndCompleted.length > 0
    ? wonAndCompleted.reduce((s: number, j: any) =>
        s + (parseFloat(String(j["Contract Value ($)"] ?? j._value ?? "0").replace(/[^0-9.-]/g, "")) || 0), 0
      ) / wonAndCompleted.length
    : 0;

  const totalValueWon = wonAndCompleted.reduce((s: number, j: any) =>
    s + (parseFloat(String(j["Contract Value ($)"] ?? j._value ?? "0").replace(/[^0-9.-]/g, "")) || 0), 0
  );

  const lostJobs = jobs.filter((j: any) => isLost(j.status));
  const lostCount = lostJobs.length;
  const ytdLostValue = lostJobs.reduce((s: number, j: any) => s + (Number(j.value) || 0), 0);

  const decidedCount = pipelineWonCount + lostCount;
  const winRate = decidedCount > 0
    ? (pipelineWonCount / decidedCount) * 100
    : 0;

  const pipelineCR = jobs.length > 0
    ? (pipelineWonCount / jobs.length) * 100
    : 0;

  const avgLostDeal = lostCount > 0 ? ytdLostValue / lostCount : 0;

  const pendingCount = jobs.filter((j: any) => isActive(j.status)).length;
  const totalCount = jobs.length;
  const pendingPct = totalCount > 0 ? ((pendingCount / totalCount) * 100).toFixed(0) : "0";

  // Avg days from quote to won — for context explanation
  const wonJobsForAvg = jobs.filter((j: any) => isPipelineWin(j));
  const avgDaysToClose = wonJobsForAvg.reduce((sum: number, j: any) => {
    const d = parseDealDate(j.dateQuoted);
    if (!d) return sum;
    return sum + Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  }, 0) / (wonJobsForAvg.length || 1);

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
  const VELOCITY_STAGES = [
    { key: "pending", label: "Pending" },
    { key: "yellow", label: "Yellow (YLW)" },
    { key: "won", label: "Won" },
  ];
  const velocityData = VELOCITY_STAGES.map(({ key, label }) => {
    const items = byStatus[key as keyof typeof byStatus] ?? [];
    const days = items
      .map((j: any) => {
        const d = parseDealDate(j.dateQuoted);
        if (!d) return null;
        return Math.max(0, Math.floor((today.getTime() - d.getTime()) / 86400000));
      })
      .filter((x): x is number => x !== null);
    const avg = days.length ? days.reduce((a, b) => a + b, 0) / days.length : 0;
    return { stage: label, avgDays: Math.round(avg), count: items.length };
  });

  const velocityColor = (d: number) =>
    d < 14 ? "hsl(var(--chart-green))" : d < 30 ? "hsl(var(--chart-orange))" : "hsl(var(--destructive))";

  // Stale deals
  const staleDeals = useMemo(() => {
    return quotesRaw
      .filter((j: any) => {
        const status = j["Current Status"] ?? "";
        return !["Completed", "Lost/Dead", "PO Received (GRN)"].includes(status);
      })
      .map((j: any) => {
        const zohoMatch = (quotedJobs ?? []).find((q: any) =>
          q["Job/Lead ID (Zoho)"] === j["Job/Lead ID (Zoho)"] ||
          q.zohoId === j["Job/Lead ID (Zoho)"]
        );
        const d = parseDealDate(zohoMatch?.dateQuoted ?? j["Date Created"] ?? j["Estimated Job Date"] ?? "");
        if (!d) return null;
        const days = Math.floor((today.getTime() - d.getTime()) / 86400000);
        return {
          ...j,
          daysOld: days,
          projectName: j["Project Name"] ?? j._project ?? "",
          companyName: j["Company Name"] ?? j._company ?? "",
          status: j["Current Status"] === "PO Received (GRN)" ? "won"
            : j["Current Status"] === "Verbal Confirmation (YLW)" ? "yellow"
            : "pending",
        };
      })
      .filter((j: any) => j && j.daysOld > 21)
      .sort((a: any, b: any) => b.daysOld - a.daysOld);
  }, [quotesRaw]);

  const filteredStaleDeals = useMemo(() => {
    let list = staleDeals;
    if (staleStatus !== "all") {
      list = list.filter((j: any) => j.status === staleStatus);
    }
    if (staleSort === "newest") {
      list = [...list].sort((a: any, b: any) => a.daysOld - b.daysOld);
    }
    return list;
  }, [staleDeals, staleSort, staleStatus]);

  const maxStageCount = Math.max(1, ...stageStats.map(s => s.count), completedCount);

  return (
    <DashboardLayout>
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        {/* Header */}
        <motion.div variants={item}>
          <h1 className="text-fluid-2xl font-semibold tracking-tight">Deal Flow</h1>
          <p className="text-fluid-sm text-muted-foreground mt-1">
            Commercial intelligence — pipeline, win/loss, velocity &amp; cash conversion
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {jobs.length} active deals
          </p>
        </motion.div>


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
              <div className="flex-1 flex flex-col md:flex-row md:items-center gap-2">
                <div
                  className="rounded-lg border border-border/40 bg-card/40 p-3 flex-1 min-w-0"
                  style={{ borderLeft: "3px solid #22c55e", width: `${40 + (completedCount / maxStageCount) * 60}%` }}
                >
                  <div className="text-fluid-xs text-muted-foreground truncate">COMPLETED</div>
                  <div className="font-mono text-fluid-lg font-semibold mt-1">{completedCount}</div>
                  <div className="font-mono text-fluid-xs text-muted-foreground">{fmt(completedValue)}</div>
                </div>
              </div>
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
            <div className="grid grid-cols-2" style={{ gap: "20px 32px" }}>
              <div>
                <div className="text-[11px] uppercase text-[#64748b] tracking-[0.06em]">Win Rate</div>
                <div className="text-[22px] font-bold text-[#22c55e]">
                  {winRate.toFixed(1)}%
                  <span title="Win Rate = (YLW + GRN) ÷ (YLW + GRN + Lost). Measures how often TT wins when a deal reaches a decision, excluding still-active pipeline.">
                    <Info
                      className="text-muted-foreground hover:text-foreground cursor-help transition-colors inline-block ml-1.5 align-middle"
                      size={14}
                    />
                  </span>
                </div>
                <div className="text-[11px] text-[#64748b]">YLW+GRN+decided</div>
              </div>
              <div>
                <div className="text-[11px] uppercase text-[#64748b] tracking-[0.06em]">Pipeline CR</div>
                <div className="text-[22px] font-bold text-[#38bdf8]">
                  {pipelineCR.toFixed(1)}%
                  <span title={`Pipeline CR is lower than Win Rate because ${pendingCount} deals (${pendingPct}% of all quotes) are still active in the pipeline. TT's avg quote-to-close cycle is ~${Math.round(avgDaysToClose)} days, so many quotes are still converting. As these resolve, Pipeline CR will trend toward Win Rate.`}>
                    <Info
                      className="text-muted-foreground hover:text-foreground cursor-help transition-colors inline-block ml-1.5 align-middle"
                      size={14}
                    />
                  </span>
                </div>
                <div className="text-[11px] text-[#64748b]">Won ÷ all quoted</div>
              </div>
              <div>
                <div className="text-[11px] uppercase text-[#64748b] tracking-[0.06em]">Total Value Won</div>
                <div className="text-[22px] font-bold text-[#22c55e]">{fmtAUD(totalValueWon)}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase text-[#64748b] tracking-[0.06em]">Total Value Lost</div>
                <div className="text-[22px] font-bold text-[#ef4444]">{fmt(ytdLostValue)}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase text-[#64748b] tracking-[0.06em]">Avg Won Deal</div>
                <div className="text-[22px] font-bold text-white">{fmtAUD(avgWonDeal)}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase text-[#64748b] tracking-[0.06em]">Avg Lost Deal</div>
                <div className="text-[22px] font-bold text-white">{fmt(avgLostDeal)}</div>
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
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-background border border-border rounded-lg px-3 py-2 shadow-lg">
                        <p className="text-xs text-muted-foreground font-mono mb-0.5">{label}</p>
                        <p className="text-sm font-mono font-semibold text-foreground">
                          {Math.round(payload[0].value as number)} days avg
                        </p>
                      </div>
                    );
                  }}
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

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="flex items-center gap-1.5">
                {[
                  { key: "oldest", label: "Oldest first" },
                  { key: "newest", label: "Newest first" },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setStaleSort(opt.key as "oldest" | "newest")}
                    className={`text-[11px] px-2 py-1 rounded-full border transition-colors font-mono ${
                      staleSort === opt.key
                        ? "bg-chart-green/20 text-chart-green border-chart-green/40"
                        : "border-border text-muted-foreground hover:bg-secondary/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="w-px h-4 bg-border/40" />
              <div className="flex items-center gap-1.5">
                {[
                  { key: "all", label: "All" },
                  { key: "pending", label: "Pending" },
                  { key: "won", label: "Won" },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setStaleStatus(opt.key as "all" | "pending" | "won")}
                    className={`text-[11px] px-2 py-1 rounded-full border transition-colors font-mono ${
                      staleStatus === opt.key
                        ? opt.key === "pending"
                          ? "bg-chart-orange/20 text-chart-orange border-chart-orange/40"
                          : "bg-chart-green/20 text-chart-green border-chart-green/40"
                        : "border-border text-muted-foreground hover:bg-secondary/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredStaleDeals.length === 0 ? (
              <div className="flex items-center gap-2 text-chart-green text-fluid-sm">
                <CheckCircle2 className="w-4 h-4" /> No stale deals
              </div>
            ) : (
              <ul className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {filteredStaleDeals.map((d: any) => {
                  const sev = d.daysOld >= 35 ? "bg-red-500/25 text-red-400 border-red-500/40" : "bg-orange-500/20 text-orange-300 border-orange-500/40";
                  return (
                    <li key={d.id} className="flex items-center justify-between gap-3 p-2 rounded-md border border-border/40 bg-card/30">
                      <div className="min-w-0 flex-1">
                        <div className="text-fluid-sm font-medium truncate">{d.projectName || d.jobName || "Unnamed"}</div>
                        <div className="text-fluid-xs text-muted-foreground truncate">{d.companyName || d.jobName || ""}</div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded border ${STATUS_PILL[d.status] ?? STATUS_PILL.pending}`}>
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
