

## Plan: Fix KPI Cards and Cashflow to Match Google Sheets Exactly

### Problem Summary
1. **KPI cards show wrong values** — summary totals (Total Quoted, Won, etc.) are computed from individual rows instead of being read from the sheet's own summary rows (which `isSummaryRow()` currently filters out and discards).
2. **Net Revenue** is incorrectly sourced from Quotes; it should come from the **Cashflow** tab.
3. **Cash Position** should be the **latest populated month's closing balance** from Cashflow.
4. **Conversion Rate** should be calculated as won count / total count.
5. **Card labels** don't match the sheet's text labels.
6. **Cashflow chart** should display all months that have data.

### Changes — `src/contexts/DashboardDataContext.tsx`

**1. Extract quote summary from raw rows before filtering**

Currently `mapQuotes` calls `isSummaryRow()` to skip summary rows — discarding the totals the user entered in the sheet. New approach:
- Add a `extractQuoteSummaryFromRaw(raw)` function that scans all rows for labels like `"TOTAL QUOTED"`, `"TOTAL QUOTED WON"`, `"TOTAL QUOTED LOST"`, `"QUOTED REMAINING"`, `"TOTAL YELLOW"`.
- For each summary row found, extract the count (if present) and dollar value from the row's value column (the one containing "QUOTED" in its key).
- Return a `QuoteSummary` object directly from the sheet data.

**2. Source Net Revenue from Cashflow**

- After mapping cashflow months, compute `netRevenue` as the sum of `cashSurplus` across all populated months (or use `grossProfit` from the latest month — will use the total `Anticipated Cash Surplus` from the latest populated month).
- More precisely: Net Revenue = sum of `totalIncome` across all months minus sum of `costOfSales.total`.

**3. Source Cash Position from Cashflow**

- Cash Position = `closingBalance` of the last month that has non-zero data.

**4. Calculate Conversion Rate in dashboard**

- `conversionRate = (wonCount / totalCount) * 100` using the extracted summary counts, or fallback to counting individual rows.

**5. Update KPI card labels**

Current labels → Updated labels:
- `"Total Quoted"` → `"Total Quoted"` (keep)
- `"Net Revenue (excl GST)"` → `"Net Revenue"` (sourced from cashflow)
- `"Cash Position"` → `"Cashflow Position"` (latest closing balance from cashflow)
- `"Conversion Rate"` → `"Conversion Rate"` (keep, add descriptive subtitle)

**6. Cashflow chart — show all months with data**

- Filter out months where every value is 0 (future months with no data yet), keeping all months that have at least one non-zero value.

### Files Changed

| File | Change |
|------|--------|
| `src/contexts/DashboardDataContext.tsx` | Add `extractQuoteSummaryFromRaw()`; update quote summary logic to use sheet totals; source Net Revenue and Cash Position from cashflow; update KPI labels; filter empty future months from cashflow chart |

