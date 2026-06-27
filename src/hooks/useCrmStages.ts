import { useEffect, useState } from "react";

// Paste the PRODUCTION webhook URL from the n8n "TT CRM Stages - Quoting Opp v1" workflow here:
const CRM_STAGES_WEBHOOK_URL = "https://n8n.srv1437130.hstgr.cloud/webhook/tt-crm-stages";

export interface QuotingOppLead {
  company: string;
  name: string;
  value: number;
  stage: string;
  date: string;
}
export interface QuotingOpp { count: number; value: number; leads: QuotingOppLead[]; }
export interface CrmStages { quotingOpp: QuotingOpp | null; totalLeads: number; }

export function useCrmStages(): CrmStages {
  const [data, setData] = useState<CrmStages>({ quotingOpp: null, totalLeads: 0 });
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        if (!CRM_STAGES_WEBHOOK_URL) return;
        const res = await fetch(CRM_STAGES_WEBHOOK_URL);
        if (!res.ok) return;
        const json = await res.json();
        const qo = json?.crmStages?.quotingOpp;
        const totalLeads = Number(json?.crmStages?.totalLeads) || 0;
        if (alive) {
          if (qo && typeof qo.count === "number") {
            const leads: QuotingOppLead[] = Array.isArray(qo.leads)
              ? qo.leads.map((l: any) => ({
                  company: String(l.company ?? l.Company ?? "").trim(),
                  name: String(l.name ?? l.Deal_Name ?? l.Full_Name ?? l.Last_Name ?? "").trim(),
                  value: Number(l.value ?? l.Contract_Value ?? l.Amount ?? 0) || 0,
                  stage: String(l.stage ?? l.Stage ?? l.Lead_Status ?? "Quoting").trim(),
                  date: String(l.date ?? l.Closing_Date ?? l.Estimated_Job_Date ?? "").trim(),
                }))
              : [];
            setData({
              quotingOpp: { count: qo.count, value: Number(qo.value) || 0, leads },
              totalLeads,
            });
          } else {
            setData({ quotingOpp: null, totalLeads });
          }
        }
      } catch { /* swallow — card shows "—" */ }
    };
    load();
    const id = setInterval(load, 5 * 60 * 1000); // refresh every 5 min, matches dashboard cadence
    return () => { alive = false; clearInterval(id); };
  }, []);
  return data;
}
