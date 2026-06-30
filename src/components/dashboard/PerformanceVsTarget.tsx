import { useEffect, useMemo, useState, ReactNode } from "react";
import { motion } from "framer-motion";
import { formatMetricValue } from "@/lib/formatMetricValue";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { useCrmStages } from "@/hooks/useCrmStages";

const fmtAUD = (n: number) => formatMetricValue(n, "currency");

const cardBase =
  "relative bg-card border border-border rounded-lg p-4 md:p-5 flex flex-col";

const VIEW_KEY = "tt_pace_view";

type PaceChoice = "ytd" | "2026" | "custom";

type Props = {
  target: number;
  wonToDate: number;
  avgWon: number;
  closeRatePct: number; // 0-100 — basis-appropriate displayed rate (close for opps, pipeline for leads)
  funnelBasis: "opportunities" | "leads";
  setFunnelBasis: (v: "opportunities" | "leads") => void;
  withYlw?: boolean;
  ylwValue?: number;
};

type PaceState = { choice: PaceChoice; customStart?: string; customEnd?: string };

function loadPace(): PaceState {
  try {
    const raw = localStorage.getItem(VIEW_KEY);
    if (raw) {
      // Back-compat: old raw values 'ytd' | '2026'
      if (raw === "ytd" || raw === "2026" || raw === "custom") {
        return { choice: raw as PaceChoice };
      }
      const p = JSON.parse(raw);
      if (p && typeof p === "object") {
        const choice: PaceChoice =
          p.choice === "ytd" || p.choice === "custom" ? p.choice : "2026";
        return { choice, customStart: p.customStart, customEnd: p.customEnd };
      }
    }
  } catch {}
  return { choice: "2026" };
}

function resolveWindow(p: PaceState): { start: Date; end: Date; label: string; creditCommitted: boolean } {
  if (p.choice === "ytd") {
    return {
      start: new Date(2026, 0, 1),
      end: new Date(),
      label: "YTD",
      creditCommitted: false,
    };
  }
  if (p.choice === "custom") {
    const s = p.customStart ? new Date(p.customStart) : new Date(2026, 0, 1);
    const e = p.customEnd ? new Date(p.customEnd) : new Date(2026, 11, 31);
    return { start: s, end: e, label: "Custom", creditCommitted: true };
  }
  return {
    start: new Date(2026, 0, 1),
    end: new Date(2026, 11, 31),
    label: "2026",
    creditCommitted: true,
  };
}


