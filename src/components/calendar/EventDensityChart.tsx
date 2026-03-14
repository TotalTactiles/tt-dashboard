import { useMemo } from "react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";
import { type CalendarSummary } from "@/contexts/DashboardDataContext";

interface EventDensityChartProps {
  summary: CalendarSummary | null;
}

const TYPE_COLORS: Record<string, string> = {
  Meeting: "#378ADD",
  Deadline: "#E24B4A",
  Milestone: "#7F77DD",
  Care: "#639922",
  Valuation: "#BA7517",
  Distribution: "#1D9E75",
};

const EventDensityChart = ({ summary }: EventDensityChartProps) => {
  const data = useMemo(() => {
    if (!summary?.byType) return [];
    return Object.entries(summary.byType)
      .filter(([, count]) => count > 0)
      .map(([type, count]) => ({
        type,
        count,
        fill: TYPE_COLORS[type] || "#378ADD",
      }));
  }, [summary]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="stat-card"
    >
      <h3 className="text-sm font-semibold text-foreground mb-4">Event Distribution by Type</h3>
      {data.length === 0 ? (
        <p className="text-xs text-muted-foreground py-10 text-center">No event data available</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" vertical={false} />
            <XAxis dataKey="type" tick={{ fontSize: 10, fill: "hsl(215, 12%, 50%)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(215, 12%, 50%)" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const { type, count, fill } = payload[0].payload;
                return (
                  <div style={{ background: '#fff', borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', minWidth: 120 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#111' }}>{type}</div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: fill }}>{count} events</div>
                  </div>
                );
              }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </motion.div>
  );
};

export default EventDensityChart;
