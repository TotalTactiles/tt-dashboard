
Goal: make the dashboard reliably show all cards from n8n data, with zero silent failures.

What I tested just now
1) I executed your live backend proxy endpoint directly with your configured n8n webhook.
2) Result was HTTP 200 (transport is working), but payload content is:
   - cashflow: populated
   - quotes: []
   - revenue: []
   - expenses: []
3) This proves the dashboard is not the primary blocker right now; n8n is returning empty arrays for 3/4 required datasets, so cards depending on those datasets cannot populate (including Total Quoted).

Why Total Quoted still shows no data
- `Total Quoted` is derived from `liveData.quotes`.
- Your current n8n response has `quotes: []`, so quote summary extraction cannot produce totals.
- Same problem exists for revenue/expense-driven widgets because those arrays are also empty.

Implementation plan to fully fix and harden

1) Repair n8n workflow output contract (primary fix)
- Keep a single POST webhook workflow that returns one JSON object with exactly:
  - `quotes` (array)
  - `cashflow` (array)
  - `revenue` (array)
  - `expenses` (array)
- In n8n, use explicit node references in the Code node (not pass-through input):
  - `$('GS Quotes').all().map(i => i.json)`
  - `$('GS Cashflow').all().map(i => i.json)`
  - `$('GS Revenue').all().map(i => i.json)`
  - `$('GS Expenses').all().map(i => i.json)`
- Ensure the workflow path is connected end-to-end:
  Webhook -> all sheet reads -> Code -> Respond to Webhook.
- Ensure tab names match actual spreadsheet tabs exactly:
  Quotes, Cashflow, Revenue & COGS (or Expected Revenue if that is your actual tab), Business Expenses.

2) Normalize quotes/revenue/expenses in n8n before returning
- In Code node, normalize inconsistent headers so frontend parsing is deterministic:
  - quotes: ensure a value field containing `QUOTED` key (e.g., `QUOTED_VALUE`) and count field (e.g., `QUOTED_COUNT`) exist.
  - ensure summary label rows are preserved for:
    `TOTAL QUOTED`, `TOTAL QUOTED WON`, `TOTAL QUOTED LOST`, `TOTAL YELLOW`, `QUOTED REMAINING`.
- Do not strip rows that look like totals; dashboard summary logic depends on them.

3) Add strict payload validation in app (to prevent silent bad sync)
Files to update:
- `src/hooks/useDataSources.ts`
- `src/pages/Settings.tsx`
Changes:
- Validate response schema after proxy call:
  - must include all 4 keys
  - each key must be an array
- If any required key is missing or unexpectedly empty while source is connected, set a clear `lastError` like:
  - “n8n payload invalid: quotes is empty”
  - “n8n payload invalid: missing revenue key”
- Keep successful partial data from prior sync instead of overwriting with empties (prevents cards from dropping to no-data during bad workflow runs).

4) Add visible diagnostics for distribution accuracy
Files to update:
- `src/pages/Settings.tsx`
- (optional small helper in `src/contexts/DashboardDataContext.tsx`)
Changes:
- Reintroduce a compact “Raw Payload Inspector” in Settings showing:
  - counts: quotes/cashflow/revenue/expenses
  - first 1–2 sample rows per section
  - mapped counts from `dataHealth` (raw vs mapped)
- This makes it obvious whether issue is n8n extraction vs frontend mapping.

5) Tighten frontend mapping tolerance (secondary hardening)
File to update:
- `src/contexts/DashboardDataContext.tsx`
Changes:
- Extend quote summary extraction to accept alternate label variants and trim whitespace aggressively.
- Expand quote value/count key detection to accept known aliases (e.g., Total Value, Jobs, Count) if `QUOTED_*` keys are absent.
- Keep current summary-first logic (source-of-truth totals from summary rows).

6) End-to-end verification checklist (must pass before closing)
- Save & Test Google Sheets source -> success.
- Inspector shows non-zero arrays for all 4 keys.
- `dataHealth`:
  - quotes healthy
  - cashflow healthy
  - revenue healthy
  - expenses healthy
- Dashboard cards:
  - Total Quoted, Total Won, Quoted Remaining show expected values/counts.
  - Revenue table populated.
  - Expense charts populated.
  - Deal Pipeline populated.
- Trigger Sync Now 2 times; values remain stable and no section regresses to empty.

Scope summary
- No database schema change required for this issue.
- Core fix is n8n workflow output correctness + app-side payload validation to stop silent bad syncs.
