import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Target } from "lucide-react";
import { useGoals, Goal } from "@/hooks/useGoals";
import GoalCard from "@/components/goals/GoalCard";
import GoalForm from "@/components/goals/GoalForm";
import GoalProgressChart from "@/components/goals/GoalProgressChart";

const CATEGORIES = ["All", "Revenue", "Operations", "Growth", "Profitability", "Customer", "Product"];

const GoalsTargets = () => {
  const { goals, addGoal, updateGoal, deleteGoal } = useGoals();

  const [goalFormOpen, setGoalFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | undefined>();
  const [categoryFilter, setCategoryFilter] = useState("All");

  const filteredGoals = categoryFilter === "All" ? goals : goals.filter((g) => g.category === categoryFilter);

  const handleEditGoal = (goal: Goal) => {
    setEditingGoal(goal);
    setGoalFormOpen(true);
  };

  const handleGoalSubmit = (data: Omit<Goal, "id" | "createdAt">) => {
    if (editingGoal) {
      updateGoal(editingGoal.id, data);
    } else {
      addGoal(data);
    }
    setEditingGoal(undefined);
  };

  return (
    <DashboardLayout>
      <div className="mb-4 md:mb-6">
        <h1 className="text-fluid-2xl font-semibold">Goals & Targets</h1>
        <p className="text-fluid-xs text-muted-foreground font-mono">Track objectives and business targets</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px] text-xs">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => { setEditingGoal(undefined); setGoalFormOpen(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Goal
          </Button>
        </div>

        <GoalProgressChart goals={filteredGoals} />

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
          {filteredGoals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} onEdit={handleEditGoal} onDelete={deleteGoal} />
          ))}
        </div>

        {filteredGoals.length === 0 && (
          <div className="chart-container flex flex-col items-center justify-center py-12">
            <Target className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No goals yet. Create your first goal to start tracking.</p>
          </div>
        )}

        <GoalForm
          open={goalFormOpen}
          onOpenChange={(open) => { setGoalFormOpen(open); if (!open) setEditingGoal(undefined); }}
          onSubmit={handleGoalSubmit}
          initial={editingGoal}
        />
      </div>
    </DashboardLayout>
  );
};

export default GoalsTargets;
