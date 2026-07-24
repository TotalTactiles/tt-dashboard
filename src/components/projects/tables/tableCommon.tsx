import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/* ---------------- constants ---------------- */
export const T_GOLD = "#C0A85E";
export const T_GOLD_FILL = "rgba(192,168,94,0.05)";
export const T_BLUE = "#3D89DA";
export const T_INPUT_BORDER = "#3A3A42";
export const T_TOTAL_BG = "#1D1D22";
export const T_RED = "#E24B4A";
export const T_GREEN = "#22C55E";
export const T_AMBER = "#BA7517";

/* ---------------- shell ---------------- */

export function TableShell({
  title,
  right,
  children,
  hint,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
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
      {children}
      {hint && (
        <div
          className="px-3 py-2 text-[10.5px] text-muted-foreground border-t"
          style={{ borderColor: "#1F2224", background: "#0B0C0F" }}
        >
          {hint}
        </div>
      )}
      <Legend />
    </div>
  );
}

export function Legend() {
  return (
    <div
      className="px-3 py-1.5 text-[9.5px] font-mono uppercase tracking-widest border-t flex items-center gap-4"
      style={{ borderColor: "#1F2224", background: "#0A0A0A", color: "#6B7280" }}
    >
      <span>
        <span style={{ color: T_BLUE }}>ƒ</span> calculated here
      </span>
      <span>
        <span style={{ color: "#E5E9EA" }}>▭</span> you enter
      </span>
      <span>
        <span style={{ color: T_GOLD }}>■</span> from another system
      </span>
    </div>
  );
}

export function HeaderRow({
  cols,
  gridTemplate,
}: {
  cols: { label: string; align?: "left" | "right" | "center" }[];
  gridTemplate: string;
}) {
  return (
    <div
      className="grid text-[9.5px] font-mono uppercase tracking-widest text-muted-foreground border-b"
      style={{
        gridTemplateColumns: gridTemplate,
        background: "#0F1113",
        borderColor: "#1F2224",
        height: 30,
      }}
    >
      {cols.map((c, i) => (
        <div
          key={i}
          className="flex items-center px-2"
          style={{
            justifyContent:
              c.align === "right" ? "flex-end" : c.align === "center" ? "center" : "flex-start",
          }}
        >
          {c.label}
        </div>
      ))}
    </div>
  );
}

export function TotalsRow({
  cells,
  gridTemplate,
}: {
  cells: ReactNode[];
  gridTemplate: string;
}) {
  return (
    <div
      className="grid items-center border-t"
      style={{
        gridTemplateColumns: gridTemplate,
        height: 36,
        borderColor: "#1F2224",
        background: T_TOTAL_BG,
      }}
    >
      {cells.map((c, i) => (
        <div key={i} className="px-2 flex items-center" style={{ justifyContent: i === 0 ? "flex-start" : "flex-end" }}>
          {c}
        </div>
      ))}
    </div>
  );
}

/* ---------------- cell types ---------------- */

export function ExtCell({
  value,
  numeric,
  align = "left",
}: {
  value: string | number | null | undefined;
  numeric?: boolean;
  align?: "left" | "right" | "center";
}) {
  const display =
    value === null || value === undefined || value === ""
      ? "—"
      : numeric
      ? formatNum(Number(value))
      : String(value);
  return (
    <div
      className={numeric ? "font-mono text-[12px] tabular-nums truncate" : "text-[12.5px] truncate"}
      style={{
        color: T_GOLD,
        textAlign: align,
        width: "100%",
      }}
      title={typeof value === "string" ? value : undefined}
    >
      {display}
    </div>
  );
}

export function CalcCell({
  value,
  align = "right",
  color,
  formatter = formatNum,
}: {
  value: number | null | undefined;
  align?: "left" | "right" | "center";
  color?: string;
  formatter?: (n: number) => string;
}) {
  return (
    <div className="relative w-full">
      <span
        className="absolute -top-1 right-0 text-[8px] font-mono pointer-events-none"
        style={{ color: T_BLUE, opacity: 0.75 }}
      >
        ƒ
      </span>
      <div
        className="font-mono text-[12px] tabular-nums"
        style={{ color: color ?? T_BLUE, textAlign: align }}
      >
        {value === null || value === undefined || !isFinite(Number(value))
          ? "—"
          : formatter(Number(value))}
      </div>
    </div>
  );
}

/**
 * NumInput — controlled locally, debounced save, focus-safe.
 */
