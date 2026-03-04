import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, FileSpreadsheet } from "lucide-react";
import { useState } from "react";

const GoogleSheetsSetupGuide = () => {
  const [open, setOpen] = useState(false);

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
        <div>
          <p className="font-semibold text-foreground mb-1">Step 1: Create n8n Workflow</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>Add a <strong>Webhook</strong> node → set Method to <strong>POST</strong></li>
            <li>Copy the <strong>Production URL</strong> (you'll paste this into Settings)</li>
          </ul>
        </div>

        <div>
          <p className="font-semibold text-foreground mb-1">Step 2: Add Google Sheets Nodes (one per tab)</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>Node 1: Google Sheets → <Badge variant="secondary" className="text-[10px] mx-1">Quotes</Badge> tab → Read All Rows</li>
            <li>Node 2: Google Sheets → <Badge variant="secondary" className="text-[10px] mx-1">Cashflow</Badge> tab → Read All Rows</li>
            <li>Node 3: Google Sheets → <Badge variant="secondary" className="text-[10px] mx-1">Revenue & COGS</Badge> tab → Read All Rows</li>
            <li>Node 4: Google Sheets → <Badge variant="secondary" className="text-[10px] mx-1">Business Expenses</Badge> tab → Read All Rows</li>
          </ul>
        </div>

        <div>
          <p className="font-semibold text-foreground mb-1">Step 3: Add Code Node to Merge</p>
          <div className="bg-background/60 p-3 rounded border border-border mt-1">
            <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap">{`// In the Code node:
const quotes = $('Google Sheets - Quotes').all().map(i => i.json);
const cashflow = $('Google Sheets - Cashflow').all().map(i => i.json);
const revenue = $('Google Sheets - Revenue').all().map(i => i.json);
const expenses = $('Google Sheets - Expenses').all().map(i => i.json);

return [{
  json: { quotes, cashflow, revenue, expenses }
}];`}</pre>
          </div>
        </div>

        <div>
          <p className="font-semibold text-foreground mb-1">Step 4: Add Respond to Webhook</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>Add a <strong>Respond to Webhook</strong> node after the Code node</li>
            <li>Set Response Body to <strong>First Item JSON</strong></li>
            <li>Activate the workflow → copy the Production webhook URL</li>
          </ul>
        </div>

        <div className="p-2 rounded bg-chart-green/10 border border-chart-green/20">
          <p className="text-chart-green text-[11px]">
            ✅ Paste the webhook URL into the Google Sheets field above, click Save, and toggle on. Data will auto-sync every 5 minutes.
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default GoogleSheetsSetupGuide;
