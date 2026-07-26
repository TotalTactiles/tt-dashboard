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
  T_AMBER,
} from "./tableCommon";
import { useLiveStock, LiveStockBadge, type LiveStockItem } from "@/hooks/useLiveStock";

const db = supabase as any;

interface UsageRow {
  project_id: string;
  accessory_code: string;
  qty_used: number;
}

interface DisplayRow {
  code: string;
  description: string;
  stock_on_hand: number | null; // null when live is unavailable
  reorder_level: number;
  used_here: number;
  other_projects: number;
  remaining: number | null;
}

const GRID = "110px 1fr 90px 100px 100px 90px";

export function AccessoriesTable({ projectId }: { projectId: string }) {
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const live = useLiveStock();
  const liveUnavailable = live.status === "error";

  const load = useCallback(async () => {
    const { data } = await db
      .from("accessory_usage")
      .select("project_id, accessory_code, qty_used");
    setUsage(((data as UsageRow[]) ?? []).map((r) => ({ ...r, qty_used: Number(r.qty_used) || 0 })));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime — cross-project pool updates.
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

  const save = useCallback(
    async (code: string, used_here: number | null) => {
      const qty = used_here ?? 0;
      // optimistic
      setUsage((prev) => {
        const idx = prev.findIndex(
          (u) => u.project_id === projectId && u.accessory_code === code,
        );
        if (idx === -1) {
          return [...prev, { project_id: projectId, accessory_code: code, qty_used: qty }];
        }
        const next = prev.slice();
        next[idx] = { ...next[idx], qty_used: qty };
        return next;
      });
      await db
        .from("accessory_usage")
        .upsert(
          {
            project_id: projectId,
            accessory_code: code,
            qty_used: qty,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "project_id,accessory_code" },
        );
    },
    [projectId],
  );

  // Accessory catalogue comes from the sheet — category === 'ACCESSORY'.
  // On live failure, fall back to codes appearing in usage so operators can
  // still see and correct their draw-down. We deliberately show no on-hand.
  const rows = useMemo<DisplayRow[]>(() => {
    const usageByCode = new Map<string, { total: number; here: number }>();
    for (const u of usage) {
      const key = u.accessory_code;
      const rec = usageByCode.get(key) ?? { total: 0, here: 0 };
      rec.total += u.qty_used;
      if (u.project_id === projectId) rec.here += u.qty_used;
      usageByCode.set(key, rec);
    }

    const sheetCodes: [string, LiveStockItem][] = Object.entries(live.items).filter(
      ([, it]) => (it.category ?? "").toUpperCase() === "ACCESSORY",
    );

    // Union of sheet accessory codes and codes seen in usage.
    const codes = new Set<string>();
    for (const [c] of sheetCodes) codes.add(c);
    for (const c of usageByCode.keys()) codes.add(c);

    const list: DisplayRow[] = [];
    for (const code of codes) {
      const it = live.items[code];
      const stock = it && !liveUnavailable ? Number(it.on_hand) || 0 : null;
      const reorder = it?.threshold != null ? Number(it.threshold) || 0 : 0;
      const u = usageByCode.get(code) ?? { total: 0, here: 0 };
      const other = u.total - u.here;
      const remaining = stock == null ? null : stock - u.total;
      list.push({
        code,
        description: it?.description ?? "",
        stock_on_hand: stock,
        reorder_level: reorder,
        used_here: u.here,
        other_projects: other,
        remaining,
      });
    }
    list.sort((a, b) => a.code.localeCompare(b.code));
    return list;
  }, [usage, live.items, liveUnavailable, projectId]);

  const overAllocated = rows.filter((r) => r.remaining != null && r.remaining < 0);
  const lowStock = rows.filter(
    (r) => r.remaining != null && r.remaining >= 0 && r.remaining <= r.reorder_level,
  );

  const totals = useMemo(() => {
    let used = 0;
    let left = 0;
    let leftKnown = false;
    for (const r of rows) {
      used += Number(r.used_here) || 0;
      if (r.remaining != null) {
        left += r.remaining;
        leftKnown = true;
      }
    }
    return { used, left, leftKnown };
  }, [rows]);

  if (loading || live.status === "loading") {
    return <div className="p-6 text-[12px] text-muted-foreground">Loading…</div>;
  }

  return (
    <TableShell
      right={<LiveStockBadge status={live.status} syncedAt={live.syncedAt} />}
      hint="Shared company pool. On-hand comes live from the master stock sheet; usage is company-wide across every active job."
    >
      {liveUnavailable && (
        <div
          className="px-3 py-2 text-[11.5px] border-b"
          style={{ background: "rgba(186,117,23,0.10)", borderColor: "#1F2224", color: T_AMBER }}
        >
          On-hand unavailable — the master stock sheet did not respond. Usage is shown; remaining stock cannot be calculated until the sheet is reachable.
        </div>
      )}
      {!liveUnavailable && overAllocated.length > 0 && (
        <div
          className="px-3 py-2 text-[11.5px] border-b"
          style={{ background: "rgba(226,75,74,0.08)", borderColor: "#1F2224", color: T_RED }}
        >
          ⚠ {overAllocated.length} item{overAllocated.length > 1 ? "s" : ""} over-allocated.{" "}
          {overAllocated.map((r) => r.code).join(", ")} — more has been claimed across all active jobs than exists. Someone will turn up to site without it.
        </div>
      )}
      {!liveUnavailable && overAllocated.length === 0 && lowStock.length > 0 && (
        <div
          className="px-3 py-2 text-[11.5px] border-b"
          style={{ background: "rgba(61,137,218,0.08)", borderColor: "#1F2224", color: T_BLUE }}
        >
          Running low: {lowStock.map((r) => r.code).join(", ")}
        </div>
      )}

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
      {rows.length === 0 ? (
        <EmptyState message="No accessories configured." />
      ) : (
        <>
          {rows.map((r) => {
            const over = r.remaining != null && r.remaining < 0;
            const low =
              r.remaining != null && r.remaining >= 0 && r.remaining <= r.reorder_level;
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
                <div className="px-2">
                  <ExtCell value={r.code} />
                </div>
                <div className="px-2 min-w-0">
                  <ExtCell value={r.description} />
                </div>
                <div className="px-2 flex justify-end">
                  {r.stock_on_hand == null ? (
                    <span
                      className="font-mono text-[11px] tracking-widest"
                      style={{ color: T_AMBER }}
                    >
                      —
                    </span>
                  ) : (
                    <ExtCell value={r.stock_on_hand} numeric align="right" />
                  )}
                </div>
                <div className="px-2 flex justify-end">
                  <ExtCell value={r.other_projects} numeric align="right" />
                </div>
                <div className="px-2">
                  <NumInput
                    value={r.used_here}
                    onSave={(n) => save(r.code, n)}
                    required
                    invalid={over}
                  />
                </div>
                <div className="px-2 flex justify-end">
                  {r.remaining == null ? (
                    <span
                      className="font-mono text-[11px] tracking-widest"
                      style={{ color: T_AMBER }}
                    >
                      —
                    </span>
                  ) : (
                    <CalcCell
                      value={r.remaining}
                      color={over ? T_RED : low ? T_BLUE : undefined}
                    />
                  )}
                </div>
              </div>
            );
          })}
          <TotalsRow
            gridTemplate={GRID}
            cells={[
              <span className="text-[10.5px] font-mono uppercase tracking-widest text-muted-foreground">
                Totals
              </span>,
              <span />,
              <span />,
              <span />,
              <span
                className="font-mono text-[12px] tabular-nums"
                style={{ color: "#E5E9EA" }}
              >
                {formatNum(totals.used)}
              </span>,
              totals.leftKnown ? (
                <span
                  className="font-mono text-[12px] tabular-nums"
                  style={{ color: totals.left < 0 ? T_RED : T_BLUE }}
                >
                  {formatNum(totals.left)}
                </span>
              ) : (
                <span
                  className="font-mono text-[12px] tabular-nums"
                  style={{ color: T_AMBER }}
                >
                  —
                </span>
              ),
            ]}
          />
        </>
      )}
    </TableShell>
  );
}
