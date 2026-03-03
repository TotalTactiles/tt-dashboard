

## Plan: Align Dashboard Data Model to Actual Google Sheets Structure

### The Problem
The current dashboard uses generic mock data (Revenue MRR, Consulting/Licensing service lines) that doesn't match your actual business data. Your Google Sheets have 4 distinct tabs with specific structures that need to be mirrored exactly.

### Your Actual Data Structure (from the sheets)

| Sheet Tab | Key Data | Dashboard Mapping |
|-----------|----------|-------------------|
| **Quotes** | Quoted jobs list, company, project, value, status (won/lost/yellow), conversion rates, forecasted revenue | KPI stats, Deal Pipeline, Conversion funnel chart |
| **Cashflow** | Monthly: Opening Balance, Sales/Income, Cost of Sales, Gross Profit, Employment Expenses, Operating Expenses, GST, Balance Sheet, Cash Surplus/Deficit | Cashflow chart, Profitability chart |
| **Expected Revenue (Revenue & COGS)** | Per-project: Company, Project, Value (incl GST), Invoice Date, Due Date, Labour Cost, Tactile Cost, Other Products | Revenue trend chart, Project-level revenue table |
| **Business Expenses** | Essentials, Office & Misc, Shared Expenses, Employee Expenses — weekly/monthly/yearly costs | Expense breakdown chart, Operating cost cards |

### What Changes

**1. Replace mock data with sheet-aligned interfaces (`mockData.ts`)**

Define TypeScript interfaces matching each tab exactly:
- `QuotedJob` — id, value, company, project, totalPOs, status (won/lost/pending/yellow)
- `QuoteSummary` — totalQuoted, totalWon, totalLost, quotedRemaining, conversionRate, grossRevenue, costOfGoods, labourCost, netRevenue
- `CashflowMonth` — month, openingBalance, totalIncome, costOfSales (labour/tactile/other), grossProfit, employmentExpenses (per person), operatingExpenses (itemised), totalOutgoings, cashSurplus, closingBalance
- `RevenueProject` — company, project, valueInclGST, invoiceDate, dueDate, labourCost, tactileCost, otherProducts
- `ExpenseCategory` — category, items (name, paymentDate, weeklyCost, monthlyCost, yearlyCost)

KPI stats updated to: **Total Quoted**, **Gross Revenue (excl GST)**, **Net Revenue (excl GST)**, **Cash Surplus/Deficit**

**2. Update dashboard components**

| Component | New Purpose |
|-----------|------------|
| `StatCard` row | Total Quoted, Net Revenue, Cash Surplus, Conversion Rate |
| `PortfolioChart` | Monthly Total Income vs Total Outgoings (from Cashflow tab) |
| `SectorAllocationChart` | Expense breakdown by category (Essentials, Office, Shared, Employee) |
| `CashflowChart` | Monthly Cash Surplus/Deficit with opening/closing balances |
| `FundPerformanceChart` | Gross Profit margin trend by month |
| `DealPipeline` | Quoted Jobs table with status colour coding (green=won, yellow=90%, red=lost, white=pending) |

**3. Add new components**

- `RevenueProjectsTable` — table from the Expected Revenue tab showing per-project revenue, costs, and due dates
- `ExpenseBreakdown` — categorised expense view from Business Expenses tab

**4. Update Settings data mapping per Google Sheets tab**

The Google Sheets data source in Settings will show **per-tab mapping** so the user knows exactly which sheet tab maps to which dashboard section. Each tab gets its own webhook URL field if desired, or one webhook returns all tabs.

**5. n8n Workflow Design for Dynamic Growth**

The n8n workflow will be designed to handle growing data by:
- Reading **all rows** from each tab (not a fixed range) — the Google Sheets node's "Read Rows" operation returns all populated rows automatically
- Using the **header row** as JSON keys, so new columns are automatically included
- The webhook response returns a structured JSON object with one key per tab: `{ quotes: [...], cashflow: [...], expectedRevenue: [...], expenses: [...] }`
- The dashboard parses whatever fields exist and gracefully ignores unknown ones
- A `lastUpdated` timestamp and `sheetMetadata` (tab names, row counts) are included so the dashboard can show data freshness

### Technical Detail: n8n Setup for Multi-Tab Sheets

In the Settings info banner, we'll add clear guidance:

```
n8n Workflow Structure:
1. Webhook Trigger (POST)
2. Google Sheets node — "Quotes" tab → Read All Rows
3. Google Sheets node — "Cashflow" tab → Read All Rows  
4. Google Sheets node — "Revenue & COGS" tab → Read All Rows
5. Google Sheets node — "Business Expenses" tab → Read All Rows
6. Merge node (Append) → Combine into structured JSON
7. Respond to Webhook → Return { quotes, cashflow, revenue, expenses }
```

Each Google Sheets node uses "Read Rows" with no row limit, meaning as the business adds more quoted jobs or expense lines, they're automatically included on the next sync.

### Files Modified

| File | Change |
|------|--------|
| `src/data/mockData.ts` | Replace with sheet-aligned interfaces and realistic mock data |
| `src/pages/Index.tsx` | Updated layout with new component arrangement |
| `src/components/dashboard/StatCard.tsx` | No change (reused) |
| `src/components/dashboard/PortfolioChart.tsx` | Income vs Outgoings trend |
| `src/components/dashboard/SectorAllocationChart.tsx` | Expense category breakdown |
| `src/components/dashboard/CashflowChart.tsx` | Cash surplus/deficit with balances |
| `src/components/dashboard/FundPerformanceChart.tsx` | Gross profit margin trend |
| `src/components/dashboard/DealPipeline.tsx` | Quoted jobs table with status colours |
| `src/pages/Settings.tsx` | Per-tab mapping display and n8n workflow guidance |

**New files:**
| File | Purpose |
|------|---------|
| `src/components/dashboard/RevenueProjectsTable.tsx` | Expected Revenue tab as a sortable table |
| `src/components/dashboard/ExpenseBreakdown.tsx` | Categorised expense summary cards |

