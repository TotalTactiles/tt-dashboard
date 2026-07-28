import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import SectionHeader from "@/components/dashboard/SectionHeader";
import { Button } from "@/components/ui/button";
import WorkingAsGate, { getStoredOperator, setStoredOperator } from "@/components/crm/WorkingAsGate";
import LeadQueue from "@/components/crm/LeadQueue";
import LeadBrowse from "@/components/crm/LeadBrowse";

type Tab = "queue" | "browse";

export default function CRM() {
  const [operator, setOperator] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("queue");

  useEffect(() => { setOperator(getStoredOperator()); }, []);

  if (!operator) {
    return (
      <DashboardLayout>
        <div className="p-4 md:p-8">
          <WorkingAsGate onChoose={setOperator} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
        <SectionHeader title="CRM — Lead Management">
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
            variant={tab === "queue" ? "default" : "ghost"}
            size="sm"
            className="font-mono"
            onClick={() => setTab("queue")}
          >
            Call Queue
          </Button>
          <Button
            variant={tab === "browse" ? "default" : "ghost"}
            size="sm"
            className="font-mono"
            onClick={() => setTab("browse")}
          >
            Browse
          </Button>
        </div>

        {tab === "queue" ? <LeadQueue operator={operator} /> : <LeadBrowse operator={operator} />}
      </div>
    </DashboardLayout>
  );
}
