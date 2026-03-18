# Google Sheets Structure (TT Business 2026)

## Purpose
Acts as a structured data layer and calculation engine between Zoho CRM and the Lovable dashboard.

Not a source of truth — only a processing layer.

---

## Tabs Overview

### QTS (Quotes Table)
Purpose:
- Stores all deal/job records from Zoho CRM

Key Columns:
- Deal Name (Primary Identifier)
- Stage
- Contract Value
- Closing Date
- Owner
- Company
- Total Costs
- Stock Required
- Current Inventory

Notes:
- Each row = one deal
- Must remain unique (no duplicates)
- Used for pipeline + conversion metrics

---

### SUMMARY (QTS SMMRY)
Purpose:
- Aggregated KPI calculations

Key Metrics:
- Total Quoted
- Total Won
- Active Deals
- Conversion Rate

Notes:
- Uses COUNTIFS / SUMIFS logic
- Sensitive to exact column names (e.g. "Jobs Stages")

---

### REVENUE
Purpose:
- Tracks revenue + cost + margin per deal

Key Columns:
- Deal Name (link to QTS)
- Total Value
- Total COGS
- Net Revenue

Important:
- Column header "Stage " may contain trailing space (must match exactly)
- Used for KPI cards and revenue tables

---

### CASHFLOW (Current Format – Problematic)
Purpose:
- Monthly cashflow tracking

Current Issues:
- Transposed structure (months as columns)
- Difficult to parse programmatically
- Contains typo "Suprlus"

---

### CASHFLOW_NORM (Target Structure)
Purpose:
- Normalised cashflow format

Structure:
- Month (MMM-YY)
- Incoming
- Outgoing
- Surplus

Benefits:
- Easier parsing in n8n
- Supports aggregation and filtering

---

### EXPENSES
Purpose:
- Tracks business expenses

Key Columns:
- Date
- Category
- Amount

Issues:
- Not fully connected to dashboard
- Missing data flow into KPI cards

---

### LABOUR
Purpose:
- Labour cost tracking

---

### STOCK & INVENTORY
Purpose:
- Tracks materials required vs available

---

### CACHE (Planned)
Purpose:
- Store precomputed KPI values

Benefits:
- Reduces repeated full-sheet calculations
- Improves dashboard load speed

---

### SETTINGS (Planned)
Purpose:
- Store configurable values

Examples:
- Target margins
- Financial goals
- Year selection (replace hardcoded 2026)

---

## Key Rules

- Zoho CRM = single source of truth
- Google Sheets = structured processing layer only
- No manual edits unless explicitly required
- All calculations should be reproducible in n8n (not only Sheets)

---

## Known Issues

- Duplicate deal entries (especially staged jobs)
- Hardcoded year (2026)
- Column naming inconsistencies
- Cashflow structure difficult to process
