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
  T_BLUE,
} from "./tableCommon";

const db = supabase as any;

interface PoolRow {
  code: string;
  description: string;
  stock_on_hand: number;
  reorder_level: number;
  project_id: string;
  used_here: number;
  other_projects: number;
  remaining: number;
}

const GRID = "110px 1fr 90px 100px 100px 90px";

export function AccessoriesTable({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<PoolRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await db
      .from("v_accessory_pool")
      .select("*")
      .eq("project_id", projectId)
      .order("code");
    setRows((data as PoolRow[]) ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime subscription — cross-project pool updates
  useEffect(() => {
    const channel = supabase
      .channel(`accessory_usage_pool_${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "accessory_usage" },
        () => {
          load();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, load]);

  const save = async (code: string, used_here: number | null) => {
    const qty = used_here ?? 0;
    // optimistic
    setRows((prev) =>
      prev.map((r) =>
        r.code === code
          ? { ...r, used_here: qty, remaining: r.stock_on_hand - r.other_projects - qty }
          : r,
      ),
    );
    // upsert by (project_id, accessory_code)
    await db
      .from("accessory_usage")
      .upsert(
        { project_id: projectId, accessory_code: code, qty_used: qty, updated_at: new Date().toISOString() },
        { onConflict: "project_id,accessory_code" },
      );
  };

  const overAllocated = rows.filter((r) => r.remaining < 0);
  const lowStock = rows.filter((r) => r.remaining >= 0 && r.remaining <= r.reorder_level);

  const totals = useMemo(() => {
    let used = 0, left = 0;
    for (const r of rows) {
      used += Number(r.used_here) || 0;
      left += Number(r.remaining) || 0;
    }
    return { used, left };
  }, [rows]);

  if (loading) return <div className="p-6 text-[12px] text-muted-foreground">Loading…</div>;

  return (
    <TableShell
      title="Accessories"
      hint="One record, every project. 'Other jobs' is the live draw from other active projects right now."
    >
      {overAllocated.length > 0 && (
        <div
          className="px-3 py-2 text-[11.5px] border-b"
          style={{ background: "rgba(226,75,74,0.08)", borderColor: "#1F2224", color: T_RED }}
        >
          ⚠ {overAllocated.length} item{overAllocated.length > 1 ? "s" : ""} over-allocated.{" "}
          {overAllocated.map((r) => r.code).join(", ")} — more has been claimed across all active jobs than exists. Someone will turn up to site without it.
        </div>
      )}
      {overAllocated.length === 0 && lowStock.length > 0 && (
        <div
          className="px-3 py-2 text-[11.5px] border-b"
          style={{ background: "rgba(61,137,218,0.08)", borderColor: "#1F2224", color: T_BLUE }}
        >
          Running low: {lowStock.map((r) => r.code).join(", ")}
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState message="No accessories configured." />
      ) : (
        <>
          <HeaderRow
            gridTemplate={GRID}
            cols={[
              { label: "Code" },
              { label: "Description" },
              { label: "In stock", align: "right" },
              { label: "Other jobs", align: "right" },
              { label: "Used here", align: "right" },
              { label: "Left", align: "right" },
            ]}
          />
          {rows.map((r) => {
            const over = r.remaining < 0;
            return (
              <div
                key={r.code}
                className="grid items-center border-b"
                style={{
                  gridTemplateColumns: GRID,
                  height: 40,
                  borderColor: "#131418",
                  background: over ? "rgba(226,75,74,0.06)" : undefined,
                }}
              >
                <div className="px-2"><ExtCell value={r.code} /></div>
                <div className="px-2 min-w-0"><ExtCell value={r.description} /></div>
                <div className="px-2 flex justify-end"><ExtCell value={r.stock_on_hand} numeric align="right" /></div>
                <div className="px-2 flex justify-end"><ExtCell value={r.other_projects} numeric align="right" /></div>
                <div className="px-2">
                  <NumInput
                    value={r.used_here}
                    onSave={(n) => save(r.code, n)}
                    required
                    invalid={over}
                  />
                </div>
                <div className="px-2 flex justify-end">
                  <CalcCell value={r.remaining} color={over ? T_RED : r.remaining <= r.reorder_level ? T_BLUE : undefined} />
                </div>
              </div>
            );
          })}
          <TotalsRow
            gridTemplate={GRID}
            cells={[
              <span className="text-[10.5px] font-mono uppercase tracking-widest text-muted-foreground">Totals</span>,
              <span />,
              <span />,
              <span />,
              <span className="font-mono text-[12px] tabular-nums" style={{ color: "#E5E9EA" }}>{formatNum(totals.used)}</span>,
              <span className="font-mono text-[12px] tabular-nums" style={{ color: totals.left < 0 ? T_RED : T_BLUE }}>{formatNum(totals.left)}</span>,
            ]}
          />
        </>
      )}
    </TableShell>
  );
}
