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
  T_RED,
} from "./tableCommon";
import { useRole } from "@/hooks/useRole";

const db = supabase as any;

interface Row {
  id: string;
  project_id: string;
  product_code: string;
  description: string | null;
  qty_needed: number;
  qty_ordered: number | null;
  unit: string | null;
}

const GRID = "120px 1fr 100px 100px 100px";

export function OrderStockTable({ projectId }: { projectId: string }) {
  const { role } = useRole();
  const readOnly = role !== "office";
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

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

  const save = async (id: string, qty_ordered: number | null) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, qty_ordered } : r)));
    await db.from("stock_orders").update({ qty_ordered }).eq("id", id);
  };

  const totals = useMemo(() => {
    let need = 0, ord = 0, sh = 0;
    for (const r of rows) {
      const n = Number(r.qty_needed) || 0;
      const o = Number(r.qty_ordered ?? 0);
      need += n;
      ord += o;
      sh += Math.max(0, n - o);
    }
    return { need, ord, sh };
  }, [rows]);

  if (loading) return <div className="p-6 text-[12px] text-muted-foreground">Loading…</div>;
  if (rows.length === 0)
    return (
      <TableShell title="Order Stock">
        <EmptyState message="Seeded from the quote scope when the project is built." />
      </TableShell>
    );

  return (
    <TableShell title="Order Stock">
      <HeaderRow
        gridTemplate={GRID}
        cols={[
          { label: "Code" },
          { label: "Description" },
          { label: "Qty needed", align: "right" },
          { label: "Qty ordered", align: "right" },
          { label: "Short", align: "right" },
        ]}
      />
      {rows.map((r) => {
        const short = Math.max(0, Number(r.qty_needed) - Number(r.qty_ordered ?? 0));
        return (
          <div
            key={r.id}
            className="grid items-center border-b"
            style={{ gridTemplateColumns: GRID, height: 40, borderColor: "#131418" }}
          >
            <div className="px-2"><ExtCell value={r.product_code} /></div>
            <div className="px-2 min-w-0"><ExtCell value={r.description} /></div>
            <div className="px-2 flex justify-end"><ExtCell value={r.qty_needed} numeric align="right" /></div>
            <div className="px-2">
              <NumInput
                value={r.qty_ordered}
                onSave={(n) => save(r.id, n)}
                readOnly={readOnly}
                required
              />
            </div>
            <div className="px-2 flex justify-end">
              <CalcCell value={short} color={short > 0 ? T_RED : undefined} />
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
          <span className="font-mono text-[12px] tabular-nums" style={{ color: totals.sh > 0 ? T_RED : "#3D89DA" }}>{formatNum(totals.sh)}</span>,
        ]}
      />
    </TableShell>
  );
}
