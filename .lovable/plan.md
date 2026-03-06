

## Plan: Add Reference Screenshot Attachments to Formula Cards & Data Source Connectors

### Overview
Add the ability to attach "source of truth" screenshots to formula cards AND to each data source connector (Google Sheets, Zoho CRM, Zoho Projects, and future Xero). Screenshots are uploaded to Lovable Cloud storage and displayed as thumbnails with click-to-expand viewing.

### Step 1: Create Storage Bucket
SQL migration to create a `reference-screenshots` public bucket with RLS policies for authenticated users to upload, read, and delete files.

### Step 2: Update `MetricFormula` Interface
In `src/hooks/useFormulas.ts`, add `screenshotUrl?: string` to the `MetricFormula` interface. Persisted via existing localStorage mechanism.

### Step 3: Update Formula Form (`src/components/goals/FormulaForm.tsx`)
- Add a file input labeled "Reference Screenshot (Source of Truth)"
- On file select, upload to `reference-screenshots` bucket via Supabase storage
- Show thumbnail preview of selected/existing image with remove option
- Pass `screenshotUrl` through `onSubmit`

### Step 4: Update Formula Card (`src/components/goals/FormulaCard.tsx`)
- If `screenshotUrl` exists, show a small thumbnail at the bottom of the card
- Clicking opens a Dialog showing the full-size screenshot
- Add a subtle camera/image icon indicator

### Step 5: Add Screenshot Support to Data Sources (`src/hooks/useDataSources.ts`)
- Add `screenshotUrl?: string` to the `DataSourceConfig` interface
- Add `updateScreenshot(id: string, url: string)` and `removeScreenshot(id: string)` functions
- Persisted via existing localStorage mechanism

### Step 6: Update Settings Page (`src/pages/Settings.tsx`)
- For each data source card (Google Sheets, Zoho CRM, Zoho Projects, future Xero), add an upload area for a reference screenshot
- Show thumbnail preview when attached, with click-to-expand and remove option
- Label: "Attach reference screenshot to verify data mapping"

### Step 7: Create Shared Screenshot Components
- `src/components/shared/ScreenshotUpload.tsx` — reusable file input + upload logic + thumbnail preview
- `src/components/shared/ScreenshotViewer.tsx` — reusable Dialog for full-size viewing

### Files Changed

| File | Change |
|------|--------|
| SQL Migration | Create `reference-screenshots` storage bucket + RLS policies |
| `src/hooks/useFormulas.ts` | Add `screenshotUrl` to `MetricFormula` |
| `src/hooks/useDataSources.ts` | Add `screenshotUrl` to `DataSourceConfig` + update/remove helpers |
| `src/components/shared/ScreenshotUpload.tsx` | Create — reusable upload + preview component |
| `src/components/shared/ScreenshotViewer.tsx` | Create — reusable full-size viewer dialog |
| `src/components/goals/FormulaForm.tsx` | Integrate `ScreenshotUpload` |
| `src/components/goals/FormulaCard.tsx` | Show thumbnail + integrate `ScreenshotViewer` |
| `src/pages/Settings.tsx` | Add screenshot upload per data source connector |

