import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

const ZohoProjectsSetupGuide = () => {
  const [open, setOpen] = useState(false);

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
        <div>
          <p className="font-semibold text-foreground mb-1">Step 1: Create a Zoho API Console App</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>Go to <a href="https://api-console.zoho.com/" target="_blank" rel="noopener noreferrer" className="text-chart-blue underline">https://api-console.zoho.com/</a></li>
            <li>Click <strong>"Add Client"</strong> → select <strong>"Server-based Applications"</strong></li>
            <li><strong>Client Name:</strong> <code className="bg-background/60 px-1 rounded">n8n Integration</code></li>
            <li><strong>Homepage URL:</strong> your n8n URL (e.g. <code className="bg-background/60 px-1 rounded">https://n8n.yourdomain.com</code>)</li>
            <li className="text-chart-orange"><strong>⚠️ Authorized Redirect URI (critical!):</strong></li>
            <li><code className="bg-background/60 px-1 rounded text-chart-orange">https://your-n8n-domain.com/rest/oauth2-credential/callback</code></li>
            <li><strong>Required Scopes:</strong></li>
            <li><code className="bg-background/60 px-1 rounded">ZohoProjects.portals.READ, ZohoProjects.projects.READ, ZohoProjects.tasks.READ, ZohoProjects.milestones.READ</code></li>
          </ul>
        </div>

        <div>
          <p className="font-semibold text-foreground mb-1">Step 2: Find Your Portal ID</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>In n8n, add an <strong>HTTP Request</strong> node</li>
            <li>Method: <strong>GET</strong></li>
            <li>URL: <code className="bg-background/60 px-1 rounded">https://projectsapi.zoho.com/restapi/portals/</code></li>
            <li>Auth: <strong>OAuth2</strong> → use the credentials from Step 1</li>
            <li>Run once → note your <strong>Portal ID</strong> from the response</li>
          </ul>
        </div>

        <div>
          <p className="font-semibold text-foreground mb-1">Step 3: Create n8n Workflow</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>Add a <strong>Webhook</strong> node (POST trigger)</li>
            <li>Add <strong>HTTP Request</strong> nodes (no native Zoho Projects node in n8n):</li>
          </ul>
          <div className="bg-background/60 p-3 rounded border border-border mt-1 space-y-1">
            <p className="text-[11px] text-muted-foreground">
              <strong>Projects:</strong> GET <code>https://projectsapi.zoho.com/restapi/portal/&#123;portalId&#125;/projects/</code>
            </p>
            <p className="text-[11px] text-muted-foreground">
              <strong>Tasks:</strong> GET <code>https://projectsapi.zoho.com/restapi/portal/&#123;portalId&#125;/projects/&#123;projectId&#125;/tasks/</code>
            </p>
            <p className="text-[11px] text-muted-foreground">
              <strong>Milestones:</strong> GET <code>https://projectsapi.zoho.com/restapi/portal/&#123;portalId&#125;/projects/&#123;projectId&#125;/milestones/</code>
            </p>
          </div>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-2">
            <li>Auth: OAuth2 → use same Zoho credentials with Projects scopes</li>
          </ul>
        </div>

        <div>
          <p className="font-semibold text-foreground mb-1">Step 4: Merge & Return</p>
          <div className="bg-background/60 p-3 rounded border border-border mt-1">
            <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap">{`// Code node:
const projects = $('HTTP - Projects').all().map(i => i.json);
const tasks = $('HTTP - Tasks').all().map(i => i.json);
const milestones = $('HTTP - Milestones').all().map(i => i.json);

return [{
  json: { projects, tasks, milestones }
}];`}</pre>
          </div>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-2">
            <li>Add <strong>Respond to Webhook</strong> → Response Body: <strong>First Item JSON</strong></li>
            <li>Activate the workflow</li>
          </ul>
        </div>

        <div className="p-2 rounded bg-chart-orange/10 border border-chart-orange/20">
          <p className="font-semibold text-chart-orange text-[11px] mb-2">⚠️ Step 5: Enable CORS (Required!)</p>
          <p className="text-muted-foreground text-[10px] mb-1">Add this environment variable to your n8n server:</p>
          <div className="bg-background/60 p-2 rounded border border-border mt-1">
            <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap">{`N8N_ADDITIONAL_ALLOWED_ORIGINS=https://*.lovable.app,https://*.lovableproject.com`}</pre>
          </div>
          <ul className="list-disc list-inside text-muted-foreground text-[10px] space-y-1 mt-1">
            <li><strong>Docker:</strong> add <code className="bg-background/60 px-1 rounded">-e N8N_ADDITIONAL_ALLOWED_ORIGINS=...</code> to your <code className="bg-background/60 px-1 rounded">docker run</code> or <code className="bg-background/60 px-1 rounded">docker-compose.yml</code></li>
            <li><strong>PM2/systemd:</strong> add it to your <code className="bg-background/60 px-1 rounded">.env</code> file</li>
            <li>Then <strong>restart n8n</strong></li>
          </ul>
          <p className="text-muted-foreground text-[10px] mt-1">Without this, your browser will block the request (CORS error). The Webhook node "Allow Cross-Origin Requests" checkbox does <strong>not</strong> work for self-hosted n8n.</p>
        </div>

        <div className="p-2 rounded bg-accent/50 border border-border">
          <p className="text-accent-foreground text-[11px]">
            ✅ Paste the Production webhook URL into the Zoho Projects field above, click Save, and toggle on.
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default ZohoProjectsSetupGuide;
