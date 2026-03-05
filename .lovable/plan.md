

## Plan: Header-Based Data Mapping for Reliable Google Sheets Integration

### Problem
As rows are added to Google Sheets, fixed cell references break. Data must be read by **column header name**, not cell position, so the dashboard always maps correctly regardless of how many rows exist.

### Solution: Two-Part Fix

**Part 1 — n8n Workflow Configuration (no code change, user action)**

The n8n "Google Sheets" nodes must use **"Read Rows"** operation (not "Read Cell"), reading entire sheet tabs. This returns all rows as objects keyed by header name — so adding rows never breaks anything.

Required headers per tab:

```text
Tab: Quotes
Headers: Quote Number | Company | Project | Value (excl GST) | Total POs | Status | Date Quoted | Notes

Tab: Cashflow
Headers: Month | Opening Balance | Total Income | Labour | Tactile | Other Products | Total COS | Gross Profit | Total Employment | Total Operating | Total Outgoings | GST Collected | GST Paid | GST Owing | Cash Surplus | Closing Balance

Tab: Expected Revenue
Headers: Company | Project | Value (incl GST) | Value (excl GST) | Invoice Date | Due Date | Labour Cost | Tactile Cost | Other Products | Total COGS | Gross Profit | Status

Tab: Business Expenses
Headers: Category | Name | Payment Date | Weekly Cost | Monthly Cost | Yearly Cost
```

The existing `flexGet` mapper in `DashboardDataContext.tsx` already handles variations of these header names (Title Case, camelCase, snake_case). No changes needed there.

**Part 2 — Code Improvements (3 changes)**

1. **`src/contexts/DashboardDataContext.tsx`** — Add row-level validation: skip rows where all key fields are empty (handles blank/spacer rows in sheets). Add a `dataHealth` object that reports per-section whether data was received and how many rows mapped successfully, so the UI can distinguish "no data source" from "connected but empty sheet."

2. **`src/components/dashboard/NoData.tsx`** — Update to show different messages: "No data source connected" vs "Connected but no rows found" vs "Connected — check sheet headers" (when data arrives but maps to all zeros).

3. **`src/pages/Index.tsx`** — Add a small diagnostic banner (dev-only or togglable) showing which data sections have data and row counts, helping users verify their sheet headers match.

### Why This Works Long-Term
- n8n reads **all rows** from each tab using headers — adding rows is automatic
- `flexGet` handles header name variations without breaking
- Row validation skips blank/separator rows
- `dataHealth` feedback tells users exactly what's connected vs missing
- No second n8n workflow needed — the existing single workflow with 4 "Read Rows" nodes (one per tab) merged into a single JSON response is sufficient

### Files Changed

| File | Action |
|------|--------|
| `src/contexts/DashboardDataContext.tsx` | Update — add row validation + `dataHealth` reporting |
| `src/components/dashboard/NoData.tsx` | Update — contextual empty-state messages |
| `src/pages/Index.tsx` | Update — optional data health indicator |

