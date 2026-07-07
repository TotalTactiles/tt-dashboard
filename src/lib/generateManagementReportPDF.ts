// src/lib/generateManagementReportPDF.ts  (v2 — 3-month columns, variance, trend colours, cash, commentary)
// Drop-in replacement. Reads `managementReport` (with .monthly[3], .periods, .balanceSheet, .agedReceivables).
// Requires: jspdf, jspdf-autotable

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Item = { label: string; value: number };
interface PnL { totalIncome: number; income: Item[]; cogs: Item[]; totalCogs: number; grossProfit: number; gpPercent: number; opex: Item[]; totalOpex: number; netProfit: number; netPercent: number; hasData: boolean; }
interface MonthEntry {
  key: string; label: string; start: string; end: string;
  exec: { income: number; directCosts: number; grossProfit: number; expenses: number; netProfit: number; gpMargin: number; npMargin: number; debtors: number | null; netAssets: number | null; };
  pnl: PnL;
  bs: { netAssets: number | null; debtors: number | null; totalAssets: number | null; totalLiabilities: number | null; hasData: boolean; };
  cash: { receipts: number | null; spend: number | null; net: number | null; };
  pnlOk: boolean; bsOk: boolean;
}
export interface ManagementReport {
  entity: string; asAt: string;
  balanceSheet: { groups: Record<string, Item[]>; totals: Record<string, number>; reported: { netAssets: number | null; totalEquity: number | null }; ties: boolean | null; };
  agedReceivables: { buckets: Record<string, number>; byContact: any[] };
  pnl: any;
  periods?: { month: PnL; quarter: PnL; ytd: PnL };
  monthly?: MonthEntry[];
}
export type Commentary = Partial<Record<"execSummary" | "pnl" | "balanceSheet" | "agedReceivables", string>>;

// palette
const GREEN: [number, number, number] = [31, 122, 77];
const INK: [number, number, number] = [26, 26, 26];
const GREY: [number, number, number] = [110, 116, 124];
const LINE: [number, number, number] = [225, 228, 231];
const POS: [number, number, number] = [22, 138, 96];
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

// colour a figure by its move vs the prior (older) month
function trendColor(cur: number | null, prior: number | null, higherIsGood: boolean): [number, number, number] {
  if (cur == null || prior == null) return INK;
  if (Math.abs(cur - prior) < 0.005) return INK;
  const up = cur > prior;
  return up === higherIsGood ? POS : NEG;
}
// variance cell (arrow + %), direction-aware colour
function varianceCell(cur: number | null, prior: number | null, higherIsGood: boolean) {
  if (cur == null || prior == null) return { content: "-", styles: { textColor: GREY, halign: "right" as const } };
  const diff = cur - prior;
  const pv = prior !== 0 ? (diff / Math.abs(prior)) * 100 : null;
  const arrow = Math.abs(diff) < 0.005 ? "–" : diff > 0 ? "▲" : "▼";
  const col = Math.abs(diff) < 0.005 ? GREY : diff > 0 === higherIsGood ? POS : NEG;
  const txt = pv == null ? arrow : `${arrow} ${pv > 0 ? "+" : ""}${Math.round(pv)}%`;
  return { content: txt, styles: { textColor: col, halign: "right" as const, fontSize: 7.5 } };
}
const numCell = (v: number | null, prior: number | null, higherIsGood: boolean, isPct = false) => ({
  content: isPct ? pct(v) : money(v),
  styles: { textColor: trendColor(v, prior, higherIsGood), halign: "right" as const },
});

const EXPENSE_GROUPS: { title: string; match: (l: string) => boolean }[] = [
  { title: "Employment Expenses", match: (l) => /wage|salary|salaries|superannuation|payg|employee/.test(l) },
  { title: "Occupancy Expenses", match: (l) => /rent|repairs|maintenance|telephone|internet|office/.test(l) },
  { title: "Motor Vehicle & Travel Expenses", match: (l) => /motor|vehicle|travel|fuel/.test(l) },
  { title: "General Expenses", match: (l) => /bank fee|consulting|accounting|filing|fines|penalt|interest|printing|stationery/.test(l) },
  { title: "Business Expenses", match: () => true },
];
const groupOf = (label: string) => EXPENSE_GROUPS.find((x) => x.match((label || "").toLowerCase()))!.title;

