// src/lib/generateManagementReportPDF.ts  (v3)
// Fixes vs v2: variance arrows are DRAWN as vector triangles (jsPDF fonts can't print ▲▼);
// columns use the last 3 COMPLETE months (current MTD shown only as a footnote);
// Balance Sheet trend uses reliable rows (Net Assets / Debtors / Cash at bank) instead of
// Xero's raw signed totals; Accrual-vs-Cash uses the latest COMPLETE month.
// Requires: jspdf, jspdf-autotable

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Item = { label: string; value: number };
interface PnL { totalIncome: number; income: Item[]; cogs: Item[]; totalCogs: number; grossProfit: number; gpPercent: number; opex: Item[]; totalOpex: number; netProfit: number; netPercent: number; hasData: boolean; }
interface MonthEntry {
  key: string; label: string; start: string; end: string; isCurrent?: boolean;
  exec: { income: number; directCosts: number; grossProfit: number; expenses: number; netProfit: number; gpMargin: number; npMargin: number; debtors: number | null; netAssets: number | null; };
  pnl: PnL;
  bs: { netAssets: number | null; debtors: number | null; totalAssets: number | null; totalLiabilities: number | null; totalBank?: number | null; hasData: boolean; };
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

function trendColor(cur: number | null, prior: number | null, higherIsGood: boolean): [number, number, number] {
  if (cur == null || prior == null) return INK;
  if (Math.abs(cur - prior) < 0.005) return INK;
  return (cur > prior) === higherIsGood ? POS : NEG;
}
const numCell = (v: number | null, prior: number | null, higherIsGood: boolean, isPct = false) => ({
  content: isPct ? pct(v) : money(v),
  styles: { textColor: trendColor(v, prior, higherIsGood), halign: "right" as const },
});

// Variance: text is "+268%" / "-59%" / "0%"; direction stored for a DRAWN arrow via didDrawCell.
type VarMeta = { dir: "up" | "down" | "flat"; col: [number, number, number] };
function varianceCell(cur: number | null, prior: number | null, higherIsGood: boolean) {
  if (cur == null || prior == null) return { content: "-", styles: { textColor: GREY, halign: "right" as const }, __var: { dir: "flat", col: GREY } as VarMeta };
  const diff = cur - prior;
  const pv = prior !== 0 ? (diff / Math.abs(prior)) * 100 : null;
  const flat = Math.abs(diff) < 0.005;
  const dir: VarMeta["dir"] = flat ? "flat" : diff > 0 ? "up" : "down";
  const col = flat ? GREY : (diff > 0) === higherIsGood ? POS : NEG;
  const txt = pv == null ? "" : `${pv > 0 ? "+" : ""}${Math.round(pv)}%  `; // trailing gap for the drawn arrow
  return { content: flat ? "0%  " : txt, styles: { textColor: col, halign: "right" as const, fontSize: 7.5 }, __var: { dir, col } as VarMeta };
}
// draws the triangle/dash in a variance cell
function drawVarArrow(doc: jsPDF, data: any) {
  const meta: VarMeta | undefined = (data.cell.raw as any)?.__var;
  if (!meta) return;
  const { x, y, width, height } = data.cell;
  const cx = x + width - 8, cy = y + height / 2, s = 2.6;
  doc.setFillColor(meta.col[0], meta.col[1], meta.col[2]);
  doc.setDrawColor(meta.col[0], meta.col[1], meta.col[2]);
  if (meta.dir === "up") doc.triangle(cx - s, cy + s, cx + s, cy + s, cx, cy - s, "F");
  else if (meta.dir === "down") doc.triangle(cx - s, cy - s, cx + s, cy - s, cx, cy + s, "F");
  else { doc.setLineWidth(1.2); doc.line(cx - s, cy, cx + s, cy); doc.setLineWidth(0.5); }
}

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

  // COMPLETE months only, newest first; MTD kept aside for the footnote
  const all: MonthEntry[] = mr.monthly ?? [];
  const complete = all.filter((m) => !m.isCurrent);
  const mtd = all.find((m) => m.isCurrent) || null;
  const cols = complete.slice(-3).reverse();          // e.g. [Jun, May, Apr]
  const latest = cols[0], prior = cols[1];
  const ytd = mr.periods?.ytd;
  const colLabels = cols.map((m) => m.label);

