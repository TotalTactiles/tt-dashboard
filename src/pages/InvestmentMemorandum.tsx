import { useState, useEffect, useCallback, useRef } from "react";
import { Sparkles, ChevronDown, ChevronUp, Loader2, X, RotateCcw, FileText } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const WEBHOOK_URL = "https://n8n.srv1437130.hstgr.cloud/webhook/cim-ai-generate";
const SETTINGS_KEY = "cim_settings";
const FORM_KEY = "cim_form_data";

const SECTIONS = [
  { key: "executive_summary",     label: "Executive Summary",        rows: 8  },
  { key: "investment_thesis",     label: "Investment Thesis",        rows: 10 },
  { key: "market_opportunity",    label: "Market Opportunity",       rows: 8  },
  { key: "financial_commentary",  label: "Financial Commentary",     rows: 10 },
  { key: "risk_factors",          label: "Risk Factors & Mitigants", rows: 12 },
  { key: "projections_rationale", label: "Projections Rationale",    rows: 8  },
] as const;

type SectionKey = typeof SECTIONS[number]["key"];

const DEFAULT_SETTINGS = {
  companyName: "TT Business",
  industry: "Commercial Contracting",
  capitalSought: "$500,000",
  proposedStructure: "Debt Facility",
  useOfFunds: "Equipment procurement and working capital",
};

const DEFAULT_FORM: Record<SectionKey, string> = {
  executive_summary: "",
  investment_thesis: "",
  market_opportunity: "",
  financial_commentary: "",
  risk_factors: "",
  projections_rationale: "",
};

