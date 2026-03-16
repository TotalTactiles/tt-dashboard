import { useState, useCallback } from "react";

export interface Goal {
  id: string;
  name: string;
  description: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  startDate: string;
  endDate: string;
  category: string;
  createdAt: string;
  manualCurrentValue?: boolean;
  goalType?: "expenditure" | "revenue";
  amountStructure?: "lump_sum" | "recurring";
  period?: "weekly" | "monthly" | "yearly";
  lumpSumDate?: string;
  merge?: boolean;
}

const STORAGE_KEY = "meridian_goals";

function loadGoals(): Goal[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveGoals(goals: Goal[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
}

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>(loadGoals);

  const addGoal = useCallback((goal: Omit<Goal, "id" | "createdAt">) => {
    setGoals((prev) => {
      const next = [
        ...prev,
        { ...goal, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
      ];
      saveGoals(next);
      return next;
    });
  }, []);

  const updateGoal = useCallback((id: string, updates: Partial<Goal>) => {
    setGoals((prev) => {
      const next = prev.map((g) => (g.id === id ? { ...g, ...updates } : g));
      saveGoals(next);
      return next;
    });
  }, []);

  const deleteGoal = useCallback((id: string) => {
    setGoals((prev) => {
      const next = prev.filter((g) => g.id !== id);
      saveGoals(next);
      return next;
    });
  }, []);

  return { goals, addGoal, updateGoal, deleteGoal };
}

/** Resolve auto-populated current value from webhook data */
export function resolveGoalAutoValue(
  goal: Goal,
  quotesSummary: any,
  cashflowSummary: any
): { value: number; isAuto: true } | null {
  if (goal.manualCurrentValue && goal.currentValue > 0) return null;

  const goalType = goal.goalType ?? "";
  const cat = (goal.category ?? "").toLowerCase();
  const name = (goal.name ?? "").toLowerCase();

  // Revenue goals → totalWon value
  if (goalType === "revenue" || cat === "revenue" || cat === "customer" || cat === "sales target") {
    const val = parseFloat(String(quotesSummary?.totalWon?.value ?? 0).replace(/[^0-9.-]/g, "")) || 0;
    if (val > 0) return { value: val, isAuto: true };
  }

  // Expenditure / Payroll goals → expenses or cashflow
  if (goalType === "expenditure" || cat === "financial" || cat === "profitability" || cat === "payroll" || cat === "operating expense" || 
      name.includes("salary") || name.includes("cashflow") || name.includes("cash flow") || name.includes("wage")) {
    // Lump sum: past date = 100%, before = 0%
    if (goal.amountStructure === "lump_sum" && goal.lumpSumDate) {
      const isPast = new Date(goal.lumpSumDate) <= new Date();
      return { value: isPast ? goal.targetValue : 0, isAuto: true };
    }
    // Recurring: use cashflow anticipated surplus
    const months: string[] = cashflowSummary?.months ?? [];
    const surplus = cashflowSummary?.anticipatedSurplus ?? {};
    for (let i = months.length - 1; i >= 0; i--) {
      const raw = surplus[months[i]];
      const val = typeof raw === "number" ? raw : parseFloat(String(raw ?? "0").replace(/[^0-9.-]/g, "")) || 0;
      if (val !== 0) return { value: Math.abs(val), isAuto: true };
    }
  }

  return null;
}
