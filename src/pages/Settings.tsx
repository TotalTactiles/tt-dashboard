import { useState } from "react";
import { motion } from "framer-motion";
import { Check, ExternalLink, RefreshCw, Zap, ArrowRight, FileSpreadsheet } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { n8nDataSources } from "@/data/mockData";
import { toast } from "sonner";

interface N8nSourceConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  connected: boolean;
  dataMapping: string[];
  webhookUrl?: string;
  lastSync?: string;
}

const Settings = () => {
  const [sources, setSources] = useState<N8nSourceConfig[]>(
    n8nDataSources.map((s) => ({ ...s, webhookUrl: "", lastSync: "" }))
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleConnection = (id: string) => {
    setSources((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const newConnected = !s.connected;
          toast(newConnected ? `${s.name} connected via n8n` : `${s.name} disconnected`);
          return { ...s, connected: newConnected, lastSync: newConnected ? new Date().toLocaleString() : "" };
        }
        return s;
      })
    );
  };

  const updateWebhookUrl = (id: string, url: string) => {
    setSources((prev) =>
      prev.map((s) => (s.id === id ? { ...s, webhookUrl: url } : s))
    );
  };

  const handleSave = (id: string) => {
    const source = sources.find((s) => s.id === id);
    toast.success(`${source?.name} n8n webhook saved`);
  };

  const handleSync = (id: string) => {
    const source = sources.find((s) => s.id === id);
    toast.info(`Syncing ${source?.name} via n8n...`);
    setSources((prev) =>
      prev.map((s) => (s.id === id ? { ...s, lastSync: new Date().toLocaleString() } : s))
    );
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground font-mono">
          Manage data integrations via n8n workflows
        </p>
      </div>

      {/* n8n info banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="chart-container mb-6 border border-chart-blue/20"
      >
        <div className="flex items-start gap-3">
          <Zap className="w-5 h-5 text-chart-blue mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium mb-1">n8n Integration Layer</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              All data sources connect through <strong>n8n</strong> workflows acting as middleware. Configure a webhook URL for each source — n8n handles authentication, data transformation, and scheduling. Create workflows at{" "}
              <a href="https://n8n.io" target="_blank" rel="noopener noreferrer" className="text-chart-blue underline underline-offset-2">
                n8n.io
              </a>{" "}
              and paste the webhook URL below.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Google Sheets tab mapping guide */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="chart-container mb-6 border border-chart-green/20"
      >
        <div className="flex items-start gap-3">
          <FileSpreadsheet className="w-5 h-5 text-chart-green mt-0.5 shrink-0" />
          <div className="w-full">
            <p className="text-sm font-medium mb-2">Google Sheets Tab → Dashboard Mapping</p>
            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <Badge variant="secondary" className="text-xs font-mono shrink-0">Quotes</Badge>
                <span className="text-muted-foreground">→ KPI stat cards (Total Quoted, Conversion Rate) + Quoted Jobs table</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="secondary" className="text-xs font-mono shrink-0">Cashflow</Badge>
                <span className="text-muted-foreground">→ Income vs Outgoings chart + Cash Surplus/Deficit chart + Gross Margin trend</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="secondary" className="text-xs font-mono shrink-0">Revenue & COGS</Badge>
                <span className="text-muted-foreground">→ Expected Revenue table with per-project labour, tactile, and other costs</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="secondary" className="text-xs font-mono shrink-0">Business Expenses</Badge>
                <span className="text-muted-foreground">→ Expense category breakdown pie chart + Categorised expense cards</span>
              </div>
            </div>
            <div className="mt-3 p-3 rounded-md bg-secondary/50 border border-border">
              <p className="text-xs font-mono text-muted-foreground leading-relaxed">
                <strong className="text-foreground">n8n Workflow Structure:</strong><br />
                1. Webhook Trigger (POST)<br />
                2. Google Sheets → "Quotes" tab → Read All Rows<br />
                3. Google Sheets → "Cashflow" tab → Read All Rows<br />
                4. Google Sheets → "Revenue & COGS" tab → Read All Rows<br />
                5. Google Sheets → "Business Expenses" tab → Read All Rows<br />
                6. Code node → Combine into {`{ quotes, cashflow, revenue, expenses }`}<br />
                7. Respond to Webhook → Return structured JSON
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-1">Connected Sources</p>
          <p className="text-2xl font-mono font-bold text-chart-green">
            {sources.filter((s) => s.connected).length}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-1">Available Sources</p>
          <p className="text-2xl font-mono font-bold text-foreground">{sources.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-1">Integration Status</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="pulse-dot bg-chart-green" />
            <span className="text-sm font-mono text-chart-green">n8n Active</span>
          </div>
        </div>
      </div>

      {/* Data source cards */}
      <h2 className="text-sm font-mono text-muted-foreground uppercase tracking-wider mb-3">
        Data Sources
      </h2>
      <div className="space-y-3">
        {sources.map((source, i) => (
          <motion.div
            key={source.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="data-source-card"
          >
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setExpandedId(expandedId === source.id ? null : source.id)}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{source.icon}</span>
                <div>
                  <p className="font-medium text-sm">{source.name}</p>
                  <p className="text-xs text-muted-foreground">{source.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {source.connected && (
                  <span className="flex items-center gap-1 text-xs text-chart-green font-mono">
                    <Check className="w-3 h-3" /> Connected
                  </span>
                )}
                <Switch
                  checked={source.connected}
                  onCheckedChange={() => toggleConnection(source.id)}
                />
              </div>
            </div>

            {expandedId === source.id && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-4 pt-4 border-t border-border space-y-4"
              >
                {/* Webhook URL */}
                <div>
                  <label className="text-xs text-muted-foreground font-mono block mb-1">
                    n8n Webhook URL
                  </label>
                  <Input
                    placeholder="https://your-n8n.app/webhook/abc123"
                    value={source.webhookUrl || ""}
                    onChange={(e) => updateWebhookUrl(source.id, e.target.value)}
                    className="bg-secondary border-border font-mono text-sm"
                  />
                </div>

                {/* Data mapping */}
                <div>
                  <label className="text-xs text-muted-foreground font-mono block mb-2">
                    Data Mapping
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {source.dataMapping.map((item) => (
                      <Badge key={item} variant="secondary" className="text-xs font-mono">
                        <ArrowRight className="w-3 h-3 mr-1" />
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Last sync */}
                {source.lastSync && (
                  <p className="text-xs text-muted-foreground font-mono">
                    Last sync: {source.lastSync}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleSave(source.id)}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Check className="w-3 h-3 mr-1" /> Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-border text-muted-foreground"
                    onClick={() => handleSync(source.id)}
                  >
                    <RefreshCw className="w-3 h-3 mr-1" /> Sync Now
                  </Button>
                  <Button size="sm" variant="outline" className="border-border text-muted-foreground" asChild>
                    <a href="https://docs.n8n.io" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3 h-3 mr-1" /> n8n Docs
                    </a>
                  </Button>
                </div>
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>
    </DashboardLayout>
  );
};

export default Settings;
