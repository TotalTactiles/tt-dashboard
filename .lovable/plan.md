

## Plan: Fix CORS for Self-Hosted n8n

### Root Cause

Your n8n is **self-hosted** at `n8n.srv1437130.hstgr.cloud`. The "Allow Cross-Origin Requests" checkbox in the Webhook node **only works on n8n Cloud**. For self-hosted n8n, the OPTIONS preflight request is handled by n8n's core server — not the webhook node — so adding headers in "Respond to Webhook" does not fix it either.

The correct fix for self-hosted n8n is to set the **`N8N_ADDITIONAL_ALLOWED_ORIGINS`** environment variable on your n8n server.

### What Changes

**1. Update setup guides** with the correct self-hosted n8n CORS fix:

All three guides (`GoogleSheetsSetupGuide.tsx`, `ZohoCrmSetupGuide.tsx`, `ZohoProjectsSetupGuide.tsx`) will have their CORS step rewritten to clearly distinguish:

- **n8n Cloud**: Enable "Allow Cross-Origin Requests" in Webhook node Options (existing instruction — this works)
- **Self-hosted n8n** (your case): Add this environment variable to your n8n server:
  ```
  N8N_ADDITIONAL_ALLOWED_ORIGINS=https://id-preview--2b58916e-a43c-476b-81e7-9c64344bda0b.lovable.app,https://*.lovable.app,https://*.lovableproject.com
  ```
  Then restart n8n. This tells n8n's core server to respond to OPTIONS preflight requests with the correct CORS headers.

  For Docker: add `-e N8N_ADDITIONAL_ALLOWED_ORIGINS=...` to your `docker run` command or `docker-compose.yml`.
  For PM2/systemd: add it to your `.env` file or environment config.

**2. Improve error message** in `useDataSources.ts`:

The current CORS error message only mentions the Webhook node checkbox. It will be updated to include the self-hosted environment variable fix, since that's the actual solution for this setup.

### Files Modified

| File | Change |
|------|--------|
| `src/hooks/useDataSources.ts` | Update CORS error message to mention `N8N_ADDITIONAL_ALLOWED_ORIGINS` for self-hosted |
| `src/components/settings/GoogleSheetsSetupGuide.tsx` | Rewrite CORS step with Cloud vs Self-hosted sections |
| `src/components/settings/ZohoCrmSetupGuide.tsx` | Same CORS step update |
| `src/components/settings/ZohoProjectsSetupGuide.tsx` | Same CORS step update |

