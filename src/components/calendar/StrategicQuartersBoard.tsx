import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Plus,
  Trash2,
  X,
  CalendarDays,
} from "lucide-react";

import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { type LiveCalendarEvent } from "@/contexts/DashboardDataContext";

// ---- Types ----

type Phase = "Pre Seal" | "Close the Seal" | "Post Seal" | "Legacy";

interface Subtask {
  id: string;
  title: string;
  done: boolean;
  dueDate: string | null;
}

interface TaskItem {
  id: string;
  title: string;
  done: boolean;
  dueDate: string | null;
  subtasks: Subtask[];
  expanded: boolean;
}

interface BoardSection {
  id: string;
  phase: Phase;
  title: string;
  quarter: string;
  collapsed: boolean;
  tasks: TaskItem[];
  deadline?: string | null;
}

interface BoardData {
  sections: BoardSection[];
}

interface StrategicQuartersBoardProps {
  onInjectEvents: (events: LiveCalendarEvent[]) => void;
}

// ---- Constants ----

const PHASE_COLORS: Record<Phase, string> = {
  "Pre Seal": "#E24B4A",
  "Close the Seal": "#BA7517",
  "Post Seal": "#378ADD",
  Legacy: "#22C55E",
};

const STATUS_COLORS: Record<"On Pace" | "At Risk" | "Complete", string> = {
  "On Pace": "#1FB37E",
  "At Risk": "#E0A13C",
  Complete: "#2FD39C",
};

const STORAGE_KEY = "tt_strategic_quarters";
const SQ_CACHE_KEY = "tt_strategic_quarters";
const CACHE_WEBHOOK = "https://n8n.srv1437130.hstgr.cloud/webhook/dashboard-cache";
const uid = () => Math.random().toString(36).slice(2, 10);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function fmtDeadline(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}
function daysUntil(iso: string): number {
  const n = new Date(); n.setHours(0, 0, 0, 0);
  const t = new Date(iso); t.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - n.getTime()) / 86400000);
}
function countdownLabel(d: number): string {
  if (d === 0) return "today";
  if (d === 1) return "in 1 day";
  if (d > 1) return `in ${d} days`;
  if (d === -1) return "1 day ago";
  return `${Math.abs(d)} days ago`;
}
function countdownColor(d: number): string {
  if (d <= 1) return "#E24B4A";
  if (d <= 7) return "#E0A13C";
  return "#1FB37E";
}

// ---- Quadrant helpers ----

const PHASE_ORDER: Phase[] = ["Pre Seal", "Post Seal", "Close the Seal", "Legacy"];

function taskProgress(task: TaskItem): number {
  if (!task.subtasks || task.subtasks.length === 0) {
    return task.done ? 100 : 0;
  }
  const done = task.subtasks.filter((s) => s.done).length;
  return Math.round((done / task.subtasks.length) * 100);
}

function zoneProgress(sections: BoardSection[]): number {
  let done = 0, total = 0;
  sections.forEach((sec) =>
    sec.tasks.forEach((t) => {
      if (t.subtasks && t.subtasks.length) {
        total += t.subtasks.length;
        done += t.subtasks.filter((s) => s.done).length;
      } else {
        total += 1;
        done += t.done ? 1 : 0;
      }
    })
  );
  return total ? Math.round((done / total) * 100) : 0;
}

function sectionProgress(section: BoardSection): number {
  return zoneProgress([section]);
}

