import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const WEBHOOK_URL = "https://n8n.srv1437130.hstgr.cloud/webhook/tt-project-kpis";

const ZohoProjectsSetupGuide = () => {
  const [open, setOpen] = useState(false);

  const copyUrl = () => {
    navigator.clipboard.writeText(WEBHOOK_URL);
    toast.success("Webhook URL copied to clipboard");
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border hover:bg-secondary/80 transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-base">📋</span>
          <span className="text-sm font-medium">Zoho Projects n8n Setup Guide</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 p-4 rounded-lg bg-secondary/30 border border-border text-xs space-y-4 font-mono">

        {/* Webhook URL block */}
        <div className="p-3 rounded-lg bg-accent/30 border border-border">
          <p className="font-semibold text-foreground mb-1">Webhook URL</p>
          <div className="flex items-center gap-2">
            <code className="bg-background/60 px-2 py-1 rounded text-[11px] text-chart-blue break-all flex-1">{WEBHOOK_URL}</code>
            <button onClick={copyUrl} className="text-[10px] text-chart-blue underline whitespace-nowrap hover:text-chart-blue/80">Copy</button>
          </div>
        </div>

        <div>
          <p className="font-semibold text-foreground mb-1">Step 1: The n8n workflow is already configured</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>The Zoho Projects KPI workflow is live at the URL above</li>
            <li>It connects to Zoho Projects portal (ID: <code className="bg-background/60 px-1 rounded">7004927552</code> — totaltactilesprojects)</li>
            <li>Fetches milestones and tasks from all 12 active projects, joins with the Revenue Google Sheet</li>
            <li>Calculates 5 KPIs: <strong>On-Time Delivery, Schedule Slippage, Margin Variance, Labour Efficiency, and Cost Overrun</strong> (stubbed — pending OAuth scope)</li>
          </ul>
        </div>

        <div>
          <p className="font-semibold text-foreground mb-1">Step 2: If you need to reconfigure</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>Open n8n at <code className="bg-background/60 px-1 rounded">https://n8n.srv1437130.hstgr.cloud</code></li>
            <li>Find the workflow <strong>"TT Project KPIs v2.4"</strong></li>
            <li>Credential required: <strong>"Zoho Project Calendar"</strong> OAuth2 credential</li>
            <li>Copy the Production webhook URL and paste it into the field above</li>
          </ul>
        </div>

        <div>
          <p className="font-semibold text-foreground mb-1">Step 3: OAuth scope requirement for Cost Overrun KPI</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>To unlock the Cost Overrun KPI, add <code className="bg-background/60 px-1 rounded text-chart-orange">ZohoProjects.timesheets.READ</code> to the Zoho Projects OAuth credential in n8n and reconnect</li>
          </ul>
        </div>

        <div>
          <p className="font-semibold text-foreground mb-1">Step 4: Verify data is flowing</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>Click <strong>Sync Now</strong> — the Data Debug section will show: Projects: 12, Milestones: 26, Tasks: 176</li>
            <li>Margin Variance should show: Actual GP ~47.1%, Target 47%</li>
            <li>Schedule Slippage should show overdue milestone list</li>
          </ul>
        </div>

        <div className="p-2 rounded bg-accent/50 border border-border">
          <p className="text-accent-foreground text-[11px]">
            ✅ The webhook URL is pre-populated above. Data auto-syncs every 5 minutes.
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default ZohoProjectsSetupGuide;
