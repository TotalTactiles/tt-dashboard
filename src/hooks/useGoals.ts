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
