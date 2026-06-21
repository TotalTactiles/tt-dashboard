import { useState, useMemo, useEffect, useRef } from "react";
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

const STORAGE_KEY = "tt_debt_register";
const TYPE_OPTIONS: DebtType[] = ["Term Loan", "Asset Finance", "Credit Card", "Director Loan", "Other"];
const PURPOSE_OPTIONS: DebtPurpose[] = ["Vehicle", "Equipment", "Working Capital", "Property", "Other"];

const defaults: DebtFacility[] = [
  { id: "default-1", name: "Car Finance", lender: "", type: "Asset Finance", originalPrincipal: 0, balance: 0, rate: 0, monthlyRepayment: 0, startDate: "", maturityDate: "", purpose: "Vehicle" },
  { id: "default-2", name: "Business Loan", lender: "", type: "Term Loan", originalPrincipal: 0, balance: 0, rate: 0, monthlyRepayment: 0, startDate: "", maturityDate: "", purpose: "Working Capital" },
];

const fmtCurrency = (n: number) => `$${(n || 0).toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;

const FinancialHealth = () => {
  const { incomeOutgoingsData, forecastChartData, liveData } = useDashboardData() as any;

  const [debts, setDebts] = useState<DebtFacility[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return defaults;
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DebtFacility | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [activeTile, setActiveTile] = useState<string | null>(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(debts)); } catch {}
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
  interface Metric { name: string; value: string; benchmark: string; rag: RAG; }

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
      },
      {
        name: "Debt Service Coverage",
        value: isFinite(dscr) ? `${dscr.toFixed(1)}x` : "∞",
        benchmark: "Benchmark: ≥ 1.5x",
        rag: !isFinite(dscr) ? "green" : ragFromThresholds(dscr, 1.5, 1.0),
      },
      {
        name: "Debt-to-Revenue",
        value: `${dToRev.toFixed(0)}%`,
        benchmark: "Benchmark: < 40%",
        rag: ragFromThresholds(dToRev, 40, 65, true),
      },
      {
        name: "Debt-to-Gross-Profit",
        value: `${dToGP.toFixed(0)}%`,
        benchmark: "Benchmark: < 75%",
        rag: ragFromThresholds(dToGP, 75, 150, true),
      },
      {
        name: "Cash Cover",
        value: `${cashCover.toFixed(1)} months`,
        benchmark: "Benchmark: ≥ 3 months",
        rag: ragFromThresholds(cashCover, 3, 1.5),
      },
      {
        name: "Repayment Burden",
        value: `${burden.toFixed(0)}% of GP`,
        benchmark: "Benchmark: < 20% of GP",
        rag: ragFromThresholds(burden, 20, 35, true),
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
            {metrics.map((m) => (
              <div key={m.name} className={`chart-container relative border ${ragBorder(m.rag)}`}>
                <div className="absolute top-3 right-3">{ragDot(m.rag)}</div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{m.name}</p>
                <div className="flex items-center justify-center py-3">
                  <span className="text-3xl font-bold text-foreground font-mono">{m.value}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">{m.benchmark}</p>
                {m.rag === "none" && <p className="text-[10px] text-muted-foreground mt-0.5">No data</p>}
              </div>
            ))}
          </div>
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

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Debt vs Business Performance</h2>
        <p className="text-xs text-muted-foreground">Live cashflow data overlaid with debt obligations</p>
      </div>

      {/* Chart 1: Revenue Waterfall */}
      <div className="chart-container">
        <p className="text-sm font-medium text-foreground mb-0.5">Revenue → Gross Profit → Net After Debt</p>
        <p className="text-xs text-muted-foreground mb-4">Monthly view of what survives after COGS, OpEx and debt repayments</p>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={waterfallData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={CHART_TICK} />
            <YAxis tick={CHART_TICK} tickFormatter={fmtKAxis} />
            <Tooltip content={<WaterfallTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
            <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
            <Bar dataKey="revenue" name="Revenue" fill="#22c55e" fillOpacity={0.7} />
            <Bar dataKey="grossProfit" name="Gross Profit" fill="#3b82f6" fillOpacity={0.7} />
            <Line type="monotone" dataKey="netAfterDebt" name="Net After Debt" stroke="#f59e0b" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Cash Cover Runway */}
      <div className="chart-container">
        <p className="text-sm font-medium text-foreground mb-0.5">Cash Cover Runway</p>
        <p className="text-xs text-muted-foreground mb-4">Months of debt repayments covered by anticipated monthly surplus</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={runwayData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={CHART_TICK} />
            <YAxis tick={CHART_TICK} domain={[-2, 12]} label={{ value: "Months Cover", angle: -90, position: "insideLeft", fill: "#6b7280", fontSize: 11 }} />
            <Tooltip content={<RunwayTooltip />} />
            <ReferenceLine y={3} stroke="#22c55e" strokeDasharray="3 3" label={{ value: "Safe Zone", fill: "#22c55e", fontSize: 10, position: "insideTopRight" }} />
            <ReferenceLine y={1.5} stroke="#eab308" strokeDasharray="3 3" label={{ value: "Caution", fill: "#eab308", fontSize: 10, position: "insideTopRight" }} />
            <Bar dataKey="coverMonths" name="Months Cover">
              {runwayData.map((d, i) => (
                <Cell key={i} fill={runwayColor(d.coverMonths)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

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
    </div>
  );
};

export default FinancialHealth;
