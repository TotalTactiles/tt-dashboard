import { useState, useMemo, useRef } from "react";
import { Plus, FunctionSquare, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { MetricFormula } from "@/hooks/useFormulas";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import FormulaCard from "@/components/goals/FormulaCard";
import FormulaForm from "@/components/goals/FormulaForm";
import { Badge } from "@/components/ui/badge";

interface FormulaSection {
  key: string;
  title: string;
  subtitle: string;
  formulas: MetricFormula[];
}

const ALL_SECTION_KEYS = ["Business Overview", "Project Execution", "Cashflow & Forecasts", "Investor Metrics"];
const SECTION_ORDER = ["Business Overview", "Project Execution", "Cashflow & Forecasts"];

const Formulas = () => {
  const { formulas, addFormula, updateFormula, deleteFormula, kpiVariables } = useDashboardData();

  const [formulaFormOpen, setFormulaFormOpen] = useState(false);
  const [editingFormula, setEditingFormula] = useState<MetricFormula | undefined>();

  // Start all sections collapsed; use lazy initialiser so it never resets on re-render
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => new Set());

  const sections = useMemo<FormulaSection[]>(() => {
    const grouped: Record<string, MetricFormula[]> = {};
    for (const f of formulas) {
      const section = f.section || "Business Overview";
      if (!grouped[section]) grouped[section] = [];
      grouped[section].push(f);
    }

    const result: FormulaSection[] = [];

    // Business Overview
    result.push({
      key: "Business Overview",
      title: "Business Overview",
      subtitle: "Top-level KPI cards",
      formulas: grouped["Business Overview"] || [],
    });

    // Project Execution
    result.push({
      key: "Project Execution",
      title: "Project Execution",
      subtitle: "Delivery, profitability & cashflow KPIs",
      formulas: grouped["Project Execution"] || [],
    });

    // Cashflow & Forecasts placeholder
    result.push({
      key: "Cashflow & Forecasts",
      title: "Cashflow & Forecasts",
      subtitle: "Opening balance, today estimate, forecast surplus & probable jobs",
      formulas: grouped["Cashflow & Forecasts"] || [],
    });

    // Investor Metrics
    result.push({
      key: "Investor Metrics",
      title: "Investor Metrics",
      subtitle: "Business health, EBITDA, margins & investment KPIs — computed by n8n from live data",
      formulas: grouped["Investor Metrics"] || [],
    });

    return result;
  }, [formulas]);

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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

      <div className="space-y-4">
        {sections.map((section) => {
          const isExpanded = expandedSections.has(section.key);

          return (
            <div key={section.key} className="stat-card overflow-hidden">
              {/* Section header */}
              <button
                onClick={() => toggleSection(section.key)}
                className="w-full flex items-center justify-between gap-3 p-3 md:p-4 hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold font-mono text-foreground text-left">
                      {section.title}
                    </h2>
                    <p className="text-[11px] font-mono text-muted-foreground text-left">
                      {section.subtitle}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    {section.formulas.length} formulas
                  </Badge>
                  <ChevronDown
                    className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </button>

              {/* Section content */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 md:px-4 pb-3 md:pb-4">
                      {section.formulas.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
                          {section.formulas.map((formula) => (
                            <FormulaCard
                              key={formula.id}
                              formula={formula}
                              onEdit={handleEditFormula}
                              onDelete={deleteFormula}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8">
                          <FunctionSquare className="h-6 w-6 text-muted-foreground/40 mb-2" />
                          <p className="text-xs text-muted-foreground font-mono">
                            No formulas configured for this section yet.
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
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
