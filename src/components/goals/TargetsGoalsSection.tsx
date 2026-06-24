import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { useRevenueTarget } from "@/hooks/useRevenueTarget";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { formatMetricValue } from "@/lib/formatMetricValue";
import ConfirmedYlwToggle from "@/components/ui/ConfirmedYlwToggle";

const fmtAUD = (n: number) => formatMetricValue(n, "currency");

const YLW_COLOR = "#E8B931";
const GREEN_COLOR = "hsl(var(--chart-green, 142 71% 45%))";

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

export default function TargetsGoalsSection({
  currentRevenue,
  wonValueTotal,
  wonCount,
}: Props) {
  const { target, setTarget } = useRevenueTarget();
  const { ylwValue, getLeadsToGoal, pipelineConversion } = useDashboardData();
  const [withYlw, setWithYlw] = useState(false);

  const avgWonDeal = wonCount > 0 ? wonValueTotal / wonCount : 0;

  // Stacked gauge composition.
  const pctConfirmed = target > 0 ? Math.min(100, (currentRevenue / target) * 100) : 0;
  const pctYlw =
    target > 0 && withYlw ? Math.min(100 - pctConfirmed, (ylwValue / target) * 100) : 0;
  const pctTotal = Math.min(100, pctConfirmed + pctYlw);

  const effectiveCurrent = withYlw ? currentRevenue + ylwValue : currentRevenue;
  const remaining = Math.max(0, target - effectiveCurrent);
  const jobsToGoal =
    avgWonDeal > 0 && remaining > 0 ? Math.ceil(remaining / avgWonDeal) : 0;
  const oppsToGoal = getLeadsToGoal(jobsToGoal);

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
          className="md:col-span-2"
          target={target}
          setTarget={setTarget}
          currentRevenue={currentRevenue}
          effectiveCurrent={effectiveCurrent}
          pctConfirmed={pctConfirmed}
          pctYlw={pctYlw}
          pctTotal={pctTotal}
          remaining={remaining}
          withYlw={withYlw}
          setWithYlw={setWithYlw}
          ylwValue={ylwValue}
        />
        <JobsToGoalCard
          target={target}
          jobsToGoal={jobsToGoal}
          avgWonDeal={avgWonDeal}
          currentRevenue={currentRevenue}
          effectiveCurrent={effectiveCurrent}
          remaining={remaining}
          withYlw={withYlw}
          setWithYlw={setWithYlw}
          ylwValue={ylwValue}
        />
        <LeadsToGoalCard
          target={target}
          leadsToGoal={oppsToGoal}
          avgWonDeal={avgWonDeal}
          pipelineConversion={pipelineConversion}
          remaining={remaining}
          withYlw={withYlw}
          setWithYlw={setWithYlw}
        />
      </div>
    </>
  );
}

