import { useState, useRef, useEffect } from "react";
import { Send, RefreshCw, BrainCircuit, Paperclip, FileDown } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import DashboardLayout from "@/components/DashboardLayout";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const WEBHOOK_URL = "https://n8n.srv1437130.hstgr.cloud/webhook/tt-accountant-ai";
const ACCOUNTING_DATA_WEBHOOK = "https://n8n.srv1437130.hstgr.cloud/webhook/tt-accounting-consultant";

const SYSTEM_PROMPT = `You are a senior chartered accountant and financial analyst advising TT Business (Total Tactiles Pty Ltd), a Sydney-based commercial contracting company specialising in tactile paving, stair nosing, and linemarking installation.

Your role is strictly limited to accounting, finance, tax, cash flow, financial analysis, and strategy questions grounded in accounting principles. Do not answer questions outside this domain. If asked something off-topic, redirect the user to relevant financial dimensions of their question or decline.

You speak in facts only. No filler, no pleasantries beyond brief professional acknowledgement. Be direct, specific, and precise. Quantify everything you can. If a number is uncertain, say so and state what data would resolve it.

You have access to live business data passed to you in each message. Use it as the primary source of truth. If you need data that is not present, ask the user specifically what you need — do not assume or fabricate figures.

If you notice a material financial issue in the data — cashflow risk, margin compression, overdue receivables, cost blowouts — flag it proactively, even if not asked. This is expected of you.

You are not RED. You do not handle operations, Zoho, automation, or project management. Finance and accounting only.

Data currently available to you includes: quoted jobs pipeline, revenue and COGS by project, cashflow by month, business expenses, investor metrics, labour costs, and project KPIs. Bank transaction data is not yet live — if actual vs forecast reconciliation is needed, ask the user to provide bank figures directly.

Australian accounting standards apply. All currency is AUD. GST is 10%.

If the user's message is exactly "Let's Talk", respond only with: "Of course. What would you like to discuss?" — nothing else, no data, no observations, no OPTIONS.

When you want to offer the user options, end your response with a new line starting with OPTIONS: followed by the choices comma-separated.
Example: OPTIONS: Yes, No, Show me the breakdown
Only use OPTIONS when there are clear discrete choices. Never use OPTIONS for open-ended questions.

ACCOUNTING SOFTWARE CONTEXT:
The business uses Xero as its accounting platform and Google Sheets 
(TT Business 2026) as its operational financial model.

XERO — you know Xero deeply. When you need data not in your live feed, 
tell the user exactly what to export and how. Always be specific — 
report name, date range, export format. Maximum 3 lines of instructions.
Key Xero exports:
- P&L: Reports → Profit & Loss → set date range → Export PDF or Excel
- Expense detail: Reports → Account Transactions → filter Expense accounts → Export Excel
- Balance Sheet: Reports → Balance Sheet → Export PDF
- Aged Receivables: Reports → Aged Receivables → Export PDF
- Cash Summary: Reports → Cash Summary → set period → Export PDF
- Bank Reconciliation: Reports → Bank Reconciliation Summary → Export
- GST Return: Reports → Tax → GST Return → Export

GOOGLE SHEETS — TT Business 2026:
Tabs: QUOTES, REVENUE, CASHFLOW, EXPENSES (EXP SMMRY), STOCK & INVENTORY, qtsSmmry.
You have live access to most of this data already. Only ask for a Sheets 
export when your live data is incomplete or figures don't match.
Export instruction: "Open TT Business 2026 → [TAB NAME] tab → 
File → Download → Microsoft Excel (.xlsx) → attach here"

WHEN DATA IS MISSING — always tell the user:
1. Exactly what data you need and why
2. Where to get it (Xero report name or Sheets tab name)
3. How to export it in 1-2 sentences max
4. What format to attach (PDF for review, Excel for data)
Never ask users to paste large datasets — always guide them to 
export and attach as a file instead.`;

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
  if (sheets?.quotes?.length > 0 || accountingData?.sheets?.quotes?.length > 0) {
    const quotes = sheets?.quotes ?? accountingData?.sheets?.quotes ?? [];
    const sorted = [...quotes].sort((a: any, b: any) => {
      const aVal = parseFloat(String(a['Contract Value ($)'] ?? a['Contract Value'] ?? 0).replace(/[^0-9.-]/g,'')) || 0;
      const bVal = parseFloat(String(b['Contract Value ($)'] ?? b['Contract Value'] ?? 0).replace(/[^0-9.-]/g,'')) || 0;
      return bVal - aVal;
    });
    sections.push(`QUOTES — ALL DEALS (${quotes.length} total, sorted by value desc):
${sorted.map((q: any) => {
  const val = parseFloat(String(q['Contract Value ($)'] ?? q['Contract Value'] ?? 0).replace(/[^0-9.-]/g,'')) || 0;
  const stage = q['Current Status'] ?? q['Stage'] ?? q['Status'] ?? '?';
  const company = q['Company Name'] ?? q['_company'] ?? '?';
  const project = q['Project Name'] ?? q['_project'] ?? '?';
  const date = q['Estimated Job Date'] ?? q['Date Quoted'] ?? '?';
  return `• ${company} / ${project} — $${val.toLocaleString('en-AU')} | Stage: ${stage} | Date: ${date}`;
}).join('\n')}`);
  }

  try {
    const cashflow = liveData?.cashflow ?? [];
    if (cashflow.length > 0) {
      const cfSummary = cashflow.slice(0, 6).map((m: any) => `${m.month ?? m.Month ?? "?"}: Income $${(parseFloat(m.totalIncome ?? m["Total Income"] ?? 0)).toLocaleString("en-AU")} | Outgoings $${(parseFloat(m.totalOutgoings ?? m["Total Outgoings"] ?? 0)).toLocaleString("en-AU")} | Closing $${(parseFloat(m.closingBalance ?? m["Closing Balance"] ?? 0)).toLocaleString("en-AU")}`).join("; ");
      sections.push(`CASHFLOW (recent months): ${cfSummary}`);
    }
  } catch { /* skip */ }

  // Full expense line items
  const expSheet = accountingData?.sheets?.expenses ?? [];
  const expItems = expSheet.filter((r: any) => {
    const sub = String(r['Sub-Category'] ?? r['Name'] ?? r['Item'] ?? '').trim();
    const cat = String(r['Category'] ?? '').trim().toUpperCase();
    return sub && sub.toUpperCase() !== 'TOTAL' && sub.toUpperCase() !== 'ALL'
      && cat !== 'GRAND TOTAL' && sub.toUpperCase() !== 'GRAND TOTAL';
  });
  if (expItems.length > 0) {
    const totalMonthly = expItems.reduce((s: number, r: any) => {
      const v = parseFloat(String(r['Monthly Cost'] ?? r['Monthly'] ?? 0).replace(/[^0-9.-]/g,''));
      return s + (isNaN(v) ? 0 : v);
    }, 0);
    sections.push(`OPERATING EXPENSES — LINE ITEMS (${expItems.length} items, total monthly: $${totalMonthly.toLocaleString('en-AU', {minimumFractionDigits:2})}):
${expItems.map((r: any) => {
  const cat = String(r['Category'] ?? 'Uncategorised').trim();
  const sub = String(r['Sub-Category'] ?? r['Name'] ?? r['Item'] ?? '').trim();
  const monthly = parseFloat(String(r['Monthly Cost'] ?? r['Monthly'] ?? 0).replace(/[^0-9.-]/g,'')) || 0;
  const yearly = parseFloat(String(r['Yearly Cost'] ?? r['Yearly'] ?? 0).replace(/[^0-9.-]/g,'')) || 0;
  const pct = totalMonthly > 0 ? ((monthly / totalMonthly) * 100).toFixed(1) : '0.0';
  return `• [${cat}] ${sub} — $${monthly.toLocaleString('en-AU', {minimumFractionDigits:2})}/mo ($${yearly.toLocaleString('en-AU', {minimumFractionDigits:0})}/yr) — ${pct}% of expenses`;
}).join('\n')}`);
  } else {
    // fallback to summary if no line items
    const totalMonthlyExp = liveData?.expenses
      ? (liveData.expenses as any[]).reduce((s: number, e: any) => {
          const v = parseFloat(String(e['Monthly Cost'] ?? 0).replace(/[^0-9.-]/g,''));
          return s + (isNaN(v) ? 0 : v);
        }, 0)
      : 0;
    if (totalMonthlyExp > 0) {
      sections.push(`OPERATING EXPENSES: Monthly total $${totalMonthlyExp.toLocaleString('en-AU', {minimumFractionDigits:2})} | Annualised $${(totalMonthlyExp * 12).toLocaleString('en-AU', {minimumFractionDigits:0})} (line items not available in current feed)`);
    }
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

async function callAI(system: string, messages: { role: string; content: string }[]): Promise<string> {
  const response = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, messages }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  const text = data?.content?.find((b: any) => b.type === "text")?.text
    ?? data?.text
    ?? data?.reply
    ?? "No response received.";
  return text;
}

