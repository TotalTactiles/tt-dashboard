import { useEffect, useState } from "react";

// Paste the PRODUCTION webhook URL from the n8n "TT CRM Stages - Quoting Opp v1" workflow here:
const CRM_STAGES_WEBHOOK_URL = "https://n8n.srv1437130.hstgr.cloud/webhook/tt-crm-stages";

export interface QuotingOpp { count: number; value: number; }
export interface CrmStages { quotingOpp: QuotingOpp | null; }

export function useCrmStages(): CrmStages {
  const [data, setData] = useState<CrmStages>({ quotingOpp: null });
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        if (!CRM_STAGES_WEBHOOK_URL) return;
        const res = await fetch(CRM_STAGES_WEBHOOK_URL);
        if (!res.ok) return;
        const json = await res.json();
        const qo = json?.crmStages?.quotingOpp;
        if (alive && qo && typeof qo.count === "number") {
          setData({ quotingOpp: { count: qo.count, value: Number(qo.value) || 0 } });
        }
      } catch { /* swallow — card shows "—" */ }
    };
    load();
    const id = setInterval(load, 5 * 60 * 1000); // refresh every 5 min, matches dashboard cadence
    return () => { alive = false; clearInterval(id); };
  }, []);
  return data;
}