function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function parseLoose(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  const m = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/);
  if (m) {
    const dt = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
    if (!isNaN(dt.getTime())) return dt;
  }
  return null;
}

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function PerformanceVsTarget({
  target,
  wonToDate,
  avgWon,
  closeRatePct,
  funnelBasis,
  setFunnelBasis,
  withYlw = false,
  ylwValue = 0,
}: Props) {
  const { quotedJobs } = useDashboardData();
  const { quotingOpp, totalLeads } = useCrmStages();

  const [period, setPeriod] = useState<PeriodState>(loadPeriod);
  const [view, setView] = useState<PaceView>(loadView);

  useEffect(() => {
    try { localStorage.setItem(PERIOD_KEY, JSON.stringify(period)); } catch {}
  }, [period]);
  useEffect(() => {
    try { localStorage.setItem(VIEW_KEY, view); } catch {}
  }, [view]);

  const { start, end, label } = resolveWindow(period);
  const today = new Date();

  const totalMonths = Math.max(1, monthsBetween(start, end) + 1);
  const elapsedRaw = monthsBetween(start, today) + 1;
  const monthsElapsed = Math.min(Math.max(elapsedRaw, 0), totalMonths);
  const monthsRemaining = Math.max(totalMonths - monthsElapsed, 0);

  // ===== ANCHORED WON TOTAL — single source of truth = Revenue Goal card =====
  // wonToDate prop is `effectiveCurrent` (Confirmed or With-YLW) from TargetsGoalsSection.
  const wonTotal = Math.max(0, wonToDate);

  // Future-scheduled jobs (won + YLW when in With-YLW mode), bucketed by Est. Job Date.
  // Mirrors cashflow: all future jobs sit in one teal series.
  const { committedFutureTotal, committedByMonth } = useMemo(() => {
    const arr = new Array<number>(totalMonths + 1).fill(0);
    const statuses = withYlw ? ["won", "yellow"] : ["won"];
    const futureJobs = (quotedJobs ?? []).filter((j) => statuses.includes(j.status));
    let sum = 0;
    for (const j of futureJobs) {
      const v = Number(j.value) || 0;
      if (v <= 0) continue;
      const d = parseLoose(j.dateQuoted);
      if (!d || d <= today) continue;
      if (d < start || d > end) continue;
      const m = monthsBetween(start, d) + 1;
      if (m >= 1 && m <= totalMonths) {
        arr[m] += v;
        sum += v;
      }
    }
    // Cap to wonTotal so cumulative committed never overshoots the anchored headline.
    const capped = Math.min(sum, wonTotal);
    if (sum > 0 && capped < sum) {
      const scale = capped / sum;
      for (let i = 1; i <= totalMonths; i++) arr[i] *= scale;
    }
    return { committedFutureTotal: capped, committedByMonth: arr };
  }, [quotedJobs, start, end, today, totalMonths, withYlw, wonTotal]);

  const committedFutureWon = committedFutureTotal;
  const wonRealizedYTD = Math.max(0, wonTotal - committedFutureWon);


  // Active CRM pipeline denominator — matches the funnel toggle
  const activePipeline =
    funnelBasis === "leads"
      ? Number(totalLeads) || 0
      : Number(quotingOpp?.count) || 0;

  const securedTotal = view === "2026" ? wonTotal : wonRealizedYTD;
  const remaining = Math.max(target - securedTotal, 0);

  // Status banner: banked vs linear expected (not toggle-sensitive)
  const expectedToDate = target > 0 ? target * (monthsElapsed / totalMonths) : 0;
  const paceGap = securedTotal - expectedToDate;

  const actualRunRate = monthsElapsed > 0 ? securedTotal / monthsElapsed : 0;
  const requiredRunRate = monthsRemaining > 0 ? remaining / monthsRemaining : null;
  const runRateUplift =
    actualRunRate > 0 && requiredRunRate != null
      ? (requiredRunRate / actualRunRate - 1) * 100
      : null;

  const jobsToGoalRaw = avgWon > 0 ? remaining / avgWon : null;
  const jobsToGoal = jobsToGoalRaw != null ? Math.ceil(jobsToGoalRaw) : null;
  const requiredJobsPerMonth =
    jobsToGoalRaw != null && monthsRemaining > 0 ? Math.ceil(jobsToGoalRaw / monthsRemaining) : null;
  const oppsToGoalRaw =
    jobsToGoalRaw != null && closeRatePct > 0 ? jobsToGoalRaw / (closeRatePct / 100) : null;
  const requiredOppsPerMonth =
    oppsToGoalRaw != null && monthsRemaining > 0 ? Math.ceil(oppsToGoalRaw / monthsRemaining) : null;

  // Required close rate to hit — denominator = active CRM pipeline (matches funnel toggle)
  const requiredCloseRate =
    jobsToGoalRaw != null && activePipeline > 0 && Number.isFinite(jobsToGoalRaw)
      ? (jobsToGoalRaw / activePipeline) * 100
      : null;

  // bankedWon retained for status banner phrasing parity
  const bankedWon = securedTotal;


  type Status = { label: string; tone: "green" | "amber" | "red" | "neutral"; sub: string };
  const status: Status = useMemo(() => {
    if (target <= 0) return { label: "NO TARGET", tone: "neutral", sub: "Set a revenue target to track pace." };
    if (monthsRemaining === 0) {
      const pct = target > 0 ? (bankedWon / target) * 100 : 0;
      return {
        label: "PERIOD CLOSED",
        tone: "neutral",
        sub: `Final attainment ${pct.toFixed(1)}% of ${fmtAUD(target)}.`,
      };
    }
    const hi = expectedToDate * 1.02;
    const lo = expectedToDate * 0.98;
    if (bankedWon > hi) {
      return {
        label: "ABOVE PACE",
        tone: "green",
        sub: `${fmtAUD(Math.abs(paceGap))} ahead of where you should be at month ${monthsElapsed} of ${totalMonths}.`,
      };
    }
    if (bankedWon < lo) {
      const worse15 = paceGap < -target * 0.15;
      return {
        label: "BEHIND PACE",
        tone: worse15 ? "red" : "amber",
        sub: `${fmtAUD(Math.abs(paceGap))} behind where you should be at month ${monthsElapsed} of ${totalMonths}.`,
      };
    }
    return {
      label: "ON TRACK",
      tone: "green",
      sub: `Within ±2% of linear pace at month ${monthsElapsed} of ${totalMonths}.`,
    };
  }, [target, bankedWon, expectedToDate, paceGap, monthsElapsed, totalMonths, monthsRemaining]);

  const toneClass = {
    green: "bg-chart-green/15 text-chart-green border-chart-green/30",
    amber: "bg-[#E8B931]/15 text-[#E8B931] border-[#E8B931]/30",
    red: "bg-chart-red/15 text-chart-red border-chart-red/30",
    neutral: "bg-muted/40 text-muted-foreground border-border",
  }[status.tone];

  // Deterministic cumulative pace data
  const chartData = useMemo(() => {
    const rows: Array<{
      idx: number;
      label: string;
      targetCum: number;
      actualCum: number | null;
      committedCum: number | null;
      isFuture: boolean;
    }> = [];
    if (target <= 0 || totalMonths <= 0) return rows;
    const startMonthIdx = start.getMonth();
    let committedRunning = wonRealizedYTD;
    for (let m = 1; m <= totalMonths; m++) {
      const isFuture = m > monthsElapsed;
      const targetCum = target * (m / totalMonths);
      const actualCum = isFuture
        ? null
        : wonRealizedYTD * (m / Math.max(monthsElapsed, 1));
      if (isFuture) committedRunning += committedByMonth[m] || 0;
      const committedCum = isFuture && view === "2026" ? committedRunning : null;
      rows.push({
        idx: m,
        label: MONTH_SHORT[(startMonthIdx + m - 1) % 12],
        targetCum,
        actualCum,
        committedCum,
        isFuture,
      });
    }
    return rows;
  }, [target, totalMonths, monthsElapsed, wonRealizedYTD, start, view, committedByMonth]);

  const TRACK_H = 56;
  const maxVal = target;

  // Cadence labels follow the funnel toggle
  const cadenceTitle = funnelBasis === "leads" ? "Leads / Month" : "Opps / Month";
  const rateNoun = funnelBasis === "leads" ? "pipeline rate" : "close";
  const funnelNounUpper = funnelBasis === "leads" ? "LEADS" : "OPPS";
  const funnelNounLower = funnelBasis === "leads" ? "leads" : "opps";

  // Close rate sub-label — "on current pipeline" framing
  let crSub: ReactNode = "—";
  let crSubTone: "muted" | "green" | "red" | "amber" = "muted";
  let crValue = "N/A";
  if (activePipeline <= 0) {
    crSub = "N/A · awaiting CRM pipeline count";
  } else if (requiredCloseRate == null) {
    crSub = "—";
  } else if (requiredCloseRate > 100) {
    crValue = ">100%";
    crSub = `live pipeline too thin — generate new ${funnelNounLower} (see ${funnelNounUpper}/MONTH)`;
    crSubTone = "red";
  } else if (requiredCloseRate <= closeRatePct) {
    crValue = `${requiredCloseRate.toFixed(1)}%`;
    crSub = `your live pipeline covers it (current ${closeRatePct.toFixed(1)}%)`;
    crSubTone = "green";
  } else {
    crValue = `${requiredCloseRate.toFixed(1)}%`;
    crSub = `lift live-pipeline conversion to ${requiredCloseRate.toFixed(1)}% (now ${closeRatePct.toFixed(1)}%)`;
    crSubTone = "amber";
  }


  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.05 }}
      className={cardBase}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/70">
          Performance vs Target
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          · linear pace · month {monthsElapsed} of {totalMonths}
        </span>
        <div className="flex-1" />
        <PeriodSelector period={period} setPeriod={setPeriod} />
        <ViewToggle value={view} onChange={setView} />

      </div>

      {/* Status banner */}
      <div className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 border rounded-md px-3 py-2 mb-1 ${toneClass}`}>
        <span className="text-xs font-bold uppercase tracking-wider">{status.label}</span>
        <span className="text-xs text-muted-foreground">{status.sub}</span>
        <div className="flex-1" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      {view === "2026" && committedFutureWon > 0 && (
        <div className="text-[10px] text-muted-foreground mb-4 px-1">
          committed wins cover {fmtAUD(committedFutureWon)} of the remaining gap
        </div>
      )}
      {!(view === "2026" && committedFutureWon > 0) && <div className="mb-4" />}

      {/* Required performance grid */}
      <div
        className="grid gap-3 mb-4"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}
      >
        <RequiredCard
          label="Required Run-Rate"
          value={requiredRunRate != null ? `${fmtAUD(requiredRunRate)}/mo` : "N/A"}
          sub={
            runRateUplift == null
              ? `current ${actualRunRate > 0 ? fmtAUD(actualRunRate) + "/mo" : "—"}`
              : `${runRateUplift >= 0 ? "+" : ""}${runRateUplift.toFixed(0)}% vs your ${fmtAUD(actualRunRate)}/mo`
          }
          subTone={runRateUplift == null ? "muted" : runRateUplift > 0 ? "red" : "green"}
        />
        <RequiredCard
          label="Jobs / Month"
          value={requiredJobsPerMonth != null ? String(requiredJobsPerMonth) : "N/A"}
          sub={
            jobsToGoal != null && monthsRemaining > 0
              ? `${jobsToGoal} jobs ÷ ${monthsRemaining} mo`
              : "—"
          }
        />
        <RequiredCard
          label={cadenceTitle}
          value={requiredOppsPerMonth != null ? String(requiredOppsPerMonth) : "N/A"}
          sub={closeRatePct > 0 ? `at ${closeRatePct.toFixed(1)}% ${rateNoun}` : `no ${rateNoun}`}
        />
        <RequiredCard
          label="Close Rate to Hit"
          subLabel="on current pipeline"
          value={crValue}
          sub={crSub}
          subTone={crSubTone}
        />
      </div>

      {/* Cumulative pace mini-chart */}
      <div className="border border-border/60 rounded-md p-3">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Cumulative pace <span className="opacity-60">(est.)</span>
          </span>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[8.1px] uppercase tracking-wider text-muted-foreground max-w-full">
            <Legend swatch="bg-muted-foreground/40" label="Target pace" />
            <Legend swatch="bg-chart-green" label="Actual (on/ahead)" />
            <Legend swatch="bg-[#E8B931]" label="Actual (behind)" />
            {view === "2026" && <Legend swatch="bg-[#2DD4BF]" label={withYlw ? "Committed (won+YLW, future)" : "Committed (won, future)"} />}
          </div>
        </div>


        {maxVal <= 0 || totalMonths <= 0 || chartData.length === 0 ? (
          <div className="text-xs text-muted-foreground py-4 text-center">No target set</div>
        ) : (
          <>
            <div className="flex items-end gap-[3px]" style={{ height: TRACK_H }}>
              {chartData.map((r) => {
                const tH = Math.round((r.targetCum / maxVal) * TRACK_H);
                const aRaw = r.actualCum ?? 0;
                const aH = Math.round((aRaw / maxVal) * TRACK_H);
                const cRaw = r.committedCum ?? 0;
                const cH = Math.round((cRaw / maxVal) * TRACK_H);
                const onTrack = r.actualCum != null && r.actualCum >= r.targetCum;
                return (
                  <div key={r.idx} className="flex-1 flex items-end gap-[1px] min-w-0">
                    <div
                      className={`flex-1 rounded-sm ${r.isFuture ? "bg-muted-foreground/15" : "bg-muted-foreground/40"}`}
                      style={{ height: `${Math.max(tH, r.targetCum > 0 ? 2 : 0)}px` }}
                      title={`${r.label} target ${fmtAUD(r.targetCum)}`}
                    />
                    {!r.isFuture && r.actualCum != null && (
                      <div
                        className={`flex-1 rounded-sm ${onTrack ? "bg-chart-green" : "bg-[#E8B931]"}`}
                        style={{ height: `${Math.max(aH, aRaw > 0 ? 2 : 0)}px` }}
                        title={`${r.label} actual ${fmtAUD(aRaw)}`}
                      />
                    )}
                    {r.isFuture && r.committedCum != null && (
                      <div
                        className="flex-1 rounded-sm bg-[#2DD4BF]"
                        style={{ height: `${Math.max(cH, cRaw > 0 ? 2 : 0)}px` }}
                        title={`${r.label} committed ${fmtAUD(cRaw)}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-[3px] mt-1">
              {chartData.map((r) => (
                <div
                  key={r.idx}
                  className="flex-1 text-center text-[8px] font-mono text-muted-foreground min-w-0 truncate"
                >
                  {r.label}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

function RequiredCard({
  label,
  subLabel,
  value,
  sub,
  subTone = "muted",
}: {
  label: string;
  subLabel?: string;
  value: string;
  sub: ReactNode;
  subTone?: "muted" | "green" | "red" | "amber";
}) {
  const subClass = {
    muted: "text-muted-foreground",
    green: "text-chart-green",
    red: "text-chart-red",
    amber: "text-[#E8B931]",
  }[subTone];
  return (
    <div className="bg-secondary/30 border border-border/60 rounded px-3 py-2.5">
      <div className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">{label}</div>
      {subLabel && (
        <div className="text-[8px] uppercase tracking-wider text-muted-foreground/70 -mt-0.5">{subLabel}</div>
      )}
      <div
        className="font-mono tabular-nums font-semibold text-foreground mt-1"
        style={{ fontSize: "clamp(1.1rem, 1.5vw, 1.5rem)", letterSpacing: "-0.015em" }}
      >
        {value}
      </div>
      <div className={`text-[10px] mt-0.5 ${subClass}`}>{sub}</div>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`inline-block w-2 h-2 rounded-sm ${swatch}`} />
      {label}
    </span>
  );
}

function PeriodSelector({
  period,
  setPeriod,
}: {
  period: PeriodState;
  setPeriod: (p: PeriodState) => void;
}) {
  const choices: { id: PeriodChoice; label: string }[] = [
    { id: "2026", label: "2026" },
    { id: "custom", label: "Custom" },
  ];
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="flex rounded-full bg-secondary/80 p-0.5 leading-none"
        style={{ fontSize: "clamp(8px, 0.85vw, 10px)" }}
      >
        {choices.map((c) => {
          const active = period.choice === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setPeriod({ ...period, choice: c.id })}
              className={`px-1.5 py-0.5 rounded-full font-mono whitespace-nowrap transition-colors ${
                active ? "text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
              style={active ? { backgroundColor: "#3D89DA" } : undefined}
            >
              {c.label}
            </button>
          );
        })}
      </div>
      {period.choice === "custom" && (
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={period.customStart ?? ""}
            onChange={(e) => setPeriod({ ...period, customStart: e.target.value })}
            className="bg-secondary/60 border border-border rounded px-1.5 py-0.5 text-[10px] font-mono"
          />
          <span className="text-[10px] text-muted-foreground">–</span>
          <input
            type="date"
            value={period.customEnd ?? ""}
            onChange={(e) => setPeriod({ ...period, customEnd: e.target.value })}
            className="bg-secondary/60 border border-border rounded px-1.5 py-0.5 text-[10px] font-mono"
          />
        </div>
      )}
    </div>
  );
}

function ViewToggle({
  value,
  onChange,
}: {
  value: PaceView;
  onChange: (v: PaceView) => void;
}) {
  const opts: { id: PaceView; label: string }[] = [
    { id: "ytd", label: "YTD" },
    { id: "2026", label: "2026" },
  ];
  return (
    <div
      className="flex rounded-full bg-secondary/80 p-0.5 leading-none"
      style={{ fontSize: "clamp(8px, 0.85vw, 10px)" }}
    >
      {opts.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`px-1.5 py-0.5 rounded-full font-mono whitespace-nowrap transition-colors ${
              active ? "text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
            style={active ? { backgroundColor: "#3D89DA" } : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function FunnelToggle({
  value,
  onChange,
}: {
  value: "opportunities" | "leads";
  onChange: (v: "opportunities" | "leads") => void;
}) {
  return (
    <div
      className="flex rounded-full bg-secondary/80 p-0.5 leading-none"
      style={{ fontSize: "clamp(8px, 0.85vw, 10px)" }}
    >
      <button
        type="button"
        onClick={() => onChange("opportunities")}
        className={`px-1.5 py-0.5 rounded-full font-mono whitespace-nowrap transition-colors ${
          value === "opportunities" ? "text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
        }`}
        style={value === "opportunities" ? { backgroundColor: "#3D89DA" } : undefined}
      >
        Opportunities
      </button>
      <button
        type="button"
        onClick={() => onChange("leads")}
        className={`px-1.5 py-0.5 rounded-full font-mono whitespace-nowrap transition-colors ${
          value === "leads" ? "text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
        }`}
        style={value === "leads" ? { backgroundColor: "#3D89DA" } : undefined}
      >
        Leads
      </button>
    </div>
  );
}
