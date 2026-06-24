import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { useRevenueTarget } from "@/hooks/useRevenueTarget";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { formatMetricValue } from "@/lib/formatMetricValue";

const fmtAUD = (n: number) => formatMetricValue(n, "currency");

type Props = {
  /** YTD actual revenue (gross). Swap to netRevenue for ex-GST comparison. */
  currentRevenue: number;
  /** Sum of won-job values */
  wonValueTotal: number;
  /** Count of won jobs */
  wonCount: number;
};

const cardBase =
  "relative bg-card border border-border rounded-lg p-4 md:p-5 flex flex-col";

function PillToggle({
  withYlw,
  setWithYlw,
}: {
  withYlw: boolean;
  setWithYlw: (v: boolean) => void;
}) {
  const base =
    "px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-semibold transition-colors border";
  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => setWithYlw(false)}
        className={
          base +
          " " +
          (!withYlw
            ? "bg-secondary text-foreground border-border"
            : "bg-transparent text-muted-foreground border-transparent hover:text-foreground")
        }
      >
        Confirmed
      </button>
      <button
        type="button"
        onClick={() => setWithYlw(true)}
        className={
          base +
          " " +
          (withYlw
            ? "bg-secondary text-foreground border-border"
            : "bg-transparent text-muted-foreground border-transparent hover:text-foreground")
        }
      >
        With YLWs
      </button>
    </div>
  );
}

export default function TargetsGoalsSection({
  currentRevenue,
  wonValueTotal,
  wonCount,
}: Props) {
  const { target, setTarget } = useRevenueTarget();
  const { ylwValue } = useDashboardData();
  const [withYlw, setWithYlw] = useState(false);

  const avgWonDeal = wonCount > 0 ? wonValueTotal / wonCount : 0;
  const effectiveCurrent = withYlw ? currentRevenue + ylwValue : currentRevenue;
  const pct = target > 0 ? Math.min(100, (effectiveCurrent / target) * 100) : 0;
  const remaining = Math.max(0, target - effectiveCurrent);
  const jobsToGoal = avgWonDeal > 0 && remaining > 0 ? Math.ceil(remaining / avgWonDeal) : 0;

  return (
    <>
      <div className="flex items-center gap-2 mb-3 px-1 mt-4">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Targets / Goals
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>
      <div
        className="grid grid-cols-1 md:grid-cols-2 items-stretch mb-4 md:mb-6"
        style={{ gap: "clamp(8px, 1vw, 16px)" }}
      >
        <RevenueGoalCard
          target={target}
          setTarget={setTarget}
          currentRevenue={currentRevenue}
          pct={pct}
          remaining={remaining}
          withYlw={withYlw}
          setWithYlw={setWithYlw}
          ylwValue={ylwValue}
        />
        <JobsToGoalCard
          target={target}
          jobsToGoal={jobsToGoal}
          avgWonDeal={avgWonDeal}
          remaining={remaining}
          withYlw={withYlw}
          setWithYlw={setWithYlw}
          ylwValue={ylwValue}
        />
      </div>
    </>
  );
}

