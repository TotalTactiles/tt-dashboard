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
  SelectCell,
  EmptyState,
  formatMoney,
  T_GOLD,
  T_AMBER,
} from "./tableCommon";

const db = supabase as any;

interface Row {
  id: string;
  project_id: string;
  line_label: string;
  amount: number | null;
  source: string | null;
  cost_bucket: string | null;
}

const GRID = "1fr 130px 150px 140px 32px";

const BUCKET_OPTIONS = [
  { value: "tactile", label: "Tactile" },
  { value: "other", label: "Other" },
];
const SOURCE_OPTIONS = [
  { value: "china", label: "China" },
  { value: "local", label: "Local" },
  { value: "john", label: "John" },
];

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
      .order("created_at", { ascending: true });
    // Tactile is the primary cost line — always render it above Other.
    // Within a bucket, creation order (already applied by the query) wins.
    const bucketRank = (b: string | null) => (b === "tactile" ? 0 : b === "other" ? 1 : 2);
    const sorted = ((data as Row[]) ?? [])
      .map((r, i) => ({ r, i }))
      .sort((a, b) => {
        const d = bucketRank(a.r.cost_bucket) - bucketRank(b.r.cost_bucket);
        return d !== 0 ? d : a.i - b.i;
      })
      .map((x) => x.r);
    setRows(sorted);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const total = useMemo(() => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0), [rows]);

  const incomplete = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.amount == null ||
          !Number(r.amount) ||
          !r.source ||
          !r.cost_bucket,
      ).length,
    [rows],
  );

  const patch = useCallback(
    async (id: string, p: Partial<Row>) => {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...p } : r)));
      await db.from("stock_planning").update(p).eq("id", id);
    },
    [],
  );
  const add = useCallback(async () => {
    const { data } = await db
      .from("stock_planning")
      .insert({ project_id: projectId, line_label: "New line", amount: null, source: null, cost_bucket: null })
      .select("*")
      .maybeSingle();
    if (data) setRows((prev) => [...prev, data as Row]);
  }, [projectId]);
  const remove = useCallback(async (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    await db.from("stock_planning").delete().eq("id", id);
  }, []);

  if (loading) return <div className="p-6 text-[12px] text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-2">
      {incomplete > 0 && !readOnly && (
        <div
          className="text-[10.5px] font-mono uppercase tracking-widest px-3 py-1.5 rounded-sm border"
          style={{ color: T_AMBER, borderColor: T_AMBER, background: "rgba(186,117,23,0.06)" }}
        >
          {incomplete} planning line{incomplete === 1 ? "" : "s"} incomplete — amount, bucket and source are all required before stock costs reach the forecast
        </div>
      )}
      <TableShell
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
        hint={
          <span className="opacity-45 font-mono text-[10px]">
            China 30% / 70% split · Local invoice + 1 month · John invoice month
          </span>
        }
      >
        <HeaderRow
          gridTemplate={GRID}
          cols={[
            { label: "Item" },
            { label: "Bucket" },
            { label: "Source" },
            { label: "Amount", align: "right" },
            { label: "" },
          ]}
        />
        {rows.length === 0 ? (
          <EmptyState message="Two rows are seeded when a project is created. If this is empty, the project predates that." />
        ) : (
          <>
            {rows.map((r) => {
              const amountInvalid = !readOnly && (r.amount == null || !Number(r.amount));
              const bucketInvalid = !readOnly && !r.cost_bucket;
              const sourceInvalid = !readOnly && !r.source;
              return (
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
                    <SelectCell
                      value={r.cost_bucket}
                      onChange={(v) => patch(r.id, { cost_bucket: v })}
                      options={BUCKET_OPTIONS}
                      readOnly={readOnly}
                      required
                      invalid={bucketInvalid}
                      placeholder="—"
                    />
                  </div>
                  <div className="px-2">
                    <SelectCell
                      value={r.source}
                      onChange={(v) => patch(r.id, { source: v })}
                      options={SOURCE_OPTIONS}
                      readOnly={readOnly}
                      required
                      invalid={sourceInvalid}
                      placeholder="—"
                    />
                  </div>
                  <div className="px-2">
                    <NumInput
                      value={r.amount}
                      onSave={(n) => patch(r.id, { amount: n })}
                      readOnly={readOnly}
                      required
                      invalid={amountInvalid}
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
                <span className="text-[10.5px] font-mono uppercase tracking-widest text-muted-foreground">Total</span>,
                <span />,
                <span />,
                <span className="font-mono text-[12.5px] tabular-nums" style={{ color: T_GOLD }}>{formatMoney(total)}</span>,
                <span />,
              ]}
            />
          </>
        )}
      </TableShell>
    </div>
  );
}
