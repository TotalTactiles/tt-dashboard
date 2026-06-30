import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { useRevenueTarget } from "@/hooks/useRevenueTarget";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { formatMetricValue } from "@/lib/formatMetricValue";
import ConfirmedYlwToggle from "@/components/ui/ConfirmedYlwToggle";
import PerformanceVsTarget from "@/components/dashboard/PerformanceVsTarget";

const fmtAUD = (n: number) => formatMetricValue(n, "currency");

const YLW_COLOR = "#E8B931";
const GREEN_COLOR = "hsl(var(--chart-green, 142 71% 45%))";

type Props = {
  currentRevenue?: number;
  wonValueTotal?: number;
  wonCount?: number;
};

const cardBase =
  "relative bg-card border border-border rounded-lg p-4 md:p-5 flex flex-col";

export default function TargetsGoalsSection(_props: Props) {
  const { target, setTarget } = useRevenueTarget();
  const {
    wonValueFY,
    salesMetrics,
  } = useDashboardData();

  // --- Lifted toggle state — defaults always Confirmed + Opportunities each load ---
  const [withYlw, setWithYlw] = useState<boolean>(false);
  const [funnelBasis, setFunnelBasis] = useState<"opportunities" | "leads">("opportunities");

  // --- Single source of truth: salesMetrics (matches Win/Loss + Conversion Rates cards) ---
  const ylwTopUp = salesMetrics.ylwValue;
  const goalConfirmed = salesMetrics.wonValue || wonValueFY;
  const goalWithYlw = goalConfirmed + ylwTopUp;
  const effectiveCurrent = withYlw ? goalWithYlw : goalConfirmed;

  const avgWonDeal = withYlw ? salesMetrics.avgWonWithYlw : salesMetrics.avgWon;
  const closeRatePct =
    funnelBasis === "leads"
      ? salesMetrics.pipelineRate
      : (withYlw ? salesMetrics.closeRateWithYlw : salesMetrics.closeRate);


  const pctConfirmed = target > 0 ? Math.min(100, (goalConfirmed / target) * 100) : 0;
  const pctYlw =
    target > 0 && withYlw ? Math.min(100 - pctConfirmed, (ylwTopUp / target) * 100) : 0;
  const pctTotal = Math.min(100, pctConfirmed + pctYlw);

  const remaining = Math.max(0, target - effectiveCurrent);
  const jobsToGoal =
    avgWonDeal > 0 && remaining > 0 ? Math.ceil(remaining / avgWonDeal) : 0;
  const oppsToGoal =
    jobsToGoal > 0 && closeRatePct > 0
      ? Math.ceil(jobsToGoal / (closeRatePct / 100))
      : 0;

  return (
    <>
      <div className="flex items-center gap-2 mb-3 px-1 mt-4">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Targets / Goals
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>
      <div className="flex flex-col gap-3 md:gap-4 mb-4 md:mb-6">
        <RevenueGoalCard
          target={target}
          setTarget={setTarget}
          goalConfirmed={goalConfirmed}
          effectiveCurrent={effectiveCurrent}
          pctConfirmed={pctConfirmed}
          pctYlw={pctYlw}
          pctTotal={pctTotal}
          remaining={remaining}
          withYlw={withYlw}
          setWithYlw={setWithYlw}
          ylwValue={ylwTopUp}
          jobsToGoal={jobsToGoal}
          avgWonDeal={avgWonDeal}
          oppsToGoal={oppsToGoal}
          closeRatePct={closeRatePct}
        />
        <PerformanceVsTarget
          target={target}
          wonToDate={effectiveCurrent}
          avgWon={avgWonDeal}
          closeRatePct={closeRatePct}
          funnelBasis={funnelBasis}
          setFunnelBasis={setFunnelBasis}
          withYlw={withYlw}
          ylwValue={ylwTopUp}
        />

      </div>
    </>
  );
}

