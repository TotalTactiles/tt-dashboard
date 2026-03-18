# System Architecture & Data Flow

## Core Components

### Zoho CRM
- Role: Source of truth for all deals/jobs
- Hosted: Zoho Cloud (AU)
- Key Functions:
  - Stores all deal data
  - Tracks pipeline stages (Stage 1–5)
  - Triggers automation via webhook on stage change
- Key Fields:
  - Deal Name
  - Stage
  - Contract Value
  - Closing Date
  - Owner
  - Amount
  - Reason for Loss
  - Total Costs
  - Company
  - Stock Required
  - Current Inventory

---

### n8n (Automation Engine)
- Role: Central automation and transformation layer
- Hosted: Self-hosted VPS
- Responsibilities:
  - Receives webhook from Zoho
  - Transforms and routes data
  - Writes to Google Sheets
  - Sends data to Lovable dashboard
  - Handles all system integrations
- Workflow Pattern:
  - Webhook → Extract → Transform → Merge → Process → Respond

---

### Google Sheets (TT Business 2026)
- Role: Operational data layer and calculation engine
- Hosted: Google Cloud
- Purpose:
  - Stores structured data from Zoho
  - Performs calculations and summaries
- Structure:
  - QTS
  - SUMMARY
  - REVENUE
  - Cashflow
  - EXPENSES
  - LABOUR
  - STOCK & INVENTORY
- Notes:
  - Acts as a structured database replacement
  - Uses formulas (COUNTIFS, SUMIFS) for calculations

---

### Lovable Dashboard
- Role: Frontend dashboard (visualisation + limited actions)
- Hosted: Lovable / GitHub
- Stack:
  - React
  - TypeScript
  - Tailwind CSS
  - shadcn/ui
- Function:
  - Displays processed data from Google Sheets via n8n
  - Calls n8n webhook on load/refresh
  - Allows limited write actions (e.g. calendar updates)
- Notes:
  - Does NOT store data
  - Purely a consumer of processed data

---

### Google Calendar
- Role: Job scheduling and appointment tracking
- Hosted: Google Cloud
- Function:
  - Receives updates from n8n
  - Syncs job scheduling data

---

### Basiq API
- Role: Bank transaction data (in progress)
- Hosted: Basiq Cloud
- Function:
  - Provides financial transaction data
  - Integrated into n8n workflows

---

## Data Flow (Critical)

### Primary Flow (Left → Right)

Zoho CRM  
→ (Webhook trigger on stage change)  
→ n8n  
→ Google Sheets  
→ n8n (read/transform)  
→ Lovable Dashboard  

---

### Reverse / Action Flow

Lovable Dashboard  
→ n8n webhook  
→ Zoho CRM or Google Calendar  

---

## System Logic

- Zoho CRM = Single source of truth
- n8n = Central processing and automation engine
- Google Sheets = Data layer + calculation engine
- Lovable = Visualisation layer only

---

## Key Principles

- Data flows strictly left to right
- No manual data entry outside Zoho CRM
- Google Sheets is not a source of truth — only a processing layer
- Lovable does not store or manipulate core data
- n8n controls all transformations and integrations

---

## Current Weak Points (Important)

- Potential duplication between Zoho and Google Sheets
- Heavy reliance on webhook triggers (risk of overuse)
- Some workflows may execute multiple times unnecessarily
- Google Sheets acting as both storage and logic layer (can become messy)
- Limited write-back capability from dashboard
- Scaling risk if data volume increases significantly

---

## Target State

- Clean, single-direction data flow
- Minimal webhook usage (optimised triggers)
- No duplicated data across systems
- Google Sheets structured like a database (clear schema)
- n8n workflows optimised and non-redundant
- Lovable dashboard fast, responsive, and action-driven
