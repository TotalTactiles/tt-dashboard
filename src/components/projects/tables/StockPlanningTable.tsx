import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import {
  TableShell,
  HeaderRow,
  TotalsRow,
  ExtCell,
  NumInput,
  TextInput,
  EmptyState,
  formatMoney,
  T_GOLD,
} from "./tableCommon";

const db = supabase as any;

interface Row {
  id: string;
  project_id: string;
  line_label: string;
  amount: number | null;
  source: string | null;
}

const GRID = "1fr 160px 140px 32px";

export function StockPlanningTable({ projectId }: { projectId: string }) {
  const { role } = useRole();
  const readOnly = role !== "office";
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await db
      .from("stock_planning")
      .select("*")
      .eq("project_id", projectId)
      .order("line_label", { ascending: true });
    setRows((data as Row[]) ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const total = useMemo(() => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0), [rows]);

  const patch = async (id: string, p: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...p } : r)));
    await db.from("stock_planning").update(p).eq("id", id);
  };
  const add = async () => {
    const { data } = await db
      .from("stock_planning")
      .insert({ project_id: projectId, line_label: "New line", amount: null, source: null })
      .select("*")
      .maybeSingle();
    if (data) setRows((prev) => [...prev, data as Row]);
  };
  const remove = async (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    await db.from("stock_planning").delete().eq("id", id);
  };

  if (loading) return <div className="p-6 text-[12px] text-muted-foreground">Loading…</div>;

  return (
    <TableShell
      title="Stock Planning"
      right={
        !readOnly && (
          <button
            onClick={add}
            className="text-[10.5px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Add line
          </button>
        )
      }
    >
      {rows.length === 0 ? (
        <EmptyState message="Two rows are seeded when a project is created. If this is empty, the project predates that." />
      ) : (
        <>
          <HeaderRow
            gridTemplate={GRID}
            cols={[
              { label: "Item" },
              { label: "Source" },
              { label: "Amount", align: "right" },
              { label: "" },
            ]}
          />
          {rows.map((r) => (
            <div
              key={r.id}
              className="grid items-center border-b group"
              style={{ gridTemplateColumns: GRID, height: 40, borderColor: "#131418" }}
            >
              <div className="px-2 min-w-0">
                {readOnly ? (
                  <ExtCell value={r.line_label} />
                ) : (
                  <TextInput
                    value={r.line_label}
                    onSave={(v) => patch(r.id, { line_label: v ?? "" })}
                    required
                    placeholder="Item"
                  />
                )}
              </div>
              <div className="px-2">
                <TextInput
                  value={r.source}
                  onSave={(v) => patch(r.id, { source: v })}
                  readOnly={readOnly}
                  placeholder="Quote / sheet"
                />
              </div>
              <div className="px-2">
                <NumInput
                  value={r.amount}
                  onSave={(n) => patch(r.id, { amount: n })}
                  readOnly={readOnly}
                  required
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
          ))}
          <TotalsRow
            gridTemplate={GRID}
            cells={[
              <span className="text-[10.5px] font-mono uppercase tracking-widest text-muted-foreground">Total</span>,
              <span />,
              <span className="font-mono text-[12.5px] tabular-nums" style={{ color: T_GOLD }}>{formatMoney(total)}</span>,
              <span />,
            ]}
          />
        </>
      )}
    </TableShell>
  );
}
