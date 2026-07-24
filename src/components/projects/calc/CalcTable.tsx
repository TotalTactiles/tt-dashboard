import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import {
  CalcShell,
  CalcRowHeader,
  NumCell,
  TextCell,
  formatNum,
  evalFormula,
} from "./calcCommon";

const db = supabase as any;

/* =============================================================
   Root switch — picks the right calc table for the task
   ============================================================= */

export function CalcTable({ projectId, kind }: { projectId: string; kind: string }) {
  switch (kind) {
    case "stock_planning":
      return <StockPlanning projectId={projectId} />;
    case "order_stock":
      return <OrderStock projectId={projectId} />;
    case "scope":
      return <ScopeBreakdown projectId={projectId} />;
    case "accessories":
      return <AccessoriesUsed projectId={projectId} />;
    case "reconciliation":
      return <StockReconciliation projectId={projectId} />;
    default:
      return (
        <div className="p-6 text-[12px] text-muted-foreground text-center">
          No calc table configured for this task.
        </div>
      );
  }
}

/* =============================================================
   1. Stock Planning — project-scoped budget lines
   ============================================================= */

interface PlanRow {
  id: string;
  project_id: string;
  line_label: string;
  amount: number | null;
  source: string | null;
}

function StockPlanning({ projectId }: { projectId: string }) {
  const { role } = useRole();
  const readOnly = role !== "office";
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await db
      .from("stock_planning")
      .select("*")
      .eq("project_id", projectId)
      .order("line_label", { ascending: true });
    setRows((data as PlanRow[]) ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const total = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [rows],
  );

  const patch = async (id: string, p: Partial<PlanRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...p } : r)));
    await db.from("stock_planning").update(p).eq("id", id);
  };

  const add = async () => {
    const { data } = await db
      .from("stock_planning")
      .insert({ project_id: projectId, line_label: "New line", amount: null, source: null })
      .select("*")
      .maybeSingle();
    if (data) setRows((prev) => [...prev, data as PlanRow]);
  };

  const remove = async (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    await db.from("stock_planning").delete().eq("id", id);
  };

  return (
    <CalcShell
      title="Stock Planning"
      right={
        !readOnly && (
          <button onClick={add} className="text-[10.5px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <Plus className="h-3 w-3" /> Add line
          </button>
        )
      }
      empty={!loading && rows.length === 0}
    >
      <CalcRowHeader
        cols={[
          { label: "Label" },
          { label: "Source", w: "140px" },
          { label: "Amount", w: "120px", align: "right" },
          { label: "", w: "32px" },
        ]}
      />
      {rows.map((r) => (
        <div
          key={r.id}
          className="grid items-center border-b hover:bg-white/[0.02] group"
          style={{
            gridTemplateColumns: "1fr 140px 120px 32px",
            height: 36,
            borderColor: "#131418",
          }}
        >
          <div className="px-2">
            <TextCell value={r.line_label} readOnly={readOnly} onChange={(v) => patch(r.id, { line_label: v ?? "" })} placeholder="Label" />
          </div>
          <div className="px-2">
            <TextCell value={r.source} readOnly={readOnly} onChange={(v) => patch(r.id, { source: v })} placeholder="Quote / Sheet" />
          </div>
          <div className="px-2">
            <NumCell value={r.amount} readOnly={readOnly} onChange={(n) => patch(r.id, { amount: n })} suffix="$" />
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
      {rows.length > 0 && (
        <div
          className="grid items-center px-2 border-t"
          style={{
            gridTemplateColumns: "1fr 140px 120px 32px",
            height: 34,
            borderColor: "#1F2224",
            background: "#0F1113",
          }}
        >
          <div className="text-[10.5px] font-mono uppercase tracking-widest text-muted-foreground">
            Total
          </div>
          <div />
          <div className="px-2 text-right font-mono text-[12.5px] tabular-nums" style={{ color: "#3D89DA" }}>
            ${formatNum(total)}
          </div>
          <div />
        </div>
      )}
    </CalcShell>
  );
}

/* =============================================================
   2. Order Stock
   ============================================================= */

interface OrderRow {
  id: string;
  project_id: string;
  product_code: string;
  description: string | null;
  qty_needed: number;
  qty_ordered: number | null;
  unit: string | null;
}

function OrderStock({ projectId }: { projectId: string }) {
  const { role } = useRole();
  const readOnly = role !== "office";
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await db
      .from("stock_orders")
      .select("*")
      .eq("project_id", projectId)
      .order("product_code", { ascending: true });
    setRows((data as OrderRow[]) ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = async (id: string, p: Partial<OrderRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...p } : r)));
    await db.from("stock_orders").update(p).eq("id", id);
  };

  const add = async () => {
    const { data } = await db
      .from("stock_orders")
      .insert({ project_id: projectId, product_code: "NEW", qty_needed: 0 })
      .select("*")
      .maybeSingle();
    if (data) setRows((prev) => [...prev, data as OrderRow]);
  };

  const remove = async (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    await db.from("stock_orders").delete().eq("id", id);
  };

  return (
    <CalcShell
      title="Order Stock"
      right={
        !readOnly && (
          <button onClick={add} className="text-[10.5px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <Plus className="h-3 w-3" /> Add product
          </button>
        )
      }
      empty={!loading && rows.length === 0}
    >
      <CalcRowHeader
        cols={[
          { label: "Code", w: "120px" },
          { label: "Description" },
          { label: "Unit", w: "80px" },
          { label: "Needed", w: "90px", align: "right" },
          { label: "Ordered", w: "90px", align: "right" },
          { label: "Δ", w: "70px", align: "right" },
          { label: "", w: "32px" },
        ]}
      />
      {rows.map((r) => {
        const delta = (Number(r.qty_ordered) || 0) - (Number(r.qty_needed) || 0);
        const short = delta < 0;
        return (
          <div
            key={r.id}
            className="grid items-center border-b hover:bg-white/[0.02] group"
            style={{
              gridTemplateColumns: "120px 1fr 80px 90px 90px 70px 32px",
              height: 36,
              borderColor: "#131418",
            }}
          >
            <div className="px-2">
              <TextCell value={r.product_code} readOnly={readOnly} onChange={(v) => patch(r.id, { product_code: v ?? "" })} />
            </div>
            <div className="px-2">
              <TextCell value={r.description} readOnly={readOnly} onChange={(v) => patch(r.id, { description: v })} />
            </div>
            <div className="px-2">
              <TextCell value={r.unit} readOnly={readOnly} onChange={(v) => patch(r.id, { unit: v })} placeholder="ea" />
            </div>
            <div className="px-2">
              <NumCell value={r.qty_needed} readOnly={readOnly} onChange={(n) => patch(r.id, { qty_needed: n ?? 0 })} />
            </div>
            <div className="px-2">
              <NumCell value={r.qty_ordered} readOnly={readOnly} onChange={(n) => patch(r.id, { qty_ordered: n })} />
            </div>
            <div className="px-2 text-right font-mono text-[12px] tabular-nums" style={{ color: short ? "#E24B4A" : delta > 0 ? "#22C55E" : "#B0B8BF" }}>
              {r.qty_ordered == null ? "—" : formatNum(delta)}
            </div>
            <div className="flex items-center justify-center">
              {!readOnly && (
                <button onClick={() => remove(r.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-[#E24B4A]">
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </CalcShell>
  );
}

/* =============================================================
   3. Scope Breakdown — parent scope_lines with child breakdowns
   ============================================================= */

interface ScopeLine {
  id: string;
  project_id: string;
  task_id: string | null;
  product_code: string;
  location_context: string | null;
  task_name: string | null;
  total_quantity: number;
  unit: string;
}
interface ScopeChild {
  id: string;
  scope_line_id: string;
  area: string;
  sub_qty: number;
  formula: string | null;
  used_qty: number | null;
}

function ScopeBreakdown({ projectId }: { projectId: string }) {
  const { role } = useRole();
  const readOnly = role !== "office";
  const [lines, setLines] = useState<ScopeLine[]>([]);
  const [children, setChildren] = useState<Record<string, ScopeChild[]>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: ls } = await db
      .from("scope_lines")
      .select("*")
      .eq("project_id", projectId)
      .order("product_code", { ascending: true });
    const linesArr = (ls as ScopeLine[]) ?? [];
    setLines(linesArr);
    if (linesArr.length) {
      const { data: cs } = await db
        .from("scope_breakdown")
        .select("*")
        .in("scope_line_id", linesArr.map((l) => l.id));
      const map: Record<string, ScopeChild[]> = {};
      for (const c of (cs as ScopeChild[]) ?? []) (map[c.scope_line_id] ??= []).push(c);
      setChildren(map);
    } else {
      setChildren({});
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const patchLine = async (id: string, p: Partial<ScopeLine>) => {
    setLines((prev) => prev.map((r) => (r.id === id ? { ...r, ...p } : r)));
    await db.from("scope_lines").update(p).eq("id", id);
  };
  const patchChild = async (lineId: string, id: string, p: Partial<ScopeChild>) => {
    setChildren((prev) => ({
      ...prev,
      [lineId]: (prev[lineId] ?? []).map((c) => (c.id === id ? { ...c, ...p } : c)),
    }));
    await db.from("scope_breakdown").update(p).eq("id", id);
  };

  const addLine = async () => {
    const { data } = await db
      .from("scope_lines")
      .insert({ project_id: projectId, product_code: "NEW", total_quantity: 0, unit: "ea" })
      .select("*")
      .maybeSingle();
    if (data) setLines((prev) => [...prev, data as ScopeLine]);
  };
  const removeLine = async (id: string) => {
    setLines((prev) => prev.filter((r) => r.id !== id));
    setChildren((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
    await db.from("scope_breakdown").delete().eq("scope_line_id", id);
    await db.from("scope_lines").delete().eq("id", id);
  };

  const addChild = async (lineId: string) => {
    const { data } = await db
      .from("scope_breakdown")
      .insert({ scope_line_id: lineId, area: "New area", sub_qty: 0 })
      .select("*")
      .maybeSingle();
    if (data)
      setChildren((prev) => ({ ...prev, [lineId]: [...(prev[lineId] ?? []), data as ScopeChild] }));
  };
  const removeChild = async (lineId: string, id: string) => {
    setChildren((prev) => ({
      ...prev,
      [lineId]: (prev[lineId] ?? []).filter((c) => c.id !== id),
    }));
    await db.from("scope_breakdown").delete().eq("id", id);
  };

  return (
    <CalcShell
      title="Scope Breakdown"
      right={
        !readOnly && (
          <button onClick={addLine} className="text-[10.5px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <Plus className="h-3 w-3" /> Add scope line
          </button>
        )
      }
      empty={!loading && lines.length === 0}
    >
      {lines.map((l) => {
        const kids = children[l.id] ?? [];
        const usedTotal = kids.reduce((s, c) => s + (c.used_qty ?? (Number(c.sub_qty) || 0)), 0);
        const remaining = Number(l.total_quantity) - usedTotal;
        return (
          <div key={l.id} className="border-b" style={{ borderColor: "#131418" }}>
            {/* Line row */}
            <div
              className="grid items-center hover:bg-white/[0.02] group"
              style={{
                gridTemplateColumns: "120px 1fr 100px 80px 90px 90px 32px",
                height: 40,
                background: "#0D0E11",
              }}
            >
              <div className="px-2">
                <TextCell value={l.product_code} readOnly={readOnly} onChange={(v) => patchLine(l.id, { product_code: v ?? "" })} />
              </div>
              <div className="px-2">
                <TextCell value={l.location_context ?? l.task_name} readOnly={readOnly} onChange={(v) => patchLine(l.id, { location_context: v })} placeholder="Location" />
              </div>
              <div className="px-2">
                <TextCell value={l.unit} readOnly={readOnly} onChange={(v) => patchLine(l.id, { unit: v ?? "ea" })} />
              </div>
              <div className="px-2">
                <NumCell value={l.total_quantity} readOnly={readOnly} onChange={(n) => patchLine(l.id, { total_quantity: n ?? 0 })} />
              </div>
              <div className="px-2 text-right font-mono text-[11.5px] tabular-nums text-muted-foreground">
                {formatNum(usedTotal)} used
              </div>
              <div className="px-2 text-right font-mono text-[11.5px] tabular-nums" style={{ color: remaining < 0 ? "#E24B4A" : "#22C55E" }}>
                {formatNum(remaining)} left
              </div>
              <div className="flex items-center justify-center">
                {!readOnly && (
                  <button onClick={() => removeLine(l.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-[#E24B4A]">
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Children */}
            <div style={{ background: "#08090B" }}>
              <div
                className="grid text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60 border-b"
                style={{
                  gridTemplateColumns: "24px 1fr 100px 1fr 90px 32px",
                  height: 24,
                  borderColor: "#131418",
                }}
              >
                <div />
                <div className="px-2 flex items-center">Area</div>
                <div className="px-2 flex items-center justify-end">Sub qty</div>
                <div className="px-2 flex items-center">Formula</div>
                <div className="px-2 flex items-center justify-end">Used</div>
                <div />
              </div>
              {kids.map((c) => {
                const derived = evalFormula(c.formula);
                const shown = c.used_qty ?? derived ?? c.sub_qty;
                return (
                  <div
                    key={c.id}
                    className="grid items-center hover:bg-white/[0.02] group border-b"
                    style={{
                      gridTemplateColumns: "24px 1fr 100px 1fr 90px 32px",
                      height: 32,
                      borderColor: "#131418",
                    }}
                  >
                    <div />
                    <div className="px-2">
                      <TextCell value={c.area} readOnly={readOnly} onChange={(v) => patchChild(l.id, c.id, { area: v ?? "" })} />
                    </div>
                    <div className="px-2">
                      <NumCell value={c.sub_qty} readOnly={readOnly} onChange={(n) => patchChild(l.id, c.id, { sub_qty: n ?? 0 })} />
                    </div>
                    <div className="px-2">
                      <TextCell value={c.formula} readOnly={readOnly} onChange={(v) => patchChild(l.id, c.id, { formula: v })} placeholder="=2*3" />
                    </div>
                    <div className="px-2 text-right font-mono text-[12px] tabular-nums" style={{ color: "#3D89DA" }}>
                      {formatNum(shown)}
                    </div>
                    <div className="flex items-center justify-center">
                      {!readOnly && (
                        <button onClick={() => removeChild(l.id, c.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-[#E24B4A]">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {!readOnly && (
                <button
                  onClick={() => addChild(l.id)}
                  className="w-full text-left px-4 py-1.5 text-[10.5px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-white/[0.02] inline-flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Add area
                </button>
              )}
            </div>
          </div>
        );
      })}
    </CalcShell>
  );
}

/* =============================================================
   4. Accessories Used — joins accessories master
   ============================================================= */

interface Accessory {
  code: string;
  description: string;
  stock_on_hand: number;
  reorder_level: number;
  active: boolean;
}
interface UsageRow {
  id: string;
  project_id: string;
  accessory_code: string;
  qty_used: number;
  updated_at: string;
}

function AccessoriesUsed({ projectId }: { projectId: string }) {
  const { role } = useRole();
  const readOnly = false; // workers CAN record accessory usage
  const officeOnlyDelete = role === "office";
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [picker, setPicker] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: acc }, { data: use }] = await Promise.all([
      db.from("accessories").select("*").eq("active", true).order("code", { ascending: true }),
      db.from("accessory_usage").select("*").eq("project_id", projectId).order("updated_at", { ascending: false }),
    ]);
    setAccessories((acc as Accessory[]) ?? []);
    setUsage((use as UsageRow[]) ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const accByCode = useMemo(() => {
    const m: Record<string, Accessory> = {};
    for (const a of accessories) m[a.code] = a;
    return m;
  }, [accessories]);

  const addUsage = async (code: string) => {
    setPicker(false);
    const existing = usage.find((u) => u.accessory_code === code);
    if (existing) {
      await patch(existing.id, { qty_used: Number(existing.qty_used) + 1 });
      return;
    }
    const { data } = await db
      .from("accessory_usage")
      .insert({ project_id: projectId, accessory_code: code, qty_used: 1 })
      .select("*")
      .maybeSingle();
    if (data) setUsage((prev) => [data as UsageRow, ...prev]);
  };

  const patch = async (id: string, p: Partial<UsageRow>) => {
    setUsage((prev) => prev.map((u) => (u.id === id ? { ...u, ...p } : u)));
    await db.from("accessory_usage").update({ ...p, updated_at: new Date().toISOString() }).eq("id", id);
  };

  const remove = async (id: string) => {
    setUsage((prev) => prev.filter((u) => u.id !== id));
    await db.from("accessory_usage").delete().eq("id", id);
  };

  const available = accessories.filter((a) => !usage.some((u) => u.accessory_code === a.code));

  return (
    <CalcShell
      title="Accessories Used"
      right={
        <div className="relative">
          <button
            onClick={() => setPicker((p) => !p)}
            className="text-[10.5px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Log usage
          </button>
          {picker && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setPicker(false)} />
              <div
                className="absolute z-40 right-0 mt-1 rounded-md border py-1 min-w-[260px] max-h-[280px] overflow-y-auto"
                style={{ background: "#0A0A0A", borderColor: "#1F2224" }}
              >
                {available.length === 0 && (
                  <div className="px-3 py-2 text-[11px] text-muted-foreground">
                    All accessories already logged.
                  </div>
                )}
                {available.map((a) => (
                  <button
                    key={a.code}
                    onClick={() => addUsage(a.code)}
                    className="w-full flex items-center justify-between text-left px-3 py-1.5 text-[11.5px] hover:bg-white/[0.04]"
                  >
                    <span className="font-mono">{a.code}</span>
                    <span className="text-muted-foreground truncate ml-2">{a.description}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      }
      empty={!loading && usage.length === 0}
    >
      <CalcRowHeader
        cols={[
          { label: "Code", w: "120px" },
          { label: "Description" },
          { label: "Used", w: "100px", align: "right" },
          { label: "On hand", w: "90px", align: "right" },
          { label: "", w: "32px" },
        ]}
      />
      {usage.map((u) => {
        const a = accByCode[u.accessory_code];
        const low = a ? a.stock_on_hand - Number(u.qty_used) <= a.reorder_level : false;
        return (
          <div
            key={u.id}
            className="grid items-center border-b hover:bg-white/[0.02] group"
            style={{
              gridTemplateColumns: "120px 1fr 100px 90px 32px",
              height: 36,
              borderColor: "#131418",
            }}
          >
            <div className="px-2 font-mono text-[12px]">{u.accessory_code}</div>
            <div className="px-2 text-[12.5px] truncate text-muted-foreground">
              {a?.description ?? "—"}
            </div>
            <div className="px-2">
              <NumCell value={u.qty_used} onChange={(n) => patch(u.id, { qty_used: n ?? 0 })} readOnly={readOnly} />
            </div>
            <div className="px-2 text-right font-mono text-[12px] tabular-nums" style={{ color: low ? "#BA7517" : "#B0B8BF" }}>
              {a ? formatNum(a.stock_on_hand) : "—"}
            </div>
            <div className="flex items-center justify-center">
              {officeOnlyDelete && (
                <button onClick={() => remove(u.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-[#E24B4A]">
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </CalcShell>
  );
}

/* =============================================================
   5. Stock Reconciliation
   ============================================================= */

interface ReconRow {
  id: string;
  project_id: string;
  product_code: string;
  description: string | null;
  unit: string | null;
  planned_qty: number;
  used_qty: number | null;
  returned_to_stock: boolean;
  returned_at: string | null;
}

function StockReconciliation({ projectId }: { projectId: string }) {
  const { role } = useRole();
  const readOnly = role !== "office";
  const [rows, setRows] = useState<ReconRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await db
      .from("stock_reconciliation")
      .select("*")
      .eq("project_id", projectId)
      .order("product_code", { ascending: true });
    setRows((data as ReconRow[]) ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = async (id: string, p: Partial<ReconRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...p } : r)));
    await db.from("stock_reconciliation").update(p).eq("id", id);
  };

  const toggleReturn = async (r: ReconRow) => {
    const next = !r.returned_to_stock;
    await patch(r.id, {
      returned_to_stock: next,
      returned_at: next ? new Date().toISOString() : null,
    });
  };

  const add = async () => {
    const { data } = await db
      .from("stock_reconciliation")
      .insert({ project_id: projectId, product_code: "NEW", planned_qty: 0, returned_to_stock: false })
      .select("*")
      .maybeSingle();
    if (data) setRows((prev) => [...prev, data as ReconRow]);
  };

  const remove = async (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    await db.from("stock_reconciliation").delete().eq("id", id);
  };

  return (
    <CalcShell
      title="Stock Reconciliation"
      right={
        !readOnly && (
          <button onClick={add} className="text-[10.5px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <Plus className="h-3 w-3" /> Add product
          </button>
        )
      }
      empty={!loading && rows.length === 0}
    >
      <CalcRowHeader
        cols={[
          { label: "Code", w: "120px" },
          { label: "Description" },
          { label: "Unit", w: "70px" },
          { label: "Planned", w: "90px", align: "right" },
          { label: "Used", w: "90px", align: "right" },
          { label: "Variance", w: "90px", align: "right" },
          { label: "Returned", w: "90px", align: "center" },
          { label: "", w: "32px" },
        ]}
      />
      {rows.map((r) => {
        const used = r.used_qty ?? 0;
        const variance = Number(r.planned_qty) - used;
        return (
          <div
            key={r.id}
            className="grid items-center border-b hover:bg-white/[0.02] group"
            style={{
              gridTemplateColumns: "120px 1fr 70px 90px 90px 90px 90px 32px",
              height: 36,
              borderColor: "#131418",
            }}
          >
            <div className="px-2">
              <TextCell value={r.product_code} readOnly={readOnly} onChange={(v) => patch(r.id, { product_code: v ?? "" })} />
            </div>
            <div className="px-2">
              <TextCell value={r.description} readOnly={readOnly} onChange={(v) => patch(r.id, { description: v })} />
            </div>
            <div className="px-2">
              <TextCell value={r.unit} readOnly={readOnly} onChange={(v) => patch(r.id, { unit: v })} />
            </div>
            <div className="px-2">
              <NumCell value={r.planned_qty} readOnly={readOnly} onChange={(n) => patch(r.id, { planned_qty: n ?? 0 })} />
            </div>
            <div className="px-2">
              <NumCell value={r.used_qty} onChange={(n) => patch(r.id, { used_qty: n })} />
            </div>
            <div className="px-2 text-right font-mono text-[12px] tabular-nums" style={{ color: variance < 0 ? "#E24B4A" : variance > 0 ? "#22C55E" : "#B0B8BF" }}>
              {r.used_qty == null ? "—" : formatNum(variance)}
            </div>
            <div className="flex items-center justify-center">
              <button
                onClick={() => toggleReturn(r)}
                disabled={readOnly && !r.returned_to_stock}
                className="h-5 w-5 rounded-[3px] border flex items-center justify-center transition-colors"
                style={{
                  borderColor: r.returned_to_stock ? "#22C55E" : "#3A3A42",
                  background: r.returned_to_stock ? "#22C55E" : "transparent",
                }}
                aria-label="Returned to stock"
              >
                {r.returned_to_stock && (
                  <svg width="10" height="10" viewBox="0 0 10 10">
                    <path d="M2 5.2 L4.2 7.4 L8 3" stroke="#0A0A0A" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            </div>
            <div className="flex items-center justify-center">
              {!readOnly && (
                <button onClick={() => remove(r.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-[#E24B4A]">
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </CalcShell>
  );
}
