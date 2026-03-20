import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "dashboard_data_sources";
const DATA_CACHE_KEY = "dashboard_live_data";
const CALENDAR_CACHE_KEY = "dashboard_calendar_data";
const PROJECT_KPI_CACHE_KEY = "dashboard_project_kpi_data";
const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes
const CALENDAR_POLL_INTERVAL = 3 * 60 * 1000; // 3 minutes
const DEFAULT_WEBHOOK_URL = "https://n8n.srv1437130.hstgr.cloud/webhook/bb826393-569e-4270-a033-6f6d8019e0e0";
const CALENDAR_READ_WEBHOOK = "https://n8n.srv1437130.hstgr.cloud/webhook/tt-calendar-read";
const ZOHO_PROJECTS_WEBHOOK_URL = "https://n8n.srv1437130.hstgr.cloud/webhook/tt-project-kpis";

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

export interface ProjectKPIData {
  generatedAt: string;
  dataHealth: {
    projects: number;
    milestones: number;
    tasks: number;
    revenueRows: number;
    validRevenueRows: number;
    loggedHoursTotal: number;
    estimatedHoursTotal: number;
    completedTasksFound: number;
    completedMilestonesFound: number;
  };
  kpis: {
    onTimeDelivery: {
      value: number | null;
      label: string;
      detail: string;
      completedMilestones: number;
      completedTasks: number;
      onTimeTasks: number;
      lateTaskCount: number;
      lateTaskDetail: Array<{
        name: string;
        dueDate: string;
        completedDate: string;
        daysLate: number;
      }>;
    };
    scheduleSlippage: {
      value: number;
      label: string;
      detail: string;
      overdueMillestones: number;
      overdueTaskCount: number;
      isOverdue: boolean;
      overdueDetail: Array<{
        name: string;
        project: string;
        dueDate: string;
        daysOverdue: number;
      }>;
    };
    marginVariance: {
      value: number | null;
      label: string;
      detail: string;
      actualGP: number | null;
      targetGP: number;
      isBelowTarget: boolean;
      revenueBase: number;
      cogsTotal: number;
      negativeGPJobs: Array<{
        company: string;
        project: string;
        value: number;
        cogs: number;
        gpPct: number;
      }>;
    };
    labourEfficiency: {
      value: number | null;
      label: string;
      detail: string;
      loggedHours: number;
      estimatedHours: number;
      isEfficient: boolean;
      dataReady: boolean;
      note: string | null;
    };
    costOverrun: {
      value: number | null;
      label: string;
      detail: string;
      isStubbed: boolean;
    };
  };
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
    description: "Project KPIs — delivery, margins, efficiency",
    icon: "📋",
    connected: true,
    webhookUrl: ZOHO_PROJECTS_WEBHOOK_URL,
    lastSync: "",
    lastError: "",
    loading: false,
    dataMapping: [
      "On-Time Delivery rate",
      "Schedule slippage (avg days overdue)",
      "Margin variance vs target",
      "Labour efficiency",
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
          if (def.id === "google_sheets") {
            const webhookUrl = existing.webhookUrl || DEFAULT_WEBHOOK_URL;
            // Always force connected: true — webhook URL is hardcoded
            return { ...def, ...existing, loading: false, webhookUrl, connected: true };
          }
          if (def.id === "zoho_projects") {
            const webhookUrl = existing.webhookUrl || ZOHO_PROJECTS_WEBHOOK_URL;
            // Always force connected: true for zoho_projects — the webhook URL
            // is hardcoded and always available. User cannot disconnect this source.
            return { ...def, ...existing, loading: false, webhookUrl, connected: true, dataMapping: def.dataMapping };
          }
          return { ...def, ...existing, loading: false };
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

function loadCachedCalendar(): { calendarEvents: any[]; upcomingEvents: any[]; calendarSummary: any } {
  try {
    const cached = localStorage.getItem(CALENDAR_CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch {}
  return { calendarEvents: [], upcomingEvents: [], calendarSummary: { totalEvents: 0, upcomingCount: 0, byType: {} } };
}

function loadCachedProjectKPI(): ProjectKPIData | null {
  try {
    const cached = localStorage.getItem(PROJECT_KPI_CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch {}
  return null;
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
  const [projectKPIData, setProjectKPIData] = useState<ProjectKPIData | null>(loadCachedProjectKPI);
  const intervals = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  // isLoading = true only for the very first fetch (shows skeleton)
  // isRefreshing = true during background polls (no skeleton, subtle indicator only)
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasFetchedOnce = useRef(false);

  const [calendarData, setCalendarData] = useState(loadCachedCalendar);
  const calendarInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // AbortController refs for cancelling in-flight requests
  const abortRefs = useRef<Record<string, AbortController>>({});
  const calendarAbortRef = useRef<AbortController | null>(null);

  const persistSources = useCallback((updated: DataSourceConfig[]) => {
    setSources(updated);
    saveSources(updated);
  }, []);

  // Fetch project KPI data from Zoho Projects webhook
  const fetchProjectKPIs = useCallback(async (webhookUrl: string, payload?: any): Promise<{ success: boolean; data?: ProjectKPIData; error?: string }> => {
    try {
      const { data: responseData, error } = await supabase.functions.invoke("n8n-proxy", {
        body: { webhookUrl, source: "zoho_projects", payload },
      });

      if (error) throw new Error(error.message || "Proxy request failed");
      if (responseData?._proxyError) throw new Error(responseData.error || "Proxy error");

      let unwrapped = responseData;
      if (Array.isArray(unwrapped)) unwrapped = unwrapped[0];
      if (unwrapped?.json && typeof unwrapped.json === "object") unwrapped = unwrapped.json;

      if (!unwrapped?.kpis || !unwrapped?.dataHealth) {
        throw new Error("Invalid response shape — missing kpis or dataHealth");
      }

      const kpiData = unwrapped as ProjectKPIData;
      setProjectKPIData(kpiData);
      localStorage.setItem(PROJECT_KPI_CACHE_KEY, JSON.stringify(kpiData));

      return { success: true, data: kpiData };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to fetch project KPIs" };
    }
  }, []);

  // Track which sources can be called directly (no CORS issues)
  const canDirectFetch = useRef<Record<string, boolean>>({});

  const fetchSource = useCallback(async (source: DataSourceConfig): Promise<{ success: boolean; data?: any; error?: string; warnings?: string[] }> => {
    if (!source.webhookUrl) return { success: false, error: "No webhook URL" };

    // Cancel any previous fetch for this source
    if (abortRefs.current[source.id]) {
      abortRefs.current[source.id].abort();
    }
    abortRefs.current[source.id] = new AbortController();
    const signal = abortRefs.current[source.id].signal;

    setSources((prev) =>
      prev.map((s) => (s.id === source.id ? { ...s, loading: true, lastError: "" } : s))
    );

    try {
      // Special handling for zoho_projects
      if (source.id === "zoho_projects") {
        const result = await fetchProjectKPIs(source.webhookUrl);
        if (signal.aborted) return { success: false, error: "Superseded" };
        const now = new Date().toLocaleString();

        setSources((prev) => {
          const updated = prev.map((s) =>
            s.id === source.id ? {
              ...s,
              loading: false,
              lastSync: result.success ? now : s.lastSync,
              lastError: result.success ? "" : (result.error || "Fetch failed"),
            } : s
          );
          saveSources(updated);
          return updated;
        });

        return result.success
          ? { success: true, data: result.data }
          : { success: false, error: result.error };
      }

      // Try direct n8n call first (faster — no proxy round-trip)
      let responseData: any = null;
      let usedDirect = false;

      if (canDirectFetch.current[source.id] !== false) {
        try {
          const directRes = await fetch(source.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: source.id }),
            signal: AbortSignal.timeout(8000),
          });
          if (directRes.ok) {
            responseData = await directRes.json();
            usedDirect = true;
            canDirectFetch.current[source.id] = true;
          }
        } catch {
          // CORS blocked or network error — fall through to proxy
          canDirectFetch.current[source.id] = false;
        }
      }

      if (signal.aborted) return { success: false, error: "Superseded" };

      // Fall back to Supabase proxy if direct call failed
      if (!usedDirect) {
        const { data, error } = await supabase.functions.invoke("n8n-proxy", {
          body: { webhookUrl: source.webhookUrl, source: source.id },
        });
        if (error) throw new Error(error.message || "Proxy request failed");
        responseData = data;
      }

      if (signal.aborted) return { success: false, error: "Superseded" };

      if (responseData?._proxyError) {
        const hint = responseData.hint ? `\n${responseData.hint}` : "";
        throw new Error(`${responseData.error || "Proxy error"}${hint}`);
      }

      let unwrapped = responseData;
      if (Array.isArray(unwrapped)) {
        unwrapped = unwrapped[0];
      }
      if (unwrapped && typeof unwrapped === "object" && unwrapped.json && typeof unwrapped.json === "object") {
        unwrapped = unwrapped.json;
      }
      const finalData = unwrapped;

      const REQUIRED_KEYS: Record<string, string[]> = {
        google_sheets: ["quotes", "cashflow", "revenue", "expenses", "quotesSummary", "cashflowSummary"],
        zoho_crm: ["deals", "contacts"],
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
      if (err.name === 'AbortError' || signal.aborted) return { success: false, error: "Aborted" };
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
  }, [fetchProjectKPIs]);

  const startPolling = useCallback(
    (source: DataSourceConfig) => {
      if (intervals.current[source.id]) {
        clearInterval(intervals.current[source.id]);
      }

      // First fetch: use isInitialLoad if no data yet, otherwise isRefreshing
      const doFetch = async () => {
        if (hasFetchedOnce.current) {
          setIsRefreshing(true);
        }
        await fetchSource(source);
        if (!hasFetchedOnce.current) {
          hasFetchedOnce.current = true;
          setIsInitialLoad(false);
        }
        setIsRefreshing(false);
      };

      doFetch();

      intervals.current[source.id] = setInterval(() => {
        setSources((prev) => {
          const current = prev.find((s) => s.id === source.id);
          if (current?.connected && current.webhookUrl) {
            setIsRefreshing(true);
            fetchSource(current).finally(() => setIsRefreshing(false));
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
    // If cached data exists, we're not in initial load
    const hasCachedData = Object.keys(liveData).some((k) => !k.startsWith("_"));
    if (hasCachedData) {
      setIsInitialLoad(false);
      hasFetchedOnce.current = true;
    }

    sources.forEach((source) => {
      if (source.connected && source.webhookUrl) {
        startPolling(source);
      }
    });

    return () => {
      Object.keys(intervals.current).forEach(stopPolling);
      // Abort any in-flight requests
      Object.values(abortRefs.current).forEach(c => c.abort());
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
        setIsRefreshing(true);
        fetchSource(source).finally(() => setIsRefreshing(false));
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

  // isLoading: true only during initial load when no cached data exists
  const isLoading = isInitialLoad && !hasLiveData;

  // ===== Calendar-specific polling (3 min) =====
  const fetchCalendar = useCallback(async () => {
    try {
      // Abort previous calendar request
      if (calendarAbortRef.current) calendarAbortRef.current.abort();
      calendarAbortRef.current = new AbortController();

      const { data: responseData, error } = await supabase.functions.invoke("n8n-proxy", {
        body: { webhookUrl: CALENDAR_READ_WEBHOOK, source: "calendar" },
      });

      if (error) throw new Error(error.message || "Calendar proxy request failed");
      if (responseData?._proxyError) throw new Error(responseData.error || "Calendar proxy error");

      let unwrapped = responseData;
      if (Array.isArray(unwrapped)) unwrapped = unwrapped[0];
      if (unwrapped?.json && typeof unwrapped.json === "object") unwrapped = unwrapped.json;

      const calEvents = Array.isArray(unwrapped?.calendarEvents) ? unwrapped.calendarEvents : [];
      const upEvents = Array.isArray(unwrapped?.upcomingEvents) ? unwrapped.upcomingEvents : [];
      const calSummary = unwrapped?.calendarSummary ?? { totalEvents: 0, upcomingCount: 0, byType: {} };

      if (calEvents.length === 0) {
        console.warn('[Calendar Poll] calendarEvents empty from tt-calendar-read webhook');
      }

      const newData = { calendarEvents: calEvents, upcomingEvents: upEvents, calendarSummary: calSummary };
      setCalendarData(newData);
      localStorage.setItem(CALENDAR_CACHE_KEY, JSON.stringify(newData));
      console.log(`[Calendar Poll] Fetched ${calEvents.length} events`);
    } catch (err: any) {
      if (err.name === 'AbortError') return; // intentionally cancelled
      console.error('[Calendar Poll] Error:', err.message);
    }
  }, []);

  useEffect(() => {
    fetchCalendar();
    calendarInterval.current = setInterval(fetchCalendar, CALENDAR_POLL_INTERVAL);
    return () => {
      if (calendarInterval.current) clearInterval(calendarInterval.current);
      if (calendarAbortRef.current) calendarAbortRef.current.abort();
    };
  }, [fetchCalendar]);

  return {
    sources,
    liveData,
    calendarData,
    projectKPIData,
    hasLiveData,
    connectedCount,
    isLoading,
    isRefreshing,
    toggleConnection,
    updateWebhookUrl,
    saveAndTest,
    syncNow,
    syncCalendar: fetchCalendar,
    updateScreenshot,
    removeScreenshot,
  };
}
