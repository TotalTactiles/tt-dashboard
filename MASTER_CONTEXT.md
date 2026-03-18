# MASTER CONTEXT – TT Business Dashboard System

## Purpose of This File

This file is the full system intelligence layer.

It captures:
- assumptions
- architectural decisions
- hidden complexities
- known edge cases
- implementation nuances

This is NOT a working task file.
This is used when deeper reasoning or system-level decisions are required.

---

## Core System Philosophy

- Zoho CRM is the ONLY source of truth
- No manual data entry outside Zoho unless explicitly required
- n8n is the central automation + transformation layer
- Google Sheets is a structured data layer (not a logic engine)
- Lovable is a read-first dashboard (minimal write-back)

---

## Key Architectural Decisions

### 1. Zoho-Centric Model
All data originates from Zoho CRM.

Reason:
- prevents duplication
- ensures consistency
- centralises business operations

---

### 2. n8n as ETL (Not Business Brain)

n8n:
- extracts data from Zoho
- transforms it
- loads it into Sheets / dashboard

It should NOT:
- hold long-term state
- contain complex business rules that cannot be replicated

---

### 3. Google Sheets as Transitional Layer

Sheets exists because:
- fast to build
- flexible
- easy aggregation

BUT:
- it is not scalable long-term
- it introduces risk (race conditions, manual edits)

Future possibility:
→ replace with database or API layer

---

### 4. Lovable as Pure UI Layer

Lovable:
- displays processed data
- triggers workflows
- does not store data

Goal:
- fast
- clean
- operator-friendly

---

## Known System Complexities

### Staged Jobs / Deal Duplication

Problem:
- Zoho may create multiple entries for staged jobs
- Can result in duplicate revenue or pipeline values

Requirement:
- must enforce 1 deal = 1 logical record
- aggregation logic must handle stages correctly

---

### Column Name Sensitivity

Critical issues:
- "Stage " (trailing space) in REVENUE
- "Jobs Stages" vs "Stage"
- "Suprlus" typo in CASHFLOW

Impact:
- breaks formulas
- causes silent KPI errors

---

### Hardcoded Year (2026)

Problem:
- formulas rely on fixed year
- system will break next year

Solution:
- dynamic year handling via SETTINGS or logic

---

### Cashflow Structure

Current:
- transposed (months as columns)

Problems:
- hard to parse
- error-prone

Target:
- row-based structure (CASHFLOW_NORM)

---

### Formula Engine (Frontend Only)

Current:
- runs inside Lovable

Problems:
- backend not aware
- inconsistency risk
- performance issues

Target:
- move calculations into n8n

---

## System Weakness Patterns

- duplication of data between Zoho and Sheets
- repeated webhook triggers
- lack of caching
- lack of error handling
- lack of monitoring
- no authentication on webhooks

---

## Hidden Risks

### Data Drift
If Sheets and Zoho diverge → dashboard becomes unreliable

---

### Silent Failures
n8n failures currently:
- not logged properly
- not alerted

---

### Performance Bottlenecks
- full sheet reload per dashboard request
- no caching
- growing dataset risk

---

### Dependency Fragility

System depends on:
- Zoho
- n8n
- Google Sheets
- Lovable

Failure of any = degraded system

---

## Design Intent (Target System)

- event-driven + scheduled hybrid system
- cached KPI responses
- minimal API calls
- no duplicate data
- backend-controlled calculations
- fast dashboard load (<1–2 seconds)

---

## Future Evolution Path

### Short Term
- fix data integrity
- stabilise workflows
- remove duplication

---

### Medium Term
- introduce caching layer
- add monitoring + alerts
- optimise n8n execution

---

### Long Term
- replace Google Sheets with structured database
- build proper API layer
- scale dashboard performance

---

## How This File Should Be Used

Use when:
- making architectural changes
- debugging complex issues
- system behaviour feels inconsistent
- onboarding new logic

Do NOT use for:
- simple UI fixes
- minor formula changes

---

## Maintenance Rule

This file must be updated when:
- architecture changes
- major workflows change
- system design evolves

It should always reflect the TRUE system state.