export function generateManagementReportPDF(mr: ManagementReport, period: "month" | "quarter" | "ytd" = "ytd", commentary: Commentary = {}): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;

  // newest-first columns (e.g. [Jul, Jun, May]); latest vs prior for variance
  const months: MonthEntry[] = (mr.monthly ?? []).slice().reverse();
  const cols = months.slice(0, 3);
  const latest = cols[0], prior = cols[1];
  const ytd = mr.periods?.ytd;
  const colLabels = cols.map((m) => m.label);

  let pageNo = 0;
  const TOTAL = 6;
  const footer = () => { doc.setDrawColor(...LINE); doc.line(M, 802, W - M, 802); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...GREY); doc.text(`Management Report  |  ${mr.entity}`, M, 814); doc.text(`Page ${pageNo} of ${TOTAL}`, W - M, 814, { align: "right" }); };
  const heading = (title: string, sub: string) => { pageNo++; doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(...GREEN); doc.text(title, M, 70); doc.setFontSize(12); doc.setTextColor(...INK); doc.text(mr.entity, M, 90); doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(sub, M, 105); return 124; };
  const commentaryBlock = (text: string | undefined, y: number): number => {
    if (!text) return y;
    const lines = doc.splitTextToSize(text, W - 2 * M - 20);
    const h = lines.length * 11 + 26;
    doc.setFillColor(248, 250, 249); doc.roundedRect(M, y, W - 2 * M, h, 3, 3, "F"); doc.setFillColor(...GREEN); doc.rect(M, y, 3, h, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...GREEN); doc.text("✦ CONSIGLIERE — analysis & recommendations", M + 12, y + 15);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(45, 45, 45); doc.text(lines, M + 12, y + 29);
    return y + h + 14;
  };
  const monthHead = (extra: string[]) => [["", ...colLabels, ...extra].map((h) => ({ content: h, styles: { halign: "right" as const, fontStyle: "bold" as const, fontSize: 7.5 } }))];
  const grp = (t: string, span: number) => [{ content: t, colSpan: span, styles: { fontStyle: "bold" as const, textColor: GREEN as any, fontSize: 8 } }];
  const baseTable = (startY: number, head: any, body: any) => autoTable(doc, {
    startY, head, body, theme: "plain", margin: { left: M, right: M },
    styles: { font: "helvetica", fontSize: 8, cellPadding: { top: 2.5, bottom: 2.5, left: 5, right: 5 }, textColor: INK as any },
    headStyles: { textColor: GREY as any, lineWidth: { bottom: 1 } as any, lineColor: INK as any },
    columnStyles: { 0: { halign: "left", cellWidth: 168 } },
  });

  // ---------- COVER ----------
  pageNo++;
  doc.setFont("helvetica", "bold"); doc.setFontSize(30); doc.setTextColor(...GREEN); doc.text("Management Report", M, 300);
  doc.setDrawColor(...GREEN); doc.setLineWidth(2); doc.line(M, 312, M + 90, 312); doc.setLineWidth(1);
  doc.setFontSize(16); doc.setTextColor(...INK); doc.text(mr.entity, M, 340);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...GREY);
  doc.text("ABN 69 682 573 333", M, 358);
  doc.text(`Period: ${period === "ytd" ? "Year to Date" : period === "quarter" ? "Quarterly" : "Monthly"}  ·  3-month view`, M, 374);
  doc.text(`As at ${mr.asAt}`, M, 388);
  doc.text(`Generated ${new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "long", year: "numeric" })}`, M, 402);
  footer();

  // ---------- CONTENTS ----------
  doc.addPage(); pageNo++;
  doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(...GREEN); doc.text("Contents", M, 70);
  baseTable(100, undefined, [["Executive Summary", "3"], ["Profit and Loss", "4"], ["Balance Sheet", "5"], ["Aged Receivables Summary", "6"]]);
  footer();

  // ---------- EXECUTIVE SUMMARY (3 months + variance + YTD) ----------
  doc.addPage();
  let y = heading("Executive Summary", `${colLabels.join(" · ")}  ·  variance = ${latest?.label} vs ${prior?.label}`);
  const eGet = (m: MonthEntry | undefined, k: keyof MonthEntry["exec"]) => (m ? (m.exec[k] as number | null) : null);
  const eRow = (label: string, k: keyof MonthEntry["exec"], higherIsGood: boolean, ytdVal: number | null, isPct = false) => {
    const cells: any[] = [label];
    cols.forEach((m, i) => cells.push(numCell(eGet(m, k), eGet(cols[i + 1], k), higherIsGood, isPct)));
    cells.push(varianceCell(eGet(latest, k), eGet(prior, k), higherIsGood));
    cells.push({ content: isPct ? pct(ytdVal) : money(ytdVal), styles: { halign: "right" } });
    return cells;
  };
  const body: any[] = [];
  body.push(grp("Cash", cols.length + 3));
  const cGet = (m: MonthEntry | undefined) => (m ? m.cash.receipts : null);
  const cashRow: any[] = ["Cash received"];
  cols.forEach((m, i) => cashRow.push(numCell(cGet(m), cGet(cols[i + 1]), true)));
  cashRow.push(varianceCell(cGet(latest), cGet(prior), true)); cashRow.push({ content: "-", styles: { halign: "right" } });
  body.push(cashRow);
  body.push(grp("Profitability", cols.length + 3));
  body.push(eRow("Income", "income", true, ytd?.totalIncome ?? null));
  body.push(eRow("Direct costs (COGS)", "directCosts", false, ytd?.totalCogs ?? null));
  body.push(eRow("Gross profit", "grossProfit", true, ytd?.grossProfit ?? null));
  body.push(eRow("Operating expenses", "expenses", false, ytd?.totalOpex ?? null));
  body.push(eRow("Net profit / (loss)", "netProfit", true, ytd?.netProfit ?? null));
  body.push(grp("Balance Sheet", cols.length + 3));
  body.push(eRow("Debtors (receivables)", "debtors", true, mr.agedReceivables?.buckets?.total ?? null));
  body.push(eRow("Net assets", "netAssets", true, mr.balanceSheet?.totals?.netAssets ?? null));
  body.push(grp("Performance", cols.length + 3));
  body.push(eRow("Gross profit margin", "gpMargin", true, ytd?.gpPercent ?? null, true));
  body.push(eRow("Net profit margin", "npMargin", true, ytd?.netPercent ?? null, true));
  baseTable(y, monthHead(["VARIANCE", "YTD"]), body);
  y = (doc as any).lastAutoTable.finalY + 14;
  commentaryBlock(commentary.execSummary, y);
  footer();

  // ---------- PROFIT & LOSS (3 months + colour + cash block) ----------
  doc.addPage();
  y = heading("Profit and Loss", `${colLabels.join(" · ")}  ·  colours show movement vs prior month`);
  // union of line labels across the 3 months, per section, preserving order from latest
  const lineRows = (pick: (p: PnL) => Item[]): { label: string }[] => {
    const seen = new Set<string>(); const out: { label: string }[] = [];
    for (const m of cols) for (const it of pick(m.pnl)) if (!seen.has(it.label)) { seen.add(it.label); out.push({ label: it.label }); }
    return out;
  };
  const valOf = (m: MonthEntry | undefined, section: "income" | "cogs" | "opex", label: string): number | null => {
    if (!m) return null; const f = m.pnl[section].find((x) => x.label === label); return f ? f.value : null;
  };
  const plRow = (label: string, get: (m: MonthEntry | undefined) => number | null, higherIsGood: boolean, bold = false) => {
    const cells: any[] = [{ content: label, styles: bold ? { fontStyle: "bold" } : {} }];
    cols.forEach((m, i) => { const c = numCell(get(m), get(cols[i + 1]), higherIsGood); if (bold) (c.styles as any).fontStyle = "bold"; cells.push(c); });
    return cells;
  };
  const pl: any[] = [];
  pl.push(grp("Trading Income", cols.length + 1));
  lineRows((p) => p.income).forEach((r) => pl.push(plRow(r.label, (m) => valOf(m, "income", r.label), true)));
  pl.push(plRow("Total Trading Income", (m) => (m ? m.pnl.totalIncome : null), true, true));
  pl.push(grp("Cost of Sales", cols.length + 1));
  lineRows((p) => p.cogs).forEach((r) => pl.push(plRow(r.label, (m) => valOf(m, "cogs", r.label), false)));
  pl.push(plRow("Total Cost of Sales", (m) => (m ? m.pnl.totalCogs : null), false, true));
  pl.push(plRow("Gross Profit", (m) => (m ? m.pnl.grossProfit : null), true, true));
  // operating expenses grouped
  const opexLabels = lineRows((p) => p.opex);
  const byGroup: Record<string, string[]> = {};
  opexLabels.forEach((r) => (byGroup[groupOf(r.label)] ||= []).push(r.label));
  ["Business Expenses", "Employment Expenses", "General Expenses", "Occupancy Expenses", "Motor Vehicle & Travel Expenses"].forEach((gname) => {
    if (!byGroup[gname]?.length) return;
    pl.push(grp(gname, cols.length + 1));
    byGroup[gname].forEach((lab) => pl.push(plRow(lab, (m) => valOf(m, "opex", lab), false)));
  });
  pl.push(plRow("Total Operating Expenses", (m) => (m ? m.pnl.totalOpex : null), false, true));
  pl.push(plRow("Net Profit", (m) => (m ? m.pnl.netProfit : null), true, true));
  baseTable(y, monthHead([]), pl);
  y = (doc as any).lastAutoTable.finalY + 16;

  // accrual vs cash (latest month)
  if (latest) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...GREEN); doc.text(`Accrual vs Cash — ${latest.label}`, M, y); y += 6;
    const gap = (latest.pnl.totalIncome || 0) - (latest.cash.receipts || 0);
    autoTable(doc, {
      startY: y + 4, theme: "plain", margin: { left: M, right: M },
      head: [["", "Accrual (P&L)", "Cash (bank)", "Difference"].map((h) => ({ content: h, styles: { halign: "right" as const, fontStyle: "bold" as const, fontSize: 7.5 } }))],
      body: [["Trading income", { content: money(latest.pnl.totalIncome), styles: { halign: "right" } }, { content: money(latest.cash.receipts), styles: { halign: "right" } }, { content: money(gap), styles: { halign: "right", textColor: gap > 0 ? NEG : POS } }]],
      styles: { font: "helvetica", fontSize: 8, cellPadding: { top: 3, bottom: 3, left: 5, right: 5 } },
      columnStyles: { 0: { halign: "left", cellWidth: 168 } },
    });
    doc.setFont("helvetica", "italic"); doc.setFontSize(7.5); doc.setTextColor(...GREY);
    doc.text("A positive difference is revenue invoiced but not yet collected (sitting in receivables).", M, (doc as any).lastAutoTable.finalY + 12);
    y = (doc as any).lastAutoTable.finalY + 22;
  }
  commentaryBlock(commentary.pnl, y);
  footer();

  // ---------- BALANCE SHEET (full current + 3-month trend) ----------
  doc.addPage();
  y = heading("Balance Sheet", `Detail as at ${mr.asAt}  ·  3-month trend, colours vs prior month`);
  // 3-month trend summary
  const bGet = (m: MonthEntry | undefined, k: "totalAssets" | "totalLiabilities" | "netAssets" | "debtors") => (m ? m.bs[k] : null);
  const bRow = (label: string, k: "totalAssets" | "totalLiabilities" | "netAssets" | "debtors", higherIsGood: boolean) => {
    const cells: any[] = [label];
    cols.forEach((m, i) => cells.push(numCell(bGet(m, k), bGet(cols[i + 1], k), higherIsGood)));
    return cells;
  };
  baseTable(y, monthHead([]), [
    grp("Position — 3-month trend", cols.length + 1),
    bRow("Total Assets", "totalAssets", true),
    bRow("Total Liabilities", "totalLiabilities", false),
    bRow("Net Assets", "netAssets", true),
    bRow("Debtors (receivables)", "debtors", true),
  ]);
  y = (doc as any).lastAutoTable.finalY + 16;
  // full current-month detail
  const g = mr.balanceSheet.groups, t = mr.balanceSheet.totals;
  const R = (label: string, val: number, o: any = {}) => [label, { content: money(val), styles: { halign: "right", ...(o.bold ? { fontStyle: "bold" } : {}) } }];
  const items = (arr: Item[] = []) => arr.map((i) => R(i.label, i.value));
  const bd: any[] = [];
  bd.push(grp("Assets — Bank", 2)); bd.push(...items(g.bank)); bd.push(R("Total Bank", t.bank, { bold: true }));
  bd.push(grp("Current Assets", 2)); bd.push(...items(g.accountsReceivable)); bd.push(...items(g.stockPrepay)); bd.push(R("Total Stock & Prepayments", sum(g.stockPrepay), { bold: true })); bd.push(...items(g.loansDirectors)); bd.push(R("Total Loans to Directors", sum(g.loansDirectors), { bold: true })); bd.push(R("Total Current Assets", t.currentAssets, { bold: true }));
  bd.push(grp("Fixed & Non-current Assets", 2)); bd.push(...items(g.fixed)); bd.push(...items(g.nonCurrentAssets)); bd.push(R("Total Assets", t.totalAssets, { bold: true }));
  bd.push(grp("Liabilities", 2)); bd.push(...items(g.currentLiab)); bd.push(R("Total Current Liabilities", t.currentLiabilities, { bold: true })); bd.push(...items(g.financing)); bd.push(...items(g.hirePurchase)); bd.push(R("Total Non-current Liabilities", t.nonCurrentLiabilities, { bold: true })); bd.push(R("Total Liabilities", t.totalLiabilities, { bold: true }));
  bd.push(R("Net Assets", t.netAssets, { bold: true }));
  bd.push(grp("Equity", 2)); bd.push(...items(g.equity)); bd.push(R("Total Equity", t.totalEquity, { bold: true }));
  baseTable(y, [["", { content: mr.asAt, styles: { halign: "right", fontStyle: "bold", fontSize: 7.5 } }]], bd);
  y = (doc as any).lastAutoTable.finalY + 14;
  commentaryBlock(commentary.balanceSheet, y);
  footer();

  // ---------- AGED RECEIVABLES ----------
  doc.addPage();
  y = heading("Aged Receivables Summary", `As at ${mr.asAt} · ageing by due date`);
  const b = mr.agedReceivables.buckets;
  const arBody = mr.agedReceivables.byContact.map((c: any) => [c.name, money(c.current), money(c.lt1), money(c.m1), money(c.m2), money(c.m3), money(c.older), money(c.total)]);
  arBody.push([{ content: "Total", styles: { fontStyle: "bold" } }, money(b.current), money(b.lt1), money(b.m1), money(b.m2), money(b.m3), money(b.older), money(b.total)]);
  const pOf = (v: number) => (b.total ? `${Math.round((v / b.total) * 1000) / 10}%` : "-");
  arBody.push(["% of total", pOf(b.current), pOf(b.lt1), pOf(b.m1), pOf(b.m2), pOf(b.m3), pOf(b.older), "100%"]);
  autoTable(doc, {
    startY: y, theme: "plain", margin: { left: M, right: M },
    head: [["Contact", "Current", "<1 Mo", "1 Mo", "2 Mo", "3 Mo", "Older", "Total"].map((h, i) => ({ content: h, styles: { halign: i === 0 ? ("left" as const) : ("right" as const), fontStyle: "bold" as const, fontSize: 7 } }))],
    body: arBody as any,
    styles: { font: "helvetica", fontSize: 8, cellPadding: { top: 2.5, bottom: 2.5, left: 4, right: 4 } },
    columnStyles: { 0: { halign: "left", cellWidth: 150 }, 7: { halign: "right", fontStyle: "bold" }, 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" } },
    didParseCell: (dd: any) => { if (dd.section === "body" && dd.row.index === arBody.length - 2) { dd.cell.styles.lineWidth = { top: 1 }; dd.cell.styles.lineColor = INK; dd.cell.styles.fontStyle = "bold"; } if (dd.section === "body" && dd.row.index === arBody.length - 1) { dd.cell.styles.textColor = GREY; dd.cell.styles.fontSize = 7; } },
  });
  y = (doc as any).lastAutoTable.finalY + 16;
  commentaryBlock(commentary.agedReceivables, y);
  footer();

  doc.save(`TT_Management_Report_${period}_3mo.pdf`);
}
