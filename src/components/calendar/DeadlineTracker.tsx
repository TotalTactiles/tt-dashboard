import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CheckCircle, Circle, AlertTriangle, ExternalLink, Trash2, Plus, X } from "lucide-react";
import { type LiveCalendarEvent } from "@/contexts/DashboardDataContext";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface DeadlineTrackerProps {
  events: LiveCalendarEvent[];
}

interface FDSub { id: string; title: string; done: boolean; }
type FDPhase = "General" | "Pre Seal" | "Close the Seal" | "Post Seal" | "Legacy";
interface FDTask {
  id: string;
  title: string;
  phase: FDPhase;
  deadline: string;
  subtasks: FDSub[];
}

type Row = {
  id: string;
  title: string;
  phase: string;
  parent: string;
  deadline: string;
  subtasks: { id?: string; title: string; done: boolean }[];
  progress: number;
  standalone: boolean;
};

const STRATEGIC_COLOR = "#BA7517";
const FD_KEY = "tt_fund_deadlines";

const PHASE_COLORS: Record<string, string> = {
  "Pre Seal": "#E24B4A",
  "Close the Seal": "#BA7517",
  "Post Seal": "#378ADD",
  "Legacy": "#22C55E",
  "General": "#BA7517",
  "Strategic": "#BA7517",
};

