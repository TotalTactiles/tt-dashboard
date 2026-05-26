import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Users, Clock, DollarSign, TrendingUp, ChevronDown } from "lucide-react";
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
  BarChart,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// ============= MOCK DATA =============
const USD_TO_AUD = 1.55;
const ZOHO_RATE_AUD = 40;

type WorkerType = "casual_labour" | "subcontractor" | "digital_freelancer";

const MOCK_UPWORK_DATA = {
  source: "Upwork",
  syncTimestamp: new Date().toISOString(),
  usdToAudRate: USD_TO_AUD,
  summary: {
    activeWorkers: 3,
    totalContractors: 3,
    totalHours: 88,
    totalCostUSD: 2014,
    totalCostAUD: 2014 * USD_TO_AUD,
    avgRateUSD: 22.33,
  },
  workers: [
    { workerId: "u1", name: "Israr", role: "Digital Automation / n8n Dev", type: "Hourly", workerType: "digital_freelancer" as WorkerType, rateUSD: 25, status: "active", startDate: "2026-01-10", totalBilledUSD: 900, totalBilledAUD: 900 * USD_TO_AUD, hoursWorked: 36 },
    { workerId: "u2", name: "Haider", role: "Digital Automation / n8n Dev", type: "Hourly", workerType: "digital_freelancer" as WorkerType, rateUSD: 22, status: "active", startDate: "2026-02-01", totalBilledUSD: 704, totalBilledAUD: 704 * USD_TO_AUD, hoursWorked: 32 },
    { workerId: "u3", name: "Muhammed", role: "Digital / Web Contractor", type: "Hourly", workerType: "digital_freelancer" as WorkerType, rateUSD: 20, status: "active", startDate: "2026-03-01", totalBilledUSD: 400, totalBilledAUD: 400 * USD_TO_AUD, hoursWorked: 20 },
  ],
  timesheets: [
    { date: "2026-05-20", workerName: "Israr", hours: 6, payoutUSD: 150, payoutAUD: 150 * USD_TO_AUD, month: "2026-05", source: "Upwork", projectName: "" },
    { date: "2026-05-18", workerName: "Haider", hours: 5, payoutUSD: 110, payoutAUD: 110 * USD_TO_AUD, month: "2026-05", source: "Upwork", projectName: "" },
    { date: "2026-05-15", workerName: "Muhammed", hours: 4, payoutUSD: 80, payoutAUD: 80 * USD_TO_AUD, month: "2026-05", source: "Upwork", projectName: "" },
    { date: "2026-04-28", workerName: "Israr", hours: 8, payoutUSD: 200, payoutAUD: 200 * USD_TO_AUD, month: "2026-04", source: "Upwork", projectName: "" },
    { date: "2026-04-20", workerName: "Haider", hours: 7, payoutUSD: 154, payoutAUD: 154 * USD_TO_AUD, month: "2026-04", source: "Upwork", projectName: "" },
    { date: "2026-04-15", workerName: "Muhammed", hours: 5, payoutUSD: 100, payoutAUD: 100 * USD_TO_AUD, month: "2026-04", source: "Upwork", projectName: "" },
    { date: "2026-03-25", workerName: "Israr", hours: 10, payoutUSD: 250, payoutAUD: 250 * USD_TO_AUD, month: "2026-03", source: "Upwork", projectName: "" },
    { date: "2026-03-20", workerName: "Haider", hours: 8, payoutUSD: 176, payoutAUD: 176 * USD_TO_AUD, month: "2026-03", source: "Upwork", projectName: "" },
  ],
  monthlyData: [
    { month: "2026-03", totalHours: 18, totalCostUSD: 426, totalCostAUD: 426 * USD_TO_AUD },
    { month: "2026-04", totalHours: 20, totalCostUSD: 454, totalCostAUD: 454 * USD_TO_AUD },
    { month: "2026-05", totalHours: 15, totalCostUSD: 340, totalCostAUD: 340 * USD_TO_AUD },
  ],
};

