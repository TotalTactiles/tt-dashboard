import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Check, ExternalLink, RefreshCw, Zap, ArrowRight, FileSpreadsheet, Loader2, AlertCircle, Clock, ChevronDown, ChevronUp, Database } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useDashboardData } from "@/contexts/DashboardDataContext";
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
    liveData,
    projectKPIData,
    connectedCount,
    toggleConnection,
    updateWebhookUrl,
    saveAndTest,
    syncNow,
    updateScreenshot,
    removeScreenshot,
    changeDetectorMeta,
    lastCachedAt,
  } = useDashboardData();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewingScreenshot, setViewingScreenshot] = useState<{ url: string; name: string } | null>(null);
  const [showInspector, setShowInspector] = useState(false);

  const formatTs = (iso: string | null | undefined): string => {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return "—";
      return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" }) +
        ", " + d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true });
    } catch { return "—"; }
  };

  const syncStatusLabel = (source: typeof sources[0]): { text: string; colour: string } => {
    // Use change detector metadata if available
    const { lastChecked, lastTriggered } = changeDetectorMeta;
    if (lastTriggered) {
      const triggeredRecently =
        lastChecked && lastTriggered &&
        new Date(lastTriggered).getTime() >= new Date(lastChecked).getTime() - 60000;
      if (triggeredRecently) {
        return { text: `Data updated · ${formatTs(lastTriggered)}`, colour: "text-emerald-400" };
      }
    }
    if (lastChecked) {
      return { text: `No change detected · Last checked ${formatTs(lastChecked)}`, colour: "text-muted-foreground" };
    }
    // Fall back to last sync from source
    if (source.lastSync) {
      return { text: `Last sync: ${source.lastSync}`, colour: "text-muted-foreground" };
    }
    return { text: "Not yet synced", colour: "text-muted-foreground" };
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

  // Format the last synced timestamp for Zoho Projects
  const formatLastSynced = (generatedAt: string | undefined) => {
    if (!generatedAt) return null;
    try {
      const d = new Date(generatedAt);
      return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) +
        ", " + d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true });
    } catch { return generatedAt; }
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
          const isZohoProjects = source.id === "zoho_projects";
          const zohoProjectsLastSynced = isZohoProjects ? formatLastSynced(projectKPIData?.generatedAt) : null;

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
                      placeholder={source.id === "google_sheets" ? "https://n8n.srv1437130.hstgr.cloud/webhook/..." : "https://your-n8n.app/webhook/abc123"}
                      value={source.webhookUrl || ""}
                      onChange={(e) => updateWebhookUrl(source.id, e.target.value)}
                      className="bg-secondary border-border font-mono text-sm"
                    />
                    {source.id === "google_sheets" && source.webhookUrl === "https://n8n.srv1437130.hstgr.cloud/webhook/bb826393-569e-4270-a033-6f6d8019e0e0" && (
                      <span className="text-[10px] text-muted-foreground font-mono mt-1">(default)</span>
                    )}
                    {isZohoProjects && source.webhookUrl === "https://n8n.srv1437130.hstgr.cloud/webhook/tt-project-kpis" && (
                      <span className="text-[10px] text-muted-foreground font-mono mt-1">(default)</span>
                    )}
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

                  {/* Last synced for Zoho Projects */}
                  {isZohoProjects && zohoProjectsLastSynced && (
                    <p className="text-xs text-muted-foreground font-mono">
                      Last synced: {zohoProjectsLastSynced}
                    </p>
                  )}

                  {/* Status info */}
                  <div className="space-y-1">
                    {source.connected && (() => {
                      const status = syncStatusLabel(source);
                      return (
                        <p className={`text-xs font-mono flex items-center gap-1 ${status.colour}`}>
                          <Clock className="w-3 h-3" />
                          {status.text}
                        </p>
                      );
                    })()}
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

                  {/* Reference Screenshot removed for all connectors */}
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Data Debug Panel */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="chart-container mt-6 border border-chart-amber/20"
      >
        <button
          className="flex items-center justify-between w-full text-left"
          onClick={() => setShowInspector(!showInspector)}
        >
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-chart-amber" />
            <span className="text-sm font-medium">Data Debug</span>
          </div>
          {showInspector ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {showInspector && (() => {
          const meta = liveData._meta as any;
          const debug = liveData._debug as any[];
          return (
            <div className="mt-4 space-y-4">
              {/* Meta info */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="border border-border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground font-mono mb-1">Last Pull</p>
                  <p className="text-sm font-mono text-foreground">{meta?.pulledAt ? new Date(meta.pulledAt).toLocaleString() : "—"}</p>
                </div>
                <div className="border border-border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground font-mono mb-1">Quotes Rows</p>
                  <p className="text-sm font-mono text-foreground">{meta?.quotesRows ?? "—"}</p>
                </div>
                <div className="border border-border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground font-mono mb-1">Cashflow Rows</p>
                  <p className="text-sm font-mono text-foreground">{meta?.cashflowRows ?? "—"}</p>
                </div>
                <div className="border border-border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground font-mono mb-1">Revenue Rows</p>
                  <p className="text-sm font-mono text-foreground">{meta?.revenueRows ?? "—"}</p>
                </div>
                <div className="border border-border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground font-mono mb-1">Expenses Rows</p>
                  <p className="text-sm font-mono text-foreground">{meta?.expensesRows ?? "—"}</p>
                </div>
              </div>

              {/* Debug errors */}
              {Array.isArray(debug) && debug.length > 0 && (
                <div>
                  <p className="text-xs font-mono text-muted-foreground mb-2">Debug Errors</p>
                  <div className="flex flex-wrap gap-2">
                    {debug.map((err: any, i: number) => (
                      <Badge key={i} variant="destructive" className="text-xs font-mono">
                        {typeof err === "string" ? err : JSON.stringify(err)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Raw Response Preview */}
              <div>
                <p className="text-xs font-mono text-muted-foreground mb-2">Raw Response Preview (first 3 items per array)</p>
                <div className="space-y-3">
                  {(["quotes", "cashflow", "revenue", "expenses"] as const).map((key) => {
                    const arr = liveData[key];
                    const count = Array.isArray(arr) ? arr.length : 0;
                    const sample = Array.isArray(arr) ? arr.slice(0, 3) : null;
                    return (
                      <div key={key} className="border border-border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-mono font-medium uppercase">{key}</span>
                          <Badge variant={count > 0 ? "default" : "destructive"} className="text-xs font-mono">
                            {count} rows
                          </Badge>
                        </div>
                        {sample && sample.length > 0 && (
                          <pre className="mt-2 text-xs font-mono text-foreground/70 bg-secondary/50 rounded p-2 overflow-x-auto max-h-40 overflow-y-auto">
                            {JSON.stringify(sample, null, 2)}
                          </pre>
                        )}
                        {count === 0 && (
                          <p className="text-xs text-muted-foreground font-mono mt-1">No data received</p>
                        )}
                      </div>
                    );
                  })}

                  {/* Summary objects preview */}
                  {(["quotesSummary", "cashflowSummary"] as const).map((key) => {
                    const obj = liveData[key];
                    return (
                      <div key={key} className="border border-border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-mono font-medium uppercase">{key}</span>
                          <Badge variant={obj ? "default" : "secondary"} className="text-xs font-mono">
                            {obj ? "present" : "missing"}
                          </Badge>
                        </div>
                        {obj && (
                          <pre className="mt-2 text-xs font-mono text-foreground/70 bg-secondary/50 rounded p-2 overflow-x-auto max-h-40 overflow-y-auto">
                            {JSON.stringify(obj, null, 2)}
                          </pre>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── ZOHO PROJECTS DEBUG ── */}
              <div className="pt-4 border-t border-border">
                <p className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground mb-3">Zoho Projects</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="border border-border rounded-lg p-3">
                    <p className="text-xs text-muted-foreground font-mono mb-1">Last Pull</p>
                    <p className="text-sm font-mono text-foreground">
                      {projectKPIData?.generatedAt
                        ? new Date(projectKPIData.generatedAt).toLocaleString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
                        : "—"}
                    </p>
                  </div>
                  <div className="border border-border rounded-lg p-3">
                    <p className="text-xs text-muted-foreground font-mono mb-1">Projects</p>
                    <p className="text-sm font-mono text-foreground">{projectKPIData?.dataHealth.projects ?? "--"}</p>
                  </div>
                  <div className="border border-border rounded-lg p-3">
                    <p className="text-xs text-muted-foreground font-mono mb-1">Milestones</p>
                    <p className="text-sm font-mono text-foreground">{projectKPIData?.dataHealth.milestones ?? "--"}</p>
                  </div>
                  <div className="border border-border rounded-lg p-3">
                    <p className="text-xs text-muted-foreground font-mono mb-1">Tasks</p>
                    <p className="text-sm font-mono text-foreground">{projectKPIData?.dataHealth.tasks ?? "--"}</p>
                  </div>
                  <div className="border border-border rounded-lg p-3">
                    <p className="text-xs text-muted-foreground font-mono mb-1">Revenue Rows</p>
                    <p className="text-sm font-mono text-foreground">{projectKPIData?.dataHealth.revenueRows ?? "--"}</p>
                  </div>
                  <div className="border border-border rounded-lg p-3">
                    <p className="text-xs text-muted-foreground font-mono mb-1">Valid Rev Rows</p>
                    <p className="text-sm font-mono text-foreground">{projectKPIData?.dataHealth.validRevenueRows ?? "--"}</p>
                  </div>
                </div>

                {/* KPI summary pill */}
                <div className="mt-3">
                  <p className="text-xs font-mono text-muted-foreground mb-2">Debug KPIs</p>
                  <div className="flex flex-wrap gap-2">
                    {projectKPIData ? (
                      <Badge variant="secondary" className="text-xs font-mono">
                        KPIs — onTime:{projectKPIData.kpis.onTimeDelivery.value ?? "N/A"} slippage:{projectKPIData.kpis.scheduleSlippage.value}d margin:{projectKPIData.kpis.marginVariance.actualGP ?? "N/A"}% labour:{projectKPIData.kpis.labourEfficiency.label} costOverrun:{projectKPIData.kpis.costOverrun.label}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs font-mono text-muted-foreground">
                        No data — Zoho Projects not yet synced
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Expandable KPI JSON previews */}
                <div className="mt-3 space-y-3">
                  <p className="text-xs font-mono text-muted-foreground mb-2">Raw KPI Preview</p>
                  {([
                    { key: "onTimeDelivery", label: "ON-TIME DELIVERY", badge: projectKPIData ? `${projectKPIData.kpis.onTimeDelivery.completedTasks} completed` : null },
                    { key: "scheduleSlippage", label: "SCHEDULE SLIPPAGE", badge: projectKPIData ? `${projectKPIData.kpis.scheduleSlippage.overdueDetail.length} overdue` : null },
                    { key: "marginVariance", label: "MARGIN VARIANCE", badge: projectKPIData ? `${projectKPIData.kpis.marginVariance.negativeGPJobs.length + (projectKPIData.kpis.marginVariance.revenueBase > 0 ? projectKPIData.dataHealth.validRevenueRows : 0)} jobs` : null },
                    { key: "labourEfficiency", label: "LABOUR EFFICIENCY", badge: projectKPIData ? (projectKPIData.kpis.labourEfficiency.dataReady ? "ready" : "pending") : null },
                  ] as const).map(({ key, label, badge }) => {
                    const kpiObj = projectKPIData?.kpis?.[key as keyof typeof projectKPIData.kpis] ?? null;
                    return (
                      <div key={key} className="border border-border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-mono font-medium uppercase">{label}</span>
                          <Badge variant={kpiObj ? "default" : "secondary"} className="text-xs font-mono">
                            {badge ?? "missing"}
                          </Badge>
                        </div>
                        {kpiObj ? (
                          <pre className="mt-2 text-xs font-mono text-foreground/70 bg-secondary/50 rounded p-2 overflow-x-auto max-h-40 overflow-y-auto">
                            {JSON.stringify(kpiObj, null, 2)}
                          </pre>
                        ) : (
                          <p className="text-xs text-muted-foreground font-mono mt-1">No data received</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}
      </motion.div>

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
