import { useCallback, useEffect, useRef, useState } from "react";

const STOCK_LIVE_URL = "https://n8n.srv1437130.hstgr.cloud/webhook/stock-live";

export interface LiveStockItem {
  on_hand: number;
  threshold?: number;
  unit?: string | null;
  cost_per_unit?: number | null;
  description?: string | null;
  category?: string | null;
}

export interface LiveStockState {
  items: Record<string, LiveStockItem>;
  syncedAt: string | null;
  status: "loading" | "live" | "cached" | "error";
  reload: () => void;
}

// Module-level in-flight registry — a second caller during the same fetch
// shares the promise instead of hitting the sheet twice. Bounds damage from
// any future render loop against a webhook that reads the whole sheet.
let inflight: Promise<{ items: Record<string, LiveStockItem>; syncedAt: string | null }> | null = null;

async function fetchStockLive(signal: AbortSignal) {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch(STOCK_LIVE_URL, { signal });
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
          description: it?.description ?? null,
          category: it?.category ?? null,
        };
      }
      return { items: map, syncedAt: json?.synced_at ?? new Date().toISOString() };
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/**
 * Live on-hand stock lookup from the master sheet via n8n.
 * On failure, status flips to "error" — callers must render an amber
 * "unavailable" state rather than falling back to any cached number, since
 * the master sheet is the single source of truth for absolute quantities.
 */
export function useLiveStock(enabled = true): LiveStockState {
  const [items, setItems] = useState<Record<string, LiveStockItem>>({});
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "live" | "cached" | "error">("loading");
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    abortRef.current?.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;
    setStatus((s) => (s === "live" ? "live" : "loading"));
    try {
      const { items, syncedAt } = await fetchStockLive(ctl.signal);
      if (ctl.signal.aborted) return;
      setItems(items);
      setSyncedAt(syncedAt);
      setStatus("live");
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setStatus("error");
    }
  }, [enabled]);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  return { items, syncedAt, status, reload: load };
}

export function formatSyncedAt(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
}

export function LiveStockBadge({
  status,
  syncedAt,
}: {
  status: "loading" | "live" | "cached" | "error";
  syncedAt: string | null;
}) {
  const color =
    status === "live"
      ? "#22C55E"
      : status === "error"
      ? "#BA7517"
      : status === "cached"
      ? "#BA7517"
      : "#6B7280";
  const label =
    status === "loading"
      ? "syncing…"
      : status === "live"
      ? `live · synced ${formatSyncedAt(syncedAt)}`
      : status === "error"
      ? "on-hand unavailable"
      : "cached";
  return (
    <span
      className="text-[9.5px] font-mono uppercase tracking-widest"
      style={{ color }}
    >
      <span
        style={{
          display: "inline-block",
          width: 6,
          height: 6,
          borderRadius: 999,
          background: color,
          marginRight: 6,
          verticalAlign: "middle",
        }}
      />
      {label}
    </span>
  );
}
