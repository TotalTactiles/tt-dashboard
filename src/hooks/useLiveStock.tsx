import { useCallback, useEffect, useState } from "react";

const STOCK_LIVE_URL = "https://n8n.srv1437130.hstgr.cloud/webhook/stock-live";

export interface LiveStockItem {
  on_hand: number;
  threshold?: number;
  unit?: string | null;
  cost_per_unit?: number | null;
}

export interface LiveStockState {
  items: Record<string, LiveStockItem>;
  syncedAt: string | null;
  status: "loading" | "live" | "cached";
  reload: () => void;
}

/**
 * Live on-hand stock lookup from the master sheet via n8n.
 * On failure, status flips to "cached" — callers fall back to their local values.
 */
export function useLiveStock(enabled = true): LiveStockState {
  const [items, setItems] = useState<Record<string, LiveStockItem>>({});
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "live" | "cached">("loading");

  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await fetch(STOCK_LIVE_URL);
      if (!res.ok) throw new Error(`stock-live ${res.status}`);
      const json = await res.json();
      const raw = json?.items ?? {};
      const map: Record<string, LiveStockItem> = {};
      for (const [k, v] of Object.entries(raw)) {
        const it = v as any;
        map[k] = {
          on_hand: Number(it?.on_hand) || 0,
          threshold: it?.threshold != null ? Number(it.threshold) : undefined,
          unit: it?.unit ?? null,
          cost_per_unit: it?.cost_per_unit != null ? Number(it.cost_per_unit) : null,
        };
      }
      setItems(map);
      setSyncedAt(json?.synced_at ?? new Date().toISOString());
      setStatus("live");
    } catch {
      setStatus("cached");
    }
  }, [enabled]);

  useEffect(() => {
    load();
  }, [load]);

  return { items, syncedAt, status, reload: load };
}

export function formatSyncedAt(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
}

export function LiveStockBadge({ status, syncedAt }: { status: "loading" | "live" | "cached"; syncedAt: string | null }) {
  const color = status === "live" ? "#22C55E" : status === "cached" ? "#BA7517" : "#6B7280";
  const label =
    status === "loading"
      ? "syncing…"
      : status === "live"
      ? `live · synced ${formatSyncedAt(syncedAt)}`
      : "cached";
  return (
    <span
      className="text-[9.5px] font-mono uppercase tracking-widest"
      style={{ color }}
    >
      <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: 999, background: color, marginRight: 6, verticalAlign: "middle" }} />
      {label}
    </span>
  );
}
