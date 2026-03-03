

## Plan: Live Auto-Syncing Data Sources + Zoho Setup Instructions

### Problem
The Settings page toggles and Save/Sync buttons are cosmetic — they update local React state but don't persist webhook URLs, don't actually fetch data from n8n, and don't auto-poll. The dashboard always shows hardcoded mock data regardless of settings.

### What This Plan Delivers

1. **Persistent webhook configuration** saved to `localStorage` so settings survive page refreshes
2. **Real data fetching** — Save + toggle-on triggers an actual `fetch()` to the webhook URL
3. **Auto-polling every 5 minutes** when a source is enabled, running 24/7 with no human intervention
4. **Dashboard consumes live data** when available, falling back to mock data when not
5. **Detailed Zoho CRM & Zoho Projects n8n setup instructions** embedded in the Settings UI as expandable guides (with correct homepage URLs, OAuth redirect URIs, and scope requirements)

### Architecture

```text
Settings page
  ├── User enters webhook URL + clicks Save
  ├── Config saved to localStorage
  ├── Toggle ON → immediate fetch + starts 5-min interval
  └── Toggle OFF → stops interval, clears live data

useDataSources hook (new)
  ├── Reads saved configs from localStorage
  ├── On mount: for each enabled source, fetch webhook + start setInterval(300000)
  ├── Stores fetched data in React state + localStorage cache
  ├── Exposes: liveData, lastSync timestamps, loading/error states
  └── Dashboard components consume liveData ?? mockData
```

### New Files

| File | Purpose |
|------|---------|
| `src/hooks/useDataSources.ts` | Core hook: loads saved webhook configs, fetches data from n8n endpoints, runs auto-poll intervals, caches results in localStorage, exposes live data with fallback to mock |
| `src/components/settings/ZohoCrmSetupGuide.tsx` | Expandable step-by-step guide for Zoho CRM n8n workflow setup |
| `src/components/settings/ZohoProjectsSetupGuide.tsx` | Expandable step-by-step guide for Zoho Projects n8n workflow setup |
| `src/components/settings/GoogleSheetsSetupGuide.tsx` | Expandable step-by-step guide for Google Sheets n8n workflow (already partially shown, will be a proper component) |

### Modified Files

| File | Changes |
|------|---------|
| `src/pages/Settings.tsx` | Rewrite to use `useDataSources` hook for persistence + real fetching. Toggle actually enables/disables polling. Save validates URL then persists. Show real last-sync timestamps, loading spinners, error states. Include setup guide components per source. Add polling interval indicator ("Next sync in X:XX"). |
| `src/pages/Index.tsx` | Use `useDataSources` hook. Pass live data (or mock fallback) to all dashboard components. Show "Live" / "Mock Data" badge in header. |
| `src/data/mockData.ts` | Add data parser functions that normalize raw n8n webhook JSON responses into the existing TypeScript interfaces (QuotedJob[], CashflowMonth[], etc.) so dashboard components don't need changes. |

### Settings Page Fixes
- **Toggle doesn't work**: Currently `toggleConnection` only flips a boolean in React state. Will be rewritten to: persist to localStorage, trigger immediate fetch if turning on, start/stop polling interval.
- **Save doesn't persist**: Currently just shows a toast. Will be rewritten to: validate URL format, save to localStorage, trigger test fetch, show success/error result.
- **Sync Now doesn't fetch**: Currently just updates a timestamp string. Will be rewritten to: actually call `fetch(webhookUrl, { method: 'POST' })`, parse response, update dashboard data, show real result.

### Auto-Polling Implementation (useDataSources hook)
```typescript
// On mount and when sources change:
// For each enabled source with a webhook URL:
//   1. Fetch immediately
//   2. Set up setInterval(fetchData, 5 * 60 * 1000)
//   3. Store interval ID for cleanup
// On unmount or source disabled: clearInterval
// Data cached in localStorage so it persists across page loads
```

### Zoho CRM n8n Setup Guide (embedded in Settings)

The guide will include these exact steps:

1. **Create a Zoho API Console app**
   - Go to `https://api-console.zoho.com/`
   - Click "Add Client" → select "Server-based Applications"
   - **Client Name**: `n8n Integration`
   - **Homepage URL**: `https://your-n8n-instance.app.n8n.cloud` (or `http://localhost:5678` for self-hosted)
   - **Authorized Redirect URI**: `https://your-n8n-instance.app.n8n.cloud/rest/oauth2-credential/callback` (this is the critical URL users missed before)
   - Copy the **Client ID** and **Client Secret**

2. **Create n8n workflow**
   - Add **Webhook** node (POST trigger) → copy Production URL
   - Add **Zoho CRM** node → create new OAuth2 credential using Client ID/Secret from step 1
   - Set **Scopes**: `ZohoCRM.modules.ALL, ZohoCRM.settings.ALL`
   - Operations: Get Many → Resource: Deal, Contact, Account (one node per resource, or multiple nodes)
   - Add **Code** node to merge into `{ deals: [...], contacts: [...], accounts: [...] }`
   - Add **Respond to Webhook** node → return the merged JSON

3. **Paste webhook URL** into the Zoho CRM field in Settings and toggle on

### Zoho Projects n8n Setup Guide (embedded in Settings)

1. **Create Zoho API Console app** (same process as CRM if not already done)
   - **Homepage URL**: `https://your-n8n-instance.app.n8n.cloud`
   - **Authorized Redirect URI**: `https://your-n8n-instance.app.n8n.cloud/rest/oauth2-credential/callback`
   - **Scopes**: `ZohoProjects.portals.READ, ZohoProjects.projects.READ, ZohoProjects.tasks.READ, ZohoProjects.milestones.READ`

2. **Find your Portal ID**
   - Call `https://projectsapi.zoho.com/restapi/portals/` with your OAuth token to get your portal ID

3. **Create n8n workflow**
   - Add **Webhook** node (POST trigger)
   - Add **HTTP Request** nodes (no native Zoho Projects node in n8n):
     - `GET https://projectsapi.zoho.com/restapi/portal/{portalId}/projects/` → all projects
     - `GET https://projectsapi.zoho.com/restapi/portal/{portalId}/projects/{projectId}/tasks/` → tasks per project
     - `GET https://projectsapi.zoho.com/restapi/portal/{portalId}/projects/{projectId}/milestones/` → milestones
   - Auth: OAuth2 → use same Zoho credentials with Projects scopes
   - Add **Code** node → merge into `{ projects: [...], tasks: [...], milestones: [...] }`
   - Add **Respond to Webhook** → return JSON

4. **Paste webhook URL** into Zoho Projects field in Settings and toggle on

### Dashboard Components — No Changes Needed
All chart/table components (`PortfolioChart`, `DealPipeline`, `RevenueProjectsTable`, etc.) already consume data from `mockData.ts` exports. The `useDataSources` hook will provide live data that's normalized into the same interfaces, so components work unchanged. The Index page will simply pass `liveData.quotes ?? quotedJobs` etc.

