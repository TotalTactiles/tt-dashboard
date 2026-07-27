import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  TableShell,
  HeaderRow,
  TotalsRow,
  ExtCell,
  CalcCell,
  NumInput,
  TextInput,
  DateCell,
  EmptyState,
  formatNum,
  formatMoney,
  T_GOLD,
  T_AMBER,
  T_BLUE,
  T_GREEN,
} from "./tableCommon";
import { useRole } from "@/hooks/useRole";
import { useLiveStock, LiveStockBadge } from "@/hooks/useLiveStock";

const db = supabase as any;

interface Row {
  id: string;
  project_id: string;
  product_code: string;
  description: string | null;
  qty_needed: number;
  qty_ordered: number | null;
  unit: string | null;
  unit_cost: number | null;
  ordered_at: string | null;
  source: string | null;
  deposit_date: string | null;
  remainder_date: string | null;
}

interface PlanningRow {
  cost_bucket: string | null;
  source: string | null;
}

// 12 cols: Code, Description, Qty needed, On hand, Shortfall, Qty ordered,
// Unit cost, Line cost, Source, Deposit paid, Remainder paid, actions.
const GRID = "130px 1fr 78px 78px 82px 82px 88px 100px 90px 120px 120px 40px";

type Bucket = "tactile" | "other" | "accessory" | null;

/** Master-sheet category → bucket chip + resolvable bucket for planning lookup. */
function categoryToChip(cat: string | null | undefined): {
  label: string;
  unknown: boolean;
  excluded: boolean;
  bucket: Bucket;
} {
  const c = (cat ?? "").toUpperCase();
  if (c === "TACTILE") return { label: "TACTILE", unknown: false, excluded: false, bucket: "tactile" };
  if (c === "STAIR_NOSING" || c === "ENTRY_MAT")
    return { label: "OTHER", unknown: false, excluded: false, bucket: "other" };
  if (c === "ACCESSORY") return { label: "ACCESSORY", unknown: false, excluded: true, bucket: "accessory" };
  return { label: "UNKNOWN CODE", unknown: true, excluded: false, bucket: null };
}

const SOURCE_LABELS: Record<string, string> = {
  china: "China",
  local: "Local",
  john: "John",
};

/** Gold read-only money cell. */
function GoldMoneyCell({ value }: { value: number | null | undefined }) {
  const missing = value == null || !isFinite(Number(value));
  return (
    <div
      className="font-mono text-[12px] tabular-nums"
      style={{ color: missing ? T_AMBER : T_GOLD, textAlign: "right", width: "100%" }}
    >
      {missing ? "—" : formatMoney(Number(value))}
    </div>
  );
}

/** Gold read-only quantity cell. */
function GoldQtyCell({ value }: { value: number | null | undefined }) {
  const missing = value == null || !isFinite(Number(value));
  return (
    <div
      className="font-mono text-[12px] tabular-nums"
      style={{ color: missing ? "rgba(230,238,243,0.28)" : T_GOLD, textAlign: "right", width: "100%" }}
    >
      {missing ? "—" : formatNum(Number(value))}
    </div>
  );
}

/** Inherited source cell — gold when resolved, amber "NO SOURCE" otherwise. */
function SourceCell({ resolved }: { resolved: string | null }) {
  if (!resolved) {
    return (
      <span
        className="text-[11px] font-mono uppercase tracking-widest"
        style={{ color: T_AMBER }}
      >
        NO SOURCE
      </span>
    );
  }
  return (
    <span className="text-[12.5px]" style={{ color: T_GOLD }}>
      {SOURCE_LABELS[resolved] ?? resolved}
    </span>
  );
}

