

## Plan: Fix Screenshot Upload RLS & Improve Quote Data Extraction

### Issue 1: Screenshot Upload Fails — RLS Policy

The storage bucket `reference-screenshots` has an INSERT policy restricted to `authenticated` users, but this app has **no authentication system**. Uploads fail with "new row violates row-level security policy."

**Fix:** Replace the authenticated-only INSERT policy with one that allows anonymous uploads. Since the bucket is already public-read and contains non-sensitive reference images, this is safe.

**SQL Migration:**
```sql
DROP POLICY "Authenticated upload" ON storage.objects;
CREATE POLICY "Anyone can upload reference screenshots" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'reference-screenshots');

DROP POLICY "Authenticated delete" ON storage.objects;  
CREATE POLICY "Anyone can delete reference screenshots" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'reference-screenshots');
```

### Issue 2: Quote Summary Extraction Missing Count Values

The screenshot shows the Google Sheet has both **dollar values** and **counts** for each summary row (e.g., Total Quoted = $1,003,892.39 / 33 jobs, Total Yellow = $152,453.96 / 4 jobs). Currently `extractQuoteSummaryFromRaw` only extracts the dollar value from the "QUOTED" column but ignores the count column.

**Fix in `src/contexts/DashboardDataContext.tsx`:**

1. **Add count fields to `QuoteSummary`** (`totalQuotedCount`, `totalWonCount`, `totalLostCount`, `totalYellowCount`, `quotedRemainingCount`) in `src/data/mockData.ts`.

2. **Update `extractQuoteSummaryFromRaw`** to also extract the count column value (the column that isn't the label and isn't the "QUOTED" value column — likely a numeric column on the right side).

3. **Add "TOTAL YELLOW" extraction** — the current code doesn't extract this summary row at all. Add it alongside the existing ones.

4. **Update KPI stat cards** to include Total Won, Total Yellow, Total Lost, and Quoted Remaining as additional stat cards or sub-values, since these are key metrics visible in the source sheet.

### Issue 3: KPI Stats Don't Show All Quote Breakdown Values

Currently only 4 KPI cards show: Total Quoted, Net Revenue, Cashflow Position, Conversion Rate. The quote breakdown (Won, Lost, Yellow, Remaining) from the sheet should be surfaced.

**Fix in `src/contexts/DashboardDataContext.tsx`:**
- Add Total Won and Quoted Remaining to the KPI stats array so they appear as dashboard stat cards
- These map directly to the "Total Quoted Won" and "Quoted Remaining" rows in the sheet

### Files Changed

| File | Change |
|------|--------|
| SQL Migration | Drop authenticated-only policies, allow public uploads/deletes on `reference-screenshots` bucket |
| `src/data/mockData.ts` | Add count fields and `totalYellow` to `QuoteSummary` interface |
| `src/contexts/DashboardDataContext.tsx` | Extract counts + Total Yellow from raw data; add Won/Remaining to KPI stats; update kpiVariables |

