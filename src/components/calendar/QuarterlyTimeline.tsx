import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Check,
  Circle,
  Plus,
  CalendarDays,
  Lock,
  LockOpen,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

// ---- Types ----

interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

interface RoadmapItem {
  id: string;
  title: string;
  completed: boolean;
  dueDate: string | null;
  dateLocked: boolean;
  subtasks: Subtask[];
}

interface Quarter {
  id: string;
  label: string;
  items: RoadmapItem[];
  collapsed?: boolean;
}

interface RoadmapData {
  quarters: Quarter[];
}

// ---- Constants ----

const STORAGE_KEY = "tt_quarterly_roadmap";

const uid = () => Math.random().toString(36).slice(2, 10);

const SEED_DATA: RoadmapData = {
  quarters: [
    {
      id: uid(),
      label: "Q1 2026",
      items: [
        { id: uid(), title: "Fund III — Capital Call 4", completed: false, dueDate: "2026-03-12", dateLocked: false, subtasks: [] },
        { id: uid(), title: "SEC Form PF Filing", completed: false, dueDate: "2026-03-10", dateLocked: false, subtasks: [] },
        { id: uid(), title: "Q1 LP Distribution", completed: false, dueDate: "2026-03-15", dateLocked: false, subtasks: [] },
        { id: uid(), title: "Annual Report", completed: false, dueDate: "2026-03-25", dateLocked: false, subtasks: [] },
      ],
    },
    {
      id: uid(),
      label: "Q2 2026",
      items: [
        { id: uid(), title: "Fund II Exit Close", completed: false, dueDate: "2026-04-15", dateLocked: false, subtasks: [] },
        { id: uid(), title: "IC Review — FinEdge", completed: false, dueDate: "2026-04-22", dateLocked: false, subtasks: [] },
        { id: uid(), title: "Q2 LP Distribution", completed: false, dueDate: "2026-06-15", dateLocked: false, subtasks: [] },
        { id: uid(), title: "Mid-Year Valuation", completed: false, dueDate: "2026-06-30", dateLocked: false, subtasks: [] },
      ],
    },
  ],
};

// ---- Helpers ----

function loadData(): RoadmapData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return SEED_DATA;
}

function saveData(data: RoadmapData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function daysUntil(iso: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86400000);
}

function countdownLabel(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "in 1 day";
  if (days > 1) return `in ${days} days`;
  if (days === -1) return "1 day ago";
  return `${Math.abs(days)} days ago`;
}

function countdownColor(days: number): string {
  if (days <= 0) return "hsl(0, 70%, 55%)";
  if (days <= 1) return "hsl(0, 70%, 55%)";
  if (days <= 7) return "#BA7517";
  return "#1D9E75";
}

function nextQuarterLabel(quarters: Quarter[]): string {
  const existing = quarters.map((q) => q.label);
  const qOrder = ["Q1", "Q2", "Q3", "Q4"];
  let year = 2026;
  for (let y = 2026; y < 2030; y++) {
    for (const q of qOrder) {
      const label = `${q} ${y}`;
      if (!existing.includes(label)) return label;
    }
  }
  return `Q1 ${year + 4}`;
}

// ---- Inline Edit Component ----

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

// ---- Main Component ----

