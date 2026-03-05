

## Plan: Add Forecasts Line Chart Card

### What
A new dashboard card titled "Forecasts" containing a multi-line chart showing 5 series from the Cashflow tab across all months:

1. **Total Outgoings** (red)
2. **Anticipated Cash Surplus/(Deficit)** (green)
3. **Cost of Jobs Probable To Be Won** (orange)
4. **Jobs Probable To Be Won** (blue)
5. **Anticipated Cash Surplus/(Deficit) Including Probable Jobs** (yellow/gold)

### Data Extraction — `src/contexts/DashboardDataContext.tsx`

- Add a `ForecastChartPoint` interface with fields for each series plus `month`
- In `mapCashflow`, the `buildRowLookup` already has access to these rows. Extract the 5 metrics per month column using `getMetricValue` with label variants matching the sheet exactly (e.g. `"Total Outgoings"`, `"Anticipated Cash Surplus/(Deficit)"`, `"Cost of Jobs Probable To Be Won"`, `"Jobs Probable To Be Won"`, `"Anticipated Cash Surplus/(Deficit) Including Probable Jobs"`)
- Build `forecastChartData: ForecastChartPoint[]` from all month columns (including future months with data)
- Expose via `DashboardData` interface and context

### New Component — `src/components/dashboard/ForecastChart.tsx`

- Line chart (Recharts `LineChart`) with 5 `<Line>` elements, each a different color
- Legend at top showing color + label for each series
- Same dark styling as existing charts (dark tooltip, mono font, grid)
- Wrapped in `motion.div` for consistency

### Layout — `src/pages/Index.tsx`

- Add `ForecastChart` as a full-width card below the existing cashflow/performance row

### Files Changed

| File | Change |
|------|--------|
| `src/contexts/DashboardDataContext.tsx` | Add `ForecastChartPoint`, extract forecast series from cashflow lookup, expose in context |
| `src/components/dashboard/ForecastChart.tsx` | New multi-line chart component |
| `src/pages/Index.tsx` | Import and render ForecastChart |

