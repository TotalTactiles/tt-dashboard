import { useState, useRef, useEffect } from "react";
import { Send, RefreshCw, BrainCircuit, Paperclip } from "lucide-react";
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
export and attach as a file instead.

RESPONSE FORMATTING:
When presenting comparative data with 2+ items and numeric values, 
use a markdown table with | pipes. Example:
| Line Item | Monthly Cost | % of Total |
|-----------|-------------|------------|
| Office & Misc | $14,279 | 41.9% |
For simple lists or explanations, use plain paragraphs.
Never use ## headers or ** bold. Tables render natively in this interface.`;

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
  const [reportMode, setReportMode] = useState(false);
  const [reportData, setReportData] = useState<Record<string, any>>({});
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const [commandFilter, setCommandFilter] = useState("");

  function startReportFlow() {
    setReportMode(true);
    setReportData({});
    setMessages(prev => [...prev, {
      role: "assistant",
      content: "I'll generate a Monthly Management Report in the Total Tactiles Pty Ltd format.\n\nWhich period should the report cover?",
      timestamp: new Date(),
      buttons: ["April 2026", "March 2026", "YTD 2026", "Custom period"]
    }]);
  }

  async function handleReportFlow(userText: string) {
    if (!reportData.period) {
      const period = userText;
      setReportData(prev => ({ ...prev, period }));
      setMessages(prev => [...prev,
        { role: "user", content: userText, timestamp: new Date() },
        {
          role: "assistant",
          content: `${period} selected.\n\nI need your Profit & Loss data from Xero for this period.\n\nIn Xero: Reports → Profit & Loss → set date range to ${period} → Export as PDF → attach here.\n\nAlternatively if you have it already, attach it now.`,
          timestamp: new Date(),
          buttons: ["I'll use dashboard data only", "Skip — generate with available data"]
        }
      ]);
      return;
    }
    if (!reportData.plProvided) {
      setReportData(prev => ({ ...prev, plProvided: true, plNote: userText }));
      setMessages(prev => [...prev,
        { role: "user", content: userText, timestamp: new Date() },
        {
          role: "assistant",
          content: `Got it.\n\nDo you have an Aged Receivables report from Xero?\n\nIn Xero: Reports → Aged Receivables → set date to end of ${reportData.period} → Export as PDF → attach here.`,
          timestamp: new Date(),
          buttons: ["Skip Aged Receivables", "I'll attach it now"]
        }
      ]);
      return;
    }
    if (!reportData.arProvided) {
      setReportData(prev => ({ ...prev, arProvided: true, arNote: userText }));
      setMessages(prev => [...prev,
        { role: "user", content: userText, timestamp: new Date() },
        {
          role: "assistant",
          content: `Generating your Management Report for ${reportData.period}...`,
          timestamp: new Date()
        }
      ]);
      setTimeout(() => generateManagementReport(), 500);
      return;
    }
  }

  function generateManagementReport() {
    const period = reportData.period ?? "Current Period";
    const d = accountingData ?? {};
    const sheets = d.sheets ?? {};
    const summary = d.summary ?? {};
    const revenue = sheets.revenue ?? liveData?.revenue ?? [];
    const expenses = sheets.expenses ?? liveData?.expenses ?? [];
    const quotes = sheets.quotes ?? liveData?.quotes ?? [];

    const totalIncome = summary.totalRevIncGST ??
      revenue.reduce((s: number, r: any) => {
        const v = parseFloat(String(r['Contract Value'] ?? r['Contract Value ($)'] ?? 0).replace(/[^0-9.-]/g,''));
        return s + (isNaN(v) ? 0 : v);
      }, 0);
    const totalIncomeExGST = Math.round(totalIncome / 1.1 * 100) / 100;
    const totalCOGS = summary.totalCOGS ?? 0;
    const grossProfit = summary.grossProfit ?? (totalIncomeExGST - totalCOGS);
    const grossMarginPct = totalIncomeExGST > 0 ? Math.round(grossProfit / totalIncomeExGST * 100) : 0;
    const totalMonthlyExp = expenses.reduce((s: number, e: any) => {
      const sub = String(e['Sub-Category'] ?? '').toUpperCase();
      if (sub === 'TOTAL' || sub === 'GRAND TOTAL') return s;
      const v = parseFloat(String(e['Monthly Cost'] ?? 0).replace(/[^0-9.-]/g,''));
      return s + (isNaN(v) ? 0 : v);
    }, 0);
    const netProfit = grossProfit - totalMonthlyExp;
    const netMarginPct = totalIncomeExGST > 0 ? Math.round(netProfit / totalIncomeExGST * 100) : 0;
    const wonQuotes = quotes.filter((q: any) => {
      const s = String(q['Current Status'] ?? q['Status'] ?? '').toLowerCase();
      return s.includes('won') || s.includes('awarded');
    });
    const invoiceCount = wonQuotes.length;
    const avgInvoiceValue = invoiceCount > 0 ? Math.round(totalIncomeExGST / invoiceCount) : 0;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const GREEN: [number, number, number] = [31, 115, 71];
    const DARK: [number, number, number] = [40, 40, 40];
    const LIGHT_GREEN: [number, number, number] = [232, 245, 238];
    const pageW = 210;
    const margin = 15;

    doc.setFillColor(...GREEN);
    doc.rect(0, 0, pageW, 45, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('Management Report', margin, 20);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'normal');
    doc.text('Total Tactiles Pty Ltd', margin, 30);
    doc.text('ABN 69 682 573 333', margin, 37);
    doc.setTextColor(...DARK);
    doc.setFontSize(11);
    doc.text(`For the period: ${period}`, margin, 55);
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-AU')}`, margin, 62);
    doc.setTextColor(...GREEN);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Contents', margin, 85);
    doc.setDrawColor(...GREEN);
    doc.setLineWidth(0.5);
    doc.line(margin, 88, pageW - margin, 88);
    const contents: [string, string][] = [
      ['3', 'Executive Summary'],
      ['4', 'Profit and Loss'],
      ['6', 'Pipeline Summary'],
    ];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...DARK);
    contents.forEach(([pg, title], i) => {
      doc.text(pg, margin + 5, 98 + i * 10);
      doc.text(title, margin + 15, 98 + i * 10);
    });

    doc.addPage();
    doc.setFillColor(...GREEN);
    doc.rect(0, 0, pageW, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Executive Summary', margin, 15);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Tactiles Pty Ltd  |  ${period}`, margin, 23);
    const fmt = (n: number) => n < 0
      ? `(${Math.abs(n).toLocaleString('en-AU', {minimumFractionDigits: 0})})`
      : n.toLocaleString('en-AU', {minimumFractionDigits: 0});
    autoTable(doc, {
      startY: 38,
      margin: { left: margin, right: margin },
      head: [['', period, 'YEAR TO DATE']],
      body: [
        [{ content: 'Profitability', styles: { fontStyle: 'bold', fillColor: LIGHT_GREEN, textColor: GREEN } }, '', ''],
        ['Income', `$${fmt(totalIncomeExGST)}`, `$${fmt(totalIncomeExGST)}`],
        ['Direct Costs (COGS)', `$${fmt(totalCOGS)}`, `$${fmt(totalCOGS)}`],
        ['Gross Profit', `$${fmt(grossProfit)}`, `$${fmt(grossProfit)}`],
        ['Operating Expenses', `$${fmt(totalMonthlyExp)}`, `$${fmt(totalMonthlyExp * 4)}`],
        ['Net Profit / (Loss)', `$${fmt(netProfit)}`, `$${fmt(netProfit)}`],
        [{ content: 'Performance', styles: { fontStyle: 'bold', fillColor: LIGHT_GREEN, textColor: GREEN } }, '', ''],
        ['Gross Profit Margin %', `${grossMarginPct}%`, `${grossMarginPct}%`],
        ['Net Profit Margin %', `${netMarginPct}%`, `${netMarginPct}%`],
        [{ content: 'Sales', styles: { fontStyle: 'bold', fillColor: LIGHT_GREEN, textColor: GREEN } }, '', ''],
        ['Number of Invoices', String(invoiceCount), String(invoiceCount)],
        ['Average Invoice Value', `$${fmt(avgInvoiceValue)}`, `$${fmt(avgInvoiceValue)}`],
      ] as any,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: GREEN, textColor: [255,255,255], fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 90 }, 1: { halign: 'right' }, 2: { halign: 'right' } },
      alternateRowStyles: { fillColor: [250, 250, 250] },
    });

    doc.addPage();
    doc.setFillColor(...GREEN);
    doc.rect(0, 0, pageW, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Profit and Loss', margin, 15);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Tactiles Pty Ltd  |  ${period}`, margin, 23);

    const expRows: any[][] = [];
    expenses.forEach((e: any) => {
      const sub = String(e['Sub-Category'] ?? e['Name'] ?? '').trim();
      const monthly = parseFloat(String(e['Monthly Cost'] ?? 0).replace(/[^0-9.-]/g,'')) || 0;
      if (sub && sub.toUpperCase() !== 'TOTAL' && sub.toUpperCase() !== 'GRAND TOTAL' && monthly > 0) {
        expRows.push([sub, `$${fmt(monthly)}`, `$${fmt(monthly * 12)}`]);
      }
    });

    autoTable(doc, {
      startY: 38,
      margin: { left: margin, right: margin },
      head: [['', period, 'ANNUALISED']],
      body: [
        [{ content: 'Trading Income', styles: { fontStyle: 'bold', fillColor: LIGHT_GREEN, textColor: GREEN } }, '', ''],
        ['Sales', `$${fmt(totalIncomeExGST)}`, ''],
        [{ content: 'Total Trading Income', styles: { fontStyle: 'bold' } }, `$${fmt(totalIncomeExGST)}`, ''],
        [{ content: 'Cost of Sales', styles: { fontStyle: 'bold', fillColor: LIGHT_GREEN, textColor: GREEN } }, '', ''],
        ['Total Cost of Sales', `$${fmt(totalCOGS)}`, ''],
        [{ content: 'Gross Profit', styles: { fontStyle: 'bold' } }, `$${fmt(grossProfit)}`, ''],
        [{ content: `Gross Profit %`, styles: { fontStyle: 'bold' } }, `${grossMarginPct}%`, ''],
        [{ content: 'Operating Expenses', styles: { fontStyle: 'bold', fillColor: LIGHT_GREEN, textColor: GREEN } }, '', ''],
        ...expRows,
        [{ content: 'Total Operating Expenses', styles: { fontStyle: 'bold' } }, `$${fmt(totalMonthlyExp)}`, `$${fmt(totalMonthlyExp * 12)}`],
        [{ content: 'Net Profit / (Loss)', styles: { fontStyle: 'bold', fontSize: 10 } }, `$${fmt(netProfit)}`, ''],
        [{ content: `Net Profit %`, styles: { fontStyle: 'bold' } }, `${netMarginPct}%`, ''],
      ] as any,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: GREEN, textColor: [255,255,255], fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 100 }, 1: { halign: 'right' }, 2: { halign: 'right' } },
      alternateRowStyles: { fillColor: [250, 250, 250] },
    });

    doc.addPage();
    doc.setFillColor(...GREEN);
    doc.rect(0, 0, pageW, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Pipeline Summary', margin, 15);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Tactiles Pty Ltd  |  ${period}`, margin, 23);

    const pipelineRows = quotes
      .filter((q: any) => {
        const s = String(q['Current Status'] ?? q['Status'] ?? '').toLowerCase();
        return !s.includes('lost') && !s.includes('dead');
      })
      .sort((a: any, b: any) => {
        const av = parseFloat(String(a['Contract Value ($)'] ?? a['Contract Value'] ?? 0).replace(/[^0-9.-]/g,'')) || 0;
        const bv = parseFloat(String(b['Contract Value ($)'] ?? b['Contract Value'] ?? 0).replace(/[^0-9.-]/g,'')) || 0;
        return bv - av;
      })
      .slice(0, 20)
      .map((q: any) => {
        const val = parseFloat(String(q['Contract Value ($)'] ?? q['Contract Value'] ?? 0).replace(/[^0-9.-]/g,'')) || 0;
        return [
          String(q['Company Name'] ?? q['_company'] ?? ''),
          String(q['Project Name'] ?? q['_project'] ?? '').substring(0, 35),
          `$${fmt(val)}`,
          String(q['Current Status'] ?? q['Status'] ?? ''),
          String(q['Estimated Job Date'] ?? q['Date Quoted'] ?? ''),
        ];
      });

    autoTable(doc, {
      startY: 38,
      margin: { left: margin, right: margin },
      head: [['Company', 'Project', 'Value', 'Stage', 'Date']],
      body: pipelineRows,
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: GREEN, textColor: [255,255,255], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 38 },
        1: { cellWidth: 60 },
        2: { halign: 'right', cellWidth: 28 },
        3: { cellWidth: 28 },
        4: { cellWidth: 26 }
      },
      alternateRowStyles: { fillColor: [250, 250, 250] },
    });

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Management Report  |  Total Tactiles Pty Ltd  |  Page ${i} of ${pageCount}`,
        margin, 290
      );
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, 287, pageW - margin, 287);
    }

    const filename = `TT_Management_Report_${period.replace(/\s/g,'_')}.pdf`;
    doc.save(filename);

    setReportMode(false);
    setReportData({});
    setMessages(prev => [...prev, {
      role: "assistant",
      content: `Management Report for ${period} has been downloaded as ${filename}.\n\nWould you like me to provide a written analysis of the key figures in this report?`,
      timestamp: new Date(),
      buttons: ["Yes, analyse the report", "No thanks"]
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

  function clearSession() {
    setMessages([{ ...WELCOME_MESSAGE, timestamp: new Date() }]);
  }

  const COMMANDS = [
    { id: "report-monthly", label: "Generate Monthly Management Report", description: "P&L, Executive Summary, Pipeline — downloadable PDF", icon: "📊" },
    { id: "health-check", label: "Full Financial Health Check", description: "Gross margin, cashflow, pipeline coverage, top risks", icon: "🏥" },
    { id: "breakeven", label: "Break-Even Analysis", description: "Monthly break-even revenue based on current cost structure", icon: "⚖️" },
    { id: "pipeline-review", label: "Pipeline Review", description: "Ranked open quotes with conversion probability assessment", icon: "🔍" },
    { id: "cashflow-forecast", label: "Cashflow Forecast", description: "Forward cashflow based on pipeline and expense run rate", icon: "📈" },
    { id: "expense-review", label: "Expense Review", description: "Cost structure breakdown and reduction opportunities", icon: "💸" },
    { id: "margin-analysis", label: "Project Margin Analysis", description: "Best and worst performing projects by gross margin", icon: "📉" },
    { id: "tax-position", label: "Tax Position Summary", description: "GST, income tax and ATO obligations overview", icon: "🧾" },
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
