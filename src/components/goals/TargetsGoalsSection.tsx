import { ReactNode, useState, useEffect, useRef } from "react";
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
  /** Legacy — unused. Goal now tracks SECURED WORK (won contract value). */
  currentRevenue?: number;
  wonValueTotal?: number;
  wonCount?: number;
};

const cardBase =
  "relative bg-card border border-border rounded-lg p-4 md:p-5 flex flex-col";

export default function TargetsGoalsSection(_props: Props) {
  const { target, setTarget } = useRevenueTarget();
  const {
    ylwValue,
    wonValueFY,
    wrWonFY,
    getLeadsToGoal,
    getLeadsToGoalTrue,
    pipelineConversion,
    winRateConfirmed,
  } = useDashboardData();

  const [withYlw, setWithYlw] = useState(false);

  // Goal tracks SECURED WORK (won contract value) — identical basis to Win/Loss WON.
  const goalConfirmed = wonValueFY;                    // GRN + Completed
  const ylwTopUp = ylwValue;                           // YLW (QUOTES basis)
  const goalWithYlw = goalConfirmed + ylwTopUp;
  const effectiveCurrent = withYlw ? goalWithYlw : goalConfirmed;

  const avgWonDeal = wrWonFY > 0 ? wonValueFY / wrWonFY : 0;

  // Stacked gauge composition.
  const pctConfirmed = target > 0 ? Math.min(100, (goalConfirmed / target) * 100) : 0;
  const pctYlw =
    target > 0 && withYlw ? Math.min(100 - pctConfirmed, (ylwTopUp / target) * 100) : 0;
  const pctTotal = Math.min(100, pctConfirmed + pctYlw);

  const remaining = Math.max(0, target - effectiveCurrent);
  const jobsToGoal =
    avgWonDeal > 0 && remaining > 0 ? Math.ceil(remaining / avgWonDeal) : 0;
  const oppsToGoal = getLeadsToGoal(jobsToGoal);
  const leadsToGoal = getLeadsToGoalTrue(jobsToGoal);


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
          goalConfirmed={goalConfirmed}
          effectiveCurrent={effectiveCurrent}
          pctConfirmed={pctConfirmed}
          pctYlw={pctYlw}
          pctTotal={pctTotal}
          remaining={remaining}
          withYlw={withYlw}
          setWithYlw={setWithYlw}
          ylwValue={ylwTopUp}
        />
        <JobsToGoalCard
          target={target}
          jobsToGoal={jobsToGoal}
          avgWonDeal={avgWonDeal}
          goalConfirmed={goalConfirmed}
          effectiveCurrent={effectiveCurrent}
          remaining={remaining}
          withYlw={withYlw}
          setWithYlw={setWithYlw}
          ylwValue={ylwTopUp}
        />
        <LeadsToGoalCard
          target={target}
          oppsToGoal={oppsToGoal}
          leadsToGoal={leadsToGoal}
          avgWonDeal={avgWonDeal}
          pipelineConversion={pipelineConversion}
          winRateConfirmed={winRateConfirmed}
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
  goalConfirmed,
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
  goalConfirmed: number;
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

      {target > 0 && (
        <div className="mt-2 text-center text-[15px] uppercase tracking-wider whitespace-normal break-words space-y-0.5">
          {withYlw ? (
            <>
              <div className="min-w-0 break-words">
                <span className="font-mono tabular-nums text-chart-green">
                  {fmtAUD(goalConfirmed)}
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
                {fmtAUD(goalConfirmed)}
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

function CardHeader({
  title,
  withYlw,
  setWithYlw,
  extra,
}: {
  title: string;
  withYlw: boolean;
  setWithYlw: (v: boolean) => void;
  extra?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/70">
        {title}
      </span>
      <div className="flex items-center gap-1.5">
        {extra}
        <ConfirmedYlwToggle withYlw={withYlw} setWithYlw={setWithYlw} />
      </div>
    </div>
  );
}

function SplitBody({
  empty,
  met,
  headline,
  underLabel,
  details,
}: {
  empty: boolean;
  met: boolean;
  headline: ReactNode;
  underLabel: string;
  details: ReactNode;
}) {
  return (
    <div className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-3 min-w-0">
      <div className="flex-1 flex flex-col items-center justify-center text-center min-w-0">
        <span
          className="font-mono tabular-nums font-semibold text-chart-green"
          style={{ fontSize: "clamp(2.5rem, 6vw, 4.5rem)", letterSpacing: "-0.02em", lineHeight: 1 }}
        >
          {headline}
        </span>
        {!empty && !met && (
          <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            {underLabel}
          </span>
        )}
      </div>
      <div className="flex-1 flex flex-col items-end justify-center text-right text-[14px] uppercase tracking-wider space-y-0.5 min-w-0 break-words">
        {details}
      </div>
    </div>
  );
}

function JobsToGoalCard({
  target,
  jobsToGoal,
  avgWonDeal,
  goalConfirmed,
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
  goalConfirmed: number;
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
      <CardHeader title="Jobs to Goal" withYlw={withYlw} setWithYlw={setWithYlw} />
      <SplitBody
        empty={empty}
        met={met}
        headline={empty ? "—" : met ? "Goal met 🎉" : jobsToGoal}
        underLabel="Jobs to Goal"
        details={
          empty ? (
            <div className="text-muted-foreground">Set a revenue target to compute jobs needed</div>
          ) : (
            <>
              <div className="text-muted-foreground">
                <span>Avg won</span>{" "}
                <span className="font-mono tabular-nums text-foreground">
                  {avgWonDeal > 0 ? fmtAUD(avgWonDeal) : "—"}
                </span>
              </div>
              <div className="min-w-0 break-words">
                <span className="font-mono tabular-nums text-chart-green">
                  {fmtAUD(goalConfirmed)}
                </span>
                {withYlw ? (
                  <>
                    <span className="text-muted-foreground"> + </span>
                    <span className="font-mono tabular-nums" style={{ color: YLW_COLOR }}>
                      {fmtAUD(ylwValue)} YLW
                    </span>
                    <span className="text-muted-foreground"> = </span>
                    <span className="font-mono tabular-nums text-foreground">
                      {fmtAUD(effectiveCurrent)}
                    </span>
                  </>
                ) : null}
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
          )
        }
      />
    </motion.div>
  );
}

function LeadsToGoalCard({
  target,
  oppsToGoal,
  leadsToGoal,
  avgWonDeal,
  pipelineConversion,
  winRateConfirmed,
  remaining,
  withYlw,
  setWithYlw,
  className,
}: {
  target: number;
  oppsToGoal: number;
  leadsToGoal: number;
  avgWonDeal: number;
  pipelineConversion: number;
  winRateConfirmed: number;
  remaining: number;
  withYlw: boolean;
  setWithYlw: (v: boolean) => void;
  className?: string;
}) {
  const [mode, setMode] = useState<"opps" | "leads">("opps");
  const closeRate = winRateConfirmed / 100;
  const pipelineRate = pipelineConversion / 100;
  const empty = target === 0 || (mode === "opps" ? closeRate === 0 : pipelineRate === 0);
  const met = !empty && remaining === 0;

  const headline = mode === "opps" ? oppsToGoal : leadsToGoal;
  const underLabel = mode === "opps" ? "Opps to Goal" : "Active Leads to Goal";
  const rateLabel = mode === "opps" ? "Close Rate" : "Pipeline Rate";
  const rateValue =
    mode === "opps"
      ? closeRate > 0
        ? `${winRateConfirmed.toFixed(1)}%`
        : "—"
      : pipelineRate > 0
      ? `${pipelineConversion.toFixed(1)}%`
      : "—";

  const PillBtn = ({
    active,
    disabled,
    onClick,
    children,
  }: {
    active: boolean;
    disabled?: boolean;
    onClick: () => void;
    children: ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider transition-colors ${
        disabled
          ? "bg-muted/30 text-muted-foreground/40 cursor-not-allowed"
          : active
          ? "bg-[hsl(212,75%,55%)] text-white"
          : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
      }`}
    >
      {children}
    </button>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.1 }}
      className={`${cardBase} ${className ?? ""}`}
    >
      <CardHeader
        title="Funnel to Goal"
        withYlw={withYlw}
        setWithYlw={setWithYlw}
        extra={
          <div className="flex items-center gap-1.5">
            <PillBtn active={mode === "opps"} onClick={() => setMode("opps")}>
              Opportunities
            </PillBtn>
            <PillBtn active={mode === "leads"} onClick={() => setMode("leads")}>
              Leads
            </PillBtn>
          </div>
        }
      />
      <SplitBody
        empty={empty}
        met={met}
        headline={empty ? "—" : met ? "Goal met 🎉" : headline}
        underLabel={underLabel}
        details={
          <>
            <div className="text-muted-foreground">
              <span>{rateLabel}</span>{" "}
              <span className="font-mono tabular-nums text-foreground">{rateValue}</span>
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
          </>
        }
      />
    </motion.div>
  );
}