export function OrderStockTable({ projectId }: { projectId: string }) {
  const { role } = useRole();
  const readOnly = role !== "office";
  const [rows, setRows] = useState<Row[]>([]);
  const [planning, setPlanning] = useState<PlanningRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const live = useLiveStock();

  const stockLiveOK = live.status === "live" || live.status === "cached";

  const load = useCallback(async () => {
    setLoading(true);
    const [ordersRes, planRes] = await Promise.all([
      db.from("stock_orders").select("*").eq("project_id", projectId).order("product_code"),
      db.from("stock_planning").select("cost_bucket, source").eq("project_id", projectId),
    ]);
    setRows((ordersRes.data as Row[]) ?? []);
    setPlanning((planRes.data as PlanningRow[]) ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  // Live reload of planning source when the Stock Planning table changes it —
  // realtime keeps this table's inherited SOURCE in sync without a page reload.
  useEffect(() => {
    const channel = db
      .channel(`order-stock-planning-${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stock_planning", filter: `project_id=eq.${projectId}` },
        async () => {
          const { data } = await db
            .from("stock_planning")
            .select("cost_bucket, source")
            .eq("project_id", projectId);
          setPlanning((data as PlanningRow[]) ?? []);
        },
      )
      .subscribe();
    return () => {
      db.removeChannel(channel);
    };
  }, [projectId]);

  const planningSourceByBucket = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const p of planning) {
      if (!p.cost_bucket) continue;
      map[p.cost_bucket] = p.source ?? null;
    }
    return map;
  }, [planning]);

  const patch = useCallback(async (id: string, p: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...p } : r)));
    const { error } = await db.from("stock_orders").update(p).eq("id", id);
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[OrderStockTable] update failed", { id, patch: p, error });
    }
  }, []);

  const onProductCode = useCallback(
    async (id: string, code: string | null) => {
      const trimmed = (code ?? "").trim();
      const patchObj: Partial<Row> = { product_code: trimmed };
      let current: Row | undefined;
      setRows((cur) => {
        current = cur.find((r) => r.id === id);
        return cur;
      });
      if (trimmed && current) {
        const it = live.items[trimmed];
        if (current.description == null && it?.description) {
          patchObj.description = it.description;
        }
        if (current.unit == null && it?.unit) {
          patchObj.unit = it.unit;
        }
      }
      await patch(id, patchObj);
    },
    [live.items, patch],
  );

  /** Snapshot unit_cost whenever the catalogue price resolves and differs. */
  useEffect(() => {
    if (live.status !== "live") return;
    for (const r of rows) {
      if (!r.product_code) continue;
      const it = live.items[r.product_code];
      const catalogueCost = it?.cost_per_unit;
      if (catalogueCost == null) continue;
      const next = Number(catalogueCost);
      if (!isFinite(next)) continue;
      if (r.unit_cost == null || Number(r.unit_cost) !== next) {
        patch(r.id, { unit_cost: next });
      }
    }
  }, [rows, live.items, live.status, patch]);

  /**
   * Snapshot inherited source into stock_orders.source whenever it resolves
   * and differs. This freezes what the source was at order time; a later
   * change to Stock Planning must not rewrite historical rows.
   */
  useEffect(() => {
    if (!stockLiveOK) return;
    for (const r of rows) {
      if (!r.product_code) continue;
      const item = live.items[r.product_code];
      if (!item) continue;
      const chip = categoryToChip(item.category);
      if (chip.excluded || chip.bucket == null) continue;
      const resolved = planningSourceByBucket[chip.bucket] ?? null;
      if (!resolved) continue;
      if (r.source !== resolved) {
        patch(r.id, { source: resolved });
      }
    }
  }, [rows, live.items, stockLiveOK, planningSourceByBucket, patch]);

  const add = useCallback(async () => {
    const { data } = await db
      .from("stock_orders")
      .insert({
        project_id: projectId,
        product_code: "",
        description: null,
        qty_needed: 0,
        qty_ordered: null,
        unit: null,
        unit_cost: null,
        ordered_at: null,
        source: null,
        deposit_date: null,
        remainder_date: null,
      })
      .select("*")
      .maybeSingle();
    if (data) setRows((prev) => [...prev, data as Row]);
  }, [projectId]);

  const remove = useCallback(async (id: string) => {
    let prev: Row[] = [];
    setRows((cur) => {
      prev = cur;
      return cur.filter((r) => r.id !== id);
    });
    const { error } = await db.from("stock_orders").delete().eq("id", id);
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[OrderStockTable] delete failed", { id, error });
      setRows(prev);
      toast.error("Failed to delete line");
    }
  }, []);

  const confirmDelete = useCallback(
    (r: Row) => {
      setMenuFor(null);
      const label = r.product_code?.trim() ? r.product_code : "this line";
      if (!window.confirm(`Delete ${label}?`)) return;
      remove(r.id);
    },
    [remove],
  );

  const longPressTimer = useRef<number | null>(null);
  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);
  const startLongPress = useCallback(
    (r: Row) => {
      cancelLongPress();
      longPressTimer.current = window.setTimeout(() => {
        confirmDelete(r);
      }, 550);
    },
    [cancelLongPress, confirmDelete],
  );
  useEffect(() => () => cancelLongPress(), [cancelLongPress]);

  const totals = useMemo(() => {
    let need = 0, ord = 0, lineCost = 0;
    for (const r of rows) {
      need += Number(r.qty_needed) || 0;
      ord += Number(r.qty_ordered) || 0;
      const uc = Number(r.unit_cost) || 0;
      const qo = Number(r.qty_ordered) || 0;
      lineCost += uc * qo;
    }
    return { need, ord, lineCost };
  }, [rows]);

  /**
   * Per-line completeness report — used for both the amber banner and for
   * outlining specific cells. A line is complete only when it has: a
   * resolvable source, qty_ordered > 0, a unit_cost, a deposit_date, and —
   * for China only — a remainder_date. Excluded (accessory) lines never
   * flow to the forecast and are ignored.
   */
  const incompleteReport = useMemo(() => {
    const perLine: {
      row: Row;
      resolved: string | null;
      missing: string[];
    }[] = [];
    for (const r of rows) {
      const item = live.items[r.product_code];
      const chip = categoryToChip(item?.category);
      if (chip.excluded) continue;

      const resolved =
        stockLiveOK && item && chip.bucket ? planningSourceByBucket[chip.bucket] ?? null : null;

      const missing: string[] = [];
      if (!resolved) missing.push("source");
      if (r.qty_ordered == null || !Number(r.qty_ordered)) missing.push("qty ordered");
      if (r.unit_cost == null) missing.push("unit cost");
      if (!r.deposit_date) missing.push("deposit paid date");
      if (resolved === "china" && !r.remainder_date) missing.push("remainder paid date");

      if (missing.length > 0) perLine.push({ row: r, resolved, missing });
    }
    return perLine;
  }, [rows, live.items, planningSourceByBucket, stockLiveOK]);

  const allComplete = incompleteReport.length === 0 && rows.length > 0;

  if (loading) return <div className="p-6 text-[12px] text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-2">
      {!readOnly && rows.length > 0 && (
        allComplete ? (
          <div className="text-[10px] font-mono uppercase tracking-widest" style={{ color: T_GREEN }}>
            All order lines complete
          </div>
        ) : incompleteReport.length > 0 ? (
          <div
            className="text-[10.5px] font-mono px-3 py-2 rounded-sm border space-y-1"
            style={{ color: T_AMBER, borderColor: T_AMBER, background: "rgba(186,117,23,0.06)" }}
          >
            <div className="uppercase tracking-widest">
              {incompleteReport.length} order line{incompleteReport.length === 1 ? "" : "s"} incomplete — these costs will NOT reach the forecast.
            </div>
            <ul className="space-y-0.5 pl-1">
              {incompleteReport.map(({ row, resolved, missing }) => (
                <li key={row.id} className="normal-case tracking-normal">
                  <span className="font-mono">
                    {row.product_code?.trim() || "(no code)"}
                  </span>
                  {" — "}
                  {!resolved ? (
                    <span>NO SOURCE — set the {categoryToChip(live.items[row.product_code]?.category).label.toLowerCase() || "product"} source in Stock Planning first{missing.filter((m) => m !== "source").length ? "; also missing " + missing.filter((m) => m !== "source").join(", ") : ""}</span>
                  ) : (
                    <span>{missing.join(", ")}</span>
                  )}
                </li>
              ))}
            </ul>
            <div className="normal-case tracking-normal opacity-90 pt-1">
              An incomplete line is ignored entirely. Its cost stays at the Stock Planning estimate and the cashflow will be wrong for that month.
            </div>
          </div>
        ) : null
      )}
      <TableShell
        right={
          <div className="flex items-center gap-3">
            <LiveStockBadge status={live.status} syncedAt={live.syncedAt} />
            {!readOnly && (
              <button
                onClick={add}
                className="text-[10.5px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> Add line
              </button>
            )}
          </div>
        }
        hint={
          <div className="space-y-1">
            <div className="opacity-45 font-mono text-[10px]">
              Source is set once in Stock Planning. China pays 30% deposit and 70% remainder — enter both dates. Local and John are a single payment.
            </div>
            <div className="opacity-45 font-mono text-[10px]">
              Unit cost is read from the master Stock & Inventory sheet and snapshotted here at time of order. Change prices in the sheet, not here.
            </div>
            <div className="opacity-45 font-mono text-[10px]">
              On hand is company-wide live stock. Other open projects may be drawing on the same items.
            </div>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <div style={{ minWidth: 1240 }}>
            <HeaderRow
              gridTemplate={GRID}
              stickyFirstCol
              cols={[
                { label: "Code" },
                { label: "Description" },
                { label: "Qty needed", align: "right" },
                { label: "On hand", align: "right" },
                { label: "Shortfall", align: "right" },
                { label: "Qty ordered", align: "right" },
                { label: "Unit cost", align: "right" },
                { label: "Line cost", align: "right" },
                { label: "Source" },
                { label: "Deposit paid" },
                { label: "Remainder paid" },
                { label: "" },
              ]}
            />
            {rows.length === 0 ? (
              <EmptyState message="Seeded from the quote scope when the project is built." />
            ) : (
              <>
                {rows.map((r) => {
                  const item = live.items[r.product_code];
                  const chip = categoryToChip(item?.category);
                  const liveCost = item?.cost_per_unit;
                  const displayCost =
                    r.unit_cost != null ? Number(r.unit_cost) : liveCost != null ? Number(liveCost) : null;
                  const uc = Number(r.unit_cost) || 0;
                  const qo = Number(r.qty_ordered) || 0;
                  const lineCost = uc * qo;

                  const excluded = chip.excluded;

                  // Inherited source, resolved live from Stock Planning
                  const resolvedSource =
                    stockLiveOK && item && chip.bucket ? planningSourceByBucket[chip.bucket] ?? null : null;
                  const isChina = resolvedSource === "china";

                  const qtyInvalid = !readOnly && !excluded && (r.qty_ordered == null || !Number(r.qty_ordered));
                  const depositInvalid = !readOnly && !excluded && !r.deposit_date;
                  const remainderInvalid = !readOnly && !excluded && isChina && !r.remainder_date;

                  const isCatalogue = stockLiveOK && !!item;
                  const codeLocked = isCatalogue;
                  const descLocked = isCatalogue;
                  const liveDescription = item?.description ?? null;

                  const onHand = stockLiveOK && item ? Number(item.on_hand) : null;
                  const qtyNeeded = Number(r.qty_needed) || 0;
                  const shortfall = onHand != null ? Math.max(0, qtyNeeded - onHand) : null;

                  return (
                    <div
                      key={r.id}
                      className="grid items-center border-b group"
                      style={{ gridTemplateColumns: GRID, minHeight: 40, borderColor: "#131418" }}
                      onTouchStart={() => startLongPress(r)}
                      onTouchEnd={cancelLongPress}
                      onTouchMove={cancelLongPress}
                      onTouchCancel={cancelLongPress}
                    >
                      <div
                        className="px-2 min-w-0"
                        style={{
                          position: "sticky",
                          left: 0,
                          zIndex: 1,
                          background: "#0A0A0A",
                          boxShadow: "1px 0 0 #131418",
                        }}
                      >
                        <div className="flex flex-col gap-0.5">
                          {readOnly || codeLocked ? (
                            <ExtCell value={r.product_code} />
                          ) : (
                            <TextInput
                              value={r.product_code}
                              onSave={(v) => onProductCode(r.id, v)}
                              required
                              placeholder="Code"
                            />
                          )}
                          {r.product_code ? (
                            <span
                              className="text-[9px] font-mono uppercase tracking-widest"
                              style={{ color: chip.unknown ? T_AMBER : "#E5E9EA", opacity: chip.unknown ? 1 : 0.45 }}
                            >
                              {chip.label}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="px-2 min-w-0">
                        {readOnly || descLocked ? (
                          <ExtCell value={descLocked ? liveDescription ?? r.description : r.description} />
                        ) : (
                          <TextInput
                            value={r.description}
                            onSave={(v) => patch(r.id, { description: v })}
                            placeholder="Description"
                          />
                        )}
                      </div>
                      <div className="px-2 flex justify-end">
                        <CalcCell value={qtyNeeded} formatter={formatNum} />
                      </div>
                      <div className="px-2">
                        <GoldQtyCell value={onHand} />
                      </div>
                      <div className="px-2 flex justify-end">
                        {shortfall == null ? (
                          <div
                            className="font-mono text-[12px] tabular-nums"
                            style={{ color: "rgba(230,238,243,0.28)", textAlign: "right", width: "100%" }}
                          >
                            —
                          </div>
                        ) : shortfall === 0 ? (
                          <div
                            className="font-mono text-[12px] tabular-nums"
                            style={{ color: "rgba(230,238,243,0.45)", textAlign: "right", width: "100%" }}
                          >
                            —
                          </div>
                        ) : (
                          <CalcCell value={shortfall} formatter={formatNum} color={T_BLUE} />
                        )}
                      </div>
                      <div className="px-2">
                        <NumInput
                          value={r.qty_ordered}
                          onSave={(n) => patch(r.id, { qty_ordered: n })}
                          readOnly={readOnly}
                          required={!excluded}
                          invalid={qtyInvalid}
                        />
                      </div>
                      <div className="px-2">
                        <GoldMoneyCell value={displayCost} />
                      </div>
                      <div className="px-2 flex justify-end">
                        <CalcCell
                          value={r.qty_ordered != null && displayCost != null ? lineCost : null}
                          formatter={formatMoney}
                          color={T_BLUE}
                        />
                      </div>
                      <div className="px-2 min-w-0">
                        <SourceCell resolved={excluded ? null : resolvedSource} />
                      </div>
                      <div className="px-2">
                        <DateCell
                          value={r.deposit_date}
                          onSave={(v) => patch(r.id, { deposit_date: v })}
                          readOnly={readOnly}
                          required={!excluded}
                          invalid={depositInvalid}
                        />
                      </div>
                      <div className="px-2">
                        {excluded ? (
                          <span style={{ color: "rgba(230,238,243,0.28)" }}>—</span>
                        ) : isChina ? (
                          <DateCell
                            value={r.remainder_date}
                            onSave={(v) => patch(r.id, { remainder_date: v })}
                            readOnly={readOnly}
                            required
                            invalid={remainderInvalid}
                          />
                        ) : (
                          <span style={{ color: "rgba(230,238,243,0.28)" }}>—</span>
                        )}
                      </div>
                      <div className="flex items-center justify-center relative">
                        {!readOnly && (
                          <>
                            <button
                              aria-label="Row actions"
                              onClick={() => setMenuFor((cur) => (cur === r.id ? null : r.id))}
                              className="md:opacity-0 md:group-hover:opacity-100 opacity-60 text-muted-foreground hover:text-foreground"
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </button>
                            {menuFor === r.id && (
                              <>
                                <div
                                  className="fixed inset-0 z-40"
                                  onClick={() => setMenuFor(null)}
                                />
                                <div
                                  className="absolute right-0 top-full mt-1 z-50 rounded-sm border shadow-lg"
                                  style={{ background: "#0A0A0A", borderColor: "#1F2224" }}
                                >
                                  <button
                                    onClick={() => confirmDelete(r)}
                                    className="block w-full text-left px-3 py-1.5 text-[11px] font-mono uppercase tracking-widest whitespace-nowrap hover:bg-white/5"
                                    style={{ color: "#E24B4A" }}
                                  >
                                    Delete line
                                  </button>
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                <TotalsRow
                  gridTemplate={GRID}
                  stickyFirstCol
                  cells={[
                    <span className="text-[10.5px] font-mono uppercase tracking-widest text-muted-foreground">Totals</span>,
                    <span />,
                    <span className="font-mono text-[12px] tabular-nums" style={{ color: T_BLUE }}>{formatNum(totals.need)}</span>,
                    <span />,
                    <span />,
                    <span className="font-mono text-[12px] tabular-nums" style={{ color: "#E5E9EA" }}>{formatNum(totals.ord)}</span>,
                    <span />,
                    <span className="font-mono text-[12.5px] tabular-nums" style={{ color: T_BLUE }}>{formatMoney(totals.lineCost)}</span>,
                    <span />,
                    <span />,
                    <span />,
                    <span />,
                  ]}
                />
              </>
            )}
          </div>
        </div>
      </TableShell>
    </div>
  );
}
