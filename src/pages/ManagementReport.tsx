import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";

const CACHE_URL = "https://n8n.srv1437130.hstgr.cloud/webhook/dashboard-cache";
const CACHE_KEY = "xero_mgmt_report";


type LineItem = { label: string; value: number };

interface ManagementReport {
  entity: string;
  asAt: string;
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
    reported: { netAssets: number; totalEquity: number };
    ties: boolean;
  };
  agedReceivables: {
    buckets: { current: number; lt1: number; m1: number; m2: number; m3: number; older: number; total: number };
    byContact: Array<{ name: string; current: number; lt1: number; m1: number; m2: number; m3: number; older: number; total: number }>;
  };
  pnl: { revenue: number; grossProfit: number; totalExpenses: number; netProfit: number; accountsReceivable: number };
}

const AUD = new Intl.NumberFormat("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (n: number | null | undefined) => {
  if (n === null || n === undefined || isNaN(n as number)) return "–";
  if (n === 0) return "–";
  return n < 0 ? `(${AUD.format(Math.abs(n))})` : AUD.format(n);
};
const fmtPct = (n: number) => (isNaN(n) ? "–" : `${(n * 100).toFixed(1)}%`);

const sum = (items: LineItem[]) => (items || []).reduce((a, b) => a + (Number(b.value) || 0), 0);

function Row({ label, value, bold, indent, emphasis }: { label: string; value: number; bold?: boolean; indent?: boolean; emphasis?: "net" | "sub" }) {
  const isNet = emphasis === "net";
  const positive = value >= 0;
  const color = isNet ? (positive ? "text-[hsl(var(--chart-green))]" : "text-[hsl(var(--chart-red))]") : "text-foreground";
  return (
    <div className={`flex items-baseline justify-between py-1.5 ${emphasis === "sub" ? "border-t border-border/60 mt-1 pt-2" : ""} ${isNet ? "border-t-2 border-border mt-2 pt-3" : ""}`}>
      <span className={`${bold || isNet ? "font-semibold" : ""} ${indent ? "pl-4" : ""} text-sm`}>{label}</span>
      <span className={`font-mono text-sm tabular-nums ${bold || isNet ? "font-semibold" : ""} ${color}`}>{fmt(value)}</span>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-md p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-primary mb-4">{title}</h2>
      {children}
    </div>
  );
}

function SubHeader({ children }: { children: React.ReactNode }) {
  return <div className="text-xs uppercase tracking-wider text-muted-foreground font-mono mt-4 mb-1">{children}</div>;
}

