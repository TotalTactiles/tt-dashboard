import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Users, Clock, DollarSign, TrendingUp } from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const MOCK_UPWORK_DATA = {
  syncTimestamp: new Date().toISOString(),
  summary: {
    activeWorkers: 3,
    totalContractors: 4,
    totalHours: 284.5,
    totalCostUSD: 6430.0,
    totalCostAUD: 9966.5,
    avgRateUSD: 28.5,
    usdToAudRate: 1.55,
  },
  workers: [
    { workerId: "w1", name: "Asad Afzaal", role: "Site Installation Contractor", type: "Hourly", rateUSD: 32.0, status: "active", startDate: "2025-08-01", totalBilledUSD: 3840.0, totalBilledAUD: 5952.0, hoursWorked: 120.0 },
    { workerId: "w2", name: "Walmay", role: "Subcontractor – Linemarking", type: "Hourly", rateUSD: 28.0, status: "active", startDate: "2025-10-15", totalBilledUSD: 1960.0, totalBilledAUD: 3038.0, hoursWorked: 70.0 },
    { workerId: "w3", name: "Digital Contractor", role: "n8n / Automation Dev", type: "Hourly", rateUSD: 25.0, status: "active", startDate: "2026-01-10", totalBilledUSD: 630.0, totalBilledAUD: 976.5, hoursWorked: 25.2 },
    { workerId: "w4", name: "Website Designer", role: "Web & Branding", type: "Fixed", rateUSD: 0, status: "ended", startDate: "2026-02-01", totalBilledUSD: 2495.0, totalBilledAUD: 3867.25, hoursWorked: 0 },
  ],
  timesheets: [
    { date: "2026-05-20", workerName: "Asad Afzaal", hours: 8.0, payoutUSD: 256.0, payoutAUD: 396.8, month: "2026-05" },
    { date: "2026-05-19", workerName: "Asad Afzaal", hours: 7.5, payoutUSD: 240.0, payoutAUD: 372.0, month: "2026-05" },
    { date: "2026-05-18", workerName: "Walmay", hours: 6.0, payoutUSD: 168.0, payoutAUD: 260.4, month: "2026-05" },
    { date: "2026-05-17", workerName: "Asad Afzaal", hours: 8.0, payoutUSD: 256.0, payoutAUD: 396.8, month: "2026-05" },
    { date: "2026-05-16", workerName: "Digital Contractor", hours: 4.5, payoutUSD: 112.5, payoutAUD: 174.38, month: "2026-05" },
    { date: "2026-05-15", workerName: "Walmay", hours: 8.0, payoutUSD: 224.0, payoutAUD: 347.2, month: "2026-05" },
    { date: "2026-04-30", workerName: "Asad Afzaal", hours: 8.0, payoutUSD: 256.0, payoutAUD: 396.8, month: "2026-04" },
    { date: "2026-04-28", workerName: "Walmay", hours: 7.0, payoutUSD: 196.0, payoutAUD: 303.8, month: "2026-04" },
    { date: "2026-04-25", workerName: "Digital Contractor", hours: 5.0, payoutUSD: 125.0, payoutAUD: 193.75, month: "2026-04" },
    { date: "2026-04-20", workerName: "Asad Afzaal", hours: 8.0, payoutUSD: 256.0, payoutAUD: 396.8, month: "2026-04" },
    { date: "2026-03-31", workerName: "Asad Afzaal", hours: 8.0, payoutUSD: 256.0, payoutAUD: 396.8, month: "2026-03" },
    { date: "2026-03-28", workerName: "Digital Contractor", hours: 3.5, payoutUSD: 87.5, payoutAUD: 135.63, month: "2026-03" },
    { date: "2026-03-25", workerName: "Walmay", hours: 8.0, payoutUSD: 224.0, payoutAUD: 347.2, month: "2026-03" },
  ],
  monthlyData: [
    { month: "2026-03", totalHours: 19.5, totalCostUSD: 567.5, totalCostAUD: 879.63 },
    { month: "2026-04", totalHours: 28.0, totalCostUSD: 833.0, totalCostAUD: 1291.15 },
    { month: "2026-05", totalHours: 42.0, totalCostUSD: 1256.5, totalCostAUD: 1947.58 },
  ],
  workerSummary: [
    { name: "Asad Afzaal", totalHours: 47.5, totalCostUSD: 1520.0, totalCostAUD: 2356.0 },
    { name: "Walmay", totalHours: 29.0, totalCostUSD: 812.0, totalCostAUD: 1258.6 },
    { name: "Digital Contractor", totalHours: 13.0, totalCostUSD: 325.0, totalCostAUD: 503.75 },
  ],
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const fmtMonthShort = (ym: string) => {
  const [y, m] = ym.split("-");
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y.slice(2)}`;
};
const fmtMonthLong = (ym: string) => {
  const [y, m] = ym.split("-");
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`;
};
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
};
const fmtSync = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const fmtAUD = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;
const fmtMoney2 = (n: number) => `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const statusPill = (status: string) => {
  const base = "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider";
  if (status === "active") return <span className={`${base} bg-chart-green/15 text-chart-green`}>active</span>;
  if (status === "paused") return <span className={`${base} bg-chart-yellow/15 text-chart-yellow`}>paused</span>;
  return <span className={`${base} bg-muted text-muted-foreground`}>ended</span>;
};

interface KPIProps {
  label: string;
  value: string;
  sub: string;
  Icon: React.ComponentType<{ className?: string }>;
}
const KPI = ({ label, value, sub, Icon }: KPIProps) => (
  <Card className="p-4">
    <div className="flex items-start justify-between mb-2">
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</p>
      <Icon className="h-4 w-4 text-chart-green" />
    </div>
    <p className="text-fluid-xl font-semibold tabular-nums">{value}</p>
    <p className="text-[11px] text-muted-foreground font-mono mt-1">{sub}</p>
  </Card>
);

const EmployeeTracking = () => {
  const data = MOCK_UPWORK_DATA;
  const hasData = data && data.workers && data.workers.length > 0;

  const [workerFilter, setWorkerFilter] = useState<string>("All Workers");
  const [monthFilter, setMonthFilter] = useState<string>("all");

  const uniqueWorkers = useMemo(
    () => Array.from(new Set((data?.timesheets ?? []).map((t) => t.workerName))),
    [data],
  );
  const uniqueMonths = useMemo(
    () => Array.from(new Set((data?.timesheets ?? []).map((t) => t.month))).sort(),
    [data],
  );

  const filteredTimesheets = useMemo(() => {
    if (!data) return [];
    return data.timesheets
      .filter((t) => (workerFilter === "All Workers" ? true : t.workerName === workerFilter))
      .filter((t) => (monthFilter === "all" ? true : t.month === monthFilter))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [data, workerFilter, monthFilter]);

  const filteredTotals = useMemo(
    () =>
      filteredTimesheets.reduce(
        (acc, t) => ({
          hours: acc.hours + t.hours,
          usd: acc.usd + t.payoutUSD,
          aud: acc.aud + t.payoutAUD,
        }),
        { hours: 0, usd: 0, aud: 0 },
      ),
    [filteredTimesheets],
  );

  const sortedWorkers = useMemo(
    () => [...(data?.workers ?? [])].sort((a, b) => b.totalBilledAUD - a.totalBilledAUD),
    [data],
  );

  const chartData = useMemo(
    () => (data?.monthlyData ?? []).map((m) => ({ ...m, label: fmtMonthShort(m.month) })),
    [data],
  );

  if (!hasData) {
    return (
      <DashboardLayout>
        <div className="mb-4 md:mb-6">
          <h1 className="text-fluid-2xl font-semibold">Employee Tracking</h1>
        </div>
        <Card className="p-12 flex flex-col items-center justify-center text-center">
          <Users className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-mono text-muted-foreground mb-1">No Upwork data yet</p>
          <p className="text-xs text-muted-foreground max-w-md">
            The sync runs every 6 hours. Check that the TT Upwork Data Sync workflow is active in n8n.
          </p>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Row 1 — header */}
      <div className="mb-4 md:mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-fluid-2xl font-semibold">Employee Tracking</h1>
          <p className="text-fluid-xs text-muted-foreground font-mono">Upwork contractors, hours & spend</p>
        </div>
        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-mono bg-muted text-muted-foreground">
          Upwork · Last synced: {fmtSync(data.syncTimestamp)}
        </span>
      </div>

      {/* Row 2 — KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
        <KPI
          label="Active Contractors"
          value={String(data.summary.activeWorkers)}
          sub={`${data.summary.totalContractors} total (incl. ended)`}
          Icon={Users}
        />
        <KPI
          label="Total Hours Logged"
          value={`${data.summary.totalHours.toFixed(1)} hrs`}
          sub="All time across all workers"
          Icon={Clock}
        />
        <KPI
          label="Total Spend (AUD)"
          value={fmtAUD(data.summary.totalCostAUD)}
          sub={`USD $${data.summary.totalCostUSD.toLocaleString()} · Rate: 1 USD = ${data.summary.usdToAudRate ?? 1.55} AUD`}
          Icon={DollarSign}
        />
        <KPI
          label="Avg Hourly Rate"
          value={`$${data.summary.avgRateUSD.toFixed(2)}/hr USD`}
          sub="Active contractors only"
          Icon={TrendingUp}
        />
      </div>

      {/* Row 3 — chart + workers */}
      <div className="grid grid-cols-1 lg:grid-cols-[58fr_42fr] gap-3 md:gap-4 mb-4 md:mb-6">
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Monthly Hours & Spend</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.6} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis
                  yAxisId="hours"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  label={{ value: "Hours", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "hsl(var(--muted-foreground))" } }}
                />
                <YAxis
                  yAxisId="cost"
                  orientation="right"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
                />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                  formatter={(value: number, name: string, item: { payload: { totalCostUSD: number } }) => {
                    if (name === "Hours") return [`${value.toFixed(1)} hrs`, "Hours"];
                    if (name === "Cost (AUD)") return [`${fmtAUD(value)} (USD $${item.payload.totalCostUSD.toLocaleString()})`, "Cost"];
                    return [value, name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="hours" dataKey="totalHours" name="Hours" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Line yAxisId="cost" type="monotone" dataKey="totalCostAUD" name="Cost (AUD)" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Contractors</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] font-mono uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 pr-2">Name</th>
                  <th className="py-2 pr-2">Role</th>
                  <th className="py-2 pr-2">Type</th>
                  <th className="py-2 pr-2 text-right">Rate</th>
                  <th className="py-2 pr-2 text-right">Hours</th>
                  <th className="py-2 pr-2 text-right">Billed AUD</th>
                  <th className="py-2 pr-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedWorkers.map((w) => (
                  <tr key={w.workerId} className="border-b border-border/50">
                    <td className="py-2 pr-2 font-medium">{w.name}</td>
                    <td className="py-2 pr-2 text-muted-foreground">{w.role}</td>
                    <td className="py-2 pr-2 text-muted-foreground">{w.type}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">
                      {w.type === "Fixed" ? "Fixed" : `$${w.rateUSD.toFixed(2)}/hr`}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">{w.hoursWorked.toFixed(1)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{fmtAUD(w.totalBilledAUD)}</td>
                    <td className="py-2 pr-2">{statusPill(w.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Row 4 — Timesheet log */}
      <Card className="p-4 mb-3">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <h2 className="text-sm font-semibold">Timesheet Log</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 flex-wrap">
              {["All Workers", ...uniqueWorkers].map((w) => (
                <Button
                  key={w}
                  size="sm"
                  variant={workerFilter === w ? "default" : "outline"}
                  className="h-7 text-[11px] px-2.5"
                  onClick={() => setWorkerFilter(w)}
                >
                  {w}
                </Button>
              ))}
            </div>
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-[150px] h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {uniqueMonths.map((m) => (
                  <SelectItem key={m} value={m}>
                    {fmtMonthLong(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {filteredTimesheets.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground font-mono">
            No timesheet entries for this filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] font-mono uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 pr-2">Date</th>
                  <th className="py-2 pr-2">Worker</th>
                  <th className="py-2 pr-2 text-right">Hours</th>
                  <th className="py-2 pr-2 text-right">Cost USD</th>
                  <th className="py-2 pr-2 text-right">Cost AUD</th>
                  <th className="py-2 pr-2">Month</th>
                </tr>
              </thead>
              <tbody>
                {filteredTimesheets.map((t, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-2 pr-2 tabular-nums">{fmtDate(t.date)}</td>
                    <td className="py-2 pr-2">{t.workerName}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{t.hours.toFixed(1)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{fmtMoney2(t.payoutUSD)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{fmtMoney2(t.payoutAUD)}</td>
                    <td className="py-2 pr-2 text-muted-foreground">{fmtMonthLong(t.month)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-semibold">
                  <td className="py-2 pr-2">TOTAL</td>
                  <td className="py-2 pr-2" />
                  <td className="py-2 pr-2 text-right tabular-nums">{filteredTotals.hours.toFixed(1)}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{fmtMoney2(filteredTotals.usd)}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{fmtMoney2(filteredTotals.aud)}</td>
                  <td className="py-2 pr-2" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <p className="text-[11px] text-muted-foreground font-mono text-center">
        Data sourced from Upwork via n8n automation · Syncs every 6 hours · USD → AUD conversion rate: 1.55
      </p>
    </DashboardLayout>
  );
};

export default EmployeeTracking;
