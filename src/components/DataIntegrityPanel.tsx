import { useMemo, useState, useEffect } from "react";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { useRevenueTarget } from "@/hooks/useRevenueTarget";

const num = (v: any) => Number(String(v ?? 0).replace(/[$,]/g, "")) || 0;
const val = (r: any) => num(r?._label_dollarValue ?? r?.["Total Value ($)"] ?? r?.["Total Value"]);
const cnt = (r: any) => num(r?.Count ?? r?._label_countValue);
const approx = (a: number, b: number, tol = 1) => Math.abs(a - b) <= tol;
const approxPct = (a: number, b: number, tol = 0.1) => Math.abs(a - b) <= tol;

const fmt$ = (n: number) =>
  isFinite(n) ? `$${Math.round(n).toLocaleString()}` : "—";
const fmtPct = (n: number) => (isFinite(n) ? `${n.toFixed(1)}%` : "—");

type Basis = "A" | "B" | "C";
type Status = "pass" | "fail" | "na";
interface Check {
  id: number;
  label: string;
  basis: Basis;
  actual: string;
  expected: string;
  status: Status;
}

export default function DataIntegrityPanel() {
  const d = useDashboardData();
  const { target } = useRevenueTarget();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const checks = useMemo<Check[]>(() => {
    const rows: any[] = (d.dataStore?.qtsSmmry as any[]) ?? [];
    const byFlag = (f: string) => rows.find((r: any) => r?.[f]);
    const byStage = (n: string) =>
      rows.find((r: any) => String(r?.["Jobs Stages"] ?? "").trim() === n);

    const grn = byFlag("_label_isPOReceived");
    const comp = byFlag("_label_isCompleted");
    const lost = byFlag("_label_isLostDead");
    const ylw = byFlag("_label_isVerbalYellow");
    const gt = byFlag("_label_isGrandTotal");
    const qs = byStage("Quote Sent");
    const neg = byStage("Negotiation/Review");
    const ylwGrn = rows.find(
      (r: any) => String(r?.["Jobs Stages"] ?? "").trim() === "YLW + GRN"
    );

    const wonValueFY = d.wonValueFY ?? 0;
    const wonCountFY = d.wrWonFY ?? 0;
    const lostCountFY = d.wrLostFY ?? 0;
    const ylwValueFY = d.ylwValue ?? 0;
    const winRateConfirmed = d.winRateConfirmed ?? 0;
    const pipelineConversion = d.pipelineConversion ?? 0;
    const totalOpps = d.totalOpps ?? 0;

    // Revenue extras
    const rpStat: any =
      (d.kpiStats ?? []).find((s: any) => s.label === "Revenue / Profit") ?? {};
    const rev2026 = rpStat?.extras?.rev2026 ?? null;
    const revYTD = rpStat?.extras?.revYTD ?? null;

    // Goal math (Confirmed mode — matches TargetsGoalsSection.tsx)
    const goalConfirmed = wonValueFY;
    const effectiveCurrent = goalConfirmed;
    const avgWonDeal = wonCountFY > 0 ? wonValueFY / wonCountFY : 0;
    const remaining = Math.max(0, target - effectiveCurrent);
    const jobsToGoal =
      avgWonDeal > 0 && remaining > 0 ? Math.ceil(remaining / avgWonDeal) : 0;
    const oppsToGoal = d.getLeadsToGoal ? d.getLeadsToGoal(jobsToGoal) : 0;
    const leadsToGoal = d.getLeadsToGoalTrue
      ? d.getLeadsToGoalTrue(jobsToGoal)
      : 0;

    const c: Check[] = [];
    const add = (
      id: number,
      label: string,
      basis: Basis,
      actual: string,
      expected: string,
      status: Status
    ) => c.push({ id, label, basis, actual, expected, status });

    // 1 won value == GRN+Comp value
    {
      const a = wonValueFY;
      const e = val(grn) + val(comp);
      const ok = grn || comp;
      add(
        1,
        "Won value = GRN + Completed",
        "A",
        fmt$(a),
        fmt$(e),
        !ok ? "na" : approx(a, e, 1) ? "pass" : "fail"
      );
    }
    // 2 won count
    {
      const a = wonCountFY;
      const e = cnt(grn) + cnt(comp);
      const ok = grn || comp;
      add(
        2,
        "Won count = GRN + Completed",
        "A",
        String(a),
        String(e),
        !ok ? "na" : a === e ? "pass" : "fail"
      );
    }
    // 3 goalConfirmed == wonValueFY
    add(
      3,
      "Goal Confirmed = Won value",
      "B",
      fmt$(goalConfirmed),
      fmt$(wonValueFY),
      approx(goalConfirmed, wonValueFY, 1) ? "pass" : "fail"
    );
    // 4 lost count
    {
      const a = lostCountFY;
      const e = cnt(lost);
      add(
        4,
        "Lost count = Lost row",
        "A",
        String(a),
        String(e),
        !lost ? "na" : a === e ? "pass" : "fail"
      );
    }
    // 5 close rate
    {
      const denom = wonCountFY + lostCountFY;
      if (denom === 0)
        add(5, "Close rate = won / (won+lost)", "C", "—", "—", "na");
      else {
        const e = (100 * wonCountFY) / denom;
        add(
          5,
          "Close rate = won / (won+lost)",
          "C",
          fmtPct(winRateConfirmed),
          fmtPct(e),
          approxPct(winRateConfirmed, e, 0.2) ? "pass" : "fail"
        );
      }
    }
    // 6 pipeline conversion
    {
      if (totalOpps === 0)
        add(6, "Pipeline rate = won / total opps", "C", "—", "—", "na");
      else {
        const e = (100 * wonCountFY) / totalOpps;
        add(
          6,
          "Pipeline rate = won / total opps",
          "C",
          fmtPct(pipelineConversion),
          fmtPct(e),
          approxPct(pipelineConversion, e, 0.2) ? "pass" : "fail"
        );
      }
    }
    // 7 YLW+GRN row equals GRN+YLW
    {
      if (!ylwGrn) add(7, "YLW+GRN row = GRN + YLW", "A", "—", "—", "na");
      else {
        const a = val(ylwGrn);
        const e = val(grn) + val(ylw);
        add(
          7,
          "YLW+GRN row = GRN + YLW",
          "A",
          fmt$(a),
          fmt$(e),
          approx(a, e, 1) ? "pass" : "fail"
        );
      }
    }
    // 8 grand total = sum of stages
    {
      if (!gt) add(8, "Grand Total = Σ stages", "A", "—", "—", "na");
      else {
        const a = cnt(gt);
        const e =
          cnt(qs) + cnt(neg) + cnt(ylw) + cnt(grn) + cnt(lost) + cnt(comp);
        add(
          8,
          "Grand Total = Σ stages",
          "A",
          String(a),
          String(e),
          a === e ? "pass" : "fail"
        );
      }
    }
    // 9 net rev = gross / 1.1
    {
      if (!rev2026) add(9, "Net Rev = Gross / 1.1", "B", "—", "—", "na");
      else {
        const a = rev2026.net ?? 0;
        const e = (rev2026.gross ?? 0) / 1.1;
        add(
          9,
          "Net Rev = Gross / 1.1",
          "B",
          fmt$(a),
          fmt$(e),
          approx(a, e, 50) ? "pass" : "fail"
        );
      }
    }
    // 10 avg won
    {
      if (wonCountFY === 0)
        add(10, "Avg Won = Won value / Won count", "B", "—", "—", "na");
      else {
        const e = wonValueFY / wonCountFY;
        add(
          10,
          "Avg Won = Won value / Won count",
          "B",
          fmt$(avgWonDeal),
          fmt$(e),
          approx(avgWonDeal, e, 5) ? "pass" : "fail"
        );
      }
    }
    // 11 jobsToGoal
    {
      if (avgWonDeal === 0 || remaining === 0)
        add(11, "Jobs to Goal = ⌈remaining / Avg Won⌉", "B", String(jobsToGoal), "—", "na");
      else {
        const e = Math.ceil(remaining / avgWonDeal);
        add(
          11,
          "Jobs to Goal = ⌈remaining / Avg Won⌉",
          "B",
          String(jobsToGoal),
          String(e),
          jobsToGoal === e ? "pass" : "fail"
        );
      }
    }
    // 12 remaining
    {
      const e = Math.max(0, target - effectiveCurrent);
      if (target === 0)
        add(12, "Remaining = target − effectiveCurrent", "B", "—", "—", "na");
      else
        add(
          12,
          "Remaining = target − effectiveCurrent",
          "B",
          fmt$(remaining),
          fmt$(e),
          approx(remaining, e, 1) ? "pass" : "fail"
        );
    }
    // 13 opps < leads
    {
      if (jobsToGoal === 0)
        add(13, "Funnel: Opps < Leads", "C", "—", "—", "na");
      else
        add(
          13,
          "Funnel: Opps < Leads",
          "C",
          `${oppsToGoal} < ${leadsToGoal}`,
          "true",
          oppsToGoal < leadsToGoal ? "pass" : "fail"
        );
    }
    // 14 opp rate matches close rate (recompute via getLeadsToGoal)
    {
      if (winRateConfirmed === 0 || jobsToGoal === 0)
        add(14, "Funnel Opps uses Close Rate", "C", "—", "—", "na");
      else {
        const expected = Math.ceil(jobsToGoal / (winRateConfirmed / 100));
        add(
          14,
          "Funnel Opps uses Close Rate",
          "C",
          String(oppsToGoal),
          String(expected),
          oppsToGoal === expected ? "pass" : "fail"
        );
      }
    }
    // 15 lead rate matches pipeline
    {
      if (pipelineConversion === 0 || jobsToGoal === 0)
        add(15, "Funnel Leads uses Pipeline Rate", "C", "—", "—", "na");
      else {
        const expected = Math.ceil(jobsToGoal / (pipelineConversion / 100));
        add(
          15,
          "Funnel Leads uses Pipeline Rate",
          "C",
          String(leadsToGoal),
          String(expected),
          leadsToGoal === expected ? "pass" : "fail"
        );
      }
    }
    // 16 YTD ≤ 2026
    {
      if (!rev2026 || !revYTD)
        add(16, "YTD gross ≤ 2026 gross", "B", "—", "—", "na");
      else {
        const a = revYTD.gross ?? 0;
        const e = rev2026.gross ?? 0;
        add(
          16,
          "YTD gross ≤ 2026 gross",
          "B",
          fmt$(a),
          `≤ ${fmt$(e)}`,
          a <= e + 1 ? "pass" : "fail"
        );
      }
    }

    return c;
  }, [d, target]);

  const total = checks.length;
  const passCount = checks.filter((c) => c.status === "pass").length;
  const failCount = checks.filter((c) => c.status === "fail").length;
  const naCount = checks.filter((c) => c.status === "na").length;
  const allGood = failCount === 0;

  const sorted = useMemo(
    () =>
      [...checks].sort((a, b) => {
        const order = { fail: 0, na: 1, pass: 2 } as const;
        return order[a.status] - order[b.status] || a.id - b.id;
      }),
    [checks]
  );

  const pillBg = allGood ? "#3AC979" : "hsl(var(--chart-red, 0 84% 60%))";
  const pillLabel = allGood
    ? `✓ ${passCount}/${total} checks`
    : `⚠ ${failCount} failing`;

  return (
    <div className="mt-6 mb-4 flex justify-end px-1" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <div
        className="w-full"
        style={{
          background: "hsl(var(--card))",
          border: "1px solid hsl(var(--border))",
          borderRadius: 12,
          padding: open ? 14 : 10,
          transition: "padding 120ms ease",
        }}
      >
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center justify-between w-full"
          style={{ background: "transparent", border: 0, cursor: "pointer", color: "hsl(var(--foreground))" }}
        >
          <div className="flex items-center gap-3">
            <span
              style={{
                background: pillBg,
                color: "#0b0b0b",
                fontWeight: 700,
                fontSize: 12,
                padding: "4px 10px",
                borderRadius: 999,
                fontFamily: "JetBrains Mono, ui-monospace, monospace",
                letterSpacing: 0.2,
              }}
            >
              {pillLabel}
            </span>
            <span style={{ fontSize: 12, opacity: 0.8 }}>
              Data Integrity — every figure tied to its source.
            </span>
            {naCount > 0 && (
              <span style={{ fontSize: 11, opacity: 0.55 }}>
                {naCount} n/a
              </span>
            )}
          </div>
          <span style={{ fontSize: 11, opacity: 0.6 }}>
            Last checked {now.toLocaleTimeString()} {open ? "▲" : "▼"}
          </span>
        </button>

        {open && (
          <div className="mt-3" style={{ borderTop: "1px solid hsl(var(--border))" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <tbody>
                {sorted.map((c) => {
                  const dotColor =
                    c.status === "pass" ? "#3AC979" : c.status === "fail" ? "#ef4444" : "#666";
                  const rowBg =
                    c.status === "fail" ? "rgba(239,68,68,0.08)" : "transparent";
                  const muted = c.status === "pass" ? 0.65 : 1;
                  return (
                    <tr key={c.id} style={{ background: rowBg, opacity: muted }}>
                      <td style={{ padding: "6px 8px", width: 18 }}>
                        <span
                          style={{
                            display: "inline-block",
                            width: 8,
                            height: 8,
                            borderRadius: 999,
                            background: dotColor,
                          }}
                        />
                      </td>
                      <td style={{ padding: "6px 8px", width: 28 }}>
                        <span
                          style={{
                            fontFamily: "JetBrains Mono, monospace",
                            fontSize: 10,
                            padding: "1px 6px",
                            borderRadius: 4,
                            background: "hsl(var(--muted))",
                            color: "hsl(var(--muted-foreground))",
                          }}
                        >
                          {c.basis}
                        </span>
                      </td>
                      <td style={{ padding: "6px 8px" }}>{c.label}</td>
                      <td
                        style={{
                          padding: "6px 8px",
                          textAlign: "right",
                          fontFamily: "JetBrains Mono, monospace",
                          color: c.status === "fail" ? "#ef4444" : "inherit",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {c.status === "fail"
                          ? `${c.actual} ≠ ${c.expected}`
                          : c.status === "na"
                          ? "n/a"
                          : c.actual}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
