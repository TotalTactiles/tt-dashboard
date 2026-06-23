import { useState, useEffect, useCallback } from "react";

const CACHE_WEBHOOK = "https://n8n.srv1437130.hstgr.cloud/webhook/dashboard-cache";
const KEY = "tt_revenue_target";

export function useRevenueTarget() {
  const [target, setTargetState] = useState<number>(() => {
    const ls = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
    const n = ls ? Number(ls) : 0;
    return isNaN(n) ? 0 : n;
  });

  // Load server value on mount (cache wins over localStorage)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(CACHE_WEBHOOK);
        const rows = await res.json();
        const row = Array.isArray(rows) ? rows.find((r: any) => r.key === KEY) : null;
        if (alive && row && row.value !== "" && row.value != null) {
          const n = Number(row.value);
          if (!isNaN(n)) setTargetState(n);
        }
      } catch {
        /* keep localStorage value */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const setTarget = useCallback((n: number) => {
    const v = isNaN(n) ? 0 : Math.max(0, n);
    setTargetState(v);
    try {
      localStorage.setItem(KEY, String(v));
    } catch {}
    fetch(CACHE_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: KEY, value: String(v) }),
    }).catch(() => {});
  }, []);

  return { target, setTarget };
}
