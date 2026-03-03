

## Plan: Bypass CORS with Supabase Edge Function Proxy

### Problem
Your self-hosted n8n doesn't allow setting `N8N_ADDITIONAL_ALLOWED_ORIGINS` without an enterprise plan, so browser→n8n requests will always be blocked by CORS.

### Solution
Create a Supabase Edge Function that acts as a proxy. The browser calls the Edge Function, and the Edge Function calls n8n server-to-server (no CORS restrictions).

```text
Browser  →  Supabase Edge Function  →  n8n webhook
         (same-origin, no CORS)      (server-to-server, no CORS)
```

### Changes

**1. New Edge Function: `supabase/functions/n8n-proxy/index.ts`**
- Accepts POST with `{ webhookUrl, source }` 
- Forwards the request to the n8n webhook URL server-side
- Returns the n8n response back to the browser
- Includes proper CORS headers for browser calls

**2. Update `src/hooks/useDataSources.ts`**
- Replace direct `fetch(webhookUrl)` calls with calls to the Edge Function proxy
- Pass the webhook URL as a parameter to the proxy
- Remove the GET fallback logic (no longer needed)
- Update error messages (no more CORS instructions)

**3. Update setup guides** (`GoogleSheetsSetupGuide.tsx`, `ZohoCrmSetupGuide.tsx`, `ZohoProjectsSetupGuide.tsx`)
- Remove the CORS/environment variable step entirely — it's no longer needed
- Simplify to: "Paste your webhook URL, click Save & Test"

### Files

| File | Change |
|------|--------|
| `supabase/functions/n8n-proxy/index.ts` | New — proxy Edge Function |
| `src/hooks/useDataSources.ts` | Route fetches through proxy |
| `src/components/settings/GoogleSheetsSetupGuide.tsx` | Remove CORS step |
| `src/components/settings/ZohoCrmSetupGuide.tsx` | Remove CORS step |
| `src/components/settings/ZohoProjectsSetupGuide.tsx` | Remove CORS step |

