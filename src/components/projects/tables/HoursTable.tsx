import { useEffect, useMemo, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  TableShell,
  HeaderRow,
  TotalsRow,
  EmptyState,
  formatNum,
  T_BLUE,
  T_RED,
  T_AMBER,
  T_INPUT_BORDER,
} from "./tableCommon";
import { useProfiles, type ProfileLite } from "@/hooks/useProfiles";

const db = supabase as any;

interface Row {
  id: string;
  project_id: string;
  user_id: string;
  work_date: string;
  hours: number;
  billable: boolean;
  note: string | null;
  invoiced_on: string | null;
  created_at: string;
}

// DATE | WORKER | HOURS | BILL | NOTE | ⋯
const GRID = "120px 1fr 90px 60px 1.2fr 40px";
const MUTED = "rgba(229,233,234,0.45)";
const META = "rgba(229,233,234,0.28)";

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtShort(iso: string) {
  // dd Mmm — matches dashboard date style
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short" }).toUpperCase();
}

function sortProfiles(profiles: ProfileLite[]) {
  const isWorker = (p: ProfileLite) => (p.role ?? "").toLowerCase() === "worker";
  return [...profiles].sort((a, b) => {
    const aw = isWorker(a) ? 0 : 1;
    const bw = isWorker(b) ? 0 : 1;
    if (aw !== bw) return aw - bw;
    return (a.full_name ?? "").localeCompare(b.full_name ?? "");
  });
}

interface Draft {
  work_date: string;
  user_id: string;
  hours: string;
  billable: boolean;
  note: string;
}

function emptyDraft(): Draft {
  return { work_date: todayISO(), user_id: "", hours: "", billable: true, note: "" };
}

type ValidationError =
  | "no_worker"
  | "no_hours"
  | "too_many_hours"
  | "future_date"
  | null;

function validate(d: Draft): ValidationError {
  if (!d.user_id) return "no_worker";
  const n = Number(d.hours);
  if (!d.hours || !isFinite(n) || n <= 0) return "no_hours";
  if (n > 24) return "too_many_hours";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const wd = new Date(d.work_date + "T00:00:00");
  const diffDays = (wd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays > 90) return "future_date";
  return null;
}

const ERROR_MESSAGES: Record<Exclude<ValidationError, null>, string> = {
  no_worker: "Select who worked",
  no_hours: "Enter hours worked",
  too_many_hours: "More than 24 hours in one day — split into separate entries",
  future_date: "Date looks wrong",
};

