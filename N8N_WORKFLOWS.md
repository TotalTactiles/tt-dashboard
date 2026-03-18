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
