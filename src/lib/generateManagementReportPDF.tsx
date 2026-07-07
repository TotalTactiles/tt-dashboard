import { pdf, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// ── Types (mirror the xero_management_report cache shape) ─────────────────
type LineItem = { label: string; value: number };

export interface PeriodBlock {
  hasData: boolean;
  income: LineItem[];
  totalIncome: number;
  cogs: LineItem[];
  totalCogs: number;
  grossProfit: number;
  gpPercent: number;
  opex: LineItem[];
  totalOpex: number;
  netProfit: number;
  netPercent: number;
}

export interface ManagementReport {
  entity: string;
  asAt: string;
  periods?: { month?: PeriodBlock; quarter?: PeriodBlock; ytd?: PeriodBlock };
  balanceSheet: {
    groups: {
      bank: LineItem[];
      accountsReceivable: LineItem[];
      stockPrepay: LineItem[];
      loansDirectors: LineItem[];
      fixed: LineItem[];
      nonCurrentAssets: LineItem[];
      currentLiab: LineItem[];
      financing: LineItem[];
      hirePurchase: LineItem[];
      equity: LineItem[];
    };
    totals: {
      bank: number;
      currentAssets: number;
      fixedAssets: number;
      nonCurrentAssets: number;
      totalAssets: number;
      currentLiabilities: number;
      financing: number;
      hirePurchase: number;
      nonCurrentLiabilities: number;
      totalLiabilities: number;
      netAssets: number;
      totalEquity: number;
    };
    ties: boolean;
  };
  agedReceivables: {
    buckets: { current: number; lt1: number; m1: number; m2: number; m3: number; older: number; total: number };
    byContact: Array<{ name: string; current: number; lt1: number; m1: number; m2: number; m3: number; older: number; total: number }>;
  };
}

export type PeriodKey = "month" | "quarter" | "ytd";

export interface ReportCommentary {
  execSummary?: string;
  pnl?: string;
  balanceSheet?: string;
  agedReceivables?: string;
}

// ── Styling ────────────────────────────────────────────────────────────────
const HEADING = "#3D89DA";
const POSITIVE = "#1D9E75";
const AUD = new Intl.NumberFormat("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (n: number | null | undefined) => {
  if (n === null || n === undefined || isNaN(n as number)) return "–";
  if (Math.abs(Number(n)) < 0.005) return "–";
  return n < 0 ? `(${AUD.format(Math.abs(n))})` : AUD.format(n);
};
const sum = (items: LineItem[]) => (items || []).reduce((a, b) => a + (Number(b.value) || 0), 0);

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: "#111" },
  h1: { fontSize: 18, marginBottom: 4, color: HEADING, fontWeight: 700 },
  meta: { fontSize: 9, color: "#666", marginBottom: 12 },
  section: { marginTop: 14 },
  sectionTitle: { fontSize: 12, marginBottom: 6, color: HEADING, fontWeight: 700 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  rowBold: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderTopWidth: 1, borderTopColor: "#ccc", marginTop: 2, fontWeight: 700 },
  rowNet: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderTopWidth: 1.5, borderTopColor: "#333", marginTop: 4, fontWeight: 700 },
  sub: { fontSize: 8, color: "#666", marginTop: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  indent: { paddingLeft: 10 },
  val: { fontFamily: "Courier", textAlign: "right", minWidth: 90 },
  th: { fontSize: 8, color: "#666", textTransform: "uppercase", paddingVertical: 3 },
  td: { fontSize: 8, fontFamily: "Courier", textAlign: "right" },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#eee", paddingVertical: 2 },
  commentaryBox: { marginTop: 10, padding: 8, backgroundColor: "#f4f8fd", borderLeftWidth: 3, borderLeftColor: HEADING, fontSize: 9, color: "#222" },
  commentaryLabel: { fontSize: 7, color: HEADING, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3, fontWeight: 700 },
});

function Row({ label, value, bold, net, indent, positiveGreen }: { label: string; value: number; bold?: boolean; net?: boolean; indent?: boolean; positiveGreen?: boolean }) {
  const style = net ? s.rowNet : bold ? s.rowBold : s.row;
  const color = positiveGreen && value > 0 ? POSITIVE : "#111";
  return (
    <View style={style}>
      <Text style={indent ? s.indent : undefined}>{label}</Text>
      <Text style={[s.val, { color }]}>{fmt(value)}</Text>
    </View>
  );
}

function Commentary({ label, text }: { label: string; text?: string }) {
  if (!text || !text.trim()) return null;
  return (
    <View style={s.commentaryBox}>
      <Text style={s.commentaryLabel}>{label}</Text>
      <Text>{text.trim()}</Text>
    </View>
  );
}

const emptyPeriod: PeriodBlock = {
  hasData: false, income: [], totalIncome: 0, cogs: [], totalCogs: 0,
  grossProfit: 0, gpPercent: 0, opex: [], totalOpex: 0, netProfit: 0, netPercent: 0,
};

