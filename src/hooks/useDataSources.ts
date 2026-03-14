import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "dashboard_data_sources";
const DATA_CACHE_KEY = "dashboard_live_data";
const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes
const DEFAULT_WEBHOOK_URL = "https://n8n.srv1437130.hstgr.cloud/webhook/bb826393-569e-4270-a033-6f6d8019e0e0";

export interface DataSourceConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  connected: boolean;
  webhookUrl: string;
  lastSync: string;
  lastError: string;
  loading: boolean;
  dataMapping: string[];
  screenshotUrl?: string;
}

export interface LiveData {
  quotes?: any[];
  cashflow?: any[];
  revenue?: any[];
  expenses?: any[];
  deals?: any[];
  contacts?: any[];
  projects?: any[];
  tasks?: any[];
  milestones?: any[];
  [key: string]: any;
}

const DEFAULT_SOURCES: DataSourceConfig[] = [
  {
    id: "google_sheets",
    name: "Google Sheets",
    description: "Quotes, Cashflow, Revenue & COGS, Business Expenses",
    icon: "📊",
    connected: true,
    webhookUrl: DEFAULT_WEBHOOK_URL,
    lastSync: "",
    lastError: "",
    loading: false,
    dataMapping: [
      "Quotes tab → KPI Stats + Quoted Jobs table",
      "Cashflow tab → Income vs Outgoings chart + Cash Surplus chart",
      "Revenue & COGS tab → Revenue Projects table",
      "Business Expenses tab → Expense Breakdown + Pie chart",
    ],
  },
  {
    id: "zoho_crm",
    name: "Zoho CRM",
    description: "Deals pipeline, contacts, sales activities & forecasting",
    icon: "💼",
    connected: false,
    webhookUrl: "",
    lastSync: "",
    lastError: "",
    loading: false,
    dataMapping: [
      "Active deals & pipeline stages",
      "Client contacts & communication logs",
      "Sales forecasts & win rates",
      "Revenue attribution by source",
    ],
  },
  {
    id: "zoho_projects",
    name: "Zoho Projects",
    description: "Project timelines, milestones, task tracking & resource allocation",
    icon: "📋",
    connected: false,
    webhookUrl: "",
    lastSync: "",
    lastError: "",
    loading: false,
    dataMapping: [
      "Project status & milestones",
      "Task completion & burndown",
      "Resource utilisation rates",
      "Deadline tracking & alerts",
    ],
  },
];

function loadSavedSources(): DataSourceConfig[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as DataSourceConfig[];
      return DEFAULT_SOURCES.map((def) => {
        const existing = parsed.find((s) => s.id === def.id);
        if (existing) {
          // Ensure google_sheets always has a webhook URL (fallback to default)
          const webhookUrl = (def.id === "google_sheets" && !existing.webhookUrl)
            ? DEFAULT_WEBHOOK_URL
            : existing.webhookUrl;
          const connected = (def.id === "google_sheets" && !existing.webhookUrl)
            ? true
            : existing.connected;
          return { ...def, ...existing, loading: false, webhookUrl, connected };
        }
        return def;
      });
    }
  } catch {}
  return DEFAULT_SOURCES;
}