export function NumInput({
  value,
  onSave,
  readOnly,
  required,
  align = "right",
  placeholder = "0",
  invalid,
  debounceMs = 600,
}: {
  value: number | null | undefined;
  onSave: (n: number | null) => void | Promise<void>;
  readOnly?: boolean;
  required?: boolean;
  align?: "left" | "right";
  placeholder?: string;
  invalid?: boolean;
  debounceMs?: number;
}) {
  const [local, setLocal] = useState<string>(value == null ? "" : String(value));
  const timer = useRef<number | null>(null);
  const lastSaved = useRef<string>(local);

  // Sync when external value changes and user isn't mid-edit for a different value
  useEffect(() => {
    const asStr = value == null ? "" : String(value);
    if (asStr !== lastSaved.current) {
      lastSaved.current = asStr;
      setLocal(asStr);
    }
  }, [value]);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  if (readOnly) {
    return (
      <span
        className="font-mono text-[12px] tabular-nums"
        style={{ color: value == null ? "#4B5058" : "#E5E9EA", width: "100%", textAlign: align, display: "block" }}
      >
        {value == null ? "—" : formatNum(Number(value))}
      </span>
    );
  }

  const empty = local === "";
  const showGold = required && empty;
  const borderColor = invalid ? T_RED : showGold ? T_GOLD : T_INPUT_BORDER;
  const bg = invalid ? "rgba(226,75,74,0.06)" : showGold ? T_GOLD_FILL : "rgba(0,0,0,0.35)";

  return (
    <input
      type="text"
      inputMode="decimal"
      value={local}
      placeholder={placeholder}
      onChange={(e) => {
        const v = e.target.value;
        setLocal(v);
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
          if (v === "") {
            lastSaved.current = "";
            onSave(null);
          } else {
            const n = Number(v);
            if (!isNaN(n)) {
              lastSaved.current = String(n);
              onSave(n);
            }
          }
        }, debounceMs);
      }}
      onBlur={() => {
        if (timer.current) {
          window.clearTimeout(timer.current);
          timer.current = null;
          if (local === "") {
            lastSaved.current = "";
            onSave(null);
          } else {
            const n = Number(local);
            if (!isNaN(n)) {
              lastSaved.current = String(n);
              onSave(n);
            }
          }
        }
      }}
      className="w-full h-7 px-2 rounded-sm font-mono text-[12px] tabular-nums outline-none focus:shadow-[0_0_0_2px_rgba(61,137,218,0.35)] focus:border-[#3D89DA]"
      style={{
        background: bg,
        border: `1px solid ${borderColor}`,
        color: invalid ? T_RED : "#E5E9EA",
        textAlign: align,
      }}
    />
  );
}

export function TextInput({
  value,
  onSave,
  readOnly,
  required,
  placeholder,
  debounceMs = 600,
}: {
  value: string | null | undefined;
  onSave: (v: string | null) => void | Promise<void>;
  readOnly?: boolean;
  required?: boolean;
  placeholder?: string;
  debounceMs?: number;
}) {
  const [local, setLocal] = useState<string>(value ?? "");
  const timer = useRef<number | null>(null);
  const lastSaved = useRef<string>(local);

  useEffect(() => {
    const asStr = value ?? "";
    if (asStr !== lastSaved.current) {
      lastSaved.current = asStr;
      setLocal(asStr);
    }
  }, [value]);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  if (readOnly) {
    return (
      <span className="text-[12.5px] truncate" style={{ color: value ? "#E5E9EA" : "#4B5058" }}>
        {value || "—"}
      </span>
    );
  }

  const empty = local === "";
  const showGold = required && empty;
  const borderColor = showGold ? T_GOLD : T_INPUT_BORDER;
  const bg = showGold ? T_GOLD_FILL : "rgba(0,0,0,0.35)";

  return (
    <input
      type="text"
      value={local}
      placeholder={placeholder}
      onChange={(e) => {
        const v = e.target.value;
        setLocal(v);
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
          lastSaved.current = v;
          onSave(v === "" ? null : v);
        }, debounceMs);
      }}
      onBlur={() => {
        if (timer.current) {
          window.clearTimeout(timer.current);
          timer.current = null;
          lastSaved.current = local;
          onSave(local === "" ? null : local);
        }
      }}
      className="w-full h-7 px-2 rounded-sm text-[12.5px] outline-none focus:shadow-[0_0_0_2px_rgba(61,137,218,0.35)] focus:border-[#3D89DA]"
      style={{
        background: bg,
        border: `1px solid ${borderColor}`,
        color: "#E5E9EA",
      }}
    />
  );
}

/* ---------------- utils ---------------- */

export function formatNum(n: number) {
  if (!isFinite(n)) return "—";
  const abs = Math.abs(n);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return n.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

export function formatMoney(n: number) {
  if (!isFinite(n)) return "—";
  return "$" + n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="p-8 text-center text-[12px] text-muted-foreground italic" style={{ background: "#0A0A0A" }}>
      {message}
    </div>
  );
}

/**
 * Debounced saver util for parent-owned tables.
 */
export function useDebouncedSaver(fn: () => Promise<void> | void, delay = 600) {
  const timer = useRef<number | null>(null);
  return useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      fn();
    }, delay);
  }, [fn, delay]);
}
