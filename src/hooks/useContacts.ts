import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export type CompanySummary = {
  organisation_id: string;
  company: string | null;
  contacts: number;
  replied: number;
  emailed_no_reply: number;
  never_contacted: number;
  last_emailed: string | null;
  last_replied: string | null;
};

export type ContactRow = {
  id: string;
  organisation_id: string;
  company: string | null;
  full_name: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  emails_sent: number;
  replies: number;
  last_emailed: string | null;
  last_replied: string | null;
  projects_emailed_about: string[] | null;
  engagement: "replied" | "emailed" | "known";
  from_apollo: boolean | null;
  created_at: string | null;
};

export function useCompanySummaries() {
  const [rows, setRows] = useState<CompanySummary[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await db.from("v_company_contacts_summary").select("*").limit(5000);
      if (!cancel) {
        setRows((data as CompanySummary[]) ?? []);
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);
  return { rows, loading };
}

export function useContactsByOrg(organisationId: string | null) {
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!organisationId) { setRows([]); return; }
    let cancel = false;
    setLoading(true);
    (async () => {
      const { data } = await db
        .from("v_contacts_directory")
        .select("*")
        .eq("organisation_id", organisationId)
        .limit(2000);
      if (!cancel) {
        const order = { replied: 0, emailed: 1, known: 2 } as const;
        const sorted = ((data as ContactRow[]) ?? []).slice().sort((a, b) => {
          const oa = order[a.engagement] ?? 3;
          const ob = order[b.engagement] ?? 3;
          if (oa !== ob) return oa - ob;
          return (a.full_name ?? "").localeCompare(b.full_name ?? "");
        });
        setRows(sorted);
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [organisationId]);
  return { rows, loading };
}

/** Global totals from the full unfiltered directory. */
export function useDirectoryTotals() {
  const [totals, setTotals] = useState({ total: 0, replied: 0, never: 0 });
  useEffect(() => {
    let cancel = false;
    (async () => {
      const [{ count: total }, { count: replied }, { count: never }] = await Promise.all([
        db.from("v_contacts_directory").select("id", { count: "exact", head: true }),
        db.from("v_contacts_directory").select("id", { count: "exact", head: true }).eq("engagement", "replied"),
        db.from("v_contacts_directory").select("id", { count: "exact", head: true }).eq("engagement", "known"),
      ]);
      if (!cancel) setTotals({ total: total ?? 0, replied: replied ?? 0, never: never ?? 0 });
    })();
    return () => { cancel = true; };
  }, []);
  return totals;
}

export type PeopleFilters = {
  q: string;
  engagement: "all" | "replied" | "emailed" | "known";
  source: "all" | "apollo" | "leads";
  page: number;
  pageSize: number;
};

export function usePeopleSearch(filters: PeopleFilters, enabled: boolean) {
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) { setRows([]); setTotal(0); return; }
    let cancel = false;
    setLoading(true);
    (async () => {
      let q = db.from("v_contacts_directory").select("*", { count: "exact" });
      if (filters.q.trim().length >= 2) {
        const s = filters.q.trim().replace(/[%,]/g, " ");
        // OR across name, email, company, role
        q = q.or(
          `full_name.ilike.%${s}%,email.ilike.%${s}%,company.ilike.%${s}%,role.ilike.%${s}%`
        );
      }
      if (filters.engagement !== "all") q = q.eq("engagement", filters.engagement);
      if (filters.source === "apollo") q = q.eq("from_apollo", true);
      else if (filters.source === "leads") q = q.eq("from_apollo", false);

      const from = filters.page * filters.pageSize;
      const to = from + filters.pageSize - 1;
      q = q.order("last_replied", { ascending: false, nullsFirst: false })
           .order("last_emailed", { ascending: false, nullsFirst: false })
           .range(from, to);
      const { data, count } = await q;
      if (!cancel) {
        setRows((data as ContactRow[]) ?? []);
        setTotal(count ?? 0);
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [enabled, filters.q, filters.engagement, filters.source, filters.page, filters.pageSize]);

  return { rows, total, loading };
}