  let pageNo = 0; const TOTAL = 6;
  const footer = () => { doc.setDrawColor(...LINE); doc.line(M, 802, W - M, 802); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...GREY); doc.text(`Management Report  |  ${mr.entity}`, M, 814); doc.text(`Page ${pageNo} of ${TOTAL}`, W - M, 814, { align: "right" }); };
  const heading = (title: string, sub: string) => { pageNo++; doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(...GREEN); doc.text(title, M, 70); doc.setFontSize(12); doc.setTextColor(...INK); doc.text(mr.entity, M, 90); doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(sub, M, 105); return 124; };
  const commentaryBlock = (text: string | undefined, y: number): number => {
    if (!text) return y;
    const lines = doc.splitTextToSize(text, W - 2 * M - 20);
    const h = lines.length * 11 + 26;
    doc.setFillColor(248, 250, 249); doc.roundedRect(M, y, W - 2 * M, h, 3, 3, "F"); doc.setFillColor(...GREEN); doc.rect(M, y, 3, h, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...GREEN); doc.text("CONSIGLIERE — analysis & recommendations", M + 12, y + 15);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(45, 45, 45); doc.text(lines, M + 12, y + 29);
    return y + h + 14;
  };
  const monthHead = (extra: string[]) => [["", ...colLabels, ...extra].map((h) => ({ content: h, styles: { halign: "right" as const, fontStyle: "bold" as const, fontSize: 7.5 } }))];
  const grp = (t: string, span: number) => [{ content: t, colSpan: span, styles: { fontStyle: "bold" as const, textColor: GREEN as any, fontSize: 8 } }];
  const baseTable = (startY: number, head: any, body: any, withArrows = false) => autoTable(doc, {
    startY, head, body, theme: "plain", margin: { left: M, right: M },
    styles: { font: "helvetica", fontSize: 8, cellPadding: { top: 2.5, bottom: 2.5, left: 5, right: 5 }, textColor: INK as any },
    headStyles: { textColor: GREY as any, lineWidth: { bottom: 1 } as any, lineColor: INK as any },
    columnStyles: { 0: { halign: "left", cellWidth: 165 } },
    ...(withArrows ? { didDrawCell: (data: any) => drawVarArrow(doc, data) } : {}),
  });

  // ---------- COVER ----------
  pageNo++;
  doc.setFont("helvetica", "bold"); doc.setFontSize(30); doc.setTextColor(...GREEN); doc.text("Management Report", M, 300);
  doc.setDrawColor(...GREEN); doc.setLineWidth(2); doc.line(M, 312, M + 90, 312); doc.setLineWidth(1);
  doc.setFontSize(16); doc.setTextColor(...INK); doc.text(mr.entity, M, 340);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...GREY);
  doc.text("ABN 69 682 573 333", M, 358);
  doc.text(`3-month view: ${colLabels.slice().reverse().join("  ·  ")}`, M, 374);
  doc.text(`As at ${mr.asAt}`, M, 388);
  doc.text(`Generated ${new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "long", year: "numeric" })}`, M, 402);
  footer();

  // ---------- CONTENTS ----------
  doc.addPage(); pageNo++;
  doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(...GREEN); doc.text("Contents", M, 70);
  baseTable(100, undefined, [["Executive Summary", "3"], ["Profit and Loss", "4"], ["Balance Sheet", "5"], ["Aged Receivables Summary", "6"]]);
  footer();

  // ---------- EXECUTIVE SUMMARY ----------
  doc.addPage();
  let y = heading("Executive Summary", `Last 3 complete months · variance = ${latest?.label} vs ${prior?.label}`);
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
  const cGet = (m: MonthEntry | undefined, k: "receipts" | "spend") => (m ? m.cash[k] : null);
  const cashRow = (label: string, k: "receipts" | "spend", hig: boolean) => {
    const cells: any[] = [label];
    cols.forEach((m, i) => cells.push(numCell(cGet(m, k), cGet(cols[i + 1], k), hig)));
    cells.push(varianceCell(cGet(latest, k), cGet(prior, k), hig)); cells.push({ content: "-", styles: { halign: "right" } });
    return cells;
  };
  body.push(cashRow("Cash received", "receipts", true));
  body.push(cashRow("Cash spent", "spend", false));
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
  baseTable(y, monthHead(["VARIANCE", "YTD"]), body, true);
  y = (doc as any).lastAutoTable.finalY + 10;
  if (mtd) { doc.setFont("helvetica", "italic"); doc.setFontSize(7.5); doc.setTextColor(...GREY); doc.text(`${mtd.label}: income ${money(mtd.pnl.totalIncome)}, cash received ${money(mtd.cash.receipts)} — excluded from comparisons (partial month).`, M, y + 4); y += 16; }
  commentaryBlock(commentary.execSummary, y);
  footer();

  // ---------- PROFIT & LOSS ----------
  doc.addPage();
  y = heading("Profit and Loss", `${colLabels.join(" · ")} · colours show movement vs prior month`);
  const lineRows = (pick: (p: PnL) => Item[]): { label: string }[] => {
    const seen = new Set<string>(); const out: { label: string }[] = [];
    for (const m of cols) for (const it of pick(m.pnl)) if (!seen.has(it.label)) { seen.add(it.label); out.push({ label: it.label }); }
    return out;
  };
  const valOf = (m: MonthEntry | undefined, s: "income" | "cogs" | "opex", label: string): number | null => { if (!m) return null; const f = m.pnl[s].find((x) => x.label === label); return f ? f.value : null; };
  const plRow = (label: string, get: (m: MonthEntry | undefined) => number | null, hig: boolean, bold = false) => {
    const cells: any[] = [{ content: label, styles: bold ? { fontStyle: "bold" } : {} }];
    cols.forEach((m, i) => { const c = numCell(get(m), get(cols[i + 1]), hig); if (bold) (c.styles as any).fontStyle = "bold"; cells.push(c); });
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
  // Accrual vs Cash — latest COMPLETE month
  if (latest) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...GREEN); doc.text(`Xero vs Cashflow Sheet — ${latest.label}`, M, y);
    const gap = (latest.pnl.totalIncome || 0) - (latest.cash.receipts || 0);
    autoTable(doc, {
      startY: y + 6, theme: "plain", margin: { left: M, right: M },
      head: [["", "Accrual (P&L)", "Cash (bank)", "Difference"].map((h) => ({ content: h, styles: { halign: "right" as const, fontStyle: "bold" as const, fontSize: 7.5 } }))],
      body: [["Trading income", { content: money(latest.pnl.totalIncome), styles: { halign: "right" } }, { content: money(latest.cash.receipts), styles: { halign: "right" } }, { content: money(gap), styles: { halign: "right", textColor: gap > 0 ? NEG : POS } }]],
      styles: { font: "helvetica", fontSize: 8, cellPadding: { top: 3, bottom: 3, left: 5, right: 5 } },
      columnStyles: { 0: { halign: "left", cellWidth: 165 } },
    });
    doc.setFont("helvetica", "italic"); doc.setFontSize(7.5); doc.setTextColor(...GREY);
    doc.text("A positive difference is revenue invoiced but not yet collected (sitting in receivables).", M, (doc as any).lastAutoTable.finalY + 11);
    y = (doc as any).lastAutoTable.finalY + 22;
  }
  commentaryBlock(commentary.pnl, y);
  footer();

  // ---------- BALANCE SHEET ----------
  doc.addPage();
  y = heading("Balance Sheet", `Detail as at ${mr.asAt} · trend vs prior month`);
  const bGet = (m: MonthEntry | undefined, k: "netAssets" | "debtors" | "totalBank") => (m ? ((m.bs as any)[k] ?? null) : null);
  const bRow = (label: string, k: "netAssets" | "debtors" | "totalBank", hig: boolean) => {
    const cells: any[] = [label];
    cols.forEach((m, i) => cells.push(numCell(bGet(m, k), bGet(cols[i + 1], k), hig)));
    return cells;
  };
  baseTable(y, monthHead([]), [
    grp("Position — 3-month trend", cols.length + 1),
    bRow("Cash at bank", "totalBank", true),
    bRow("Debtors (receivables)", "debtors", true),
    bRow("Net Assets", "netAssets", true),
  ]);
  y = (doc as any).lastAutoTable.finalY + 16;
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
    columnStyles: { 0: { halign: "left", cellWidth: 150 }, 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right", fontStyle: "bold" } },
    didParseCell: (dd: any) => { if (dd.section === "body" && dd.row.index === arBody.length - 2) { dd.cell.styles.lineWidth = { top: 1 }; dd.cell.styles.lineColor = INK; dd.cell.styles.fontStyle = "bold"; } if (dd.section === "body" && dd.row.index === arBody.length - 1) { dd.cell.styles.textColor = GREY; dd.cell.styles.fontSize = 7; } },
  });
  y = (doc as any).lastAutoTable.finalY + 16;
  commentaryBlock(commentary.agedReceivables, y);
  footer();

  doc.save(`TT_Management_Report_${period}_3mo.pdf`);
}
