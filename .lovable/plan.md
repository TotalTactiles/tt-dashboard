

## Plan: Align Data Mapping to Actual Google Sheets Structure

### Problem
The current mappers in `DashboardDataContext.tsx` assume column headers that don't match the actual Google Sheets. Key mismatches:

1. **Quotes tab**: No "Quote Number" column. Columns are: `(dollar value)` | `Company Name` | `Project Name` | `Total POs`. Status is determined by row color (green/red/yellow), not a text column. The first column header appears to be "2025 QUOTED JOBS".

2. **Cashflow tab**: Data is **transposed** -- months are columns (`Feb-26`, `Mar-26`, ..., `Dec-26`), rows are metrics (`OPENING BALANCES`, `Total Income`, `Labour Costs`, etc.). n8n Read Rows returns each row as `{ "Fortnight Ending": "Total Income", "Feb-26": 66188, "Mar-26": 51280, ... }`. The mapper currently expects rows-as-months; it needs to pivot columns-to-rows.

3. **Rev & COGS tab**: Headers are `COMPANY | PROJECT | VALUE (INCL. GST) | INVOICE DATE | DUE DATE | LABOUR COST | MONTH | TACTILE COST (GST N/A) | MONTH | OTHER PRODUCTS (INCL GST) | MONTH`. No "Value (excl GST)" column (must derive by dividing incl GST by 1.1). No "Status" column. Has extra `MONTH` columns next to each cost.

4. **Expenses tab**: No "Category" column. Categories are **section header rows** (e.g., row with "Essentials" in Main Expenses column, no cost values). Items follow under each header. Headers: `Main Expenses | # | Payment Date | Weekly Cost | Monthly Cost | Yearly Cost`.

### Solution: Update `DashboardDataContext.tsx` Mappers

**File: `src/contexts/DashboardDataContext.tsx`** -- rewrite all 4 mapper functions:

**`mapQuotes`**: 
- Accept the first column as the value field (key variants: `"2025 QUOTED JOBS"`, `"2026 QUOTED JOBS"`, or any key containing `"QUOTED"`)
- Map `Company Name` to `company`, `Project Name` to `project`, `Total POs` to `totalPOs`
- Use auto-generated quote number from row index
- Status: check for a `Status` key first; if missing, default to `"pending"`. n8n can pass status if the workflow enriches it (e.g., by reading cell background color via Google Sheets API) -- but for now, default to pending since color isn't readable by standard Read Rows
- Skip summary rows (rows containing "TOTAL", "SUB TOTAL")

**`mapCashflow`** (biggest change):
- Detect transposed format: if rows have keys like `"Feb-26"`, `"Mar-26"` etc., pivot the data
- Build a lookup from row label to row data: `{ "OPENING BALANCES": {...}, "Total Income": {...}, ... }`
- Extract month columns (all keys that match month patterns like `"Feb-26"`, `"Mar-26"`)
- For each month column, construct a `CashflowMonth` object by pulling values from the correct metric rows:
  - `openingBalance` from "OPENING BALANCES" row
  - `totalIncome` from "Total Income" row  
  - `labour` from "Labour Costs" row
  - `tactile` from "Tactile Costs" row
  - `otherProducts` from "Other Costs" row
  - `totalCostOfSales` from "Total Cost of Sales" row
  - `grossProfit` from "Gross Profit" row
  - `totalEmploymentExpenses` from "Total Salaries" row
  - `totalOperatingExpenses` from "Total Operating Expenses" row
  - `totalOutgoings` from "Total Outgoings" row
  - `gstCollected` from "GST Collected" row
  - `gstPaid` from "GST Paid" row
  - `cashSurplus` from "Anticipated Cash Surplus/(Deficit)" or "Net Operating Cash from Operations" row
  - `closingBalance` from "Closing Balance" row

**`mapRevenue`**:
- Map `COMPANY` to `company`, `PROJECT` to `project`
- Map `VALUE (INCL. GST)` to `valueInclGST`; derive `valueExclGST = valueInclGST / 1.1`
- Map `INVOICE DATE` to `invoiceDate`, `DUE DATE` to `dueDate`
- Map `LABOUR COST` to `labourCost`, `TACTILE COST (GST N/A)` to `tactileCost`, `OTHER PRODUCTS (INCL GST)` to `otherProducts`
- Compute `totalCOGS = labourCost + tactileCost + otherProducts`
- Compute `grossProfit = valueExclGST - totalCOGS`
- No status column: default all to `"pending"`
- Skip the TOTAL summary row at the bottom

**`mapExpenses`**:
- Detect category section headers: rows where cost columns are all empty/zero but `Main Expenses` (or first column) has text like "Essentials", "Office & Misc", "Shared Expenses"
- Track current category as state while iterating rows
- Skip "SUB TOTAL" and "TOTAL" rows
- Map `Main Expenses` to item `name`, `#` or `Payment Date` to `paymentDate`, `Weekly Cost` / `Monthly Cost` / `Yearly Cost` to respective fields

**File: `src/data/mockData.ts`** -- Update `RevenueProject` interface:
- Make `valueExclGST` computed (keep field but document it's derived)
- Make `status` optional with default
- Make `totalCOGS` and `grossProfit` computed

### No n8n Workflow Changes Needed
The existing n8n workflow reading all rows per tab is sufficient. The frontend handles the format differences. The only recommendation for the user is to ensure the n8n workflow returns keys matching the actual sheet column headers (which it does automatically with Read Rows).

### Files Changed

| File | Change |
|------|--------|
| `src/contexts/DashboardDataContext.tsx` | Rewrite all 4 mapper functions + `flexGet` key lists to match actual sheet headers |
| `src/data/mockData.ts` | Minor: make `status` on RevenueProject default to "pending" |

