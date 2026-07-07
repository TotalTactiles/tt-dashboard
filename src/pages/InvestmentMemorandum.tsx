import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Send, RefreshCw, BrainCircuit, Paperclip, Crown } from "lucide-react";
import * as XLSX from "xlsx";
import DashboardLayout from "@/components/DashboardLayout";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  generateManagementReportPDF,
  type ManagementReport,
  type Commentary as ReportCommentary,
} from "@/lib/generateManagementReportPDF";

type PeriodKey = "month" | "quarter" | "ytd";

const WEBHOOK_URL = "https://n8n.srv1437130.hstgr.cloud/webhook/tt-accountant-ai";
const XERO_TOOL_WEBHOOK = "https://n8n.srv1437130.hstgr.cloud/webhook/tt-xero-tool";
const ACCOUNTING_DATA_WEBHOOK = "https://n8n.srv1437130.hstgr.cloud/webhook/tt-accounting-consultant";
const MGMT_REPORT_CACHE_KEY = "xero_mgmt_report";
const MAX_TOOL_ITERATIONS = 6;

const SYSTEM_PROMPT = `You are "The Consigliere" — the in-house financial adviser for Total Tactiles Pty Ltd, a Sydney commercial tactile-paving contractor. You combine a Deloitte senior accountant's rigour, a JP-Morgan-grade banker's judgement, and a trusted consigliere's directness.

You are given a JSON DATA CONTEXT each turn containing the company's live figures, including \`xero.managementReport\` (Balance Sheet, Aged Receivables, P&L — already reconciled to Xero), plus operational sheets (quotes, revenue, cashflow, stock).

RULES:
- The DATA CONTEXT (including the cached xero.managementReport baseline) is your first source of truth for simple questions — answer directly from it when the figure is already present.
- You have LIVE XERO TOOLS available (e.g. get_financial_report). Call a tool whenever a question needs a figure, period, or breakdown that is NOT already in the DATA CONTEXT. Prefer a tool call over guessing or over asking the user.
- NEVER ask the user to upload, export, attach, or paste anything. The financials are already provided or reachable via tools.
- Quote exact figures. Never invent or estimate numbers. If P&L revenue is 0 for a short period, state the period is early/partial rather than implying no sales.
- When asked for a "management report", summarise the figures already in xero.managementReport in your accountant's structure (Executive Summary → P&L → Balance Sheet → Aged Receivables) and note that the formatted PDF is available from the Management Report page. Do not fabricate a report.
- Read Aged Receivables with construction nuance: distinguish genuine lateness from retention residuals.
- Be direct and quantitative. Short, senior, decisive. Flag risks (DSCR, ATO liabilities, director loan drawdowns) when the numbers warrant. You are advisory, not a substitute for a signed tax opinion.

When you want to offer the user options, end your response with a new line starting with OPTIONS: followed by the choices comma-separated. Only use OPTIONS when there are clear discrete choices. Never use OPTIONS for open-ended questions.

Australian accounting standards apply. All currency is AUD. GST is 10%.

If the user's message is exactly "Let's Talk", respond only with: "Of course. What would you like to discuss?" — nothing else.

RESPONSE FORMATTING:
When presenting comparative data with 2+ items and numeric values, use a markdown table with | pipes. For simple lists or explanations, use plain paragraphs. Never use ## headers or ** bold.`;

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  buttons?: string[];
}

