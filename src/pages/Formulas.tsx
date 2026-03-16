import { useState } from "react";
import { Plus, FunctionSquare } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { MetricFormula } from "@/hooks/useFormulas";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import FormulaCard from "@/components/goals/FormulaCard";
import FormulaForm from "@/components/goals/FormulaForm";

const Formulas = () => {
  const { formulas, addFormula, updateFormula, deleteFormula, kpiVariables } = useDashboardData();

  const [formulaFormOpen, setFormulaFormOpen] = useState(false);
  const [editingFormula, setEditingFormula] = useState<MetricFormula | undefined>();

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
      <div className="mb-4 md:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-fluid-2xl font-semibold">Formulas</h1>
          <p className="text-fluid-xs text-muted-foreground font-mono">
            Manage dashboard metrics and their data expressions
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditingFormula(undefined);
            setFormulaFormOpen(true);
          }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Formula
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
        {formulas.map((formula) => (
          <FormulaCard
            key={formula.id}
            formula={formula}
            onEdit={handleEditFormula}
            onDelete={deleteFormula}
          />
        ))}
      </div>

      {formulas.length === 0 && (
        <div className="chart-container flex flex-col items-center justify-center py-12">
          <FunctionSquare className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            No formulas yet. Create custom metrics using variables like Revenue, OpEx, GrossProfit.
          </p>
        </div>
      )}

      <FormulaForm
        open={formulaFormOpen}
        onOpenChange={(open) => {
          setFormulaFormOpen(open);
          if (!open) setEditingFormula(undefined);
        }}
        onSubmit={handleFormulaSubmit}
        initial={editingFormula}
        kpiVariables={kpiVariables}
      />
    </DashboardLayout>
  );
};

export default Formulas;
