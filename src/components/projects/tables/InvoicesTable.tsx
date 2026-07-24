import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { useProfiles } from "@/hooks/useProfiles";
import {
  TableShell,
  EmptyState,
  formatMoney,
  T_GOLD,
  T_GREEN,
} from "./tableCommon";

const db = supabase as any;

interface Invoice {
  id: string;
  project_id: string;
  period_start: string;
  period_end: string;
  status: string;
  subtotal: number | null;
  gst: number | null;
  total: number | null;
}
interface Line {
  id: string;
  invoice_id: string;
  kind: string; // 'scope' | 'labour' | 'accessory'
  product_code: string | null;
  location: string | null;
  worker_id: string | null;
  qty: number | null;
  rate: number | null;
  amount: number | null;
}

export function InvoicesTable({ projectId }: { projectId: string }) {
  const { role } = useRole();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [lines, setLines] = useState<Record<string, Line[]>>({});
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const profiles = useProfiles(true);
  const workerName = (id: string | null) =>
    id ? profiles.find((p) => p.id === id)?.full_name ?? id : "—";

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data: inv } = await db
        .from("invoices")
        .select("*")
        .eq("project_id", projectId)
        .order("period_start", { ascending: false });
      const invArr = (inv as Invoice[]) ?? [];
      if (invArr.length === 0) {
        if (mounted) {
          setInvoices([]);
          setLines({});
          setLoading(false);
        }
        return;
      }
      const { data: ln } = await db
        .from("invoice_lines")
        .select("*")
        .in("invoice_id", invArr.map((i) => i.id));
      const map: Record<string, Line[]> = {};
      for (const l of (ln as Line[]) ?? []) (map[l.invoice_id] ??= []).push(l);
      if (mounted) {
        setInvoices(invArr);
        setLines(map);
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [projectId]);

  if (role !== "office") {
    return (
      <TableShell title="Client Invoice">
        <EmptyState message="Invoices are office-only." />
      </TableShell>
    );
  }

  if (loading) return <div className="p-6 text-[12px] text-muted-foreground">Loading…</div>;

  if (invoices.length === 0) {
    return (
      <TableShell title="Client Invoice">
        <EmptyState message="No invoices yet. These generate automatically on the last Monday of each month." />
      </TableShell>
    );
  }

  return (
    <TableShell title="Client Invoice">
      {invoices.map((inv) => {
        const open = openId === inv.id;
        const invLines = lines[inv.id] ?? [];
        return (
          <InvoiceCard
            key={inv.id}
            inv={inv}
            lines={invLines}
            open={open}
            onToggle={() => setOpenId(open ? null : inv.id)}
            workerName={workerName}
          />
        );
      })}
    </TableShell>
  );
}

