import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { sectorAllocation } from "@/data/mockData";

const SectorAllocationChart = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="chart-container"
    >
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Sector Allocation</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={sectorAllocation}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
            animationBegin={500}
            animationDuration={1200}
          >
            {sectorAllocation.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(220, 18%, 10%)",
              border: "1px solid hsl(220, 14%, 18%)",
              borderRadius: "8px",
              fontFamily: "JetBrains Mono",
              fontSize: "12px",
            }}
            formatter={(value: number) => [`${value}%`, ""]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-3 mt-2">
        {sectorAllocation.map((s) => (
          <div key={s.name} className="flex items-center gap-1.5 text-xs">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.fill }} />
            <span className="text-muted-foreground">{s.name}</span>
            <span className="font-mono text-foreground">{s.value}%</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default SectorAllocationChart;