function loadLS<T extends Record<string, any>>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export default function InvestmentMemorandum() {
  const { kpiStats, hasLiveData } = useDashboardData();

  const [settings, setSettings] = useState(() => loadLS(SETTINGS_KEY, DEFAULT_SETTINGS));
  const [form, setForm] = useState<Record<SectionKey, string>>(() => loadLS(FORM_KEY, DEFAULT_FORM));
  const [settingsOpen, setSettingsOpen] = useState(true);

  const [loading, setLoading] = useState<Partial<Record<SectionKey, boolean>>>({});
  const [banners, setBanners] = useState<Partial<Record<SectionKey, string | null>>>({});
  const [undoMap, setUndoMap] = useState<Partial<Record<SectionKey, string>>>({});

  const [masterLoading, setMasterLoading] = useState(false);
  const [masterProgress, setMasterProgress] = useState(0);
  const [masterStatus, setMasterStatus] = useState("");
  const [masterDone, setMasterDone] = useState(false);

  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist settings
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  // Debounced persist form
  const persistForm = useCallback((next: Record<SectionKey, string>) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      localStorage.setItem(FORM_KEY, JSON.stringify(next));
    }, 500);
  }, []);

  const updateField = (key: SectionKey, val: string) => {
    setForm(prev => {
      const next = { ...prev, [key]: val };
      persistForm(next);
      return next;
    });
  };

  const buildPayload = (sectionKey: SectionKey) => ({
    section: sectionKey,
    companyName: settings.companyName,
    industry: settings.industry,
    capitalSought: settings.capitalSought,
    proposedStructure: settings.proposedStructure,
    useOfFunds: settings.useOfFunds,
    data: {
      quotesSummary:   (window as any).__dashboardData?.quotesSummary   ?? {},
      cashflowSummary: (window as any).__dashboardData?.cashflowSummary ?? {},
      revenueSummary:  (window as any).__dashboardData?.revenueSummary  ?? {},
      expensesSummary: (window as any).__dashboardData?.expensesSummary ?? {},
      labourSummary:   (window as any).__dashboardData?.labourSummary   ?? {},
      investorMetrics: (window as any).__dashboardData?.investorMetrics ?? {},
    },
  });

  const generateSection = useCallback(async (key: SectionKey): Promise<boolean> => {
    setLoading(p => ({ ...p, [key]: true }));
    setBanners(p => ({ ...p, [key]: null }));
    setUndoMap(p => ({ ...p, [key]: form[key] }));

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 90000);

      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(key)),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data = Array.isArray(json) ? json[0] : json;
      const text = data?.content?.[key] ?? null;

      if (!text) throw new Error("No content returned");

      setForm(prev => {
        const next = { ...prev, [key]: text };
        persistForm(next);
        return next;
      });
      setBanners(p => ({ ...p, [key]: "ai" }));
      return true;
    } catch {
      setBanners(p => ({ ...p, [key]: "error" }));
      return false;
    } finally {
      setLoading(p => ({ ...p, [key]: false }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, settings, persistForm]);

  const handleUndo = (key: SectionKey) => {
    const prev = undoMap[key] ?? "";
    setForm(p => {
      const next = { ...p, [key]: prev };
      persistForm(next);
      return next;
    });
    setBanners(p => ({ ...p, [key]: null }));
  };

  const handleGenerateAll = async () => {
    setMasterLoading(true);
    setMasterDone(false);
    setMasterProgress(0);
    setMasterStatus("");

    for (let i = 0; i < SECTIONS.length; i++) {
      const s = SECTIONS[i];
      setMasterStatus(`Generating section ${i + 1} of ${SECTIONS.length}: ${s.label}...`);
      await generateSection(s.key);
      setMasterProgress(Math.round(((i + 1) / SECTIONS.length) * 100));
      if (i < SECTIONS.length - 1) await new Promise(r => setTimeout(r, 500));
    }

    setMasterLoading(false);
    setMasterDone(true);
    setMasterStatus("All 6 sections generated — please review before use");
  };

  const completedCount = SECTIONS.filter(s => (form[s.key] ?? "").trim().length > 0).length;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 pb-10">

        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Investment Memorandum</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Generate a bank-ready Confidential Information Memorandum using live business data
            </p>
          </div>
        </div>

        {!hasLiveData && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            ⚠ Dashboard data not yet available — please wait for data to load before generating AI commentary.
          </div>
        )}

        {/* Document Settings */}
        <div className="rounded-lg border bg-card">
          <button
            onClick={() => setSettingsOpen(o => !o)}
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold hover:bg-muted/40 transition-colors rounded-lg"
          >
            <span>⚙ Document Settings</span>
            {settingsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {settingsOpen && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-5 pb-5">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Company Name</label>
                <Input value={settings.companyName} onChange={e => setSettings(p => ({ ...p, companyName: e.target.value }))} />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Industry / Sector</label>
                <Input value={settings.industry} onChange={e => setSettings(p => ({ ...p, industry: e.target.value }))} />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Capital Sought</label>
                <Input value={settings.capitalSought} onChange={e => setSettings(p => ({ ...p, capitalSought: e.target.value }))} />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Proposed Structure</label>
                <Select value={settings.proposedStructure} onValueChange={v => setSettings(p => ({ ...p, proposedStructure: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Debt Facility", "Equity", "Convertible Note", "Other"].map(o => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Use of Funds</label>
                <Input value={settings.useOfFunds} onChange={e => setSettings(p => ({ ...p, useOfFunds: e.target.value }))} />
              </div>
            </div>
          )}
        </div>

        {/* Generate All */}
        <div className="rounded-lg border bg-card px-5 py-4 space-y-3">
          <Button
            onClick={handleGenerateAll}
            disabled={masterLoading}
            className="w-full gap-2 text-base font-semibold h-11"
          >
            {masterLoading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
              : <><Sparkles className="w-4 h-4" /> ✦ Generate All AI Commentary</>
            }
          </Button>

          {/* Completeness */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>AI Commentary: {completedCount} of {SECTIONS.length} sections complete</span>
              <span>{Math.round((completedCount / SECTIONS.length) * 100)}%</span>
            </div>
            <Progress value={(completedCount / SECTIONS.length) * 100} className="h-1.5" />
          </div>

          {masterLoading && (
            <div className="space-y-1">
              <Progress value={masterProgress} className="h-1" />
              <p className="text-xs text-muted-foreground">{masterStatus}</p>
            </div>
          )}

          {masterDone && !masterLoading && (
            <p className="text-xs text-green-600 dark:text-green-400 font-medium">
              ✓ {masterStatus}
            </p>
          )}
        </div>

        {/* Confidentiality Notice */}
        <p className="text-xs text-muted-foreground text-center border rounded px-3 py-2">
          🔒 This document contains confidential financial information. Distribute only to parties who have executed an NDA.
        </p>

        {/* Section Text Areas */}
        <div className="space-y-6">
          {SECTIONS.map(({ key, label, rows }) => (
            <div key={key} className="rounded-lg border bg-card px-5 py-4 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold">{label}</label>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!!loading[key]}
                  onClick={() => generateSection(key)}
                  className="gap-1.5 text-xs h-7 px-3"
                >
                  {loading[key]
                    ? <><Loader2 className="w-3 h-3 animate-spin" /> Drafting...</>
                    : <><Sparkles className="w-3 h-3" /> ✦ AI Draft</>
                  }
                </Button>
              </div>

              <Textarea
                rows={rows}
                value={loading[key] ? "" : (form[key] ?? "")}
                placeholder={loading[key] ? "✦ Drafting institutional commentary..." : `Enter ${label.toLowerCase()} or click ✦ AI Draft to generate...`}
                onChange={e => updateField(key, e.target.value)}
                className={`text-sm resize-y ${loading[key] ? "animate-pulse bg-muted" : ""}`}
                disabled={!!loading[key]}
              />

              {banners[key] === "ai" && (
                <div className="flex items-center justify-between rounded bg-amber-50 dark:bg-amber-950 border border-amber-300 px-3 py-1.5 text-xs text-amber-800 dark:text-amber-300">
                  <span>✦ AI Draft — Please review and edit before use</span>
                  <div className="flex gap-2">
                    <button onClick={() => handleUndo(key)} className="flex items-center gap-1 hover:underline">
                      <RotateCcw className="w-3 h-3" /> Undo
                    </button>
                    <button onClick={() => setBanners(p => ({ ...p, [key]: null }))}>
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}

              {banners[key] === "error" && (
                <div className="flex items-center justify-between rounded bg-red-50 dark:bg-red-950 border border-red-300 px-3 py-1.5 text-xs text-red-700 dark:text-red-400">
                  <span>Generation failed — please try again</span>
                  <button onClick={() => setBanners(p => ({ ...p, [key]: null }))}>
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

      </div>
    </DashboardLayout>
  );
}