function zoneListStats(sections: BoardSection[]) {
  const tasks = sections.flatMap((s) => s.tasks);
  const complete = tasks.filter((t) => taskProgress(t) === 100).length;
  return { complete, total: tasks.length };
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// ---- Seed ----

function buildSeed(): BoardData {
  return {
    sections: [
      {
        id: uid(),
        phase: "Post Seal",
        title: "Post-Seal Tactiles & Pre-Seal Linemarking",
        quarter: "Q1 2026",
        collapsed: false,
        tasks: [
          {
            id: uid(), title: "January new EOIs", done: false, dueDate: null, expanded: false,
            subtasks: [
              { id: uid(), title: "Hitlist + drive-by pics / reachouts", done: false, dueDate: null },
              { id: uid(), title: "Mehmet contact existing clients for upcoming projects", done: false, dueDate: null },
            ],
          },
          {
            id: uid(), title: "Employ replacement", done: false, dueDate: null, expanded: false,
            subtasks: [
              { id: uid(), title: "Breakdown of daily tasks: Krish's, Mehmet's", done: false, dueDate: null },
              { id: uid(), title: "Create job ad: contract, remuneration", done: false, dueDate: null },
            ],
          },
          {
            id: uid(), title: "Interstate expansion", done: false, dueDate: null, expanded: false,
            subtasks: [
              { id: uid(), title: "Queensland: create plan of action", done: false, dueDate: null },
            ],
          },
          {
            id: uid(), title: "Asad Afqual", done: false, dueDate: null, expanded: false,
            subtasks: [
              { id: uid(), title: "Company car", done: false, dueDate: null },
              { id: uid(), title: "Role transition: create manager role → contract of employment", done: false, dueDate: null },
              { id: uid(), title: "Tasks & responsibilities", done: false, dueDate: null },
            ],
          },
          {
            id: uid(), title: "China activities", done: false, dueDate: null, expanded: false,
            subtasks: [
              { id: uid(), title: "Entry mat supplier", done: false, dueDate: null },
              { id: uid(), title: "Stair nosings supplier", done: false, dueDate: null },
              { id: uid(), title: "Equipment: multi drills, bits, adhesives, templates", done: false, dueDate: null },
            ],
          },
          {
            id: uid(), title: "Employ linemarker", done: false, dueDate: null, expanded: false,
            subtasks: [
              { id: uid(), title: "Quoting & sales", done: false, dueDate: null },
              { id: uid(), title: "Technical expertise: installing, standards, licences", done: false, dueDate: null },
              { id: uid(), title: "Project experience: warehouses, schools, mixed-use, residential, childcare", done: false, dueDate: null },
              { id: uid(), title: "Day to day tasks: work as tactiler, linemark as required", done: false, dueDate: null },
            ],
          },
          {
            id: uid(), title: "Equipment required (~$30K)", done: false, dueDate: null, expanded: false,
            subtasks: [
              { id: uid(), title: "Refer to doc for 'staple equipment'", done: false, dueDate: null },
              { id: uid(), title: "China alternatives", done: false, dueDate: null },
            ],
          },
          {
            id: uid(), title: "Company setup", done: false, dueDate: null, expanded: false,
            subtasks: [
              { id: uid(), title: "PTY LTD @ 60/60 $1 each", done: false, dueDate: null },
              { id: uid(), title: "Trust / empire setup (when jobs won)", done: false, dueDate: null },
              { id: uid(), title: "Branding: name, website, email / signatures, Google Biz profile", done: false, dueDate: null },
            ],
          },
          {
            id: uid(), title: "Linemarking feedback", done: false, dueDate: null, expanded: false,
            subtasks: [
              { id: uid(), title: "Questions", done: false, dueDate: null },
              { id: uid(), title: "Best way to EOI", done: false, dueDate: null },
              { id: uid(), title: "Packaging trade methods", done: false, dueDate: null },
            ],
          },
          {
            id: uid(), title: "Business plan — Vinny & Alex", done: false, dueDate: null, expanded: false,
            subtasks: [],
          },
        ],
      },
      {
        id: uid(),
        phase: "Pre Seal",
        title: "Pre-Seal Tactiles Dropshipping & App Development",
        quarter: "Q2 2026",
        collapsed: false,
        tasks: [
          {
            id: uid(), title: "Suppliers confirm", done: false, dueDate: null, expanded: false,
            subtasks: [
              { id: uid(), title: "Product lists", done: false, dueDate: null },
              { id: uid(), title: "Pricelists / MOQs etc.", done: false, dueDate: null },
              { id: uid(), title: "Testing", done: false, dueDate: null },
            ],
          },
          {
            id: uid(), title: "Logistics preparation", done: false, dueDate: null, expanded: false,
            subtasks: [
              { id: uid(), title: "Fast shipping / delivery", done: false, dueDate: null },
              { id: uid(), title: "Packaging", done: false, dueDate: null },
              { id: uid(), title: "Returns / refunds", done: false, dueDate: null },
              { id: uid(), title: "Inventory / warehouse?", done: false, dueDate: null },
            ],
          },
          {
            id: uid(), title: "Systems setup", done: false, dueDate: null, expanded: false,
            subtasks: [
              { id: uid(), title: "Website? / page?", done: false, dueDate: null },
              { id: uid(), title: "Payments", done: false, dueDate: null },
              { id: uid(), title: "Automations", done: false, dueDate: null },
              { id: uid(), title: "Process from start to end", done: false, dueDate: null },
              { id: uid(), title: "Advertising", done: false, dueDate: null },
            ],
          },
          {
            id: uid(), title: "App document for quotes", done: false, dueDate: null, expanded: false,
            subtasks: [
              { id: uid(), title: "'Job Ad'", done: false, dueDate: null },
              { id: uid(), title: "Budget / timeline", done: false, dueDate: null },
              { id: uid(), title: "Requirements", done: false, dueDate: null },
            ],
          },
          {
            id: uid(), title: "Refine app structure & objectives", done: false, dueDate: null, expanded: false,
            subtasks: [
              { id: uid(), title: "Based on Zoho Projects, app chats, dev feedback", done: false, dueDate: null },
              { id: uid(), title: "Procure, Fieldwire etc.", done: false, dueDate: null },
            ],
          },
          {
            id: uid(), title: "Sourcing capital", done: false, dueDate: null, expanded: false,
            subtasks: [
              { id: uid(), title: "Vinny?", done: false, dueDate: null },
              { id: uid(), title: "Profit?", done: false, dueDate: null },
            ],
          },
        ],
      },
    ],
  };
}

// ---- localStorage ----

function loadData(): BoardData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return buildSeed();
}

function saveData(_d: BoardData) {
  // Persistence handled by the autosave effect in the main component
  // (instant localStorage + debounced cache POST). Kept as a no-op so
  // existing call sites remain valid.
}

// ---- InlineEdit ----

function InlineEdit({
  value,
  onSave,
  onCancel,
  onEnter,
  onBackspaceEmpty,
  className = "",
  autoFocus = false,
  placeholder = "",
}: {
  value: string;
  onSave: (v: string) => void;
  onCancel?: () => void;
  onEnter?: () => void;
  onBackspaceEmpty?: () => void;
  className?: string;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(autoFocus);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft.trim()) onSave(draft.trim());
    else if (onCancel) onCancel();
    else onSave(value);
  };

  if (!editing) {
    return (
      <span className={`cursor-text ${className}`} onClick={() => setEditing(true)}>
        {value || placeholder}
      </span>
    );
  }

  return (
    <input
      ref={inputRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
          onEnter?.();
        }
        if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
          onCancel?.();
        }
        if (e.key === "Backspace" && draft === "" && onBackspaceEmpty) {
          e.preventDefault();
          onBackspaceEmpty();
        }
      }}
      className={`bg-transparent border-b border-primary/40 outline-none ${className}`}
      placeholder={placeholder}
    />
  );
}

