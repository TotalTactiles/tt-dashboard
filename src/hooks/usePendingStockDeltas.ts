import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export interface PendingDeltas {
  /** product_code (uppercased by the view) -> signed net_delta pending post to the sheet */
  net: Record<string, number>;
  status: "loading" | "live" | "error";
  reload: () => void;
}

// Module-level in-flight registry so concurrent callers share one query.
let inflight: Promise<Record<string, number>> | null = null;

async function fetchPending(signal: AbortSignal): Promise<Record<string, number>> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { data, error } = await db
        .from("v_pending_stock_movements")
        .select("product_code, net_delta")
        .abortSignal(signal);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const row of (data ?? []) as Array<{ product_code: string; net_delta: number | string }>) {
        map[row.product_code] = Number(row.net_delta) || 0;
      }
      return map;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/**
 * Pending stock movements not yet posted to the master sheet. Used to close
 * the timing gap: on_hand from stock-live already reflects posted movements,
 * so `remaining = on_hand + pending_net_delta` avoids double counting at
 * either stage (pre-post: delta present, on_hand stale; post-post: delta
 * cleared, on_hand fresh).
 */
export function usePendingStockDeltas(): PendingDeltas {
  const [net, setNet] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<"loading" | "live" | "error">("loading");
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;
    setStatus((s) => (s === "live" ? "live" : "loading"));
    try {
      const map = await fetchPending(ctl.signal);
      if (ctl.signal.aborted) return;
      setNet(map);
      setStatus("live");
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  return { net, status, reload: load };
}
