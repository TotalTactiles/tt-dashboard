# n8n Workflow Architecture

## Purpose
Central automation and ETL layer connecting Zoho, Google Sheets, and Lovable.

---

## Workflow 1 – Dashboard Data Feed

Trigger:
- Webhook from Lovable dashboard

Process:
1. Fetch all required Google Sheets tabs
2. Merge datasets
3. Transform data into dashboard format
4. Return JSON response

Issues:
- Full reload on every request
- No caching
- Performance risk at scale

### Code Node Version History

**v8 (current) — Phase 1 Backend cleanup**
- Added `normaliseMonthKey()` helper: converts datetime-format cashflow headers
  (e.g. `2026-01-26 00:00:00`) to `Mon-YY` format before processing.
  Fixes cashflow KPI and chart data being silently empty.
- Added `normaliseQuotes()` helper: strips Unicode smart/curly quotes from
  column key names before lookup. Fixes CR column not being read from QTS SMMRY.
- Added `getAnyKey()` helper: tries multiple key variants in sequence.
- Rebuilt `findCashflowRow()` with exact-match priority to prevent partial match
  collisions. Fixes `anticipatedSurplusWithJobs` and `jobsProbable` mapping to
  wrong rows.
- `conversionRate` now normalised to percentage integer before output
  (decimal × 100 if raw value ≤ 1). Fixes Conversion Rate KPI displaying as
  `0.33%` instead of `32.6%`.
- REVENUE section: removed trailing-space fallback on `Stage` column lookup.
  Sheet header corrected to `Stage` (no trailing space).
- QTS SMMRY rows pre-normalised via `normaliseQuotes()` before field mapping.

**v6/v7 — baseline (pre Phase 1)**
- Original workflow. Cashflow month detection used regex only (no datetime support).
- CR column lookup used hardcoded straight-quote key (failed against curly quotes).
- `findCashflowRow()` used bidirectional partial match (caused row collisions).

---

## Workflow 2 – Revenue & Cost Engine

Trigger:
- Zoho deal stage change

Process:
1. Receive deal data
2. Calculate COGS
3. Update REVENUE tab in Google Sheets
4. (Optional) Write cost data back to Zoho

Key Logic:
- Must ensure 1 deal = 1 record
- Handle staged jobs (no duplication)

---

## Workflow 3 – Zoho Backfill

Purpose:
- One-time import of historical deals

---

## Workflow 4 – Calendar Sync

Trigger:
- Lovable dashboard actions

Process:
- Create / update / delete Google Calendar events

---

## Workflow 5 – Basiq Expenses (In Progress)

Purpose:
- Pull bank transactions into EXPENSES

Status:
- Sandbox only

---

## Workflow 6 – Error Monitoring (Planned)

Purpose:
- Detect failed workflows
- Send alerts (Slack/Email)

---

## Security (Required Upgrade)

- Implement HMAC webhook authentication
- Prevent open endpoints

---

## Key Issues

- Duplicate executions
- No retry logic
- No monitoring
- Heavy reliance on webhooks
- No caching layer

---

## Target State

- Event-driven + scheduled hybrid model
- Cached KPI responses
- Minimal webhook usage
- Full logging + error tracking
