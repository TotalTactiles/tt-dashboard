import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  TableShell,
  HeaderRow,
  TotalsRow,
  ExtCell,
  CalcCell,
  NumInput,
  TextInput,
  SelectCell,
  DateCell,
  EmptyState,
  formatNum,
  formatMoney,
  T_RED,
  T_AMBER,
  T_BLUE,
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
}

const GRID = "130px 1fr 78px 78px 88px 100px 90px 110px 120px 32px";

const SOURCE_OPTIONS = [
  { value: "china", label: "China" },
  { value: "local", label: "Local" },
  { value: "john", label: "John" },
];

/** Master-sheet category → bucket chip. */
function categoryToChip(cat: string | null | undefined): { label: string; unknown: boolean; excluded: boolean } {
  const c = (cat ?? "").toUpperCase();
  if (c === "TACTILE") return { label: "TACTILE", unknown: false, excluded: false };
  if (c === "STAIR_NOSING" || c === "ENTRY_MAT") return { label: "OTHER", unknown: false, excluded: false };
  if (c === "ACCESSORY") return { label: "ACCESSORY", unknown: false, excluded: true };
  return { label: "UNKNOWN CODE", unknown: true, excluded: false };
}

export function OrderStockTable({ projectId }: { projectId: string }) {
  const { role } = useRole();
  const readOnly = role !== "office";
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const live = useLiveStock();


  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await db
      .from("stock_orders")
      .select("*")
      .eq("project_id", projectId)
      .order("product_code");
    setRows((data as Row[]) ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = useCallback(async (id: string, p: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...p } : r)));
    await db.from("stock_orders").update(p).eq("id", id);
  }, []);

  const onProductCode = useCallback(
    async (id: string, code: string | null) => {
      const trimmed = (code ?? "").trim();
      const patchObj: Partial<Row> = { product_code: trimmed };
      const current = rows.find((r) => r.id === id);
      // Pre-fill from the sheet only when the DB value is null. A row that
      // already carries a value must survive product-code re-entry and any
      // future remount — the manual price is the source of truth.
      if (trimmed && current) {
        const it = live.items[trimmed];
        if (current.unit_cost == null && it?.cost_per_unit != null) {
          patchObj.unit_cost = Number(it.cost_per_unit);
        }
        if (current.description == null && it?.description) {
          patchObj.description = it.description;
        }
        if (current.unit == null && it?.unit) {
          patchObj.unit = it.unit;
        }
      }
      await patch(id, patchObj);
    },
    [live.items, rows, patch],
  );

  const onUnitCost = useCallback(
    async (id: string, n: number | null) => {
      await patch(id, { unit_cost: n });
    },
    [patch],
  );


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
      })
      .select("*")
      .maybeSingle();
    if (data) setRows((prev) => [...prev, data as Row]);
  }, [projectId]);

  const remove = useCallback(async (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    await db.from("stock_orders").delete().eq("id", id);
  }, []);


  const totals = useMemo(() => {
    let need = 0, ord = 0, lineCost = 0;
    for (const r of rows) {
      need += Number(r.qty_needed) || 0;
      ord += Number(r.qty_ordered ?? 0);
      const uc = Number(r.unit_cost ?? 0);
      const qo = Number(r.qty_ordered ?? 0);
      lineCost += uc * qo;
    }
    return { need, ord, lineCost };
  }, [rows]);

  const incomplete = useMemo(
    () =>
      rows.filter((r) => {
        const chip = categoryToChip(live.items[r.product_code]?.category);
        if (chip.excluded) return false; // accessories excluded from cost
        return (
          r.qty_ordered == null ||
          !Number(r.qty_ordered) ||
          r.unit_cost == null ||
          !Number(r.unit_cost) ||
          !r.source ||
          !r.ordered_at
        );
      }).length,
    [rows, live.items],
  );

  if (loading) return <div className="p-6 text-[12px] text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-2">
      {incomplete > 0 && !readOnly && (
        <div
          className="text-[10.5px] font-mono uppercase tracking-widest px-3 py-1.5 rounded-sm border"
          style={{ color: T_AMBER, borderColor: T_AMBER, background: "rgba(186,117,23,0.06)" }}
        >
          {incomplete} order line{incomplete === 1 ? "" : "s"} incomplete — qty, unit cost, source and order date are all required before actual costs reach the forecast
        </div>
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
              China 30% / 70% split · Local invoice + 1 month · John invoice month
            </div>
            <div className="opacity-45 font-mono text-[10px]">
              Planned is the estimate. Ordered is what was committed and paid — this drives cashflow.
            </div>
          </div>
        }
      >
        <HeaderRow
          gridTemplate={GRID}
          cols={[
            { label: "Code" },
            { label: "Description" },
            { label: "Qty needed", align: "right" },
            { label: "Qty ordered", align: "right" },
            { label: "Unit cost", align: "right" },
            { label: "Line cost", align: "right" },
            { label: "Unit" },
            { label: "Source" },
            { label: "Ordered" },
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
              const uc = Number(r.unit_cost ?? 0);
              const qo = Number(r.qty_ordered ?? 0);
              const lineCost = uc * qo;

              const excluded = chip.excluded;
              const qtyInvalid = !readOnly && !excluded && (r.qty_ordered == null || !Number(r.qty_ordered));
              const costInvalid = !readOnly && !excluded && (r.unit_cost == null || !Number(r.unit_cost));
              const sourceInvalid = !readOnly && !excluded && !r.source;
              const dateInvalid = !readOnly && !excluded && !r.ordered_at;

              return (
                <div
                  key={r.id}
                  className="grid items-center border-b group"
                  style={{ gridTemplateColumns: GRID, minHeight: 40, borderColor: "#131418" }}
                >
                  <div className="px-2 min-w-0">
                    <div className="flex flex-col gap-0.5">
                      {readOnly ? (
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
                    {readOnly ? (
                      <ExtCell value={r.description} />
                    ) : (
                      <TextInput
                        value={r.description}
                        onSave={(v) => patch(r.id, { description: v })}
                        placeholder="Description"
                      />
                    )}
                  </div>
                  <div className="px-2">
                    <NumInput
                      value={r.qty_needed}
                      onSave={(n) => patch(r.id, { qty_needed: n ?? 0 })}
                      readOnly={readOnly}
                    />
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
                    <NumInput
                      value={r.unit_cost}
                      onSave={(n) => onUnitCost(r.id, n)}
                      readOnly={readOnly}
                      required={!excluded}
                      invalid={costInvalid}
                    />
                  </div>
                  <div className="px-2 flex justify-end">
                    <CalcCell
                      value={r.qty_ordered != null && r.unit_cost != null ? lineCost : null}
                      formatter={formatMoney}
                      color={T_BLUE}
                    />
                  </div>
                  <div className="px-2 min-w-0">
                    {readOnly ? (
                      <ExtCell value={r.unit} />
                    ) : (
                      <TextInput
                        value={r.unit}
                        onSave={(v) => patch(r.id, { unit: v })}
                        placeholder="ea"
                      />
                    )}
                  </div>
                  <div className="px-2">
                    <SelectCell
                      value={r.source}
                      onChange={(v) => patch(r.id, { source: v })}
                      options={SOURCE_OPTIONS}
                      readOnly={readOnly}
                      required={!excluded}
                      invalid={sourceInvalid}
                    />
                  </div>
                  <div className="px-2">
                    <DateCell
                      value={r.ordered_at}
                      onSave={(v) => patch(r.id, { ordered_at: v })}
                      readOnly={readOnly}
                      required={!excluded}
                      invalid={dateInvalid}
                    />
                  </div>
                  <div className="flex items-center justify-center">
                    {!readOnly && (
                      <button
                        onClick={() => remove(r.id)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-[#E24B4A]"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            <TotalsRow
              gridTemplate={GRID}
              cells={[
                <span className="text-[10.5px] font-mono uppercase tracking-widest text-muted-foreground">Totals</span>,
                <span />,
                <span className="font-mono text-[12px] tabular-nums" style={{ color: "#C0A85E" }}>{formatNum(totals.need)}</span>,
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
      </TableShell>
    </div>
  );
}