function RevenueGoalCard({
  target,
  setTarget,
  goalConfirmed,
  effectiveCurrent,
  pctConfirmed,
  pctYlw,
  pctTotal,
  remaining,
  withYlw,
  setWithYlw,
  ylwValue,
  jobsToGoal,
  avgWonDeal,
  oppsToGoal,
  closeRatePct,
}: {
  target: number;
  setTarget: (n: number) => void;
  goalConfirmed: number;
  effectiveCurrent: number;
  pctConfirmed: number;
  pctYlw: number;
  pctTotal: number;
  remaining: number;
  withYlw: boolean;
  setWithYlw: (v: boolean) => void;
  ylwValue: number;
  jobsToGoal: number;
  avgWonDeal: number;
  oppsToGoal: number;
  closeRatePct: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(String(target || ""));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(String(target || ""));
  }, [target, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    const digits = draft.replace(/[^\d.]/g, "");
    const n = Number(digits);
    setTarget(isNaN(n) ? 0 : n);
    setEditing(false);
  };

  const chartData = [{ confirmed: pctConfirmed, ylw: pctYlw }];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cardBase}
    >
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/70">
          Revenue Goal
        </span>
        <ConfirmedYlwToggle withYlw={withYlw} setWithYlw={setWithYlw} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(220px,320px)_1fr] gap-4 md:gap-6 items-center">
        {/* Gauge */}
        <div className="relative flex items-center justify-center" style={{ minHeight: 200 }}>
          {target > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <RadialBarChart
                  innerRadius="72%"
                  outerRadius="100%"
                  data={chartData}
                  startAngle={90}
                  endAngle={-270}
                >
                  <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                  <RadialBar
                    background={{ fill: "rgba(229,233,234,0.08)" }}
                    dataKey="confirmed"
                    stackId="a"
                    cornerRadius={2}
                    fill={GREEN_COLOR}
                    angleAxisId={0}
                  />
                  <RadialBar
                    dataKey="ylw"
                    stackId="a"
                    cornerRadius={2}
                    fill={YLW_COLOR}
                    angleAxisId={0}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span
                  className="font-mono tabular-nums font-semibold"
                  style={{ fontSize: "clamp(1.5rem, 2.4vw, 2rem)", letterSpacing: "-0.02em" }}
                >
                  {pctTotal.toFixed(0)}%
                </span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                  of goal
                </span>
              </div>
            </>
          ) : (
            <div className="text-center text-sm text-muted-foreground px-4">
              Set a revenue goal to start tracking
            </div>
          )}
        </div>

        {/* Right column: Target + won/to-go + 4-up stats */}
        <div className="flex flex-col gap-3 min-w-0">
          <div className="flex flex-col items-start">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Target
            </span>
            {editing ? (
              <input
                ref={inputRef}
                type="text"
                inputMode="decimal"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                  if (e.key === "Escape") { setDraft(String(target || "")); setEditing(false); }
                }}
                className="w-full max-w-[240px] bg-secondary/60 border border-border rounded px-2 py-1 font-mono tabular-nums text-xl outline-none focus:border-primary"
                placeholder="$0"
              />
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="font-mono tabular-nums text-2xl md:text-3xl font-semibold hover:text-primary transition-colors text-left"
                style={{ letterSpacing: "-0.015em" }}
                title="Click to edit revenue target"
              >
                {target > 0 ? fmtAUD(target) : "Set target"}
              </button>
            )}
          </div>

          {target > 0 && (
            <div className="text-[13px] uppercase tracking-wider break-words">
              {withYlw ? (
                <div className="space-y-0.5">
                  <div>
                    <span className="font-mono tabular-nums text-chart-green">{fmtAUD(goalConfirmed)}</span>
                    <span className="text-muted-foreground"> + </span>
                    <span className="font-mono tabular-nums" style={{ color: YLW_COLOR }}>{fmtAUD(ylwValue)} YLW</span>
                    <span className="text-muted-foreground"> = </span>
                    <span className="font-mono tabular-nums text-foreground">{fmtAUD(effectiveCurrent)}</span>
                  </div>
                  <div>
                    {remaining > 0 ? (
                      <>
                        <span className="font-mono tabular-nums text-chart-red">{fmtAUD(remaining)}</span>{" "}
                        <span className="text-muted-foreground">to go</span>
                      </>
                    ) : (<span className="text-chart-green">Goal met 🎉</span>)}
                  </div>
                </div>
              ) : (
                <div>
                  <span className="font-mono tabular-nums text-chart-green">{fmtAUD(goalConfirmed)}</span>
                  <span className="text-muted-foreground"> won</span>
                  {remaining > 0 ? (
                    <>
                      <span className="text-muted-foreground"> · </span>
                      <span className="font-mono tabular-nums text-chart-red">{fmtAUD(remaining)}</span>{" "}
                      <span className="text-muted-foreground">to go</span>
                    </>
                  ) : (<> · <span className="text-chart-green">Goal met 🎉</span></>)}
                </div>
              )}
            </div>
          )}

          {/* 4-up stat row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
            <MiniStat label="Jobs to Goal" value={target > 0 ? (remaining === 0 ? "✓" : String(jobsToGoal)) : "—"} />
            <MiniStat label="Avg Won" value={avgWonDeal > 0 ? fmtAUD(avgWonDeal) : "—"} />
            <MiniStat label="Opps to Goal" value={target > 0 && oppsToGoal > 0 ? String(oppsToGoal) : "—"} />
            <MiniStat label="Close Rate" value={closeRatePct > 0 ? `${closeRatePct.toFixed(1)}%` : "—"} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-secondary/30 border border-border/60 rounded px-2.5 py-2 flex flex-col items-start min-w-0">
      <span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground whitespace-nowrap">
        {label}
      </span>
      <span
        className="font-mono tabular-nums font-semibold text-foreground mt-0.5 truncate w-full"
        style={{ fontSize: "clamp(1rem, 1.4vw, 1.35rem)", letterSpacing: "-0.015em" }}
      >
        {value}
      </span>
    </div>
  );
}
