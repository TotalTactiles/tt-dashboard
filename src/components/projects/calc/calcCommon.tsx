import { type ReactNode } from "react";

export const CALC_TABLE_LABEL: Record<string, string> = {
  stock_planning: "Stock Planning",
  order_stock: "Order Stock",
  scope: "Scope Breakdown",
  accessories: "Accessories Used",
  reconciliation: "Stock Reconciliation",
};

export function CalcShell({
  title,
  right,
  children,
  empty,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  empty?: boolean;
}) {
  return (
    <div
      className="rounded-md border overflow-hidden"
      style={{ borderColor: "#1F2224", background: "#0A0A0A" }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: "#1F2224", background: "#0F1113" }}
      >
        <span className="text-[10.5px] font-mono uppercase tracking-widest text-muted-foreground">
          {title}
        </span>
        <div className="flex items-center gap-1">{right}</div>
      </div>
      {empty ? (
        <div className="p-6 text-[12px] text-muted-foreground text-center">No rows yet.</div>
      ) : (
        children
      )}
    </div>
  );
}

export function CalcRowHeader({ cols }: { cols: { label: string; w?: string; align?: "left" | "right" | "center" }[] }) {
  return (
    <div
      className="grid text-[9.5px] font-mono uppercase tracking-widest text-muted-foreground border-b"
      style={{
        gridTemplateColumns: cols.map((c) => c.w ?? "1fr").join(" "),
        background: "#0F1113",
        borderColor: "#1F2224",
        height: 30,
      }}
    >
      {cols.map((c, i) => (
        <div
          key={i}
          className="flex items-center px-2"
          style={{ justifyContent: c.align === "right" ? "flex-end" : c.align === "center" ? "center" : "flex-start" }}
        >
          {c.label}
        </div>
      ))}
    </div>
  );
}

export function NumCell({
  value,
  onChange,
  readOnly,
  align = "right",
  suffix,
  placeholder = "0",
}: {
  value: number | null | undefined;
  onChange?: (n: number | null) => void;
  readOnly?: boolean;
  align?: "left" | "right";
  suffix?: string;
  placeholder?: string;
}) {
  if (readOnly || !onChange) {
    return (
      <span
        className="font-mono text-[12px] tabular-nums"
        style={{ color: value == null ? "#4B5058" : "#E5E9EA" }}
      >
        {value == null ? "—" : formatNum(value)}
        {suffix ? <span className="text-muted-foreground/60 ml-1">{suffix}</span> : null}
      </span>
    );
  }
  return (
    <input
      type="number"
      step="any"
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => {
        const raw = e.target.value;
        onChange(raw === "" ? null : Number(raw));
      }}
      className="w-full h-7 px-2 rounded-sm bg-black/30 border font-mono text-[12px] tabular-nums outline-none focus:border-primary/50"
      style={{ borderColor: "#1F2224", textAlign: align }}
    />
  );
}

export function TextCell({
  value,
  onChange,
  readOnly,
  placeholder,
}: {
  value: string | null | undefined;
  onChange?: (v: string | null) => void;
  readOnly?: boolean;
  placeholder?: string;
}) {
  if (readOnly || !onChange) {
    return (
      <span className="text-[12.5px] truncate" style={{ color: value ? "#E5E9EA" : "#4B5058" }}>
        {value || "—"}
      </span>
    );
  }
  return (
    <input
      type="text"
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value || null)}
      className="w-full h-7 px-2 rounded-sm bg-black/30 border text-[12.5px] outline-none focus:border-primary/50"
      style={{ borderColor: "#1F2224" }}
    />
  );
}

export function formatNum(n: number) {
  if (!isFinite(n)) return "—";
  const abs = Math.abs(n);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return n.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

export function evalFormula(input: string | null | undefined): number | null {
  if (!input) return null;
  const raw = String(input).trim().replace(/^=/, "");
  if (!raw) return null;
  // Only allow digits, operators, parens, decimal, whitespace.
  if (!/^[0-9+\-*/().\s]+$/.test(raw)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const v = Function(`"use strict"; return (${raw});`)();
    return typeof v === "number" && isFinite(v) ? v : null;
  } catch {
    return null;
  }
}
