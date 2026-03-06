

## Plan: Enhance Formulas as Dashboard Card Registry with Data Source & Screenshot Reference

### What the User Wants
Each formula in the Formulas tab should map to a specific **dashboard card** (StatCard, chart, table, etc.). Each formula entry needs:
1. **Which dashboard card** it corresponds to (e.g., "Total Quoted", "Cashflow Chart", "Forecast Chart")
2. **Which data source** feeds that card (Google Sheets, Zoho CRM, Zoho Projects, Xero)
3. **The formula/expression** used to compute the value — editable
4. **A reference screenshot** showing exactly where in the source system the data lives

### Changes

#### 1. Update `MetricFormula` interface (`src/hooks/useFormulas.ts`)
Add two new optional fields:
- `dashboardCard?: string` — which dashboard card this formula maps to (selected from a predefined list)
- `dataSource?: string` — which integration feeds this card (Google Sheets / Zoho CRM / Zoho Projects / Xero)

#### 2. Update `FormulaForm` (`src/components/goals/FormulaForm.tsx`)
Add two new dropdowns above the expression field:
- **"Dashboard Card"** — select from predefined list: `Total Quoted`, `Total Won`, `Conversion Rate`, `Cash Position`, `Portfolio Chart`, `Sector Allocation`, `Cashflow Chart`, `Fund Performance`, `Forecast Chart`, `Deal Pipeline`, `Revenue Projects Table`, `Expense Breakdown`, or allow custom entry
- **"Data Source"** — select from: `Google Sheets`, `Zoho CRM`, `Zoho Projects`, `Xero`, `Manual`
- Screenshot upload already exists, keep as-is with label updated to "Reference Screenshot (where data lives in source)"

#### 3. Update `FormulaCard` (`src/components/goals/FormulaCard.tsx`)
- Show the linked dashboard card name as a tag/badge
- Show the data source as a colored badge (green for Sheets, blue for Zoho, purple for Xero)
- Screenshot thumbnail and viewer already exist, keep as-is

#### 4. Pre-populate Default Formulas
Add a helper in `useFormulas.ts` that, on first load (when no formulas exist), seeds the list with entries matching the existing dashboard cards (Total Quoted, Total Won, Conversion Rate, Cash Position, etc.) with their known expressions and data source set to "Google Sheets". Users can then attach screenshots and adjust formulas.

### Files Changed

| File | Change |
|------|--------|
| `src/hooks/useFormulas.ts` | Add `dashboardCard` and `dataSource` fields to `MetricFormula`; add seed data for default dashboard cards |
| `src/components/goals/FormulaForm.tsx` | Add Dashboard Card dropdown, Data Source dropdown, update screenshot label |
| `src/components/goals/FormulaCard.tsx` | Display dashboard card badge and data source indicator |

