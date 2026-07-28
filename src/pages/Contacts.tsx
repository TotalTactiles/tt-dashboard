import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import SectionHeader from "@/components/dashboard/SectionHeader";
import { Button } from "@/components/ui/button";
import CompanyList from "@/components/contacts/CompanyList";
import PersonSearch from "@/components/contacts/PersonSearch";
import { useDirectoryTotals } from "@/hooks/useContacts";

type Tab = "company" | "people";

export default function Contacts() {
  const [tab, setTab] = useState<Tab>("company");
  const totals = useDirectoryTotals();

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
        <SectionHeader title="CONTACTS — DIRECTORY" />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <SummaryCard label="Total contacts" value={totals.total} />
          <SummaryCard label="Replied" value={totals.replied} />
          <SummaryCard label="Never contacted" value={totals.never} />
        </div>

        <div className="inline-flex rounded-md border border-border bg-muted/30 p-1">
          <Button
            variant={tab === "company" ? "default" : "ghost"}
            size="sm"
            className="font-mono"
            onClick={() => setTab("company")}
          >
            By Company
          </Button>
          <Button
            variant={tab === "people" ? "default" : "ghost"}
            size="sm"
            className="font-mono"
            onClick={() => setTab("people")}
          >
            Search People
          </Button>
        </div>

        {tab === "company" ? <CompanyList /> : <PersonSearch />}
      </div>
    </DashboardLayout>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat-card">
      <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold font-mono tabular-nums mt-1">{value.toLocaleString()}</p>
    </div>
  );
}
