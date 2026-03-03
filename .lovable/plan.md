

## Plan: Refocus Dashboard to Single Business & Rework Settings for n8n-based Integrations

### What Changes

**1. Dashboard — Single Business Focus**

The current dashboard presents a multi-company fund view (AUM across sectors, deal pipeline with multiple companies, fund performance multiples). We'll refocus it to show operational and financial data for **one business entity**:

- **KPI Stats** → Revenue, Gross Profit, Operating Expenses, Net Profit (single company metrics)
- **Portfolio Chart** → Revenue Trend (monthly revenue vs target)
- **Sector Allocation Chart** → Revenue by Product/Service Line (or Department Cost Breakdown)
- **Cashflow Chart** → Company Cash Inflows vs Outflows
- **Fund Performance Chart** → Profitability Metrics (Gross Margin %, Net Margin %, EBITDA Margin %)
- **Deal Pipeline** → Key Projects / Active Deals tracker (the company's own deals, not fund-level)
- **Header** updated from "Fund III — Q4 2025 Overview" to the company name and period
- **Sidebar** branding updated to reflect single business context

**2. Mock Data Overhaul (`mockData.ts`)**

Replace all fund-level mock data with single-company business data: monthly revenue, expense categories, project pipeline, margin trends, cash position.

**3. Settings — n8n-Mediated Data Sources**

Replace the current 8 generic financial data sources (Bloomberg, PitchBook, etc.) with 3 specific integrations using **n8n as middleware**:

| Source | Purpose | n8n Role |
|--------|---------|----------|
| **Google Sheets** | Financial data, reports, KPIs | n8n workflow fetches sheet data via API |
| **Zoho CRM** | Deals, contacts, pipeline | n8n workflow pulls CRM data |
| **Zoho Projects** | Project timelines, tasks, milestones | n8n workflow syncs project data |

Each data source card will show:
- Connection status
- n8n Webhook URL configuration field
- Data mapping description (what data flows from this source)
- Last sync timestamp
- Manual sync trigger button

A top-level note will explain n8n acts as the integration layer, with a link to n8n setup docs.

**4. Files Modified**

| File | Change |
|------|--------|
| `src/data/mockData.ts` | Replace fund data with single-business data |
| `src/pages/Index.tsx` | Update heading and layout |
| `src/pages/Settings.tsx` | Rebuild with 3 n8n-based sources |
| `src/components/dashboard/PortfolioChart.tsx` | → Revenue Trend chart |
| `src/components/dashboard/SectorAllocationChart.tsx` | → Revenue by Service Line |
| `src/components/dashboard/CashflowChart.tsx` | Update labels for company cashflow |
| `src/components/dashboard/FundPerformanceChart.tsx` | → Profitability Margins chart |
| `src/components/dashboard/DealPipeline.tsx` | → Active Projects/Deals table |
| `src/components/dashboard/StatCard.tsx` | No structural change (reused) |
| `src/components/AppSidebar.tsx` | Update branding |

No new files needed. No route changes.

