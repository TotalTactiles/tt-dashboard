

## Plan: Fix Data Mapping to Match Actual n8n Response Format

### Root Causes Identified

I inspected the actual network response from the n8n webhook. Three issues prevent data from displaying:

**Issue 1 — `buildRowLookup` can't find the label column.** The cashflow data uses `col_1` as the label key (e.g., `{"row_number":4, "col_1":"OPENING BALANCES", "Dec-25":186224.81, ...}`). But `buildRowLookup` only checks for `"Fortnight Ending"`, `"Category"`, etc., and the fallback picks `row_number` (first key) instead of `col_1`. Result: every metric lookup fails → all zeros → no chart data.

**Issue 2 — Values are negative.** Costs/expenses in the sheet are stored as negative numbers (e.g., Labour Costs = `-8200`). The dashboard charts expect positive values for display. Need `Math.abs()` when reading cost values.

**Issue 3 — Missing `quotes`, `revenue`, `expenses` keys.** The n8n response only contains a `cashflow` key. The other three sections aren't being returned by the workflow, so those cards correctly show "No data source connected." This is an n8n workflow configuration issue, not a code bug — but the code should handle it gracefully (which it already does).

### Fix (1 file)

**`src/contexts/DashboardDataContext.tsx`**:

1. In `buildRowLookup` (line 115): Add `"col_1"` to the list of label key names so the function correctly identifies the label column:
   ```typescript
   const labelKey = Object.keys(row).find((k) =>
     ["col_1", "Fortnight Ending", "Category", "Item", "Label", "Description"].some(
       (h) => k.toLowerCase() === h.toLowerCase()
     )
   ) || Object.keys(row).filter(k => k !== "row_number")[0] || Object.keys(row)[0];
   ```

2. In `mapCashflow` pivot section: Use `Math.abs()` for cost metrics (labour, tactile, otherProducts, totalCostOfSales, totalEmployment, totalOperating, totalOutgoings) since the sheet stores them as negatives.

3. In `detectMonthColumns`: Also filter out `row_number` and keys starting with `col_` (like `col_15`) to be safe, though the regex already handles this.

4. Skip the header row where `col_1` value is `"Fortnight Ending:"` (row 3 in the response) — it's metadata, not a metric.

### User Action Needed (no code change)

The n8n workflow currently only returns a `cashflow` key. To populate the Quotes, Revenue, and Expenses cards, the workflow needs to also read those sheet tabs and return them as `quotes`, `revenue`, and `expenses` keys in the response JSON. This is a workflow configuration task in n8n, not a code fix.

