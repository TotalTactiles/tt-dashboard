import { useState, useMemo, useEffect, useRef, memo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Check, X, Trash2, GripVertical } from "lucide-react";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import {
  BarChart, Bar, LineChart, Line, ComposedChart, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";

type DebtType = "Term Loan" | "Asset Finance" | "Credit Card" | "Director Loan" | "Other";
type DebtPurpose = "Vehicle" | "Equipment" | "Working Capital" | "Property" | "Other";

interface DebtFacility {
  id: string;
  name: string;
  lender: string;
  type: DebtType;
  originalPrincipal: number;
  balance: number;
  rate: number;
  monthlyRepayment: number;
  startDate: string;
  maturityDate: string;
  purpose: DebtPurpose;
}

const DEBT_CACHE_KEY = "tt_debt_register";
const CACHE_WEBHOOK_GET = "https://n8n.srv1437130.hstgr.cloud/webhook/dashboard-cache";
const CACHE_WEBHOOK_POST = "https://n8n.srv1437130.hstgr.cloud/webhook/dashboard-cache";

const readCache = async (): Promise<Record<string, string>> => {
  try {
    const res = await fetch(CACHE_WEBHOOK_GET);
    const rows: Array<{ key: string; value: string }> = await res.json();
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  } catch {
    return {};
  }
};

const writeCache = async (key: string, value: string): Promise<void> => {
  try {
    await fetch(CACHE_WEBHOOK_POST, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
  } catch {}
  try { localStorage.setItem(key, value); } catch {}
};
const TYPE_OPTIONS: DebtType[] = ["Term Loan", "Asset Finance", "Credit Card", "Director Loan", "Other"];
const PURPOSE_OPTIONS: DebtPurpose[] = ["Vehicle", "Equipment", "Working Capital", "Property", "Other"];

const defaults: DebtFacility[] = [
  { id: "default-1", name: "Car Finance", lender: "", type: "Asset Finance", originalPrincipal: 0, balance: 0, rate: 0, monthlyRepayment: 0, startDate: "", maturityDate: "", purpose: "Vehicle" },
  { id: "default-2", name: "Business Loan", lender: "", type: "Term Loan", originalPrincipal: 0, balance: 0, rate: 0, monthlyRepayment: 0, startDate: "", maturityDate: "", purpose: "Working Capital" },
];

const fmtCurrency = (n: number) => `$${(n || 0).toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;

const FinancialHealth = () => {
  const { incomeOutgoingsData, forecastChartData, liveData } = useDashboardData() as any;

  const [debts, setDebts] = useState<DebtFacility[]>(defaults);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DebtFacility | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [activeTile, setActiveTile] = useState<string | null>(null);
  const debtRegisterInitialised = useRef(false);

  useEffect(() => {
    const loadDebtRegister = async () => {
      try {
        const cache = await readCache();
        if (cache[DEBT_CACHE_KEY]) {
          const parsed = JSON.parse(cache[DEBT_CACHE_KEY]);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setDebts(parsed);
            return;
          }
        }
      } catch {}
      try {
        const saved = localStorage.getItem(DEBT_CACHE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) setDebts(parsed);
        }
      } catch {}
    };
    loadDebtRegister();
  }, []);

  useEffect(() => {
    if (!debtRegisterInitialised.current) {
      debtRegisterInitialised.current = true;
      return;
    }
    writeCache(DEBT_CACHE_KEY, JSON.stringify(debts));
  }, [debts]);

  const totals = useMemo(() => {
    const totalPrincipal = debts.reduce((s, d) => s + (Number(d.originalPrincipal) || 0), 0);
    const totalBalance = debts.reduce((s, d) => s + (Number(d.balance) || 0), 0);
    const totalMonthly = debts.reduce((s, d) => s + (Number(d.monthlyRepayment) || 0), 0);
    const weightedSum = debts.reduce((s, d) => s + (Number(d.balance) || 0) * (Number(d.rate) || 0), 0);
    const blendedRate = totalBalance > 0 ? weightedSum / totalBalance : 0;
    return { totalPrincipal, totalBalance, totalMonthly, blendedRate };
  }, [debts]);

  const startEdit = (d: DebtFacility) => { setEditingId(d.id); setDraft({ ...d }); };
  const cancelEdit = () => { setEditingId(null); setDraft(null); };
  const saveEdit = () => {
    if (!draft) return;
    setDebts((prev) => prev.map((d) => (d.id === draft.id ? draft : d)));
    cancelEdit();
  };
  const deleteRow = (id: string) => {
    setDebts((prev) => prev.filter((d) => d.id !== id));
    if (editingId === id) cancelEdit();
  };
  const addFacility = () => {
    const id = `f-${Date.now()}`;
    const fresh: DebtFacility = { id, name: "New Facility", lender: "", type: "Term Loan", originalPrincipal: 0, balance: 0, rate: 0, monthlyRepayment: 0, startDate: "", maturityDate: "", purpose: "Working Capital" };
    setDebts((prev) => [...prev, fresh]);
    setEditingId(id);
    setDraft(fresh);
  };

  const updateDraft = <K extends keyof DebtFacility>(k: K, v: DebtFacility[K]) => {
    setDraft((d) => (d ? { ...d, [k]: v } : d));
  };

  // --- Scorecard inputs ---
  const totalDebt = totals.totalBalance;
  const totalMonthlyRepayment = totals.totalMonthly;
  const blendedRate = totals.blendedRate;
  const annualInterestCost = totalDebt * (blendedRate / 100);

  const revenueInclGST = Number(liveData?.revenueSummary?.totalValue) || 0;
  const totalCOGS = Number(liveData?.revenueSummary?.totalCOGS) || 0;
  const revenueExGST = revenueInclGST / 1.1;
  const grossProfitYTD = revenueExGST - totalCOGS;

  const recentSurplus = useMemo(() => {
    const arr: any[] = Array.isArray(forecastChartData) ? forecastChartData : [];
    for (let i = arr.length - 1; i >= 0; i--) {
      const v = Number(arr[i]?.anticipatedSurplus);
      if (v && !isNaN(v) && v !== 0) return v;
    }
    return 0;
  }, [forecastChartData]);

  type RAG = "green" | "amber" | "red" | "none";
  interface Metric { name: string; value: string; benchmark: string; rag: RAG; subValue?: string; subBenchmark?: string; }

  const dataMissing = totalDebt <= 0 || !revenueInclGST;

  const ragFromThresholds = (val: number, greenAtLeast?: number, redBelow?: number, invert = false): RAG => {
    if (invert) {
      // lower is better
      if (val < (greenAtLeast as number)) return "green";
      if (val > (redBelow as number)) return "red";
      return "amber";
    }
    if (val >= (greenAtLeast as number)) return "green";
    if (val < (redBelow as number)) return "red";
    return "amber";
  };

  const metrics: Metric[] = useMemo(() => {
    if (dataMissing) {
      const placeholders = [
        { name: "Interest Coverage", benchmark: "Benchmark: ≥ 2.5x" },
        { name: "Debt Service Coverage", benchmark: "Benchmark: ≥ 1.5x" },
        { name: "Debt-to-Revenue", benchmark: "Benchmark: < 40%" },
        { name: "Debt-to-Gross-Profit", benchmark: "Benchmark: < 75%" },
        { name: "Cash Cover", benchmark: "Benchmark: ≥ 3 months" },
        { name: "Repayment Burden", benchmark: "Benchmark: < 20% of GP" },
      ];
      return placeholders.map((p) => ({ ...p, value: "--", rag: "none" as RAG }));
    }

    const icr = annualInterestCost > 0 ? grossProfitYTD / annualInterestCost : Infinity;
    const dscr = totalMonthlyRepayment > 0 ? grossProfitYTD / (totalMonthlyRepayment * 12) : Infinity;
    const dToRev = revenueExGST > 0 ? (totalDebt / revenueExGST) * 100 : 0;
    const dToGP = grossProfitYTD > 0 ? (totalDebt / grossProfitYTD) * 100 : 0;
    const cashCover = totalMonthlyRepayment > 0 ? recentSurplus / totalMonthlyRepayment : 0;
    const burden = grossProfitYTD > 0 ? ((totalMonthlyRepayment * 12) / grossProfitYTD) * 100 : 0;

    return [
      {
        name: "Interest Coverage",
        value: isFinite(icr) ? `${icr.toFixed(1)}x` : "∞",
        benchmark: "Benchmark: ≥ 2.5x",
        rag: !isFinite(icr) ? "green" : ragFromThresholds(icr, 2.5, 1.5),
        subBenchmark: isFinite(icr) ? `For every $1 of interest owed, we generate $${icr.toFixed(1)} in GP` : undefined,
      },
      {
        name: "Debt Service Coverage",
        value: isFinite(dscr) ? `${dscr.toFixed(1)}x` : "∞",
        benchmark: "Benchmark: ≥ 1.5x",
        rag: !isFinite(dscr) ? "green" : ragFromThresholds(dscr, 1.5, 1.0),
        subBenchmark: isFinite(dscr) ? `We generate $${dscr.toFixed(1)} in GP for every $1 of total repayments` : undefined,
      },
      {
        name: "Debt-to-Revenue",
        value: `${dToRev.toFixed(0)}%`,
        benchmark: "Benchmark: < 40%",
        rag: ragFromThresholds(dToRev, 40, 65, true),
        subBenchmark: `${Math.round(dToRev)}c of debt for every $1 of revenue we bring in`,
      },
      {
        name: "Debt-to-Gross-Profit",
        value: `${dToGP.toFixed(0)}%`,
        benchmark: "Benchmark: < 75%",
        rag: ragFromThresholds(dToGP, 75, 150, true),
        subBenchmark: `Total debt = ~${(dToGP / 100).toFixed(1)} years of gross profit`,
      },
      {
        name: "Cash Cover",
        value: `${cashCover.toFixed(1)} months`,
        benchmark: "Benchmark: ≥ 3 months",
        rag: ragFromThresholds(cashCover, 3, 1.5),
        subValue: `(${(cashCover / 12).toFixed(1)} years)`,
      },
      {
        name: "Repayment Burden",
        value: `${burden.toFixed(0)}% of GP`,
        benchmark: "Benchmark: < 20% of GP",
        rag: ragFromThresholds(burden, 20, 35, true),
        subBenchmark: `${Math.round(burden)}c in every $1 of GP goes to debt`,
      },
    ];
  }, [dataMissing, annualInterestCost, grossProfitYTD, totalMonthlyRepayment, revenueExGST, totalDebt, recentSurplus]);

  const ragDot = (rag: RAG) => {
    const map: Record<RAG, string> = {
      green: "bg-chart-green",
      amber: "bg-yellow-500",
      red: "bg-red-500",
      none: "bg-muted-foreground/50",
    };
    return <span className={`inline-block w-2 h-2 rounded-full ${map[rag]}`} />;
  };

  const ragBorder = (rag: RAG) => {
    const map: Record<RAG, string> = {
      green: "border-chart-green/30",
      amber: "border-yellow-500/30",
      red: "border-red-500/30",
      none: "border-border",
    };
    return map[rag];
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Financial Health</h1>
          <p className="text-sm text-muted-foreground">Debt Management & Business Solvency</p>
        </div>

        {/* SECTION 1: Debt Register */}
        <div className="chart-container">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Debt Register</h2>
            <Button onClick={addFacility} className="bg-chart-green hover:bg-chart-green/90 text-black">
              <Plus className="w-4 h-4 mr-1" /> Add Facility
            </Button>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 px-2 font-medium w-8 shrink-0 whitespace-nowrap"></th>
                  <th className="py-2 px-2 font-medium text-left whitespace-nowrap">Facility</th>
                  <th className="py-2 px-2 font-medium text-left whitespace-nowrap">Lender</th>
                  <th className="py-2 px-2 font-medium text-left whitespace-nowrap">Type</th>
                  <th className="py-2 px-2 font-medium text-right whitespace-nowrap">Original</th>
                  <th className="py-2 px-2 font-medium text-right whitespace-nowrap">Balance</th>
                  <th className="py-2 px-2 font-medium text-right whitespace-nowrap">Rate %</th>
                  <th className="py-2 px-2 font-medium text-right whitespace-nowrap">Monthly</th>
                  <th className="py-2 px-2 font-medium text-left whitespace-nowrap">Start</th>
                  <th className="py-2 px-2 font-medium text-left whitespace-nowrap">Maturity</th>
                  <th className="py-2 px-2 font-medium text-left whitespace-nowrap">Purpose</th>
                  <th className="py-2 px-2 font-medium text-right w-[80px] shrink-0 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {debts.map((d, index) => {
                  const isEditing = editingId === d.id && draft;
                  const row = isEditing ? (draft as DebtFacility) : d;
                  return (
                    <tr
                      key={d.id}
                      draggable={true}
                      onDragStart={() => { dragIndexRef.current = index; }}
                      onDragOver={(e) => { e.preventDefault(); setDragOverIndex(index); }}
                      onDrop={() => {
                        const dragIndex = dragIndexRef.current;
                        if (dragIndex !== null && dragIndex !== index) {
                          setDebts((prev) => {
                            const next = [...prev];
                            const temp = next[dragIndex];
                            next[dragIndex] = next[index];
                            next[index] = temp;
                            return next;
                          });
                        }
                        setDragOverIndex(null);
                        dragIndexRef.current = null;
                      }}
                      onDragEnd={() => { setDragOverIndex(null); dragIndexRef.current = null; }}
                      className={`border-b border-border/40 hover:bg-muted/20 ${dragOverIndex === index ? "opacity-50" : ""}`}
                    >
                      <td className="py-1.5 px-2 w-8 shrink-0 whitespace-nowrap">
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                      </td>
                      <td className="py-1.5 px-2 text-left whitespace-nowrap">
                        {isEditing ? (
                          <Input value={row.name} onChange={(e) => updateDraft("name", e.target.value)} className="h-7 text-xs" />
                        ) : row.name}
                      </td>
                      <td className="py-1.5 px-2 text-left whitespace-nowrap">
                        {isEditing ? (
                          <Input value={row.lender} onChange={(e) => updateDraft("lender", e.target.value)} className="h-7 text-xs" />
                        ) : row.lender || "—"}
                      </td>
                      <td className="py-1.5 px-2 text-left whitespace-nowrap">
                        {isEditing ? (
                          <Select value={row.type} onValueChange={(v) => updateDraft("type", v as DebtType)}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {TYPE_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : row.type}
                      </td>
                      <td className="py-1.5 px-2 text-right whitespace-nowrap">
                        {isEditing ? (
                          <Input type="number" value={row.originalPrincipal} onChange={(e) => updateDraft("originalPrincipal", Number(e.target.value))} className="h-7 text-xs text-right" />
                        ) : fmtCurrency(row.originalPrincipal)}
                      </td>
                      <td className="py-1.5 px-2 text-right whitespace-nowrap">
                        {isEditing ? (
                          <Input type="number" value={row.balance} onChange={(e) => updateDraft("balance", Number(e.target.value))} className="h-7 text-xs text-right" />
                        ) : fmtCurrency(row.balance)}
                      </td>
                      <td className="py-1.5 px-2 text-right whitespace-nowrap">
                        {isEditing ? (
                          <Input type="number" step="0.01" value={row.rate} onChange={(e) => updateDraft("rate", Number(e.target.value))} className="h-7 text-xs text-right" />
                        ) : `${(row.rate || 0).toFixed(2)}%`}
                      </td>
                      <td className="py-1.5 px-2 text-right whitespace-nowrap">
                        {isEditing ? (
                          <Input type="number" value={row.monthlyRepayment} onChange={(e) => updateDraft("monthlyRepayment", Number(e.target.value))} className="h-7 text-xs text-right" />
                        ) : fmtCurrency(row.monthlyRepayment)}
                      </td>
                      <td className="py-1.5 px-2 text-left whitespace-nowrap">
                        {isEditing ? (
                          <Input type="date" value={row.startDate} onChange={(e) => updateDraft("startDate", e.target.value)} className="h-7 text-xs" />
                        ) : row.startDate || "—"}
                      </td>
                      <td className="py-1.5 px-2 text-left whitespace-nowrap">
                        {isEditing ? (
                          <Input type="date" value={row.maturityDate} onChange={(e) => updateDraft("maturityDate", e.target.value)} className="h-7 text-xs" />
                        ) : row.maturityDate || "—"}
                      </td>
                      <td className="py-1.5 px-2 text-left whitespace-nowrap">
                        {isEditing ? (
                          <Select value={row.purpose} onValueChange={(v) => updateDraft("purpose", v as DebtPurpose)}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {PURPOSE_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : row.purpose}
                      </td>
                      <td className="py-1.5 px-2 w-[80px] shrink-0 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isEditing ? (
                            <>
                              <button onClick={saveEdit} className="p-1 rounded hover:bg-chart-green/20 text-chart-green" aria-label="Save">
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={cancelEdit} className="p-1 rounded hover:bg-muted text-muted-foreground" aria-label="Cancel">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <button onClick={() => startEdit(d)} className="p-1 rounded hover:bg-muted text-muted-foreground" aria-label="Edit">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => deleteRow(d.id)} className="p-1 rounded hover:bg-red-500/20 text-red-400" aria-label="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {debts.length === 0 && (
                  <tr><td colSpan={12} className="py-6 text-center text-muted-foreground whitespace-nowrap">No facilities. Click "Add Facility" to start.</td></tr>
                )}
              </tbody>
              {debts.length > 0 && (
                <tfoot>
                  <tr className="border-t border-border font-mono text-foreground bg-muted/10">
                    <td className="py-2 px-2 font-semibold whitespace-nowrap w-8 shrink-0"></td>
                    <td className="py-2 px-2 font-semibold text-left whitespace-nowrap" colSpan={3}>Totals</td>
                    <td className="py-2 px-2 text-right font-semibold whitespace-nowrap">{fmtCurrency(totals.totalPrincipal)}</td>
                    <td className="py-2 px-2 text-right font-semibold whitespace-nowrap">{fmtCurrency(totals.totalBalance)}</td>
                    <td className="py-2 px-2 text-right font-semibold whitespace-nowrap">{totals.blendedRate.toFixed(2)}%</td>
                    <td className="py-2 px-2 text-right font-semibold whitespace-nowrap">{fmtCurrency(totals.totalMonthly)}</td>
                    <td colSpan={3} className="whitespace-nowrap"></td>
                    <td className="w-[80px] shrink-0 whitespace-nowrap"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>


        {/* SECTION 2: Health Scorecard */}
        <div className="chart-container">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-foreground">Health Scorecard</h2>
            <p className="text-xs text-muted-foreground">Solvency & debt-service indicators based on YTD performance</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {metrics.map((m) => {
              const isActive = activeTile === m.name;
              return (
                <button
                  key={m.name}
                  type="button"
                  onClick={() => setActiveTile((prev) => (prev === m.name ? null : m.name))}
                  className={`chart-container relative border text-left transition-colors ${ragBorder(m.rag)} ${isActive ? "ring-2 ring-white/20" : "hover:bg-white/5"}`}
                >
                  <div className="absolute top-3 right-3">{ragDot(m.rag)}</div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{m.name}</p>
                  <div className="flex flex-col items-center justify-center py-3">
                    <span className="text-3xl font-bold text-foreground font-mono">{m.value}</span>
                    {m.subValue && m.value !== "--" && (
                      <p className="text-xs text-foreground/70 font-mono mt-1 text-center">{m.subValue}</p>
                    )}
                    {m.subBenchmark && m.value !== "--" && (
                      <p className="text-xs text-foreground/70 font-mono mt-1 text-center px-2">({m.subBenchmark})</p>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">{m.benchmark}</p>
                  {m.rag === "none" && <p className="text-[10px] text-muted-foreground mt-0.5">No data</p>}
                </button>
              );
            })}
          </div>

          <ScorecardDetailPanel
            activeTile={activeTile}
            onClose={() => setActiveTile(null)}
            metrics={metrics}
            grossProfitYTD={grossProfitYTD}
            annualInterestCost={annualInterestCost}
            totalMonthlyRepayment={totalMonthlyRepayment}
            totalDebt={totalDebt}
            revenueExGST={revenueExGST}
            recentSurplus={recentSurplus}
          />
        </div>


        {/* SECTION 3: Charts */}
        <ChartsSection
          incomeOutgoingsData={incomeOutgoingsData}
          forecastChartData={forecastChartData}
          debts={debts}
          totalMonthlyRepayment={totalMonthlyRepayment}
        />
      </div>
    </DashboardLayout>
  );
};

// ---------- Charts Section ----------

const CHART_TICK = { fill: "#6b7280", fontSize: 11 } as const;
const GRID_STROKE = "#ffffff10";
const TOOLTIP_STYLE = {
  backgroundColor: "#1a1a2e",
  border: "1px solid #ffffff20",
  borderRadius: "8px",
  fontSize: "12px",
} as const;
const SLICE_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#8b5cf6", "#ef4444"];

const fmtAUD = (n: number) =>
  `$${(n || 0).toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;
const fmtKAxis = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `$${Math.round(n / 1000)}k`;
  return `$${n}`;
};

interface ChartsSectionProps {
  incomeOutgoingsData: any[];
  forecastChartData: any[];
  debts: DebtFacility[];
  totalMonthlyRepayment: number;
}

const ChartsSection = ({
  incomeOutgoingsData,
  forecastChartData,
  debts,
  totalMonthlyRepayment,
}: ChartsSectionProps) => {
  const io: any[] = Array.isArray(incomeOutgoingsData) ? incomeOutgoingsData : [];
  const fc: any[] = Array.isArray(forecastChartData) ? forecastChartData : [];

  // ---- Waterfall dataset ----
  const waterfallData = useMemo(() => {
    const fcByMonth = new Map<string, any>();
    fc.forEach((f) => fcByMonth.set(String(f?.month ?? ""), f));
    return io.map((row) => {
      const month = String(row?.month ?? "");
      const income = Number(row?.income) || 0;
      const outgoings = Number(row?.outgoings) || 0;
      const grossProfit = income - outgoings * 0.45;
      const surplus = Number(fcByMonth.get(month)?.anticipatedSurplus) || 0;
      const netAfterDebt = surplus - totalMonthlyRepayment;
      return { month, revenue: income, grossProfit, netAfterDebt };
    });
  }, [io, fc, totalMonthlyRepayment]);

  // ---- Cash cover runway ----
  const runwayData = useMemo(() => {
    return fc.map((row) => {
      const month = String(row?.month ?? "");
      const surplus = Number(row?.anticipatedSurplus) || 0;
      let coverMonths: number | null = null;
      if (totalMonthlyRepayment > 0) {
        const raw = surplus / totalMonthlyRepayment;
        coverMonths = Math.max(-2, Math.min(12, raw));
      }
      return { month, coverMonths };
    });
  }, [fc, totalMonthlyRepayment]);

  // ---- Debt composition ----
  const compositionData = useMemo(() => {
    return debts
      .filter((d) => Number(d.balance) > 0)
      .map((d) => ({ name: d.name || "Unnamed", value: Number(d.balance) || 0 }));
  }, [debts]);
  const compositionTotal = compositionData.reduce((s, d) => s + d.value, 0);

  // ---- Burden % of GP monthly ----
  const burdenData = useMemo(() => {
    return io.map((row) => {
      const month = String(row?.month ?? "");
      const income = Number(row?.income) || 0;
      const outgoings = Number(row?.outgoings) || 0;
      const monthlyGP = income - outgoings * 0.45;
      let burdenPct: number | null = null;
      if (monthlyGP > 0 && totalMonthlyRepayment > 0) {
        burdenPct = Math.min(200, (totalMonthlyRepayment / monthlyGP) * 100);
      }
      return { month, burdenPct };
    });
  }, [io, totalMonthlyRepayment]);

  const WaterfallTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={TOOLTIP_STYLE} className="px-3 py-2">
        <p className="text-foreground font-medium mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} style={{ color: p.color }}>
            {p.name}: {fmtAUD(p.value)}
          </p>
        ))}
      </div>
    );
  };

  const RunwayTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const v = payload[0]?.value;
    return (
      <div style={TOOLTIP_STYLE} className="px-3 py-2">
        <p className="text-foreground font-medium">{label}</p>
        <p className="text-muted-foreground">
          {v == null ? "No repayment data" : `${Number(v).toFixed(1)} months cover`}
        </p>
      </div>
    );
  };

  const CompositionTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const p = payload[0];
    const pct = compositionTotal > 0 ? (p.value / compositionTotal) * 100 : 0;
    return (
      <div style={TOOLTIP_STYLE} className="px-3 py-2">
        <p className="text-foreground font-medium">{p.name}</p>
        <p className="text-muted-foreground">{fmtAUD(p.value)} ({pct.toFixed(1)}%)</p>
      </div>
    );
  };

  const BurdenTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const v = payload[0]?.value;
    return (
      <div style={TOOLTIP_STYLE} className="px-3 py-2">
        <p className="text-foreground font-medium">{label}</p>
        <p className="text-muted-foreground">
          {v == null ? "No GP data" : `${Number(v).toFixed(1)}% of GP`}
        </p>
      </div>
    );
  };

  const runwayColor = (v: number | null) => {
    if (v == null) return "#6b7280";
    if (v >= 3) return "#22c55e";
    if (v >= 1.5) return "#eab308";
    return "#ef4444";
  };

  const burdenColor = (v: number | null) => {
    if (v == null) return "#6b7280";
    if (v < 20) return "#22c55e";
    if (v <= 35) return "#eab308";
    return "#ef4444";
  };

  // ---- Earned vs Debt-Funded Revenue ----
  const { liveData } = useDashboardData() as any;

  const earnedVsDebtData = useMemo(() => {
    const rawCashflow = liveData?.cashflow ?? [];
    const findCashflowRow = (label: string) => {
      const upper = label.toUpperCase();
      return rawCashflow.find((r: any) => {
        const rl = (r._label_rowLabel ?? r.col_1 ?? "").toString().toUpperCase();
        return rl.includes(upper);
      }) ?? null;
    };
    const loanRepaymentRow = findCashflowRow("BUSINESS LOAN REPAYMENT");

    const parseNum = (v: any) => {
      if (v === null || v === undefined || v === "") return 0;
      return parseFloat(String(v).replace(/[$,]/g, "")) || 0;
    };

    const vinnyFacilities = debts.filter((d) => (d.name ?? "").toLowerCase().includes("vinny"));
    const vinnyFallback = vinnyFacilities.reduce((sum, f) => sum + (Number(f.monthlyRepayment) || 0), 0);

    const rows = io.map((row) => {
      const month = String(row?.month ?? "");
      const earnedRevenue = Number(row?.income) || 0;
      const cashflowVal = loanRepaymentRow ? Math.abs(parseNum(loanRepaymentRow[month])) : 0;
      const debtDrawdown = cashflowVal > 0 ? cashflowVal : vinnyFallback;
      return { month, earnedRevenue, debtDrawdown, netEarned: earnedRevenue - debtDrawdown };
    });

    const hasAnySource = loanRepaymentRow !== null || vinnyFacilities.length > 0;
    return { rows, hasAnySource };
  }, [io, debts, liveData]);

  const earnedStats = useMemo(() => {
    const r = earnedVsDebtData.rows;
    const totalEarned = r.reduce((s, x) => s + x.earnedRevenue, 0);
    const totalDebt = r.reduce((s, x) => s + x.debtDrawdown, 0);
    const activeMonths = r.filter((x: any) => x.earnedRevenue > 0);
    const avgNet = activeMonths.length ? activeMonths.reduce((s, x) => s + x.netEarned, 0) / activeMonths.length : 0;
    const debtPct = totalEarned > 0 ? (totalDebt / totalEarned) * 100 : 0;
    return { totalDebt, avgNet, debtPct };
  }, [earnedVsDebtData]);

  const EarnedTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={TOOLTIP_STYLE} className="px-3 py-2">
        <p className="text-foreground font-medium mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} style={{ color: p.color }}>
            {p.name}: {fmtAUD(p.value)}
          </p>
        ))}
      </div>
    );
  };

  // ---- Debt-Stripped Earnings & Lender Serviceability ----
  const debtStripped = useMemo(() => {
    const rawCashflow = liveData?.cashflow ?? [];
    const findRow = (label: string) => {
      const upper = label.toUpperCase();
      return rawCashflow.find((r: any) => {
        const rl = (r._label_rowLabel ?? r.col_1 ?? "").toString().toUpperCase();
        return rl.includes(upper);
      }) ?? null;
    };
    const parseNum = (v: any) => {
      if (v === null || v === undefined || v === "") return 0;
      return parseFloat(String(v).replace(/[$,]/g, "")) || 0;
    };
    const businessLoanRow = findRow("BUSINESS LOAN REPAYMENT");
    const vehicleRepaymentRow = findRow("MOTOR VEHICLE REPAYMENT");

    const rows = io.map((row) => {
      const month = String(row?.month ?? "");
      const earnedRevenue = Number(row?.income) || 0;
      const totalCosts = Math.abs(Number(row?.outgoings) || 0);
      const monthlyDebt =
        Math.abs(parseNum(businessLoanRow?.[month] ?? 0)) +
        Math.abs(parseNum(vehicleRepaymentRow?.[month] ?? 0));
      const operatingCosts = Math.max(0, totalCosts - monthlyDebt);
      const netFreeCash = earnedRevenue - operatingCosts - monthlyDebt;
      return { month, earnedRevenue, operatingCosts, debtBurden: monthlyDebt, netFreeCash };
    });

    const active = rows.filter((r) => r.earnedRevenue > 0);
    const avgN = (n: number) => {
      const slice = active.slice(-n);
      if (!slice.length) return 0;
      return slice.reduce((s, x) => s + x.netFreeCash, 0) / slice.length;
    };
    const avg3 = avgN(3);
    const avg6 = avgN(6);
    const avg12 = active.length ? active.reduce((s, x) => s + x.netFreeCash, 0) / active.length : 0;
    const lenderBuffer = 0.8;
    const maxNewRepayment = avg6 * lenderBuffer;
    const borrowingCapacity60 = maxNewRepayment * 60 * 0.85;
    return { rows, avg3, avg6, avg12, maxNewRepayment, borrowingCapacity60 };
  }, [io, liveData]);

  const ragColor = (v: number) => (v > 2000 ? "#22c55e" : v >= 500 ? "#f59e0b" : "#ef4444");
  const ragLabel = (v: number): "green" | "amber" | "red" =>
    v > 2000 ? "green" : v >= 500 ? "amber" : "red";
  const verdictText = (r: "green" | "amber" | "red") =>
    r === "green"
      ? "Serviceability is strong. You could likely support a new facility."
      : r === "amber"
      ? "Marginal serviceability. A lender may require additional security."
      : "Insufficient net free cash. Strengthen earnings before applying.";
  const fmtK = (n: number) => {
    const sign = n < 0 ? "-" : "";
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    return `${sign}$${Math.round(abs / 1000)}k`;
  };
  const NetFreeTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={TOOLTIP_STYLE} className="px-3 py-2">
        <p className="text-foreground font-medium mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} style={{ color: p.color }}>{p.name}: {fmtAUD(p.value)}</p>
        ))}
      </div>
    );
  };
  const rag = ragLabel(debtStripped.maxNewRepayment);
  const ragHex = ragColor(debtStripped.maxNewRepayment);

  return (

    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Debt vs Business Performance</h2>
        <p className="text-xs text-muted-foreground">Live cashflow data overlaid with debt obligations</p>
      </div>

      {/* Chart 0: Earned vs Debt-Funded Revenue */}
      <div className="chart-container">
        <p className="text-sm font-medium text-foreground mb-0.5">What We Earned vs What Was Borrowed</p>
        <p className="text-xs text-muted-foreground mb-3">Monthly income from operations vs capital injected via debt facilities</p>

        {!earnedVsDebtData.hasAnySource ? (
          <div className="flex items-center justify-center text-center text-xs text-muted-foreground" style={{ height: 120 }}>
            No debt-funded facilities identified. Add facilities with 'Vinny' in the name to see this breakdown.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-2">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Avg Monthly Earned</div>
                <div className="text-base font-mono font-semibold text-green-500">{fmtAUD(earnedStats.avgNet)}</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-2">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Debt Capital Injected</div>
                <div className="text-base font-mono font-semibold text-blue-500">{fmtAUD(earnedStats.totalDebt)}</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-2">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Debt as % of Total Income</div>
                <div className="text-base font-mono font-semibold text-amber-500">{earnedStats.debtPct.toFixed(1)}%</div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={earnedVsDebtData.rows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={CHART_TICK} />
                <YAxis tick={CHART_TICK} tickFormatter={fmtKAxis} />
                <Tooltip content={<EarnedTooltip />} contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #ffffff20", borderRadius: "8px", fontSize: "12px" }} />
                <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
                <ReferenceLine y={0} stroke="#ffffff20" />
                <Bar dataKey="earnedRevenue" name="Total Income" fill="#22c55e" fillOpacity={0.8} />
                <Bar dataKey="debtDrawdown" name="Debt Capital (Vinny)" fill="#3b82f6" fillOpacity={0.7} />
                <Line type="monotone" dataKey="netEarned" name="True Earned (ex-Debt)" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </>
        )}
      </div>




      {/* Chart 2: Debt Payoff Trajectory */}
      {(() => {
        const PAYOFF_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#8b5cf6", "#ef4444"];
        const activeFacilities = debts.filter((d) => Number(d.balance) > 0);
        const totalDebtToday = activeFacilities.reduce((s, d) => s + (Number(d.balance) || 0), 0);

        if (activeFacilities.length === 0) {
          return (
            <div className="chart-container">
              <p className="text-sm font-medium text-foreground mb-0.5">Debt Payoff Trajectory</p>
              <p className="text-xs text-muted-foreground mb-4">Projected outstanding balance per facility as repayments are made</p>
              <div className="h-[120px] flex items-center justify-center text-muted-foreground text-sm text-center px-4">
                Enter balance outstanding in the debt register to see payoff trajectory.
              </div>
            </div>
          );
        }

        const start = new Date();
        start.setDate(1);
        const fmtMonthLabel = (d: Date) => {
          const m = d.toLocaleString("en-US", { month: "short" });
          const y = String(d.getFullYear()).slice(-2);
          return `${m}-${y}`;
        };

        // Simulate per facility
        const perFacility: { name: string; series: number[]; totalInterest: number; payoffMonth: number | null }[] = activeFacilities.map((f) => {
          const annualRate = Number(f.rate) || 0;
          const monthlyRate = annualRate / 100 / 12;
          const repay = Number(f.monthlyRepayment) || 0;
          let balance = Number(f.balance) || 0;
          const maturity = f.maturityDate ? new Date(f.maturityDate) : null;
          const series: number[] = [];
          let totalInterest = 0;
          let payoffMonth: number | null = null;
          for (let i = 0; i < 84; i++) {
            series.push(Math.max(0, balance));
            const curDate = new Date(start.getFullYear(), start.getMonth() + i, 1);
            if (balance <= 0) {
              if (payoffMonth === null) payoffMonth = i;
              continue;
            }
            if (maturity && curDate > maturity) {
              balance = 0;
              if (payoffMonth === null) payoffMonth = i;
              continue;
            }
            const interestCharge = balance * monthlyRate;
            totalInterest += interestCharge;
            const principalPaid = repay - interestCharge;
            balance = Math.max(0, balance - (principalPaid > 0 ? principalPaid : 0));
            if (balance <= 0 && payoffMonth === null) payoffMonth = i + 1;
          }
          return { name: f.name || "Unnamed", series, totalInterest, payoffMonth };
        });

        // Determine max months needed: until all balances are zero, capped 84
        let maxMonths = 1;
        for (let i = 83; i >= 0; i--) {
          if (perFacility.some((p) => p.series[i] > 0)) { maxMonths = i + 1; break; }
        }
        maxMonths = Math.min(84, Math.max(maxMonths, 6));

        const payoffData = Array.from({ length: maxMonths }, (_, i) => {
          const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
          const row: any = { month: fmtMonthLabel(d) };
          perFacility.forEach((p) => { row[p.name] = Math.round(p.series[i] || 0); });
          return row;
        });

        // Fully paid by = latest maturity across facilities
        const maturities = activeFacilities
          .map((f) => (f.maturityDate ? new Date(f.maturityDate) : null))
          .filter((d): d is Date => !!d && !isNaN(d.getTime()));
        const fullyPaidBy = maturities.length
          ? maturities.reduce((a, b) => (a > b ? a : b)).toLocaleDateString("en-AU", { month: "short", year: "numeric" })
          : "—";
        const totalInterestRemaining = perFacility.reduce((s, p) => s + p.totalInterest, 0);

        const PayoffTooltip = ({ active, payload, label }: any) => {
          if (!active || !payload?.length) return null;
          return (
            <div style={TOOLTIP_STYLE} className="px-3 py-2">
              <p className="text-foreground font-medium mb-1">{label}</p>
              {payload.map((p: any) => (
                <p key={p.dataKey} style={{ color: p.color }}>{p.name}: {fmtAUD(p.value)}</p>
              ))}
            </div>
          );
        };

        return (
          <div className="chart-container">
            <p className="text-sm font-medium text-foreground mb-0.5">Debt Payoff Trajectory</p>
            <p className="text-xs text-muted-foreground mb-4">Projected outstanding balance per facility as repayments are made</p>

            <div className="flex flex-wrap gap-2 mb-4">
              <div className="bg-white/5 rounded-lg px-3 py-2">
                <div className="text-[10px] text-muted-foreground">Total Debt Today</div>
                <div className="text-sm font-mono font-semibold text-red-400">{fmtAUD(totalDebtToday)}</div>
              </div>
              <div className="bg-white/5 rounded-lg px-3 py-2">
                <div className="text-[10px] text-muted-foreground">Fully Paid By</div>
                <div className="text-sm font-mono font-semibold text-muted-foreground">{fullyPaidBy}</div>
              </div>
              <div className="bg-white/5 rounded-lg px-3 py-2">
                <div className="text-[10px] text-muted-foreground">Total Interest Remaining</div>
                <div className="text-sm font-mono font-semibold text-amber-400">{fmtAUD(totalInterestRemaining)}</div>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={payoffData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="month" interval={5} tick={{ fontSize: 11, fill: "#6b7280" }} />
                <YAxis tickFormatter={fmtKAxis} tick={{ fontSize: 11, fill: "#6b7280" }} />
                <Tooltip content={<PayoffTooltip />} contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #ffffff20", borderRadius: "8px", fontSize: "12px" }} />
                <Legend
                  wrapperStyle={{ fontSize: 11, color: "#9ca3af" }}
                  formatter={(value: string) => {
                    const f = activeFacilities.find((x) => (x.name || "Unnamed") === value);
                    return `${value} — ${fmtAUD(Number(f?.balance) || 0)}`;
                  }}
                />
                {perFacility.map((p, i) => (
                  <Line key={p.name} type="monotone" dataKey={p.name} stroke={PAYOFF_COLORS[i % PAYOFF_COLORS.length]} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      })()}

      {/* Charts 3a + 3b */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* 3a: Donut */}
        <div className="chart-container md:w-2/5">
          <p className="text-sm font-medium text-foreground mb-0.5">Debt Composition</p>
          <p className="text-xs text-muted-foreground mb-4">Balance by facility</p>
          {compositionData.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">No debt entered</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={compositionData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {compositionData.map((_, i) => (
                      <Cell key={i} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CompositionTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1">
                {compositionData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: SLICE_COLORS[i % SLICE_COLORS.length] }} />
                      <span className="text-muted-foreground">{d.name}</span>
                    </div>
                    <span className="font-mono text-foreground">{fmtAUD(d.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* 3b: Burden */}
        <div className="chart-container md:w-3/5">
          <p className="text-sm font-medium text-foreground mb-0.5">Repayment Burden % of GP</p>
          <p className="text-xs text-muted-foreground mb-4">Monthly debt repayment as % of that month's gross profit</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={burdenData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={CHART_TICK} />
              <YAxis tick={CHART_TICK} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip content={<BurdenTooltip />} />
              <ReferenceLine y={20} stroke="#22c55e" strokeDasharray="3 3" />
              <ReferenceLine y={35} stroke="#ef4444" strokeDasharray="3 3" />
              <Bar dataKey="burdenPct" name="Burden %">
                {burdenData.map((d, i) => (
                  <Cell key={i} fill={burdenColor(d.burdenPct)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* SECTION 5: Debt-Stripped Earnings & Lender Serviceability */}
      <div className="space-y-4 pt-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Debt-Stripped Earnings</h2>
          <p className="text-xs text-muted-foreground">What the business actually earns after all debt is removed — the lender's view</p>
        </div>

        {/* Row 1: Stat Pills */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Avg Monthly Net Free Cash (3m)", value: debtStripped.avg3, color: debtStripped.avg3 > 0 ? "#22c55e" : "#ef4444", fmt: fmtAUD },
            { label: "Avg Monthly Net Free Cash (6m)", value: debtStripped.avg6, color: debtStripped.avg6 > 0 ? "#22c55e" : "#ef4444", fmt: fmtAUD },
            { label: "Max New Monthly Repayment", value: debtStripped.maxNewRepayment, color: ragHex, fmt: fmtAUD },
            { label: "Est. Borrowing Capacity", value: debtStripped.borrowingCapacity60, color: ragHex, fmt: fmtK },
          ].map((p) => (
            <div key={p.label} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{p.label}</p>
              <p className="text-xl font-mono font-bold mt-1" style={{ color: p.color }}>{p.fmt(p.value)}</p>
            </div>
          ))}
        </div>

        {/* Row 2: Chart */}
        <div className="chart-container">
          <p className="text-sm font-medium text-foreground mb-0.5">Monthly Net Free Cash After All Debt</p>
          <p className="text-xs text-muted-foreground mb-3">Earned revenue minus operating costs minus all debt repayments</p>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={debtStripped.rows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={CHART_TICK} />
              <YAxis tick={CHART_TICK} tickFormatter={fmtKAxis} />
              <Tooltip content={<NetFreeTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <ReferenceLine y={0} stroke="#ffffff30" strokeDasharray="3 3" />
              <Bar dataKey="earnedRevenue" name="Earned Revenue" fill="#22c55e" fillOpacity={0.6} />
              <Bar dataKey="debtBurden" name="Debt Repayments" fill="#ef4444" fillOpacity={0.7} />
              <Bar dataKey="operatingCosts" name="Operating Costs" fill="#3b82f6" fillOpacity={0.6} />
              <Line
                type="monotone"
                dataKey="netFreeCash"
                name="Net Free Cash"
                stroke="#f59e0b"
                strokeWidth={2.5}
                dot={(props: any) => {
                  const { cx, cy, payload, index } = props;
                  const fill = payload.netFreeCash >= 0 ? "#f59e0b" : "#ef4444";
                  return <circle key={index} cx={cx} cy={cy} r={3} fill={fill} stroke={fill} />;
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Row 3: Lender Serviceability Panel */}
        <div>
          <p className="text-sm font-medium text-foreground mb-0.5">Lender Serviceability View</p>
          <p className="text-xs text-muted-foreground mb-3">How a bank or broker assesses your capacity for new debt</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Column 1 */}
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-foreground mb-2">Current Position</p>
              {[
                { l: "Existing monthly debt", v: fmtAUD(totalMonthlyRepayment) },
                { l: "Avg net free cash (6m)", v: fmtAUD(debtStripped.avg6) },
                { l: "Free cash after debt", v: fmtAUD(debtStripped.avg6) },
              ].map((r) => (
                <div key={r.l} className="flex justify-between">
                  <span className="text-xs text-muted-foreground">{r.l}</span>
                  <span className="text-xs font-mono font-semibold text-foreground">{r.v}</span>
                </div>
              ))}
            </div>

            {/* Column 2 */}
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-foreground mb-2">Lender Calculation</p>
              {[
                { l: "Usable income (80% buffer)", v: fmtAUD(debtStripped.avg6 * 0.8), c: "text-foreground" },
                { l: "Less existing commitments", v: fmtAUD(totalMonthlyRepayment), c: "text-foreground" },
                { l: "Available for new debt", v: fmtAUD(debtStripped.maxNewRepayment), c: "" },
              ].map((r) => (
                <div key={r.l} className="flex justify-between">
                  <span className="text-xs text-muted-foreground">{r.l}</span>
                  <span
                    className={`text-xs font-mono font-semibold ${r.c}`}
                    style={!r.c ? { color: ragHex } : undefined}
                  >
                    {r.v}
                  </span>
                </div>
              ))}
            </div>

            {/* Column 3 */}
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-foreground mb-2">Borrowing Capacity</p>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">At current serviceability</span>
                <span className="text-xs font-mono font-semibold" style={{ color: ragHex }}>{fmtAUD(debtStripped.borrowingCapacity60)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Assumes 60 month term</span>
                <span className="text-xs font-mono font-semibold text-foreground">—</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Assumes ~7% interest rate</span>
                <span className="text-xs font-mono font-semibold text-foreground">—</span>
              </div>
              <div className="flex items-start gap-2 pt-2 mt-2 border-t border-white/10">
                <span className="inline-block w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: ragHex }} />
                <p className="text-[11px] text-foreground/80 leading-snug">{verdictText(rag)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

  );
};

// ---------- Scorecard Detail Panel ----------

interface ScorecardDetailPanelProps {
  activeTile: string | null;
  onClose: () => void;
  metrics: { name: string; value: string; rag: "green" | "amber" | "red" | "none" }[];
  grossProfitYTD: number;
  annualInterestCost: number;
  totalMonthlyRepayment: number;
  totalDebt: number;
  revenueExGST: number;
  recentSurplus: number;
}

const Pill = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-white/5 rounded-lg px-3 py-2">
    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
    <p className="text-sm font-mono font-semibold text-foreground">{value}</p>
  </div>
);

const ScorecardDetailPanel = ({
  activeTile, onClose, metrics,
  grossProfitYTD, annualInterestCost, totalMonthlyRepayment,
  totalDebt, revenueExGST, recentSurplus,
}: ScorecardDetailPanelProps) => {
  const fmt = (n: number) => `$${(n || 0).toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;
  const annualRepay = totalMonthlyRepayment * 12;
  const metric = metrics.find((m) => m.name === activeTile);

  const interestCoverageValue = annualInterestCost > 0 ? grossProfitYTD / annualInterestCost : 0;
  const dscrValue = annualRepay > 0 ? grossProfitYTD / annualRepay : 0;
  const debtToRevenueValue = revenueExGST > 0 ? (totalDebt / revenueExGST) * 100 : 0;
  const debtToGpValue = grossProfitYTD > 0 ? (totalDebt / grossProfitYTD) * 100 : 0;
  const cashCoverValue = totalMonthlyRepayment > 0 ? recentSurplus / totalMonthlyRepayment : 0;
  const cashCoverYears = (cashCoverValue / 12).toFixed(1);
  const repaymentBurdenValue = grossProfitYTD > 0 ? (annualRepay / grossProfitYTD) * 100 : 0;

  const buildContent = () => {
    switch (activeTile) {
      case "Interest Coverage":
        return {
          title: "Interest Coverage Ratio — What It Means",
          formula: "Gross Profit YTD ÷ Annual Interest Cost",
          explanation: `We owe ${fmt(annualInterestCost)} in interest this year. Our gross profit is ${fmt(grossProfitYTD)} — that's ${interestCoverageValue.toFixed(1)}x the interest bill. Even if revenue fell heavily, we'd still cover the interest with GP to spare. Lenders want to see above 2.5x. We're at ${interestCoverageValue.toFixed(1)}x.`,
          pills: [
            { label: "GP YTD", value: fmt(grossProfitYTD) },
            { label: "Annual Interest", value: fmt(annualInterestCost) },
            { label: "Ratio", value: metric?.value || "--" },
          ],
          verdict: "✓ Strong. Interest is not a burden at current trading levels.",
          verdictColor: "text-chart-green",
        };
      case "Debt Service Coverage":
        return {
          title: "Debt Service Coverage Ratio (DSCR) — What It Means",
          formula: "Gross Profit YTD ÷ Total Annual Repayments",
          explanation: `Total repayments are ${fmt(totalMonthlyRepayment)}/month — ${fmt(annualRepay)}/year. Our GP is ${fmt(grossProfitYTD)}, which is ${dscrValue.toFixed(1)}x that annual repayment figure. Banks require 1.5x minimum to approve lending. Above 3x is strong. At ${dscrValue.toFixed(1)}x, we'd comfortably qualify for additional facilities.`,
          pills: [
            { label: "GP YTD", value: fmt(grossProfitYTD) },
            { label: "Annual Repayments", value: fmt(annualRepay) },
            { label: "Ratio", value: metric?.value || "--" },
          ],
          verdict: "✓ Strong. Would comfortably meet bank lending criteria for new facilities.",
          verdictColor: "text-chart-green",
        };
      case "Debt-to-Revenue":
        return {
          title: "Debt-to-Revenue — What It Means",
          formula: "Total Debt ÷ Revenue YTD (ex GST) × 100",
          explanation: `We have ${fmt(totalDebt)} in total debt against ${fmt(revenueExGST)} in revenue (ex GST). That's ${debtToRevenueValue.toFixed(0)}c of debt for every $1 earned. The 40% benchmark suits stable businesses — contracting businesses carrying equipment and working capital loans typically run 50–80%. Our ${debtToRevenueValue.toFixed(0)}% sits within that normal range.`,
          pills: [
            { label: "Total Debt", value: fmt(totalDebt) },
            { label: "Revenue ex GST", value: fmt(revenueExGST) },
            { label: "Ratio", value: metric?.value || "--" },
          ],
          verdict: "⚠ Above the conservative benchmark but appropriate for our business type and growth stage.",
          verdictColor: "text-yellow-500",
        };
      case "Debt-to-Gross-Profit":
        return {
          title: "Debt-to-Gross-Profit — What It Means",
          formula: "Total Debt ÷ Gross Profit YTD × 100",
          explanation: `Total debt is ${fmt(totalDebt)}. Annual gross profit is ${fmt(grossProfitYTD)}. If we used every dollar of GP solely to repay debt, it would take ${(debtToGpValue / 100).toFixed(1)} years to clear it entirely. The target is under 0.75 years. We're at ${(debtToGpValue / 100).toFixed(1)} years — improving as GP grows.`,
          pills: [
            { label: "Total Debt", value: fmt(totalDebt) },
            { label: "GP YTD", value: fmt(grossProfitYTD) },
            { label: "Ratio", value: metric?.value || "--" },
          ],
          verdict: "⚠ Slightly above benchmark. Will improve naturally as gross profit grows.",
          verdictColor: "text-yellow-500",
        };
      case "Cash Cover":
        return {
          title: "Cash Cover — What It Means",
          formula: "Current Month Anticipated Surplus ÷ Monthly Repayments",
          explanation: `This month's surplus covers ${cashCoverValue.toFixed(1)} months (${cashCoverYears} years) of loan repayments. With ${fmt(totalMonthlyRepayment)} due monthly, the business is generating well above what's needed to stay current. The minimum safe zone is 3 months cover. We're at ${cashCoverValue.toFixed(1)} months.`,
          pills: [
            { label: "Current Surplus", value: fmt(recentSurplus) },
            { label: "Monthly Repayments", value: fmt(totalMonthlyRepayment) },
            { label: "Months Cover", value: metric?.value || "--" },
          ],
          verdict: "✓ Exceptional. The business has a very strong cash buffer above its debt commitments.",
          verdictColor: "text-chart-green",
        };
      case "Repayment Burden":
        return {
          title: "Repayment Burden — What It Means",
          formula: "(Monthly Repayments × 12) ÷ Gross Profit YTD × 100",
          explanation: `Out of ${fmt(grossProfitYTD)} in gross profit, ${fmt(annualRepay)} goes to loan repayments — that's ${repaymentBurdenValue.toFixed(0)}c from every $1 of GP. The safe zone is under 20c. We're at ${repaymentBurdenValue.toFixed(0)}c — just above. Taking on additional debt without growing GP would push this higher.`,
          pills: [
            { label: "Annual Repayments", value: fmt(annualRepay) },
            { label: "GP YTD", value: fmt(grossProfitYTD) },
            { label: "Burden %", value: metric?.value || "--" },
          ],
          verdict: "⚠ Just above the 20% safe zone. Monitor before adding new debt facilities.",
          verdictColor: "text-yellow-500",
        };
      default:
        return null;
    }
  };

  const content = buildContent();

  return (
    <div
      className={`transition-all duration-300 overflow-hidden ${activeTile && content ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}`}
    >
      {content && (
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 mt-3 relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1 rounded hover:bg-white/10 text-muted-foreground"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
          <p className="text-sm font-semibold text-foreground mb-1 pr-8">{content.title}</p>
          <p className="font-mono text-xs bg-white/5 px-3 py-1.5 rounded inline-block mb-3 text-chart-green">
            {content.formula}
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">{content.explanation}</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {content.pills.map((p) => <Pill key={p.label} label={p.label} value={p.value} />)}
          </div>
          <p className={`text-sm font-medium ${content.verdictColor}`}>{content.verdict}</p>
        </div>
      )}
    </div>
  );
};

export default FinancialHealth;

