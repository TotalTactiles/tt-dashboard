import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import type { DateRule } from "@/lib/projects/dateRules";

export interface Task {
  id: string;
  project_id: string;
  list_id: string;
  parent_id: string | null;
  name: string;
  description: string | null;
  product_code: string | null;
  assignee_id: string | null;
  start_date: string | null;
  end_date: string | null;
  rule: DateRule;
  date_manual: boolean;
  calc_table: string | null;
  status: "open" | "done";
  position: number;
  office_only: boolean;
}

export interface TaskList {
  id: string;
  project_id: string;
  name: string;
  position: number;
}

const db = supabase as any;

export function useTasks(projectId: string | null) {
  const { role } = useRole();
  const [lists, setLists] = useState<TaskList[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) {
      setLists([]);
      setTasks([]);
      return;
    }
    setLoading(true);
    const [{ data: l }, { data: t }] = await Promise.all([
      db
        .from("task_lists")
        .select("*")
        .eq("project_id", projectId)
        .order("position", { ascending: true }),
      db
        .from("tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("position", { ascending: true }),
    ]);

    setLists((l as TaskList[]) ?? []);
    const all = (t as Task[]) ?? [];
    setTasks(role === "office" ? all : all.filter((x) => !x.office_only));
    setLoading(false);
  }, [projectId, role]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleTaskStatus = useCallback(
    async (taskId: string, current: "open" | "done") => {
      const next = current === "open" ? "done" : "open";
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: next } : t)));
      // Persist in background — do NOT await before UI moves.
      db.from("tasks")
        .update({
          status: next,
          completed_at: next === "done" ? new Date().toISOString() : null,
        })
        .eq("id", taskId)
        .then(() => {});
    },
    [],
  );

  const updateTask = useCallback(
    async (taskId: string, patch: Partial<Task>) => {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t)));
      db.from("tasks").update(patch).eq("id", taskId).then(() => {});
    },
    [],
  );

  return { lists, tasks, loading, refresh: load, toggleTaskStatus, updateTask };
}