// ---- Custom Checkbox ----

function CustomCheckbox({
  checked,
  onChange,
  size = 16,
  color,
}: {
  checked: boolean;
  onChange: () => void;
  size?: number;
  color: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex-shrink-0 rounded-sm border transition-colors flex items-center justify-center"
      style={{
        width: size,
        height: size,
        borderColor: checked ? color : "hsl(var(--border))",
        backgroundColor: checked ? color : "transparent",
      }}
    >
      {checked && <Check className="text-white" style={{ width: size - 4, height: size - 4 }} />}
    </button>
  );
}

// ---- DateChip ----

function DateChip({
  dueDate,
  phaseColor,
  onSetDate,
  onClearDate,
  hoverClass,
}: {
  dueDate: string | null;
  phaseColor: string;
  onSetDate: (d: string) => void;
  onClearDate: () => void;
  hoverClass: string;
}) {
  if (!dueDate) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button className={`${hoverClass} transition-opacity`}>
            <CalendarDays className="h-3 w-3 text-muted-foreground/40" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start" sideOffset={4}>
          <input
            type="date"
            className="bg-background border border-border rounded-lg px-2 py-1 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/40"
            onChange={(e) => {
              if (e.target.value) onSetDate(e.target.value);
            }}
          />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <span
          className="text-[10px] font-mono px-2 py-0.5 rounded-full cursor-pointer inline-flex items-center gap-1 group/pill"
          style={{ background: `${phaseColor}22`, color: phaseColor }}
        >
          {fmtDate(dueDate)}
          <button
            className="opacity-0 group-hover/pill:opacity-100 transition-opacity text-current hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onClearDate();
            }}
          >
            ×
          </button>
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start" sideOffset={4}>
        <input
          type="date"
          defaultValue={dueDate}
          className="bg-background border border-border rounded-lg px-2 py-1 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/40"
          onChange={(e) => {
            if (e.target.value) onSetDate(e.target.value);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

// ---- Main Component ----

export default function StrategicQuartersBoard({ onInjectEvents }: StrategicQuartersBoardProps) {
  const [data, setData] = useState<BoardData>(loadData);

  const update = useCallback((fn: (d: BoardData) => BoardData) => {
    setData((prev) => {
      const next = fn(prev);
      saveData(next);
      return next;
    });
  }, []);

  // ---- Cache-backed persistence (mirrors tt_debt_register pattern) ----
  const sqInitRef = useRef(false);
  const sqSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(CACHE_WEBHOOK);
        const rows = await res.json();
        const row = Array.isArray(rows) ? rows.find((r: any) => r?.key === SQ_CACHE_KEY) : null;
        if (alive && row?.value) {
          const parsed = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
          if (parsed && Array.isArray(parsed.sections)) setData(parsed);
        }
      } catch { /* offline: keep localStorage-seeded value */ }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!sqInitRef.current) { sqInitRef.current = true; return; }
    const serialised = JSON.stringify(data);
    try { localStorage.setItem(STORAGE_KEY, serialised); } catch {}
    clearTimeout(sqSaveTimer.current);
    sqSaveTimer.current = setTimeout(() => {
      fetch(CACHE_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: SQ_CACHE_KEY, value: serialised }),
      }).catch(() => { /* offline: localStorage already saved */ });
    }, 1000);
  }, [data]);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [editingDeadlineId, setEditingDeadlineId] = useState<string | null>(null);
  const [openSealedIds, setOpenSealedIds] = useState<Set<string>>(new Set());
  const toggleSealed = (id: string) =>
    setOpenSealedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);

  useEffect(() => {
    const onFocus = (e: Event) => {
      const { taskId, sectionId } = (e as CustomEvent).detail || {};
      if (!taskId) return;
      if (sectionId) {
        setOpenSealedIds((prev) => {
          const n = new Set(prev);
          n.add(sectionId);
          return n;
        });
      }
      // expand the task's subtasks
      setData((prev) => {
        const next = {
          ...prev,
          sections: prev.sections.map((s) =>
            sectionId && s.id !== sectionId
              ? s
              : {
                  ...s,
                  tasks: s.tasks.map((t) =>
                    t.id === taskId ? { ...t, expanded: true } : t
                  ),
                }
          ),
        };
        saveData(next);
        return next;
      });
      setFocusedTaskId(taskId);
      setTimeout(() => {
        document.getElementById(`strategic-quarters`)?.scrollIntoView({ behavior: "smooth", block: "start" });
        setTimeout(() => {
          document.getElementById(`sqb-task-${taskId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 250);
      }, 60);
      setTimeout(() => setFocusedTaskId((cur) => (cur === taskId ? null : cur)), 2800);
    };
    window.addEventListener("sqb-focus-task", onFocus);
    return () => window.removeEventListener("sqb-focus-task", onFocus);
  }, []);



  const reorderSections = (from: number, to: number) => {
    if (from === to) return;
    update((d) => {
      const sections = [...d.sections];
      const [moved] = sections.splice(from, 1);
      sections.splice(to, 0, moved);
      return { ...d, sections };
    });
  };

  const setSectionDeadline = (sectionId: string, deadline: string | null) =>
    update((d) => ({
      ...d,
      sections: d.sections.map((s) => (s.id === sectionId ? { ...s, deadline } : s)),
    }));

  // Calendar event derivation
  useEffect(() => {
    const events: LiveCalendarEvent[] = [];
    data.sections.forEach((sec) => {
      sec.tasks.forEach((task) => {
        const subtaskSnap = task.subtasks.map((s) => ({ title: s.title, done: s.done }));
        const progress = task.subtasks.length
          ? Math.round((task.subtasks.filter((s) => s.done).length / task.subtasks.length) * 100)
          : (task.done ? 100 : 0);
        const taskMeta = {
          kind: "task" as const,
          phase: sec.phase,
          parent: `${sec.title} · ${sec.quarter}`,
          taskTitle: task.title,
          deadline: task.dueDate,
          subtasks: subtaskSnap,
          progress,
          taskId: task.id,
          sectionId: sec.id,
        };
        if (task.dueDate) {
          events.push({
            id: `sqb-${sec.id}-${task.id}`,
            title: `[${sec.phase}] ${task.title}`,
            description: `Strategic deadline · ${sec.title} (${sec.quarter})`,
            start: new Date(task.dueDate).toISOString(),
            end: new Date(task.dueDate).toISOString(),
            allDay: true,
            source: "Strategic Board",
            type: "Deadline",
            attendees: [],
            meta: taskMeta,
          });
        }
        task.subtasks.forEach((st) => {
          if (st.dueDate) {
            events.push({
              id: `sqb-${sec.id}-${task.id}-${st.id}`,
              title: `[${sec.phase}] ${task.title} → ${st.title}`,
              description: `Strategic deadline · ${sec.title} (${sec.quarter})`,
              start: new Date(st.dueDate).toISOString(),
              end: new Date(st.dueDate).toISOString(),
              allDay: true,
              source: "Strategic Board",
              type: "Deadline",
              attendees: [],
              meta: { ...taskMeta, deadline: st.dueDate },
            });
          }
        });
      });
    });
    data.sections.forEach((section) => {
      if (section.deadline) {
        events.push({
          id: `sqb-deadline-${section.id}`,
          title: `[${section.phase}] ${section.title} — deadline`,
          description: `Strategic quarter deadline (${section.quarter})`,
          start: new Date(section.deadline).toISOString(),
          end: new Date(section.deadline).toISOString(),
          allDay: true,
          source: "Strategic Board",
          type: "Deadline",
          attendees: [],
          meta: {
            kind: "section" as const,
            phase: section.phase,
            parent: section.quarter,
            taskTitle: section.title,
            deadline: section.deadline,
            subtasks: section.tasks.map((t) => ({
              title: t.title,
              done: taskProgress(t) === 100,
            })),
            progress: sectionProgress(section),
          },
        });
      }
    });
    onInjectEvents(events);
  }, [data, onInjectEvents]);

  // ---- Toggle logic ----

  const toggleTask = (secId: string, taskId: string) => {
    update((d) => ({
      ...d,
      sections: d.sections.map((sec) =>
        sec.id !== secId
          ? sec
          : {
              ...sec,
              tasks: sec.tasks.map((t) =>
                t.id !== taskId
                  ? t
                  : {
                      ...t,
                      done: !t.done,
                      subtasks: t.subtasks.map((st) => ({ ...st, done: !t.done })),
                    }
              ),
            }
      ),
    }));
  };

  const toggleSubtask = (secId: string, taskId: string, stId: string) => {
    update((d) => ({
      ...d,
      sections: d.sections.map((sec) =>
        sec.id !== secId
          ? sec
          : {
              ...sec,
              tasks: sec.tasks.map((t) => {
                if (t.id !== taskId) return t;
                const newSubs = t.subtasks.map((st) =>
                  st.id !== stId ? st : { ...st, done: !st.done }
                );
                const allDone = newSubs.length > 0 && newSubs.every((st) => st.done);
                return { ...t, subtasks: newSubs, done: allDone };
              }),
            }
      ),
    }));
  };

  // ---- Section CRUD ----

  const toggleSectionCollapse = (secId: string) => {
    update((d) => ({
      ...d,
      sections: d.sections.map((s) =>
        s.id !== secId ? s : { ...s, collapsed: !s.collapsed }
      ),
    }));
  };

  const deleteSection = (secId: string) => {
    update((d) => ({ ...d, sections: d.sections.filter((s) => s.id !== secId) }));
  };

  const updateSectionTitle = (secId: string, title: string) => {
    update((d) => ({
      ...d,
      sections: d.sections.map((s) => (s.id !== secId ? s : { ...s, title })),
    }));
  };

  const updateSectionQuarter = (secId: string, quarter: string) => {
    update((d) => ({
      ...d,
      sections: d.sections.map((s) => (s.id !== secId ? s : { ...s, quarter })),
    }));
  };

  // ---- Task CRUD ----

  const addTask = (secId: string) => {
    update((d) => ({
      ...d,
      sections: d.sections.map((s) =>
        s.id !== secId
          ? s
          : {
              ...s,
              tasks: [
                ...s.tasks,
                { id: uid(), title: "New task", done: false, dueDate: null, subtasks: [], expanded: false },
              ],
            }
      ),
    }));
  };

  const deleteTask = (secId: string, taskId: string) => {
    update((d) => ({
      ...d,
      sections: d.sections.map((s) =>
        s.id !== secId ? s : { ...s, tasks: s.tasks.filter((t) => t.id !== taskId) }
      ),
    }));
  };

  const updateTaskTitle = (secId: string, taskId: string, title: string) => {
    update((d) => ({
      ...d,
      sections: d.sections.map((s) =>
        s.id !== secId
          ? s
          : { ...s, tasks: s.tasks.map((t) => (t.id !== taskId ? t : { ...t, title })) }
      ),
    }));
  };

  const setTaskDate = (secId: string, taskId: string, dueDate: string | null) => {
    update((d) => ({
      ...d,
      sections: d.sections.map((s) =>
        s.id !== secId
          ? s
          : { ...s, tasks: s.tasks.map((t) => (t.id !== taskId ? t : { ...t, dueDate })) }
      ),
    }));
  };

  const toggleTaskExpand = (secId: string, taskId: string) => {
    update((d) => ({
      ...d,
      sections: d.sections.map((s) =>
        s.id !== secId
          ? s
          : {
              ...s,
              tasks: s.tasks.map((t) =>
                t.id !== taskId ? t : { ...t, expanded: !t.expanded }
              ),
            }
      ),
    }));
  };

  // ---- Subtask CRUD ----

  const addSubtask = (secId: string, taskId: string) => {
    update((d) => ({
      ...d,
      sections: d.sections.map((s) =>
        s.id !== secId
          ? s
          : {
              ...s,
              tasks: s.tasks.map((t) =>
                t.id !== taskId
                  ? t
                  : {
                      ...t,
                      expanded: true,
                      subtasks: [
                        ...t.subtasks,
                        { id: uid(), title: "New subtask", done: false, dueDate: null },
                      ],
                    }
              ),
            }
      ),
    }));
  };

  const deleteSubtask = (secId: string, taskId: string, stId: string) => {
    update((d) => ({
      ...d,
      sections: d.sections.map((s) =>
        s.id !== secId
          ? s
          : {
              ...s,
              tasks: s.tasks.map((t) =>
                t.id !== taskId
                  ? t
                  : { ...t, subtasks: t.subtasks.filter((st) => st.id !== stId) }
              ),
            }
      ),
    }));
  };

  const updateSubtaskTitle = (secId: string, taskId: string, stId: string, title: string) => {
    update((d) => ({
      ...d,
      sections: d.sections.map((s) =>
        s.id !== secId
          ? s
          : {
              ...s,
              tasks: s.tasks.map((t) =>
                t.id !== taskId
                  ? t
                  : {
                      ...t,
                      subtasks: t.subtasks.map((st) =>
                        st.id !== stId ? st : { ...st, title }
                      ),
                    }
              ),
            }
      ),
    }));
  };

  const setSubtaskDate = (secId: string, taskId: string, stId: string, dueDate: string | null) => {
    update((d) => ({
      ...d,
      sections: d.sections.map((s) =>
        s.id !== secId
          ? s
          : {
              ...s,
              tasks: s.tasks.map((t) =>
                t.id !== taskId
                  ? t
                  : {
                      ...t,
                      subtasks: t.subtasks.map((st) =>
                        st.id !== stId ? st : { ...st, dueDate }
                      ),
                    }
              ),
            }
      ),
    }));
  };

  // ---- Add Section Popover State ----

  const [newPhase, setNewPhase] = useState<Phase>("Pre Seal");
  const [newQuarter, setNewQuarter] = useState("");
  const [newTitle, setNewTitle] = useState("");

  const handleAddSection = () => {
    if (!newTitle.trim() || !newQuarter.trim()) return;
    update((d) => ({
      ...d,
      sections: [
        ...d.sections,
        {
          id: uid(),
          phase: newPhase,
          title: newTitle.trim(),
          quarter: newQuarter.trim(),
          collapsed: false,
          tasks: [],
        },
      ],
    }));
    setNewTitle("");
    setNewQuarter("");
  };

  return (
    <motion.div
      id="strategic-quarters"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mt-8 pt-6 border-t border-white/15"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
        {/* Left: accent bar + title + subtitle */}
        <div className="flex items-center gap-3">
          <div
            className="w-1 h-9 rounded-full shrink-0"
            style={{ background: "linear-gradient(180deg, #E24B4A, #BA7517 40%, #378ADD 70%, #22C55E)" }}
          />
          <div>
            <h2 className="text-[22px] leading-none font-bold tracking-tight text-foreground">
              Strategic Quarters
            </h2>
            <p className="text-[13px] text-muted-foreground mt-1">
              Quarterly targets &amp; task tracking · four-phase hierarchy
            </p>
          </div>
        </div>

        {/* Right: larger legend keys */}
        <div className="flex items-center gap-[18px] flex-wrap">
          {(["Pre Seal", "Close the Seal", "Post Seal", "Legacy"] as const).map((p) => (
            <span key={p} className="flex items-center gap-2 text-[13px] font-medium text-foreground">
              <span
                className="w-[11px] h-[11px] rounded-full"
                style={{ background: PHASE_COLORS[p], boxShadow: "0 0 0 3px rgba(255,255,255,0.04)" }}
              />
              {p}
            </span>
          ))}
        </div>
      </div>

      {/* Section-driven grid (drag to reorder) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data.sections.map((section, idx) => {
          const accent = PHASE_COLORS[section.phase];
          const pct = zoneProgress([section]);
          const { complete: listComplete, total: listTotal } = zoneListStats([section]);
          const allDone = listTotal > 0 && listComplete === listTotal;
          const statusLabel: "On Pace" | "At Risk" | "Complete" = allDone
            ? "Complete"
            : pct < 34
            ? "At Risk"
            : "On Pace";
          const statusColor = STATUS_COLORS[statusLabel];
          const r = 18, circ = 2 * Math.PI * r, off = circ * (1 - pct / 100);
          const isComplete = listTotal > 0 && pct === 100;
          const isSealed = isComplete && !openSealedIds.has(section.id);
          const isExpanded = isComplete && openSealedIds.has(section.id);

          return (
            <div
              key={section.id}
              className={`relative rounded-2xl border overflow-hidden flex flex-col transition-all group ${
                isSealed ? "" : "min-h-[210px]"
              } ${dragIndex === idx ? "opacity-40" : ""} ${
                dropIndex === idx ? "ring-2" : "border-border"
              }`}
              style={
                isSealed
                  ? {
                      borderColor: "rgba(31,179,126,0.30)",
                      background: "linear-gradient(180deg, rgba(31,179,126,0.09), rgba(31,179,126,0.02))",
                    }
                  : {
                      background: "linear-gradient(180deg, rgba(255,255,255,0.022), rgba(255,255,255,0.008))",
                      ...(dropIndex === idx ? { boxShadow: `0 0 0 2px ${accent}` } : {}),
                    }
              }
              onDragOver={(e) => { e.preventDefault(); setDropIndex(idx); }}
              onDragLeave={() => setDropIndex((c) => (c === idx ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex !== null) reorderSections(dragIndex, idx);
                setDragIndex(null);
                setDropIndex(null);
              }}
            >
              <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: isSealed ? "#1FB37E" : accent }} />

              {isSealed ? (
                <>
                  <div className="flex items-start gap-2.5 px-4 pt-3 pb-3 pl-[15px]">
                    <div className="flex flex-col items-center gap-1 w-4 shrink-0 pt-0.5">
                      {confirmDeleteId === section.id ? (
                        <>
                          <button
                            onClick={() => { deleteSection(section.id); setConfirmDeleteId(null); }}
                            title="Confirm delete"
                            className="text-[#E24B4A]"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                          <button onClick={() => setConfirmDeleteId(null)} title="Cancel" className="text-muted-foreground">
                            <X className="h-3 w-3" />
                          </button>
                        </>
                      ) : (
                        <>
                          <span
                            draggable
                            onDragStart={() => setDragIndex(idx)}
                            onDragEnd={() => { setDragIndex(null); setDropIndex(null); }}
                            className="cursor-grab active:cursor-grabbing text-muted-foreground/45 group-hover:opacity-100 opacity-45"
                            title="Drag to reorder"
                          >
                            <GripVertical className="h-3.5 w-3.5" />
                          </span>
                          <button
                            onClick={() => setConfirmDeleteId(section.id)}
                            title="Delete quarter"
                            className="opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-[#E24B4A] text-muted-foreground transition-opacity"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <span
                        className="inline-block text-[9.5px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-1.5"
                        style={{ color: "#1FB37E", background: "rgba(31,179,126,0.15)" }}
                      >
                        {section.phase}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-[15px] h-[15px] rounded-full flex items-center justify-center shrink-0"
                          style={{ background: "#1FB37E" }}
                        >
                          <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                        </span>
                        <InlineEdit
                          value={section.title}
                          onSave={(v) => updateSectionTitle(section.id, v)}
                          className="text-[13.5px] font-semibold text-muted-foreground truncate"
                          placeholder="Section title…"
                        />
                      </div>
                      <div className="text-[10.5px] text-muted-foreground/70 font-mono mt-0.5 flex items-center gap-1">
                        <InlineEdit
                          value={section.quarter}
                          onSave={(v) => updateSectionQuarter(section.id, v)}
                          className="text-muted-foreground/70"
                          placeholder="Quarter…"
                        />
                        <span>· {listComplete}/{listTotal} lists complete</span>
                        {section.deadline ? ` · met ${fmtDeadline(section.deadline)}` : ""}
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <div
                        className="w-[46px] h-[46px] rounded-full flex items-center justify-center"
                        style={{
                          background: "radial-gradient(circle at 35% 30%, #2fd39c, #159d6c)",
                          boxShadow: "0 0 0 4px rgba(31,179,126,0.15)",
                        }}
                      >
                        <Check className="h-5 w-5 text-white" strokeWidth={2.6} />
                      </div>
                      <span
                        className="text-[9.5px] font-mono font-bold px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(31,179,126,0.16)", color: "#2fd39c" }}
                      >
                        Complete
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleSealed(section.id)}
                    className="flex items-center justify-center gap-1.5 py-2.5 text-[10.5px] font-mono text-[#1FB37E] border-t hover:bg-[rgba(31,179,126,0.08)]"
                    style={{ borderColor: "rgba(31,179,126,0.15)", background: "rgba(31,179,126,0.04)" }}
                  >
                    <ChevronDown className="h-3 w-3" /> View completed tasks
                  </button>
                </>
              ) : (
                <>
                  <div
                    className="flex items-start gap-2.5 px-4 pt-3.5 pb-3 pl-[18px] border-b border-border"
                    style={{ background: `linear-gradient(180deg, ${hexA(accent, 0.05)}, transparent)` }}
                  >
                    <div className="flex flex-col items-center gap-1 w-4 shrink-0 pt-0.5">
                      {confirmDeleteId === section.id ? (
                        <>
                          <button
                            onClick={() => { deleteSection(section.id); setConfirmDeleteId(null); }}
                            title="Confirm delete"
                            className="text-[#E24B4A]"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                          <button onClick={() => setConfirmDeleteId(null)} title="Cancel" className="text-muted-foreground">
                            <X className="h-3 w-3" />
                          </button>
                        </>
                      ) : (
                        <>
                          <span
                            draggable
                            onDragStart={() => setDragIndex(idx)}
                            onDragEnd={() => { setDragIndex(null); setDropIndex(null); }}
                            className="cursor-grab active:cursor-grabbing text-muted-foreground/45 group-hover:opacity-100 opacity-45"
                            title="Drag to reorder"
                          >
                            <GripVertical className="h-3.5 w-3.5" />
                          </span>
                          <button
                            onClick={() => setConfirmDeleteId(section.id)}
                            title="Delete quarter"
                            className="opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-[#E24B4A] text-muted-foreground transition-opacity"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <span
                        className="inline-block text-[9.5px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-1.5"
                        style={{ color: accent, background: hexA(accent, 0.15) }}
                      >
                        {section.phase}
                      </span>
                      <div className="text-[13px] font-semibold text-foreground truncate">
                        <InlineEdit
                          value={section.title}
                          onSave={(v) => updateSectionTitle(section.id, v)}
                          className="text-[13px] font-semibold text-foreground block w-full truncate"
                          placeholder="Section title…"
                        />
                      </div>
                      <div className="text-[10.5px] text-muted-foreground font-mono mt-0.5 flex items-center gap-1">
                        <InlineEdit
                          value={section.quarter}
                          onSave={(v) => updateSectionQuarter(section.id, v)}
                          className="text-muted-foreground"
                          placeholder="Quarter…"
                        />
                        <span>· {listComplete}/{listTotal} lists complete</span>
                      </div>

                      {/* Deadline chip */}
                      <div className="mt-1.5">
                        {editingDeadlineId === section.id ? (
                          <input
                            type="date"
                            autoFocus
                            defaultValue={section.deadline ?? ""}
                            onChange={(e) => { setSectionDeadline(section.id, e.target.value || null); setEditingDeadlineId(null); }}
                            onBlur={() => setEditingDeadlineId(null)}
                            className="text-[10.5px] font-mono bg-white/[0.06] text-foreground border rounded-lg px-1.5 py-0.5 outline-none"
                            style={{ colorScheme: "dark", borderColor: hexA(accent, 0.28) }}
                          />
                        ) : section.deadline ? (
                          <button
                            onClick={() => setEditingDeadlineId(section.id)}
                            className="inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full"
                            style={{
                              background: hexA(countdownColor(daysUntil(section.deadline)), 0.16),
                              color: countdownColor(daysUntil(section.deadline)),
                            }}
                          >
                            <CalendarDays className="h-3 w-3" />
                            {fmtDeadline(section.deadline)} · {countdownLabel(daysUntil(section.deadline))}
                          </button>
                        ) : (
                          <button
                            onClick={() => setEditingDeadlineId(section.id)}
                            className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full border border-border text-muted-foreground hover:text-foreground"
                          >
                            <CalendarDays className="h-3 w-3" />
                            Set deadline
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <div className="relative w-[46px] h-[46px]">
                        <svg width="46" height="46" viewBox="0 0 46 46" style={{ transform: "rotate(-90deg)" }}>
                          <circle cx="23" cy="23" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                          <circle
                            cx="23" cy="23" r={r} fill="none" stroke={statusColor} strokeWidth="4" strokeLinecap="round"
                            strokeDasharray={circ} strokeDashoffset={off}
                            style={{ transition: "stroke-dashoffset .4s ease" }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center font-mono text-[12px] font-bold text-foreground">
                          {pct}%
                        </div>
                      </div>
                      <span
                        className="text-[9.5px] font-mono font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: hexA(statusColor, 0.16), color: statusColor }}
                      >
                        {statusLabel}
                      </span>
                    </div>
                  </div>

                  <div className="px-2.5 pt-2 pb-3 overflow-y-auto flex-1 max-h-[360px]">
                    {section.tasks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-2 py-6 text-muted-foreground text-[11px]">
                        No tasks yet — use + Add task below.
                      </div>
                    ) : (
                      section.tasks.map((task) => {
                        const subTotal = task.subtasks?.length ?? 0;
                        const subDone = task.subtasks?.filter((s) => s.done).length ?? 0;
                        const pctT = taskProgress(task);
                        const complete = pctT === 100;

                        return (
                          <div
                            key={task.id}
                            id={`sqb-task-${task.id}`}
                            style={focusedTaskId === task.id ? ({ ["--flash" as any]: accent } as any) : undefined}
                            className={`rounded-xl px-1.5 py-1 mb-0.5 hover:bg-white/[0.04] transition-colors group/task ${complete ? "opacity-95" : ""} ${focusedTaskId === task.id ? "sqb-flash" : ""}`}
                          >
                            <div className="flex items-center gap-2.5 py-1">
                              {subTotal > 0 ? (
                                <button
                                  onClick={() => toggleTaskExpand(section.id, task.id)}
                                  className="text-muted-foreground/60 w-[11px] shrink-0"
                                >
                                  {task.expanded ? (
                                    <ChevronDown className="h-3 w-3" />
                                  ) : (
                                    <ChevronRight className="h-3 w-3" />
                                  )}
                                </button>
                              ) : (
                                <span className="w-[11px] shrink-0" />
                              )}

                              <button
                                onClick={() => toggleTask(section.id, task.id)}
                                className="w-[19px] h-[19px] rounded-md shrink-0 flex items-center justify-center border-2 transition-all"
                                style={
                                  complete
                                    ? { background: accent, borderColor: accent }
                                    : { background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.16)" }
                                }
                              >
                                {complete && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                              </button>

                              <div className="flex-1 min-w-0">
                                <InlineEdit
                                  value={task.title}
                                  onSave={(v) => updateTaskTitle(section.id, task.id, v)}
                                  className={`text-[12.5px] font-medium block w-full truncate ${complete ? "line-through text-muted-foreground font-normal" : "text-foreground/85"}`}
                                />
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <DateChip
                                  dueDate={task.dueDate}
                                  phaseColor={accent}
                                  onSetDate={(d) => setTaskDate(section.id, task.id, d)}
                                  onClearDate={() => setTaskDate(section.id, task.id, null)}
                                  hoverClass="opacity-0 group-hover/task:opacity-100"
                                />
                                {subTotal > 0 && (
                                  <span className="font-mono text-[10px] text-muted-foreground">
                                    {subDone}/{subTotal}
                                  </span>
                                )}
                                <span
                                  className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[38px] text-center"
                                  style={
                                    complete
                                      ? { background: "rgba(29,158,117,0.16)", color: "#38c99b" }
                                      : { background: hexA(accent, 0.15), color: accent }
                                  }
                                >
                                  {pctT}%
                                </span>
                                <button
                                  onClick={() => deleteTask(section.id, task.id)}
                                  className="opacity-0 group-hover/task:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>

                            {subTotal > 0 && (
                              <div className="h-[3px] rounded-full bg-white/[0.06] overflow-hidden ml-[29px] mb-0.5">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${pctT}%`, background: accent, transition: "width .3s ease" }}
                                />
                              </div>
                            )}

                            <AnimatePresence initial={false}>
                              {task.expanded && subTotal > 0 && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.15 }}
                                  className="overflow-hidden"
                                >
                                  <div
                                    className="ml-[28px] pl-3.5 mt-0.5 mb-1"
                                    style={{ borderLeft: `2px solid ${hexA(accent, 0.28)}` }}
                                  >
                                    {task.subtasks.map((st) => (
                                      <div
                                        key={st.id}
                                        className="relative flex items-center gap-2.5 py-1 px-1 rounded-md hover:bg-white/[0.04] group/subtask"
                                      >
                                        <span
                                          className="absolute -left-3.5 top-1/2 w-3 h-[2px]"
                                          style={{ background: hexA(accent, 0.28) }}
                                        />
                                        <button
                                          onClick={() => toggleSubtask(section.id, task.id, st.id)}
                                          className="w-4 h-4 rounded shrink-0 flex items-center justify-center border-2 transition-all"
                                          style={
                                            st.done
                                              ? { background: accent, borderColor: accent }
                                              : { background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.16)" }
                                          }
                                        >
                                          {st.done && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                                        </button>
                                        <div className="flex-1 min-w-0">
                                          <InlineEdit
                                            value={st.title}
                                            onSave={(v) => updateSubtaskTitle(section.id, task.id, st.id, v)}
                                            className={`text-[11.5px] block w-full ${st.done ? "line-through text-muted-foreground" : "text-foreground/65"}`}
                                          />
                                        </div>
                                        <DateChip
                                          dueDate={st.dueDate}
                                          phaseColor={accent}
                                          onSetDate={(d) => setSubtaskDate(section.id, task.id, st.id, d)}
                                          onClearDate={() => setSubtaskDate(section.id, task.id, st.id, null)}
                                          hoverClass="opacity-0 group-hover/subtask:opacity-100"
                                        />
                                        <button
                                          onClick={() => deleteSubtask(section.id, task.id, st.id)}
                                          className="opacity-0 group-hover/subtask:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </div>
                                    ))}
                                    <button
                                      onClick={() => addSubtask(section.id, task.id)}
                                      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground py-1 transition-colors"
                                    >
                                      <Plus className="h-3 w-3" /> Add subtask
                                    </button>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })
                    )}

                    {isExpanded ? (
                      <button
                        onClick={() => toggleSealed(section.id)}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 mt-1 text-[10.5px] font-mono text-[#1FB37E] border-t border-[rgba(31,179,126,0.15)] hover:bg-[rgba(31,179,126,0.08)]"
                        style={{ background: "rgba(31,179,126,0.04)" }}
                      >
                        <ChevronDown className="h-3 w-3 rotate-180" /> Seal as complete
                      </button>
                    ) : (
                      <button
                        onClick={() => addTask(section.id)}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-1.5 py-1 mt-0.5 transition-colors"
                      >
                        <Plus className="h-3 w-3" /> Add task
                      </button>
                    )}
                  </div>
                </>
              )}

            </div>
          );
        })}
      </div>


      {/* Add Section */}
      <div className="mt-4">
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Plus className="h-3.5 w-3.5" /> Add Section
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3 space-y-3" align="start">
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(PHASE_COLORS) as Phase[]).map((phase) => (
                <button
                  key={phase}
                  onClick={() => setNewPhase(phase)}
                  className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full transition-all"
                  style={{
                    background: newPhase === phase ? PHASE_COLORS[phase] : `${PHASE_COLORS[phase]}22`,
                    color: newPhase === phase ? "#fff" : PHASE_COLORS[phase],
                  }}
                >
                  {phase}
                </button>
              ))}
            </div>
            <input
              value={newQuarter}
              onChange={(e) => setNewQuarter(e.target.value)}
              placeholder="Q3 2026"
              className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/40"
            />
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Post-Seal Linemarking"
              className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/40"
            />
            <button
              onClick={handleAddSection}
              disabled={!newTitle.trim() || !newQuarter.trim()}
              className="w-full text-xs font-medium py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
            >
              Add Section
            </button>
          </PopoverContent>
        </Popover>
      </div>
    </motion.div>
  );
}