const WELCOME_MESSAGE: Message = {
  role: "assistant",
  content: "Welcome. I have access to your live financial data. How would you like to proceed?",
  timestamp: new Date(),
  buttons: ["Financial Review", "Let's Talk"],
};

export default function ConsultingPage() {
  const { liveData, investorMetrics, hasLiveData } = useDashboardData() as any;
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
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
        const data = await res.json();
        if (!cancelled) setAccountingData(data);
      } catch {
        // silently fail — dashboard liveData will be used as fallback
      } finally {
        if (!cancelled) setAccountingDataLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function stripMarkdown(text: string): string {
    return text
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/^[-–—]{2,}\s*$/gm, '')
      .replace(/^>\s+/gm, '')
      .trim();
  }

  function parseResponseAndButtons(raw: string): { content: string; buttons?: string[] } {
    const optionsMatch = raw.match(/\nOPTIONS:\s*(.+)$/);
    if (optionsMatch) {
      const buttons = optionsMatch[1].split(",").map((s) => s.trim()).filter(Boolean);
      const content = raw.replace(/\nOPTIONS:\s*.+$/, "").trim();
      return { content: stripMarkdown(content), buttons };
    }
    return { content: stripMarkdown(raw) };
  }

  async function sendMessage(overrideText?: string) {
    const trimmed = (overrideText ?? input).trim();
    if (!trimmed || loading) return;
    if (trimmed === "Let's Talk") {
      setMessages(prev => [...prev,
        { role: "user", content: trimmed, timestamp: new Date() },
        { role: "assistant", content: "Of course. What would you like to discuss?", timestamp: new Date() }
      ]);
      if (!overrideText) setInput("");
      return;
    }
    if (!overrideText) setInput("");
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
      const text = await callAI(SYSTEM_PROMPT + dataContext, apiMessages as any);
      const parsed = parseResponseAndButtons(text);
      setMessages((prev) => [...prev, { role: "assistant", content: parsed.content, buttons: parsed.buttons, timestamp: new Date() }]);
      setAttachedFile(null);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Request failed. Check your connection.", timestamp: new Date() }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function clearSession() {
    setMessages([{ ...WELCOME_MESSAGE, timestamp: new Date() }]);
  }

  const formatTime = (d: Date) => d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-7rem)] max-w-4xl mx-auto w-full px-4 gap-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <BrainCircuit className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Accounting Consultant</h1>
              <p className="text-xs text-muted-foreground font-mono">
                {accountingDataLoading
                  ? "Loading full financial data…"
                  : accountingData
                    ? "Full data connected · AUD · GST 10%"
                    : hasLiveData
                      ? "Live data connected · AUD · GST 10%"
                      : "Connecting to live data…"}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={clearSession} disabled={loading}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            New session
          </Button>
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
                <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                {msg.buttons && i === messages.length - 1 && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {msg.buttons.map((btn) => (
                      <button
                        key={btn}
                        onClick={() => sendMessage(btn)}
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
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
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
