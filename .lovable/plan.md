## Root cause (verified)

`stock_planning` has 6 columns: `id, project_id, line_label, amount, source, cost_bucket`. There is no `created_at` column, so the query `.order("created_at", { ascending: true })` returns a PostgREST error and `data` is `null` — the component falls through to `rows = []` and renders `EmptyState`. Nothing is being filtered; the query is failing.

## Fix

In `src/components/projects/tables/StockPlanningTable.tsx`, replace the `created_at` ordering with an ordering the table actually supports, and keep the client-side bucket sort as a pure reorder (no filtering).

- Order the query by `id` ascending — deterministic and stable, and acts as "creation order" for uuidv4-ish inserts as well as any order the sheet-seeded rows already have.
- Keep the bucket ranking: `tactile` → 0, `other` → 1, everything else (including `NULL`) → 2.
- Preserve `NULL` bucket rows explicitly: `bucketRank(null)` returns 2, so those rows sort last but are never dropped.
- Sort using the index-tagged pattern already in place (`map` → `sort` → `map`), which is a pure reorder — every input row appears in the output.
- `EmptyState` continues to render only when `rows.length === 0`, which now happens only when the query genuinely returns zero rows.

No other changes: no schema, no other files, no renamed keys, callback props stay wrapped, live stock routing untouched (this table doesn't use it).

## Verify

- A project with existing planning rows renders every row, including any with `cost_bucket = NULL`.
- Order is Tactile block, then Other block, then NULL block; within each block, rows keep the order the query returned.
- A project with zero planning rows still shows the empty state.
- No console error from PostgREST about an unknown `created_at` column.
