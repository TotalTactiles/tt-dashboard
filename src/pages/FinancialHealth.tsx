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

// ---------- Debt Register Row (memoised to isolate keystroke re-renders) ----------
interface DebtRegisterRowProps {
  facility: DebtFacility;
  isDragOver: boolean;
  autoEdit: boolean;
  onSave: (updated: DebtFacility) => void;
  onDelete: (id: string) => void;
  onAutoEditConsumed: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}

const DebtRegisterRow = memo(({
  facility, isDragOver, autoEdit,
  onSave, onDelete, onAutoEditConsumed,
  onDragStart, onDragOver, onDrop, onDragEnd,
}: DebtRegisterRowProps) => {
  const [isEditing, setIsEditing] = useState<boolean>(autoEdit);
  const [editData, setEditData] = useState<DebtFacility>(facility);

  useEffect(() => {
    if (autoEdit) {
      setIsEditing(true);
      setEditData(facility);
      onAutoEditConsumed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEdit]);

  useEffect(() => {
    if (!isEditing) setEditData(facility);
  }, [facility, isEditing]);

  const handleSave = () => { onSave(editData); setIsEditing(false); };
  const handleCancel = () => { setEditData(facility); setIsEditing(false); };
  const update = <K extends keyof DebtFacility>(k: K, v: DebtFacility[K]) =>
    setEditData(prev => ({ ...prev, [k]: v }));

  const row = isEditing ? editData : facility;

  return (
    <tr
      draggable={true}
      onDragStart={onDragStart}
      onDragOver={(e) => { e.preventDefault(); onDragOver(e); }}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`border-b border-border/40 hover:bg-muted/20 ${isDragOver ? "opacity-50" : ""}`}
    >
      <td className="py-1.5 px-2 w-8 shrink-0 whitespace-nowrap">
        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
      </td>
      <td className="py-1.5 px-2 text-left whitespace-nowrap">
        {isEditing ? (
          <Input value={row.name} onChange={(e) => update("name", e.target.value)} className="h-7 text-xs" />
        ) : row.name}
      </td>
      <td className="py-1.5 px-2 text-left whitespace-nowrap">
        {isEditing ? (
          <Input value={row.lender} onChange={(e) => update("lender", e.target.value)} className="h-7 text-xs" />
        ) : row.lender || "—"}
      </td>
      <td className="py-1.5 px-2 text-left whitespace-nowrap">
        {isEditing ? (
          <Select value={row.type} onValueChange={(v) => update("type", v as DebtType)}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : row.type}
      </td>
      <td className="py-1.5 px-2 text-right whitespace-nowrap">
        {isEditing ? (
          <Input type="number" value={row.originalPrincipal} onChange={(e) => update("originalPrincipal", Number(e.target.value))} className="h-7 text-xs text-right" />
        ) : fmtCurrency(row.originalPrincipal)}
      </td>
      <td className="py-1.5 px-2 text-right whitespace-nowrap">
        {isEditing ? (
          <Input type="number" value={row.balance} onChange={(e) => update("balance", Number(e.target.value))} className="h-7 text-xs text-right" />
        ) : fmtCurrency(row.balance)}
      </td>
      <td className="py-1.5 px-2 text-right whitespace-nowrap">
        {isEditing ? (
          <Input type="number" step="0.01" value={row.rate} onChange={(e) => update("rate", Number(e.target.value))} className="h-7 text-xs text-right" />
        ) : `${(row.rate || 0).toFixed(2)}%`}
      </td>
      <td className="py-1.5 px-2 text-right whitespace-nowrap">
        {isEditing ? (
          <Input type="number" value={row.monthlyRepayment} onChange={(e) => update("monthlyRepayment", Number(e.target.value))} className="h-7 text-xs text-right" />
        ) : fmtCurrency(row.monthlyRepayment)}
      </td>
      <td className="py-1.5 px-2 text-left whitespace-nowrap">
        {isEditing ? (
          <Input type="date" value={row.startDate} onChange={(e) => update("startDate", e.target.value)} className="h-7 text-xs" />
        ) : row.startDate || "—"}
      </td>
      <td className="py-1.5 px-2 text-left whitespace-nowrap">
        {isEditing ? (
          <Input type="date" value={row.maturityDate} onChange={(e) => update("maturityDate", e.target.value)} className="h-7 text-xs" />
        ) : row.maturityDate || "—"}
      </td>
      <td className="py-1.5 px-2 text-left whitespace-nowrap">
        {isEditing ? (
          <Select value={row.purpose} onValueChange={(v) => update("purpose", v as DebtPurpose)}>
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
              <button onClick={handleSave} className="p-1 rounded hover:bg-chart-green/20 text-chart-green" aria-label="Save">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button onClick={handleCancel} className="p-1 rounded hover:bg-muted text-muted-foreground" aria-label="Cancel">
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <button onClick={() => setIsEditing(true)} className="p-1 rounded hover:bg-muted text-muted-foreground" aria-label="Edit">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={() => onDelete(facility.id)} className="p-1 rounded hover:bg-red-500/20 text-red-400" aria-label="Delete">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
});
DebtRegisterRow.displayName = "DebtRegisterRow";


const FinancialHealth = () => {
  const { incomeOutgoingsData, forecastChartData, liveData } = useDashboardData() as any;

  const [debts, setDebts] = useState<DebtFacility[]>(defaults);

  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [autoEditId, setAutoEditId] = useState<string | null>(null);
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

  const handleRowSave = (updated: DebtFacility) => {
    setDebts((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  };
  const deleteRow = (id: string) => {
    setDebts((prev) => prev.filter((d) => d.id !== id));
  };
  const addFacility = () => {
    const id = `f-${Date.now()}`;
    const fresh: DebtFacility = { id, name: "New Facility", lender: "", type: "Term Loan", originalPrincipal: 0, balance: 0, rate: 0, monthlyRepayment: 0, startDate: "", maturityDate: "", purpose: "Working Capital" };
    setDebts((prev) => [...prev, fresh]);
    setAutoEditId(id);
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
                {debts.map((d, index) => (
                  <DebtRegisterRow
                    key={d.id}
                    facility={d}
                    isDragOver={dragOverIndex === index}
                    autoEdit={autoEditId === d.id}
                    onAutoEditConsumed={() => setAutoEditId(null)}
                    onSave={handleRowSave}
                    onDelete={deleteRow}
                    onDragStart={() => { dragIndexRef.current = index; }}
                    onDragOver={() => { setDragOverIndex(index); }}
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
                  />
                ))}

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
      const totalCosts = Math.abs(Number(row?.outgoings) || 0);
      const operatingCosts = Math.max(0, totalCosts - debtDrawdown);
      return { month, earnedRevenue, debtDrawdown, operatingCosts, netEarned: earnedRevenue - debtDrawdown };
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

  const [earnedPeriod, setEarnedPeriod] = useState<"Q1"|"Q2"|"Q3"|"Q4"|"All">("All");
  const [earnedMonth, setEarnedMonth] = useState<string>("");
  const quarterMonths: Record<string, string[]> = {
    Q1: ["Jan-26","Feb-26","Mar-26"],
    Q2: ["Apr-26","May-26","Jun-26"],
    Q3: ["Jul-26","Aug-26","Sep-26"],
    Q4: ["Oct-26","Nov-26","Dec-26"],
    All: [],
  };
  const filteredEarnedData = useMemo(() => {
    if (earnedMonth) return earnedVsDebtData.rows.filter((d: any) => d.month === earnedMonth);
    if (earnedPeriod === "All") return earnedVsDebtData.rows;
    return earnedVsDebtData.rows.filter((d: any) => quarterMonths[earnedPeriod].includes(d.month));
  }, [earnedPeriod, earnedMonth, earnedVsDebtData]);

  const periodFigures = useMemo(() => {
    const periodRevenue = filteredEarnedData.reduce((s: number, d: any) => s + (d.earnedRevenue || 0), 0);
    const periodDebtRepayments = filteredEarnedData.reduce((s: number, d: any) => s + (d.debtDrawdown || 0), 0);
    const periodOutgoings = filteredEarnedData.reduce((s: number, d: any) => s + (d.operatingCosts || 0), 0);
    const totalBorrowedToDate = debts.reduce((s, f) => s + (Number(f.originalPrincipal) || 0), 0);
    const totalStillOwed = debts.reduce((s, f) => s + (Number(f.balance) || 0), 0);
    const totalRepaidToDate = Math.max(0, totalBorrowedToDate - totalStillOwed);
    const netPosition = periodRevenue - periodOutgoings - periodDebtRepayments;
    return { periodRevenue, periodDebtRepayments, periodOutgoings, totalBorrowedToDate, totalRepaidToDate, totalStillOwed, netPosition };
  }, [filteredEarnedData, debts]);

  const periodLabel = (() => {
    if (earnedMonth) return earnedMonth;
    if (earnedPeriod === "All") return "Full Year 2026";
    const labels: Record<string, string> = {
      Q1: "Q1 2026 · Jan–Mar",
      Q2: "Q2 2026 · Apr–Jun",
      Q3: "Q3 2026 · Jul–Sep",
      Q4: "Q4 2026 · Oct–Dec",
    };
    return labels[earnedPeriod] ?? "";
  })();

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

    // ---- Serviceability metrics from anticipatedSurplus (cashflow) ----
    const parseSurplus = (v: any) => {
      if (v === null || v === undefined || v === "") return 0;
      return parseFloat(String(v).replace(/[$,]/g, "")) || 0;
    };
    const surplusMonths = (Array.isArray(forecastChartData) ? forecastChartData : [])
      .filter((d: any) => d?.anticipatedSurplus != null && parseSurplus(d.anticipatedSurplus) !== 0)
      .map((d: any) => ({ month: String(d.month ?? ""), surplus: parseSurplus(d.anticipatedSurplus) }));
    const monthOrder = io.map((d: any) => String(d?.month ?? ""));
    const sortedSurplus = [...surplusMonths].sort(
      (a, b) => monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month)
    );
    const currentIdx = monthOrder.indexOf("Jun-26");
    const pastMonths = sortedSurplus.filter(
      (d) => currentIdx < 0 || monthOrder.indexOf(d.month) <= currentIdx
    );
    const avgOf = (arr: { surplus: number }[]) =>
      arr.length > 0 ? arr.reduce((s, d) => s + d.surplus, 0) / arr.length : 0;
    const avg3 = avgOf(pastMonths.slice(-3));
    const avg6 = avgOf(pastMonths.slice(-6));
    const avg12 = avgOf(pastMonths.slice(-12));

    const lenderUsableIncome = avg6 * 0.80;
    const maxNewRepayment = Math.max(0, lenderUsableIncome - totalMonthlyRepayment);
    const monthlyRate = 0.07 / 12;
    const borrowingCapacity60 =
      maxNewRepayment > 0
        ? maxNewRepayment * ((1 - Math.pow(1 + monthlyRate, -60)) / monthlyRate)
        : 0;

    return { rows, avg3, avg6, avg12, lenderUsableIncome, maxNewRepayment, borrowingCapacity60 };
  }, [io, liveData, forecastChartData, totalMonthlyRepayment]);


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

  // ---- Debt-Stripped panel filters (chart + Financial Position) ----
  const [strippedPeriod, setStrippedPeriod] = useState<"All"|"Q1"|"Q2"|"Q3"|"Q4">("All");
  const [strippedMonth, setStrippedMonth] = useState<string>("");
  const strippedMonthsFilter = useMemo<string[] | null>(() => {
    if (strippedMonth) return [strippedMonth];
    if (strippedPeriod === "All") return null;
    return quarterMonths[strippedPeriod] ?? null;
  }, [strippedPeriod, strippedMonth]);
  const filteredStrippedRows = useMemo(() => {
    if (!strippedMonthsFilter) return debtStripped.rows;
    return debtStripped.rows.filter((r: any) => strippedMonthsFilter.includes(r.month));
  }, [debtStripped, strippedMonthsFilter]);
  const strippedFinancialFigures = useMemo(() => {
    const rows = !strippedMonthsFilter
      ? earnedVsDebtData.rows
      : earnedVsDebtData.rows.filter((d: any) => strippedMonthsFilter.includes(d.month));
    const periodRevenue = rows.reduce((s: number, d: any) => s + (d.earnedRevenue || 0), 0);
    const periodDebtRepayments = rows.reduce((s: number, d: any) => s + (d.debtDrawdown || 0), 0);
    const periodOutgoings = rows.reduce((s: number, d: any) => s + (d.operatingCosts || 0), 0);
    const totalBorrowedToDate = debts.reduce((s, f) => s + (Number(f.originalPrincipal) || 0), 0);
    const totalStillOwed = debts.reduce((s, f) => s + (Number(f.balance) || 0), 0);
    const totalRepaidToDate = Math.max(0, totalBorrowedToDate - totalStillOwed);
    const netPosition = periodRevenue - periodOutgoings - periodDebtRepayments;
    return { periodRevenue, periodDebtRepayments, periodOutgoings, totalBorrowedToDate, totalRepaidToDate, totalStillOwed, netPosition };
  }, [strippedMonthsFilter, earnedVsDebtData, debts]);
  const strippedPeriodLabel = (() => {
    if (strippedMonth) return strippedMonth;
    if (strippedPeriod === "All") return "Full Year 2026";
    const labels: Record<string, string> = {
      Q1: "Q1 2026 · Jan–Mar",
      Q2: "Q2 2026 · Apr–Jun",
      Q3: "Q3 2026 · Jul–Sep",
      Q4: "Q4 2026 · Oct–Dec",
    };
    return labels[strippedPeriod] ?? "";
  })();


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
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                {(["All","Q1","Q2","Q3","Q4"] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => { setEarnedPeriod(p); setEarnedMonth(""); }}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition-all
                      ${earnedPeriod === p && !earnedMonth
                        ? "bg-chart-green text-black"
                        : "bg-white/5 text-muted-foreground hover:bg-white/10"}`}
                  >{p}</button>
                ))}
              </div>
            </div>
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
              <ComposedChart data={filteredEarnedData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
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


      {/* Debt-Stripped Earnings & Lender Serviceability */}
      <div className="space-y-4 pt-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Debt-Stripped Earnings</h2>
          <p className="text-xs text-muted-foreground">What the business actually earns after all debt is removed — the lender's view</p>
        </div>

        {/* Unified card: pills + filters + chart + Financial Position */}
        <div className="chart-container mt-4">
          {/* TOP ROW — 4 stat pills inline */}
          <div className="flex flex-wrap gap-3 mb-5">
            {[
              { label: "Avg Net Free Cash (3m)", value: debtStripped.avg3, colorStyle: undefined as string | undefined, colorClass: debtStripped.avg3 >= 0 ? "text-chart-green" : "text-red-400", fmt: fmtAUD },
              { label: "Avg Net Free Cash (6m)", value: debtStripped.avg6, colorStyle: undefined as string | undefined, colorClass: debtStripped.avg6 >= 0 ? "text-chart-green" : "text-red-400", fmt: fmtAUD },
              { label: "Max New Monthly Repayment", value: debtStripped.maxNewRepayment, colorStyle: ragHex, colorClass: "", fmt: fmtAUD },
              { label: "Est. Borrowing Capacity", value: debtStripped.borrowingCapacity60, colorStyle: undefined as string | undefined, colorClass: "text-chart-green", fmt: fmtK },
            ].map(pill => (
              <div key={pill.label} className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 flex-1 min-w-[180px]">
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono mb-1">{pill.label}</p>
                <p className={`text-lg font-mono font-bold ${pill.colorClass}`} style={pill.colorStyle ? { color: pill.colorStyle } : undefined}>{pill.fmt(pill.value)}</p>
              </div>
            ))}
          </div>

          {/* MAIN ROW — left column (filter + chart + lender) | right column (Financial Position) */}
          <div className="flex flex-col lg:flex-row gap-5 mt-4">
            {/* LEFT COLUMN */}
            <div className="flex-1 min-w-0 flex flex-col gap-4">
              {/* Filter row */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  {(["All","Q1","Q2","Q3","Q4"] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => { setStrippedPeriod(p); setStrippedMonth(""); }}
                      className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition-all
                        ${strippedPeriod === p && !strippedMonth
                          ? "bg-chart-green text-black"
                          : "bg-white/5 text-muted-foreground hover:bg-white/10"}`}
                    >{p}</button>
                  ))}
                </div>
                <select
                  value={strippedMonth}
                  onChange={e => { setStrippedMonth(e.target.value); if (e.target.value) setStrippedPeriod("All"); }}
                  className={`bg-white/5 border rounded-lg px-3 py-1 text-xs font-mono focus:outline-none cursor-pointer transition-all
                    ${strippedMonth ? "border-chart-green/50 text-chart-green" : "border-white/10 text-muted-foreground"}`}
                >
                  <option value="" className="bg-[#0f172a] text-muted-foreground">Month ▾</option>
                  {debtStripped.rows.map((d: any) => (
                    <option key={d.month} value={d.month} className="bg-[#0f172a] text-foreground">{d.month}</option>
                  ))}
                </select>
              </div>

              {/* Chart */}
              <div>
                <p className="text-xs font-medium text-foreground mb-0.5">Monthly Net Free Cash After All Debt</p>
                <p className="text-[10px] text-muted-foreground mb-3">Earned revenue minus operating costs minus all debt repayments</p>
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={filteredStrippedRows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
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

              {/* Lender Serviceability — fills remaining space below chart */}
              <div className="border-t border-white/10 pt-4">
                <p className="text-xs font-semibold text-foreground mb-0.5">Lender Serviceability View</p>
                <p className="text-[10px] text-muted-foreground mb-3">How a bank or broker assesses your capacity for new debt</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Lender Calculation */}
                  <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                    <p className="text-xs font-semibold text-foreground mb-3">Lender Calculation</p>
                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                      <span className="text-xs text-muted-foreground">Usable income (80% buffer)</span>
                      <span className="text-xs font-mono font-semibold text-foreground">{fmtAUD(debtStripped.lenderUsableIncome)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                      <span className="text-xs text-muted-foreground">Less existing commitments</span>
                      <span className="text-xs font-mono font-semibold text-foreground">{fmtAUD(totalMonthlyRepayment)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 pb-1 mt-1"
                      style={{ borderTop: "2px solid rgba(255,255,255,0.15)", borderBottom: "3px double rgba(255,255,255,0.15)" }}>
                      <span className="text-xs font-semibold text-foreground">Available for new debt</span>
                      <span className={`text-sm font-mono font-bold ${debtStripped.maxNewRepayment > 2000 ? "text-emerald-400" : debtStripped.maxNewRepayment > 500 ? "text-amber-400" : "text-red-400"}`}>
                        {fmtAUD(debtStripped.maxNewRepayment)}
                      </span>
                    </div>
                  </div>

                  {/* Borrowing Capacity */}
                  <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                    <p className="text-xs font-semibold text-foreground mb-3">Borrowing Capacity</p>
                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                      <span className="text-xs text-muted-foreground">At current serviceability</span>
                      <span className="text-sm font-mono font-bold text-emerald-400">{fmtAUD(debtStripped.borrowingCapacity60)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                      <span className="text-xs text-muted-foreground">Assumes 60 month term</span>
                      <span className="text-xs font-mono text-muted-foreground">—</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                      <span className="text-xs text-muted-foreground">Assumes ~7% interest rate</span>
                      <span className="text-xs font-mono text-muted-foreground">—</span>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${debtStripped.maxNewRepayment > 2000 ? "bg-emerald-400" : debtStripped.maxNewRepayment > 500 ? "bg-amber-400" : "bg-red-400"}`} />
                      <p className={`text-xs font-medium ${debtStripped.maxNewRepayment > 2000 ? "text-emerald-400" : debtStripped.maxNewRepayment > 500 ? "text-amber-400" : "text-red-400"}`}>
                        {debtStripped.maxNewRepayment > 2000
                          ? "Serviceability is strong. You could likely support a new facility."
                          : debtStripped.maxNewRepayment > 500
                          ? "Marginal serviceability. A lender may require additional security."
                          : "Insufficient net free cash. Strengthen earnings before applying."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* VERTICAL DIVIDER */}
            <div className="hidden lg:block w-px bg-white/10 self-stretch" />

            {/* RIGHT COLUMN — Financial Position */}
            <div className="lg:w-[380px] shrink-0 flex flex-col">
              <div className="mb-4">
                <p className="text-sm font-semibold text-foreground">Financial Position</p>
                <p className="text-[9px] text-muted-foreground/60 font-mono uppercase tracking-wider mt-0.5">Viewing</p>
                <p className="text-xs text-muted-foreground font-mono">{strippedPeriodLabel}</p>
              </div>

              {/* INCOME */}
              <div className="flex items-center gap-2 mb-1">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-[9px] uppercase tracking-[0.15em] font-mono font-semibold text-emerald-400/80">Income</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-xs text-muted-foreground">Total Revenue Earned</span>
                <span className="text-sm font-mono font-semibold text-emerald-400">{fmtAUD(strippedFinancialFigures.periodRevenue)}</span>
              </div>

              {/* EXPENDITURE */}
              <div className="flex items-center gap-2 mt-3 mb-1">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-[9px] uppercase tracking-[0.15em] font-mono font-semibold text-red-400/80">Expenditure</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-xs text-muted-foreground">Operating Costs</span>
                <span className="text-sm font-mono font-semibold text-red-400">{fmtAUD(strippedFinancialFigures.periodOutgoings)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-xs text-muted-foreground">Debt Repayments</span>
                <span className="text-sm font-mono font-semibold text-red-400">{fmtAUD(strippedFinancialFigures.periodDebtRepayments)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 pb-1 mt-1"
                style={{ borderTop: "2px solid rgba(255,255,255,0.15)", borderBottom: "3px double rgba(255,255,255,0.15)" }}>
                <span className="text-xs font-semibold text-foreground">Total Expenditure</span>
                <span className="text-sm font-mono font-bold text-red-400">{fmtAUD(strippedFinancialFigures.periodOutgoings + strippedFinancialFigures.periodDebtRepayments)}</span>
              </div>

              {/* NET POSITION */}
              <div className="flex items-center gap-2 mt-3 mb-1">
                <div className="h-px flex-1 bg-white/10" />
                <span className={`text-[9px] uppercase tracking-[0.15em] font-mono font-semibold ${strippedFinancialFigures.netPosition >= 0 ? "text-amber-400/80" : "text-red-400/80"}`}>Net Position</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>
              <div className="flex justify-between items-center py-3 mt-1"
                style={{ borderTop: "2px solid rgba(255,255,255,0.2)", borderBottom: "3px double rgba(255,255,255,0.25)" }}>
                <span className="text-sm font-semibold text-foreground">Net After All Costs & Debt</span>
                <span className={`text-xl font-mono font-bold ${strippedFinancialFigures.netPosition >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {strippedFinancialFigures.netPosition < 0 ? "-" : ""}{fmtAUD(Math.abs(strippedFinancialFigures.netPosition))}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground italic mt-1.5 mb-3">
                {strippedFinancialFigures.netPosition >= 0
                  ? `↑ ${fmtAUD(strippedFinancialFigures.netPosition)} generated after all costs and debt this period`
                  : `↓ Costs exceeded revenue by ${fmtAUD(Math.abs(strippedFinancialFigures.netPosition))} this period`}
              </p>

              {/* DEBT POSITION ALL TIME */}
              <div className="flex items-center gap-2 mb-1">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-[9px] uppercase tracking-[0.15em] font-mono font-semibold text-muted-foreground/60">Debt Position — All Time</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-xs text-muted-foreground">Total Facilities Drawn</span>
                <span className="text-sm font-mono font-semibold text-foreground">{fmtAUD(strippedFinancialFigures.totalBorrowedToDate)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-xs text-muted-foreground">Principal Repaid to Date</span>
                <span className="text-sm font-mono font-semibold text-emerald-400">{fmtAUD(strippedFinancialFigures.totalRepaidToDate)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 pb-1 mt-1"
                style={{ borderTop: "2px solid rgba(255,255,255,0.15)", borderBottom: "3px double rgba(255,255,255,0.15)" }}>
                <span className="text-xs font-semibold text-foreground">Still Outstanding</span>
                <span className="text-sm font-mono font-bold text-red-400">{fmtAUD(strippedFinancialFigures.totalStillOwed)}</span>
              </div>
            </div>
          </div>
        </div>

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

