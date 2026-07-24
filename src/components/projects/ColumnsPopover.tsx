import { useEffect, useRef, useState } from "react";
import { Columns3, GripVertical, Check, Lock } from "lucide-react";
import {
  ALL_COLUMN_KEYS,
  COLUMN_DEFS,
  type ColumnKey,
} from "./columns";

interface Props {
  columns: ColumnKey[];
  onChange: (next: ColumnKey[]) => void;
}

export function ColumnsPopover({ columns, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [dragKey, setDragKey] = useState<ColumnKey | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  // Full ordered list: on-columns first (in their order), then off-columns.
  const offCols = ALL_COLUMN_KEYS.filter((k) => !columns.includes(k));
  const ordered: ColumnKey[] = [...columns, ...offCols];

  const toggle = (k: ColumnKey) => {
    if (COLUMN_DEFS[k].locked) return;
    if (columns.includes(k)) {
      onChange(columns.filter((c) => c !== k));
    } else {
      onChange([...columns, k]);
    }
  };

  const handleDrop = (target: ColumnKey) => {
    if (!dragKey || dragKey === target) return;
    if (COLUMN_DEFS[dragKey].locked) return;
    if (target === "name") return; // can't drop before name
    // reorder only within visible columns
    if (!columns.includes(dragKey)) {
      // if hidden, adding + placing
      const next = [...columns];
      const targetIdx = next.indexOf(target);
      next.splice(targetIdx, 0, dragKey);
      onChange(next);
      setDragKey(null);
      return;
    }
    const next = columns.filter((c) => c !== dragKey);
    const targetIdx = next.indexOf(target);
    if (targetIdx < 0) {
      onChange([...next, dragKey]);
    } else {
      next.splice(targetIdx, 0, dragKey);
      onChange(next);
    }
    setDragKey(null);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="h-7 px-2 rounded-md inline-flex items-center gap-1.5 text-[10.5px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
      >
        <Columns3 className="h-3 w-3" />
        Columns
      </button>
      {open && (
        <div
          className="absolute z-50 mt-1 left-0 rounded-md border p-1 min-w-[220px] shadow-xl"
          style={{ background: "#0A0A0A", borderColor: "#1F2224" }}
        >
          <div className="px-2 py-1.5 text-[9.5px] font-mono uppercase tracking-widest text-muted-foreground">
            Columns
          </div>
          {ordered.map((k) => {
            const def = COLUMN_DEFS[k];
            const on = columns.includes(k);
            const locked = !!def.locked;
            return (
              <div
                key={k}
                draggable={!locked}
                onDragStart={() => setDragKey(k)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(k)}
                onDragEnd={() => setDragKey(null)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-white/[0.04] group"
                style={{ opacity: dragKey === k ? 0.5 : 1 }}
              >
                <GripVertical
                  className="h-3 w-3 text-muted-foreground/40"
                  style={{ visibility: locked ? "hidden" : "visible", cursor: locked ? "default" : "grab" }}
                />
                <button
                  onClick={() => toggle(k)}
                  disabled={locked}
                  className="h-4 w-4 rounded-[3px] border flex items-center justify-center transition-colors"
                  style={{
                    borderColor: on ? "#3D89DA" : "#3A3A42",
                    background: on ? "#3D89DA" : "transparent",
                    cursor: locked ? "not-allowed" : "pointer",
                  }}
                >
                  {on && (
                    <Check className="h-2.5 w-2.5" style={{ color: "#0A0A0A" }} strokeWidth={3} />
                  )}
                </button>
                <span className="text-[11.5px] flex-1">{def.label}</span>
                {locked && <Lock className="h-2.5 w-2.5 text-muted-foreground/50" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