function RevenueGoalCard({
  target,
  setTarget,
  currentRevenue,
  effectiveCurrent,
  pctConfirmed,
  pctYlw,
  pctTotal,
  remaining,
  withYlw,
  setWithYlw,
  ylwValue,
  className,
}: {
  target: number;
  setTarget: (n: number) => void;
  currentRevenue: number;
  effectiveCurrent: number;
  pctConfirmed: number;
  pctYlw: number;
  pctTotal: number;
  remaining: number;
  withYlw: boolean;
  setWithYlw: (v: boolean) => void;
  ylwValue: number;
  className?: string;
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

  // Single data point with two stacked dataKeys (confirmed + ylw).
  const chartData = [{ confirmed: pctConfirmed, ylw: pctYlw }];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`${cardBase} ${className ?? ""}`}
    >
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/70">
          Revenue Goal
        </span>
        <ConfirmedYlwToggle withYlw={withYlw} setWithYlw={setWithYlw} />
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

      {/* Stacked gauge: green confirmed + yellow YLW top-up over grey track */}
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

      {/* Composition: colour-coded breakdown mirroring the gauge */}
      {target > 0 && (
        <div className="mt-2 text-center text-[15px] uppercase tracking-wider whitespace-normal break-words space-y-0.5">
          {withYlw ? (
            <>
              <div className="min-w-0 break-words">
                <span className="font-mono tabular-nums text-chart-green">
                  {fmtAUD(currentRevenue)}
                </span>
                <span className="text-muted-foreground"> + </span>
                <span className="font-mono tabular-nums" style={{ color: YLW_COLOR }}>
                  {fmtAUD(ylwValue)} YLW
                </span>
                <span className="text-muted-foreground"> = </span>
                <span className="font-mono tabular-nums text-foreground">
                  {fmtAUD(effectiveCurrent)}
                </span>
              </div>
              <div>
                {remaining > 0 ? (
                  <>
                    <span className="font-mono tabular-nums text-chart-red">
                      {fmtAUD(remaining)}
                    </span>{" "}
                    <span className="text-muted-foreground">to go</span>
                  </>
                ) : (
                  <span className="text-chart-green">Goal met 🎉</span>
                )}
              </div>
            </>
          ) : (
            <div className="min-w-0 break-words">
              <span className="font-mono tabular-nums text-chart-green">
                {fmtAUD(currentRevenue)}
              </span>
              {remaining > 0 ? (
                <>
                  <span className="text-muted-foreground"> · </span>
                  <span className="font-mono tabular-nums text-chart-red">
                    {fmtAUD(remaining)}
                  </span>{" "}
                  <span className="text-muted-foreground">to go</span>
                </>
              ) : (
                <> · <span className="text-chart-green">Goal met 🎉</span></>
              )}
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
  currentRevenue,
  effectiveCurrent,
  remaining,
  withYlw,
  setWithYlw,
  ylwValue,
  className,
}: {
  target: number;
  jobsToGoal: number;
  avgWonDeal: number;
  currentRevenue: number;
  effectiveCurrent: number;
  remaining: number;
  withYlw: boolean;
  setWithYlw: (v: boolean) => void;
  ylwValue: number;
  className?: string;
}) {
  const empty = target === 0;
  const met = !empty && remaining === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.05 }}
      className={`${cardBase} ${className ?? ""}`}
    >
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/70">
          Jobs to Goal
        </span>
        <ConfirmedYlwToggle withYlw={withYlw} setWithYlw={setWithYlw} />
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

      {/* Composition: AVG WON line + colour-coded breakdown */}
      <div className="mt-2 text-center text-[15px] uppercase tracking-wider whitespace-normal break-words space-y-0.5">
        {empty ? (
          <div className="text-muted-foreground">Set a revenue goal to compute jobs needed</div>
        ) : (
          <>
            <div className="text-muted-foreground">
              <span>Avg won</span>{" "}
              <span className="font-mono tabular-nums text-foreground">
                {avgWonDeal > 0 ? fmtAUD(avgWonDeal) : "—"}
              </span>
            </div>
            {withYlw ? (
              <>
                <div className="min-w-0 break-words">
                  <span className="font-mono tabular-nums text-chart-green">
                    {fmtAUD(currentRevenue)}
                  </span>
                  <span className="text-muted-foreground"> + </span>
                  <span className="font-mono tabular-nums" style={{ color: YLW_COLOR }}>
                    {fmtAUD(ylwValue)} YLW
                  </span>
                  <span className="text-muted-foreground"> = </span>
                  <span className="font-mono tabular-nums text-foreground">
                    {fmtAUD(effectiveCurrent)}
                  </span>
                </div>
                {!met && (
                  <div>
                    <span className="font-mono tabular-nums text-chart-red">
                      {fmtAUD(remaining)}
                    </span>{" "}
                    <span className="text-muted-foreground">remaining</span>
                  </div>
                )}
              </>
            ) : (
              !met && (
                <div className="min-w-0 break-words">
                  <span className="font-mono tabular-nums text-chart-green">
                    {fmtAUD(currentRevenue)}
                  </span>
                  <span className="text-muted-foreground"> · </span>
                  <span className="font-mono tabular-nums text-chart-red">
                    {fmtAUD(remaining)}
                  </span>{" "}
                  <span className="text-muted-foreground">remaining</span>
                </div>
              )
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

function LeadsToGoalCard({
  target,
  leadsToGoal,
  avgWonDeal,
  pipelineConversion,
  remaining,
  withYlw,
  setWithYlw,
  className,
}: {
  target: number;
  leadsToGoal: number;
  avgWonDeal: number;
  pipelineConversion: number;
  remaining: number;
  withYlw: boolean;
  setWithYlw: (v: boolean) => void;
  className?: string;
}) {
  const convRate = pipelineConversion / 100;
  const empty = target === 0 || convRate === 0;
  const met = !empty && remaining === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.1 }}
      className={`${cardBase} ${className ?? ""}`}
    >
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/70">
          Leads to Goal
        </span>
        <ConfirmedYlwToggle withYlw={withYlw} setWithYlw={setWithYlw} />
      </div>

      <div className="flex-1 flex flex-row items-center justify-center text-center gap-3 min-w-0">
        <div className="flex-1 flex flex-col items-center justify-center min-w-0">
          <span
            className="font-mono tabular-nums font-semibold text-chart-green"
            style={{ fontSize: "clamp(2.5rem, 6vw, 4.5rem)", letterSpacing: "-0.02em", lineHeight: 1 }}
          >
            {empty ? "—" : met ? "Goal met 🎉" : leadsToGoal}
          </span>
          {!empty && !met && (
            <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              Leads to Goal
            </span>
          )}
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-[15px] uppercase tracking-wider space-y-0.5 min-w-0 break-words">
          <div className="text-muted-foreground">
            <span>Conv rate</span>{" "}
            <span className="font-mono tabular-nums text-foreground">
              {convRate > 0 ? `${pipelineConversion.toFixed(1)}%` : "—"}
            </span>
          </div>
          <div className="text-muted-foreground">
            <span>Avg won</span>{" "}
            <span className="font-mono tabular-nums text-foreground">
              {avgWonDeal > 0 ? fmtAUD(avgWonDeal) : "—"}
            </span>
          </div>
          {!empty && !met && (
            <div>
              <span className="font-mono tabular-nums text-chart-red">
                {fmtAUD(remaining)}
              </span>{" "}
              <span className="text-muted-foreground">remaining</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