function InvoiceCard({
  inv,
  lines,
  open,
  onToggle,
  workerName,
}: {
  inv: Invoice;
  lines: Line[];
  open: boolean;
  onToggle: () => void;
  workerName: (id: string | null) => string;
}) {
  const scope = lines.filter((l) => l.kind === "scope");
  const labour = lines.filter((l) => l.kind === "labour");
  const acc = lines.filter((l) => l.kind === "accessory");

  const scopeSubtotal = scope.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const labourSubtotal = labour.reduce((s, l) => s + (Number(l.amount) || 0), 0);

  const monthLabel = new Date(inv.period_start).toLocaleDateString("en-AU", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="border-b" style={{ borderColor: "#131418" }}>
      <button
        onClick={onToggle}
        className="w-full grid items-center px-3 py-2.5 hover:bg-white/[0.02] text-left"
        style={{ gridTemplateColumns: "24px 1fr auto auto", gap: 12 }}
      >
        <ChevronRight
          className="h-3.5 w-3.5 transition-transform text-muted-foreground"
          style={{ transform: open ? "rotate(90deg)" : "none" }}
        />
        <div>
          <div className="text-[12.5px] font-semibold">{monthLabel}</div>
          <div className="text-[10.5px] font-mono uppercase tracking-widest text-muted-foreground">
            {inv.period_start} → {inv.period_end}
          </div>
        </div>
        <span
          className="text-[9.5px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded-sm"
          style={{
            background: inv.status === "sent" ? "rgba(34,197,94,0.15)" : "rgba(186,117,23,0.15)",
            color: inv.status === "sent" ? T_GREEN : "#F0B860",
          }}
        >
          {inv.status}
        </span>
        <span className="font-mono text-[13px] tabular-nums" style={{ color: T_GREEN }}>
          {formatMoney(Number(inv.total ?? 0))}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-4" style={{ background: "#08090B" }}>
          <Section title="Scope of works">
            <div
              className="grid text-[9.5px] font-mono uppercase tracking-widest text-muted-foreground pb-1 border-b"
              style={{ gridTemplateColumns: "100px 1fr 70px 90px 110px", borderColor: "#131418" }}
            >
              <span>Code</span><span>Location</span><span className="text-right">Qty</span><span className="text-right">Rate</span><span className="text-right">Amount</span>
            </div>
            {scope.map((l) => (
              <div
                key={l.id}
                className="grid text-[12px] py-1"
                style={{ gridTemplateColumns: "100px 1fr 70px 90px 110px", color: T_GOLD }}
              >
                <span className="font-mono">{l.product_code ?? "—"}</span>
                <span className="truncate" style={{ color: "#B0B8BF" }}>{l.location ?? "—"}</span>
                <span className="text-right font-mono tabular-nums">{Number(l.qty ?? 0)}</span>
                <span className="text-right font-mono tabular-nums">{formatMoney(Number(l.rate ?? 0))}</span>
                <span className="text-right font-mono tabular-nums">{formatMoney(Number(l.amount ?? 0))}</span>
              </div>
            ))}
            <Subtotal label="Subtotal" value={scopeSubtotal} />
          </Section>

          <Section title="Labour">
            {labour.map((l) => (
              <div key={l.id} className="grid text-[12px] py-1" style={{ gridTemplateColumns: "1fr 90px 110px" }}>
                <span style={{ color: "#B0B8BF" }}>{workerName(l.worker_id)}</span>
                <span className="text-right font-mono tabular-nums" style={{ color: T_GOLD }}>{Number(l.qty ?? 0)} h</span>
                <span className="text-right font-mono tabular-nums" style={{ color: T_GOLD }}>{formatMoney(Number(l.amount ?? 0))}</span>
              </div>
            ))}
            <Subtotal label="Subtotal" value={labourSubtotal} />
          </Section>

          <Section title="Accessories used — reference only, not billed">
            <div className="text-[12px]" style={{ color: "#B0B8BF" }}>
              {acc.length === 0
                ? "—"
                : acc.map((l) => `${l.product_code} × ${Number(l.qty ?? 0)}`).join("   ·   ")}
            </div>
          </Section>

          <Section title="Invoice total">
            <div className="space-y-1 text-[12.5px] font-mono tabular-nums">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal (ex GST)</span><span>{formatMoney(Number(inv.subtotal ?? 0))}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">GST (10%)</span><span>{formatMoney(Number(inv.gst ?? 0))}</span></div>
              <div className="flex justify-between border-t pt-1 mt-1" style={{ borderColor: "#1F2224" }}>
                <span className="font-semibold">Total (inc GST)</span>
                <span style={{ color: T_GREEN }}>{formatMoney(Number(inv.total ?? 0))}</span>
              </div>
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[9.5px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Subtotal({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid text-[12px] pt-1 mt-1 border-t" style={{ gridTemplateColumns: "1fr 110px", borderColor: "#1F2224" }}>
      <span className="text-muted-foreground uppercase tracking-widest font-mono text-[10px]">{label}</span>
      <span className="text-right font-mono tabular-nums">{formatMoney(value)}</span>
    </div>
  );
}
