

## Plan: Adapt Dashboard Parsers to n8n's `_label_*` Normalized Fields

### Root Cause
Your n8n Code node now pre-computes normalized `_label_*` fields on every row (e.g., `_label_dollarValue`, `_label_isTotalQuoted`, `_label_company`, `_label_monthlyCost`). The dashboard parsers in `DashboardDataContext.tsx` don't know about these fields and still try to detect columns from raw headers -- which fails when headers are ambiguous or missing.

The fix is to update each mapper and the summary extractor to **prefer `_label_*` fields first**, then fall back to the existing flex-matching logic.

### Changes (single file: `src/contexts/DashboardDataContext.tsx`)

**1. `extractQuoteSummaryFromRaw`** (lines ~475-528)
- Check `row._label_isTotalQuoted === true` (boolean) instead of scanning all cell values for the string "TOTAL QUOTED"
- Use `row._label_dollarValue` and `row._label_countValue` directly instead of re-detecting value/count columns
- Same for `_label_isTotalWon`, `_label_isTotalLost`, `_label_isTotalYellow`, `_label_isQuotedRemaining`
- Keep existing string-scan as fallback for non-labelled payloads

**2. `mapQuotes`** (lines ~74-100)
- Use `row._label_dollarValue` as primary value source if present
- Use `row._label_countValue` for `totalPOs`
- Keep existing `findKeyContaining` + `flexGet` as fallback

**3. `mapCashflow`** (lines ~164-235)
- If rows have `_label_rowLabel` and `_label_monthData`, use those directly in `buildRowLookup` and month value extraction
- Keep existing month-column detection as fallback

**4. `mapRevenue`** (lines ~240-273)
- If `_label_company` exists, use `_label_company`, `_label_project`, `_label_value`, `_label_labourCost`, `_label_tactileCost`, `_label_otherCost`, `_label_totalCost`, `_label_invoiceDate`, `_label_dueDate`
- Skip rows where `_label_isTotalRow === true`
- Fallback to existing `flexGet` logic

**5. `mapExpenses`** (lines ~307-359)
- If `_label_name` exists, use `_label_name`, `_label_category`, `_label_isCategoryHeader`, `_label_isSubTotal`, `_label_isTotal`, `_label_isLineItem`, `_label_monthlyCost`, `_label_weeklyCost`, `_label_yearlyCost`
- Skip rows where `_label_isSubTotal` or `_label_isTotal` is true
- Group by `_label_category` directly instead of re-detecting category headers
- Fallback to existing logic

**6. `isSummaryRow`** (line ~69)
- Also return true if `row._label_isSummaryRow === true`

### Why this works
- n8n already does the hard work of normalizing column names and detecting summary rows
- Dashboard just reads the pre-computed fields
- Fallback logic preserved so dashboard still works without the n8n labelling (e.g., if someone pastes raw data)

### Files Changed
| File | Change |
|------|--------|
| `src/contexts/DashboardDataContext.tsx` | Update all 5 mappers + summary extractor to prefer `_label_*` fields |

