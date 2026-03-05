

## Plan: Remove All Mock Data, Show Live Google Sheets Data or "No Data" States

### Problem
Every dashboard component imports hardcoded mock data from `@/data/mockData`. The `useDataSources` hook fetches live data but no component reads it. When data is not connected, users see fake numbers instead of an empty/no-data state.

### Approach
Create a `DashboardDataContext` that provides live data to all components. When no data is available, components show a "No Data" empty state instead of mock values.

### Files to Create

**1. `src/contexts/DashboardDataContext.tsx`**
- Wraps `useDataSources()` internally
- Maps raw n8n arrays (with Google Sheets column names) to typed interfaces (`QuotedJob[]`, `CashflowMonth[]`, `RevenueProject[]`, `ExpenseCategory[]`)
- Derives chart data (`cashflowChartData`, `profitMarginData`, `expenseAllocation`, `quoteSummary`, `kpiStats`)
- Computes dynamic `KPI_VARIABLES` for the formula engine
- Returns `null`/empty arrays when no live data exists -- components use this to show "No Data"
- Exports `useDashboardData()` hook

**2. `src/components/dashboard/NoData.tsx`**
- Small reusable component showing a styled "No data connected" message with a link to Settings
- Used by all dashboard cards when their data array is empty/null

### Files to Modify

**3. `src/pages/Index.tsx`**
- Wrap content with `DashboardDataProvider`
- Replace `kpiStats` mock import with `useDashboardData().kpiStats` (empty array = no cards rendered, or show "No Data" per card)
- Remove all mock data imports

**4. `src/components/dashboard/StatCard.tsx`**
- Add support for a `noData` prop -- when true, show dashed placeholder instead of value

**5. `src/components/dashboard/PortfolioChart.tsx`**
- Replace `import { cashflowChartData } from "@/data/mockData"` with `useDashboardData()`
- If data is empty, render `<NoData />` instead of chart

**6. `src/components/dashboard/CashflowChart.tsx`**
- Same pattern: consume context, show `<NoData />` when empty

**7. `src/components/dashboard/FundPerformanceChart.tsx`**
- Same pattern: consume context for `profitMarginData`

**8. `src/components/dashboard/SectorAllocationChart.tsx`**
- Replace `expenseAllocation` mock import with context data

**9. `src/components/dashboard/DealPipeline.tsx`**
- Replace `quotedJobs` and `quoteSummary` mock imports with context data
- Show "No Data" when quotes array is empty

**10. `src/components/dashboard/RevenueProjectsTable.tsx`**
- Replace `revenueProjects` mock import with context data

**11. `src/components/dashboard/ExpenseBreakdown.tsx`**
- Replace `expenseCategories` mock import with context data

**12. `src/hooks/useFormulas.ts`**
- Accept optional `kpiVariables` parameter in `evaluateExpression` 
- Remove hardcoded `KPI_VARIABLES` object -- instead, the context computes and passes dynamic values
- When no live data exists, variables resolve to 0

**13. `src/data/mockData.ts`**
- Keep only the TypeScript interfaces (they define the data shape)
- Remove all exported mock arrays/objects (`quotedJobs`, `cashflowMonthly`, `kpiStats`, `expenseCategories`, `revenueProjects`, etc.)
- Keep `n8nDataSources` (used in Settings page)

### Data Mapping (n8n Google Sheets columns to TypeScript)

The context will normalize raw sheet column names to the existing interfaces. Example mappings:
- Quotes: `"Quote Number"` → `quoteNumber`, `"Value (excl GST)"` → `value`, `"Status"` → `status` (lowercased)
- Cashflow: `"Month"` → `month`, `"Opening Balance"` → `openingBalance`, `"Total Income"` → `totalIncome`
- Revenue: `"Company"` → `company`, `"Labour Cost"` → `labourCost`
- Expenses: `"Name"` → `name`, `"Monthly Cost"` → `monthlyCost`

Flexible key matching: `camelCase`, `Title Case`, and `snake_case` all map correctly.

### Empty State Behavior
- KPI stat cards: Show `"--"` with neutral grey styling
- Charts: Show centered "No data -- connect Google Sheets in Settings" message
- Tables: Show empty table with "No data available" row
- Badge in header: Shows "No Data Source" instead of "Mock Data"

