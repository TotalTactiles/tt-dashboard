# Tasks & Implementation Plan

## Current Functionality

### Dashboard (Lovable)

#### KPI Cards (6 cards, formula-driven)
- Total Quoted → QTS SUMMARY (Grand Total)
- Total Won → QTS SUMMARY (PO Received + Completed)
- Quoted Remaining → QTS SUMMARY (Active)
- Net Revenue → REVENUE (totalValue - totalCOGS)
- Cashflow Position → Cashflow (Anticipated Surplus current month)
- Conversion Rate → QTS SUMMARY (CR column)

#### Charts
- Monthly Cash Flow → income vs outgoings (bar + surplus line)
- Cash Surplus/Deficit → green/red area chart
- Gross Profit Margin → line chart with editable target
- Expense Breakdown → pie chart (pending full connection)

#### Data Tables
- Revenue & COGS table → sortable, filterable, margin-based
- Quoted Jobs table → pagination, filters, status colouring

#### Goals & Targets Page
- Create and track goals vs current values
- Auto-populates from formula cache
- Debug panel for formula evaluation

#### Formula Engine
- Custom evaluator (no eval)
- Supports SUM, AVG, COUNT, FIND, MAX, MIN
- Filter operators (=, >=, <=) with date comparison
- Cache layer computes formulas on data arrival

#### Calendar Integration
- Read events from Google Calendar
- Write events via n8n workflow
- CORS handled in n8n

---

### n8n Workflows (Built & Active)

1. Dashboard Data Feed  
   - Webhook → 7 sheets → merge → code → JSON response  

2. Revenue Cost Engine  
   - Zoho deal change → calculate COGS → update REVENUE tab  

3. Zoho Backfill  
   - One-time import of 2026 deals → QUOTES tab  

4. Google Calendar Write  
   - Lovable → create/edit/delete events  

5. Basiq Expenses  
   - In progress (sandbox only)

---

## Known Issues & Weaknesses

### Active Bugs

- ~~Net Revenue showing $0 → REVENUE column mapping issue~~ **Fixed (frontend)**
- ~~Monthly Expenses showing $0 → EXPENSES tab not flowing~~ **Fixed (frontend)**
- ~~Cashflow KPI showing wrong values due to datetime header format~~ **Fixed (n8n v8)**
- ~~Conversion Rate KPI showing wrong value due to curly quote mismatch and decimal format~~ **Fixed (n8n v8)**
- Cashflow card incorrect colour logic (red when positive)
- YLW toggle on Total Won card incorrect
- Zoho Total Costs not writing back correctly

---

### Architectural Weaknesses

- Single webhook pipeline → no fallback if n8n fails
- n8n hosted on single VPS → no redundancy or monitoring
- Google Sheets used as database → risk of race conditions
- Hardcoded year (2026) in formulas → will break next year
- Transposed cashflow structure → fragile parsing
- Formula engine client-side only → backend unaware
- No validation or logging for failed workflows
- Basiq not production-ready
- No webhook security (open endpoints)

---

### Scalability Risks

- Google Sheets performance degradation at scale (>500 rows)
- Full sheet reload on every dashboard request
- No server-side caching → excessive webhook calls
- No pagination or incremental loading

---

## Clean System Design (Target State)

### Design Principles

- Zoho CRM = ONLY source of truth
- n8n = stateless ETL layer (no business logic stored)
- Google Sheets = structured data layer (not logic-heavy)
- Lovable = read-only dashboard (minimal write actions)
- All KPIs computed server-side (n8n)

---

### Improved Architecture

Zoho CRM  
→ n8n (ETL + transformation)  
→ Google Sheets (structured tables)  
→ n8n (aggregation layer)  
→ JSON API  
→ Lovable Dashboard (cached)

---

### Key Improvements

- Replace full reload with scheduled + cached JSON
- Remove hardcoded year → dynamic logic
- Restructure cashflow into row-based format
- Move formula engine to n8n backend
- Add webhook authentication (HMAC)
- Add error monitoring + alerts
- Enable Zoho write-back for costs
- Prepare Basiq for production integration

---

## Phase Plan

### Phase 1 – Data Cleanup (HIGHEST PRIORITY)

#### Frontend (Completed)

- [x] Fix REVENUE column mapping — `revenueProjects` filter/map now uses `getFieldValue` with all known column name variants; heuristic fallback when `_label_isLineItem` is absent
- [x] Fix Net Revenue KPI — fallback to `sum(grossProfit)` from parsed `revenueProjects` when `revenueSummary` is absent or zero
- [x] Fix EXPENSES data flow — filter/map updated to resolve all known column name variants; `expensesSummary` computed from line items when n8n omits it; grand total computed from line items when no GRAND TOTAL row is present
- [x] Add `getFieldValue` helper — case-insensitive, trim-tolerant lookup handles trailing spaces, mixed-case, and alternate column names (e.g. `"Stage "`, `"Jobs Stages"`) without requiring n8n changes

#### Backend / n8n (Remaining)

- [x] Remove duplicate or conflicting data sources
- [x] Standardise all field names across systems in n8n output
- [x] Ensure Zoho is single source of truth

> Completed in n8n Code Node v8. See N8N_WORKFLOWS.md for full change log.

---

> **Phase 1 – Data Cleanup: COMPLETE**
> Frontend: DashboardDataContext resilience improvements (PR merged)
> Backend: n8n Code Node v8 — field normalisation, cashflow row matching, CR percentage conversion, Google Sheets header fixes

---

### Phase 2 – Workflow Optimisation

- Reduce webhook triggers
- Add batching / scheduled updates
- Eliminate duplicate workflow executions
- Add error handling + logging workflows
- Add webhook authentication (HMAC)

---

### Phase 3 – Dashboard Functionality

- Fix KPI card bugs
- Improve filtering and sorting logic
- Ensure accurate real-time data display
- Improve action flows (dashboard → n8n → Zoho)

---

### Phase 4 – UI / UX Polish

- Clean layout and spacing
- Improve usability for sales reps
- Remove unnecessary debug elements
- Improve loading states and responsiveness

---

## Risks & Failure Points

### Critical Risks

- n8n downtime → dashboard unusable
- Google Sheets API limits → data delays
- Data mismatch between Zoho and Sheets
- Formula errors producing incorrect KPIs
- Webhook exposure (no security)

---

### Data Integrity Risks

- No referential integrity between QUOTES and REVENUE
- Duplicate deal cloning from Zoho
- Manual edits in Sheets overriding automation
- Formula definitions stored locally (not shared)

---

### Dependency Risks

- n8n failure → all automation stops
- Zoho failure → no new data
- Google Sheets failure → dashboard blank
- Lovable failure → UI unavailable
- Basiq failure → expenses stop syncing
