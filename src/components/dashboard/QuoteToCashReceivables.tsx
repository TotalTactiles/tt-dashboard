import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import { AlertTriangle, ArrowUpDown, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const WEBHOOK_URL = "https://n8n.srv1437130.hstgr.cloud/webhook/tt-receivables";
const CACHE_KEY = "dashboard_receivables_data";
const REFRESH_MS = 5 * 60 * 1000;

type Grade = "green" | "amber" | "red" | "none";
type Category = "overdue" | "current" | "retention";

interface Payer {
  company: string;
  paidCount: number;
  avgDaysToPay: number | null;
  onTimePct: number | null;
  totalPaid: number;
  outstanding: number;
  grade: Grade;
}

interface InvoiceRow {
  invoiceNumber: string;
  company: string;
  reference: string;
  amountDue: number;
  amountPaid?: number;
  total?: number;
  pctOutstanding?: number;
  category?: Category;
  invoiceDate: string;
  dueByTerm: string;
  daysOverdue: number;
  bucket: string;
}

interface MonthlyTrend {
  month: string;
  invoicesPaid: number;
  onTimePct: number;
  avgDaysToPay: number;
}

interface ReceivablesData {
  asAtDate: string;
  termDays: number;
  financeRatePct: number;
  summary: {
    sentCount: number;
    paidCount: number;
    openCount: number;
    totalOutstanding: number;
    totalOverdue: number;
    totalUnpaid?: number;
    unpaidOverdue?: number;
    unpaidCurrent?: number;
    retentionHeld?: number;
    retentionCount?: number;
    dso: number;
    dsoMedian: number;
    onTimePct: number;
    costOfDelayMonthly: number;
  };
  aging: {
    notYetDue: number;
    d1_30: number;
    d31_60: number;
    d61_90: number;
    d90plus: number;
  };
  payers: Payer[];
  openInvoices: InvoiceRow[];
  chaseList?: InvoiceRow[];
  retentionList?: InvoiceRow[];
  monthlyTrend: MonthlyTrend[];
}

const fmtMoney = (n: number | null | undefined) => {
  if (n === null || n === undefined || isNaN(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  return `${sign}$${Math.round(abs).toLocaleString("en-AU")}`;
};

const fmtDate = (s: string) => {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "2-digit" });
};

const gradeMeta: Record<Grade, { label: string; classes: string }> = {
  green: { label: "On time", classes: "border-chart-green/40 bg-chart-green/15 text-chart-green" },
  amber: { label: "Slow", classes: "border-chart-orange/40 bg-chart-orange/15 text-chart-orange" },
  red: { label: "Late", classes: "border-destructive/40 bg-destructive/15 text-destructive" },
  none: { label: "No history yet", classes: "border-muted-foreground/30 bg-muted/40 text-muted-foreground" },
};

const bucketColors: Record<string, string> = {
  notYetDue: "hsl(var(--chart-green))",
  d1_30: "hsl(75 75% 50%)",
  d31_60: "hsl(var(--chart-orange))",
  d61_90: "hsl(18 90% 55%)",
  d90plus: "hsl(var(--destructive))",
};

type PayerSortKey = "avgDaysToPay" | "outstanding" | "totalPaid";

const QuoteToCashReceivables = () => {
  const [data, setData] = useState<ReceivablesData | null>(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      return cached ? (JSON.parse(cached) as ReceivablesData) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(!data);
  const [error, setError] = useState<string | null>(null);
  const [payerSort, setPayerSort] = useState<PayerSortKey>("avgDaysToPay");
  const [showAllPayers, setShowAllPayers] = useState(false);
  const [retentionOpen, setRetentionOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading((prev) => (data ? false : true));
    try {
      const { data: responseData, error: fnError } = await supabase.functions.invoke("n8n-proxy", {
        body: { webhookUrl: WEBHOOK_URL, source: "xero_receivables", payload: {} },
      });
      if (fnError) throw new Error(fnError.message || "Proxy request failed");
      if (responseData?._proxyError) throw new Error(responseData.error || "Proxy error");

      let unwrapped: any = responseData;
      if (Array.isArray(unwrapped)) unwrapped = unwrapped[0];
      if (unwrapped?.json && typeof unwrapped.json === "object") unwrapped = unwrapped.json;

      if (!unwrapped?.summary || !unwrapped?.aging) {
        throw new Error("Invalid response shape");
      }
      const parsed = unwrapped as ReceivablesData;
      setData(parsed);
      setError(null);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(parsed));
      } catch {}
    } catch (err: any) {
      setError(err?.message || "Fetch failed");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchData]);

  const sortedPayers = useMemo(() => {
    if (!data?.payers) return [];
    const withHistory = data.payers.filter((p) => p.grade !== "none");
    const noHistory = data.payers.filter((p) => p.grade === "none");

    const sortFn = (a: Payer, b: Payer) => {
      if (payerSort === "avgDaysToPay") {
        const av = a.avgDaysToPay ?? -Infinity;
        const bv = b.avgDaysToPay ?? -Infinity;
        return bv - av;
      }
      if (payerSort === "outstanding") return b.outstanding - a.outstanding;
      return b.totalPaid - a.totalPaid;
    };

    if (payerSort === "outstanding" || payerSort === "totalPaid") {
      return [...data.payers].sort(sortFn);
    }
    return [...withHistory.sort(sortFn), ...noHistory.sort((a, b) => b.outstanding - a.outstanding)];
  }, [data, payerSort]);

  const visiblePayers = showAllPayers ? sortedPayers : sortedPayers.slice(0, 10);

  const agingSegments = useMemo(() => {
    if (!data) return [];
    const a = data.aging;
    const total = a.notYetDue + a.d1_30 + a.d31_60 + a.d61_90 + a.d90plus;
    const segs = [
      { key: "notYetDue", label: "Not yet due", value: a.notYetDue },
      { key: "d1_30", label: "1–30", value: a.d1_30 },
      { key: "d31_60", label: "31–60", value: a.d31_60 },
      { key: "d61_90", label: "61–90", value: a.d61_90 },
      { key: "d90plus", label: "90+", value: a.d90plus },
    ];
    return segs.map((s) => ({
      ...s,
      pct: total > 0 ? (s.value / total) * 100 : 0,
      color: bucketColors[s.key],
    }));
  }, [data]);

  const renderHeader = () => (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        <h2 className="text-fluid-base font-semibold break-words">Quote-to-Cash · Receivables</h2>
        <p className="text-fluid-xs text-muted-foreground mt-1 font-mono">
          {data ? `as at ${fmtDate(data.asAtDate)} · net-${data.termDays} terms` : "Loading Xero receivables…"}
        </p>
        {error && (
          <p className="text-[11px] text-chart-orange mt-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Couldn't reach the Xero receivables feed. Showing last synced figures.
          </p>
        )}
      </div>
      <span className="text-[11px] px-2 py-1 rounded border border-chart-blue/40 bg-chart-blue/15 text-chart-blue font-mono">
        XERO
      </span>
    </div>
  );

  if (loading && !data) {
    return (
      <section className="chart-container p-5">
        {renderHeader()}
        <div className="mt-6 space-y-3 animate-pulse">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 bg-muted/40 rounded" />
            ))}
          </div>
          <div className="h-8 bg-muted/40 rounded" />
          <div className="h-40 bg-muted/40 rounded" />
        </div>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="chart-container p-5">
        {renderHeader()}
        <p className="text-fluid-xs text-muted-foreground mt-4">
          Couldn't reach the Xero receivables feed and no cached data available.
        </p>
      </section>
    );
  }

  const { summary, termDays, financeRatePct } = data;
  const totalAging = agingSegments.reduce((s, x) => s + x.value, 0);

  if (summary.sentCount === 0 && summary.openCount === 0) {
    return (
      <section className="chart-container p-5">
        {renderHeader()}
        <p className="text-fluid-xs text-muted-foreground mt-4">No sales invoices found in Xero yet.</p>
      </section>
    );
  }

  const chaseList = data.chaseList ?? data.openInvoices ?? [];
  const retentionList = data.retentionList ?? [];
  const unpaidOverdue = summary.unpaidOverdue ?? summary.totalOverdue;
  const unpaidCurrent = summary.unpaidCurrent ?? 0;
  const retentionHeld = summary.retentionHeld ?? 0;
  const retentionCount = summary.retentionCount ?? retentionList.length;
  const totalUnpaid = summary.totalUnpaid ?? chaseList.reduce((s, r) => s + (r.amountDue || 0), 0);

  const SortHeader = ({ label, k }: { label: string; k: PayerSortKey }) => (
    <button
      type="button"
      onClick={() => setPayerSort(k)}
      className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${
        payerSort === k ? "text-foreground" : ""
      }`}
    >
      {label} <ArrowUpDown className="w-3 h-3 opacity-60" />
    </button>
  );

  return (
    <section className="chart-container p-5">
      {renderHeader()}

      {/* 1. Summary stat row */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 gap-3">
        <StatCard
          label="Outstanding"
          value={fmtMoney(summary.totalOutstanding)}
          sub={`${summary.openCount} open invoices`}
        />
        <StatCard
          label="Overdue"
          value={fmtMoney(unpaidOverdue)}
          sub="genuinely unpaid · past terms"
          valueClass="text-destructive"
        />
        <StatCard
          label="Retention held"
          value={fmtMoney(retentionHeld)}
          sub={`${retentionCount} part-paid jobs · not overdue`}
          valueClass="text-chart-blue"
        />
        <StatCard
          label="Awaiting (in terms)"
          value={fmtMoney(unpaidCurrent)}
          sub="unpaid, within 30 days"
        />
        <StatCard label="DSO" value={`${summary.dso}d`} sub={`median ${summary.dsoMedian}d`} />
        <StatCard
          label="On-time rate"
          value={`${summary.onTimePct}%`}
          sub={`paid within ${termDays} days`}
          valueClass="text-chart-green"
        />
        <StatCard
          label="Cost of delay"
          value={`${fmtMoney(summary.costOfDelayMonthly)}/mo`}
          sub={`overdue financed @ ${financeRatePct}%`}
          valueClass="text-destructive"
        />
      </div>

      {/* 2. Aging bar */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <h3 className="text-fluid-sm font-semibold">All outstanding by age</h3>
          <span className="text-[11px] text-muted-foreground font-mono">Total {fmtMoney(totalAging)}</span>
        </div>
        <div className="flex w-full h-6 rounded overflow-hidden border border-border">
          {agingSegments.map((s) => (
            <div
              key={s.key}
              title={`${s.label}: ${fmtMoney(s.value)} (${s.pct.toFixed(1)}%)`}
              style={{ width: `${Math.max(s.pct, s.value > 0 ? 2 : 0)}%`, background: s.color }}
            />
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Older balances are mostly retention — see the section below.
        </p>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-[11px] font-mono">
          {agingSegments.map((s) => (
            <div key={s.key} className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-sm flex-none" style={{ background: s.color }} />
              <span className="text-muted-foreground truncate">{s.label}</span>
              <span className="ml-auto whitespace-nowrap">
                {fmtMoney(s.value)} · {s.pct.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Payer scorecard */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <h3 className="text-fluid-sm font-semibold">Payer scorecard</h3>
          {sortedPayers.length > 10 && (
            <button
              type="button"
              onClick={() => setShowAllPayers((v) => !v)}
              className="text-[11px] px-2 py-1 rounded border border-border hover:bg-muted/40"
            >
              {showAllPayers ? "Show top 10" : `Show all (${sortedPayers.length})`}
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead className="text-muted-foreground border-b border-border">
              <tr className="[&>th]:py-2 [&>th]:px-2 text-left">
                <th>Company</th>
                <th className="text-right">Invoices</th>
                <th className="text-right"><SortHeader label="Avg days" k="avgDaysToPay" /></th>
                <th className="text-right">On-time %</th>
                <th className="text-right"><SortHeader label="Total paid" k="totalPaid" /></th>
                <th className="text-right"><SortHeader label="Outstanding" k="outstanding" /></th>
                <th>Grade</th>
              </tr>
            </thead>
            <tbody>
              {visiblePayers.map((p) => (
                <tr key={p.company} className="border-b border-border/50 [&>td]:py-2 [&>td]:px-2">
                  <td className="max-w-[220px] truncate" title={p.company}>{p.company}</td>
                  <td className="text-right">{p.paidCount}</td>
                  <td className="text-right">{p.avgDaysToPay == null ? "—" : `${p.avgDaysToPay}d`}</td>
                  <td className="text-right">{p.onTimePct == null ? "—" : `${p.onTimePct}%`}</td>
                  <td className="text-right text-chart-green">{fmtMoney(p.totalPaid)}</td>
                  <td className={`text-right ${p.outstanding > 0 ? "" : "text-muted-foreground"}`}>
                    {fmtMoney(p.outstanding)}
                  </td>
                  <td>
                    <span className={`inline-block text-[10px] px-2 py-0.5 rounded border ${gradeMeta[p.grade].classes}`}>
                      {gradeMeta[p.grade].label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Chase list — genuinely unpaid */}
      <div className="mt-6">
        <div className="flex items-baseline justify-between flex-wrap gap-2 mb-2">
          <h3 className="text-fluid-sm font-semibold">Chase list — genuinely unpaid</h3>
          <span className="text-[11px] text-muted-foreground font-mono">
            {chaseList.length} invoices · {fmtMoney(totalUnpaid)}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead className="text-muted-foreground border-b border-border">
              <tr className="[&>th]:py-2 [&>th]:px-2 text-left">
                <th>Invoice</th>
                <th>Company</th>
                <th>Reference</th>
                <th className="text-right">Amount</th>
                <th>Invoiced</th>
                <th>Due</th>
                <th className="text-right">Days overdue</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {chaseList.map((inv) => {
                const isOverdue = inv.category === "overdue" || (inv.category == null && inv.daysOverdue > 0);
                return (
                  <tr
                    key={inv.invoiceNumber}
                    className={`border-b border-border/50 [&>td]:py-2 [&>td]:px-2 ${
                      isOverdue ? "border-l-2 border-l-destructive/60" : ""
                    }`}
                  >
                    <td>{inv.invoiceNumber}</td>
                    <td className="max-w-[200px] truncate" title={inv.company}>{inv.company}</td>
                    <td className="max-w-[180px] truncate text-muted-foreground" title={inv.reference}>
                      {inv.reference || "—"}
                    </td>
                    <td className="text-right">{fmtMoney(inv.amountDue)}</td>
                    <td>{fmtDate(inv.invoiceDate)}</td>
                    <td>{fmtDate(inv.dueByTerm)}</td>
                    <td className={`text-right ${inv.daysOverdue > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      {inv.daysOverdue}
                    </td>
                    <td>
                      <span
                        className={`inline-block text-[10px] px-2 py-0.5 rounded border ${
                          isOverdue
                            ? "border-destructive/40 bg-destructive/15 text-destructive"
                            : "border-muted-foreground/30 bg-muted/40 text-muted-foreground"
                        }`}
                      >
                        {isOverdue ? "overdue" : "in terms"}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {chaseList.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-4 text-center text-muted-foreground">
                    No unpaid invoices — all clear.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Retention & part-paid residuals */}
      {retentionList.length > 0 && (
        <div className="mt-6 rounded border border-border/60">
          <button
            type="button"
            onClick={() => setRetentionOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/30"
          >
            <div className="flex items-center gap-2 min-w-0">
              {retentionOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <h3 className="text-fluid-sm font-semibold">Retention & part-paid residuals</h3>
            </div>
            <span className="text-[11px] text-muted-foreground font-mono whitespace-nowrap">
              {retentionCount} jobs · {fmtMoney(retentionHeld)} held · not overdue
            </span>
          </button>
          {retentionOpen && (
            <div className="px-3 pb-3">
              <p className="text-[11px] text-muted-foreground mb-3">
                These progress claims are already ~90% paid — the balance is retention held by the builder, not a
                missing payment.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead className="text-muted-foreground border-b border-border">
                    <tr className="[&>th]:py-2 [&>th]:px-2 text-left">
                      <th>Invoice</th>
                      <th>Company</th>
                      <th>Reference</th>
                      <th className="text-right">Total</th>
                      <th className="text-right">Paid</th>
                      <th className="text-right">Still held</th>
                      <th className="text-right">% held</th>
                      <th>Invoiced</th>
                    </tr>
                  </thead>
                  <tbody>
                    {retentionList.map((inv) => (
                      <tr
                        key={inv.invoiceNumber}
                        className="border-b border-border/50 [&>td]:py-2 [&>td]:px-2 text-muted-foreground"
                      >
                        <td className="text-foreground/80">{inv.invoiceNumber}</td>
                        <td className="max-w-[200px] truncate text-foreground/80" title={inv.company}>{inv.company}</td>
                        <td className="max-w-[180px] truncate" title={inv.reference}>{inv.reference || "—"}</td>
                        <td className="text-right text-foreground/80">{fmtMoney(inv.total)}</td>
                        <td className="text-right text-chart-green">{fmtMoney(inv.amountPaid)}</td>
                        <td className="text-right text-foreground/80">{fmtMoney(inv.amountDue)}</td>
                        <td className="text-right">
                          {inv.pctOutstanding == null ? "—" : `${Math.round(inv.pctOutstanding)}%`}
                        </td>
                        <td>{fmtDate(inv.invoiceDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. Collection trend */}
      {data.monthlyTrend?.length > 0 && (
        <div className="mt-6">
          <h3 className="text-fluid-sm font-semibold mb-2">Days to pay — monthly trend</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.monthlyTrend} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    fontSize: 12,
                  }}
                />
                <ReferenceLine yAxisId="right" y={termDays} stroke="hsl(var(--chart-orange))" strokeDasharray="3 3" />
                <Bar yAxisId="left" dataKey="invoicesPaid" fill="hsl(var(--chart-blue))" name="Invoices paid" />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="avgDaysToPay"
                  stroke="hsl(var(--chart-green))"
                  strokeWidth={2}
                  name="Avg days to pay"
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
};

const StatCard = ({
  label,
  value,
  sub,
  valueClass = "",
}: {
  label: string;
  value: string;
  sub: string;
  valueClass?: string;
}) => (
  <div className="stat-card p-3">
    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className={`text-fluid-lg font-mono font-semibold mt-1 ${valueClass}`}>{value}</div>
    <div className="text-[11px] text-muted-foreground font-mono mt-1">{sub}</div>
  </div>
);

export default QuoteToCashReceivables;