function buildDataContext(liveData: any, investorMetrics: any, accountingData?: any): string {
  const sections: string[] = [];

  // Prefer deep accounting data webhook over dashboard liveData
  const zoho = accountingData?.zoho ?? null;
  const sheets = accountingData?.sheets ?? null;
  const summary = accountingData?.summary ?? null;

  // --- Xero Management Report (source of truth: BS, AR, P&L reconciled to Xero) ---
  const mgmt = accountingData?.xero?.managementReport ?? accountingData?.managementReport ?? null;
  if (mgmt) {
    try {
      sections.push(`XERO MANAGEMENT REPORT (reconciled — Balance Sheet, Aged Receivables, P&L):\n${JSON.stringify(mgmt, null, 2)}`);
    } catch { /* skip */ }
  }

  // --- Accounting webhook summary block ---
  if (summary) {
    sections.push(`FINANCIAL SUMMARY (from accounting data feed):
- Total Revenue incl GST: $${(summary.totalRevIncGST ?? 0).toLocaleString("en-AU", { minimumFractionDigits: 0 })}
- Total Revenue excl GST: $${(summary.totalRevExGST ?? 0).toLocaleString("en-AU", { minimumFractionDigits: 0 })}
- Total COGS: $${(summary.totalCOGS ?? 0).toLocaleString("en-AU", { minimumFractionDigits: 0 })}
- Gross Profit: $${(summary.grossProfit ?? 0).toLocaleString("en-AU", { minimumFractionDigits: 0 })}
- Total Labour Hours Logged: ${summary.totalLabourHrs ?? 0}hrs @ $40/hr = $${(summary.totalLabourCost ?? 0).toLocaleString("en-AU", { minimumFractionDigits: 0 })}
- Deals by Stage: ${Object.entries(summary.dealsByStage ?? {}).map(([stage, val]: [string, any]) => `${stage}: ${val.count} deals, $${(val.value ?? 0).toLocaleString("en-AU", { minimumFractionDigits: 0 })}`).join(" | ")}`);
  }

  // --- Full Zoho CRM deals ---
  if (zoho?.deals?.length > 0) {
    const deals = zoho.deals;
    sections.push(`ZOHO CRM — ALL DEALS (${deals.length} total):
${deals.map((d: any) => `• ${d.Deal_Name ?? d.Company ?? "?"} | Stage: ${d.Stage ?? "?"} | Value: $${(parseFloat(d.Contract_Value ?? d.Amount ?? 0)).toLocaleString("en-AU")} | Closing: ${d.Closing_Date ?? "?"} | Costs: $${d.Total_Costs ?? "?"} | Stock: ${d.Stock_Required ?? "none"} | Next: ${d.Next_Step ?? "-"}`).join("\n")}`);
  }

  // --- Zoho Projects ---
  if (zoho?.projects?.length > 0) {
    sections.push(`ZOHO PROJECTS (${zoho.projects.length} active):
${zoho.projects.map((p: any) => `• ${p.name ?? p.id} | Status: ${p.status?.name ?? "?"} | Owner: ${p.owner?.name ?? "?"}`).join("\n")}`);
  }

  // --- Stock & Inventory ---
  if (sheets?.stock?.length > 0) {
    sections.push(`STOCK & INVENTORY (${sheets.stock.length} items): ${sheets.stock.slice(0, 20).map((s: any) => `${s["Description"] ?? s["Product Code"] ?? "?"}: Qty ${s["Current Inventory"] ?? "?"}, Value $${s["Total Value"] ?? "?"}`).join("; ")}`);
  }

  try {
    const revenue = liveData?.revenue ?? [];
    const revenueItems = revenue.filter((r: any) => r?._label_isLineItem === true);
    if (revenueItems.length > 0) {
      const totalRev = revenueItems.reduce((s: number, r: any) => s + (parseFloat(r._label_value) || 0), 0);
      const totalCOGS = revenueItems.reduce((s: number, r: any) => s + (parseFloat(r._label_totalCost) || 0), 0);
      sections.push(`REVENUE & COGS (${revenueItems.length} projects):
- Total Revenue (incl GST): $${totalRev.toLocaleString("en-AU", { minimumFractionDigits: 0 })}
- Total COGS: $${totalCOGS.toLocaleString("en-AU", { minimumFractionDigits: 0 })}
- Gross Profit: $${(totalRev / 1.1 - totalCOGS).toLocaleString("en-AU", { minimumFractionDigits: 0 })}
${revenueItems.map((r: any) => {
  const val = parseFloat(r._label_value) || 0;
  const cogs = parseFloat(r._label_totalCost) || 0;
  const gp = val / 1.1 - cogs;
  return `• ${r._label_company ?? "?"} / ${r._label_project ?? "?"} — Revenue: $${val.toLocaleString("en-AU")} | COGS: $${cogs.toLocaleString("en-AU")} | GP: $${gp.toLocaleString("en-AU")} (Stage: ${r._label_projectStage ?? "?"}, Labour: $${r._label_labourCost ?? 0}, Tactile: $${r._label_tactileCost ?? 0}, Other: $${r._label_otherCost ?? 0})`;
}).join("\n")}`);
    }
  } catch { /* skip */ }

  // Full quotes detail
  const quotesRaw: any[] = accountingData?.sheets?.quotes ?? [];
  if (quotesRaw.length > 0) {
    const sorted = [...quotesRaw].sort((a: any, b: any) => {
      const av = parseFloat(String(
        a['Contract Value ($)'] ?? a['Contract Value'] ??
        a['Stage Value ($)'] ?? 0
      ).replace(/[^0-9.-]/g, '')) || 0;
      const bv = parseFloat(String(
        b['Contract Value ($)'] ?? b['Contract Value'] ??
        b['Stage Value ($)'] ?? 0
      ).replace(/[^0-9.-]/g, '')) || 0;
      return bv - av;
    });
    const won = sorted.filter((q: any) => {
      const s = String(q['Current Status'] ?? q['Status'] ?? '').toLowerCase();
      return s.includes('won') || s.includes('awarded') || s.includes('completed');
    });
    const active = sorted.filter((q: any) => {
      const s = String(q['Current Status'] ?? q['Status'] ?? '').toLowerCase();
      return !s.includes('lost') && !s.includes('dead') &&
             !s.includes('won') && !s.includes('completed');
    });
    const lost = sorted.filter((q: any) => {
      const s = String(q['Current Status'] ?? q['Status'] ?? '').toLowerCase();
      return s.includes('lost') || s.includes('dead');
    });
    const totalPipeline = active.reduce((s: number, q: any) => {
      const v = parseFloat(String(
        q['Contract Value ($)'] ?? q['Contract Value'] ??
        q['Stage Value ($)'] ?? 0
      ).replace(/[^0-9.-]/g, '')) || 0;
      return s + v;
    }, 0);
    const formatQuote = (q: any) => {
      const val = parseFloat(String(
        q['Contract Value ($)'] ?? q['Contract Value'] ??
        q['Stage Value ($)'] ?? 0
      ).replace(/[^0-9.-]/g, '')) || 0;
      const company = String(
        q['Company Name'] ?? q['_company'] ?? ''
      ).trim();
      const project = String(
        q['Project Name'] ?? q['_project'] ?? ''
      ).trim();
      const status = String(
        q['Current Status'] ?? q['Stage'] ?? ''
      ).trim();
      const date = String(
        q['Estimated Job Date'] ?? q['Date Quoted'] ?? ''
      ).trim();
      return `• ${company} / ${project} — $${val.toLocaleString('en-AU')} | ${status} | ${date}`;
    };
    sections.push(`QUOTES PIPELINE (${quotesRaw.length} total):
Won/Completed: ${won.length} deals
Active pipeline: ${active.length} deals, total value: $${totalPipeline.toLocaleString('en-AU')}
Lost/Dead: ${lost.length} deals
TOP 30 ACTIVE QUOTES (by value):
${active.slice(0, 30).map(formatQuote).join('\n')}
RECENT WON DEALS (last 15):
${won.slice(0, 15).map(formatQuote).join('\n')}`);
  }

  // Full raw cashflow tab — all rows and month columns
  const cfRaw: any[] = accountingData?.sheets?.cashflow ?? [];
  if (cfRaw.length > 0) {
    const firstRow = cfRaw[0];
    const monthCols = Object.keys(firstRow).filter(k =>
      k !== 'row_number' && k !== 'col_1' && !k.startsWith('_')
    );
    const rowLines = cfRaw
      .filter(r => r.col_1 && String(r.col_1).trim())
      .map(r => {
        const label = String(r.col_1).trim();
        const values = monthCols
          .map(m => {
            const v = r[m];
            if (v === '' || v === null || v === undefined) return null;
            const num = parseFloat(String(v));
            if (isNaN(num) || num === 0) return null;
            return `${m}: $${num.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;
          })
          .filter(Boolean)
          .join(' | ');
        return values ? `${label}: ${values}` : null;
      })
      .filter(Boolean);
    sections.push(`CASHFLOW TAB — ALL ROWS (months: ${monthCols.join(', ')}):
${rowLines.join('\n')}`);
  } else {
    // Fallback to dashboard cashflow summary
    const cfSummary = accountingData?.sheets?.cashflowSummary ?? [];
    if (cfSummary.length > 0) {
      sections.push(`CASHFLOW SUMMARY (${cfSummary.length} months):
${cfSummary.map((m: any) =>
  `${m.month ?? m.Month}: Income $${m.income ?? m.totalIncome ?? 0} | Outgoings $${m.outgoings ?? m.totalOutgoings ?? 0} | Closing $${m.closing ?? m.closingBalance ?? 0}`
).join('\n')}`);
    }
  }

  // Full expense line items
  const expRaw: any[] = accountingData?.sheets?.expenses ?? [];
  const expItems = expRaw.filter((r: any) => {
    const sub = String(r['Sub-Category'] ?? r['Name'] ?? '').trim();
    const cat = String(r['Category'] ?? '').trim().toUpperCase();
    return sub &&
      sub.toUpperCase() !== 'TOTAL' &&
      sub.toUpperCase() !== 'GRAND TOTAL' &&
      cat !== 'GRAND TOTAL';
  });
  if (expItems.length > 0) {
    const totalMonthly = expItems.reduce((s: number, r: any) => {
      const v = parseFloat(String(r['Monthly Cost'] ?? r['Monthly'] ?? 0)
        .replace(/[^0-9.-]/g, ''));
      return s + (isNaN(v) ? 0 : v);
    }, 0);
    sections.push(`OPERATING EXPENSES — LINE ITEMS (${expItems.length} items):
Total monthly: $${totalMonthly.toLocaleString('en-AU', { maximumFractionDigits: 0 })}
${expItems.map((r: any) => {
  const cat = String(r['Category'] ?? 'Uncategorised').trim();
  const sub = String(r['Sub-Category'] ?? r['Name'] ?? '').trim();
  const monthly = parseFloat(String(r['Monthly Cost'] ?? 0)
    .replace(/[^0-9.-]/g, '')) || 0;
  const yearly = parseFloat(String(r['Yearly Cost'] ?? 0)
    .replace(/[^0-9.-]/g, '')) || 0;
  const pct = totalMonthly > 0
    ? ((monthly / totalMonthly) * 100).toFixed(1)
    : '0.0';
  return `[${cat}] ${sub}: $${monthly.toLocaleString('en-AU', { maximumFractionDigits: 0 })}/mo | $${yearly.toLocaleString('en-AU', { maximumFractionDigits: 0 })}/yr | ${pct}% of expenses`;
}).join('\n')}`);
  }

  try {
    if (investorMetrics) {
      const im = investorMetrics as any;
      sections.push(`INVESTOR METRICS:
- Revenue ex GST: ${im.revenueExGSTFormatted ?? "N/A"}
- Gross Margin: ${im.grossMarginPctFormatted ?? "N/A"}
- EBITDA: ${im.ebitdaFormatted ?? "N/A"}
- Pipeline Coverage: ${im.pipelineCoverageFormatted ?? "N/A"}
- Avg Contract Value (won): ${im.avgContractValueWonFormatted ?? "N/A"}
- YTD Total Expenses: ${im.ytdTotalExpenses ? "$" + im.ytdTotalExpenses.toLocaleString("en-AU") : "N/A"}`);
    }
  } catch { /* skip */ }

  return sections.length > 0
    ? `\n\n--- LIVE BUSINESS DATA ---\n${sections.join("\n\n")}\n--- END DATA ---`
    : "\n\n(No live data currently available — answer based on user-provided information only)";
}



const CACHE_WEBHOOK = "https://n8n.srv1437130.hstgr.cloud/webhook/dashboard-cache";

async function getDebtRegister(): Promise<any[]> {
  try {
    const res = await fetch(CACHE_WEBHOOK);
    const rows: Array<{ key: string; value: string }> = await res.json();
    const row = rows.find((r) => r.key === "tt_debt_register");
    if (row?.value) {
      const parsed = JSON.parse(row.value);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  try {
    const saved = localStorage.getItem("tt_debt_register");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function computeDebtTotals(register: any[]) {
  let totalDebt = 0;
  let totalMonthlyRepayment = 0;
  let weighted = 0;
  for (const d of register) {
    const bal = parseFloat(String(d?.balanceOutstanding ?? d?.balance ?? 0)) || 0;
    const repay = parseFloat(String(d?.monthlyRepayment ?? d?.repayment ?? 0)) || 0;
    const rate = parseFloat(String(d?.interestRate ?? d?.rate ?? 0)) || 0;
    totalDebt += bal;
    totalMonthlyRepayment += repay;
    weighted += bal * rate;
  }
  const blendedRate = totalDebt > 0 ? weighted / totalDebt : 0;
  return { totalDebt, totalMonthlyRepayment, blendedRate };
}

// Raw AI proxy call — returns Anthropic-style { stop_reason, content }.
async function callAIRaw(
  system: string,
  messages: any[],
  extra: { message?: string; mode: string; context: Record<string, any> }
): Promise<{ stop_reason: string; content: any[] }> {
  const response = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, messages, ...extra }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  const content = Array.isArray(data?.content)
    ? data.content
    : (data?.text || data?.reply)
      ? [{ type: "text", text: data.text ?? data.reply }]
      : [];
  const stop_reason = data?.stop_reason ?? (content.some((b: any) => b?.type === "tool_use") ? "tool_use" : "end_turn");
  return { stop_reason, content };
}

// Execute one tool_use block against the tt-xero-tool executor via n8n-proxy.
async function runXeroTool(name: string, input: any): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke("n8n-proxy", {
      body: {
        webhookUrl: XERO_TOOL_WEBHOOK,
        payload: { tool: name, input },
      },
    });
    if (error) return `Tool ${name} error: ${error.message ?? String(error)}`;
    if (data?._proxyError) return `Tool ${name} error: ${data.error ?? "proxy failure"}`;
    if (typeof data === "string") return data;
    return JSON.stringify(data ?? {});
  } catch (err: any) {
    return `Tool ${name} exception: ${err?.message ?? String(err)}`;
  }
}

// Agentic loop: keep calling the model, execute tool_use blocks, feed results back,
// until end_turn or the iteration cap is reached. Returns the final joined text.
async function runAgenticLoop(
  system: string,
  initialMessages: any[],
  extra: { message?: string; mode: string; context: Record<string, any> }
): Promise<string> {
  const conversation: any[] = [...initialMessages];
  for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
    const { stop_reason, content } = await callAIRaw(system, conversation, extra);
    if (stop_reason !== "tool_use") {
      return content
        .filter((b: any) => b?.type === "text")
        .map((b: any) => b.text)
        .join("\n")
        .trim() || "No response received.";
    }
    // Append assistant turn with tool_use blocks intact.
    conversation.push({ role: "assistant", content });
    // Execute every tool_use block, gather tool_result entries.
    const toolUses = content.filter((b: any) => b?.type === "tool_use");
    const toolResults = await Promise.all(
      toolUses.map(async (b: any) => ({
        type: "tool_result",
        tool_use_id: b.id,
        content: await runXeroTool(b.name, b.input),
      }))
    );
    conversation.push({ role: "user", content: toolResults });
  }
  // Cap hit — request a final answer with no more tools.
  const { content } = await callAIRaw(system, conversation, extra);
  return content
    .filter((b: any) => b?.type === "text")
    .map((b: any) => b.text)
    .join("\n")
    .trim() || "Tool loop reached the iteration cap without a final answer.";
}



function welcomeFor(): Message {
  return {
    role: "assistant",
    content: "The Consigliere is ready. I see everything — your books, your debt, your pipeline, your cashflow. Ask me anything. I'll give you the answer your accountant and banker would give if they were the same person.",
    timestamp: new Date(),
    buttons: ["Financial Review", "Let's Talk"],
  };
}

const WELCOME_MESSAGE: Message = welcomeFor();

export default function ConsultingPage() {
  const { liveData, investorMetrics, hasLiveData } = useDashboardData() as any;
  const [messages, setMessages] = useState<Message[]>([welcomeFor()]);
  const [input, setInput] = useState("");
  const location = useLocation();
  useEffect(() => {
    const prefill = (location.state as any)?.prefill;
    if (typeof prefill === "string" && prefill.trim()) {
      setInput(prefill);
      // Clear location state so refresh doesn't re-inject
      window.history.replaceState({}, "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [loading, setLoading] = useState(false);
  const [accountingData, setAccountingData] = useState<any>(null);
  const [accountingDataLoading, setAccountingDataLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    type: "pdf" | "excel" | "csv";
    content: string;
    size: string;
  } | null>(null);
  const [reportMode, setReportMode] = useState(false);
  const [reportData, setReportData] = useState<Record<string, any>>({});
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const [commandFilter, setCommandFilter] = useState("");

  function periodLabelOf(k: PeriodKey) {
    return k === "month" ? "Monthly" : k === "quarter" ? "Quarterly" : "YTD";
  }

  async function fetchManagementReport(): Promise<ManagementReport | null> {
    // Try live cache first, fall back to localStorage.
    try {
      const res = await fetch(CACHE_WEBHOOK);
      const rows = await res.json();
      const list: any[] = Array.isArray(rows) ? rows : Array.isArray(rows?.rows) ? rows.rows : [];
      const row = list.find((r) => r?.key === "xero_management_report");
      if (row?.value) {
        const mr = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
        if (mr) {
          try { localStorage.setItem(MGMT_REPORT_CACHE_KEY, JSON.stringify(mr)); } catch { /* ignore */ }
          return mr as ManagementReport;
        }
      }
    } catch { /* fall through */ }
    try {
      const raw = localStorage.getItem(MGMT_REPORT_CACHE_KEY);
      if (raw) return JSON.parse(raw) as ManagementReport;
    } catch { /* ignore */ }
    return null;
  }

  function startReportFlow() {
    setReportMode(true);
    setReportData({});
    setMessages(prev => [...prev, {
      role: "assistant",
      content: "I'll generate a Management Report from live Xero data.\n\nWhich period?",
      timestamp: new Date(),
      buttons: ["Monthly", "Quarterly", "YTD"]
    }]);
  }

  async function handleReportFlow(userText: string) {
    let periodKey: PeriodKey | null = null;
    if (userText === "Monthly") periodKey = "month";
    else if (userText === "Quarterly") periodKey = "quarter";
    else if (userText === "YTD") periodKey = "ytd";

    if (!periodKey) {
      // Unrecognised — bail out of report mode and treat as normal input.
      setReportMode(false);
      setReportData({});
      await sendMessage(userText);
      return;
    }

    setMessages(prev => [...prev,
      { role: "user", content: userText, timestamp: new Date() },
      { role: "assistant", content: `Generating your ${periodLabelOf(periodKey!)} Management Report from live Xero data…`, timestamp: new Date() }
    ]);

    await generateManagementReport(periodKey);
  }

  async function fetchCommentary(mr: ManagementReport, periodKey: PeriodKey): Promise<ReportCommentary> {
    const analysisSystem = `You are The Consigliere — Total Tactiles' senior accountant and financial adviser (Deloitte-grade rigour, banker's judgement). Using ONLY the figures in the managementReport JSON provided by the user, return STRICT JSON with no markdown fences and no prose outside the JSON object, in exactly this shape:
{ "execSummary": string, "pnl": string, "balanceSheet": string, "agedReceivables": string }
Each value: 3–5 sentences quoting the real figures, ending with one concrete recommendation. Where relevant, note the accrual-vs-cash gap (income invoiced vs cash received), the receivables concentration in the top two debtors, and the ATO liabilities position. Never invent numbers not present in the JSON.`;
    const userTurn = { role: "user", content: JSON.stringify(mr) };

    const attempt = async (): Promise<ReportCommentary | null> => {
      const { content } = await callAIRaw(analysisSystem, [userTurn], {
        mode: "consigliere-analysis",
        context: { source: "consigliere", mode: "consigliere-analysis", managementReport: mr, periodKey },
      });
      const text = content.filter((b: any) => b?.type === "text").map((b: any) => b.text).join("\n").trim();
      const stripped = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
      const jsonMatch = stripped.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        const pick = (k: string) => (typeof parsed[k] === "string" ? parsed[k] : "");
        return {
          execSummary: pick("execSummary"),
          pnl: pick("pnl"),
          balanceSheet: pick("balanceSheet"),
          agedReceivables: pick("agedReceivables"),
        };
      } catch {
        return null;
      }
    };

    try {
      const first = await attempt();
      if (first) return first;
      const second = await attempt();
      if (second) return second;
      toast.error("Commentary unavailable — report generated without analysis");
      return {};
    } catch {
      toast.error("Commentary unavailable — report generated without analysis");
      return {};
    }
  }

  async function generateManagementReport(periodKey: PeriodKey) {
    const mr = await fetchManagementReport();
    if (!mr) {
      setReportMode(false);
      setReportData({});
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "I couldn't load the Xero management report cache. Try again in a moment, or open the Management Report page and hit Refresh.",
        timestamp: new Date(),
      }]);
      return;
    }

    setLoading(true);
    setMessages(prev => [...prev, {
      role: "assistant",
      content: "Consigliere is analysing the figures…",
      timestamp: new Date(),
    }]);

    const commentary = await fetchCommentary(mr, periodKey);

    const filename = `TT_Management_Report_${periodKey}.pdf`;
    try {
      generateManagementReportPDF(mr, periodKey, commentary);
    } catch (err: any) {
      setLoading(false);
      setReportMode(false);
      setReportData({});
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `PDF generation failed: ${err?.message ?? String(err)}`,
        timestamp: new Date(),
      }]);
      return;
    }

    setLoading(false);
    setReportData({ periodKey, mr, commentary });
    setReportMode(false);
    setMessages(prev => [...prev, {
      role: "assistant",
      content: `Management Report (${periodLabelOf(periodKey)}) downloaded as ${filename} — commentary included under each section.\n\nWant a deeper written analysis in-chat?`,
      timestamp: new Date(),
      buttons: ["Yes, analyse the report", "No thanks"],
    }]);
  }

  async function analyseAndRegenerate() {
    const mr: ManagementReport | undefined = reportData?.mr;
    const periodKey: PeriodKey | undefined = reportData?.periodKey;
    if (!mr || !periodKey) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "I don't have the last report in memory anymore — please regenerate it first.",
        timestamp: new Date(),
      }]);
      return;
    }

    setLoading(true);
    setMessages(prev => [...prev, {
      role: "assistant",
      content: "Consigliere is analysing the figures…",
      timestamp: new Date(),
    }]);

    const commentary = await fetchCommentary(mr, periodKey);

    const filename = `TT_Management_Report_${periodKey}.pdf`;
    try {
      generateManagementReportPDF(mr, periodKey, commentary);
    } catch (err: any) {
      setLoading(false);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `Annotated PDF generation failed: ${err?.message ?? String(err)}`,
        timestamp: new Date(),
      }]);
      return;
    }

    setLoading(false);
    setMessages(prev => [...prev, {
      role: "assistant",
      content: Object.values(commentary).some(Boolean)
        ? `Annotated Management Report downloaded as ${filename} — commentary refreshed under each section.`
        : `Regenerated the report as ${filename}, but commentary was unavailable. Try again shortly.`,
      timestamp: new Date(),
    }]);
  }


  async function handleFileAttach(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase();
    const sizeMB = (file.size / 1024 / 1024).toFixed(2);
    if (ext === 'pdf') {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        setAttachedFile({ name: file.name, type: "pdf", content: base64, size: `${sizeMB}MB` });
      };
      reader.readAsDataURL(file);
    } else if (['xlsx', 'xls'].includes(ext ?? '')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const csvParts: string[] = [];
        workbook.SheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          if (csv.trim()) csvParts.push(`Sheet: ${sheetName}\n${csv}`);
        });
        setAttachedFile({ name: file.name, type: "excel", content: csvParts.join('\n\n'), size: `${sizeMB}MB` });
      };
      reader.readAsArrayBuffer(file);
    } else if (ext === 'csv') {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachedFile({ name: file.name, type: "csv", content: reader.result as string, size: `${sizeMB}MB` });
      };
      reader.readAsText(file);
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setAccountingDataLoading(true);
      try {
        const res = await fetch(ACCOUNTING_DATA_WEBHOOK);
        const raw = await res.json();
        const data = Array.isArray(raw) ? raw[0] : raw;
        if (!cancelled) setAccountingData(data);
        console.log('[ACCOUNTANT DEBUG] accountingData keys:', Object.keys(data ?? {}));
        console.log('[ACCOUNTANT DEBUG] sheets keys:', Object.keys(data?.sheets ?? {}));
        console.log('[ACCOUNTANT DEBUG] cashflow rows:', (data?.sheets?.cashflow ?? []).length);
        console.log('[ACCOUNTANT DEBUG] expenses rows:', (data?.sheets?.expenses ?? []).length);
        console.log('[ACCOUNTANT DEBUG] quotes rows:', (data?.sheets?.quotes ?? []).length);
        console.log('[ACCOUNTANT DEBUG] full data sample:', JSON.stringify(data).slice(0, 500));
      } catch {
        // silently fail — dashboard liveData will be used as fallback
      } finally {
        if (!cancelled) setAccountingDataLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function renderMessageContent(text: string): React.ReactNode {
    // Remove markdown headers and bold but keep content
    const cleaned = text
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/^[-–—]{3,}\s*$/gm, '')
      .replace(/^>\s+/gm, '');

    // Split into segments — detect markdown table blocks
    const segments: React.ReactNode[] = [];
    const lines = cleaned.split('\n');
    let i = 0;
    let currentText: string[] = [];

    const flushText = () => {
      if (currentText.length > 0) {
        const t = currentText.join('\n').trim();
        if (t) segments.push(
          <span key={segments.length} className="whitespace-pre-wrap">{t}</span>
        );
        currentText = [];
      }
    };

    while (i < lines.length) {
      const line = lines[i];
      // Detect start of markdown table (line with | chars)
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        // Collect all table lines
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          tableLines.push(lines[i]);
          i++;
        }
        // Parse table
        const rows = tableLines
          .filter(l => !l.match(/^\|[\s\-:|]+\|/)) // remove separator rows
          .map(l =>
            l.trim()
              .replace(/^\|/, '')
              .replace(/\|$/, '')
              .split('|')
              .map(cell => cell.trim())
          )
          .filter(row => row.some(cell => cell.length > 0));

        if (rows.length > 0) {
          flushText();
          const headers = rows[0];
          const body = rows.slice(1);
          segments.push(
            <div key={segments.length} className="overflow-x-auto my-2 rounded-lg border border-border/40">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-primary/10 border-b border-border/40">
                    {headers.map((h, hi) => (
                      <th key={hi} className="px-3 py-2 text-left font-semibold text-primary">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {body.map((row, ri) => (
                    <tr key={ri} className={ri % 2 === 0 ? 'bg-muted/20' : 'bg-muted/10'}>
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-3 py-2 text-foreground/90">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
      } else {
        currentText.push(line);
        i++;
      }
    }
    flushText();

    return <>{segments}</>;
  }

  function parseResponseAndButtons(raw: string): { content: string; buttons?: string[] } {
    const optionsMatch = raw.match(/\nOPTIONS:\s*(.+)$/);
    if (optionsMatch) {
      const buttons = optionsMatch[1].split(",").map((s) => s.trim()).filter(Boolean);
      const content = raw.replace(/\nOPTIONS:\s*.+$/, "").trim();
      return { content, buttons };
    }
    return { content: raw };
  }

  async function sendMessage(overrideText?: string) {
    const trimmed = (overrideText ?? input).trim();
    if (!trimmed || loading) return;
    if (!overrideText) setInput("");
    if (/^generate management report/i.test(trimmed) && !reportMode) {
      startReportFlow();
      return;
    }
    if (trimmed === "Yes, analyse the report") {
      setMessages(prev => [...prev, { role: "user", content: trimmed, timestamp: new Date() }]);
      await analyseAndRegenerate();
      return;
    }
    if (trimmed === "No thanks" && reportData?.mr) {
      setMessages(prev => [...prev,
        { role: "user", content: trimmed, timestamp: new Date() },
        { role: "assistant", content: "Understood — report is in your downloads. Anything else?", timestamp: new Date() },
      ]);
      setReportData({});
      return;
    }
    if (reportMode && trimmed !== "Let's Talk" && trimmed !== "Financial Review") {
      await handleReportFlow(trimmed);
      return;
    }
    if (trimmed === "Let's Talk") {
      setMessages(prev => [...prev,
        { role: "user", content: trimmed, timestamp: new Date() },
        { role: "assistant", content: "Of course. What would you like to discuss?", timestamp: new Date() }
      ]);
      return;
    }
    const userMessage: Message = { role: "user", content: trimmed, timestamp: new Date() };
    const updated = [...messages, userMessage];
    setMessages(updated);
    setLoading(true);
    const dataContext = buildDataContext(liveData, investorMetrics, accountingData);
    const apiMessages = updated.slice(-20).map((m, idx, arr) => {
      if (m.role === "user" && idx === arr.length - 1 && attachedFile) {
        if (attachedFile.type === "pdf") {
          return {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: attachedFile.content
                }
              },
              { type: "text", text: m.content }
            ]
          };
        } else {
          return {
            role: "user",
            content: `[Attached file: ${attachedFile.name}]\n\n${attachedFile.content}\n\n---\n${m.content}`
          };
        }
      }
      return { role: m.role, content: m.content };
    });
    try {
      const debtRegister = await getDebtRegister();
      const debtTotals = computeDebtTotals(debtRegister);
      const text = await runAgenticLoop(SYSTEM_PROMPT + dataContext, apiMessages as any, {
        message: trimmed,
        mode: "consigliere",
        context: {
          source: "consigliere",
          mode: "consigliere",
          debtRegister,
          debtTotals,
          liveData,
          investorMetrics,
          accountingData,
        },
      });
      const parsed = parseResponseAndButtons(text);
      setMessages((prev) => [...prev, { role: "assistant", content: parsed.content, buttons: parsed.buttons, timestamp: new Date() }]);
      setAttachedFile(null);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Request failed. Check your connection.", timestamp: new Date() }]);
    } finally {
      setLoading(false);
    }
  }

  function clearSession() {
    setMessages([welcomeFor()]);
  }


  const ACCOUNTANT_COMMANDS = [
    { id: "report-monthly", label: "Generate Monthly Management Report", description: "P&L, Executive Summary, Pipeline — downloadable PDF", icon: "📊" },
    { id: "health-check", label: "Full Financial Health Check", description: "Gross margin, cashflow, pipeline coverage, top risks", icon: "🏥" },
    { id: "breakeven", label: "Break-Even Analysis", description: "Monthly break-even revenue based on current cost structure", icon: "⚖️" },
    { id: "pipeline-review", label: "Pipeline Review", description: "Ranked open quotes with conversion probability assessment", icon: "🔍" },
    { id: "cashflow-forecast", label: "Cashflow Forecast", description: "Forward cashflow based on pipeline and expense run rate", icon: "📈" },
    { id: "expense-review", label: "Expense Review", description: "Cost structure breakdown and reduction opportunities", icon: "💸" },
    { id: "margin-analysis", label: "Project Margin Analysis", description: "Best and worst performing projects by gross margin", icon: "📉" },
    { id: "tax-position", label: "Tax Position Summary", description: "GST, income tax and ATO obligations overview", icon: "🧾" },
  ];

  const FINANCIER_COMMANDS = [
    { id: "fin-debt-capacity", label: "Debt Capacity", description: "How much additional debt the business can responsibly carry", icon: "📊" },
    { id: "fin-refinance", label: "Refinance Analysis", description: "Rate, balance and remaining term across current facilities", icon: "🔄" },
    { id: "fin-paydown", label: "Pay-Down Priority", description: "Which facility to prioritise paying down and why", icon: "💰" },
    { id: "fin-stress", label: "Stress Test", description: "Debt serviceability if revenue drops 20%", icon: "⚠️" },
    { id: "fin-equity", label: "Equity Position", description: "Net equity and debt-to-equity implications", icon: "📈" },
  ];

  const CONSIGLIERE_COMMANDS = [
    { id: "con-full-position", label: "Full Position", description: "Complete picture — revenue, debt, cashflow, focus areas", icon: "🎯" },
    { id: "con-biggest-risk", label: "Biggest Risk", description: "Single biggest financial risk and what to do about it", icon: "⚡" },
    { id: "con-growth", label: "Growth Capacity", description: "Can we take on more work and more debt? What's the ceiling?", icon: "📊" },
    { id: "con-lender", label: "Lender View", description: "What a bank would think of our numbers today", icon: "🏦" },
    { id: "con-real-profit", label: "Real Profit", description: "After all costs, debt, tax and drawings — what we actually keep", icon: "🧮" },
  ];

  const COMMANDS = [
    ...ACCOUNTANT_COMMANDS,
    ...FINANCIER_COMMANDS,
    ...CONSIGLIERE_COMMANDS,
  ];

  function selectCommand(cmd: typeof COMMANDS[0]) {
    setShowCommandMenu(false);
    setCommandFilter("");
    setInput("");

    if (cmd.id === "report-monthly") {
      startReportFlow();
      return;
    }

    const prompts: Record<string, string> = {
      "health-check": "Give me a full financial health check of the business. I want gross margin, net margin, cashflow position, pipeline coverage, cost structure breakdown, and your top 3 risks you can see in the numbers right now.",
      "breakeven": "What is our current gross margin percentage and based on our expense structure, what is our monthly break-even revenue requirement? Show your working.",
      "pipeline-review": "Review our full pipeline. Rank all open quotes by value, identify which are most likely to convert based on stage and timing, and flag any that appear stalled or at risk.",
      "cashflow-forecast": "Based on our current pipeline, expected invoice dates, and monthly expense run rate, give me a forward cashflow forecast for the next 3 months. Flag any months where we may face a cash shortfall.",
      "expense-review": "Give me a full breakdown of our operating expense structure. Identify our top 5 cost categories, flag any that appear unusually high for a business of our revenue size, and identify any reduction opportunities.",
      "margin-analysis": "Analyse all our current projects by gross margin. Show me the top 5 best performers and bottom 5 worst performers with their COGS breakdown. Flag any loss-making projects.",
      "tax-position": "Summarise our current tax position. Based on our revenue and expense data, estimate our GST liability, income tax position, and flag any ATO obligations we should be aware of. Search for current ATO rates if needed.",
      "fin-debt-capacity": "How much additional debt could the business responsibly take on given current cashflow and GP?",
      "fin-refinance": "Should we consider refinancing any current facilities? Analyse rate, balance and remaining term.",
      "fin-paydown": "Which debt facility should we prioritise paying down first and why?",
      "fin-stress": "What happens to our debt serviceability if revenue drops 20%? Can we still meet repayments?",
      "fin-equity": "Estimate our net equity position and what the debt-to-equity ratio implies for business health.",
      "con-full-position": "Give me a complete picture of where the business stands right now — revenue, debt, cashflow, and what I should be focused on.",
      "con-biggest-risk": "What is the single biggest financial risk to this business right now and what should we do about it?",
      "con-growth": "Can this business take on more work and more debt right now? What's the ceiling?",
      "con-lender": "If a bank was looking at our numbers today, what would they think? Would they lend to us?",
      "con-real-profit": "After all costs, debt, tax and drawings, what is the business actually making and keeping?",
    };

    const promptText = prompts[cmd.id] ?? cmd.label;
    sendMessage(promptText);
  }

  const formatTime = (d: Date) => d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-7rem)] max-w-4xl mx-auto w-full px-4 gap-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Crown className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">The Consigliere</h1>
              <p className="text-[11px] text-muted-foreground italic">
                Your books. Your pipeline. Your position. One mind.
              </p>
              <p className="text-[10px] text-muted-foreground/60">
                {accountingDataLoading
                  ? "Loading financial data..."
                  : accountingData
                    ? "Live data connected · AUD · GST 10%"
                    : hasLiveData
                      ? "Dashboard data connected · AUD · GST 10%"
                      : "Connecting..."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={clearSession} disabled={loading}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              New session
            </Button>
          </div>
        </div>



        {/* Chat window */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                  <BrainCircuit className="w-3.5 h-3.5 text-primary" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-lg px-3.5 py-2.5 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted/50 border border-border/40 text-foreground"}`}>
                <div className="whitespace-pre-wrap leading-relaxed">
                  {msg.role === 'assistant'
                    ? renderMessageContent(msg.content)
                    : msg.content
                  }
                </div>
                {msg.buttons && i === messages.length - 1 && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {msg.buttons.map((btn) => (
                      <button
                        key={btn}
                        onClick={() => { if (reportMode) { handleReportFlow(btn); } else { sendMessage(btn); } }}
                        disabled={loading}
                        className="px-4 py-1.5 rounded-lg text-sm font-medium border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-40"
                      >
                        {btn}
                      </button>
                    ))}
                  </div>
                )}
                <div className={`text-[10px] mt-1.5 font-mono ${msg.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {formatTime(msg.timestamp)}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-1 animate-pulse">
                <BrainCircuit className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="bg-muted/50 border border-border/40 rounded-lg px-3.5 py-3">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Attachment chip */}
        {attachedFile && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary w-fit max-w-full">
            <span className="truncate max-w-[260px]">
              📎 {attachedFile.name} ({attachedFile.size})
            </span>
            <button
              onClick={() => setAttachedFile(null)}
              className="text-primary/60 hover:text-primary flex-shrink-0"
            >
              ✕
            </button>
          </div>
        )}

        {showCommandMenu && (
          <div className="rounded-xl border border-border bg-background shadow-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-border bg-muted/30">
              <p className="text-xs text-muted-foreground">
                Commands {commandFilter && `— filtering: "${commandFilter}"`}
              </p>
            </div>
            <div className="max-h-[280px] overflow-y-auto">
              {COMMANDS
                .filter(cmd =>
                  !commandFilter ||
                  cmd.label.toLowerCase().includes(commandFilter) ||
                  cmd.description.toLowerCase().includes(commandFilter)
                )
                .map((cmd) => (
                  <button
                    key={cmd.id}
                    onClick={() => selectCommand(cmd)}
                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-muted/50
                               transition-colors text-left border-b border-border/40
                               last:border-0"
                  >
                    <span className="text-lg flex-shrink-0 mt-0.5">{cmd.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{cmd.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{cmd.description}</p>
                    </div>
                  </button>
                ))
              }
              {COMMANDS.filter(cmd =>
                !commandFilter ||
                cmd.label.toLowerCase().includes(commandFilter) ||
                cmd.description.toLowerCase().includes(commandFilter)
              ).length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No commands match "{commandFilter}"
                </div>
              )}
            </div>
            <div className="px-3 py-2 border-t border-border bg-muted/30">
              <p className="text-xs text-muted-foreground">
                ↑↓ to navigate · Enter to select · Esc to close
              </p>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2 items-end">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileAttach(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="h-[52px] w-[42px] flex-shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            title="Attach PDF, Excel or CSV"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <Textarea
            value={input}
            onChange={(e) => {
              const val = e.target.value;
              setInput(val);

              if (val.startsWith("/")) {
                setShowCommandMenu(true);
                setCommandFilter(val.slice(1).toLowerCase());
              } else {
                setShowCommandMenu(false);
                setCommandFilter("");
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape" && showCommandMenu) {
                setShowCommandMenu(false);
                setInput("");
                return;
              }
              if (e.key === "Enter" && !e.shiftKey && !showCommandMenu) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Ask a financial or accounting question…"
            className="resize-none min-h-[52px] max-h-[160px] text-sm bg-background/60"
            rows={2}
            disabled={loading}
          />
          <Button
            onClick={() => sendMessage()}
            disabled={loading || (!input.trim() && !attachedFile)}
            size="icon"
            className="h-[52px] w-[52px] flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center pb-2">
          Scoped to accounting & finance · Session clears on refresh · Not a substitute for formal tax advice
        </p>
      </div>
    </DashboardLayout>
  );
}