const MOCK_ZOHO_DATA = {
  source: "Zoho Projects",
  syncTimestamp: new Date().toISOString(),
  rateAUD: ZOHO_RATE_AUD,
  summary: {
    activeWorkers: 2,
    totalWorkers: 2,
    totalHours: 200,
    totalCostAUD: 8000,
  },
  workers: [
    { workerId: "z1", name: "Asad Afzaal", role: "Site Installation", type: "Hourly", workerType: "casual_labour" as WorkerType, rateAUD: ZOHO_RATE_AUD, status: "active", startDate: "2025-08-01", totalBilledAUD: 4800, hoursWorked: 120, projects: ["Dalmeny PS", "BESIX Watpac St George S2"] },
    { workerId: "z2", name: "Abdul", role: "Site Installation", type: "Hourly", workerType: "casual_labour" as WorkerType, rateAUD: ZOHO_RATE_AUD, status: "active", startDate: "2025-10-15", totalBilledAUD: 3200, hoursWorked: 80, projects: ["Dalmeny PS"] },
  ],
  timesheets: [
    { date: "2026-05-22", workerName: "Asad Afzaal", hours: 8, costAUD: 320, month: "2026-05", source: "Zoho Projects", projectName: "Dalmeny PS", rateAUD: ZOHO_RATE_AUD },
    { date: "2026-05-21", workerName: "Abdul", hours: 8, costAUD: 320, month: "2026-05", source: "Zoho Projects", projectName: "Dalmeny PS", rateAUD: ZOHO_RATE_AUD },
    { date: "2026-05-15", workerName: "Asad Afzaal", hours: 7.5, costAUD: 300, month: "2026-05", source: "Zoho Projects", projectName: "BESIX Watpac St George S2", rateAUD: ZOHO_RATE_AUD },
    { date: "2026-04-28", workerName: "Asad Afzaal", hours: 8, costAUD: 320, month: "2026-04", source: "Zoho Projects", projectName: "Dalmeny PS", rateAUD: ZOHO_RATE_AUD },
    { date: "2026-04-22", workerName: "Abdul", hours: 8, costAUD: 320, month: "2026-04", source: "Zoho Projects", projectName: "Dalmeny PS", rateAUD: ZOHO_RATE_AUD },
    { date: "2026-04-18", workerName: "Asad Afzaal", hours: 7, costAUD: 280, month: "2026-04", source: "Zoho Projects", projectName: "BESIX Watpac St George S2", rateAUD: ZOHO_RATE_AUD },
    { date: "2026-04-10", workerName: "Abdul", hours: 6, costAUD: 240, month: "2026-04", source: "Zoho Projects", projectName: "Dalmeny PS", rateAUD: ZOHO_RATE_AUD },
    { date: "2026-03-28", workerName: "Asad Afzaal", hours: 8, costAUD: 320, month: "2026-03", source: "Zoho Projects", projectName: "BESIX Watpac St George S2", rateAUD: ZOHO_RATE_AUD },
    { date: "2026-03-22", workerName: "Abdul", hours: 7, costAUD: 280, month: "2026-03", source: "Zoho Projects", projectName: "Dalmeny PS", rateAUD: ZOHO_RATE_AUD },
    { date: "2026-03-15", workerName: "Asad Afzaal", hours: 8, costAUD: 320, month: "2026-03", source: "Zoho Projects", projectName: "Dalmeny PS", rateAUD: ZOHO_RATE_AUD },
  ],
  monthlyData: [
    { month: "2026-03", totalHours: 23, totalCostAUD: 920 },
    { month: "2026-04", totalHours: 29, totalCostAUD: 1160 },
    { month: "2026-05", totalHours: 23.5, totalCostAUD: 940 },
  ],
  projects: [
    { projectName: "Dalmeny PS", totalHours: 45, totalCostAUD: 1800, workers: ["Asad Afzaal", "Abdul"] },
    { projectName: "BESIX Watpac St George S2", totalHours: 30.5, totalCostAUD: 1220, workers: ["Asad Afzaal"] },
  ],
};

