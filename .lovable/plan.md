

## Plan: Fix Forecast Chart Labels, Data & Colors

### Issue
The image from the Google Sheet shows these exact row labels:
1. **Total Outgoings** (red background)
2. **Anticipated Cash Surplus/(Deficit)** (green background)
3. **Cost of Jobs Probable To Be Won** (yellow background)
4. **Jobs Probable To Be Won** (yellow background)
5. **Anticipated Cash Surplus/(Deficit) Including Probable Jobs** (yellow background)

"Jobs Probable To Be Won" values include 0, 0, 0, 60032, 92422, 0... — these are positive values, so `Math.abs` is not needed but the label aliases may be missing a match. Also need to add a debug log of lookup keys to verify.

### Changes

#### `src/components/dashboard/ForecastChart.tsx`
Update the SERIES array:
- `totalOutgoings`: **red** `hsl(0, 70%, 55%)` — keep
- `anticipatedSurplus`: **dark green** `hsl(145, 63%, 32%)`
- `costProbableJobs`: **orange** `hsl(30, 85%, 55%)` — keep
- `probableJobs`: **yellow** `hsl(45, 90%, 55%)`
- `surplusIncludingProbable`: **light green** `hsl(145, 63%, 55%)`, update label to full text "Anticipated Cash Surplus/(Deficit) Including Probable Jobs"

#### `src/contexts/DashboardDataContext.tsx`
- Add more alias variants for `probableJobs`: `"Revenue From Jobs Probable To Be Won"`, `"Probable Jobs"`, etc.
- Add a temporary `console.log` of the cashflow lookup keys so we can verify exact labels
- Keep `surplusIncludingProbable` label with "Surplus" spelling variant as alias

### Files Changed

| File | Change |
|------|--------|
| `src/components/dashboard/ForecastChart.tsx` | Update colors (2 greens, 1 yellow, 1 orange, 1 red) and full label text |
| `src/contexts/DashboardDataContext.tsx` | Add alias variants for probableJobs; add debug console.log |