const PHASES: FDPhase[] = ["General", "Pre Seal", "Close the Seal", "Post Seal", "Legacy"];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtDeadline(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function newId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

const DeadlineTracker = ({ events }: DeadlineTrackerProps) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTask, setEditorTask] = useState<FDTask | null>(null);

  const [fdTasks, setFdTasks] = useState<FDTask[]>(() => {
    try { return JSON.parse(localStorage.getItem(FD_KEY) || "[]"); } catch { return []; }
  });
  useEffect(() => { localStorage.setItem(FD_KEY, JSON.stringify(fdTasks)); }, [fdTasks]);

  const upsertFd = (t: FDTask) =>
    setFdTasks(prev => prev.some(x => x.id === t.id) ? prev.map(x => x.id === t.id ? t : x) : [...prev, t]);
  const deleteFd = (id: string) => setFdTasks(prev => prev.filter(x => x.id !== id));
  const toggleFdSub = (taskId: string, subId: string) =>
    setFdTasks(prev => prev.map(t => t.id !== taskId ? t : ({
      ...t, subtasks: t.subtasks.map(s => s.id === subId ? { ...s, done: !s.done } : s)
    })));

  const rows: (Row & { eventDate: Date; daysRemaining: number; deadlineStatus: "overdue" | "upcoming" | "completed" })[] = useMemo(() => {
    const now = new Date();

    const boardRows: Row[] = events
      .filter((e) => e.source === "Strategic Board" || e.id?.startsWith("sqb-"))
      .map((e) => {
        const meta: any = (e as any).meta ?? {};
        return {
          id: e.id,
          title: meta.taskTitle ?? e.title.replace(/^\[[^\]]+\]\s*/, ""),
          phase: meta.phase ?? "General",
          parent: meta.parent ?? "Strategic Quarters",
          deadline: meta.deadline ?? e.start,
          subtasks: meta.subtasks ?? [],
          progress: meta.progress ?? 0,
          standalone: false,
        };
      });

    const stdRows: Row[] = fdTasks.map((t) => ({
      id: t.id,
      title: t.title,
      phase: t.phase,
      parent: "Standalone strategic task",
      deadline: t.deadline,
      subtasks: t.subtasks.map((s) => ({ id: s.id, title: s.title, done: s.done })),
      progress: t.subtasks.length
        ? Math.round((t.subtasks.filter((s) => s.done).length / t.subtasks.length) * 100)
        : 0,
      standalone: true,
    }));

    return [...boardRows, ...stdRows]
      .map((r) => {
        const eventDate = new Date(r.deadline);
        const diffMs = eventDate.getTime() - now.getTime();
        const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        const deadlineStatus: "overdue" | "upcoming" | "completed" =
          daysRemaining < 0 ? "overdue" : "upcoming";
        return { ...r, eventDate, daysRemaining, deadlineStatus };
      })
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [events, fdTasks]);

  const statusConfig = {
    overdue: { icon: AlertTriangle },
    upcoming: { icon: Circle },
    completed: { icon: CheckCircle },
  };

  const selected = openId ? rows.find((d) => d.id === openId) ?? null : null;
  const selPhase = selected?.phase ?? "General";
  const selPhaseColor = PHASE_COLORS[selPhase] ?? STRATEGIC_COLOR;
  const selIsOverdue = selected ? selected.daysRemaining < 0 : false;
  const selCountdownColor = selIsOverdue ? "#E24B4A" : selPhaseColor;
  const selCountdownLabel = selected
    ? selected.daysRemaining < 0
      ? `${Math.abs(selected.daysRemaining)}d overdue`
      : selected.daysRemaining === 0
      ? "today"
      : `${selected.daysRemaining}d left`
    : "";

  // Live progress for selected standalone (in case fdTasks changed since row memo)
  const selStandaloneTask = selected?.standalone
    ? fdTasks.find((t) => t.id === selected.id) ?? null
    : null;
  const selSubtasks = selStandaloneTask
    ? selStandaloneTask.subtasks.map((s) => ({ id: s.id, title: s.title, done: s.done }))
    : selected?.subtasks ?? [];
  const selProgress = selStandaloneTask
    ? (selStandaloneTask.subtasks.length
        ? Math.round(selStandaloneTask.subtasks.filter((s) => s.done).length / selStandaloneTask.subtasks.length * 100)
        : 0)
    : selected?.progress ?? 0;

  const handleOpenInBoard = () => {
    const taskId = (selected as any)?.__taskId ?? selected?.id?.replace(/^sqb-[^-]+-/, "");
    const sectionId = (selected as any)?.__sectionId;
    window.dispatchEvent(new CustomEvent("sqb-focus-task", {
      detail: {
        taskId: (selected as any)?.meta?.taskId ?? taskId,
        sectionId: (selected as any)?.meta?.sectionId ?? sectionId,
      },
    }));
    setOpenId(null);
    requestAnimationFrame(() => {
      document.getElementById("strategic-quarters")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const openEditor = (task: FDTask | null) => {
    setEditorTask(
      task ?? {
        id: newId(),
        title: "",
        phase: "General",
        deadline: new Date().toISOString().slice(0, 10),
        subtasks: [],
      }
    );
    setEditorOpen(true);
  };

  const handleEditStandalone = () => {
    if (!selected) return;
    const t = fdTasks.find((x) => x.id === selected.id);
    if (t) {
      setOpenId(null);
      openEditor(t);
    }
  };

  const handleDeleteStandalone = () => {
    if (!selected) return;
    deleteFd(selected.id);
    setOpenId(null);
  };

  return (
    <div className="relative flex-1 min-h-0 min-w-0 flex flex-col">
      <span className="absolute inset-y-0 -left-1 w-[3px] rounded-full bg-[#BA7517] pointer-events-none" />
      <div className="flex justify-end mb-1.5 shrink-0">
        <span
          className="font-mono text-[8.5px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
          style={{ color: STRATEGIC_COLOR, background: hexA(STRATEGIC_COLOR, 0.16) }}
        >
          Strategic Board
        </span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex-1 min-h-0 min-w-0 space-y-1 max-h-[320px] overflow-y-auto pr-1"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.15) transparent",
        }}
      >
        {rows.length === 0 ? (
          <div className="flex items-center justify-center h-full min-h-[120px] px-4 py-8">
            <p className="text-[11.5px] text-muted-foreground/70 text-center leading-relaxed">
              No upcoming deadlines — add a strategic task below or set due dates in Strategic Quarters
            </p>
          </div>
        ) : (
          rows.map((d) => {
            const cfg = statusConfig[d.deadlineStatus];
            const Icon = cfg.icon;
            const phase = d.phase || "Strategic";
            const phaseColor = PHASE_COLORS[phase] ?? "#888780";
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setOpenId(d.id)}
                className="relative w-full text-left flex items-center gap-2.5 py-2 pl-3 pr-2.5 rounded-xl cursor-pointer transition-colors hover:bg-white/[0.04] min-w-0"
              >
                <span
                  className="absolute left-0 top-2 bottom-2 w-[2.5px] rounded-full"
                  style={{ background: STRATEGIC_COLOR }}
                />
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[12.5px] font-medium text-foreground/85 truncate"
                    title={d.title}
                  >
                    {d.title}
                  </p>
                  <div className="font-mono text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2 min-w-0">
                    <span className="truncate">
                      {d.eventDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                    <span
                      className={`truncate ${
                        d.daysRemaining < 0
                          ? "text-destructive"
                          : d.daysRemaining <= 7
                          ? "text-chart-amber"
                          : "text-muted-foreground"
                      }`}
                    >
                      {d.daysRemaining < 0
                        ? `${Math.abs(d.daysRemaining)}d overdue`
                        : d.daysRemaining === 0
                        ? "Today"
                        : `${d.daysRemaining}d left`}
                    </span>
                  </div>
                </div>
                <span
                  className="font-mono text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap"
                  style={{ background: phaseColor + "29", color: phaseColor }}
                >
                  {phase}
                </span>
              </button>
            );
          })
        )}
      </motion.div>

      <button
        type="button"
        onClick={() => openEditor(null)}
        className="w-full mt-2.5 py-2.5 rounded-xl border border-dashed border-border text-[12px] font-semibold text-[#BA7517] hover:bg-[rgba(186,117,23,0.08)] transition-colors shrink-0"
      >
        + Add strategic task
      </button>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-w-[460px] rounded-2xl bg-background border-border p-5 gap-3">
          {selected && (
            <>
              <div className="flex items-start gap-2.5">
                <span
                  className="font-mono text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 mt-0.5"
                  style={{ color: selPhaseColor, background: hexA(selPhaseColor, 0.18) }}
                >
                  {selPhase}
                </span>
                <div className="min-w-0 flex-1">
                  <DialogTitle className="text-[15px] font-semibold text-foreground leading-tight">
                    {selected.title}
                  </DialogTitle>
                  {selected.parent && (
                    <p className="font-mono text-[10.5px] text-muted-foreground mt-1 truncate">
                      {selected.parent}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="font-mono text-[10.5px] px-2.5 py-1 rounded-full"
                  style={{ color: selCountdownColor, background: hexA(selCountdownColor, 0.15) }}
                >
                  {fmtDeadline(selected.deadline)} · {selCountdownLabel}
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-mono">
                    Progress
                  </span>
                  <span
                    className="font-mono text-[11px] font-semibold"
                    style={{ color: selPhaseColor }}
                  >
                    {selProgress}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${selProgress}%`,
                      background: selPhaseColor,
                    }}
                  />
                </div>
              </div>

              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-mono mb-2">
                  What's needed to complete this
                </p>
                {selSubtasks.length > 0 ? (
                  <ul className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1"
                      style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.15) transparent" }}>
                    {selSubtasks.map((s: any, i: number) => {
                      const interactive = !!selected.standalone && !!s.id;
                      const Wrap: any = interactive ? "button" : "div";
                      return (
                        <li key={s.id ?? i}>
                          <Wrap
                            {...(interactive ? { type: "button", onClick: () => toggleFdSub(selected.id, s.id) } : {})}
                            className={`flex items-start gap-2 w-full text-left ${interactive ? "hover:bg-white/[0.03] rounded-md px-1 py-0.5 -mx-1 transition-colors" : ""}`}
                          >
                            <span
                              className="mt-[3px] w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center shrink-0"
                              style={{
                                borderColor: s.done ? selPhaseColor : "hsl(var(--border))",
                                background: s.done ? selPhaseColor : "transparent",
                              }}
                            >
                              {s.done && (
                                <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-white">
                                  <path d="M2 6l2.5 2.5L10 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </span>
                            <span
                              className={`text-[12px] leading-snug ${
                                s.done ? "line-through text-muted-foreground/60" : "text-foreground/90"
                              }`}
                            >
                              {s.title}
                            </span>
                          </Wrap>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-[12px] text-muted-foreground/70 italic">
                    No sub-items — this deadline is a single item.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                {selected.standalone ? (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleEditStandalone}
                      className="text-[11.5px] font-medium text-foreground/80 hover:text-foreground transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteStandalone}
                      className="inline-flex items-center gap-1 text-[11.5px] font-medium text-destructive/80 hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleOpenInBoard}
                    className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-foreground/80 hover:text-foreground transition-colors"
                  >
                    Open in Strategic Quarters
                    <ExternalLink className="h-3 w-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpenId(null)}
                  className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-[11.5px] font-medium hover:bg-primary/90 transition-colors"
                >
                  Done
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <TaskEditor
        open={editorOpen}
        task={editorTask}
        onClose={() => setEditorOpen(false)}
        onSave={(t) => { upsertFd(t); setEditorOpen(false); }}
      />
    </div>
  );
};

// ---- Editor ----

function TaskEditor({
  open, task, onClose, onSave,
}: {
  open: boolean;
  task: FDTask | null;
  onClose: () => void;
  onSave: (t: FDTask) => void;
}) {
  const [draft, setDraft] = useState<FDTask | null>(task);

  useEffect(() => { setDraft(task); }, [task, open]);

  if (!draft) return null;

  const phaseColor = PHASE_COLORS[draft.phase] ?? STRATEGIC_COLOR;

  const update = (patch: Partial<FDTask>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const updateSub = (id: string, patch: Partial<FDSub>) =>
    setDraft((d) => d ? ({ ...d, subtasks: d.subtasks.map(s => s.id === id ? { ...s, ...patch } : s) }) : d);
  const addSub = () =>
    setDraft((d) => d ? ({ ...d, subtasks: [...d.subtasks, { id: newId(), title: "", done: false }] }) : d);
  const removeSub = (id: string) =>
    setDraft((d) => d ? ({ ...d, subtasks: d.subtasks.filter(s => s.id !== id) }) : d);

  const canSave = draft.title.trim().length > 0 && !!draft.deadline;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[500px] rounded-2xl bg-background border-border p-5 gap-3">
        <DialogTitle className="text-[15px] font-semibold text-foreground">
          {task && task.title ? "Edit strategic task" : "New strategic task"}
        </DialogTitle>

        <div className="space-y-3">
          <div>
            <label className="font-mono text-[10.5px] uppercase tracking-wide text-muted-foreground block mb-1">
              Title
            </label>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => update({ title: e.target.value })}
              placeholder="e.g. File Q3 compliance report"
              className="w-full bg-white/[0.03] border border-border rounded-lg px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-[#BA7517]/60"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-mono text-[10.5px] uppercase tracking-wide text-muted-foreground block mb-1">
                Phase
              </label>
              <select
                value={draft.phase}
                onChange={(e) => update({ phase: e.target.value as FDPhase })}
                className="w-full bg-white/[0.03] border border-border rounded-lg px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-[#BA7517]/60"
                style={{ colorScheme: "dark" }}
              >
                {PHASES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-mono text-[10.5px] uppercase tracking-wide text-muted-foreground block mb-1">
                Deadline
              </label>
              <input
                type="date"
                value={draft.deadline}
                onChange={(e) => update({ deadline: e.target.value })}
                className="w-full bg-white/[0.03] border border-border rounded-lg px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-[#BA7517]/60"
                style={{ colorScheme: "dark" }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-mono text-[10.5px] uppercase tracking-wide text-muted-foreground">
                Hierarchy to complete it
              </label>
              <span
                className="font-mono text-[10px] px-1.5 py-0.5 rounded"
                style={{ color: phaseColor, background: hexA(phaseColor, 0.15) }}
              >
                {draft.subtasks.length} step{draft.subtasks.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1"
                 style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.15) transparent" }}>
              {draft.subtasks.map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={s.title}
                    onChange={(e) => updateSub(s.id, { title: e.target.value })}
                    placeholder="Subtask"
                    className="flex-1 bg-white/[0.03] border border-border rounded-md px-2.5 py-1.5 text-[12.5px] text-foreground focus:outline-none focus:border-[#BA7517]/60"
                  />
                  <button
                    type="button"
                    onClick={() => removeSub(s.id)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-white/[0.04] transition-colors"
                    aria-label="Remove subtask"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addSub}
              className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-medium text-[#BA7517] hover:opacity-80 transition-opacity"
            >
              <Plus className="h-3 w-3" /> Add subtask
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl text-[11.5px] font-medium text-foreground/70 hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => canSave && onSave(draft)}
            className="px-3.5 py-1.5 rounded-xl text-[11.5px] font-semibold text-white transition-opacity disabled:opacity-40"
            style={{ background: STRATEGIC_COLOR }}
          >
            {task && task.title ? "Save" : "Create task"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DeadlineTracker;
