/**
 * Pure function to derive adjusted cashflow data from merged goals.
 * Never mutates the original data.
 */

import type { Goal } from "@/hooks/useGoals";
import type { IncomeOutgoingsPoint } from "@/contexts/DashboardDataContext";

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function dateToMonthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${MONTH_NAMES[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
}

function parseMonthKey(key: string): Date | null {
  const match = key.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2})$/i);
  if (!match) return null;
  const monthIdx = MONTH_NAMES.indexOf(match[1]);
  return new Date(2000 + parseInt(match[2]), monthIdx, 1);
}

function isMonthInRange(monthKey: string, startDate: string, endDate: string): boolean {
  const d = parseMonthKey(monthKey);
  if (!d) return false;
  const start = new Date(startDate);
  const end = new Date(endDate);
  // Compare year-month only
  const dYM = d.getFullYear() * 12 + d.getMonth();
  const sYM = start.getFullYear() * 12 + start.getMonth();
  const eYM = end.getFullYear() * 12 + end.getMonth();
  return dYM >= sYM && dYM <= eYM;
}

function getGoalMonthlyAmount(goal: Goal): number {
  if (goal.amountStructure === "lump_sum") return 0;
  const amount = goal.targetValue || 0;
  if (goal.period === "weekly") return amount * 4.33;
  if (goal.period === "yearly") return amount / 12;
  return amount; // monthly
}

export interface GoalAdjustment {
  goalId: string;
  goalName: string;
  goalType: "expenditure" | "revenue";
  monthKey: string;
  amount: number; // positive = added income/subtracted expense effect
}

export interface AdjustedCashflowResult {
  adjustedData: IncomeOutgoingsPoint[];
  adjustments: GoalAdjustment[];
  /** Net monthly effect of all active goals */
  netMonthlyEffect: number;
}

export function applyGoalMerge(
  rawData: IncomeOutgoingsPoint[],
  allGoals: Goal[],
  activeGoalIds: Set<string>
): AdjustedCashflowResult {
  const mergedGoals = allGoals.filter(g => g.merge && activeGoalIds.has(g.id));
  
  if (mergedGoals.length === 0) {
    return { adjustedData: rawData, adjustments: [], netMonthlyEffect: 0 };
  }

  const adjustments: GoalAdjustment[] = [];

  // Build adjustment map: monthKey -> { incomeAdj, outgoingsAdj }
  const adjMap: Record<string, { incomeAdj: number; outgoingsAdj: number }> = {};

  for (const goal of mergedGoals) {
    const goalType = goal.goalType ?? "expenditure";

    if (goal.amountStructure === "lump_sum" && goal.lumpSumDate) {
      const mk = dateToMonthKey(goal.lumpSumDate);
      if (!adjMap[mk]) adjMap[mk] = { incomeAdj: 0, outgoingsAdj: 0 };
      
      if (goalType === "revenue") {
        adjMap[mk].incomeAdj += goal.targetValue;
        adjustments.push({ goalId: goal.id, goalName: goal.name, goalType, monthKey: mk, amount: goal.targetValue });
      } else {
        adjMap[mk].outgoingsAdj += goal.targetValue;
        adjustments.push({ goalId: goal.id, goalName: goal.name, goalType, monthKey: mk, amount: -goal.targetValue });
      }
    } else if (goal.amountStructure === "recurring") {
      const monthly = getGoalMonthlyAmount(goal);
      if (monthly <= 0) continue;

      for (const point of rawData) {
        if (!isMonthInRange(point.month, goal.startDate, goal.endDate)) continue;
        if (!adjMap[point.month]) adjMap[point.month] = { incomeAdj: 0, outgoingsAdj: 0 };
        
        if (goalType === "revenue") {
          adjMap[point.month].incomeAdj += monthly;
          adjustments.push({ goalId: goal.id, goalName: goal.name, goalType, monthKey: point.month, amount: monthly });
        } else {
          adjMap[point.month].outgoingsAdj += monthly;
          adjustments.push({ goalId: goal.id, goalName: goal.name, goalType, monthKey: point.month, amount: -monthly });
        }
      }
    }
  }

  // Derive adjusted data
  const adjustedData = rawData.map(point => {
    const adj = adjMap[point.month];
    if (!adj) return point;
    const newIncome = point.income + adj.incomeAdj;
    const newOutgoings = point.outgoings + adj.outgoingsAdj;
    const newProbableIncome = point.isFuture ? point.probableIncome + adj.incomeAdj : point.probableIncome;
    const surplus = point.isFuture ? (newProbableIncome - newOutgoings) : (newIncome - newOutgoings);
    return {
      ...point,
      income: newIncome,
      outgoings: newOutgoings,
      probableIncome: newProbableIncome,
      surplus,
    };
  });

  // Calculate net monthly effect
  let netMonthlyEffect = 0;
  for (const goal of mergedGoals) {
    const goalType = goal.goalType ?? "expenditure";
    if (goal.amountStructure === "recurring") {
      const monthly = getGoalMonthlyAmount(goal);
      netMonthlyEffect += goalType === "revenue" ? monthly : -monthly;
    } else if (goal.amountStructure === "lump_sum") {
      // Spread over goal duration for net effect display
      const start = new Date(goal.startDate);
      const end = new Date(goal.endDate);
      const months = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1);
      const perMonth = goal.targetValue / months;
      netMonthlyEffect += goalType === "revenue" ? perMonth : -perMonth;
    }
  }

  return { adjustedData, adjustments, netMonthlyEffect };
}

/** Get adjustments for a specific month, grouped by goal */
export function getMonthAdjustments(adjustments: GoalAdjustment[], monthKey: string): GoalAdjustment[] {
  return adjustments.filter(a => a.monthKey === monthKey);
}

/** Calculate goal expense category data for pie chart */
export function getGoalExpenseCategory(
  allGoals: Goal[],
  activeGoalIds: Set<string>
): { name: string; monthlyCost: number; goals: { name: string; monthly: number }[] } | null {
  const activeExpGoals = allGoals.filter(g => g.merge && activeGoalIds.has(g.id) && (g.goalType ?? "expenditure") === "expenditure");
  if (activeExpGoals.length === 0) return null;

  const goals = activeExpGoals.map(g => ({
    name: g.name,
    monthly: g.amountStructure === "lump_sum"
      ? (() => {
          const start = new Date(g.startDate);
          const end = new Date(g.endDate);
          const months = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1);
          return g.targetValue / months;
        })()
      : getGoalMonthlyAmount(g),
  }));

  return {
    name: "Goals",
    monthlyCost: goals.reduce((s, g) => s + g.monthly, 0),
    goals,
  };
}