// ============= UTILS =============
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtMonthShort = (ym: string) => { const [y, m] = ym.split("-"); return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y.slice(2)}`; };
const fmtMonthLong = (ym: string) => { const [y, m] = ym.split("-"); return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`; };
const fmtDate = (iso: string) => { const d = new Date(iso); return `${String(d.getDate()).padStart(2, "0")} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`; };
const fmtSync = (iso: string) => { const d = new Date(iso); return `${String(d.getDate()).padStart(2, "0")} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const fmtAUD = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;
const fmtMoney2 = (n: number) => `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const statusPill = (status: string) => {
  const base = "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider";
  if (status === "active") return <span className={`${base} bg-chart-green/15 text-chart-green`}>active</span>;
  if (status === "paused") return <span className={`${base} bg-chart-orange/15 text-chart-orange`}>paused</span>;
  return <span className={`${base} bg-muted text-muted-foreground`}>ended</span>;
};

const sourcePill = (source: string) => {
  const base = "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider";
  if (source === "Upwork") return <span className={`${base} bg-chart-green/15 text-chart-green`}>Upwork</span>;
  return <span className={`${base} bg-chart-blue/15 text-chart-blue`}>Zoho</span>;
};

const typePill = (t: WorkerType) => {
  const base = "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider";
  if (t === "casual_labour") return <span className={`${base} bg-chart-orange/15 text-chart-orange`}>Casual Labour</span>;
  if (t === "subcontractor") return <span className={`${base} bg-chart-purple/15 text-chart-purple`}>Subcontractor</span>;
  return <span className={`${base} bg-chart-blue/15 text-chart-blue`}>Digital</span>;
};

const DONUT_COLORS = ["#22c55e", "#60a5fa", "#a78bfa", "#f59e0b", "#ef4444", "#14b8a6"];

// ============= KPI CARD =============
interface KPIProps {
  label: string;
  value: string;
  sub: string;
  Icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
}
const KPI = ({ label, value, sub, Icon, active, onClick }: KPIProps) => (
  <Card
    onClick={onClick}
    className={`p-4 cursor-pointer transition-all hover:border-chart-green/40 ${active ? "border-chart-green ring-1 ring-chart-green/30" : ""}`}
  >
    <div className="flex items-start justify-between mb-2">
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</p>
      <Icon className="h-4 w-4 text-chart-green" />
    </div>
    <p className="text-fluid-xl font-semibold tabular-nums">{value}</p>
    <p className="text-[11px] text-muted-foreground font-mono mt-1">{sub}</p>
    <p className="text-[10px] text-muted-foreground/60 font-mono mt-2 flex items-center gap-1">
      <ChevronDown className={`h-3 w-3 transition-transform ${active ? "rotate-180" : ""}`} />
      {active ? "Hide details" : "Click for details"}
    </p>
  </Card>
);

// ============= COMPONENT =============
const EmployeeTracking = () => {
  const upwork: typeof MOCK_UPWORK_DATA | null = MOCK_UPWORK_DATA;
  const zoho: typeof MOCK_ZOHO_DATA | null = MOCK_ZOHO_DATA;
  const isMockData = true; // when both sources live, set false

  const [expandedCard, setExpandedCard] = useState<null | "workers" | "hours" | "spend" | "rate">(null);
  const [workerFilter, setWorkerFilter] = useState<string>("All Workers");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("All Sources");
  const [chartSource, setChartSource] = useState<"all" | "upwork" | "zoho">("all");
  const [bankOpen, setBankOpen] = useState(false);

  // Merged workers
  const allWorkers = useMemo(() => {
    const up = (upwork?.workers ?? []).map((w) => ({
      id: w.workerId,
      name: w.name,
      role: w.role,
      source: "Upwork" as const,
      workerType: w.workerType,
      type: w.type,
      rateDisplay: `$${w.rateUSD.toFixed(2)} USD/hr`,
      rateAUDequiv: w.rateUSD * USD_TO_AUD,
      rateNative: w.rateUSD,
      currency: "USD",
      hoursWorked: w.hoursWorked,
      totalBilledAUD: w.totalBilledAUD,
      status: w.status,
    }));
    const zh = (zoho?.workers ?? []).map((w) => ({
      id: w.workerId,
      name: w.name,
      role: w.role,
      source: "Zoho Projects" as const,
      workerType: w.workerType,
      type: w.type,
      rateDisplay: `$${w.rateAUD.toFixed(2)} AUD/hr`,
      rateAUDequiv: w.rateAUD,
      rateNative: w.rateAUD,
      currency: "AUD",
      hoursWorked: w.hoursWorked,
      totalBilledAUD: w.totalBilledAUD,
      status: w.status,
    }));
    return [...up, ...zh].sort((a, b) => b.totalBilledAUD - a.totalBilledAUD);
  }, [upwork, zoho]);

  // Merged timesheets (normalised)
  const allTimesheets = useMemo(() => {
    const up = (upwork?.timesheets ?? []).map((t) => ({
      date: t.date,
      workerName: t.workerName,
      source: "Upwork" as const,
      projectName: t.projectName || "—",
      hours: t.hours,
      costAUD: t.payoutAUD,
      month: t.month,
    }));
    const zh = (zoho?.timesheets ?? []).map((t) => ({
      date: t.date,
      workerName: t.workerName,
      source: "Zoho Projects" as const,
      projectName: t.projectName,
      hours: t.hours,
      costAUD: t.costAUD,
      month: t.month,
    }));
    return [...up, ...zh];
  }, [upwork, zoho]);

  // Merged monthly chart data
  const mergedMonthly = useMemo(() => {
    const map = new Map<string, { month: string; totalHours: number; totalCostAUD: number }>();
    const add = (arr: { month: string; totalHours: number; totalCostAUD: number }[]) => {
      arr.forEach((m) => {
        const cur = map.get(m.month) ?? { month: m.month, totalHours: 0, totalCostAUD: 0 };
        cur.totalHours += m.totalHours;
        cur.totalCostAUD += m.totalCostAUD;
        map.set(m.month, cur);
      });
    };
    if (chartSource === "all" || chartSource === "upwork") add(upwork?.monthlyData ?? []);
    if (chartSource === "all" || chartSource === "zoho") add(zoho?.monthlyData ?? []);
    return Array.from(map.values())
      .sort((a, b) => (a.month < b.month ? -1 : 1))
      .map((m) => ({ ...m, label: fmtMonthShort(m.month) }));
  }, [upwork, zoho, chartSource]);

  // KPI calculations
  const upworkHours = upwork?.summary.totalHours ?? 0;
  const zohoHours = zoho?.summary.totalHours ?? 0;
  const totalHours = upworkHours + zohoHours;
  const upworkAUD = upwork?.summary.totalCostAUD ?? 0;
  const upworkUSD = upwork?.summary.totalCostUSD ?? 0;
  const zohoAUD = zoho?.summary.totalCostAUD ?? 0;
  const totalAUD = upworkAUD + zohoAUD;
  const upActive = upwork?.summary.activeWorkers ?? 0;
  const zoActive = zoho?.summary.activeWorkers ?? 0;
  const activeTotal = upActive + zoActive;
  const avgRateAUD = totalHours > 0 ? totalAUD / totalHours : 0;
  const upworkAvgUSD = upwork?.summary.avgRateUSD ?? 0;

  // Filters
  const uniqueMonths = useMemo(
    () => Array.from(new Set(allTimesheets.map((t) => t.month))).sort(),
    [allTimesheets],
  );
  const workerPills = ["All Workers", "Israr", "Haider", "Muhammed", "Asad Afzaal", "Abdul"];

  const filteredTimesheets = useMemo(() => {
    return allTimesheets
      .filter((t) => (workerFilter === "All Workers" ? true : t.workerName === workerFilter))
      .filter((t) => (monthFilter === "all" ? true : t.month === monthFilter))
      .filter((t) => (sourceFilter === "All Sources" ? true : t.source === sourceFilter))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [allTimesheets, workerFilter, monthFilter, sourceFilter]);

  const filteredTotals = useMemo(
    () => filteredTimesheets.reduce((acc, t) => ({ hours: acc.hours + t.hours, aud: acc.aud + t.costAUD }), { hours: 0, aud: 0 }),
    [filteredTimesheets],
  );

  // Hours-by-worker for Card 2 panel
  const hoursByWorker = useMemo(
    () => [...allWorkers].map((w) => ({ name: w.name, hours: w.hoursWorked })).sort((a, b) => b.hours - a.hours),
    [allWorkers],
  );

  // Spend-by-worker for Card 3 panel
  const spendByWorker = useMemo(() => {
    const items = allWorkers.map((w) => ({ name: w.name, source: w.source, value: w.totalBilledAUD }));
    const sum = items.reduce((s, i) => s + i.value, 0) || 1;
    return items.map((i) => ({ ...i, pct: (i.value / sum) * 100 })).sort((a, b) => b.value - a.value);
  }, [allWorkers]);

  const hasData = allWorkers.length > 0;

  if (!hasData) {
    return (
      <DashboardLayout>
        <div className="mb-4 md:mb-6">
          <h1 className="text-fluid-2xl font-semibold">Employee Tracking</h1>
        </div>
        <Card className="p-12 flex flex-col items-center justify-center text-center">
          <Users className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-mono text-muted-foreground mb-1">No data yet</p>
          <p className="text-xs text-muted-foreground max-w-md">
            Sync runs every 6 hours. Check that the Upwork and Zoho Projects workflows are active in n8n.
          </p>
        </Card>
      </DashboardLayout>
    );
  }

  const toggle = (k: typeof expandedCard) => setExpandedCard((c) => (c === k ? null : k));

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-4 md:mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-fluid-2xl font-semibold">Employee Tracking</h1>
          <p className="text-fluid-xs text-muted-foreground font-mono">Digital freelancers & casual labour · combined view</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {upwork ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-mono bg-chart-green/15 text-chart-green">
              Upwork · Last synced: {fmtSync(upwork.syncTimestamp)}
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-mono bg-muted text-muted-foreground">
              Upwork · Not connected
            </span>
          )}
          {zoho ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-mono bg-chart-blue/15 text-chart-blue">
              Zoho Projects · Last synced: {fmtSync(zoho.syncTimestamp)}
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-mono bg-muted text-muted-foreground">
              Zoho Projects · Not connected
            </span>
          )}
        </div>
      </div>

      {isMockData && (
        <div className="mb-4 px-3 py-2 rounded-md border border-chart-orange/40 bg-chart-orange/10 text-[11px] font-mono text-chart-orange">
          Showing sample data — live Upwork & Zoho Projects sync not yet connected.
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4 mb-4">
        <KPI
          label="Active Workers"
          value={String(activeTotal)}
          sub={`${upActive} Upwork · ${zoActive} Zoho Projects`}
          Icon={Users}
          active={expandedCard === "workers"}
          onClick={() => toggle("workers")}
        />
        <KPI
          label="Total Hours Logged"
          value={`${totalHours.toFixed(1)} hrs`}
          sub={`${upworkHours.toFixed(1)} hrs Upwork · ${zohoHours.toFixed(1)} hrs Zoho`}
          Icon={Clock}
          active={expandedCard === "hours"}
          onClick={() => toggle("hours")}
        />
        <KPI
          label="Total Spend (AUD)"
          value={fmtAUD(totalAUD)}
          sub={`Upwork AUD ${fmtAUD(upworkAUD)} · Zoho AUD ${fmtAUD(zohoAUD)}`}
          Icon={DollarSign}
          active={expandedCard === "spend"}
          onClick={() => toggle("spend")}
        />
        <KPI
          label="Avg Hourly Rate"
          value={`${fmtMoney2(avgRateAUD)} AUD/hr`}
          sub={`Upwork avg $${upworkAvgUSD.toFixed(2)} USD/hr · Zoho $${ZOHO_RATE_AUD} AUD/hr flat`}
          Icon={TrendingUp}
          active={expandedCard === "rate"}
          onClick={() => toggle("rate")}
        />
      </div>

      {/* Expanded panel */}
      {expandedCard && (
        <Card className="p-4 mb-4 md:mb-6 animate-in fade-in slide-in-from-top-2 duration-200">
          {expandedCard === "workers" && (
            <>
              <h3 className="text-sm font-semibold mb-3">Contractors</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] font-mono uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="py-2 pr-2">Name</th>
                      <th className="py-2 pr-2">Source</th>
                      <th className="py-2 pr-2">Role</th>
                      <th className="py-2 pr-2">Type</th>
                      <th className="py-2 pr-2 text-right">Rate</th>
                      <th className="py-2 pr-2 text-right">Total Hours</th>
                      <th className="py-2 pr-2 text-right">Total Billed AUD</th>
                      <th className="py-2 pr-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allWorkers.map((w) => (
                      <tr key={w.id} className="border-b border-border/50">
                        <td className="py-2 pr-2 font-medium">{w.name}</td>
                        <td className="py-2 pr-2">{sourcePill(w.source)}</td>
                        <td className="py-2 pr-2 text-muted-foreground">{w.role}</td>
                        <td className="py-2 pr-2">{typePill(w.workerType)}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{w.rateDisplay}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{w.hoursWorked.toFixed(1)}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{fmtAUD(w.totalBilledAUD)}</td>
                        <td className="py-2 pr-2">{statusPill(w.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {expandedCard === "hours" && (
            <>
              <h3 className="text-sm font-semibold mb-3">Hours by Worker</h3>
              <div style={{ height: Math.max(180, hoursByWorker.length * 40) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hoursByWorker} layout="vertical" margin={{ top: 5, right: 40, left: 20, bottom: 5 }}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.4} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={100} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                      formatter={(v: number) => [`${v.toFixed(1)} hrs`, "Hours"]}
                    />
                    <Bar dataKey="hours" fill="#22c55e" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 11, fill: "hsl(var(--muted-foreground))", formatter: (v: number) => `${v.toFixed(1)}h` }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {expandedCard === "spend" && (
            <>
              <h3 className="text-sm font-semibold mb-3">Spend by Worker</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-center">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={spendByWorker} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                        {spendByWorker.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                        formatter={(v: number, _n, item: { payload: { name: string; pct: number } }) => [`${fmtAUD(v)} (${item.payload.pct.toFixed(1)}%)`, item.payload.name]}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] font-mono uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="py-2 pr-2">Worker</th>
                      <th className="py-2 pr-2">Source</th>
                      <th className="py-2 pr-2 text-right">Total AUD</th>
                      <th className="py-2 pr-2 text-right">% of Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {spendByWorker.map((s, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2 pr-2 font-medium">{s.name}</td>
                        <td className="py-2 pr-2">{sourcePill(s.source)}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{fmtAUD(s.value)}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{s.pct.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {expandedCard === "rate" && (
            <>
              <h3 className="text-sm font-semibold mb-3">Worker Rates</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] font-mono uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="py-2 pr-2">Worker</th>
                      <th className="py-2 pr-2">Source</th>
                      <th className="py-2 pr-2 text-right">Rate</th>
                      <th className="py-2 pr-2">Currency</th>
                      <th className="py-2 pr-2 text-right">Equiv. AUD/hr</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allWorkers.map((w) => (
                      <tr key={w.id} className="border-b border-border/50">
                        <td className="py-2 pr-2 font-medium">{w.name}</td>
                        <td className="py-2 pr-2">{sourcePill(w.source)}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{w.rateNative.toFixed(2)}</td>
                        <td className="py-2 pr-2 text-muted-foreground">{w.currency}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{fmtMoney2(w.rateAUDequiv)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="flex justify-end mt-3">
            <button
              onClick={() => setExpandedCard(null)}
              className="text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors"
            >
              ▲ Collapse
            </button>
          </div>
        </Card>
      )}

      {/* Monthly chart (full width) */}
      <Card className="p-4 mb-4 md:mb-6">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h2 className="text-sm font-semibold">Monthly Hours & Spend</h2>
          <div className="flex items-center gap-1">
            {([
              ["all", "All Sources"],
              ["upwork", "Upwork only"],
              ["zoho", "Zoho only"],
            ] as const).map(([k, l]) => (
              <Button
                key={k}
                size="sm"
                variant={chartSource === k ? "default" : "outline"}
                className="h-7 text-[11px] px-2.5"
                onClick={() => setChartSource(k)}
              >
                {l}
              </Button>
            ))}
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={mergedMonthly} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
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
                formatter={(value: number, name: string) => {
                  if (name === "Hours") return [`${value.toFixed(1)} hrs`, "Hours"];
                  if (name === "Cost (AUD)") return [fmtAUD(value), "Cost (AUD)"];
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

      {/* Timesheet log */}
      <Card className="p-4 mb-3">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <h2 className="text-sm font-semibold">Timesheet Log</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 flex-wrap">
              {workerPills.map((w) => (
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
            <div className="flex items-center gap-1 flex-wrap">
              {["All Sources", "Upwork", "Zoho Projects"].map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={sourceFilter === s ? "default" : "outline"}
                  className="h-7 text-[11px] px-2.5"
                  onClick={() => setSourceFilter(s)}
                >
                  {s}
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
                  <SelectItem key={m} value={m}>{fmtMonthLong(m)}</SelectItem>
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
                  <th className="py-2 pr-2">Source</th>
                  <th className="py-2 pr-2">Project</th>
                  <th className="py-2 pr-2 text-right">Hours</th>
                  <th className="py-2 pr-2 text-right">Cost AUD</th>
                  <th className="py-2 pr-2">Month</th>
                </tr>
              </thead>
              <tbody>
                {filteredTimesheets.map((t, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-2 pr-2 tabular-nums">{fmtDate(t.date)}</td>
                    <td className="py-2 pr-2">{t.workerName}</td>
                    <td className="py-2 pr-2">{sourcePill(t.source)}</td>
                    <td className="py-2 pr-2 text-muted-foreground">{t.projectName}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{t.hours.toFixed(1)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{fmtMoney2(t.costAUD)}</td>
                    <td className="py-2 pr-2 text-muted-foreground">{fmtMonthLong(t.month)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-semibold">
                  <td className="py-2 pr-2">TOTAL</td>
                  <td className="py-2 pr-2" />
                  <td className="py-2 pr-2" />
                  <td className="py-2 pr-2" />
                  <td className="py-2 pr-2 text-right tabular-nums">{filteredTotals.hours.toFixed(1)}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{fmtMoney2(filteredTotals.aud)}</td>
                  <td className="py-2 pr-2" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/* Bank reconciliation placeholder */}
      <Card className="p-4 mb-3 bg-muted/30 border-dashed">
        <button
          onClick={() => setBankOpen((o) => !o)}
          className="w-full flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="flex items-center gap-2">
            <ChevronDown className={`h-3 w-3 transition-transform ${bankOpen ? "rotate-180" : "-rotate-90"}`} />
            Bank Reconciliation (coming soon)
          </span>
        </button>
        {bankOpen && (
          <div className="mt-3 text-xs text-muted-foreground font-mono">
            Bank transaction data will be connected here to reconcile actual payments against logged hours. This section will activate automatically once the bank sync is configured.
          </div>
        )}
      </Card>

      <p className="text-[11px] text-muted-foreground font-mono text-center">
        Labour data: Zoho Projects (casual workers, AUD $40/hr) · Digital contractors: Upwork (USD converted to AUD at 1.55) · Syncs every 6 hours · Bank transaction reconciliation coming soon
      </p>
    </DashboardLayout>
  );
};

export default EmployeeTracking;
