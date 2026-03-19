import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const WEBHOOK_URL = "https://n8n.srv1437130.hstgr.cloud/webhook/bb826393-569e-4270-a033-6f6d8019e0e0";

const GoogleSheetsSetupGuide = () => {
  const [open, setOpen] = useState(false);

  const copyUrl = () => {
    navigator.clipboard.writeText(WEBHOOK_URL);
    toast.success("Webhook URL copied to clipboard");
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border hover:bg-secondary/80 transition-colors">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-chart-green" />
          <span className="text-sm font-medium">Google Sheets n8n Setup Guide</span>
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
            <li>The Google Sheets workflow is live at the URL above</li>
            <li>It reads 7 Google Sheets tabs (<strong>Quotes, Cashflow, Revenue, Expenses, Labour, Stock, qtsSmmry</strong>) and returns merged data to the dashboard</li>
            <li>It auto-polls every 5 minutes</li>
          </ul>
        </div>

        <div>
          <p className="font-semibold text-foreground mb-1">Step 2: If you need to reconfigure</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>Open n8n at <code className="bg-background/60 px-1 rounded">https://n8n.srv1437130.hstgr.cloud</code></li>
            <li>Find the workflow <strong>"Dashboard - Google Sheets"</strong></li>
            <li>The webhook is pre-configured — copy the Production URL</li>
            <li>Paste it into the n8n Webhook URL field above and click Save & Test</li>
          </ul>
        </div>

        <div>
          <p className="font-semibold text-foreground mb-1">Step 3: Google Sheets document</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>Document ID: <code className="bg-background/60 px-1 rounded">1_77sQzjfCJL3ttep9_mXONHE_l2bGVlY6blx8aag49M</code></li>
            <li>Tabs required: <strong>Quotes, Cashflow, Revenue, Expenses, Labour, Stock, qtsSmmry</strong></li>
            <li>All tabs must have flat row-based structure (no merged cells)</li>
          </ul>
        </div>

        <div>
          <p className="font-semibold text-foreground mb-1">Step 4: Verify data is flowing</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>Click <strong>Sync Now</strong> — the Data Debug section will show row counts for each tab</li>
            <li>Quotes Rows, Cashflow Rows, Revenue Rows, Expenses Rows should all be &gt; 0</li>
          </ul>
        </div>

        <div className="p-2 rounded bg-chart-green/10 border border-chart-green/20">
          <p className="text-chart-green text-[11px]">
            ✅ The webhook URL is pre-populated above. Data auto-syncs every 5 minutes.
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default GoogleSheetsSetupGuide;