function RevenueGoalCard({
  target,
  setTarget,
  currentRevenue,
  pct,
  remaining,
  withYlw,
  setWithYlw,
  ylwValue,
}: {
  target: number;
  setTarget: (n: number) => void;
  currentRevenue: number;
  pct: number;
  remaining: number;
  withYlw: boolean;
  setWithYlw: (v: boolean) => void;
  ylwValue: number;
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

  const chartData = [{ name: "pct", value: pct, fill: "hsl(var(--chart-green, 142 71% 45%))" }];

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
        <PillToggle withYlw={withYlw} setWithYlw={setWithYlw} />
      </div>

      {/* Editable target — prominent */}
      <div className="flex flex-col items-center mb-2">
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
              if (e.key === "Escape") {
                setDraft(String(target || ""));
                setEditing(false);
              }
            }}
            className="w-full max-w-[240px] bg-secondary/60 border border-border rounded px-2 py-1 text-center font-mono tabular-nums text-xl outline-none focus:border-primary"
            placeholder="$0"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="font-mono tabular-nums text-2xl md:text-3xl font-semibold hover:text-primary transition-colors"
            style={{ letterSpacing: "-0.015em" }}
            title="Click to edit revenue target"
          >
            {target > 0 ? fmtAUD(target) : "Set target"}
          </button>
        )}
      </div>

      {/* Gauge */}
      <div className="relative flex-1 flex items-center justify-center" style={{ minHeight: 160 }}>
        {target > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={180}>
              <RadialBarChart
                innerRadius="72%"
                outerRadius="100%"
                data={chartData}
                startAngle={90}
                endAngle={-270}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar
                  background={{ fill: "hsl(var(--muted))" }}
                  dataKey="value"
                  cornerRadius={8}
                  fill="hsl(var(--chart-green, 142 71% 45%))"
                />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span
                className="font-mono tabular-nums font-semibold"
                style={{ fontSize: "clamp(1.5rem, 2.4vw, 2rem)", letterSpacing: "-0.02em" }}
              >
                {pct.toFixed(0)}%
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

      {/* Footer caption */}
      {target > 0 && (
        <div className="mt-2 text-center text-[15px] uppercase tracking-wider text-muted-foreground whitespace-normal break-words">
          <span className="font-mono tabular-nums text-chart-green">{fmtAUD(currentRevenue)}</span>{" "}
          of <span className="font-mono tabular-nums text-foreground">{fmtAUD(target)}</span>
          {remaining > 0 ? (
            <>
              {" · "}
              <span className="font-mono tabular-nums text-chart-red">{fmtAUD(remaining)}</span> to go
            </>
          ) : (
            <> · <span className="text-chart-green">Goal met 🎉</span></>
          )}
          {withYlw && ylwValue > 0 && (
            <div className="mt-1 text-[11px] normal-case tracking-normal text-muted-foreground/80">
              incl. <span className="font-mono tabular-nums">{fmtAUD(ylwValue)}</span> YLW
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

function JobsToGoalCard({
  target,
  jobsToGoal,
  avgWonDeal,
  remaining,
  withYlw,
  setWithYlw,
  ylwValue,
}: {
  target: number;
  jobsToGoal: number;
  avgWonDeal: number;
  remaining: number;
  withYlw: boolean;
  setWithYlw: (v: boolean) => void;
  ylwValue: number;
}) {
  const empty = target === 0;
  const met = !empty && remaining === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.05 }}
      className={cardBase}
    >
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/70">
          Jobs to Goal
        </span>
        <PillToggle withYlw={withYlw} setWithYlw={setWithYlw} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
        <span
          className="font-mono tabular-nums font-semibold text-chart-green"
          style={{ fontSize: "clamp(2.5rem, 6vw, 4.5rem)", letterSpacing: "-0.02em", lineHeight: 1 }}
        >
          {empty ? "—" : met ? "Goal met 🎉" : jobsToGoal}
        </span>
        {!empty && !met && (
          <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            Jobs to Goal
          </span>
        )}
      </div>

      <div className="mt-2 text-center text-xs text-muted-foreground space-y-0.5 whitespace-normal break-words">
        {empty ? (
          <div>Set a revenue goal to compute jobs needed</div>
        ) : (
          <>
            <div>
              at avg won{" "}
              <span className="font-mono tabular-nums text-foreground">
                {avgWonDeal > 0 ? fmtAUD(avgWonDeal) : "—"}
              </span>
            </div>
            {!met && (
              <div>
                <span className="font-mono tabular-nums text-foreground">{fmtAUD(remaining)}</span>{" "}
                remaining
              </div>
            )}
            {withYlw && ylwValue > 0 && (
              <div className="text-[11px] text-muted-foreground/80">
                incl. <span className="font-mono tabular-nums">{fmtAUD(ylwValue)}</span> YLW
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
