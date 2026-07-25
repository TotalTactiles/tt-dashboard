import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, X } from "lucide-react";
import { formatDateShort } from "@/lib/projects/dateRules";

const db = supabase as any;

interface Props {
  projectId: string;
  currentEstStart: string | null;
  contractValue?: number | null;
  onClose: () => void;
  onApplied: () => void;
}

interface Preview {
  task_id: string;
  task_name: string;
  old_start: string | null;
  old_end: string | null;
  new_start: string | null;
  new_end: string | null;
  skipped: boolean;
}

export function DateCascadeModal({ projectId, currentEstStart, contractValue, onClose, onApplied }: Props) {
  const [newStart, setNewStart] = useState(currentEstStart ?? "");
  const [preview, setPreview] = useState<Preview[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  const delta = useMemo(() => {
    if (!currentEstStart || !newStart) return null;
    return Math.round(
      (new Date(newStart).getTime() - new Date(currentEstStart).getTime()) / 86_400_000,
    );
  }, [currentEstStart, newStart]);

  useEffect(() => {
    if (!newStart) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await db.rpc("preview_date_cascade", {
        p_project: projectId,
        p_new_start: newStart,
      });
      if (!cancelled) {
        if (error) console.error(error);
        setPreview((data as Preview[]) ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, newStart]);

  const apply = async () => {
    setApplying(true);
    await db.rpc("apply_date_cascade", {
      p_project: projectId,
      p_new_start: newStart,
    });
    setApplying(false);
    onApplied();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.72)" }}
    >
      <div
        className="w-full max-w-2xl rounded-lg border shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        style={{ borderColor: "#1F2224", background: "#0A0A0A" }}
      >
        <div
          className="flex items-center justify-between px-5 py-3 border-b"
          style={{ borderColor: "#1F2224" }}
        >
          <div>
            <h2 className="text-[14px] font-semibold tracking-tight">Shift Estimated Start</h2>
            <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
              Cascade all rule-based dates. Manually-set dates keep their values.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-white/[0.06] text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Current
              </label>
              <div className="mt-1 text-[13px] font-mono">
                {formatDateShort(currentEstStart)}
              </div>
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                New Estimated Start
              </label>
              <input
                type="date"
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
                className="mt-1 w-full h-9 px-2 rounded-md bg-black/40 border text-[13px] font-mono outline-none focus:border-primary/50"
                style={{ borderColor: "#1F2224" }}
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Delta
              </label>
              <div
                className="mt-1 text-[13px] font-mono"
                style={{
                  color: delta === null || delta === 0 ? "rgba(229,233,234,0.45)" : "#BA7517",
                }}
              >
                {delta === null
                  ? "—"
                  : delta === 0
                    ? "no change"
                    : delta > 0
                      ? `+${delta} days later`
                      : `${Math.abs(delta)} days earlier`}
              </div>
            </div>
          </div>

          {(() => {
            if (!currentEstStart || !newStart) return null;
            const cur = new Date(currentEstStart);
            const nxt = new Date(newStart);
            if (isNaN(cur.getTime()) || isNaN(nxt.getTime())) return null;
            if (cur.getFullYear() === nxt.getFullYear() && cur.getMonth() === nxt.getMonth()) {
              return null;
            }
            const fmtMonth = (d: Date) =>
              d.toLocaleString("en-US", { month: "short", year: "numeric" }).toUpperCase();
            const oldM = fmtMonth(cur);
            const newM = fmtMonth(nxt);
            const amount =
              contractValue != null
                ? `$${contractValue.toLocaleString("en-AU", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
                : null;
            return (
              <div
                className="rounded-md border p-3"
                style={{ borderColor: "#BA7517", background: "rgba(186,117,23,0.08)" }}
              >
                <div
                  className="text-[10px] font-mono uppercase tracking-widest mb-1"
                  style={{ color: "#BA7517" }}
                >
                  Forecast revenue will move
                </div>
                <div className="text-[12px]" style={{ color: "#E6EEF3" }}>
                  {amount
                    ? `${amount} moves from ${oldM} to ${newM}`
                    : `Forecast revenue for this project will move from ${oldM} to ${newM}`}
                </div>
              </div>
            );
          })()}

          <div
            className="rounded-md border overflow-hidden"
            style={{ borderColor: "#1F2224" }}
          >
            <div
              className="px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground border-b"
              style={{ borderColor: "#1F2224", background: "#0F1113" }}
            >
              Preview · {preview.length} tasks
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              {loading && (
                <div className="p-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Calculating…
                </div>
              )}
              {!loading && preview.length === 0 && (
                <div className="p-4 text-xs text-muted-foreground">
                  No rule-based tasks to shift.
                </div>
              )}
              {preview.map((r) => (
                <div
                  key={r.task_id}
                  className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-2 border-t items-center"
                  style={{ borderColor: "#1F2224" }}
                >
                  <div
                    className="text-[12px] font-medium truncate"
                    style={{ color: r.skipped ? "#6B7280" : "#E6EEF3" }}
                  >
                    {r.task_name}
                    {r.skipped && (
                      <span className="ml-2 text-[9.5px] font-mono uppercase text-muted-foreground">
                        manual · skipped
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground">
                    {formatDateShort(r.old_start)} → {formatDateShort(r.old_end)}
                  </div>
                  <div
                    className="text-[11px] font-mono"
                    style={{ color: r.skipped ? "#6B7280" : "#3D89DA" }}
                  >
                    {formatDateShort(r.new_start)} → {formatDateShort(r.new_end)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          className="flex items-center justify-end gap-2 px-5 py-3 border-t"
          style={{ borderColor: "#1F2224", background: "#0F1113" }}
        >
          <button
            onClick={onClose}
            className="h-8 px-3 text-[12px] font-mono rounded-md hover:bg-white/[0.06] text-muted-foreground"
          >
            Cancel
          </button>
          <button
            onClick={apply}
            disabled={!newStart || applying || loading}
            className="h-8 px-4 text-[12px] font-mono rounded-md text-white disabled:opacity-50"
            style={{ background: "#3D89DA" }}
          >
            {applying ? "Applying…" : "Apply Cascade"}
          </button>
        </div>
      </div>
    </div>
  );
}
