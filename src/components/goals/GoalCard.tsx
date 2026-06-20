import { Goal } from "@/hooks/useGoals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Pencil,
  Trash2,
  CalendarDays,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { differenceInDays, format, parseISO, differenceInMonths } from "date-fns";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { useState } from "react";

interface GoalCardProps {
  goal: Goal;
  onEdit: (goal: Goal) => void;
  onDelete: (id: string) => void;
  isAuto?: boolean;
}

export default function GoalCard({ goal, onEdit, onDelete, isAuto }: GoalCardProps) {
  const { investorMetrics } = useDashboardData();
  const [showAnalysis, setShowAnalysis] = useState(false);

  const progress =
    goal.targetValue > 0 ? Math.min((goal.currentValue / goal.targetValue) * 100, 100) : 0;
  const daysLeft = differenceInDays(parseISO(goal.endDate), new Date());
  const isOverdue = daysLeft < 0;
  const isComplete = progress >= 100;
  const isExpenditure = (goal.goalType ?? "expenditure") === "expenditure";

  // ── Financial impact calculations ──
  const im = investorMetrics as any;
  const grossMarginPct = im?.grossMarginPct ?? 55;
  const monthlyRevenue = im?.revenueExGST ? im.revenueExGST / 12 : 0;
  const monthlyExpenses = im?.ytdTotalExpenses ? im.ytdTotalExpenses / 12 : 0;

  const goalMonthly = (() => {
    if (goal.amountStructure === "recurring") {
      const base = goal.targetValue ?? 0;
      if (goal.period === "weekly") return (base * 52) / 12;
      if (goal.period === "yearly") return base / 12;
      return base;
    }
    if (goal.amountStructure === "lump_sum") {
      const start = new Date(goal.startDate);
      const end = new Date(goal.endDate);
      const months = Math.max(1, differenceInMonths(end, start) + 1);
      return (goal.targetValue ?? 0) / months;
    }
    return 0;
  })();
  const goalWeekly = (goalMonthly * 12) / 52;
  const goalAnnual = goalMonthly * 12;

  const revenueToBreakEven = grossMarginPct > 0 ? goalMonthly / (grossMarginPct / 100) : 0;

  const avgContractValue = im?.avgContractValueWon ?? 0;
  const jobsNeeded =
    avgContractValue > 0
      ? Math.ceil(goalAnnual / (avgContractValue * (grossMarginPct / 100)))
      : 0;

  const currentMonthlySurplus = monthlyRevenue - monthlyExpenses;
  const surplusWithGoal = currentMonthlySurplus - goalMonthly;
  const isCashflowNegative = surplusWithGoal < 0;
  const revenueToMaintainSurplus = revenueToBreakEven + monthlyExpenses;

  const fmt = (n: number) =>
    n < 0
      ? `($${Math.abs(n).toLocaleString("en-AU", { maximumFractionDigits: 0 })})`
      : `$${n.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;

  const fmtV = (v: number) => {
    if (goal.unit === "$") return fmt(v);
    if (goal.unit === "%") return `${v.toFixed(1)}%`;
    return `${v}`;
  };

  return (
    <div className="stat-card space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground truncate">{goal.name}</h3>
          {goal.description && (
            <p className="text-xs text-muted-foreground line-clamp-1">{goal.description}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
            {goal.category}
          </Badge>
          <Badge
            variant="outline"
            className={`text-[9px] ${
              isExpenditure
                ? "border-amber-500/40 text-amber-400"
                : "border-emerald-500/40 text-emerald-400"
            }`}
          >
            {isExpenditure ? "Expenditure" : "Revenue"}
          </Badge>
        </div>
      </div>

      {/* Cost summary / Affordability */}
      {isExpenditure && goal.amountStructure === "lump_sum" ? (
        <div className="space-y-2 p-2.5 rounded-lg bg-muted/30 border border-border/40">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Lump Sum — {fmt(goal.targetValue)}
          </p>
          {(() => {
            const monthlySurplus = currentMonthlySurplus;
            const monthsToSave = monthlySurplus > 0
              ? Math.ceil(goal.targetValue / monthlySurplus)
              : null;
            const affordableDate = monthsToSave !== null
              ? (() => {
                  const d = new Date();
                  d.setMonth(d.getMonth() + monthsToSave);
                  return d.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
                })()
              : null;
            const canAffordNow = monthlySurplus >= goal.targetValue;
            const revenueFor1Month = grossMarginPct > 0 ? goal.targetValue / (grossMarginPct / 100) : 0;

            return (
              <div className="space-y-1.5">
                {canAffordNow ? (
                  <div className="flex items-center gap-1.5 text-xs text-green-400 font-medium">
                    <span>✓</span>
                    <span>Affordable from current monthly surplus</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Current monthly surplus</span>
                      <span className={`font-mono font-semibold ${monthlySurplus >= 0 ? 'text-foreground' : 'text-red-400'}`}>
                        {fmt(monthlySurplus)}
                      </span>
                    </div>
                    {monthsToSave !== null && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Affordable by saving surplus</span>
                        <span className="font-mono font-semibold text-primary">
                          {monthsToSave <= 1 ? 'Next month' : `${affordableDate} (${monthsToSave} months)`}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Revenue to afford in 1 month</span>
                      <span className="font-mono font-semibold">{fmt(revenueFor1Month)}</span>
                    </div>
                    {monthsToSave !== null && monthsToSave <= 12 && (
                      <div className="mt-1 p-2 rounded bg-primary/5 border border-primary/15 text-[10px] text-muted-foreground">
                        At your current surplus of <span className="text-primary font-semibold">{fmt(monthlySurplus)}/mo</span>,
                        you can accumulate {fmt(goal.targetValue)} by <span className="text-primary font-semibold">{affordableDate}</span>.
                      </div>
                    )}
                    {monthsToSave !== null && monthsToSave > 12 && (
                      <div className="mt-1 p-2 rounded bg-amber-500/5 border border-amber-500/15 text-[10px] text-amber-400">
                        At current surplus this takes {monthsToSave} months.
                        To achieve within {goal.targetYear ?? new Date().getFullYear()},
                        you need <span className="font-semibold">{fmt(revenueFor1Month)}</span> additional revenue this month.
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })()}
        </div>
      ) : isExpenditure && goalMonthly > 0 ? (
        <div className="grid grid-cols-3 gap-2 rounded-md border border-border/60 bg-muted/20 p-2">
          <div className="text-center">
            <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Weekly</div>
            <div className="text-xs font-mono font-semibold text-foreground">{fmt(goalWeekly)}</div>
          </div>
          <div className="text-center border-x border-border/60">
            <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Monthly</div>
            <div className="text-xs font-mono font-semibold text-foreground">{fmt(goalMonthly)}</div>
          </div>
          <div className="text-center">
            <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Annual</div>
            <div className="text-xs font-mono font-semibold text-foreground">{fmt(goalAnnual)}</div>
          </div>
        </div>
      ) : null}

      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs font-mono">
          <span className="text-muted-foreground flex items-center gap-1.5">
            {fmtV(goal.currentValue)} / {fmtV(goal.targetValue)}
            {isAuto && (
              <Badge
                variant="secondary"
                className="text-[9px] px-1.5 py-0 h-4 bg-primary/15 text-primary border-0"
              >
                auto
              </Badge>
            )}
          </span>
          <span className={isComplete ? "text-primary glow-green" : "text-foreground"}>
            {progress.toFixed(0)}%
          </span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      {/* Cashflow impact alert */}
      {isExpenditure && goal.amountStructure === "lump_sum" && goal.targetValue > 0 ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-400" />
          <div className="text-[11px] leading-snug text-amber-200">
            Adding this as a one-time expense reduces monthly surplus by{" "}
            <span className="font-mono font-semibold">{fmt(goal.targetValue)}</span> in the month it is spent
          </div>
        </div>
      ) : isExpenditure && goalMonthly > 0 && (monthlyRevenue > 0 || monthlyExpenses > 0) ? (
        <div
          className={`flex items-start gap-2 rounded-md border p-2 ${
            isCashflowNegative
              ? "border-red-500/40 bg-red-500/10"
              : "border-emerald-500/40 bg-emerald-500/10"
          }`}
        >
          <AlertTriangle
            className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${
              isCashflowNegative ? "text-red-400" : "text-emerald-400"
            }`}
          />
          <div className="text-[11px] leading-snug">
            {isCashflowNegative ? (
              <span className="text-red-300">
                Cashflow goes negative by{" "}
                <span className="font-mono font-semibold">{fmt(Math.abs(surplusWithGoal))}</span>/mo
                with this goal active
              </span>
            ) : (
              <span className="text-emerald-300">
                Cashflow remains positive (
                <span className="font-mono font-semibold">{fmt(surplusWithGoal)}</span>/mo surplus)
                with this goal
              </span>
            )}
          </div>
        </div>
      ) : null}

      {/* Analysis toggle */}
      <button
        onClick={() => setShowAnalysis(!showAnalysis)}
        className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
      >
        <span className="flex items-center gap-1.5">
          <TrendingUp className="h-3 w-3" />
          What's required to achieve this
        </span>
        {showAnalysis ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {/* Detailed analysis panel */}
      {showAnalysis && (
        <div className="space-y-3 rounded-md border border-border/60 bg-muted/10 p-3">
          {isExpenditure && goal.amountStructure === "lump_sum" ? (
            (() => {
              const monthlySurplus = currentMonthlySurplus;
              const monthsToSave = monthlySurplus > 0
                ? Math.ceil(goal.targetValue / monthlySurplus)
                : null;
              const affordableDate = monthsToSave !== null
                ? (() => {
                    const d = new Date();
                    d.setMonth(d.getMonth() + monthsToSave);
                    return d.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
                  })()
                : null;
              const revenueFor1Month = grossMarginPct > 0 ? goal.targetValue / (grossMarginPct / 100) : 0;
              return (
                <div className="space-y-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Savings timeline
                  </div>
                  <div className="space-y-1 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Current monthly surplus</span>
                      <span className={`font-semibold ${monthlySurplus >= 0 ? "text-foreground" : "text-red-400"}`}>
                        {fmt(monthlySurplus)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Months to save from surplus</span>
                      <span className="text-foreground font-semibold">
                        {monthsToSave !== null ? `${monthsToSave} mo` : "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Target month to achieve</span>
                      <span className="text-foreground font-semibold">
                        {affordableDate ?? "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Revenue to fund in single month</span>
                      <span className="text-foreground font-semibold">{fmt(revenueFor1Month)}</span>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : isExpenditure ? (
            <>
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  To sustain this goal without affecting cashflow
                </div>
                <div className="space-y-1 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Additional monthly revenue needed</span>
                    <span className="text-foreground font-semibold">{fmt(revenueToBreakEven)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total monthly revenue required</span>
                    <span className="text-foreground font-semibold">
                      {fmt(revenueToMaintainSurplus)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Additional jobs/yr at avg contract value</span>
                    <span className="text-foreground font-semibold">
                      {jobsNeeded > 0 ? `${jobsNeeded} jobs` : "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-border/60">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Current position
                </div>
                <div className="space-y-1 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Monthly revenue (current)</span>
                    <span className="text-foreground">{fmt(monthlyRevenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Monthly expenses (current)</span>
                    <span className="text-foreground">{fmt(monthlyExpenses)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Monthly surplus (current)</span>
                    <span
                      className={`font-semibold ${
                        currentMonthlySurplus >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {fmt(currentMonthlySurplus)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Monthly surplus WITH goal</span>
                    <span
                      className={`font-semibold ${
                        surplusWithGoal >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {fmt(surplusWithGoal)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-border/60">
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  At your current gross margin of{" "}
                  <span className="text-foreground font-semibold">
                    {grossMarginPct.toFixed(0)}%
                  </span>
                  , every $1 of additional revenue generates{" "}
                  <span className="text-foreground font-semibold">
                    {fmt(grossMarginPct / 100)}
                  </span>{" "}
                  gross profit. You need{" "}
                  <span className="text-foreground font-semibold">{fmt(revenueToBreakEven)}</span>
                  /mo in additional revenue to fully cover this goal.
                  {jobsNeeded > 0 &&
                    ` That's approximately ${jobsNeeded} additional job${
                      jobsNeeded !== 1 ? "s" : ""
                    } per year at your average contract value.`}
                </p>
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Progress to revenue target
              </div>
              <div className="space-y-1 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current revenue</span>
                  <span className="text-foreground font-semibold">{fmt(goal.currentValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Target revenue</span>
                  <span className="text-foreground font-semibold">{fmt(goal.targetValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Remaining</span>
                  <span className="text-foreground font-semibold">
                    {fmt(Math.max(0, goal.targetValue - goal.currentValue))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Days remaining</span>
                  <span
                    className={`font-semibold ${
                      daysLeft > 0 ? "text-foreground" : "text-red-400"
                    }`}
                  >
                    {daysLeft > 0 ? `${daysLeft} days` : "Overdue"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
          <CalendarDays className="h-3 w-3" />
          <span>Target: {goal.targetYear ?? (goal.endDate ? new Date(goal.endDate).getFullYear() : new Date().getFullYear())}</span>
          {goal.amountStructure === "recurring" && !isComplete && daysLeft >= 0 && (
            <span className="text-primary">· {daysLeft}d left in year</span>
          )}
          {isOverdue && !isComplete && (
            <span className="text-destructive">· Overdue</span>
          )}
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(goal)}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive"
            onClick={() => onDelete(goal.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
