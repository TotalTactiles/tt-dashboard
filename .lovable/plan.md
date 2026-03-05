

## Plan: Fix "Anticipated Cash Surplus/(Deficit) Including Probable Jobs" Data Extraction

### Root Cause

The `getMetricValue` function does exact uppercase string matching against lookup keys. The Google Sheet label likely contains subtle differences (extra spaces, different parentheses, or slight wording variations) that none of the current aliases match. Since the console.log debug line isn't producing visible output (possibly the data source isn't connected in the current preview session), we can't see the actual keys.

### Solution

Make `getMetricValue` use **fuzzy/partial matching** as a fallback when exact matching fails. Specifically for this metric, add a fallback that searches lookup keys containing both `"SURPLUS"` and `"PROBABLE"` — which uniquely identifies this row.

Additionally, add a computed fallback: if no row matches, calculate this value as `anticipatedSurplus + probableJobs - costProbableJobs` (which is the formula the sheet itself uses).

### Changes — `src/contexts/DashboardDataContext.tsx`

**1. Add a `getMetricValueFuzzy` helper** that falls back to partial key matching when exact match fails:
```typescript
function getMetricValueFuzzy(lookup: Record<string, any>, monthKey: string, partialKeys: string[], ...labelVariants: string[]): number {
  // Try exact match first
  const exact = getMetricValue(lookup, monthKey, ...labelVariants);
  if (exact !== 0) return exact;
  // Fuzzy: find a key containing ALL partial strings
  const matchKey = Object.keys(lookup).find(k => partialKeys.every(p => k.includes(p)));
  if (matchKey && lookup[matchKey][monthKey] !== undefined) {
    return parseNum(lookup[matchKey][monthKey]);
  }
  return 0;
}
```

**2. Update `surplusIncludingProbable` extraction** (line 577) to use the fuzzy helper with partial keys `["SURPLUS", "PROBABLE"]`, plus keep existing aliases.

**3. Add computed fallback**: If fuzzy still returns 0 but `anticipatedSurplus` has data, compute `surplusIncludingProbable = anticipatedSurplus + probableJobs - costProbableJobs`.

### Files Changed

| File | Change |
|------|--------|
| `src/contexts/DashboardDataContext.tsx` | Add `getMetricValueFuzzy`; update `surplusIncludingProbable` to use fuzzy + computed fallback |

