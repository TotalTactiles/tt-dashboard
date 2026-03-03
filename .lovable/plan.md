

## Plan: Goals & Targets Tab with Custom Metric Formulas

### Overview
Add a new "Goals & Targets" sidebar tab with two sections: (1) a goal management system with numeric values and date ranges, and (2) a custom business metric formula database. Goals and formulas are stored in local state (localStorage) and reflected on the main dashboard.

### New Files

| File | Purpose |
|------|---------|
| `src/pages/GoalsTargets.tsx` | Main page with two tabs: Goals list and Formula database |
| `src/components/goals/GoalCard.tsx` | Individual goal display with progress bar, date range, current vs target value |
| `src/components/goals/GoalForm.tsx` | Dialog form to create/edit goals (name, description, target value, current value, unit, start date, end date, category) |
| `src/components/goals/GoalProgressChart.tsx` | Recharts visualization showing goal progress over time |
| `src/components/goals/FormulaCard.tsx` | Displays a custom formula with name, expression, description, and computed result |
| `src/components/goals/FormulaForm.tsx` | Dialog form to create/edit formulas (name, expression string like `Revenue - Expenses`, description, category) |
| `src/components/goals/GoalsDashboardWidgets.tsx` | Exportable summary components (goal completion ring, top goals progress bars) for use on the main dashboard |
| `src/hooks/useGoals.ts` | React state + localStorage hook managing goals CRUD |
| `src/hooks/useFormulas.ts` | React state + localStorage hook managing formulas CRUD, with a simple expression evaluator that references KPI values |

### Modified Files

| File | Change |
|------|---------|
| `src/components/AppSidebar.tsx` | Add `Target` icon entry for `/goals` route |
| `src/App.tsx` | Add `/goals` route |
| `src/pages/Index.tsx` | Import `GoalsDashboardWidgets` and render a goals summary section showing top active goals and any formula-derived metrics |

### Goals Data Model
```typescript
interface Goal {
  id: string;
  name: string;
  description: string;
  targetValue: number;
  currentValue: number;
  unit: string; // "$", "%", "#"
  startDate: string;
  endDate: string;
  category: string; // "Revenue", "Operations", "Growth", etc.
  createdAt: string;
}
```

### Formula Data Model
```typescript
interface MetricFormula {
  id: string;
  name: string; // e.g. "Burn Rate"
  expression: string; // e.g. "Operating Expenses / Revenue * 100"
  description: string;
  unit: string;
  category: string;
}
```

The formula evaluator will parse simple arithmetic expressions referencing known KPI variable names (Revenue, GrossProfit, OpEx, NetProfit) from `mockData.ts` and compute a result. This keeps it frontend-only without needing `eval()` — a basic tokenizer handles `+`, `-`, `*`, `/` with named variables.

### Goals Page Layout
- **Tab 1 — Goals**: Filter/sort bar (by category, status, date) + grid of GoalCards + "Add Goal" button opening GoalForm dialog. Each card shows a progress bar (currentValue/targetValue), date range, days remaining, and category badge.
- **Tab 2 — Formulas**: List of FormulaCards showing name, expression, computed value, and description + "Add Formula" button. Each formula shows its live computed result based on current KPI data.

### Dashboard Integration
On `Index.tsx`, add a new row below the KPI stats showing:
- A compact "Goals Progress" card with the top 3-5 active goals as mini progress bars
- Any custom formula results displayed as additional stat cards alongside existing KPIs

