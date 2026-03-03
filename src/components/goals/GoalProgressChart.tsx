import { Goal } from "@/hooks/useGoals";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface GoalProgressChartProps {
  goals: Goal[];
}

export default function GoalProgressChart({ goals }: GoalProgressChartProps) {
  const data = goals.slice(0, 8).map((g) => ({
    name: g.name.length > 15 ? g.name.slice(0, 15) + "…" : g.name,
    progress: g.targetValue > 0 ? Math.min((g.currentValue / g.targetValue) * 100, 100) : 0,
  }));

  if (data.length === 0) {
    return (
      <div className="chart-container flex items-center justify-center h-[200px]">
        <p className="text-xs text-muted-foreground font-mono">No goals yet</p>
      </div>
    );
  }

  return (
    <div className="chart-container">
      <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider mb-4">Goal Progress</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16 }}>
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(215, 12%, 50%)" }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10, fill: "hsl(215, 12%, 50%)" }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: "hsl(220, 18%, 10%)", border: "1px solid hsl(220, 14%, 18%)", borderRadius: "8px", fontSize: "11px" }}
            formatter={(value: number) => [`${value.toFixed(0)}%`, "Progress"]}
          />
          <Bar dataKey="progress" radius={[0, 4, 4, 0]} maxBarSize={20}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.progress >= 100 ? "hsl(160, 70%, 45%)" : entry.progress >= 50 ? "hsl(200, 80%, 50%)" : "hsl(38, 92%, 55%)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
