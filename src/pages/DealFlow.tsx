import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/DashboardLayout";
import { useDashboardData, QuotedJob } from "@/contexts/DashboardDataContext";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ArrowDown, AlertTriangle, CheckCircle2, ChevronRight, Info } from "lucide-react";
import { formatMetricValue } from "@/lib/formatMetricValue";

const DEAL_CYCLE_WEBHOOK = "https://n8n.srv1437130.hstgr.cloud/webhook/dashboard-cache";

type CycleEntry = {
  cycleDays: number | null;
  decidedType: "won" | "lost" | null;
  measurable: 0 | 1;
  isPrimary: 0 | 1;
  quoteSentTs: string | null;
  decidedTs: string | null;
};

const median = (arr: number[]): number => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = (arr: number[]): number => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

function parseDealDate(raw: string): Date | null {
  if (!raw) return null;
  const s = raw.trim();
  const dmyMatch = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/);
  if (dmyMatch) return new Date(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

const getLostReasonRaw = (j: any) =>
  (j.lostReason
    ?? (j as any).reasonForLoss
    ?? (j as any)["Lost/Dead Reason"]
    ?? (j as any)["Lost/Dead\nReason"]
    ?? "").toString().trim();

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
  const [staleStatus, setStaleStatus] = useState<"all" | "pending" | "won" | "lost" | "stale">("stale");
  const [cycleMap, setCycleMap] = useState<Record<string, CycleEntry>>({});
  const [cycleLoaded, setCycleLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(DEAL_CYCLE_WEBHOOK);
        const rows: Array<{ key: string; value: string }> = await res.json();
        const row = rows.find((r) => r.key === "tt_deal_cycle");
        if (row?.value && !cancelled) {
          const parsed = JSON.parse(row.value);
          if (parsed && typeof parsed === "object") setCycleMap(parsed);
        }
      } catch {
        /* fail gracefully */
      } finally {
        if (!cancelled) setCycleLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const today = new Date();
  const cyc = (job: any): CycleEntry | null => {
    const id = String(job?.zohoId ?? job?.["Job/Lead ID (Zoho)"] ?? job?.["Job / Lead ID\n(Zoho)"] ?? "").trim();
    return id && cycleMap[id] ? cycleMap[id] : null;
  };
  const daysSinceQuoted = (entry: CycleEntry | null): number | null => {
    if (!entry) return null;
    if (entry.decidedTs && typeof entry.cycleDays === "number") return entry.cycleDays;
    if (entry.quoteSentTs) {
      const t = Date.parse(entry.quoteSentTs);
      if (!isNaN(t)) return Math.max(0, Math.floor((today.getTime() - t) / 86400000));
    }
    return null;
  };

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

  // Loss reasons (genuine reasons only; blank reasons shown separately)
  const blankReasonCount = lostJobs.filter((j: any) => getLostReasonRaw(j) === "").length;
  const reasonBuckets = useMemo(() => {
    const counts: Record<string, number> = {};
    lostJobs.forEach((j: any) => {
      const r = getLostReasonRaw(j);
      if (!r) return;
      counts[r] = (counts[r] || 0) + 1;
    });
    const total = lostJobs.length || 1;
    return Object.entries(counts)
      .map(([reason, count]) => ({ reason, count, pct: (count / total) * 100 }))
      .sort((a, b) => b.count - a.count);
  }, [lostJobs]);


  // Real stage + created-date helpers (raw sheet rows)
  const stageOfRow = (row: any): string => {
    const s = (row["Current Status"] ?? row["Current\nStatus"] ?? row["Stage"] ?? "")
      .toString().toUpperCase().trim();
    if (s.includes("QUOTE SENT")) return "Quote Sent";
    if (s.includes("NEGOTIATION") || s.includes("REVIEW")) return "Negotiation/Review";
    if (s.includes("VERBAL") || s.includes("YLW")) return "Verbal Confirmation (YLW)";
    if (s.includes("PO RECEIVED") || s.includes("GRN")) return "PO Received (GRN)";
    if (s.includes("COMPLETED")) return "Completed";
    if (s.includes("LOST") || s.includes("DEAD")) return "Lost/Dead";
    return "Other";
  };

  // Velocity — avg days per real stage from cycle cache (excludes Completed & Lost/Dead)
  const VELOCITY_STAGES = [
    "Quote Sent",
    "Negotiation/Review",
    "Verbal Confirmation (YLW)",
    "PO Received (GRN)",
  ];
  const velocityData = VELOCITY_STAGES.map((label) => {
    const items = quotesRaw.filter((r: any) => stageOfRow(r) === label);
    const days = items
      .map((r: any) => daysSinceQuoted(cyc(r)))
      .filter((x: number | null): x is number => x !== null);
    const avg = days.length ? days.reduce((a, b) => a + b, 0) / days.length : 0;
    return { stage: label, avgDays: Math.round(avg), count: items.length };
  });

  const velocityColor = (d: number) =>
    d < 14 ? "hsl(var(--chart-green))" : d < 30 ? "hsl(var(--chart-orange))" : "hsl(var(--destructive))";

  // Median cycle time — primary + measurable only
  const cycleEntries = Object.values(cycleMap).filter(
    (e) => e && e.isPrimary === 1 && e.measurable === 1 && typeof e.cycleDays === "number",
  ) as CycleEntry[];
  const wonDays = cycleEntries.filter((e) => e.decidedType === "won").map((e) => e.cycleDays as number);
  const lostDays = cycleEntries.filter((e) => e.decidedType === "lost").map((e) => e.cycleDays as number);
  const medianWon = Math.round(median(wonDays));
  const medianLost = Math.round(median(lostDays));
  const meanWon = Math.round(mean(wonDays));
  const meanLost = Math.round(mean(lostDays));

  // Per-deal list (from raw quotes joined to cache)
  const staleDeals = useMemo(() => {
    return quotesRaw
      .filter((j: any) => !!(j["Current Status"]))
      .map((j: any) => {
        const entry = cyc(j);
        const isMeasurable = entry ? entry.measurable === 1 : false;
        const days = daysSinceQuoted(entry);
        const status =
          j["Current Status"] === "PO Received (GRN)" || j["Current Status"] === "Completed" ? "won"
            : j["Current Status"] === "Lost/Dead" ? "lost"
            : j["Current Status"] === "Verbal Confirmation (YLW)" ? "yellow"
            : "pending";
        return {
          ...j,
          daysOld: days,               // number | null
          measurable: isMeasurable,
          projectName: j["Project Name"] ?? j._project ?? "",
          companyName: j["Company Name"] ?? j._company ?? "",
          status,
        };
      })
      .sort((a: any, b: any) => {
        const av = a.daysOld ?? -1;
        const bv = b.daysOld ?? -1;
        return bv - av;
      });
  }, [quotesRaw, cycleMap]);

  const filteredStaleDeals = useMemo(() => {
    let list = staleDeals;
    if (staleStatus === "stale") {
      list = list.filter((j: any) => j.status === "pending" && (j.daysOld ?? 0) > 21);
    } else if (staleStatus !== "all") {
      list = list.filter((j: any) => j.status === staleStatus);
    }
    if (staleSort === "newest") {
      list = [...list].sort((a: any, b: any) => (a.daysOld ?? -1) - (b.daysOld ?? -1));
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
            {reasonBuckets.length === 0 ? (
              <div className="text-fluid-sm text-muted-foreground">No lost deals recorded.</div>
            ) : (
              <LossReasonList reasons={reasonBuckets} blankReasonCount={blankReasonCount} totalLost={lostJobs.length} />
            )}
          </div>
        </motion.section>

        {/* Section 3: Velocity */}
        <motion.section variants={item} className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          <div className="chart-container p-5 flex flex-col h-full">
            <h2 className="text-fluid-base font-semibold mb-1">Avg Days Per Stage</h2>
            <p className="text-fluid-xs text-muted-foreground mb-4">Avg days since quoted, by current stage</p>
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

            <div className="mt-4 pt-4 border-t border-border/40 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border/40 bg-card/30 p-3">
                <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground font-mono">
                  Median Quote → Won
                  <span title={`mean ${meanWon}d · ${wonDays.length} deals`}>
                    <Info className="text-muted-foreground/70 hover:text-foreground cursor-help transition-colors inline-block ml-0.5 align-middle" size={12} />
                  </span>
                </div>
                <div className="font-mono text-fluid-xl font-semibold text-chart-green mt-1">
                  {wonDays.length ? `${medianWon}d` : "—"}
                </div>
              </div>
              <div className="rounded-lg border border-border/40 bg-card/30 p-3">
                <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground font-mono">
                  Median Quote → Lost
                  <span title={`mean ${meanLost}d · ${lostDays.length} deals`}>
                    <Info className="text-muted-foreground/70 hover:text-foreground cursor-help transition-colors inline-block ml-0.5 align-middle" size={12} />
                  </span>
                </div>
                <div className="font-mono text-fluid-xl font-semibold text-red-400 mt-1">
                  {lostDays.length ? `${medianLost}d` : "—"}
                </div>
              </div>
            </div>
          </div>

          <div className="chart-container p-5 flex flex-col h-full">
            <h2 className="text-fluid-base font-semibold mb-1">Pipeline Velocity</h2>
            <p className="text-fluid-xs text-muted-foreground mb-4">Days in pipeline since quoting started (Date Created)</p>

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
                  { key: "lost", label: "Lost" },
                  { key: "stale", label: "Stale" },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setStaleStatus(opt.key as "all" | "pending" | "won" | "lost" | "stale")}
                    className={`text-[11px] px-2 py-1 rounded-full border transition-colors font-mono ${
                      staleStatus === opt.key
                        ? opt.key === "pending" || opt.key === "stale"
                          ? "bg-chart-orange/20 text-chart-orange border-chart-orange/40"
                          : opt.key === "lost"
                          ? "bg-red-500/25 text-red-400 border-red-500/40"
                          : "bg-chart-green/20 text-chart-green border-chart-green/40"
                        : "border-border text-muted-foreground hover:bg-secondary/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              {filteredStaleDeals.length === 0 ? (
                <div className="flex items-center gap-2 text-chart-green text-fluid-sm">
                  <CheckCircle2 className="w-4 h-4" /> No stale deals
                </div>
              ) : (
                <ul className="space-y-2">
                  {filteredStaleDeals.map((d: any) => {
                    const hasDays = typeof d.daysOld === "number" && d.measurable;
                    const sev = !hasDays
                      ? "bg-muted/30 text-muted-foreground border-border/40"
                      : d.daysOld >= 35
                        ? "bg-red-500/25 text-red-400 border-red-500/40"
                        : "bg-orange-500/20 text-orange-300 border-orange-500/40";
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
                          {hasDays ? `${d.daysOld}d` : "—"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
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

const LossReasonList = ({
  reasons,
  blankReasonCount,
  totalLost,
}: {
  reasons: { reason: string; count: number; pct: number }[];
  blankReasonCount: number;
  totalLost: number;
}) => {
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
      {blankReasonCount > 0 && (
        <div className="mt-4 pt-3 border-t border-border/40">
          <div className="flex items-center justify-between">
            <span className="font-mono text-fluid-xs uppercase tracking-wide text-chart-amber">
              No Reason Recorded
            </span>
            <span className="font-mono text-fluid-xs text-chart-amber">
              {blankReasonCount} · {((blankReasonCount / totalLost) * 100).toFixed(1)}%
            </span>
          </div>
          <div className="mt-1.5 h-[3px] w-full bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-chart-amber rounded-full"
              style={{ width: `${(blankReasonCount / totalLost) * 100}%` }}
            />
          </div>
          <p className="font-mono text-muted-foreground/60 mt-1.5" style={{ fontSize: "10px" }}>
            Chase these in the sheet — reason missing at last sync
          </p>
        </div>
      )}
    </div>
  );
};

export default DealFlow;
