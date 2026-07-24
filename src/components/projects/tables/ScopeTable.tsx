import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
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

const db = supabase as any;

interface Row {
  id: string;
  scope_line_id: string;
  area: string;
  sub_qty: number;
  used_qty: number | null;
  // enriched from scope_lines:
  product_code?: string;
  location?: string | null;
  unit?: string | null;
}

const GRID = "1fr 110px 110px 110px";

export function ScopeTable({ taskId }: { taskId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: lines } = await db
      .from("scope_lines")
      .select("id, product_code, location_context, task_name, unit")
      .eq("task_id", taskId);
    const lineIds = ((lines as any[]) ?? []).map((l) => l.id);
    const lineMap = new Map<string, any>(((lines as any[]) ?? []).map((l) => [l.id, l]));
    let breakdown: any[] = [];
    if (lineIds.length) {
      const { data } = await db
        .from("scope_breakdown")
        .select("id, scope_line_id, area, sub_qty, used_qty")
        .in("scope_line_id", lineIds);
      breakdown = (data as any[]) ?? [];
    }
    const enriched: Row[] = breakdown.map((b) => {
      const line = lineMap.get(b.scope_line_id);
      return {
        ...b,
        product_code: line?.product_code,
        location: line?.location_context ?? line?.task_name,
        unit: line?.unit,
      };
    });
    setRows(enriched);
    setLoading(false);
  }, [taskId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (id: string, used_qty: number | null) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, used_qty } : r)));
    await db.from("scope_breakdown").update({ used_qty }).eq("id", id);
  };

  const totals = useMemo(() => {
    let qty = 0;
    let used = 0;
    for (const r of rows) {
      qty += Number(r.sub_qty) || 0;
      used += Number(r.used_qty ?? 0);
    }
    return { qty, used, diff: used - qty };
  }, [rows]);

  if (loading) return <div className="p-6 text-[12px] text-muted-foreground">Loading…</div>;
  if (rows.length === 0)
    return (
      <TableShell title="Scope Breakdown">
        <EmptyState message="No scope rows on this task." />
      </TableShell>
    );

  return (
    <TableShell title="Scope Breakdown">
      <HeaderRow
        gridTemplate={GRID}
        cols={[
          { label: "Area" },
          { label: "Qty", align: "right" },
          { label: "Used", align: "right" },
          { label: "Diff", align: "right" },
        ]}
      />
      {rows.map((r) => {
        const used = Number(r.used_qty ?? 0);
        const diff = used - Number(r.sub_qty);
        return (
          <div
            key={r.id}
            className="grid items-center border-b"
            style={{ gridTemplateColumns: GRID, height: 40, borderColor: "#131418" }}
          >
            <div className="px-2 min-w-0">
              <ExtCell value={`${r.area}${r.location ? " · " + r.location : ""}`} />
            </div>
            <div className="px-2 flex justify-end">
              <ExtCell value={r.sub_qty} numeric align="right" />
            </div>
            <div className="px-2">
              <NumInput
                value={r.used_qty}
                onSave={(n) => save(r.id, n)}
                required
              />
            </div>
            <div className="px-2 flex justify-end">
              <CalcCell value={diff} color={diff < 0 ? T_RED : undefined} />
            </div>
          </div>
        );
      })}
      <TotalsRow
        gridTemplate={GRID}
        cells={[
          <span className="text-[10.5px] font-mono uppercase tracking-widest text-muted-foreground">Totals</span>,
          <span className="font-mono text-[12px] tabular-nums" style={{ color: "#C0A85E" }}>{formatNum(totals.qty)}</span>,
          <span className="font-mono text-[12px] tabular-nums" style={{ color: "#E5E9EA" }}>{formatNum(totals.used)}</span>,
          <span className="font-mono text-[12px] tabular-nums" style={{ color: totals.diff < 0 ? T_RED : "#3D89DA" }}>{formatNum(totals.diff)}</span>,
        ]}
      />
    </TableShell>
  );
}