export function HoursTable({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratedUserIds, setRatedUserIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft());
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [attemptedSave, setAttemptedSave] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rateWarningUserId, setRateWarningUserId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const longPressTimer = useRef<number | null>(null);

  const profiles = useProfiles(true);
  const sortedProfiles = useMemo(() => sortProfiles(profiles), [profiles]);
  const byId = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of profiles) m.set(p.id, p.full_name);
    return m;
  }, [profiles]);

  const loadRows = async () => {
    const { data } = await db
      .from("time_entries")
      .select("id, project_id, user_id, work_date, hours, billable, note, invoiced_on, created_at")
      .eq("project_id", projectId)
      .order("work_date", { ascending: false })
      .order("created_at", { ascending: false });
    setRows((data as Row[]) ?? []);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const [{ data: te }, { data: er }] = await Promise.all([
        db
          .from("time_entries")
          .select("id, project_id, user_id, work_date, hours, billable, note, invoiced_on, created_at")
          .eq("project_id", projectId)
          .order("work_date", { ascending: false })
          .order("created_at", { ascending: false }),
        db.from("employee_rates").select("user_id"),
      ]);
      if (!mounted) return;
      setRows((te as Row[]) ?? []);
      setRatedUserIds(
        new Set(((er as Array<{ user_id: string }>) ?? []).map((r) => r.user_id)),
      );
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [projectId]);

  // Close menu on outside click
  useEffect(() => {
    if (!openMenuId) return;
    const handler = () => setOpenMenuId(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [openMenuId]);

  const totals = useMemo(() => {
    let h = 0, bh = 0;
    for (const r of rows) {
      const n = Number(r.hours) || 0;
      h += n;
      if (r.billable) bh += n;
    }
    return { h, bh };
  }, [rows]);

  const notifyChanged = () => {
    window.dispatchEvent(
      new CustomEvent("pm-hours-changed", { detail: { projectId } }),
    );
  };

  const draftError = validate(draft);
  const draftShowError = attemptedSave && draftError;

  const handleAdd = async () => {
    setAttemptedSave(true);
    const err = validate(draft);
    if (err) return;
    setSaving(true);
    const payload = {
      project_id: projectId,
      user_id: draft.user_id,
      work_date: draft.work_date,
      hours: Number(draft.hours),
      billable: draft.billable,
      note: draft.note.trim() ? draft.note.trim() : null,
    };
    const { data, error } = await db
      .from("time_entries")
      .insert(payload)
      .select("id, project_id, user_id, work_date, hours, billable, note, invoiced_on, created_at")
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error("Could not save hours", { style: { background: "#E24B4A", color: "#fff", border: "none" } });
      return;
    }
    setRows((prev) => [data as Row, ...prev]);
    const savedUserId = draft.user_id;
    const noRate = !ratedUserIds.has(savedUserId);
    setRateWarningUserId(noRate ? savedUserId : null);
    setDraft(emptyDraft());
    setAttemptedSave(false);
    notifyChanged();
    // Return focus to date for consecutive entries.
    requestAnimationFrame(() => dateInputRef.current?.focus());
  };

  const beginEdit = (r: Row) => {
    setEditingId(r.id);
    setEditDraft({
      work_date: r.work_date,
      user_id: r.user_id,
      hours: String(r.hours),
      billable: r.billable,
      note: r.note ?? "",
    });
    setOpenMenuId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(emptyDraft());
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const err = validate(editDraft);
    if (err) return;
    const previous = rows;
    const patch = {
      work_date: editDraft.work_date,
      user_id: editDraft.user_id,
      hours: Number(editDraft.hours),
      billable: editDraft.billable,
      note: editDraft.note.trim() ? editDraft.note.trim() : null,
    };
    setRows((prev) => prev.map((r) => (r.id === editingId ? { ...r, ...patch } : r)));
    setEditingId(null);
    notifyChanged();
    const { error } = await db.from("time_entries").update(patch).eq("id", editingId);
    if (error) {
      setRows(previous);
      notifyChanged();
      toast.error("Could not update hours", { style: { background: "#E24B4A", color: "#fff", border: "none" } });
    }
  };

  const deleteRow = async (r: Row) => {
    const ok = window.confirm(`Delete ${formatNum(Number(r.hours))} hrs on ${fmtShort(r.work_date)}?`);
    if (!ok) return;
    setOpenMenuId(null);
    const previous = rows;
    setRows((prev) => prev.filter((x) => x.id !== r.id));
    notifyChanged();
    const { error } = await db.from("time_entries").delete().eq("id", r.id);
    if (error) {
      setRows(previous);
      notifyChanged();
      toast.error("Could not delete", { style: { background: "#E24B4A", color: "#fff", border: "none" } });
    }
  };

  const startLongPress = (r: Row) => {
    if (r.invoiced_on) return;
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      setOpenMenuId(r.id);
    }, 450);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  if (loading) return <div className="p-6 text-[12px] text-muted-foreground">Loading…</div>;

  return (
    <div>
      <div
        className="px-1 pb-2 font-mono uppercase"
        style={{
          fontSize: "9px",
          letterSpacing: "0.9px",
          color: "rgba(229,233,234,0.28)",
        }}
      >
        Project hours — all labour logged against this job
      </div>
      <TableShell showLegend={false}>
        <HeaderRow
          gridTemplate={GRID}
          cols={[
            { label: "Date" },
            { label: "Worker" },
            { label: "Hours", align: "right" },
            { label: "Bill", align: "center" },
            { label: "Note" },
            { label: "" },
          ]}
        />

        {rows.length === 0 ? (
          <EmptyState message="No hours logged against this project yet." />
        ) : (
          rows.map((r) => {
            const isEditing = editingId === r.id;
            const locked = !!r.invoiced_on;
            if (isEditing) {
              return (
                <EditRow
                  key={r.id}
                  draft={editDraft}
                  setDraft={setEditDraft}
                  profiles={sortedProfiles}
                  onSave={saveEdit}
                  onCancel={cancelEdit}
                />
              );
            }
            return (
              <div
                key={r.id}
                className="grid items-center border-b group relative"
                style={{
                  gridTemplateColumns: GRID,
                  minHeight: 40,
                  borderColor: "#131418",
                  background: locked ? "rgba(255,255,255,0.02)" : "transparent",
                }}
                onTouchStart={() => startLongPress(r)}
                onTouchEnd={cancelLongPress}
                onTouchMove={cancelLongPress}
                onTouchCancel={cancelLongPress}
              >
                <div className="px-2">
                  <span className="font-mono text-[12px]" style={{ color: "#E5E9EA" }}>
                    {fmtShort(r.work_date)}
                  </span>
                </div>
                <div className="px-2 min-w-0 truncate">
                  <span className="text-[12.5px]" style={{ color: "#E5E9EA" }}>
                    {byId.get(r.user_id) ?? r.user_id}
                  </span>
                </div>
                <div className="px-2 flex items-center justify-end gap-1.5">
                  <span
                    className="font-mono text-[12px] tabular-nums"
                    style={{ color: r.billable ? "#E5E9EA" : "rgba(229,233,234,0.45)" }}
                  >
                    {formatNum(Number(r.hours))}
                  </span>
                </div>
                <div className="px-2 flex items-center justify-center">
                  {r.billable ? (
                    <span
                      className="font-mono uppercase"
                      style={{ fontSize: "9px", color: META, letterSpacing: "0.6px" }}
                    >
                      ✓
                    </span>
                  ) : (
                    <span
                      className="px-1.5 py-0.5 rounded-sm font-mono uppercase"
                      style={{
                        fontSize: "9px",
                        letterSpacing: "0.6px",
                        background: "rgba(229,233,234,0.06)",
                        color: MUTED,
                      }}
                    >
                      Non-bill
                    </span>
                  )}
                </div>
                <div className="px-2 min-w-0 flex items-center gap-2">
                  <span
                    className="text-[12px] truncate"
                    style={{ color: r.note ? "rgba(229,233,234,0.7)" : META }}
                    title={r.note ?? undefined}
                  >
                    {r.note ?? "—"}
                  </span>
                  {locked && (
                    <span
                      className="shrink-0 font-mono uppercase px-1.5 py-0.5 rounded-sm"
                      style={{
                        fontSize: "9px",
                        letterSpacing: "0.6px",
                        color: MUTED,
                        background: "rgba(229,233,234,0.04)",
                      }}
                    >
                      Invoiced {fmtShort(r.invoiced_on!)}
                    </span>
                  )}
                </div>
                <div className="px-1 flex items-center justify-end relative">
                  {!locked && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId((prev) => (prev === r.id ? null : r.id));
                      }}
                      className="opacity-0 group-hover:opacity-100 md:transition-opacity h-6 w-6 flex items-center justify-center rounded-sm hover:bg-white/5"
                      style={{
                        opacity: openMenuId === r.id ? 1 : undefined,
                        color: MUTED,
                      }}
                      aria-label="Row actions"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {openMenuId === r.id && !locked && (
                    <div
                      className="absolute right-1 top-8 z-20 rounded-md border shadow-lg"
                      style={{
                        background: "#0F1113",
                        borderColor: "#1F2224",
                        minWidth: 120,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => beginEdit(r)}
                        className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-white/5"
                        style={{ color: "#E5E9EA" }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRow(r)}
                        className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-white/5"
                        style={{ color: T_RED }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Entry row */}
        <div
          className="grid items-center border-b"
          style={{
            gridTemplateColumns: GRID,
            minHeight: 44,
            borderColor: "#131418",
            background: "rgba(61,137,218,0.03)",
          }}
        >
          <div className="px-2">
            <input
              ref={dateInputRef}
              type="date"
              value={draft.work_date}
              onChange={(e) => setDraft((d) => ({ ...d, work_date: e.target.value }))}
              className="w-full h-7 px-2 rounded-sm font-mono text-[12px] outline-none focus:shadow-[0_0_0_2px_rgba(61,137,218,0.35)] focus:border-[#3D89DA]"
              style={{
                background: "rgba(0,0,0,0.35)",
                border: `1px solid ${T_INPUT_BORDER}`,
                color: "#E5E9EA",
                colorScheme: "dark",
              }}
            />
          </div>
          <div className="px-2 min-w-0">
            <select
              value={draft.user_id}
              onChange={(e) => setDraft((d) => ({ ...d, user_id: e.target.value }))}
              className="w-full h-7 px-2 rounded-sm text-[12.5px] outline-none focus:shadow-[0_0_0_2px_rgba(61,137,218,0.35)] focus:border-[#3D89DA]"
              style={{
                background: "rgba(0,0,0,0.35)",
                border: `1px solid ${draftShowError && draftError === "no_worker" ? T_RED : T_INPUT_BORDER}`,
                color: draft.user_id ? "#E5E9EA" : MUTED,
              }}
            >
              <option value="">Select worker…</option>
              {sortedProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="px-2">
            <input
              type="text"
              inputMode="decimal"
              value={draft.hours}
              placeholder="0.00"
              step={0.25}
              onChange={(e) => setDraft((d) => ({ ...d, hours: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              className="w-full h-7 px-2 rounded-sm font-mono text-[12px] tabular-nums text-right outline-none focus:shadow-[0_0_0_2px_rgba(61,137,218,0.35)] focus:border-[#3D89DA]"
              style={{
                background: "rgba(0,0,0,0.35)",
                border: `1px solid ${
                  draftShowError && (draftError === "no_hours" || draftError === "too_many_hours")
                    ? T_RED
                    : T_INPUT_BORDER
                }`,
                color: "#E5E9EA",
              }}
            />
          </div>
          <div className="px-2 flex items-center justify-center">
            <input
              type="checkbox"
              checked={draft.billable}
              onChange={(e) => setDraft((d) => ({ ...d, billable: e.target.checked }))}
              className="h-3.5 w-3.5 accent-[#3D89DA] cursor-pointer"
            />
          </div>
          <div className="px-2 min-w-0">
            <input
              type="text"
              value={draft.note}
              placeholder="Note (optional)"
              onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              className="w-full h-7 px-2 rounded-sm text-[12.5px] outline-none focus:shadow-[0_0_0_2px_rgba(61,137,218,0.35)] focus:border-[#3D89DA]"
              style={{
                background: "rgba(0,0,0,0.35)",
                border: `1px solid ${T_INPUT_BORDER}`,
                color: "#E5E9EA",
              }}
            />
          </div>
          <div className="px-1 flex items-center justify-end">
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving || !!draftError}
              className="h-7 px-2 rounded-sm font-mono uppercase text-[10px] tracking-widest transition-opacity"
              style={{
                background: draftError ? "rgba(61,137,218,0.15)" : T_BLUE,
                color: draftError ? "rgba(229,233,234,0.4)" : "#fff",
                cursor: draftError ? "not-allowed" : "pointer",
                opacity: saving ? 0.6 : 1,
              }}
            >
              Add
            </button>
          </div>
        </div>

        {/* Inline validation error */}
        {draftShowError && (
          <div
            className="px-3 py-1.5 text-[11px] font-mono border-b"
            style={{ color: T_RED, borderColor: "#131418", background: "rgba(226,75,74,0.06)" }}
          >
            {ERROR_MESSAGES[draftError!]}
          </div>
        )}

        {/* Non-blocking rate warning */}
        {rateWarningUserId && !draftShowError && (
          <div
            className="px-3 py-1.5 text-[11px] font-mono border-b"
            style={{ color: T_AMBER, borderColor: "#131418", background: "rgba(186,117,23,0.06)" }}
          >
            No rate set — hours will not be invoiceable
          </div>
        )}

        {rows.length > 0 && (
          <TotalsRow
            gridTemplate={GRID}
            cells={[
              <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: MUTED }}>
                Total {formatNum(totals.h)} hrs · {formatNum(totals.bh)} billable
              </span>,
              <span />, <span />, <span />, <span />, <span />,
            ]}
          />
        )}
      </TableShell>
    </div>
  );
}

function EditRow({
  draft,
  setDraft,
  profiles,
  onSave,
  onCancel,
}: {
  draft: Draft;
  setDraft: (updater: (d: Draft) => Draft) => void;
  profiles: ProfileLite[];
  onSave: () => void;
  onCancel: () => void;
}) {
  const err = validate(draft);
  return (
    <>
      <div
        className="grid items-center border-b"
        style={{
          gridTemplateColumns: GRID,
          minHeight: 44,
          borderColor: "#131418",
          background: "rgba(61,137,218,0.06)",
        }}
      >
        <div className="px-2">
          <input
            type="date"
            value={draft.work_date}
            onChange={(e) => setDraft((d) => ({ ...d, work_date: e.target.value }))}
            className="w-full h-7 px-2 rounded-sm font-mono text-[12px] outline-none focus:border-[#3D89DA]"
            style={{
              background: "rgba(0,0,0,0.35)",
              border: `1px solid ${T_INPUT_BORDER}`,
              color: "#E5E9EA",
              colorScheme: "dark",
            }}
          />
        </div>
        <div className="px-2">
          <select
            value={draft.user_id}
            onChange={(e) => setDraft((d) => ({ ...d, user_id: e.target.value }))}
            className="w-full h-7 px-2 rounded-sm text-[12.5px] outline-none focus:border-[#3D89DA]"
            style={{
              background: "rgba(0,0,0,0.35)",
              border: `1px solid ${err === "no_worker" ? T_RED : T_INPUT_BORDER}`,
              color: draft.user_id ? "#E5E9EA" : MUTED,
            }}
          >
            <option value="">Select worker…</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </div>
        <div className="px-2">
          <input
            type="text"
            inputMode="decimal"
            value={draft.hours}
            onChange={(e) => setDraft((d) => ({ ...d, hours: e.target.value }))}
            className="w-full h-7 px-2 rounded-sm font-mono text-[12px] tabular-nums text-right outline-none focus:border-[#3D89DA]"
            style={{
              background: "rgba(0,0,0,0.35)",
              border: `1px solid ${err === "no_hours" || err === "too_many_hours" ? T_RED : T_INPUT_BORDER}`,
              color: "#E5E9EA",
            }}
          />
        </div>
        <div className="px-2 flex items-center justify-center">
          <input
            type="checkbox"
            checked={draft.billable}
            onChange={(e) => setDraft((d) => ({ ...d, billable: e.target.checked }))}
            className="h-3.5 w-3.5 accent-[#3D89DA] cursor-pointer"
          />
        </div>
        <div className="px-2">
          <input
            type="text"
            value={draft.note}
            onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
            className="w-full h-7 px-2 rounded-sm text-[12.5px] outline-none focus:border-[#3D89DA]"
            style={{
              background: "rgba(0,0,0,0.35)",
              border: `1px solid ${T_INPUT_BORDER}`,
              color: "#E5E9EA",
            }}
          />
        </div>
        <div className="px-1 flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={onSave}
            disabled={!!err}
            className="h-7 px-2 rounded-sm font-mono uppercase text-[10px] tracking-widest"
            style={{
              background: err ? "rgba(61,137,218,0.15)" : T_BLUE,
              color: err ? "rgba(229,233,234,0.4)" : "#fff",
              cursor: err ? "not-allowed" : "pointer",
            }}
          >
            Save
          </button>
        </div>
      </div>
      <div
        className="px-3 py-1 flex items-center justify-between border-b"
        style={{ background: "rgba(61,137,218,0.03)", borderColor: "#131418" }}
      >
        <span className="text-[11px] font-mono" style={{ color: err ? T_RED : MUTED }}>
          {err ? ERROR_MESSAGES[err] : "Editing entry"}
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="text-[11px] font-mono uppercase tracking-widest"
          style={{ color: MUTED }}
        >
          Cancel
        </button>
      </div>
    </>
  );
}
