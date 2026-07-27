import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  TableShell,
  HeaderRow,
  TotalsRow,
  ExtCell,
  CalcCell,
  NumInput,
  EmptyState,
  formatNum,
  T_GREEN,
  T_RED,
} from "./tableCommon";
import { useLiveStock, LiveStockBadge } from "@/hooks/useLiveStock";
import { useIsPmMobile } from "@/hooks/useProjects";

const db = supabase as any;

interface Row {
  project_id: string;
  product_code: string;
  description: string | null;
  unit: string | null;
  planned_qty: number;
  used_qty: number | null;
  leftover: number;
  returned_to_stock: boolean;
}

interface BaseRow {
  id: string;
  product_code: string;
  description: string | null;
  unit: string | null;
  planned_qty: number;
  used_qty: number | null;
  returned_to_stock: boolean;
  returned_at: string | null;
}

const GRID = "120px 1fr 100px 100px 110px 90px";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function ReconciliationTable({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [base, setBase] = useState<BaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const live = useLiveStock();

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: view }, { data: raw }] = await Promise.all([
      db.from("v_stock_leftover").select("*").eq("project_id", projectId).order("product_code"),
      db
        .from("stock_reconciliation")
        .select("id, product_code, description, unit, planned_qty, used_qty, returned_to_stock, returned_at")
        .eq("project_id", projectId),
    ]);
    setRows((view as Row[]) ?? []);
    setBase((raw as BaseRow[]) ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const baseByCode = useMemo(() => {
    const m = new Map<string, BaseRow>();
    for (const b of base) m.set(b.product_code, b);
    return m;
  }, [base]);

  const saveUsed = async (code: string, used_qty: number | null) => {
    setRows((prev) =>
      prev.map((r) =>
        r.product_code === code
          ? { ...r, used_qty, leftover: Number(r.planned_qty) - Number(used_qty ?? 0) }
          : r,
      ),
    );
    const b = baseByCode.get(code);
    if (!b) return;
    await db.from("stock_reconciliation").update({ used_qty }).eq("id", b.id);
  };

  const totalLeftover = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.leftover) || 0), 0),
    [rows],
  );

  const totals = useMemo(() => {
    let plan = 0, used = 0;
    for (const r of rows) {
      plan += Number(r.planned_qty) || 0;
      used += Number(r.used_qty ?? 0);
    }
    return { plan, used };
  }, [rows]);

  // Lines eligible for return: unreturned rows joined with current view figures.
  const returnableLines = useMemo(() => {
    return base
      .filter((b) => !b.returned_to_stock)
      .map((b) => {
        const view = rows.find((r) => r.product_code === b.product_code);
        const planned = Number(view?.planned_qty ?? b.planned_qty ?? 0);
        const used = Number(view?.used_qty ?? b.used_qty ?? 0);
        const leftover = round2(planned - used);
        return {
          id: b.id,
          product_code: b.product_code,
          description: b.description ?? view?.description ?? null,
          unit: b.unit ?? view?.unit ?? null,
          planned,
          used,
          leftover,
        };
      });
  }, [base, rows]);

  const positiveLines = returnableLines.filter((l) => l.leftover > 0);
  const negativeLines = returnableLines.filter((l) => l.leftover < 0);
  const totalToReturn = round2(positiveLines.reduce((s, l) => s + l.leftover, 0));

  // Most recent completed return, for the completed banner.
  const lastReturned = useMemo(() => {
    const done = base.filter((b) => b.returned_to_stock && b.returned_at);
    if (!done.length) return null;
    done.sort((a, b) => (a.returned_at! < b.returned_at! ? 1 : -1));
    return done[0];
  }, [base]);

  const openModal = () => setModalOpen(true);

  const confirmReturn = async () => {
    if (submitting) return;
    if (positiveLines.length === 0) {
      setModalOpen(false);
      return;
    }
    setSubmitting(true);
    const ids = positiveLines.map((l) => l.id);
    const stamp = new Date().toISOString();
    const { error } = await db
      .from("stock_reconciliation")
      .update({ returned_to_stock: true, returned_at: stamp })
      .in("id", ids);
    if (error) {
      toast.error(`Return failed: ${error.message ?? "unknown error"}`);
      setSubmitting(false);
      return;
    }
    // Optimistic local update
    setBase((prev) =>
      prev.map((b) =>
        ids.includes(b.id) ? { ...b, returned_to_stock: true, returned_at: stamp } : b,
      ),
    );
    const summary =
      positiveLines.length === 1
        ? `${formatNum(positiveLines[0].leftover)} ${positiveLines[0].unit ?? ""} of ${positiveLines[0].product_code} returned to Stock & Inventory.`.replace(/\s+/g, " ")
        : `${formatNum(totalToReturn)} units across ${positiveLines.length} lines returned to Stock & Inventory.`;
    toast.success(summary);
    setModalOpen(false);
    setSubmitting(false);
    // Refresh the view — trigger has posted the ledger row already.
    load();
  };

  if (loading) return <div className="p-6 text-[12px] text-muted-foreground">Loading…</div>;

  const showButton = returnableLines.length > 0 && totalLeftover !== 0;
  const buttonDisabled = positiveLines.length === 0;

  return (
    <TableShell right={<LiveStockBadge status={live.status} syncedAt={live.syncedAt} />}>
      <HeaderRow
        gridTemplate={GRID}
        cols={[
          { label: "Code" },
          { label: "Description" },
          { label: "Planned", align: "right" },
          { label: "Used", align: "right" },
          { label: "Left over", align: "right" },
          { label: "Unit", align: "right" },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState message="Seeded from the quote scope when the project is built." />
      ) : (
        <>
          {rows.map((r) => {
            const leftover = Number(r.planned_qty) - Number(r.used_qty ?? 0);
            return (
              <div
                key={r.product_code}
                className="grid items-center border-b"
                style={{ gridTemplateColumns: GRID, height: 40, borderColor: "#131418" }}
              >
                <div className="px-2"><ExtCell value={r.product_code} /></div>
                <div className="px-2 min-w-0"><ExtCell value={r.description} /></div>
                <div className="px-2 flex justify-end"><ExtCell value={r.planned_qty} numeric align="right" /></div>
                <div className="px-2">
                  <NumInput value={r.used_qty} onSave={(n) => saveUsed(r.product_code, n)} required />
                </div>
                <div className="px-2 flex justify-end">
                  <CalcCell value={leftover} color={leftover > 0 ? T_GREEN : leftover < 0 ? T_RED : undefined} />
                </div>
                <div className="px-2 flex justify-end"><ExtCell value={r.unit} /></div>
              </div>
            );
          })}
          <TotalsRow
            gridTemplate={GRID}
            cells={[
              <span className="text-[10.5px] font-mono uppercase tracking-widest text-muted-foreground">Totals</span>,
              <span />,
              <span className="font-mono text-[12px] tabular-nums" style={{ color: "#C0A85E" }}>{formatNum(totals.plan)}</span>,
              <span className="font-mono text-[12px] tabular-nums" style={{ color: "#E5E9EA" }}>{formatNum(totals.used)}</span>,
              <span className="font-mono text-[12px] tabular-nums" style={{ color: totalLeftover > 0 ? T_GREEN : "#3D89DA" }}>{formatNum(totalLeftover)}</span>,
              <span />,
            ]}
          />

          {lastReturned && !showButton && (
            <div
              className="mx-3 my-3 rounded-md border p-3 flex flex-wrap items-center gap-2"
              style={{ borderColor: T_GREEN, background: "rgba(34,197,94,0.06)" }}
            >
              <span
                className="text-[10.5px] font-mono uppercase tracking-widest px-2 py-0.5 rounded"
                style={{ background: T_GREEN, color: "#0A0A0A" }}
              >
                Returned
              </span>
              <span className="text-[11.5px]" style={{ color: "#B4E7C6" }}>
                Leftover posted to Stock & Inventory on{" "}
                {new Date(lastReturned.returned_at!).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
                .
              </span>
            </div>
          )}

          {showButton && (
            <div
              className="mx-3 my-3 rounded-md border p-3 flex flex-col sm:flex-row sm:items-center gap-3"
              style={{ borderColor: T_GREEN, background: "rgba(34,197,94,0.06)" }}
            >
              <div className="flex-1 text-[11.5px]" style={{ color: "#B4E7C6" }}>
                {formatNum(Math.max(totalToReturn, 0))} units of leftover stock ready to return to the Stock & Inventory sheet.
                Once returned, the next project's Stock Planning sees it as on-hand and orders that much less.
              </div>
              <button
                onClick={openModal}
                disabled={buttonDisabled || submitting}
                className="h-8 px-3 text-[11px] font-mono uppercase tracking-widest rounded-md transition-transform active:scale-[0.97] active:brightness-90 disabled:opacity-50 disabled:cursor-not-allowed self-start sm:self-auto"
                style={{ background: T_GREEN, color: "#0A0A0A" }}
              >
                Return to stock
              </button>
            </div>
          )}
        </>
      )}

      <Dialog open={modalOpen} onOpenChange={(o) => !submitting && setModalOpen(o)}>
        <DialogContent
          className="max-w-lg w-[calc(100vw-24px)] p-0 gap-0 overflow-hidden"
          style={{ background: "#0B0C0F", borderColor: "#1F2224" }}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            cancelBtnRef.current?.focus();
          }}
        >
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="text-[13px] font-mono uppercase tracking-widest">
              Return leftover to stock
            </DialogTitle>
            <DialogDescription className="text-[11.5px] text-muted-foreground">
              {positiveLines.length === 0
                ? "There is no positive leftover on these lines. Nothing will be posted."
                : `${formatNum(totalToReturn)} units across ${positiveLines.length} line${positiveLines.length === 1 ? "" : "s"} will be added to Stock & Inventory. This cannot be undone.`}
            </DialogDescription>
          </DialogHeader>

          {returnableLines.length > 0 && (
            <div className="max-h-[45vh] overflow-y-auto border-t border-b" style={{ borderColor: "#1F2224" }}>
              {returnableLines.map((l) => (
                <div
                  key={l.id}
                  className="px-4 py-2 border-b last:border-b-0 flex flex-wrap items-baseline gap-x-3 gap-y-1"
                  style={{ borderColor: "#131418" }}
                >
                  <div className="flex-1 min-w-[140px]">
                    <div className="font-mono text-[12px] text-foreground">{l.product_code}</div>
                    {l.description && (
                      <div className="text-[10.5px] text-muted-foreground truncate">{l.description}</div>
                    )}
                  </div>
                  <div className="flex items-baseline gap-3 font-mono text-[11px] tabular-nums">
                    <span className="text-muted-foreground">
                      plan <span className="text-foreground">{formatNum(l.planned)}</span>
                    </span>
                    <span className="text-muted-foreground">
                      used <span className="text-foreground">{formatNum(l.used)}</span>
                    </span>
                    <span
                      className="px-2 py-0.5 rounded text-[11.5px] font-semibold"
                      style={{
                        background:
                          l.leftover > 0
                            ? "rgba(34,197,94,0.15)"
                            : l.leftover < 0
                            ? "rgba(226,75,74,0.15)"
                            : "rgba(107,114,128,0.15)",
                        color: l.leftover > 0 ? T_GREEN : l.leftover < 0 ? T_RED : "#9CA3AF",
                      }}
                    >
                      leftover {formatNum(l.leftover)} {l.unit ?? ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {negativeLines.length > 0 && (
            <div className="px-4 py-2 text-[10.5px]" style={{ color: T_RED }}>
              {negativeLines.length} line{negativeLines.length === 1 ? " has" : "s have"} used more than planned. Those lines will be skipped — only positive leftovers post.
            </div>
          )}

          <DialogFooter className="px-4 py-3 gap-2 sm:gap-2 flex-row justify-end">
            <button
              ref={cancelBtnRef}
              type="button"
              onClick={() => setModalOpen(false)}
              disabled={submitting}
              className="h-8 px-3 text-[11px] font-mono uppercase tracking-widest rounded-md border transition-colors disabled:opacity-50"
              style={{ borderColor: "#2A2D31", color: "#E5E9EA", background: "transparent" }}
            >
              Cancel
            </button>
            {positiveLines.length > 0 && (
              <button
                type="button"
                onClick={confirmReturn}
                disabled={submitting}
                className="h-8 px-4 text-[11px] font-mono uppercase tracking-widest rounded-md transition-transform active:scale-[0.97] active:brightness-90 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: T_GREEN, color: "#0A0A0A", fontWeight: 600 }}
              >
                {submitting ? "Returning…" : "Confirm return"}
              </button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TableShell>
  );
}
