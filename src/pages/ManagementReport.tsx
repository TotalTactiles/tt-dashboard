import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Loader2, Download } from "lucide-react";
import { pdf, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";

const CACHE_URL = "https://n8n.srv1437130.hstgr.cloud/webhook/dashboard-cache";
const CACHE_KEY = "xero_mgmt_report";

type LineItem = { label: string; value: number };

interface PeriodBlock {
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

interface ManagementReport {
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
  pnl?: { revenue: number; grossProfit: number; totalExpenses: number; netProfit: number; accountsReceivable: number };
}

type PeriodKey = "month" | "quarter" | "ytd";

const HEADING = "#3D89DA";
const POSITIVE = "#1D9E75";

const AUD = new Intl.NumberFormat("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (n: number | null | undefined) => {
  if (n === null || n === undefined || isNaN(n as number)) return "–";
  if (Math.abs(Number(n)) < 0.005) return "–";
  return n < 0 ? `(${AUD.format(Math.abs(n))})` : AUD.format(n);
};
const fmtPct = (n: number) => (isNaN(n) || !isFinite(n) ? "–" : `${(n * 100).toFixed(1)}%`);
const sum = (items: LineItem[]) => (items || []).reduce((a, b) => a + (Number(b.value) || 0), 0);

const emptyPeriod: PeriodBlock = {
  hasData: false, income: [], totalIncome: 0, cogs: [], totalCogs: 0,
  grossProfit: 0, gpPercent: 0, opex: [], totalOpex: 0, netProfit: 0, netPercent: 0,
};

function Row({
  label, value, bold, indent, emphasis, positiveGreen,
}: { label: string; value: number; bold?: boolean; indent?: boolean; emphasis?: "net" | "sub"; positiveGreen?: boolean }) {
  const isNet = emphasis === "net";
  const color = positiveGreen && value > 0 ? POSITIVE : undefined;
  return (
    <div className={`flex items-baseline justify-between py-1.5 ${emphasis === "sub" ? "border-t border-border/60 mt-1 pt-2" : ""} ${isNet ? "border-t-2 border-border mt-2 pt-3" : ""}`}>
      <span className={`${bold || isNet ? "font-semibold" : ""} ${indent ? "pl-4" : ""} text-sm`}>{label}</span>
      <span className={`font-mono text-sm tabular-nums text-right ${bold || isNet ? "font-semibold" : ""}`} style={color ? { color } : undefined}>
        {fmt(value)}
      </span>
    </div>
  );
}

function SectionCard({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-md p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h2 className="text-lg font-semibold" style={{ color: HEADING }}>{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}

function SubHeader({ children }: { children: React.ReactNode }) {
  return <div className="text-xs uppercase tracking-wider text-muted-foreground font-mono mt-4 mb-1">{children}</div>;
}

// ── PDF ────────────────────────────────────────────────────────────────────
const pdfStyles = StyleSheet.create({
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
});

function PdfRow({ label, value, bold, net, indent, positiveGreen }: { label: string; value: number; bold?: boolean; net?: boolean; indent?: boolean; positiveGreen?: boolean }) {
  const style = net ? pdfStyles.rowNet : bold ? pdfStyles.rowBold : pdfStyles.row;
  const color = positiveGreen && value > 0 ? POSITIVE : "#111";
  return (
    <View style={style}>
      <Text style={indent ? pdfStyles.indent : undefined}>{label}</Text>
      <Text style={[pdfStyles.val, { color }]}>{fmt(value)}</Text>
    </View>
  );
}

function ReportPDF({ mr, p, periodLabel }: { mr: ManagementReport; p: PeriodBlock; periodLabel: string }) {
  const bs = mr.balanceSheet;
  const ar = mr.agedReceivables;
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <Text style={pdfStyles.h1}>Management Report</Text>
        <Text style={pdfStyles.meta}>{mr.entity} · As at {new Date(mr.asAt).toLocaleDateString("en-AU")} · {periodLabel}</Text>

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Executive Summary</Text>
          <Text style={pdfStyles.sub}>Profitability</Text>
          <PdfRow label="Income" value={p.totalIncome} />
          <PdfRow label="Direct Costs (COGS)" value={p.totalCogs} />
          <PdfRow label="Gross Profit" value={p.grossProfit} bold />
          <PdfRow label="Operating Expenses" value={p.totalOpex} />
          <PdfRow label="Net Profit" value={p.netProfit} net positiveGreen />
          <Text style={pdfStyles.sub}>Performance</Text>
          <View style={pdfStyles.row}><Text>Gross Profit Margin</Text><Text style={pdfStyles.val}>{p.gpPercent.toFixed(1)}%</Text></View>
          <View style={pdfStyles.row}><Text>Net Profit Margin</Text><Text style={pdfStyles.val}>{p.netPercent.toFixed(1)}%</Text></View>
          <Text style={pdfStyles.sub}>Position</Text>
          <PdfRow label="Debtors" value={ar.buckets.total} />
          <PdfRow label="Net Assets" value={bs.totals.netAssets} bold positiveGreen />
        </View>

        <View style={pdfStyles.section} break>
          <Text style={pdfStyles.sectionTitle}>Profit and Loss — {periodLabel}</Text>
          <Text style={pdfStyles.sub}>Trading Income</Text>
          {p.income.map((i) => <PdfRow key={i.label} label={i.label} value={i.value} indent />)}
          <PdfRow label="Total Trading Income" value={p.totalIncome} bold />
          <Text style={pdfStyles.sub}>Cost of Sales</Text>
          {p.cogs.map((i) => <PdfRow key={i.label} label={i.label} value={i.value} indent />)}
          <PdfRow label="Total Cost of Sales" value={p.totalCogs} bold />
          <PdfRow label="Gross Profit" value={p.grossProfit} bold />
          <View style={pdfStyles.row}><Text>Gross Profit %</Text><Text style={pdfStyles.val}>{p.gpPercent.toFixed(1)}%</Text></View>
          <Text style={pdfStyles.sub}>Operating Expenses</Text>
          {p.opex.map((i) => <PdfRow key={i.label} label={i.label} value={i.value} indent />)}
          <PdfRow label="Total Operating Expenses" value={p.totalOpex} bold />
          <PdfRow label="Net Profit" value={p.netProfit} net positiveGreen />
          <View style={pdfStyles.row}><Text>Net Profit %</Text><Text style={pdfStyles.val}>{p.netPercent.toFixed(1)}%</Text></View>
        </View>
      </Page>

      <Page size="A4" style={pdfStyles.page}>
        <Text style={pdfStyles.sectionTitle}>Balance Sheet — As at {new Date(mr.asAt).toLocaleDateString("en-AU")}</Text>
        <Text style={pdfStyles.sub}>Assets — Bank</Text>
        {bs.groups.bank.map((i) => <PdfRow key={i.label} label={i.label} value={i.value} indent />)}
        <PdfRow label="Total Bank" value={bs.totals.bank} bold />
        <Text style={pdfStyles.sub}>Current Assets</Text>
        {bs.groups.accountsReceivable.map((i) => <PdfRow key={i.label} label={i.label} value={i.value} indent />)}
        <PdfRow label="Stock on Hand & Prepayments" value={sum(bs.groups.stockPrepay)} indent />
        <PdfRow label="Loans to Directors" value={sum(bs.groups.loansDirectors)} indent />
        <PdfRow label="Total Current Assets" value={bs.totals.currentAssets} bold />
        <Text style={pdfStyles.sub}>Fixed Assets</Text>
        {bs.groups.fixed.map((i) => <PdfRow key={i.label} label={i.label} value={i.value} indent />)}
        <PdfRow label="Total Fixed Assets" value={bs.totals.fixedAssets} bold />
        <Text style={pdfStyles.sub}>Non-current Assets</Text>
        {bs.groups.nonCurrentAssets.map((i) => <PdfRow key={i.label} label={i.label} value={i.value} indent />)}
        <PdfRow label="Total Non-current Assets" value={bs.totals.nonCurrentAssets} bold />
        <PdfRow label="Total Assets" value={bs.totals.totalAssets} net />

        <Text style={pdfStyles.sub}>Liabilities — Current</Text>
        {bs.groups.currentLiab.map((i) => <PdfRow key={i.label} label={i.label} value={i.value} indent />)}
        <PdfRow label="Total Current Liabilities" value={bs.totals.currentLiabilities} bold />
        <Text style={pdfStyles.sub}>Non-current — Financing</Text>
        {bs.groups.financing.map((i) => <PdfRow key={i.label} label={i.label} value={i.value} indent />)}
        <PdfRow label="Total Financing" value={bs.totals.financing} indent />
        <Text style={pdfStyles.sub}>Non-current — Hire Purchase</Text>
        {bs.groups.hirePurchase.map((i) => <PdfRow key={i.label} label={i.label} value={i.value} indent />)}
        <PdfRow label="Total Hire Purchase" value={bs.totals.hirePurchase} indent />
        <PdfRow label="Total Non-current Liabilities" value={bs.totals.nonCurrentLiabilities} bold />
        <PdfRow label="Total Liabilities" value={bs.totals.totalLiabilities} bold />
        <PdfRow label="Net Assets" value={bs.totals.netAssets} net positiveGreen />
        <Text style={pdfStyles.sub}>Equity</Text>
        {bs.groups.equity.map((i) => <PdfRow key={i.label} label={i.label} value={i.value} indent />)}
        <PdfRow label="Total Equity" value={bs.totals.totalEquity} bold />
      </Page>

      <Page size="A4" style={pdfStyles.page} orientation="landscape">
        <Text style={pdfStyles.sectionTitle}>Aged Receivables</Text>
        <View style={[pdfStyles.tr, { borderBottomWidth: 1, borderBottomColor: "#333" }]}>
          <Text style={[pdfStyles.th, { flex: 3 }]}>Contact</Text>
          {["Current", "<1 Mo", "1 Mo", "2 Mo", "3 Mo", "Older", "Total"].map((h) => (
            <Text key={h} style={[pdfStyles.th, { flex: 1, textAlign: "right" }]}>{h}</Text>
          ))}
        </View>
        {ar.byContact.map((r) => (
          <View key={r.name} style={pdfStyles.tr}>
            <Text style={{ flex: 3, fontSize: 8 }}>{r.name}</Text>
            <Text style={[pdfStyles.td, { flex: 1 }]}>{fmt(r.current)}</Text>
            <Text style={[pdfStyles.td, { flex: 1 }]}>{fmt(r.lt1)}</Text>
            <Text style={[pdfStyles.td, { flex: 1 }]}>{fmt(r.m1)}</Text>
            <Text style={[pdfStyles.td, { flex: 1 }]}>{fmt(r.m2)}</Text>
            <Text style={[pdfStyles.td, { flex: 1 }]}>{fmt(r.m3)}</Text>
            <Text style={[pdfStyles.td, { flex: 1 }]}>{fmt(r.older)}</Text>
            <Text style={[pdfStyles.td, { flex: 1 }]}>{fmt(r.total)}</Text>
          </View>
        ))}
        <View style={[pdfStyles.tr, { borderTopWidth: 1.5, borderTopColor: "#333", fontWeight: 700 }]}>
          <Text style={{ flex: 3, fontSize: 8, fontWeight: 700 }}>Total</Text>
          <Text style={[pdfStyles.td, { flex: 1 }]}>{fmt(ar.buckets.current)}</Text>
          <Text style={[pdfStyles.td, { flex: 1 }]}>{fmt(ar.buckets.lt1)}</Text>
          <Text style={[pdfStyles.td, { flex: 1 }]}>{fmt(ar.buckets.m1)}</Text>
          <Text style={[pdfStyles.td, { flex: 1 }]}>{fmt(ar.buckets.m2)}</Text>
          <Text style={[pdfStyles.td, { flex: 1 }]}>{fmt(ar.buckets.m3)}</Text>
          <Text style={[pdfStyles.td, { flex: 1 }]}>{fmt(ar.buckets.older)}</Text>
          <Text style={[pdfStyles.td, { flex: 1 }]}>{fmt(ar.buckets.total)}</Text>
        </View>
      </Page>
    </Document>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function ManagementReportPage() {
  const [report, setReport] = useState<ManagementReport | null>(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? (JSON.parse(raw) as ManagementReport) : null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodKey>("ytd");
  const [downloading, setDownloading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(CACHE_URL);
      if (!res.ok) throw new Error(`Cache fetch failed (${res.status})`);
      const rows = await res.json();
      const list: any[] = Array.isArray(rows) ? rows : Array.isArray(rows?.rows) ? rows.rows : [];
      const row = list.find((r) => r?.key === "xero_management_report");
      if (!row) throw new Error("xero_management_report row not found in cache");
      const raw = row.value;
      const mgmt = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!mgmt) throw new Error("Empty managementReport value");
      setReport(mgmt as ManagementReport);
      localStorage.setItem(CACHE_KEY, JSON.stringify(mgmt));
    } catch (e: any) {
      setError(e?.message || "Fetch failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const p: PeriodBlock = useMemo(() => {
    const src = report?.periods?.[period];
    if (!src) return emptyPeriod;
    return {
      hasData: !!src.hasData,
      income: src.income ?? [],
      totalIncome: Number(src.totalIncome) || 0,
      cogs: src.cogs ?? [],
      totalCogs: Number(src.totalCogs) || 0,
      grossProfit: Number(src.grossProfit) || 0,
      gpPercent: Number(src.gpPercent) || 0,
      opex: src.opex ?? [],
      totalOpex: Number(src.totalOpex) || 0,
      netProfit: Number(src.netProfit) || 0,
      netPercent: Number(src.netPercent) || 0,
    };
  }, [report, period]);

  const periodLabel = period === "month" ? "Monthly" : period === "quarter" ? "Quarterly" : "YTD";

  const handleDownload = useCallback(async () => {
    if (!report) return;
    setDownloading(true);
    try {
      const blob = await pdf(<ReportPDF mr={report} p={p} periodLabel={periodLabel} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Management_Report_${periodLabel}_${new Date(report.asAt).toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }, [report, p, periodLabel]);

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6 py-4 px-2 sm:px-0">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Management Report</h1>
            <p className="text-sm text-muted-foreground font-mono mt-1">
              {report ? `${report.entity} · As at ${new Date(report.asAt).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}` : "Loading live Xero data…"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={!report || downloading}>
              {downloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Download PDF
            </Button>
            <Button variant="outline" size="sm" onClick={fetchReport} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Refresh
            </Button>
          </div>
        </div>

        {report && (
          <div className="flex items-center gap-2 flex-wrap">
            {(["month", "quarter", "ytd"] as PeriodKey[]).map((k) => {
              const active = period === k;
              const label = k === "month" ? "Monthly" : k === "quarter" ? "Quarterly" : "YTD";
              return (
                <button
                  key={k}
                  onClick={() => setPeriod(k)}
                  className={`px-4 py-1.5 rounded-full text-xs font-mono uppercase tracking-wider border transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-transparent text-muted-foreground border-border hover:border-primary/50"
                  }`}
                >
                  {label}
                </button>
              );
            })}
            {!p.hasData && (
              <span className="text-xs text-muted-foreground italic ml-2">P&L for this period is syncing</span>
            )}
          </div>
        )}

        {error && !report && (
          <div className="p-4 border border-destructive/40 bg-destructive/10 rounded-md text-sm">{error}</div>
        )}

        {!report && loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {report && (
          <>
            {/* 1 — Executive Summary */}
            <SectionCard title="Executive Summary">
              <SubHeader>Profitability</SubHeader>
              <Row label="Income" value={p.totalIncome} />
              <Row label="Direct Costs (COGS)" value={p.totalCogs} />
              <Row label="Gross Profit" value={p.grossProfit} bold />
              <Row label="Operating Expenses" value={p.totalOpex} />
              <Row label="Net Profit" value={p.netProfit} emphasis="net" positiveGreen />

              <SubHeader>Performance</SubHeader>
              <div className="flex items-baseline justify-between py-1.5">
                <span className="text-sm">Gross Profit Margin</span>
                <span className="font-mono text-sm tabular-nums">{isFinite(p.gpPercent) ? `${p.gpPercent.toFixed(1)}%` : "–"}</span>
              </div>
              <div className="flex items-baseline justify-between py-1.5">
                <span className="text-sm">Net Profit Margin</span>
                <span className="font-mono text-sm tabular-nums">{isFinite(p.netPercent) ? `${p.netPercent.toFixed(1)}%` : "–"}</span>
              </div>

              <SubHeader>Position</SubHeader>
              <Row label="Debtors" value={report.agedReceivables.buckets.total} />
              <Row label="Net Assets" value={report.balanceSheet.totals.netAssets} bold positiveGreen />
            </SectionCard>

            {/* 2 — P&L */}
            <SectionCard title={`Profit and Loss — ${periodLabel}`}>
              <SubHeader>Trading Income</SubHeader>
              {p.income.map((i) => <Row key={i.label} label={i.label} value={i.value} indent />)}
              <Row label="Total Trading Income" value={p.totalIncome} bold emphasis="sub" />

              <SubHeader>Cost of Sales</SubHeader>
              {p.cogs.map((i) => <Row key={i.label} label={i.label} value={i.value} indent />)}
              <Row label="Total Cost of Sales" value={p.totalCogs} bold emphasis="sub" />

              <Row label="Gross Profit" value={p.grossProfit} bold emphasis="sub" />
              <div className="flex items-baseline justify-between py-1.5">
                <span className="text-sm">Gross Profit %</span>
                <span className="font-mono text-sm tabular-nums">{isFinite(p.gpPercent) ? `${p.gpPercent.toFixed(1)}%` : "–"}</span>
              </div>

              <SubHeader>Operating Expenses</SubHeader>
              {p.opex.map((i) => <Row key={i.label} label={i.label} value={i.value} indent />)}
              <Row label="Total Operating Expenses" value={p.totalOpex} bold emphasis="sub" />

              <Row label="Net Profit" value={p.netProfit} emphasis="net" positiveGreen />
              <div className="flex items-baseline justify-between py-1.5">
                <span className="text-sm">Net Profit %</span>
                <span className="font-mono text-sm tabular-nums">{isFinite(p.netPercent) ? `${p.netPercent.toFixed(1)}%` : "–"}</span>
              </div>
            </SectionCard>

            {/* 3 — Balance Sheet */}
            <SectionCard
              title="Balance Sheet"
              right={!report.balanceSheet.ties && (
                <span className="text-xs px-2 py-0.5 rounded bg-amber-500/15 text-amber-500 border border-amber-500/30">
                  does not reconcile
                </span>
              )}
            >
              <SubHeader>Assets</SubHeader>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mt-2 mb-1">Bank</div>
              {report.balanceSheet.groups.bank.map((i) => <Row key={i.label} label={i.label} value={i.value} indent />)}
              <Row label="Total Bank" value={report.balanceSheet.totals.bank} bold emphasis="sub" />

              <div className="text-xs uppercase tracking-wider text-muted-foreground mt-4 mb-1">Current Assets</div>
              {report.balanceSheet.groups.accountsReceivable.map((i) => <Row key={i.label} label={i.label} value={i.value} indent />)}
              <Row label="Stock on Hand & Prepayments" value={sum(report.balanceSheet.groups.stockPrepay)} indent />
              <Row label="Loans to Directors" value={sum(report.balanceSheet.groups.loansDirectors)} indent />
              <Row label="Total Current Assets" value={report.balanceSheet.totals.currentAssets} bold emphasis="sub" />

              <div className="text-xs uppercase tracking-wider text-muted-foreground mt-4 mb-1">Fixed Assets</div>
              {report.balanceSheet.groups.fixed.map((i) => <Row key={i.label} label={i.label} value={i.value} indent />)}
              <Row label="Total Fixed Assets" value={report.balanceSheet.totals.fixedAssets} bold emphasis="sub" />

              <div className="text-xs uppercase tracking-wider text-muted-foreground mt-4 mb-1">Non-current Assets</div>
              {report.balanceSheet.groups.nonCurrentAssets.map((i) => <Row key={i.label} label={i.label} value={i.value} indent />)}
              <Row label="Total Non-current Assets" value={report.balanceSheet.totals.nonCurrentAssets} bold emphasis="sub" />

              <Row label="Total Assets" value={report.balanceSheet.totals.totalAssets} bold emphasis="net" />

              <SubHeader>Liabilities</SubHeader>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mt-2 mb-1">Current Liabilities</div>
              {report.balanceSheet.groups.currentLiab.map((i) => <Row key={i.label} label={i.label} value={i.value} indent />)}
              <Row label="Total Current Liabilities" value={report.balanceSheet.totals.currentLiabilities} bold emphasis="sub" />

              <div className="text-xs uppercase tracking-wider text-muted-foreground mt-4 mb-1">Non-current Liabilities</div>
              <div className="text-xs text-muted-foreground pl-2 mt-1">Financing</div>
              {report.balanceSheet.groups.financing.map((i) => <Row key={i.label} label={i.label} value={i.value} indent />)}
              <Row label="Total Financing" value={report.balanceSheet.totals.financing} indent />
              <div className="text-xs text-muted-foreground pl-2 mt-2">Hire Purchase</div>
              {report.balanceSheet.groups.hirePurchase.map((i) => <Row key={i.label} label={i.label} value={i.value} indent />)}
              <Row label="Total Hire Purchase" value={report.balanceSheet.totals.hirePurchase} indent />
              <Row label="Total Non-current Liabilities" value={report.balanceSheet.totals.nonCurrentLiabilities} bold emphasis="sub" />

              <Row label="Total Liabilities" value={report.balanceSheet.totals.totalLiabilities} bold emphasis="sub" />

              <Row label="Net Assets" value={report.balanceSheet.totals.netAssets} emphasis="net" positiveGreen />

              <SubHeader>Equity</SubHeader>
              {report.balanceSheet.groups.equity.map((i) => <Row key={i.label} label={i.label} value={i.value} indent />)}
              <Row label="Total Equity" value={report.balanceSheet.totals.totalEquity} bold emphasis="sub" />
            </SectionCard>

            {/* 4 — Aged Receivables */}
            <SectionCard title="Aged Receivables">
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="text-left py-2 px-2 font-normal">Contact</th>
                      <th className="text-right py-2 px-2 font-normal">Current</th>
                      <th className="text-right py-2 px-2 font-normal">&lt;1 Mo</th>
                      <th className="text-right py-2 px-2 font-normal">1 Mo</th>
                      <th className="text-right py-2 px-2 font-normal">2 Mo</th>
                      <th className="text-right py-2 px-2 font-normal">3 Mo</th>
                      <th className="text-right py-2 px-2 font-normal">Older</th>
                      <th className="text-right py-2 px-2 font-normal">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.agedReceivables.byContact.map((r) => (
                      <tr key={r.name} className="border-b border-border/40">
                        <td className="py-1.5 px-2">{r.name}</td>
                        <td className="py-1.5 px-2 text-right font-mono tabular-nums">{fmt(r.current)}</td>
                        <td className="py-1.5 px-2 text-right font-mono tabular-nums">{fmt(r.lt1)}</td>
                        <td className="py-1.5 px-2 text-right font-mono tabular-nums">{fmt(r.m1)}</td>
                        <td className="py-1.5 px-2 text-right font-mono tabular-nums">{fmt(r.m2)}</td>
                        <td className="py-1.5 px-2 text-right font-mono tabular-nums">{fmt(r.m3)}</td>
                        <td className="py-1.5 px-2 text-right font-mono tabular-nums">{fmt(r.older)}</td>
                        <td className="py-1.5 px-2 text-right font-mono tabular-nums">{fmt(r.total)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-border font-semibold">
                      <td className="py-2 px-2">Total</td>
                      <td className="py-2 px-2 text-right font-mono tabular-nums">{fmt(report.agedReceivables.buckets.current)}</td>
                      <td className="py-2 px-2 text-right font-mono tabular-nums">{fmt(report.agedReceivables.buckets.lt1)}</td>
                      <td className="py-2 px-2 text-right font-mono tabular-nums">{fmt(report.agedReceivables.buckets.m1)}</td>
                      <td className="py-2 px-2 text-right font-mono tabular-nums">{fmt(report.agedReceivables.buckets.m2)}</td>
                      <td className="py-2 px-2 text-right font-mono tabular-nums">{fmt(report.agedReceivables.buckets.m3)}</td>
                      <td className="py-2 px-2 text-right font-mono tabular-nums">{fmt(report.agedReceivables.buckets.older)}</td>
                      <td className="py-2 px-2 text-right font-mono tabular-nums">{fmt(report.agedReceivables.buckets.total)}</td>
                    </tr>
                    <tr className="text-xs text-muted-foreground">
                      <td className="py-1.5 px-2">% of total</td>
                      {(["current", "lt1", "m1", "m2", "m3", "older"] as const).map((k) => (
                        <td key={k} className="py-1.5 px-2 text-right font-mono tabular-nums">
                          {fmtPct((report.agedReceivables.buckets[k] || 0) / (report.agedReceivables.buckets.total || 1))}
                        </td>
                      ))}
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">100.0%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