export default function ManagementReportPage() {
  const [report, setReport] = useState<ManagementReport | null>(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? (JSON.parse(raw) as ManagementReport) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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


  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6 py-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Management Report</h1>
            <p className="text-sm text-muted-foreground font-mono mt-1">
              {report ? `${report.entity} · As at ${new Date(report.asAt).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}` : "Loading live Xero data…"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchReport} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Refresh
          </Button>
        </div>

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
            {/* Balance Sheet */}
            <SectionCard title="Balance Sheet">
              {!report.balanceSheet.ties && (
                <span className="inline-block text-xs px-2 py-0.5 rounded bg-amber-500/15 text-amber-500 border border-amber-500/30 mb-3">
                  does not reconcile
                </span>
              )}

              <SubHeader>Assets</SubHeader>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mt-2 mb-1">Bank</div>
              {report.balanceSheet.groups.bank.map((i) => (
                <Row key={i.label} label={i.label} value={i.value} indent />
              ))}
              <Row label="Total Bank" value={report.balanceSheet.totals.bank} bold emphasis="sub" />

              <div className="text-xs uppercase tracking-wider text-muted-foreground mt-4 mb-1">Current Assets</div>
              {report.balanceSheet.groups.accountsReceivable.map((i) => (
                <Row key={i.label} label={i.label} value={i.value} indent />
              ))}
              <Row label="Stock on Hand & Prepayments" value={sum(report.balanceSheet.groups.stockPrepay)} indent />
              <Row label="Loans to Directors" value={sum(report.balanceSheet.groups.loansDirectors)} indent />
              <Row label="Total Current Assets" value={report.balanceSheet.totals.currentAssets} bold emphasis="sub" />

              <div className="text-xs uppercase tracking-wider text-muted-foreground mt-4 mb-1">Fixed Assets</div>
              {report.balanceSheet.groups.fixed.map((i) => (
                <Row key={i.label} label={i.label} value={i.value} indent />
              ))}
              <Row label="Total Fixed Assets" value={report.balanceSheet.totals.fixedAssets} bold emphasis="sub" />

              <div className="text-xs uppercase tracking-wider text-muted-foreground mt-4 mb-1">Non-current Assets</div>
              {report.balanceSheet.groups.nonCurrentAssets.map((i) => (
                <Row key={i.label} label={i.label} value={i.value} indent />
              ))}
              <Row label="Total Non-current Assets" value={report.balanceSheet.totals.nonCurrentAssets} bold emphasis="sub" />

              <Row label="Total Assets" value={report.balanceSheet.totals.totalAssets} bold emphasis="net" />

              <SubHeader>Liabilities</SubHeader>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mt-2 mb-1">Current Liabilities</div>
              {report.balanceSheet.groups.currentLiab.map((i) => (
                <Row key={i.label} label={i.label} value={i.value} indent />
              ))}
              <Row label="Total Current Liabilities" value={report.balanceSheet.totals.currentLiabilities} bold emphasis="sub" />

              <div className="text-xs uppercase tracking-wider text-muted-foreground mt-4 mb-1">Non-current Liabilities</div>
              <div className="text-xs text-muted-foreground pl-2 mt-1">Financing</div>
              {report.balanceSheet.groups.financing.map((i) => (
                <Row key={i.label} label={i.label} value={i.value} indent />
              ))}
              <Row label="Total Financing" value={report.balanceSheet.totals.financing} indent />
              <div className="text-xs text-muted-foreground pl-2 mt-2">Hire Purchase</div>
              {report.balanceSheet.groups.hirePurchase.map((i) => (
                <Row key={i.label} label={i.label} value={i.value} indent />
              ))}
              <Row label="Total Hire Purchase" value={report.balanceSheet.totals.hirePurchase} indent />
              <Row label="Total Non-current Liabilities" value={report.balanceSheet.totals.nonCurrentLiabilities} bold emphasis="sub" />

              <Row label="Total Liabilities" value={report.balanceSheet.totals.totalLiabilities} bold emphasis="sub" />

              <Row label="Net Assets" value={report.balanceSheet.totals.netAssets} emphasis="net" />

              <SubHeader>Equity</SubHeader>
              {report.balanceSheet.groups.equity.map((i) => (
                <Row key={i.label} label={i.label} value={i.value} indent />
              ))}
              <Row label="Total Equity" value={report.balanceSheet.totals.totalEquity} bold emphasis="sub" />
            </SectionCard>

            {/* Aged Receivables */}
            <SectionCard title="Aged Receivables">
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="text-left py-2 px-2 font-normal">Contact</th>
                      <th className="text-right py-2 px-2 font-normal">Current</th>
                      <th className="text-right py-2 px-2 font-normal">&lt;1 Month</th>
                      <th className="text-right py-2 px-2 font-normal">1 Month</th>
                      <th className="text-right py-2 px-2 font-normal">2 Months</th>
                      <th className="text-right py-2 px-2 font-normal">3 Months</th>
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

            {/* P&L */}
            <SectionCard title="Profit & Loss">
              <Row label="Revenue" value={report.pnl.revenue} />
              <Row label="Gross Profit" value={report.pnl.grossProfit} />
              <Row label="Total Expenses" value={report.pnl.totalExpenses} />
              <Row label="Net Profit" value={report.pnl.netProfit} emphasis="net" />
              <p className="text-xs text-muted-foreground font-mono mt-4">Current period — full monthly columns pending.</p>
            </SectionCard>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
