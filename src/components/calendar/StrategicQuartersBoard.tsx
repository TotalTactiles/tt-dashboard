import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronRight,
  CalendarDays,
  Plus,
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
}

interface BoardData {
  sections: BoardSection[];
}

interface StrategicQuartersBoardProps {
  onInjectEvents: (events: LiveCalendarEvent[]) => void;
}

// ---- Constants ----

const PHASE_COLORS: Record<Phase, string> = {
  "Pre Seal": "#378ADD",
  "Close the Seal": "#1D9E75",
  "Post Seal": "#E24B4A",
  Legacy: "#BA7517",
};

const STORAGE_KEY = "tt_strategic_quarters";
const uid = () => Math.random().toString(36).slice(2, 10);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
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

function saveData(d: BoardData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
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

  // Calendar event derivation
  useEffect(() => {
    const events: LiveCalendarEvent[] = [];
    data.sections.forEach((sec) => {
      sec.tasks.forEach((task) => {
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
            });
          }
        });
      });
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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-foreground tracking-tight">Strategic Quarters</h2>
          <p className="text-[11px] text-muted-foreground font-mono">Quarterly targets & task tracking</p>
        </div>
      </div>

      {/* Section cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {data.sections.map((sec) => {
          const phaseColor = PHASE_COLORS[sec.phase];
          const doneCount = sec.tasks.filter((t) => t.done).length;
          const totalCount = sec.tasks.length;

          return (
            <motion.div
              key={sec.id}
              layout
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full rounded-xl border border-border/40 bg-background/60 p-4"
              style={{ borderLeft: `4px solid ${phaseColor}` }}
            >
              {/* Section header */}
              <div className="flex items-center gap-2 mb-3 group/section">
                <button onClick={() => toggleSectionCollapse(sec.id)} className="text-muted-foreground">
                  {sec.collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{ background: `${phaseColor}22`, color: phaseColor }}
                >
                  {sec.phase}
                </span>
                <InlineEdit
                  value={sec.title}
                  onSave={(v) => updateSectionTitle(sec.id, v)}
                  className="text-sm font-semibold text-foreground"
                />
                <InlineEdit
                  value={sec.quarter}
                  onSave={(v) => updateSectionQuarter(sec.id, v)}
                  className="text-[11px] font-mono text-muted-foreground"
                />
                <span className="text-[10px] text-muted-foreground ml-auto whitespace-nowrap">
                  {doneCount}/{totalCount} tasks
                </span>
                <button
                  onClick={() => deleteSection(sec.id)}
                  className="opacity-0 group-hover/section:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Tasks */}
              <AnimatePresence initial={false}>
                {!sec.collapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    {sec.tasks.map((task) => {
                      const subDone = task.subtasks.filter((s) => s.done).length;
                      const subTotal = task.subtasks.length;

                      return (
                        <div key={task.id}>
                          {/* Task row */}
                          <div className="flex items-center gap-2 py-1.5 group/task">
                            <GripVertical className="h-3 w-3 text-muted-foreground/30 opacity-0 group-hover/task:opacity-100 transition-opacity cursor-grab" />
                            <CustomCheckbox
                              checked={task.done}
                              onChange={() => toggleTask(sec.id, task.id)}
                              size={16}
                              color={phaseColor}
                            />
                            <InlineEdit
                              value={task.title}
                              onSave={(v) => updateTaskTitle(sec.id, task.id, v)}
                              className={`text-sm ${task.done ? "line-through text-muted-foreground/50" : "text-foreground"}`}
                            />
                            <DateChip
                              dueDate={task.dueDate}
                              phaseColor={phaseColor}
                              onSetDate={(d) => setTaskDate(sec.id, task.id, d)}
                              onClearDate={() => setTaskDate(sec.id, task.id, null)}
                              hoverClass="opacity-0 group-hover/task:opacity-100"
                            />
                            {subTotal > 0 && (
                              <span
                                className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
                                style={{ background: `${phaseColor}15`, color: phaseColor }}
                              >
                                {subDone}/{subTotal}
                              </span>
                            )}
                            {subTotal > 0 && (
                              <button
                                onClick={() => toggleTaskExpand(sec.id, task.id)}
                                className="text-muted-foreground"
                              >
                                {task.expanded ? (
                                  <ChevronDown className="h-3 w-3" />
                                ) : (
                                  <ChevronRight className="h-3 w-3" />
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => deleteTask(sec.id, task.id)}
                              className="opacity-0 group-hover/task:opacity-100 transition-opacity text-muted-foreground hover:text-destructive ml-auto"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>

                          {/* Subtasks */}
                          <AnimatePresence initial={false}>
                            {task.expanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="overflow-hidden"
                              >
                                {task.subtasks.map((st) => (
                                  <div
                                    key={st.id}
                                    className="flex items-center gap-2 py-1 group/subtask ml-2 pl-4 border-l border-border/30"
                                  >
                                    <CustomCheckbox
                                      checked={st.done}
                                      onChange={() => toggleSubtask(sec.id, task.id, st.id)}
                                      size={14}
                                      color={phaseColor}
                                    />
                                    <InlineEdit
                                      value={st.title}
                                      onSave={(v) => updateSubtaskTitle(sec.id, task.id, st.id, v)}
                                      className={`text-xs ${st.done ? "line-through text-muted-foreground/50" : "text-foreground"}`}
                                    />
                                    <DateChip
                                      dueDate={st.dueDate}
                                      phaseColor={phaseColor}
                                      onSetDate={(d) => setSubtaskDate(sec.id, task.id, st.id, d)}
                                      onClearDate={() => setSubtaskDate(sec.id, task.id, st.id, null)}
                                      hoverClass="opacity-0 group-hover/subtask:opacity-100"
                                    />
                                    <button
                                      onClick={() => deleteSubtask(sec.id, task.id, st.id)}
                                      className="opacity-0 group-hover/subtask:opacity-100 transition-opacity text-muted-foreground hover:text-destructive ml-auto"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))}
                                <button
                                  onClick={() => addSubtask(sec.id, task.id)}
                                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground ml-6 pl-4 py-1 transition-colors"
                                >
                                  <Plus className="h-3 w-3" /> Add subtask
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}

                    <button
                      onClick={() => addTask(sec.id)}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground mt-1 py-1 transition-colors"
                    >
                      <Plus className="h-3 w-3" /> Add task
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Add Section */}
      <div className="mt-3">
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Plus className="h-3.5 w-3.5" /> Add Section
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3 space-y-3" align="start">
            {/* Phase pills */}
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
