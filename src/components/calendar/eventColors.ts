import type { LiveCalendarEvent } from "@/contexts/DashboardDataContext";

// Source theme constants — shared across CalendarGrid, DaySchedulePanel, filter chips.
export const SOURCE_THEME = {
  google: {
    accent: "#EA4335",         // Gmail red — Google events are rare accents
    bg: "rgba(234,67,53,0.15)",
    border: "#EA4335",
    label: "Google Calendar",
  },
  zohoParent: {
    accent: "#1A56DB",         // darker blue — Zoho top-level tasks
    bg: "rgba(26,86,219,0.18)",
    border: "#1A56DB",
    label: "Zoho Projects",
  },
  zohoSubtask: {
    accent: "#60A5FA",         // lighter blue — Zoho subtasks
    bg: "rgba(96,165,250,0.15)",
    border: "#60A5FA",
    label: "Zoho Subtask",
  },
  strategic: {
    accent: "#BA7517",         // amber — keep current
    bg: "rgba(186,117,23,0.15)",
    border: "#BA7517",
    label: "Strategic Board",
  },
  neutral: {
    accent: "#378ADD",
    bg: "hsl(var(--secondary))",
    border: "hsl(var(--border))",
    label: "Other",
  },
} as const;

export type EventTheme = typeof SOURCE_THEME[keyof typeof SOURCE_THEME];

/**
 * Resolve a colour theme for an event based on source + Zoho task level.
 * Zoho subtasks have ids starting "zoho-subtask-"; parents "zoho-task-".
 */
export function getEventTheme(event: Pick<LiveCalendarEvent, "id" | "source">): EventTheme {
  const src = (event.source || "").toLowerCase();
  const id = event.id || "";

  if (src.includes("google")) return SOURCE_THEME.google;

  if (src.includes("zoho")) {
    if (id.startsWith("zoho-subtask-")) return SOURCE_THEME.zohoSubtask;
    return SOURCE_THEME.zohoParent;
  }

  if (src.includes("strategic") || id.startsWith("sqb-")) return SOURCE_THEME.strategic;

  return SOURCE_THEME.neutral;
}

/** Theme for a source-filter chip. Zoho chip uses the darker (parent) blue. */
export function getSourceChipTheme(sourceKey: string): EventTheme {
  const k = sourceKey.toLowerCase();
  if (k.includes("google")) return SOURCE_THEME.google;
  if (k.includes("zoho")) return SOURCE_THEME.zohoParent;
  if (k.includes("strategic")) return SOURCE_THEME.strategic;
  return SOURCE_THEME.neutral;
}
