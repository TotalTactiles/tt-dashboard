// src/lib/generateManagementReportPDF.ts
// Drop-in replacement for the Consigliere's broken PDF generator.
// Reads the `managementReport` object (from xero_management_report cache / data webhook)
// and produces an accountant-style Management Report:
//   Cover · Contents · Executive Summary · Profit & Loss · Balance Sheet · Aged Receivables
// Optional per-section commentary (from the Consigliere) renders under each section.
//
// Requires: jspdf, jspdf-autotable   (already used by InvestmentMemorandum.tsx)

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Item = { label: string; value: number };
interface PnL {
  periodLabel?: string;
  totalIncome: number; income: Item[];
  cogs: Item[]; totalCogs: number;
  grossProfit: number; gpPercent: number;
  opex: Item[]; totalOpex: number;
  netProfit: number; netPercent: number;
  hasData: boolean;
}
interface AgedContact { name: string; current: number; lt1: number; m1: number; m2: number; m3: number; older: number; total: number; }
export interface ManagementReport {
  entity: string;
  asAt: string;
  balanceSheet: {
    groups: Record<string, Item[]>;
    totals: Record<string, number>;
    reported: { netAssets: number | null; totalEquity: number | null };
    ties: boolean | null;
  };
  agedReceivables: { buckets: Record<string, number>; byContact: AgedContact[] };
  pnl: { revenue: number; grossProfit: number; totalExpenses: number; netProfit: number; accountsReceivable: number };
  periods?: { month: PnL; quarter: PnL; ytd: PnL };
}
export type Commentary = Partial<Record<"execSummary" | "pnl" | "balanceSheet" | "agedReceivables", string>>;

// ---- palette (accountant look; green headings) ----
const GREEN: [number, number, number] = [31, 122, 77];
const INK: [number, number, number] = [26, 26, 26];
const GREY: [number, number, number] = [110, 116, 124];
const LINE: [number, number, number] = [225, 228, 231];
const NEG: [number, number, number] = [192, 57, 43];

const money = (v: number | null | undefined): string => {
  if (v == null) return "-";
  const n = Math.round(v * 100) / 100;
  if (n === 0) return "-";
  const s = Math.abs(n).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `(${s})` : s;
};
const pct = (v: number | null | undefined): string => (v == null ? "-" : `${Math.round(v * 10) / 10}%`);
const sum = (a: Item[] = []) => a.reduce((n, x) => n + (x.value || 0), 0);

// Map Xero expense labels into the accountant's expense sub-groups
const EXPENSE_GROUPS: { title: string; match: (l: string) => boolean }[] = [
  { title: "Employment Expenses", match: (l) => /wage|salary|salaries|superannuation|payg|employee/.test(l) },
  { title: "Occupancy Expenses", match: (l) => /rent|repairs|maintenance|telephone|internet|office/.test(l) },
  { title: "Motor Vehicle & Travel Expenses", match: (l) => /motor|vehicle|travel|fuel/.test(l) },
  { title: "General Expenses", match: (l) => /bank fee|consulting|accounting|filing|fines|penalt|interest|printing|stationery/.test(l) },
  { title: "Business Expenses", match: () => true }, // catch-all
];
function groupExpenses(opex: Item[]) {
  const groups: Record<string, Item[]> = {};
  for (const it of opex) {
    const g = EXPENSE_GROUPS.find((x) => x.match((it.label || "").toLowerCase()))!.title;
    (groups[g] ||= []).push(it);
  }
  // preserve accountant order
  const order = ["Business Expenses", "Employment Expenses", "General Expenses", "Occupancy Expenses", "Motor Vehicle & Travel Expenses"];
  return order.filter((o) => groups[o]?.length).map((o) => ({ title: o, items: groups[o] }));
}

