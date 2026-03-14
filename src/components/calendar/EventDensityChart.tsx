import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";
import { calendarEvents, eventTypeColors, type CalendarEvent } from "@/data/calendarMockData";
import { useMemo } from "react";

const EventDensityChart = () => {
  const data = useMemo(() => {
    const byType: Record<string, number> = {};
    calendarEvents.forEach((e) => {
      byType[e.type] = (byType[e.type] || 0) + 1;
    });
    return Object.entries(byType).map(([type, count]) => ({
      type: type.charAt(0).toUpperCase() + type.slice(1),
      count,
      fill: eventTypeColors[type as CalendarEvent["type"]],
    }));
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="stat-card"
    >
      <h3 className="text-sm font-semibold text-foreground mb-4">Event Distribution by Type</h3>
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
          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
};

export default EventDensityChart;