const QuarterlyTimeline = () => {
  const [data, setData] = useState<RoadmapData>(loadData);
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [hoveredSubtask, setHoveredSubtask] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [newSubtaskId, setNewSubtaskId] = useState<string | null>(null);

  const persist = useCallback((next: RoadmapData) => {
    setData(next);
    saveData(next);
  }, []);

  const update = useCallback(
    (fn: (d: RoadmapData) => RoadmapData) => {
      setData((prev) => {
        const next = fn(prev);
        saveData(next);
        return next;
      });
    },
    []
  );

  // ---- Item operations ----

  const toggleItem = (qId: string, itemId: string) =>
    update((d) => ({
      ...d,
      quarters: d.quarters.map((q) =>
        q.id === qId
          ? { ...q, items: q.items.map((it) => (it.id === itemId ? { ...it, completed: !it.completed } : it)) }
          : q
      ),
    }));

  const editItemTitle = (qId: string, itemId: string, title: string) =>
    update((d) => ({
      ...d,
      quarters: d.quarters.map((q) =>
        q.id === qId ? { ...q, items: q.items.map((it) => (it.id === itemId ? { ...it, title } : it)) } : q
      ),
    }));

  const deleteItem = (qId: string, itemId: string) =>
    update((d) => ({
      ...d,
      quarters: d.quarters.map((q) =>
        q.id === qId ? { ...q, items: q.items.filter((it) => it.id !== itemId) } : q
      ),
    }));

  const setItemDate = (qId: string, itemId: string, date: string | null) => {
    update((d) => ({
      ...d,
      quarters: d.quarters.map((q) =>
        q.id === qId ? { ...q, items: q.items.map((it) => (it.id === itemId ? { ...it, dueDate: date } : it)) } : q
      ),
    }));
    setEditingDate(null);
  };

  const toggleLock = (qId: string, itemId: string) =>
    update((d) => ({
      ...d,
      quarters: d.quarters.map((q) =>
        q.id === qId
          ? { ...q, items: q.items.map((it) => (it.id === itemId ? { ...it, dateLocked: !it.dateLocked } : it)) }
          : q
      ),
    }));

  const addItem = (qId: string) => {
    const id = uid();
    update((d) => ({
      ...d,
      quarters: d.quarters.map((q) =>
        q.id === qId
          ? {
              ...q,
              collapsed: false,
              items: [...q.items, { id, title: "", completed: false, dueDate: null, dateLocked: false, subtasks: [] }],
            }
          : q
      ),
    }));
    return id;
  };

  const removeEmptyItem = (qId: string, itemId: string) =>
    update((d) => ({
      ...d,
      quarters: d.quarters.map((q) =>
        q.id === qId ? { ...q, items: q.items.filter((it) => !(it.id === itemId && !it.title.trim())) } : q
      ),
    }));

  // ---- Subtask operations ----

  const addSubtask = (qId: string, itemId: string) => {
    const id = uid();
    update((d) => ({
      ...d,
      quarters: d.quarters.map((q) =>
        q.id === qId
          ? {
              ...q,
              items: q.items.map((it) =>
                it.id === itemId ? { ...it, subtasks: [...it.subtasks, { id, title: "", completed: false }] } : it
              ),
            }
          : q
      ),
    }));
    setNewSubtaskId(id);
    return id;
  };

  const toggleSubtask = (qId: string, itemId: string, stId: string) =>
    update((d) => ({
      ...d,
      quarters: d.quarters.map((q) =>
        q.id === qId
          ? {
              ...q,
              items: q.items.map((it) =>
                it.id === itemId
                  ? { ...it, subtasks: it.subtasks.map((s) => (s.id === stId ? { ...s, completed: !s.completed } : s)) }
                  : it
              ),
            }
          : q
      ),
    }));

  const editSubtaskTitle = (qId: string, itemId: string, stId: string, title: string) =>
    update((d) => ({
      ...d,
      quarters: d.quarters.map((q) =>
        q.id === qId
          ? {
              ...q,
              items: q.items.map((it) =>
                it.id === itemId
                  ? { ...it, subtasks: it.subtasks.map((s) => (s.id === stId ? { ...s, title } : s)) }
                  : it
              ),
            }
          : q
      ),
    }));

  const deleteSubtask = (qId: string, itemId: string, stId: string) =>
    update((d) => ({
      ...d,
      quarters: d.quarters.map((q) =>
        q.id === qId
          ? {
              ...q,
              items: q.items.map((it) =>
                it.id === itemId ? { ...it, subtasks: it.subtasks.filter((s) => s.id !== stId) } : it
              ),
            }
          : q
      ),
    }));

  // ---- Quarter operations ----

  const toggleCollapse = (qId: string) =>
    update((d) => ({
      ...d,
      quarters: d.quarters.map((q) => (q.id === qId ? { ...q, collapsed: !q.collapsed } : q)),
    }));

  const editQuarterLabel = (qId: string, label: string) =>
    update((d) => ({
      ...d,
      quarters: d.quarters.map((q) => (q.id === qId ? { ...q, label } : q)),
    }));

  const addQuarter = () => {
    const label = nextQuarterLabel(data.quarters);
    update((d) => ({
      ...d,
      quarters: [...d.quarters, { id: uid(), label, items: [], collapsed: false }],
    }));
  };

  // ---- Drag & Drop ----

  const handleDragStart = (itemId: string) => setDragItemId(itemId);

  const handleDragOver = (e: React.DragEvent, itemId: string) => {
    e.preventDefault();
    setDragOverItemId(itemId);
  };

  const handleDrop = (qId: string, targetItemId: string) => {
    if (!dragItemId || dragItemId === targetItemId) {
      setDragItemId(null);
      setDragOverItemId(null);
      return;
    }
    update((d) => ({
      ...d,
      quarters: d.quarters.map((q) => {
        if (q.id !== qId) return q;
        const fromIdx = q.items.findIndex((it) => it.id === dragItemId);
        const toIdx = q.items.findIndex((it) => it.id === targetItemId);
        if (fromIdx === -1 || toIdx === -1) return q;
        const items = [...q.items];
        const [moved] = items.splice(fromIdx, 1);
        items.splice(toIdx, 0, moved);
        return { ...q, items };
      }),
    }));
    setDragItemId(null);
    setDragOverItemId(null);
  };

  const handleDragEnd = () => {
    setDragItemId(null);
    setDragOverItemId(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="stat-card max-h-[420px] overflow-y-auto"
    >
      <h3 className="text-sm font-semibold text-foreground mb-4">Quarterly Roadmap</h3>
      <div className="space-y-5">
        {data.quarters.map((q) => (
          <div key={q.id}>
            {/* Quarter header */}
            <div className="flex items-center gap-2 mb-2 group/qh">
              <button
                onClick={() => toggleCollapse(q.id)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {q.collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              <InlineEdit
                value={q.label}
                onSave={(v) => editQuarterLabel(q.id, v)}
                className="text-[10px] font-mono uppercase tracking-wider font-semibold"
                style-override
              />
              <div className="flex-1 h-px bg-border" />
              <button
                onClick={() => addItem(q.id)}
                className="opacity-0 group-hover/qh:opacity-100 text-muted-foreground hover:text-primary transition-all"
                title="Add item"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Items */}
            {!q.collapsed && (
              <div className="space-y-1 ml-1 pl-3">
                {q.items.map((item) => (
                  <div key={item.id}>
                    {/* Main item row */}
                    <div
                      className={`flex items-center gap-2.5 py-1 px-1 rounded-md group/item transition-colors duration-100 ${
                        dragOverItemId === item.id ? "bg-primary/10" : "hover:bg-muted/30"
                      }`}
                      onMouseEnter={() => setHoveredItem(item.id)}
                      onMouseLeave={() => setHoveredItem(null)}
                      draggable
                      onDragStart={() => handleDragStart(item.id)}
                      onDragOver={(e) => handleDragOver(e, item.id)}
                      onDrop={() => handleDrop(q.id, item.id)}
                      onDragEnd={handleDragEnd}
                    >
                      {/* Drag handle */}
                      <span className="opacity-0 group-hover/item:opacity-40 cursor-grab text-muted-foreground">
                        <GripVertical className="h-3 w-3" />
                      </span>

                      {/* Checkbox */}
                      <button onClick={() => toggleItem(q.id, item.id)} className="shrink-0">
                        {item.completed ? (
                          <div className="h-4 w-4 rounded-full bg-[#1D9E75] flex items-center justify-center">
                            <Check className="h-2.5 w-2.5 text-white" />
                          </div>
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>

                      {/* Title */}
                      <div className="flex-1 min-w-0">
                        <InlineEdit
                          value={item.title}
                          onSave={(v) => editItemTitle(q.id, item.id, v)}
                          onCancel={() => removeEmptyItem(q.id, item.id)}
                          autoFocus={!item.title}
                          onEnter={() => addItem(q.id)}
                          className={`text-xs truncate block w-full ${
                            item.completed ? "text-muted-foreground line-through" : "text-foreground/80"
                          }`}
                          placeholder="New item..."
                        />
                      </div>

                      {/* Hover actions */}
                      {hoveredItem === item.id && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => addSubtask(q.id, item.id)}
                            className="text-muted-foreground hover:text-primary transition-colors"
                            title="Add subtask"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingDate(editingDate === item.id ? null : item.id)}
                            className="text-muted-foreground hover:text-primary transition-colors"
                            title="Set date"
                          >
                            <CalendarDays className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => item.dueDate && toggleLock(q.id, item.id)}
                            className={`transition-colors ${item.dateLocked ? "text-[#BA7517]" : "text-muted-foreground hover:text-primary"}`}
                            title={item.dateLocked ? "Unlock date" : "Lock date"}
                          >
                            {item.dateLocked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            onClick={() => deleteItem(q.id, item.id)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Date */}
                      <div className="shrink-0 text-right min-w-[70px]">
                        {editingDate === item.id && !item.dateLocked ? (
                          <input
                            type="date"
                            value={item.dueDate || ""}
                            onChange={(e) => setItemDate(q.id, item.id, e.target.value || null)}
                            onBlur={() => setEditingDate(null)}
                            autoFocus
                            className="bg-transparent border border-border rounded px-1 py-0.5 text-[10px] text-foreground w-[110px] outline-none focus:border-primary"
                          />
                        ) : item.dueDate ? (
                          <div
                            className="flex items-center justify-end gap-1 cursor-pointer"
                            onClick={() => !item.dateLocked && setEditingDate(item.id)}
                          >
                            {item.dateLocked && <Lock className="h-2.5 w-2.5 text-[#BA7517]" />}
                            <span
                              className={`text-[10px] font-mono ${
                                item.completed
                                  ? "text-muted-foreground"
                                  : item.dateLocked
                                  ? "text-[#BA7517]"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {fmtDate(item.dueDate)}
                            </span>
                            {item.dateLocked && (
                              <span
                                className="text-[9px] font-medium px-1.5 py-0.5 rounded-full ml-0.5"
                                style={{
                                  backgroundColor: `${countdownColor(daysUntil(item.dueDate))}20`,
                                  color: countdownColor(daysUntil(item.dueDate)),
                                }}
                              >
                                {countdownLabel(daysUntil(item.dueDate))}
                              </span>
                            )}
                          </div>
                        ) : hoveredItem === item.id ? (
                          <span
                            className="text-[10px] text-muted-foreground/50 cursor-pointer hover:text-muted-foreground"
                            onClick={() => setEditingDate(item.id)}
                          >
                            Set date
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Subtasks */}
                    {!item.completed && item.subtasks.length > 0 && (
                      <div className="ml-[42px] space-y-0.5">
                        {item.subtasks.map((st) => (
                          <div
                            key={st.id}
                            className="flex items-center gap-2 py-0.5 px-1 rounded group/sub hover:bg-muted/20 transition-colors duration-100"
                            onMouseEnter={() => setHoveredSubtask(st.id)}
                            onMouseLeave={() => setHoveredSubtask(null)}
                          >
                            <button onClick={() => toggleSubtask(q.id, item.id, st.id)} className="shrink-0">
                              {st.completed ? (
                                <div className="h-3 w-3 rounded-full bg-[#1D9E75] flex items-center justify-center">
                                  <Check className="h-2 w-2 text-white" />
                                </div>
                              ) : (
                                <Circle className="h-3 w-3 text-muted-foreground" />
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <InlineEdit
                                value={st.title}
                                onSave={(v) => editSubtaskTitle(q.id, item.id, st.id, v)}
                                onCancel={() => !st.title && deleteSubtask(q.id, item.id, st.id)}
                                autoFocus={newSubtaskId === st.id}
                                onEnter={() => addSubtask(q.id, item.id)}
                                onBackspaceEmpty={() => deleteSubtask(q.id, item.id, st.id)}
                                className={`text-[11px] truncate block w-full ${
                                  st.completed ? "text-muted-foreground line-through" : "text-foreground/70"
                                }`}
                                placeholder="Subtask..."
                              />
                            </div>
                            {hoveredSubtask === st.id && (
                              <button
                                onClick={() => deleteSubtask(q.id, item.id, st.id)}
                                className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Quarter */}
      <button
        onClick={addQuarter}
        className="mt-4 w-full py-2 border border-dashed border-border rounded-lg text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
      >
        + Add Quarter
      </button>
    </motion.div>
  );
};

export default QuarterlyTimeline;
