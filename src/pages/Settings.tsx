import { useState } from "react";
import { motion } from "framer-motion";
import { Check, ExternalLink, Plug, Trash2, RefreshCw } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { dataSources } from "@/data/mockData";
import { toast } from "sonner";

interface DataSourceConfig {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  connected: boolean;
  apiKey?: string;
  endpoint?: string;
  refreshInterval?: number;
}

const Settings = () => {
  const [sources, setSources] = useState<DataSourceConfig[]>(
    dataSources.map((s) => ({ ...s, apiKey: "", endpoint: "", refreshInterval: 30 }))
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleConnection = (id: string) => {
    setSources((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const newConnected = !s.connected;
          toast(newConnected ? `${s.name} connected` : `${s.name} disconnected`);
          return { ...s, connected: newConnected };
        }
        return s;
      })
    );
  };

  const updateSource = (id: string, field: string, value: string | number) => {
    setSources((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const handleSave = (id: string) => {
    const source = sources.find((s) => s.id === id);
    toast.success(`${source?.name} configuration saved`);
  };

  const categories = [...new Set(sources.map((s) => s.category))];

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground font-mono">
          Configure data sources, API connections, and feed settings
        </p>
      </div>

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
          <p className="text-xs text-muted-foreground mb-1">Data Feed Status</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="pulse-dot bg-chart-green" />
            <span className="text-sm font-mono text-chart-green">Active</span>
          </div>
        </div>
      </div>

      {categories.map((category) => (
        <div key={category} className="mb-8">
          <h2 className="text-sm font-mono text-muted-foreground uppercase tracking-wider mb-3">
            {category}
          </h2>
          <div className="space-y-3">
            {sources
              .filter((s) => s.category === category)
              .map((source, i) => (
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
                      <div>
                        <label className="text-xs text-muted-foreground font-mono block mb-1">
                          API Key / Token
                        </label>
                        <Input
                          type="password"
                          placeholder="Enter API key..."
                          value={source.apiKey || ""}
                          onChange={(e) => updateSource(source.id, "apiKey", e.target.value)}
                          className="bg-secondary border-border font-mono text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground font-mono block mb-1">
                          API Endpoint URL
                        </label>
                        <Input
                          placeholder="https://api.example.com/v1/data"
                          value={source.endpoint || ""}
                          onChange={(e) => updateSource(source.id, "endpoint", e.target.value)}
                          className="bg-secondary border-border font-mono text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground font-mono block mb-1">
                          Refresh Interval (seconds)
                        </label>
                        <Input
                          type="number"
                          placeholder="30"
                          value={source.refreshInterval || 30}
                          onChange={(e) =>
                            updateSource(source.id, "refreshInterval", parseInt(e.target.value))
                          }
                          className="bg-secondary border-border font-mono text-sm w-32"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSave(source.id)}
                          className="bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          <Check className="w-3 h-3 mr-1" /> Save
                        </Button>
                        <Button size="sm" variant="outline" className="border-border text-muted-foreground">
                          <RefreshCw className="w-3 h-3 mr-1" /> Test Connection
                        </Button>
                        <Button size="sm" variant="outline" className="border-border text-muted-foreground">
                          <ExternalLink className="w-3 h-3 mr-1" /> Docs
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              ))}
          </div>
        </div>
      ))}
    </DashboardLayout>
  );
};

export default Settings;
