import { useState, useEffect, useRef, useCallback } from "react";

const STORAGE_KEY = "dashboard_data_sources";
const DATA_CACHE_KEY = "dashboard_live_data";
const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

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
    connected: false,
    webhookUrl: "",
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
      // Merge with defaults to pick up any new sources
      return DEFAULT_SOURCES.map((def) => {
        const existing = parsed.find((s) => s.id === def.id);
        return existing
          ? { ...def, ...existing, loading: false }
          : def;
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
  // Strip loading state before persisting
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

  // Persist sources whenever they change (but debounce loading flickers)
  const persistSources = useCallback((updated: DataSourceConfig[]) => {
    setSources(updated);
    saveSources(updated);
  }, []);

  const fetchSource = useCallback(async (source: DataSourceConfig): Promise<{ success: boolean; data?: any; error?: string }> => {
    if (!source.webhookUrl) return { success: false, error: "No webhook URL" };

    setSources((prev) =>
      prev.map((s) => (s.id === source.id ? { ...s, loading: true, lastError: "" } : s))
    );

    try {
      // Try POST first, fall back to GET if 405
      let res: Response;
      try {
        res = await fetch(source.webhookUrl, {
          method: "POST",
          mode: "cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: source.id, timestamp: new Date().toISOString() }),
        });
      } catch (postErr: any) {
        // If POST fails with TypeError (CORS or network), try GET as fallback
        if (postErr instanceof TypeError) {
          try {
            res = await fetch(source.webhookUrl, { method: "GET", mode: "cors" });
          } catch (getErr: any) {
            // Both failed — likely CORS
            throw new TypeError("Failed to fetch");
          }
        } else {
          throw postErr;
        }
      }

      // If POST returned 405, retry with GET
      if (res!.status === 405) {
        res = await fetch(source.webhookUrl, { method: "GET", mode: "cors" });
      }

      if (!res!.ok) throw new Error(`HTTP ${res!.status}: ${res!.statusText}`);

      const data = await res!.json();
      const now = new Date().toLocaleString();

      setLiveData((prev) => {
        const updated = { ...prev, ...data, [`_lastSync_${source.id}`]: now };
        saveLiveData(updated);
        return updated;
      });

      setSources((prev) => {
        const updated = prev.map((s) =>
          s.id === source.id ? { ...s, loading: false, lastSync: now, lastError: "" } : s
        );
        saveSources(updated);
        return updated;
      });

      return { success: true, data };
    } catch (err: any) {
      let errorMsg = err.message || "Failed to fetch";

      // Detect CORS errors
      if (err instanceof TypeError && (errorMsg === "Failed to fetch" || errorMsg.includes("NetworkError"))) {
        errorMsg = "CORS error: Your n8n webhook is blocking browser requests. For self-hosted n8n, add this environment variable and restart: N8N_ADDITIONAL_ALLOWED_ORIGINS=https://*.lovable.app,https://*.lovableproject.com — For n8n Cloud, enable \"Allow Cross-Origin Requests\" in the Webhook node Options.";
      }

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
      // Clear existing interval if any
      if (intervals.current[source.id]) {
        clearInterval(intervals.current[source.id]);
      }
      // Immediate fetch
      fetchSource(source);
      // Set up polling
      intervals.current[source.id] = setInterval(() => {
        // Re-read latest source config from state
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

  // On mount, start polling for all enabled sources
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

      // Auto-enable if not already
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
  };
}