export function generateManagementReportPDF(
  mr: ManagementReport,
  period: "month" | "quarter" | "ytd" = "ytd",
  commentary: Commentary = {}
): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  const periodLabels = { month: "This Month", quarter: "This Quarter", ytd: "Year to Date" };
  const p: PnL = mr.periods?.[period] ?? ({ hasData: false, income: [], cogs: [], opex: [], totalIncome: 0, totalCogs: 0, grossProfit: 0, gpPercent: 0, totalOpex: 0, netProfit: 0, netPercent: 0 } as PnL);

  const footer = (label: string, page: number, total: number) => {
    doc.setDrawColor(...LINE); doc.line(M, 800, W - M, 800);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...GREY);
    doc.text(`Management Report  |  ${mr.entity}`, M, 812);
    doc.text(`Page ${page} of ${total}`, W - M, 812, { align: "right" });
  };
  const heading = (title: string, sub: string, y = 70) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(24); doc.setTextColor(...GREEN);
    doc.text(title, M, y);
    doc.setFontSize(13); doc.setTextColor(...INK);
    doc.text(mr.entity, M, y + 22);
    doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(...INK);
    doc.text(sub, M, y + 38);
    return y + 54;
  };
  const commentaryBlock = (text: string | undefined, y: number): number => {
    if (!text) return y;
    doc.setDrawColor(...GREEN); doc.setFillColor(248, 250, 249);
    const lines = doc.splitTextToSize(text, W - 2 * M - 20);
    const h = lines.length * 12 + 24;
    doc.roundedRect(M, y, W - 2 * M, h, 3, 3, "F");
    doc.setFillColor(...GREEN); doc.rect(M, y, 3, h, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...GREEN);
    doc.text("✦ CONSIGLIERE", M + 12, y + 14);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(50, 50, 50);
    doc.text(lines, M + 12, y + 28);
    return y + h + 16;
  };
  const tableTheme = {
    theme: "plain" as const,
    styles: { font: "helvetica", fontSize: 9, cellPadding: { top: 3, bottom: 3, left: 6, right: 6 }, textColor: INK as any },
    headStyles: { fontStyle: "bold" as const, fontSize: 8, textColor: GREY as any, lineWidth: { bottom: 1 }, lineColor: INK as any },
    columnStyles: { 0: { halign: "left" as const }, 1: { halign: "right" as const } },
    margin: { left: M, right: M },
  };
  // bold + top-border rows for totals
  const totalRow = (data: any) => {
    const t = (data.row.raw as any).__total;
    if (t) { data.cell.styles.fontStyle = "bold"; data.cell.styles.lineWidth = { top: 1 } as any; data.cell.styles.lineColor = INK as any; }
    if ((data.row.raw as any).__grp && data.column.index === 0) { data.cell.styles.fontStyle = "bold"; data.cell.styles.textColor = GREEN as any; data.cell.styles.fontSize = 8; }
  };
  const row = (label: string, value: string, opts: any = {}) => ({ 0: label, 1: value, ...opts });

  // ===================== PAGE 1 — COVER =====================
  doc.setFont("helvetica", "bold"); doc.setFontSize(30); doc.setTextColor(...GREEN);
  doc.text("Management Report", M, 300);
  doc.setDrawColor(...GREEN); doc.setLineWidth(2); doc.line(M, 312, M + 90, 312); doc.setLineWidth(1);
  doc.setFontSize(16); doc.setTextColor(...INK); doc.text(mr.entity, M, 340);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...GREY);
  doc.text("ABN 69 682 573 333", M, 358);
  doc.text(`Period: ${periodLabels[period]}`, M, 374);
  doc.text(`As at ${mr.asAt}`, M, 388);
  doc.text(`Generated ${new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "long", year: "numeric" })}`, M, 402);
  footer("Cover", 1, 6);

  // ===================== PAGE 2 — CONTENTS =====================
  doc.addPage();
  doc.setFont("helvetica", "bold"); doc.setFontSize(24); doc.setTextColor(...GREEN);
  doc.text("Contents", M, 90);
  autoTable(doc, {
    ...tableTheme, startY: 120,
    body: [["Executive Summary", "3"], ["Profit and Loss", "4"], ["Balance Sheet", "5"], ["Aged Receivables Summary", "6"]],
    columnStyles: { 0: { halign: "left" }, 1: { halign: "right", cellWidth: 40 } },
  });
  footer("Contents", 2, 6);

  // ===================== PAGE 3 — EXECUTIVE SUMMARY =====================
  doc.addPage();
  let y = heading("Executive Summary", `${periodLabels[period]} · as at ${mr.asAt}`);
  const t = mr.balanceSheet.totals;
  const execBody = [
    row("Profitability", "", { __grp: true }),
    row("Income", money(p.totalIncome)),
    row("Direct costs (COGS)", money(p.totalCogs)),
    row("Gross profit", money(p.grossProfit)),
    row("Operating expenses", money(p.totalOpex)),
    row("Net profit / (loss)", money(p.netProfit), { __total: true }),
    row("Performance", "", { __grp: true }),
    row("Gross profit margin", pct(p.gpPercent)),
    row("Net profit margin", pct(p.netPercent)),
    row("Position (as at " + mr.asAt + ")", "", { __grp: true }),
    row("Debtors (accounts receivable)", money(mr.agedReceivables?.buckets?.total)),
    row("Net assets", money(t.netAssets)),
  ];
  autoTable(doc, { ...tableTheme, startY: y, head: [["", periodLabels[period]]], body: execBody as any, didParseCell: totalRow });
  y = (doc as any).lastAutoTable.finalY + 16;
  commentaryBlock(commentary.execSummary, y);
  footer("Executive Summary", 3, 6);

  // ===================== PAGE 4 — PROFIT & LOSS =====================
  doc.addPage();
  y = heading("Profit and Loss", `${periodLabels[period]}${p.periodLabel ? " · " + p.periodLabel : ""}`);
  const pnlBody: any[] = [];
  pnlBody.push(row("Trading Income", "", { __grp: true }));
  p.income.forEach((i) => pnlBody.push(row(i.label, money(i.value))));
  pnlBody.push(row("Total Trading Income", money(p.totalIncome), { __total: true }));
  pnlBody.push(row("Cost of Sales", "", { __grp: true }));
  p.cogs.forEach((i) => pnlBody.push(row(i.label, money(i.value))));
  pnlBody.push(row("Total Cost of Sales", money(p.totalCogs), { __total: true }));
  pnlBody.push(row("Gross Profit", money(p.grossProfit), { __total: true }));
  pnlBody.push(row("Gross Profit %", pct(p.gpPercent)));
  for (const g of groupExpenses(p.opex)) {
    pnlBody.push(row(g.title, "", { __grp: true }));
    g.items.forEach((i) => pnlBody.push(row(i.label, money(i.value))));
    pnlBody.push(row(`Total ${g.title}`, money(sum(g.items)), { __total: true }));
  }
  pnlBody.push(row("Total Operating Expenses", money(p.totalOpex), { __total: true }));
  pnlBody.push(row("Net Profit", money(p.netProfit), { __total: true }));
  pnlBody.push(row("Net Profit %", pct(p.netPercent)));
  autoTable(doc, { ...tableTheme, startY: y, head: [["", periodLabels[period]]], body: pnlBody, didParseCell: totalRow });
  y = (doc as any).lastAutoTable.finalY + 16;
  if (!p.hasData) { doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(...GREY); doc.text("P&L for this period is syncing from Xero.", M, y); y += 16; }
  commentaryBlock(commentary.pnl, y);
  footer("Profit and Loss", 4, 6);

  // ===================== PAGE 5 — BALANCE SHEET =====================
  doc.addPage();
  y = heading("Balance Sheet", `As at ${mr.asAt}`);
  const g = mr.balanceSheet.groups;
  const bs: any[] = [];
  const push = (label: string, val: number, o: any = {}) => bs.push(row(label, money(val), o));
  const pushItems = (arr: Item[] = []) => arr.forEach((i) => push(i.label, i.value));
  bs.push(row("Assets — Bank", "", { __grp: true })); pushItems(g.bank); push("Total Bank", t.bank, { __total: true });
  bs.push(row("Current Assets", "", { __grp: true }));
  pushItems(g.accountsReceivable);
  pushItems(g.stockPrepay); push("Total Stock on Hand & Prepayments", sum(g.stockPrepay), { __total: true });
  pushItems(g.loansDirectors); push("Total Loans to Directors", sum(g.loansDirectors), { __total: true });
  push("Total Current Assets", t.currentAssets, { __total: true });
  bs.push(row("Fixed Assets", "", { __grp: true })); pushItems(g.fixed); push("Total Fixed Assets", t.fixedAssets, { __total: true });
  bs.push(row("Non-current Assets", "", { __grp: true })); pushItems(g.nonCurrentAssets);
  push("Total Assets", t.totalAssets, { __total: true });
  bs.push(row("Liabilities — Current", "", { __grp: true })); pushItems(g.currentLiab); push("Total Current Liabilities", t.currentLiabilities, { __total: true });
  bs.push(row("Non-current Liabilities", "", { __grp: true }));
  pushItems(g.financing); push("Total Financing", t.financing, { __total: true });
  pushItems(g.hirePurchase); push("Total Hire Purchase Liabilities", t.hirePurchase, { __total: true });
  push("Total Non-current Liabilities", t.nonCurrentLiabilities, { __total: true });
  push("Total Liabilities", t.totalLiabilities, { __total: true });
  push("Net Assets", t.netAssets, { __total: true });
  bs.push(row("Equity", "", { __grp: true })); pushItems(g.equity); push("Total Equity", t.totalEquity, { __total: true });
  autoTable(doc, { ...tableTheme, startY: y, head: [["", mr.asAt]], body: bs, didParseCell: totalRow,
    didDrawPage: () => {}, });
  y = (doc as any).lastAutoTable.finalY + 12;
  if (mr.balanceSheet.ties === false) { doc.setFillColor(255, 244, 214); doc.roundedRect(M, y, 220, 18, 3, 3, "F"); doc.setFontSize(8); doc.setTextColor(186, 117, 23); doc.text("⚠ Does not reconcile — review", M + 8, y + 12); y += 26; }
  commentaryBlock(commentary.balanceSheet, y);
  footer("Balance Sheet", 5, 6);

  // ===================== PAGE 6 — AGED RECEIVABLES =====================
  doc.addPage();
  y = heading("Aged Receivables Summary", `As at ${mr.asAt} · Ageing by due date`);
  const b = mr.agedReceivables.buckets;
  const arHead = [["Contact", "Current", "<1 Mo", "1 Mo", "2 Mo", "3 Mo", "Older", "Total"]];
  const arBody = mr.agedReceivables.byContact.map((c) => [c.name, money(c.current), money(c.lt1), money(c.m1), money(c.m2), money(c.m3), money(c.older), money(c.total)]);
  arBody.push([{ content: "Total", styles: { fontStyle: "bold" } } as any, money(b.current), money(b.lt1), money(b.m1), money(b.m2), money(b.m3), money(b.older), money(b.total)]);
  const pctOf = (v: number) => (b.total ? `${Math.round((v / b.total) * 1000) / 10}%` : "-");
  arBody.push(["% of total", pctOf(b.current), pctOf(b.lt1), pctOf(b.m1), pctOf(b.m2), pctOf(b.m3), pctOf(b.older), "100%"]);
  autoTable(doc, {
    theme: "plain", startY: y, head: arHead, body: arBody as any, margin: { left: M, right: M },
    styles: { font: "helvetica", fontSize: 8, cellPadding: { top: 3, bottom: 3, left: 4, right: 4 } },
    headStyles: { fontStyle: "bold", fontSize: 7, textColor: GREY as any, lineWidth: { bottom: 1 }, lineColor: INK as any },
    columnStyles: { 0: { halign: "left" }, 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right", fontStyle: "bold" } },
    didParseCell: (d: any) => { if (d.row.index === arBody.length - 2) { d.cell.styles.lineWidth = { top: 1 }; d.cell.styles.lineColor = INK; d.cell.styles.fontStyle = "bold"; } if (d.row.index === arBody.length - 1) { d.cell.styles.textColor = GREY; d.cell.styles.fontSize = 7; } },
  });
  y = (doc as any).lastAutoTable.finalY + 16;
  commentaryBlock(commentary.agedReceivables, y);
  footer("Aged Receivables", 6, 6);

  doc.save(`TT_Management_Report_${period}.pdf`);
}
