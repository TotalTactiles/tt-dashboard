import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  returned_to_stock: boolean;
}

const GRID = "120px 1fr 100px 100px 110px 90px";

export function ReconciliationTable({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [base, setBase] = useState<BaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const live = useLiveStock();

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: view }, { data: raw }] = await Promise.all([
      db.from("v_stock_leftover").select("*").eq("project_id", projectId).order("product_code"),
      db.from("stock_reconciliation").select("id, product_code, returned_to_stock").eq("project_id", projectId),
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

  const returnAll = async () => {
    const negative = rows.filter((r) => (Number(r.planned_qty) - Number(r.used_qty ?? 0)) < 0);
    if (negative.length > 0) {
      const codes = negative.map((r) => r.product_code).join(", ");
      const ok = window.confirm(
        `Used exceeds planned on ${codes}. That's a negative leftover. Continue returning positive leftovers to stock?`,
      );
      if (!ok) return;
    }
    const ids = base.filter((b) => !b.returned_to_stock).map((b) => b.id);
    if (!ids.length) return;
    setBase((prev) => prev.map((b) => (ids.includes(b.id) ? { ...b, returned_to_stock: true } : b)));
    await db
      .from("stock_reconciliation")
      .update({ returned_to_stock: true, returned_at: new Date().toISOString() })
      .in("id", ids);
  };

  if (loading) return <div className="p-6 text-[12px] text-muted-foreground">Loading…</div>;

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
          {totalLeftover > 0 && (
            <div
              className="mx-3 my-3 rounded-md border p-3 flex items-center gap-3"
              style={{ borderColor: T_GREEN, background: "rgba(34,197,94,0.06)" }}
            >
              <div className="flex-1 text-[11.5px]" style={{ color: "#B4E7C6" }}>
                {formatNum(totalLeftover)} units of leftover stock ready to return to the Stock & Inventory sheet.
                Once returned, the next project's Stock Planning sees it as on-hand and orders that much less.
              </div>
              <button
                onClick={returnAll}
                className="h-8 px-3 text-[11px] font-mono uppercase tracking-widest rounded-md"
                style={{ background: T_GREEN, color: "#0A0A0A" }}
              >
                Return to stock
              </button>
            </div>
          )}
        </>
      )}
    </TableShell>
  );
}
