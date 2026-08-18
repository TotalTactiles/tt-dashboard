import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import SectionHeader from "@/components/dashboard/SectionHeader";
import WorkingAsGate, { getStoredOperator, setStoredOperator, useOperators } from "@/components/crm/WorkingAsGate";
import NewLeadsView from "@/components/crm/NewLeadsView";
import TestLaneControls from "@/components/crm/TestLaneControls";
import type { OvenTab } from "@/components/crm/OvenTabs";

export default function CRM() {
  const [operator, setOperator] = useState<string | null>(null);
  const [tab, setTab] = useState<OvenTab>("new");
  const [resetNonce, setResetNonce] = useState(0);

  useEffect(() => { setOperator(getStoredOperator()); }, []);

  const { operators } = useOperators();
  const operatorLabel = operators.find((o) => o.handle === operator)?.display_name || operator;

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
        <SectionHeader title="LEAD GENERATION">
          <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
            <span>Working as <span className="text-foreground font-semibold">{operatorLabel}</span></span>
            <button
              className="text-primary hover:underline"
              onClick={() => { setStoredOperator(null); setOperator(null); }}
            >
              switch
            </button>
          </div>
        </SectionHeader>

        {tab === "test" && (
          <TestLaneControls onResetComplete={() => setResetNonce((n) => n + 1)} />
        )}

        {/* The only tab bar in Lead Generation lives inside NewLeadsView: New Leads | Cold Call | Test */}
        <NewLeadsView operator={operator} tab={tab} onTabChange={setTab} resetNonce={resetNonce} />
      </div>
    </DashboardLayout>
  );
}

