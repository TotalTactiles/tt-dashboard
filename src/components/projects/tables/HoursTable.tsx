import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  TableShell,
  HeaderRow,
  TotalsRow,
  ExtCell,
  EmptyState,
  formatNum,
} from "./tableCommon";
import { useProfiles } from "@/hooks/useProfiles";

const db = supabase as any;

interface Row {
  id: string;
  project_id: string;
  user_id: string;
  work_date: string;
  hours: number;
  billable: boolean;
}

const GRID = "120px 1fr 100px 100px";

export function HoursTable({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const profiles = useProfiles(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data } = await db
        .from("time_entries")
        .select("id, project_id, user_id, work_date, hours, billable")
        .eq("project_id", projectId)
        .order("work_date", { ascending: false });
      if (mounted) {
        setRows((data as Row[]) ?? []);
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [projectId]);

  const byId = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of profiles) m.set(p.id, p.full_name);
    return m;
  }, [profiles]);

  const totals = useMemo(() => {
    let h = 0, bh = 0;
    for (const r of rows) {
      h += Number(r.hours) || 0;
      if (r.billable) bh += Number(r.hours) || 0;
    }
    return { h, bh };
  }, [rows]);

  if (loading) return <div className="p-6 text-[12px] text-muted-foreground">Loading…</div>;

  return (
    <TableShell
      hint="Hours only. Rates live in the Employee Centre and are read at invoice time."
      showLegend={false}
    >
      <HeaderRow
        gridTemplate={GRID}
        cols={[
          { label: "Date" },
          { label: "Worker" },
          { label: "Hours", align: "right" },
          { label: "Billable", align: "right" },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState message="No hours logged against this project yet." />
      ) : (
        <>
          {rows.map((r) => (
            <div
              key={r.id}
              className="grid items-center border-b"
              style={{ gridTemplateColumns: GRID, height: 40, borderColor: "#131418" }}
            >
              <div className="px-2"><ExtCell value={r.work_date} /></div>
              <div className="px-2 min-w-0"><ExtCell value={byId.get(r.user_id) ?? r.user_id} /></div>
              <div className="px-2 flex justify-end"><ExtCell value={r.hours} numeric align="right" /></div>
              <div className="px-2 flex justify-end"><ExtCell value={r.billable ? "Yes" : "No"} align="right" /></div>
            </div>
          ))}
          <TotalsRow
            gridTemplate={GRID}
            cells={[
              <span className="text-[10.5px] font-mono uppercase tracking-widest text-muted-foreground">Totals</span>,
              <span />,
              <span className="font-mono text-[12px] tabular-nums" style={{ color: "#C0A85E" }}>{formatNum(totals.h)} h</span>,
              <span className="font-mono text-[12px] tabular-nums" style={{ color: "#C0A85E" }}>{formatNum(totals.bh)} h</span>,
            ]}
          />
        </>
      )}
    </TableShell>
  );
}
