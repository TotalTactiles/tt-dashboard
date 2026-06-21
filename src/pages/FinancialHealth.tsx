import { useState, useMemo, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Check, X, Trash2 } from "lucide-react";
import { useDashboardData } from "@/contexts/DashboardDataContext";

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

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 px-2 font-medium">Facility</th>
                  <th className="py-2 px-2 font-medium">Lender</th>
                  <th className="py-2 px-2 font-medium">Type</th>
                  <th className="py-2 px-2 font-medium text-right">Original</th>
                  <th className="py-2 px-2 font-medium text-right">Balance</th>
                  <th className="py-2 px-2 font-medium text-right">Rate %</th>
                  <th className="py-2 px-2 font-medium text-right">Monthly</th>
                  <th className="py-2 px-2 font-medium">Start</th>
                  <th className="py-2 px-2 font-medium">Maturity</th>
                  <th className="py-2 px-2 font-medium">Purpose</th>
                  <th className="py-2 px-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {debts.map((d) => {
                  const isEditing = editingId === d.id && draft;
                  const row = isEditing ? (draft as DebtFacility) : d;
                  return (
                    <tr key={d.id} className="border-b border-border/40 hover:bg-muted/20">
                      <td className="py-1.5 px-2">
                        {isEditing ? (
                          <Input value={row.name} onChange={(e) => updateDraft("name", e.target.value)} className="h-7 text-xs" />
                        ) : row.name}
                      </td>
                      <td className="py-1.5 px-2">
                        {isEditing ? (
                          <Input value={row.lender} onChange={(e) => updateDraft("lender", e.target.value)} className="h-7 text-xs" />
                        ) : row.lender || "—"}
                      </td>
                      <td className="py-1.5 px-2">
                        {isEditing ? (
                          <Select value={row.type} onValueChange={(v) => updateDraft("type", v as DebtType)}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {TYPE_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : row.type}
                      </td>
                      <td className="py-1.5 px-2 text-right">
                        {isEditing ? (
                          <Input type="number" value={row.originalPrincipal} onChange={(e) => updateDraft("originalPrincipal", Number(e.target.value))} className="h-7 text-xs text-right" />
                        ) : fmtCurrency(row.originalPrincipal)}
                      </td>
                      <td className="py-1.5 px-2 text-right">
                        {isEditing ? (
                          <Input type="number" value={row.balance} onChange={(e) => updateDraft("balance", Number(e.target.value))} className="h-7 text-xs text-right" />
                        ) : fmtCurrency(row.balance)}
                      </td>
                      <td className="py-1.5 px-2 text-right">
                        {isEditing ? (
                          <Input type="number" step="0.01" value={row.rate} onChange={(e) => updateDraft("rate", Number(e.target.value))} className="h-7 text-xs text-right" />
                        ) : `${(row.rate || 0).toFixed(2)}%`}
                      </td>
                      <td className="py-1.5 px-2 text-right">
                        {isEditing ? (
                          <Input type="number" value={row.monthlyRepayment} onChange={(e) => updateDraft("monthlyRepayment", Number(e.target.value))} className="h-7 text-xs text-right" />
                        ) : fmtCurrency(row.monthlyRepayment)}
                      </td>
                      <td className="py-1.5 px-2">
                        {isEditing ? (
                          <Input type="date" value={row.startDate} onChange={(e) => updateDraft("startDate", e.target.value)} className="h-7 text-xs" />
                        ) : row.startDate || "—"}
                      </td>
                      <td className="py-1.5 px-2">
                        {isEditing ? (
                          <Input type="date" value={row.maturityDate} onChange={(e) => updateDraft("maturityDate", e.target.value)} className="h-7 text-xs" />
                        ) : row.maturityDate || "—"}
                      </td>
                      <td className="py-1.5 px-2">
                        {isEditing ? (
                          <Select value={row.purpose} onValueChange={(v) => updateDraft("purpose", v as DebtPurpose)}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {PURPOSE_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : row.purpose}
                      </td>
                      <td className="py-1.5 px-2">
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
                  <tr><td colSpan={11} className="py-6 text-center text-muted-foreground">No facilities. Click "Add Facility" to start.</td></tr>
                )}
              </tbody>
              {debts.length > 0 && (
                <tfoot>
                  <tr className="border-t border-border font-mono text-foreground bg-muted/10">
                    <td className="py-2 px-2 font-semibold" colSpan={3}>Totals</td>
                    <td className="py-2 px-2 text-right font-semibold">{fmtCurrency(totals.totalPrincipal)}</td>
                    <td className="py-2 px-2 text-right font-semibold">{fmtCurrency(totals.totalBalance)}</td>
                    <td className="py-2 px-2 text-right font-semibold">{totals.blendedRate.toFixed(2)}%</td>
                    <td className="py-2 px-2 text-right font-semibold">{fmtCurrency(totals.totalMonthly)}</td>
                    <td colSpan={4}></td>
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
      </div>
    </DashboardLayout>
  );
};

export default FinancialHealth;
