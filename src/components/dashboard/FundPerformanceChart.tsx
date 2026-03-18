import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { Pencil, Check, X } from "lucide-react";
import NoData from "./NoData";

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
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
              <XAxis dataKey="month" stroke="hsl(215, 12%, 50%)" fontSize={11} fontFamily="JetBrains Mono" />
              <YAxis stroke="hsl(215, 12%, 50%)" fontSize={11} fontFamily="JetBrains Mono" tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(220, 18%, 10%)",
                  border: "1px solid hsl(220, 14%, 18%)",
                  borderRadius: "8px",
                  fontFamily: "JetBrains Mono",
                  fontSize: "12px",
                }}
                formatter={(value: number | null, name: string) => {
                  if (value === null || value === undefined) return ["—", name === "netProfitMargin" ? "Net Profit Margin" : name];
                  const label = name === "grossMargin" ? "Gross Margin" : name === "netProfitMargin" ? "Net Profit Margin" : name;
                  return [`${value}%`, label];
                }}
              />
              <ReferenceLine
                y={target}
                stroke="hsl(38, 92%, 55%)"
                strokeDasharray="5 5"
                label={{ value: `Target ${target}%`, position: "right", fill: "hsl(38, 92%, 55%)", fontSize: 10, fontFamily: "JetBrains Mono" }}
              />
              <Line
                type="monotone"
                dataKey="grossMargin"
                stroke="hsl(160, 70%, 45%)"
                strokeWidth={2}
                dot={{ r: 3, fill: "hsl(160, 70%, 45%)" }}
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
