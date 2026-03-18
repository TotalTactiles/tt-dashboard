import { useState, useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { chartColors } from "@/lib/chartTheme";
import { Pencil, Check, X } from "lucide-react";
import NoData from "./NoData";
import { useTheme } from "next-themes";

const GM_TARGET_KEY = "gross_margin_target";

function loadTarget(): number {
  try {
    const v = localStorage.getItem(GM_TARGET_KEY);
    if (v !== null) {
      const n = parseFloat(v);
      if (!isNaN(n) && n >= 0 && n <= 100) return n;
    }
  } catch {}
  return 30;
}

const FundPerformanceChart = () => {
  const { profitMarginData, dataHealth } = useDashboardData();
  const { resolvedTheme } = useTheme();
  const [target, setTarget] = useState(loadTarget);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const tc = useMemo(() => chartColors(), [resolvedTheme]);

  useEffect(() => {
    const handler = () => setTarget(loadTarget());
    window.addEventListener("storage", handler);
    window.addEventListener("gm-target-update", handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("gm-target-update", handler);
    };
  }, []);

  const startEdit = () => {
    setDraft(String(target));
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const confirmEdit = () => {
    const n = parseFloat(draft);
    if (!isNaN(n) && n >= 0 && n <= 100) {
      setTarget(n);
      localStorage.setItem(GM_TARGET_KEY, String(n));
      window.dispatchEvent(new Event("gm-target-update"));
    }
    setEditing(false);
  };

  const cancelEdit = () => setEditing(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") confirmEdit();
    if (e.key === "Escape") cancelEdit();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.6 }}
      className="chart-container"
    >
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">Gross Profit Margin (%)</h3>
      </div>
      {profitMarginData.length === 0 ? (
        <NoData message="No profit margin data" healthStatus={dataHealth.revenue.status} />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={220} minHeight={180}>
            <LineChart data={profitMarginData}>
              <CartesianGrid strokeDasharray="3 3" stroke={tc.grid} strokeOpacity={0.6} />
              <XAxis dataKey="month" stroke={tc.axis} fontSize={11} fontFamily="JetBrains Mono" />
              <YAxis stroke={tc.axis} fontSize={11} fontFamily="JetBrains Mono" tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: tc.tooltipBg,
                  border: `1px solid ${tc.tooltipBorder}`,
                  borderRadius: "8px",
                  fontFamily: "JetBrains Mono",
                  fontSize: "12px",
                }}
                formatter={(value: number | null, name: string) => {
                  if (value === null || value === undefined) return ["—", name];
                  return [`${value}%`, "Gross Margin"];
                }}
              />
              <ReferenceLine
                y={target}
                stroke={tc.amber}
                strokeDasharray="5 5"
                label={{ value: `Target ${target}%`, position: "right", fill: tc.amber, fontSize: 10, fontFamily: "JetBrains Mono" }}
              />
              <Line
                type="monotone"
                dataKey="grossMargin"
                stroke={tc.green}
                strokeWidth={2}
                dot={{ r: 3, fill: tc.green }}
                animationDuration={2000}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-xs font-mono items-center">
            <div className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-chart-green rounded" /> Gross Margin</div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-chart-amber rounded" style={{ borderTop: "1px dashed" }} />
              {editing ? (
                <span className="flex items-center gap-1">
                  Target
                  <input
                    ref={inputRef}
                    type="number"
                    min={0}
                    max={100}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-12 bg-secondary border border-primary/50 rounded px-1 py-0.5 text-xs font-mono text-foreground outline-none focus:border-primary"
                  />
                  %
                  <button onClick={confirmEdit} className="text-primary hover:text-primary/80"><Check className="h-3 w-3" /></button>
                  <button onClick={cancelEdit} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  Target {target}%
                  <button onClick={startEdit} className="text-muted-foreground hover:text-foreground"><Pencil className="h-3 w-3" /></button>
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
};

export default FundPerformanceChart;
