import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import SectionHeader from "@/components/dashboard/SectionHeader";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import WorkingAsGate, { getStoredOperator, setStoredOperator } from "@/components/crm/WorkingAsGate";
import LeadQueue from "@/components/crm/LeadQueue";
import LeadBrowse from "@/components/crm/LeadBrowse";
import NewLeadsView from "@/components/crm/NewLeadsView";

const db = supabase as any;

type Tab = "new" | "queue" | "browse";

export default function CRM() {
  const [operator, setOperator] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab | null>(null);

  useEffect(() => { setOperator(getStoredOperator()); }, []);

  // Choose the default tab: New Leads when it has any rows, otherwise Call Queue.
  useEffect(() => {
    if (!operator || tab) return;
    let cancel = false;
    db.from("leads")
      .select("id", { count: "exact", head: true })
      .in("stage", ["new", "enriching"])
      .then((r: any) => { if (!cancel) setTab((r.count ?? 0) > 0 ? "new" : "queue"); });
    return () => { cancel = true; };
  }, [operator, tab]);

  if (!operator) {
    return (
      <DashboardLayout>
        <div className="p-4 md:p-8">
          <WorkingAsGate onChoose={setOperator} />
        </div>
      </DashboardLayout>
    );
  }

  const activeTab: Tab = tab ?? "queue";

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
        <SectionHeader title="THE OVEN — LEAD MANAGEMENT">
          <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
            <span>Working as <span className="text-foreground font-semibold">{operator}</span></span>
            <button
              className="text-primary hover:underline"
              onClick={() => { setStoredOperator(null); setOperator(null); }}
            >
              switch
            </button>
          </div>
        </SectionHeader>

        <div className="inline-flex rounded-md border border-border bg-muted/30 p-1">
          <Button
            variant={activeTab === "new" ? "default" : "ghost"}
            size="sm"
            className="font-mono"
            onClick={() => setTab("new")}
          >
            New Leads
          </Button>
          <Button
            variant={activeTab === "queue" ? "default" : "ghost"}
            size="sm"
            className="font-mono"
            onClick={() => setTab("queue")}
          >
            Call Queue
          </Button>
          <Button
            variant={activeTab === "browse" ? "default" : "ghost"}
            size="sm"
            className="font-mono"
            onClick={() => setTab("browse")}
          >
            Browse
          </Button>
        </div>

        {activeTab === "new" && <NewLeadsView operator={operator} />}
        {activeTab === "queue" && <LeadQueue operator={operator} />}
        {activeTab === "browse" && <LeadBrowse operator={operator} />}
      </div>
    </DashboardLayout>
  );
}
