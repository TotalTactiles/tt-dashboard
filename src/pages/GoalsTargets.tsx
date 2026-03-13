import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Target, Calculator } from "lucide-react";
import { useGoals, Goal } from "@/hooks/useGoals";
import { useFormulas, MetricFormula } from "@/hooks/useFormulas";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import GoalCard from "@/components/goals/GoalCard";
import GoalForm from "@/components/goals/GoalForm";
import GoalProgressChart from "@/components/goals/GoalProgressChart";
import FormulaCard from "@/components/goals/FormulaCard";
import FormulaForm from "@/components/goals/FormulaForm";
import { DataStore } from "@/engine/formulaEngine";

const CATEGORIES = ["All", "Revenue", "Operations", "Growth", "Profitability", "Customer", "Product"];

const GoalsTargets = () => {
  const { goals, addGoal, updateGoal, deleteGoal } = useGoals();
  const { formulas, addFormula, updateFormula, deleteFormula } = useFormulas();
  const { kpiVariables, formulaCache } = useDashboardData();

  // Recompute formula cache whenever formulas or kpiVariables change
  useEffect(() => {
    if (formulas.length > 0) {
      // We need a minimal DataStore for the cache — kpiVariables are already resolved,
      // so we pass an empty store and let variables handle resolution
      const emptyStore: DataStore = {
        quotes: [], qtsSmmry: [], cashflow: [], revenue: [], expenses: [],
        labour: [], stock: [], quotesSummary: {}, cashflowSummary: {},
        revenueSummary: {}, expensesSummary: {},
      };
      formulaCache.compute(formulas, emptyStore, kpiVariables);
    }
  }, [formulas, kpiVariables, formulaCache]);

  const [goalFormOpen, setGoalFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | undefined>();
  const [formulaFormOpen, setFormulaFormOpen] = useState(false);
  const [editingFormula, setEditingFormula] = useState<MetricFormula | undefined>();
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

  const handleEditFormula = (formula: MetricFormula) => {
    setEditingFormula(formula);
    setFormulaFormOpen(true);
  };

  const handleFormulaSubmit = (data: Omit<MetricFormula, "id">) => {
    if (editingFormula) {
      updateFormula(editingFormula.id, data);
    } else {
      addFormula(data);
    }
    setEditingFormula(undefined);
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Goals & Targets</h1>
        <p className="text-sm text-muted-foreground font-mono">Track objectives and custom business metrics</p>
      </div>

      <Tabs defaultValue="goals">
        <TabsList className="mb-6">
          <TabsTrigger value="goals" className="gap-1.5">
            <Target className="h-3.5 w-3.5" /> Goals
          </TabsTrigger>
          <TabsTrigger value="formulas" className="gap-1.5">
            <Calculator className="h-3.5 w-3.5" /> Formulas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="goals" className="space-y-4">
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

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
        </TabsContent>

        <TabsContent value="formulas" className="space-y-4">
          <div className="flex items-center justify-end">
            <Button size="sm" onClick={() => { setEditingFormula(undefined); setFormulaFormOpen(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Formula
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {formulas.map((formula) => (
              <FormulaCard key={formula.id} formula={formula} onEdit={handleEditFormula} onDelete={deleteFormula} />
            ))}
          </div>

          {formulas.length === 0 && (
            <div className="chart-container flex flex-col items-center justify-center py-12">
              <Calculator className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No formulas yet. Create custom metrics using variables like Revenue, OpEx, GrossProfit.</p>
            </div>
          )}

          <FormulaForm
            open={formulaFormOpen}
            onOpenChange={(open) => { setFormulaFormOpen(open); if (!open) setEditingFormula(undefined); }}
            onSubmit={handleFormulaSubmit}
            initial={editingFormula}
            kpiVariables={kpiVariables}
          />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default GoalsTargets;
