import { useState, useEffect, useCallback, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
  const { kpiStats, hasLiveData, dataStore, investorMetrics } = useDashboardData();

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
  const [pdfGenerating, setPdfGenerating] = useState(false);

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
      quotesSummary:   dataStore?.quotesSummary   ?? {},
      cashflowSummary: dataStore?.cashflowSummary ?? {},
      revenueSummary:  dataStore?.revenueSummary  ?? {},
      expensesSummary: dataStore?.expensesSummary ?? {},
      labourSummary:   dataStore?.labour          ?? [],
      investorMetrics: {
        ebitda:                kpiStats.find(s => s.label === "EBITDA")?.value ?? null,
        ebitdaMargin:          kpiStats.find(s => s.label === "EBITDA Margin")?.value ?? null,
        grossProfitMargin:     kpiStats.find(s => s.label === "Gross Profit Margin")?.value ?? null,
        revenueGrowthRate:     kpiStats.find(s => s.label === "Revenue Growth")?.value ?? null,
        operatingExpenseRatio: kpiStats.find(s => s.label === "Operating Expense Ratio")?.value ?? null,
        labourCostRatio:       kpiStats.find(s => s.label === "Labour Cost Ratio")?.value ?? null,
        avgContractValue:      kpiStats.find(s => s.label === "Average Contract Value")?.value ?? null,
        pipelineCoverageRatio: kpiStats.find(s => s.label === "Pipeline Coverage")?.value ?? null,
        cacPerClient:          kpiStats.find(s => s.label === "CAC Per Client")?.value ?? null,
        revenuePerJobWon:      kpiStats.find(s => s.label === "Revenue Per Job Won")?.value ?? null,
      },
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

  const sanitiseText = useCallback((text: string): string => {
    if (!text) return text;
    const sub: Record<string, string> = {
      "companyName":        settings.companyName,
      "industry":           settings.industry,
      "capitalSought":      settings.capitalSought,
      "proposedStructure":  settings.proposedStructure,
      "useOfFunds":         settings.useOfFunds,
      "totalRevenueYTD":    kpiStats.find(s => s.label === "Net Revenue")?.value ?? "N/A",
      "ebitdaEstimated":    "N/A",
      "ebitdaMargin":       "N/A",
      "grossMargin":        "N/A",
      "revenueGrowthMoM":   "N/A",
      "cashflowPosition":   kpiStats.find(s => s.label === "Cashflow Position")?.value ?? "N/A",
      "cashflowTrend":      "positive",
      "totalWon":           kpiStats.find(s => s.label === "Total Won")?.value ?? "N/A",
      "totalWonCount":      "N/A",
      "pipelineRemaining":  kpiStats.find(s => s.label === "Quoted Remaining")?.value ?? "N/A",
      "conversionRate":     kpiStats.find(s => s.label === "Conversion Rate")?.value ?? "N/A",
      "pipelineCoverage":   "N/A",
      "avgContractValue":   "N/A",
      "totalQuoted":        kpiStats.find(s => s.label === "Total Quoted")?.value ?? "N/A",
      "totalQuotedCount":   "N/A",
      "operatingExpRatio":  "N/A",
      "labourCostRatio":    "N/A",
      "totalExpenses":      "N/A",
      "totalLabourCost":    "N/A",
      "cacPerClient":       "N/A",
      "revenuePerJobWon":   "N/A",
      "reportingDate":      new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "long", year: "numeric" }),
    };
    return text.replace(/\{\{\s*\$json\.metrics\.([a-zA-Z]+)\s*\}\}/g, (_, key) => {
      return sub[key] ?? `[${key}]`;
    });
  }, [settings, kpiStats]);

  const generatePDF = async () => {
    setPdfGenerating(true);
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 18;
      const contentW = pageW - margin * 2;

      const NAVY   = [15,  30,  70]  as [number,number,number];
      const GOLD   = [180, 145, 80]  as [number,number,number];
      const WHITE  = [255, 255, 255] as [number,number,number];
      const LIGHT  = [245, 247, 252] as [number,number,number];
      const DARK   = [30,  35,  50]  as [number,number,number];
      const MUTED  = [110, 118, 140] as [number,number,number];
      const GREEN  = [34,  130, 84]  as [number,number,number];
      const AMBER  = [180, 120, 20]  as [number,number,number];

      let currentPage = 1;

      const addHeader = (title: string) => {
        doc.setFillColor(...NAVY);
        doc.rect(0, 0, pageW, 18, "F");
        doc.setFillColor(...GOLD);
        doc.rect(0, 16, pageW, 2, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...WHITE);
        doc.text(settings.companyName.toUpperCase(), margin, 11);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...GOLD);
        doc.text("CONFIDENTIAL INFORMATION MEMORANDUM", pageW / 2, 11, { align: "center" });
        doc.setTextColor(...WHITE);
        doc.text(title.toUpperCase(), pageW - margin, 11, { align: "right" });
      };

      const addFooter = (pageNum: number) => {
        doc.setFillColor(...NAVY);
        doc.rect(0, pageH - 10, pageW, 10, "F");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...MUTED);
        doc.text("CONFIDENTIAL — For Authorised Recipients Only", margin, pageH - 4);
        doc.setTextColor(...WHITE);
        doc.text(`Page ${pageNum}`, pageW - margin, pageH - 4, { align: "right" });
      };

      const addSectionHeading = (title: string, y: number): number => {
        doc.setFillColor(...NAVY);
        doc.rect(margin, y, contentW, 8, "F");
        doc.setFillColor(...GOLD);
        doc.rect(margin, y + 7, contentW, 1, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...WHITE);
        doc.text(title.toUpperCase(), margin + 4, y + 5.5);
        return y + 12;
      };

      const addBodyText = (text: string, y: number, maxWidth: number = contentW): number => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...DARK);
        const paragraphs = text.split(/\n\n+/);
        for (const para of paragraphs) {
          const lines = doc.splitTextToSize(para.trim(), maxWidth);
          doc.text(lines, margin, y);
          y += lines.length * 4.5 + 3;
        }
        return y + 2;
      };

      const addKPIBox = (label: string, value: string, x: number, y: number, w: number, positive?: boolean) => {
        doc.setFillColor(...LIGHT);
        doc.roundedRect(x, y, w, 18, 2, 2, "F");
        doc.setDrawColor(...NAVY);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, y, w, 18, 2, 2, "S");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...MUTED);
        doc.text(label.toUpperCase(), x + w / 2, y + 5.5, { align: "center" });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        const color = positive === undefined ? NAVY : positive ? GREEN : AMBER;
        doc.setTextColor(...color);
        doc.text(value, x + w / 2, y + 13, { align: "center" });
      };

      const newPage = (title: string) => {
        currentPage++;
        doc.addPage();
        addHeader(title);
        addFooter(currentPage);
      };

      const checkOverflow = (y: number, needed: number, title: string): number => {
        if (y + needed > pageH - 18) {
          newPage(title);
          return 26;
        }
        return y;
      };

      // ═══ PAGE 1 — COVER ═══
      addHeader("Cover");
      addFooter(1);

      doc.setFillColor(...NAVY);
      doc.rect(0, 18, pageW, 80, "F");
      doc.setFillColor(...GOLD);
      doc.rect(0, 70, pageW, 3, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(28);
      doc.setTextColor(...WHITE);
      doc.text(settings.companyName, pageW / 2, 46, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(13);
      doc.setTextColor(...GOLD);
      doc.text("CONFIDENTIAL INFORMATION MEMORANDUM", pageW / 2, 60, { align: "center" });
      doc.setFontSize(9);
      doc.setTextColor(...WHITE);
      doc.text("Capital Investment Overview", pageW / 2, 68, { align: "center" });

      let y = 115;
      const detailLines: [string, string][] = [
        ["Industry",            settings.industry],
        ["Capital Sought",      settings.capitalSought],
        ["Proposed Structure",  settings.proposedStructure],
        ["Prepared",            new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "long", year: "numeric" })],
        ["Classification",      "STRICTLY CONFIDENTIAL"],
      ];
      for (const [label, value] of detailLines) {
        doc.setFillColor(...LIGHT);
        doc.rect(margin, y, contentW, 9, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...MUTED);
        doc.text(label.toUpperCase(), margin + 3, y + 6);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...DARK);
        doc.text(String(value), margin + 55, y + 6);
        y += 10;
      }

      y += 10;
      doc.setFillColor(...NAVY);
      doc.roundedRect(margin, y, contentW, 22, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...GOLD);
      doc.text("CONFIDENTIALITY NOTICE", margin + 4, y + 7);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...WHITE);
      const notice = "This document contains confidential and proprietary information. Distribution is strictly limited to authorised recipients who have executed a Non-Disclosure Agreement. Any reproduction or disclosure without written consent is prohibited.";
      const noticeLines = doc.splitTextToSize(notice, contentW - 8);
      doc.text(noticeLines, margin + 4, y + 13);

      // ═══ PAGE 2 — EXECUTIVE SUMMARY ═══
      newPage("Executive Summary");
      y = 26;
      const kpiBoxW = (contentW - 8) / 3;
      const kpiItems = kpiStats.slice(0, 6);
      let kpiX = margin;
      let kpiY = y;
      kpiItems.forEach((stat, i) => {
        if (i > 0 && i % 3 === 0) { kpiY += 22; kpiX = margin; }
        addKPIBox(stat.label, stat.value, kpiX, kpiY, kpiBoxW, stat.positive);
        kpiX += kpiBoxW + 4;
      });
      y = kpiY + 24;
      y = addSectionHeading("Executive Summary", y);
      if (form.executive_summary) {
        y = addBodyText(sanitiseText(form.executive_summary), y);
      } else {
        doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(...MUTED);
        doc.text("No content generated yet. Use AI Draft to generate this section.", margin, y); y += 8;
      }

      // ═══ PAGE 3 — INVESTMENT THESIS ═══
      newPage("Investment Thesis");
      y = 26;
      y = addSectionHeading("Investment Thesis", y);
      if (form.investment_thesis) {
        const thesisBlocks = sanitiseText(form.investment_thesis).split(/\n\n+/);
        for (const block of thesisBlocks) {
          y = checkOverflow(y, 25, "Investment Thesis");
          const lines = block.trim().split("\n");
          const heading = lines[0] ?? "";
          const body = lines.slice(1).join(" ").trim();
          doc.setFillColor(...LIGHT);
          doc.roundedRect(margin, y, contentW, 7, 1, 1, "F");
          doc.setDrawColor(...GOLD);
          doc.rect(margin, y, 2, 7, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.setTextColor(...NAVY);
          doc.text(heading, margin + 5, y + 5);
          y += 9;
          if (body) {
            const bodyLines = doc.splitTextToSize(body, contentW);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(...DARK);
            doc.text(bodyLines, margin, y);
            y += bodyLines.length * 4.5 + 5;
          }
        }
      } else {
        doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(...MUTED);
        doc.text("No content generated yet.", margin, y); y += 8;
      }

      // ═══ PAGE 4 — MARKET OPPORTUNITY ═══
      newPage("Market Opportunity");
      y = 26;
      y = addSectionHeading("Market Opportunity", y);
      if (form.market_opportunity) {
        y = addBodyText(sanitiseText(form.market_opportunity), y);
      } else {
        doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(...MUTED);
        doc.text("No content generated yet.", margin, y); y += 8;
      }

      // ═══ PAGE 5 — FINANCIAL PERFORMANCE ═══
      newPage("Financial Performance");
      y = 26;
      y = addSectionHeading("Key Financial Metrics", y);
      const kpiTableData = kpiStats.map(s => [s.label, s.value, s.change ?? "", s.positive ? "▲" : "▼"]);
      autoTable(doc, {
        startY: y,
        head: [["Metric", "Value", "Change", "Trend"]],
        body: kpiTableData,
        theme: "grid",
        margin: { left: margin, right: margin },
        headStyles: { fillColor: NAVY, textColor: WHITE, fontSize: 8, fontStyle: "bold" },
        bodyStyles: { fontSize: 8.5, textColor: DARK },
        alternateRowStyles: { fillColor: LIGHT },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 65 },
          1: { cellWidth: 40, halign: "right" },
          2: { cellWidth: 35, halign: "right" },
          3: { cellWidth: 15, halign: "center" },
        },
        didParseCell: (data: any) => {
          if (data.column.index === 3 && data.section === "body") {
            const isPos = kpiStats[data.row.index]?.positive;
            data.cell.styles.textColor = isPos ? GREEN : AMBER;
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
      y = checkOverflow(y, 20, "Financial Performance");
      y = addSectionHeading("Financial Commentary", y);
      if (form.financial_commentary) {
        y = addBodyText(sanitiseText(form.financial_commentary), y);
      } else {
        doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(...MUTED);
        doc.text("No content generated yet.", margin, y); y += 8;
      }

      // ═══ PAGE 6 — RISK FACTORS ═══
      newPage("Risk Factors");
      y = 26;
      y = addSectionHeading("Risk Factors & Mitigants", y);
      if (form.risk_factors) {
        const riskBlocks = sanitiseText(form.risk_factors).split(/\n\n+/);
        for (const block of riskBlocks) {
          y = checkOverflow(y, 30, "Risk Factors");
          const riskMatch  = block.match(/RISK:\s*(.+)/i);
          const ctxMatch   = block.match(/CONTEXT:\s*([\s\S]+?)(?=MITIGANT:|$)/i);
          const mitigMatch = block.match(/MITIGANT:\s*([\s\S]+)/i);
          const riskName = riskMatch?.[1]?.trim() ?? block.split("\n")[0];
          const context  = ctxMatch?.[1]?.trim()   ?? "";
          const mitigant = mitigMatch?.[1]?.trim()  ?? "";

          doc.setFillColor(...NAVY);
          doc.roundedRect(margin, y, contentW, 7, 1, 1, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.setTextColor(...WHITE);
          doc.text(`▸ ${riskName}`, margin + 4, y + 5);
          y += 9;

          if (context) {
            doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
            doc.text("CONTEXT", margin, y); y += 4;
            const ctxLines = doc.splitTextToSize(context, contentW);
            doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...DARK);
            doc.text(ctxLines, margin, y);
            y += ctxLines.length * 4.2 + 2;
          }
          if (mitigant) {
            doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(...GREEN);
            doc.text("MITIGANT", margin, y); y += 4;
            const mitLines = doc.splitTextToSize(mitigant, contentW);
            doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...DARK);
            doc.text(mitLines, margin, y);
            y += mitLines.length * 4.2 + 6;
          }
        }
      } else {
        doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(...MUTED);
        doc.text("No content generated yet.", margin, y); y += 8;
      }

      // ═══ PAGE 7 — PROJECTIONS ═══
      newPage("Financial Projections");
      y = 26;
      y = addSectionHeading("Investment Opportunity", y);

      doc.setFillColor(...LIGHT);
      doc.roundedRect(margin, y, contentW, 22, 2, 2, "F");
      doc.setDrawColor(...GOLD);
      doc.setLineWidth(0.5);
      doc.line(margin, y, margin, y + 22);
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...MUTED);
      doc.text("CAPITAL SOUGHT", margin + 4, y + 6);
      doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(...NAVY);
      doc.text(settings.capitalSought, margin + 4, y + 16);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...DARK);
      const fundsLines = doc.splitTextToSize(`Structure: ${settings.proposedStructure}  |  Use: ${settings.useOfFunds}`, contentW - 55);
      doc.text(fundsLines, margin + 60, y + 10);
      y += 26;

      y = addSectionHeading("Basis of Projections", y);
      if (form.projections_rationale) {
        y = addBodyText(sanitiseText(form.projections_rationale), y);
      } else {
        doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(...MUTED);
        doc.text("No content generated yet.", margin, y); y += 8;
      }

      y = checkOverflow(y, 40, "Financial Projections");
      y = addSectionHeading("3-Year Financial Projection Summary", y);
      autoTable(doc, {
        startY: y,
        head: [["Metric", "Current YTD", "Year 1 (Proj.)", "Year 2 (Proj.)", "Year 3 (Proj.)"]],
        body: [
          ["Revenue",        settings.capitalSought !== "" ? "Live" : "—", "—", "—", "—"],
          ["Gross Profit",   "—", "—", "—", "—"],
          ["EBITDA",         "—", "—", "—", "—"],
          ["Net Profit",     "—", "—", "—", "—"],
        ],
        theme: "grid",
        margin: { left: margin, right: margin },
        headStyles: { fillColor: NAVY, textColor: WHITE, fontSize: 8, fontStyle: "bold" },
        bodyStyles: { fontSize: 8.5, textColor: MUTED, fontStyle: "italic" },
        alternateRowStyles: { fillColor: LIGHT },
        foot: [["* Projections to be completed by management prior to presentation"]],
        footStyles: { fontSize: 7, textColor: MUTED, fontStyle: "italic" },
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      // ═══ PAGE 8 — APPENDIX ═══
      newPage("Appendix");
      y = 26;
      y = addSectionHeading("Appendix — Data Sources & Disclaimer", y);
      const disclaimer = `The financial data presented in this Confidential Information Memorandum has been sourced directly from the Company's live business management system as at ${new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "long", year: "numeric" })}. All figures are unaudited and prepared for indicative purposes only.\n\nForward-looking statements, including financial projections and market estimates, involve known and unknown risks and uncertainties. Actual results may differ materially from those projected. This document does not constitute financial advice and should not be relied upon as the sole basis for any investment decision.\n\nRecipients of this document must have executed a Non-Disclosure Agreement prior to receiving this information. Unauthorised distribution is strictly prohibited.`;
      y = addBodyText(disclaimer, y);

      y = checkOverflow(y, 20, "Appendix");
      y = addSectionHeading("Glossary", y);
      const glossary = [
        ["EBITDA",    "Earnings Before Interest, Tax, Depreciation & Amortisation"],
        ["CIM",       "Confidential Information Memorandum"],
        ["YTD",       "Year to Date"],
        ["CAC",       "Customer Acquisition Cost"],
        ["Pipeline",  "Total value of active quoted opportunities"],
        ["Conversion","Percentage of quoted jobs that convert to won contracts"],
        ["COGS",      "Cost of Goods Sold — direct project costs"],
      ];
      autoTable(doc, {
        startY: y,
        head: [["Term", "Definition"]],
        body: glossary,
        theme: "grid",
        margin: { left: margin, right: margin },
        headStyles: { fillColor: NAVY, textColor: WHITE, fontSize: 8 },
        bodyStyles: { fontSize: 8.5 },
        alternateRowStyles: { fillColor: LIGHT },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 35 } },
      });

      const filename = `CIM_${settings.companyName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0,10)}.pdf`;
      doc.save(filename);
    } finally {
      setPdfGenerating(false);
    }
  };

  const completedCount = SECTIONS.filter(s => (form[s.key] ?? "").trim().length > 0).length;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 pb-10">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
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
          <Button
            onClick={generatePDF}
            disabled={pdfGenerating}
            variant="outline"
            className="gap-2 shrink-0 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
          >
            {pdfGenerating
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Building PDF...</>
              : <><FileText className="w-4 h-4" /> Download PDF</>
            }
          </Button>
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
