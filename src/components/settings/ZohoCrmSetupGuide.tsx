import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

const ZohoCrmSetupGuide = () => {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border hover:bg-secondary/80 transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-base">💼</span>
          <span className="text-sm font-medium">Zoho CRM n8n Setup Guide</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 p-4 rounded-lg bg-secondary/30 border border-border text-xs space-y-4 font-mono">
        <div>
          <p className="font-semibold text-foreground mb-1">Step 1: Create a Zoho API Console App</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>Go to <a href="https://api-console.zoho.com/" target="_blank" rel="noopener noreferrer" className="text-chart-blue underline">https://api-console.zoho.com/</a></li>
            <li>Click <strong>"Add Client"</strong> → select <strong>"Server-based Applications"</strong></li>
            <li><strong>Client Name:</strong> <code className="bg-background/60 px-1 rounded">n8n Integration</code></li>
            <li><strong>Homepage URL:</strong> <code className="bg-background/60 px-1 rounded">https://your-n8n-instance.app.n8n.cloud</code></li>
            <li className="text-muted-foreground">For self-hosted n8n: <code className="bg-background/60 px-1 rounded">http://localhost:5678</code></li>
            <li className="text-chart-orange"><strong>⚠️ Authorized Redirect URI (critical!):</strong></li>
            <li><code className="bg-background/60 px-1 rounded text-chart-orange">https://your-n8n-instance.app.n8n.cloud/rest/oauth2-credential/callback</code></li>
            <li>Copy the <strong>Client ID</strong> and <strong>Client Secret</strong></li>
          </ul>
        </div>

        <div>
          <p className="font-semibold text-foreground mb-1">Step 2: Create n8n Workflow</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>Add a <strong>Webhook</strong> node (POST trigger) → copy Production URL</li>
            <li>Add a <strong>Zoho CRM</strong> node → create new OAuth2 credential</li>
            <li>Paste Client ID & Client Secret from Step 1</li>
            <li><strong>Scopes:</strong> <code className="bg-background/60 px-1 rounded">ZohoCRM.modules.ALL, ZohoCRM.settings.ALL</code></li>
          </ul>
        </div>

        <div>
          <p className="font-semibold text-foreground mb-1">Step 3: Configure Data Retrieval</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>Zoho CRM node → Operation: <strong>Get Many</strong></li>
            <li>Resource: <strong>Deal</strong> (add separate nodes for Contact, Account if needed)</li>
            <li>Add a <strong>Code</strong> node to merge:</li>
          </ul>
          <div className="bg-background/60 p-3 rounded border border-border mt-1">
            <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap">{`const deals = $('Zoho CRM - Deals').all().map(i => i.json);
const contacts = $('Zoho CRM - Contacts').all().map(i => i.json);
const accounts = $('Zoho CRM - Accounts').all().map(i => i.json);

return [{
  json: { deals, contacts, accounts }
}];`}</pre>
          </div>
        </div>

        <div>
          <p className="font-semibold text-foreground mb-1">Step 4: Return Data</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>Add a <strong>Respond to Webhook</strong> node → Response Body: <strong>First Item JSON</strong></li>
            <li>Activate the workflow</li>
          </ul>
        </div>

        <div className="p-2 rounded bg-chart-blue/10 border border-chart-blue/20">
          <p className="text-chart-blue text-[11px]">
            ✅ Paste the Production webhook URL into the Zoho CRM field above, click Save, and toggle on.
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default ZohoCrmSetupGuide;
