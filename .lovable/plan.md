

## Plan: Connect Dashboard to n8n Webhook Data

### The Problem
The n8n Code node wraps its output in an outer array: `[{ json: { quotes, cashflow, revenue, expenses } }]`. The proxy passes raw text through, so the frontend receives an array instead of the expected object. This means `responseData.quotes` is `undefined` and all cards show "no data."

Additionally, the cashflow mapper reads month values from raw row keys (strings) instead of the pre-parsed `_label_monthData` object, and quote/revenue filtering doesn't use all the doc-specified field names.

### Changes

**File 1: `supabase/functions/n8n-proxy/index.ts`**
- After fetching the n8n response, parse it as JSON
- If result is an array, unwrap to `result[0]`
- If the unwrapped object has a `.json` key (n8n Code node convention), unwrap to `.json`
- Return the clean `{ quotes, cashflow, revenue, expenses, _meta }` object

**File 2: `src/hooks/useDataSources.ts`**
- After receiving `responseData` from the proxy, add a safety-net unwrap: if it's still an array, access `[0]`, then `.json` if present
- This ensures the dashboard works regardless of proxy behavior

**File 3: `src/contexts/DashboardDataContext.tsx`**

- **`getMetricValue`**: Also check `row._label_monthData?.[monthKey]` before falling back to `parseNum(row[monthKey])` — this uses the pre-parsed numeric values from n8n
- **`buildRowLookup`**: When a duplicate label exists, prefer the row with the higher `row_number` (handles the two "Total Operating Expenses" rows — row 54 overwrites row 53)
- **`mapQuotes`**: Also check `r._company` field (doc uses this alongside `_label_company`) for filtering real jobs
- **`mapRevenue`**: Add `_label_isLineItem === true` as primary filter; skip rows where `_label_isHeader === true`
- **`mapQuotes` filter**: Use `!r._label_isSummaryRow && (r._company || company)` pattern from the doc

### What stays the same
All existing fallback logic for non-labelled payloads is preserved. The `_label_*` fields are checked first; if absent, the current flex-matching continues to work.

