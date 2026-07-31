import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import SectionHeader from "@/components/dashboard/SectionHeader";
import WorkingAsGate, { getStoredOperator, setStoredOperator } from "@/components/crm/WorkingAsGate";
import NewLeadsView from "@/components/crm/NewLeadsView";

export default function CRM() {
  const [operator, setOperator] = useState<string | null>(null);

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
        <SectionHeader title="THE OVEN - LEAD MANAGEMENT">
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

        {/* The only tab bar in the Oven lives inside NewLeadsView: New Leads | Cold Call */}
        <NewLeadsView operator={operator} />
      </div>
    </DashboardLayout>
  );
}
