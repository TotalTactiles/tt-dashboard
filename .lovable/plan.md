## Plan: Unify source colours across the calendar tab

### Current state
- Calendar grid and filter chips already use `SOURCE_THEME` from `src/components/calendar/eventColors.ts` (Google red `#EA4335`, Zoho parent blue `#1A56DB`, Zoho subtask light blue `#60A5FA`).
- **Upcoming Projects** card already uses `SOURCE_THEME.zohoParent.accent` — no purple.
- **Upcoming Events** card (`EventTimeline.tsx`) currently paints each row's left border from a local `TYPE_COLORS` map, so Milestone events show purple/lavender `#7F77DD`. The source badge is already red/blue but uses approximate HSL values instead of `SOURCE_THEME`.
- `CalendarCard.tsx` uses a purple CSS-variable pulse-dot (`bg-chart-purple`) for non-Google sources, which makes Zoho events appear purple there too.

### Changes

1. **`src/components/calendar/EventTimeline.tsx`**
   - Import `getEventTheme` and `SOURCE_THEME` from `./eventColors`.
   - Change the row's left border from `getTypeColor(ev.type)` to the event's source theme (`theme.border`).
   - Drive the "Google"/"Zoho" source badge background and text directly from `SOURCE_THEME`/ `getEventTheme` so colours match the grid exactly.
   - Keep the event-type `Badge` untouched (Milestone/type badge colours keep their meaning).

2. **`src/components/calendar/CalendarCard.tsx`**
   - Replace the static `bg-chart-purple` pulse-dot with a source-aware colour derived from `getEventTheme` so Zoho rows are blue, Google rows are red, and Strategic rows stay amber.

3. **`src/components/calendar/UpcomingProjectsPanel.tsx`**
   - Verify it continues to use `SOURCE_THEME.zohoParent.accent` for the left border and the "Zoho" badge. No functional change; confirm no purple/lavender remains.

### Out of scope
- `DeadlineTracker`, `EventModal`, and `EventDensityChart` local `TYPE_COLORS` maps are used for *type* badges/chart bars, not source accents. They will keep their current colours because the requirement explicitly says "Milestone/type badges keep their meaning."
- `CalendarFilters` `PRESET_COLORS` swatch and `KeepNotesPanel` colour picker are for user-chosen custom labels, not source accents.
- Data fetching, project links, and layout structure remain unchanged.

### Verification
- `npx tsc --noEmit` passes.
- Browser screenshot of `/calendar` shows Upcoming Projects (blue), Upcoming Events (Google red / Zoho blue source borders + badges), and CalendarCard pulse-dot matching source colours; no purple/lavender source accents remain.