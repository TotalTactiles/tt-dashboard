import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Check, ExternalLink, RefreshCw, Zap, ArrowRight, FileSpreadsheet, Loader2, AlertCircle, Clock } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useDataSources } from "@/hooks/useDataSources";
import { toast } from "sonner";
import GoogleSheetsSetupGuide from "@/components/settings/GoogleSheetsSetupGuide";
import ZohoCrmSetupGuide from "@/components/settings/ZohoCrmSetupGuide";
import ZohoProjectsSetupGuide from "@/components/settings/ZohoProjectsSetupGuide";
import ScreenshotUpload from "@/components/shared/ScreenshotUpload";
import ScreenshotViewer from "@/components/shared/ScreenshotViewer";

const SETUP_GUIDES: Record<string, React.ComponentType> = {
  google_sheets: GoogleSheetsSetupGuide,
  zoho_crm: ZohoCrmSetupGuide,
  zoho_projects: ZohoProjectsSetupGuide,
};

const Settings = () => {
  const {
    sources,
    connectedCount,
    toggleConnection,
    updateWebhookUrl,
    saveAndTest,
    syncNow,
    updateScreenshot,
    removeScreenshot,
  } = useDataSources();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [nextSyncCountdown, setNextSyncCountdown] = useState<Record<string, number>>({});
  const [viewingScreenshot, setViewingScreenshot] = useState<{ url: string; name: string } | null>(null);

  // Countdown timer for next sync
  useEffect(() => {
    const interval = setInterval(() => {
      setNextSyncCountdown((prev) => {
        const updated: Record<string, number> = {};
        sources.forEach((s) => {
          if (s.connected && s.lastSync) {
            const lastMs = new Date(s.lastSync).getTime();
            const nextMs = lastMs + 5 * 60 * 1000;
            const remaining = Math.max(0, Math.floor((nextMs - Date.now()) / 1000));
            updated[s.id] = remaining;
          }
        });
        return updated;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [sources]);

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleToggle = (id: string) => {
    const source = sources.find((s) => s.id === id);
    if (!source) return;

    if (!source.connected && !source.webhookUrl) {
      toast.error("Enter a webhook URL first, then toggle on");
      return;
    }

    toggleConnection(id);
    toast(source.connected ? `${source.name} disconnected — polling stopped` : `${source.name} connected — auto-syncing every 5 min`);
  };

  const handleSave = async (id: string) => {
    const source = sources.find((s) => s.id === id);
    if (!source) return;

    toast.info(`Testing ${source.name} webhook...`);
    const result = await saveAndTest(id);

    if (result.success) {
      toast.success(`${source.name} connected and syncing!`);
    } else {
      toast.error(`${source.name}: ${result.error}`);
    }
  };

  const handleSync = (id: string) => {
    const source = sources.find((s) => s.id === id);
    if (!source?.webhookUrl) {
      toast.error("No webhook URL configured");
      return;
    }
    toast.info(`Syncing ${source.name}...`);
    syncNow(id);
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground font-mono">
          Manage data integrations via n8n workflows — auto-syncs every 5 minutes
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
            <p className="text-sm font-medium mb-1">n8n Integration Layer — Always-On Sync</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Enter your n8n webhook URL, click <strong>Save</strong> (validates & test-fetches), then toggle <strong>On</strong>. The dashboard will auto-pull fresh data every 5 minutes, 24/7 — no human intervention needed. Data persists across page refreshes via local cache.
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
          </div>
        </div>
      </motion.div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-1">Connected Sources</p>
          <p className="text-2xl font-mono font-bold text-chart-green">
            {connectedCount}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-1">Available Sources</p>
          <p className="text-2xl font-mono font-bold text-foreground">{sources.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-1">Sync Status</p>
          <div className="flex items-center gap-2 mt-1">
            {connectedCount > 0 ? (
              <>
                <span className="pulse-dot bg-chart-green" />
                <span className="text-sm font-mono text-chart-green">Auto-Polling Active</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                <span className="text-sm font-mono text-muted-foreground">No Active Sources</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Data source cards */}
      <h2 className="text-sm font-mono text-muted-foreground uppercase tracking-wider mb-3">
        Data Sources
      </h2>
      <div className="space-y-3">
        {sources.map((source, i) => {
          const SetupGuide = SETUP_GUIDES[source.id];
          return (
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
                  {source.loading && (
                    <Loader2 className="w-3 h-3 animate-spin text-chart-blue" />
                  )}
                  {source.lastError && !source.loading && (
                    <span className="flex items-center gap-1 text-xs text-destructive font-mono">
                      <AlertCircle className="w-3 h-3" /> Error
                    </span>
                  )}
                  {source.connected && !source.lastError && !source.loading && (
                    <span className="flex items-center gap-1 text-xs text-chart-green font-mono">
                      <Check className="w-3 h-3" /> Live
                    </span>
                  )}
                  <Switch
                    checked={source.connected}
                    onCheckedChange={() => handleToggle(source.id)}
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

                  {/* Status info */}
                  <div className="space-y-1">
                    {source.lastSync && (
                      <p className="text-xs text-muted-foreground font-mono">
                        Last sync: {source.lastSync}
                      </p>
                    )}
                    {source.connected && nextSyncCountdown[source.id] !== undefined && (
                      <p className="text-xs text-chart-blue font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Next sync in {formatCountdown(nextSyncCountdown[source.id])}
                      </p>
                    )}
                    {source.lastError && (
                      <p className="text-xs text-destructive font-mono flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {source.lastError}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleSave(source.id)}
                      disabled={source.loading}
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {source.loading ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Check className="w-3 h-3 mr-1" />
                      )}
                      Save & Test
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-border text-muted-foreground"
                      onClick={() => handleSync(source.id)}
                      disabled={source.loading || !source.webhookUrl}
                    >
                      <RefreshCw className={`w-3 h-3 mr-1 ${source.loading ? "animate-spin" : ""}`} /> Sync Now
                    </Button>
                    <Button size="sm" variant="outline" className="border-border text-muted-foreground" asChild>
                      <a href="https://docs.n8n.io" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3 h-3 mr-1" /> n8n Docs
                      </a>
                    </Button>
                  </div>

                  {/* Setup Guide */}
                  {SetupGuide && (
                    <div className="pt-2">
                      <SetupGuide />
                    </div>
                  )}

                  {/* Reference Screenshot */}
                  <div className="pt-2 border-t border-border">
                    <ScreenshotUpload
                      currentUrl={source.screenshotUrl}
                      onUpload={(url) => updateScreenshot(source.id, url)}
                      onRemove={() => removeScreenshot(source.id)}
                      label="Reference Screenshot — verify data mapping"
                    />
                    {source.screenshotUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 text-xs text-chart-blue"
                        onClick={() => setViewingScreenshot({ url: source.screenshotUrl!, name: source.name })}
                      >
                        View full screenshot
                      </Button>
                    )}
                  </div>
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>

      {viewingScreenshot && (
        <ScreenshotViewer
          open={!!viewingScreenshot}
          onOpenChange={() => setViewingScreenshot(null)}
          url={viewingScreenshot.url}
          title={`${viewingScreenshot.name} — Reference Data`}
        />
      )}
    </DashboardLayout>
  );
};

export default Settings;