function periodLabelOf(k: PeriodKey) {
  return k === "month" ? "Monthly" : k === "quarter" ? "Quarterly" : "YTD";
}

function ReportDoc({ mr, period, commentary }: { mr: ManagementReport; period: PeriodKey; commentary?: ReportCommentary }) {
  const p: PeriodBlock = { ...emptyPeriod, ...(mr.periods?.[period] ?? {}) };
  const bs = mr.balanceSheet;
  const ar = mr.agedReceivables;
  const periodLabel = periodLabelOf(period);
  const asAt = mr.asAt ? new Date(mr.asAt).toLocaleDateString("en-AU") : "";

  return (
    <Document>
      {/* Page 1 — Executive Summary + P&L */}
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>Management Report</Text>
        <Text style={s.meta}>{mr.entity} · As at {asAt} · {periodLabel}</Text>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Executive Summary</Text>
          <Text style={s.sub}>Profitability</Text>
          <Row label="Income" value={p.totalIncome} />
          <Row label="Direct Costs (COGS)" value={p.totalCogs} />
          <Row label="Gross Profit" value={p.grossProfit} bold />
          <Row label="Operating Expenses" value={p.totalOpex} />
          <Row label="Net Profit" value={p.netProfit} net positiveGreen />
          <Text style={s.sub}>Performance</Text>
          <View style={s.row}><Text>Gross Profit Margin</Text><Text style={s.val}>{(p.gpPercent || 0).toFixed(1)}%</Text></View>
          <View style={s.row}><Text>Net Profit Margin</Text><Text style={s.val}>{(p.netPercent || 0).toFixed(1)}%</Text></View>
          <Text style={s.sub}>Position</Text>
          <Row label="Debtors (Aged Receivables)" value={ar.buckets.total} />
          <Row label="Net Assets" value={bs.totals.netAssets} bold positiveGreen />
          <Commentary label="Consigliere note" text={commentary?.execSummary} />
        </View>

        <View style={s.section} break>
          <Text style={s.sectionTitle}>Profit and Loss — {periodLabel}</Text>
          <Text style={s.sub}>Trading Income</Text>
          {p.income.map((i, idx) => <Row key={`inc-${idx}`} label={i.label} value={i.value} indent />)}
          <Row label="Total Trading Income" value={p.totalIncome} bold />
          <Text style={s.sub}>Cost of Sales</Text>
          {p.cogs.map((i, idx) => <Row key={`cogs-${idx}`} label={i.label} value={i.value} indent />)}
          <Row label="Total Cost of Sales" value={p.totalCogs} bold />
          <Row label="Gross Profit" value={p.grossProfit} bold />
          <View style={s.row}><Text>Gross Profit %</Text><Text style={s.val}>{(p.gpPercent || 0).toFixed(1)}%</Text></View>
          <Text style={s.sub}>Operating Expenses</Text>
          {p.opex.map((i, idx) => <Row key={`opex-${idx}`} label={i.label} value={i.value} indent />)}
          <Row label="Total Operating Expenses" value={p.totalOpex} bold />
          <Row label="Net Profit" value={p.netProfit} net positiveGreen />
          <View style={s.row}><Text>Net Profit %</Text><Text style={s.val}>{(p.netPercent || 0).toFixed(1)}%</Text></View>
          <Commentary label="Consigliere note" text={commentary?.pnl} />
        </View>
      </Page>

      {/* Page 2 — Balance Sheet */}
      <Page size="A4" style={s.page}>
        <Text style={s.sectionTitle}>Balance Sheet — As at {asAt}</Text>
        <Text style={s.sub}>Assets — Bank</Text>
        {bs.groups.bank.map((i, idx) => <Row key={`bk-${idx}`} label={i.label} value={i.value} indent />)}
        <Row label="Total Bank" value={bs.totals.bank} bold />
        <Text style={s.sub}>Current Assets</Text>
        {bs.groups.accountsReceivable.map((i, idx) => <Row key={`ar-${idx}`} label={i.label} value={i.value} indent />)}
        <Row label="Stock on Hand & Prepayments" value={sum(bs.groups.stockPrepay)} indent />
        <Row label="Loans to Directors" value={sum(bs.groups.loansDirectors)} indent />
        <Row label="Total Current Assets" value={bs.totals.currentAssets} bold />
        <Text style={s.sub}>Fixed Assets</Text>
        {bs.groups.fixed.map((i, idx) => <Row key={`fx-${idx}`} label={i.label} value={i.value} indent />)}
        <Row label="Total Fixed Assets" value={bs.totals.fixedAssets} bold />
        <Text style={s.sub}>Non-current Assets</Text>
        {bs.groups.nonCurrentAssets.map((i, idx) => <Row key={`nca-${idx}`} label={i.label} value={i.value} indent />)}
        <Row label="Total Non-current Assets" value={bs.totals.nonCurrentAssets} bold />
        <Row label="Total Assets" value={bs.totals.totalAssets} net />

        <Text style={s.sub}>Liabilities — Current</Text>
        {bs.groups.currentLiab.map((i, idx) => <Row key={`cl-${idx}`} label={i.label} value={i.value} indent />)}
        <Row label="Total Current Liabilities" value={bs.totals.currentLiabilities} bold />
        <Text style={s.sub}>Non-current — Financing</Text>
        {bs.groups.financing.map((i, idx) => <Row key={`fn-${idx}`} label={i.label} value={i.value} indent />)}
        <Row label="Total Financing" value={bs.totals.financing} indent />
        <Text style={s.sub}>Non-current — Hire Purchase</Text>
        {bs.groups.hirePurchase.map((i, idx) => <Row key={`hp-${idx}`} label={i.label} value={i.value} indent />)}
        <Row label="Total Hire Purchase" value={bs.totals.hirePurchase} indent />
        <Row label="Total Non-current Liabilities" value={bs.totals.nonCurrentLiabilities} bold />
        <Row label="Total Liabilities" value={bs.totals.totalLiabilities} bold />
        <Row label="Net Assets" value={bs.totals.netAssets} net positiveGreen />
        <Text style={s.sub}>Equity</Text>
        {bs.groups.equity.map((i, idx) => <Row key={`eq-${idx}`} label={i.label} value={i.value} indent />)}
        <Row label="Total Equity" value={bs.totals.totalEquity} bold />
        <Commentary label="Consigliere note" text={commentary?.balanceSheet} />
      </Page>

      {/* Page 3 — Aged Receivables (landscape) */}
      <Page size="A4" style={s.page} orientation="landscape">
        <Text style={s.sectionTitle}>Aged Receivables</Text>
        <View style={[s.tr, { borderBottomWidth: 1, borderBottomColor: "#333" }]}>
          <Text style={[s.th, { flex: 3 }]}>Contact</Text>
          {["Current", "<1 Mo", "1 Mo", "2 Mo", "3 Mo", "Older", "Total"].map((h) => (
            <Text key={h} style={[s.th, { flex: 1, textAlign: "right" }]}>{h}</Text>
          ))}
        </View>
        {ar.byContact.map((r, idx) => (
          <View key={`c-${idx}`} style={s.tr}>
            <Text style={{ flex: 3, fontSize: 8 }}>{r.name}</Text>
            <Text style={[s.td, { flex: 1 }]}>{fmt(r.current)}</Text>
            <Text style={[s.td, { flex: 1 }]}>{fmt(r.lt1)}</Text>
            <Text style={[s.td, { flex: 1 }]}>{fmt(r.m1)}</Text>
            <Text style={[s.td, { flex: 1 }]}>{fmt(r.m2)}</Text>
            <Text style={[s.td, { flex: 1 }]}>{fmt(r.m3)}</Text>
            <Text style={[s.td, { flex: 1 }]}>{fmt(r.older)}</Text>
            <Text style={[s.td, { flex: 1 }]}>{fmt(r.total)}</Text>
          </View>
        ))}
        <View style={[s.tr, { borderTopWidth: 1.5, borderTopColor: "#333" }]}>
          <Text style={{ flex: 3, fontSize: 8, fontWeight: 700 }}>Total</Text>
          <Text style={[s.td, { flex: 1 }]}>{fmt(ar.buckets.current)}</Text>
          <Text style={[s.td, { flex: 1 }]}>{fmt(ar.buckets.lt1)}</Text>
          <Text style={[s.td, { flex: 1 }]}>{fmt(ar.buckets.m1)}</Text>
          <Text style={[s.td, { flex: 1 }]}>{fmt(ar.buckets.m2)}</Text>
          <Text style={[s.td, { flex: 1 }]}>{fmt(ar.buckets.m3)}</Text>
          <Text style={[s.td, { flex: 1 }]}>{fmt(ar.buckets.older)}</Text>
          <Text style={[s.td, { flex: 1 }]}>{fmt(ar.buckets.total)}</Text>
        </View>
        <Commentary label="Consigliere note" text={commentary?.agedReceivables} />
      </Page>
    </Document>
  );
}

// Trigger a download in the browser.
export async function generateManagementReportPDF(
  mr: ManagementReport,
  period: PeriodKey,
  commentary?: ReportCommentary,
): Promise<string> {
  const blob = await pdf(<ReportDoc mr={mr} period={period} commentary={commentary} />).toBlob();
  const url = URL.createObjectURL(blob);
  const stamp = mr.asAt ? new Date(mr.asAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const filename = `TT_Management_Report_${periodLabelOf(period)}_${stamp}.pdf`;
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return filename;
}