function loadCachedData(): LiveData {
  try {
    const cached = localStorage.getItem(DATA_CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch {}
  return {};
}

function saveSources(sources: DataSourceConfig[]) {
  const toSave = sources.map((s) => ({ ...s, loading: false }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}

function saveLiveData(data: LiveData) {
  localStorage.setItem(DATA_CACHE_KEY, JSON.stringify(data));
}

export function useDataSources() {
  const [sources, setSources] = useState<DataSourceConfig[]>(loadSavedSources);
  const [liveData, setLiveData] = useState<LiveData>(loadCachedData);
  const intervals = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const persistSources = useCallback((updated: DataSourceConfig[]) => {
    setSources(updated);
    saveSources(updated);
  }, []);

  const fetchSource = useCallback(async (source: DataSourceConfig): Promise<{ success: boolean; data?: any; error?: string; warnings?: string[] }> => {
    if (!source.webhookUrl) return { success: false, error: "No webhook URL" };

    setSources((prev) =>
      prev.map((s) => (s.id === source.id ? { ...s, loading: true, lastError: "" } : s))
    );

    try {
      // Route through the n8n-proxy Edge Function to avoid CORS
      const { data: responseData, error } = await supabase.functions.invoke("n8n-proxy", {
        body: { webhookUrl: source.webhookUrl, source: source.id },
      });

      if (error) throw new Error(error.message || "Proxy request failed");

      // Check for proxy-level errors (upstream 404, bad URL, etc.)
      if (responseData?._proxyError) {
        const hint = responseData.hint ? `\n${responseData.hint}` : "";
        throw new Error(`${responseData.error || "Proxy error"}${hint}`);
      }

      // Safety-net unwrap: n8n Code node wraps in array [{ json: {...} }]
      let unwrapped = responseData;
      if (Array.isArray(unwrapped)) {
        unwrapped = unwrapped[0];
      }
      if (unwrapped && typeof unwrapped === "object" && unwrapped.json && typeof unwrapped.json === "object") {
        unwrapped = unwrapped.json;
      }
      const finalData = unwrapped;

      // Validate payload: must have expected keys as arrays
      const REQUIRED_KEYS: Record<string, string[]> = {
        google_sheets: ["quotes", "cashflow", "revenue", "expenses", "quotesSummary", "cashflowSummary"],
        zoho_crm: ["deals", "contacts"],
        zoho_projects: ["projects", "tasks", "milestones"],
      };

      const requiredKeys = REQUIRED_KEYS[source.id] || [];
      const warnings: string[] = [];

      for (const key of requiredKeys) {
        if (!finalData || !(key in finalData)) {
          warnings.push(`missing "${key}" key`);
        } else if (Array.isArray(finalData[key]) && finalData[key].length === 0) {
          warnings.push(`"${key}" is empty`);
        } else if (finalData[key] && typeof finalData[key] === "object" && !Array.isArray(finalData[key]) && Object.keys(finalData[key]).length === 0) {
          warnings.push(`"${key}" is empty`);
        }
      }

      const now = new Date().toLocaleString();

      setLiveData((prev) => {
        const updated = { ...prev, [`_lastSync_${source.id}`]: now };
        if (finalData && typeof finalData === "object") {
          for (const [k, v] of Object.entries(finalData)) {
            // Only skip if new value is empty array AND existing is non-empty array
            if (Array.isArray(v) && v.length === 0 && Array.isArray(updated[k]) && updated[k].length > 0) {
              continue;
            }
            updated[k] = v;
          }
        }
        saveLiveData(updated);
        return updated;
      });

      const lastError = warnings.length > 0 ? `Partial data: ${warnings.join(", ")}` : "";

      setSources((prev) => {
        const updated = prev.map((s) =>
          s.id === source.id ? { ...s, loading: false, lastSync: now, lastError } : s
        );
        saveSources(updated);
        return updated;
      });

      return { success: true, data: finalData, warnings };
    } catch (err: any) {
      const errorMsg = err.message || "Failed to fetch";

      setSources((prev) => {
        const updated = prev.map((s) =>
          s.id === source.id ? { ...s, loading: false, lastError: errorMsg } : s
        );
        saveSources(updated);
        return updated;
      });

      return { success: false, error: errorMsg };
    }
  }, []);

  const startPolling = useCallback(
    (source: DataSourceConfig) => {
      if (intervals.current[source.id]) {
        clearInterval(intervals.current[source.id]);
      }
      fetchSource(source);
      intervals.current[source.id] = setInterval(() => {
        setSources((prev) => {
          const current = prev.find((s) => s.id === source.id);
          if (current?.connected && current.webhookUrl) {
            fetchSource(current);
          }
          return prev;
        });
      }, POLL_INTERVAL);
    },
    [fetchSource]
  );

  const stopPolling = useCallback((sourceId: string) => {
    if (intervals.current[sourceId]) {
      clearInterval(intervals.current[sourceId]);
      delete intervals.current[sourceId];
    }
  }, []);

  useEffect(() => {
    sources.forEach((source) => {
      if (source.connected && source.webhookUrl) {
        startPolling(source);
      }
    });

    return () => {
      Object.keys(intervals.current).forEach(stopPolling);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleConnection = useCallback(
    (id: string) => {
      setSources((prev) => {
        const source = prev.find((s) => s.id === id);
        if (!source) return prev;

        const newConnected = !source.connected;

        if (newConnected && source.webhookUrl) {
          startPolling({ ...source, connected: true });
        } else {
          stopPolling(id);
        }

        const updated = prev.map((s) =>
          s.id === id ? { ...s, connected: newConnected } : s
        );
        saveSources(updated);
        return updated;
      });
    },
    [startPolling, stopPolling]
  );

  const updateWebhookUrl = useCallback((id: string, url: string) => {
    setSources((prev) => {
      const updated = prev.map((s) => (s.id === id ? { ...s, webhookUrl: url } : s));
      saveSources(updated);
      return updated;
    });
  }, []);

  const saveAndTest = useCallback(
    async (id: string) => {
      const source = sources.find((s) => s.id === id);
      if (!source) return { success: false, error: "Source not found" };

      if (!source.webhookUrl) {
        return { success: false, error: "Please enter a webhook URL" };
      }

      try {
        new URL(source.webhookUrl);
      } catch {
        return { success: false, error: "Invalid URL format" };
      }

      saveSources(sources);
      const result = await fetchSource(source);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      if (!source.connected) {
        toggleConnection(id);
      }

      return { success: true };
    },
    [sources, fetchSource, toggleConnection]
  );

  const syncNow = useCallback(
    (id: string) => {
      const source = sources.find((s) => s.id === id);
      if (source?.webhookUrl) {
        fetchSource(source);
      }
    },
    [sources, fetchSource]
  );

  const updateScreenshot = useCallback((id: string, url: string) => {
    setSources((prev) => {
      const updated = prev.map((s) => (s.id === id ? { ...s, screenshotUrl: url } : s));
      saveSources(updated);
      return updated;
    });
  }, []);

  const removeScreenshot = useCallback((id: string) => {
    setSources((prev) => {
      const updated = prev.map((s) => {
        if (s.id !== id) return s;
        const { screenshotUrl, ...rest } = s;
        return rest as DataSourceConfig;
      });
      saveSources(updated);
      return updated;
    });
  }, []);

  const connectedCount = sources.filter((s) => s.connected).length;
  const hasLiveData = Object.keys(liveData).some((k) => !k.startsWith("_"));

  return {
    sources,
    liveData,
    hasLiveData,
    connectedCount,
    toggleConnection,
    updateWebhookUrl,
    saveAndTest,
    syncNow,
    updateScreenshot,
    removeScreenshot,
  };
}
