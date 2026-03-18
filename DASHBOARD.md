# Lovable Dashboard Structure

## Purpose
Frontend visualisation layer for all business metrics.

Does not store data — consumes processed data from n8n.

---

## Pages

### Dashboard (Main)
Displays:
- KPI Cards
- Charts
- Tables

---

### Goals & Targets
- Define targets (revenue, margin, etc.)
- Compare against live data
- Uses formula engine

---

## KPI Cards

- Total Quoted
- Total Won
- Quoted Remaining
- Net Revenue
- Cashflow Position
- Conversion Rate

Issues:
- ~~Net Revenue showing $0~~ **Fixed (frontend)** — column mapping + fallback to `sum(grossProfit)` added
- Cashflow colour logic incorrect
- Total Won toggle incorrect

---

## Charts

- Monthly Cashflow
- Surplus / Deficit
- Gross Profit Margin
- Expense Breakdown

---

## Tables

- Revenue & COGS
- Quoted Jobs

Features:
- Sorting
- Filtering
- Pagination

---

## Formula Engine

- Custom evaluator (no eval)
- Supports:
  - SUM
  - AVG
  - COUNT
  - MAX / MIN
  - FIND
- Runs client-side (current limitation)
- `getFieldValue` helper: resolves column names case-insensitively with trailing-space tolerance, tries multiple known aliases per field

---

## Key Limitations

- No server-side aggregation
- Full reload on each request
- Limited write-back capability
- Debug UI still exposed

---

## Target State

- Fast, cached data
- Server-side KPI calculations
- Clean UI (no debug clutter)
- Actionable dashboard (trigger workflows)
