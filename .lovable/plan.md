

## Plan: Fix Data Source Fetching

### Root Causes

**1. CORS blocking browser→n8n requests**
The browser sends `fetch(webhookUrl, { method: "POST" })` directly to an external n8n URL. Most n8n webhook endpoints don't include `Access-Control-Allow-Origin` headers, so the browser blocks the response. This is the primary reason for "Failed to fetch" errors.

**2. Race condition in `saveAndTest`**
After calling `await fetchSource(source)`, the function reads back from `loadSavedSources()` to check for errors. But `fetchSource` updates React state (async) which then triggers `saveSources` — so localStorage may not yet reflect the result when checked. This makes Save & Test unreliable.

**3. n8n webhooks may expect GET, not POST**
Default n8n Webhook nodes accept specific HTTP methods. If the user configured a GET-based webhook, our POST request would return 404/405.

### Fix

**`src/hooks/useDataSources.ts`** — Two changes:

1. **Make `fetchSource` return a result object** (`{ success, data?, error? }`) instead of returning void and writing to state. `saveAndTest` can then use the return value directly — no race condition.

2. **Add `mode: "cors"` with fallback handling, and support both GET and POST methods.** Also add better error messages that specifically detect CORS failures (TypeError with "Failed to fetch" message = CORS) and guide the user.

3. **Add CORS guidance in the setup guides** — instruct users to add a "Respond to Webhook" node in n8n with these response headers:
   - `Access-Control-Allow-Origin: *`
   - `Access-Control-Allow-Methods: GET, POST, OPTIONS`
   - `Access-Control-Allow-Headers: Content-Type`

   Or for n8n cloud: enable "Allow Cross-Origin Requests" in the Webhook node settings.

**`src/components/settings/GoogleSheetsSetupGuide.tsx`** — Add a CORS configuration step explaining how to enable cross-origin access in the n8n Webhook node (there's a checkbox in n8n's Webhook node under "Options" → "Allow Cross-Origin Requests").

**`src/components/settings/ZohoCrmSetupGuide.tsx`** and **`src/components/settings/ZohoProjectsSetupGuide.tsx`** — Same CORS step added.

### Files Modified

| File | Change |
|------|--------|
| `src/hooks/useDataSources.ts` | `fetchSource` returns `{success, error?}`. CORS error detection with user-friendly message. Remove race condition in `saveAndTest`. |
| `src/components/settings/GoogleSheetsSetupGuide.tsx` | Add CORS setup step for n8n Webhook node |
| `src/components/settings/ZohoCrmSetupGuide.tsx` | Add CORS setup step |
| `src/components/settings/ZohoProjectsSetupGuide.tsx` | Add CORS setup step |

