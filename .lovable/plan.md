

## Plan: Enable Lovable Cloud + Create n8n CORS Proxy

### Step 1: Enable Lovable Cloud
- Enable Supabase/Lovable Cloud for the project (you'll pick a region)

### Step 2: Create Edge Function `supabase/functions/n8n-proxy/index.ts`
- Accepts POST with `{ webhookUrl, source }` body
- Forwards request server-to-server to the n8n webhook URL
- Returns n8n response to browser
- Proper CORS headers included

### Step 3: Update `src/hooks/useDataSources.ts`
- Replace direct `fetch(webhookUrl)` with calls to the Edge Function proxy
- Remove GET fallback logic and CORS error messaging

### Step 4: Simplify setup guides
- Remove CORS/environment variable steps from:
  - `GoogleSheetsSetupGuide.tsx`
  - `ZohoCrmSetupGuide.tsx`
  - `ZohoProjectsSetupGuide.tsx`

### Files Changed

| File | Action |
|------|--------|
| `supabase/functions/n8n-proxy/index.ts` | Create — proxy Edge Function |
| `src/hooks/useDataSources.ts` | Update — route through proxy |
| `src/components/settings/GoogleSheetsSetupGuide.tsx` | Update — remove CORS step |
| `src/components/settings/ZohoCrmSetupGuide.tsx` | Update — remove CORS step |
| `src/components/settings/ZohoProjectsSetupGuide.tsx` | Update — remove CORS step |

