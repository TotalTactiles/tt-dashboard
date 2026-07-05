import { useState, useMemo, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import CalendarGrid from "@/components/calendar/CalendarGrid";
import CalendarFilters, { type CustomFilter } from "@/components/calendar/CalendarFilters";
import DeadlineTracker from "@/components/calendar/DeadlineTracker";
import EventTimeline from "@/components/calendar/EventTimeline";
import StrategicQuartersBoard from "@/components/calendar/StrategicQuartersBoard";
import KeepNotesPanel from "@/components/calendar/KeepNotesPanel";
import CollapsibleCardWrapper from "@/components/calendar/CollapsibleCardWrapper";
import UpcomingProjectsPanel from "@/components/calendar/UpcomingProjectsPanel";
import EventModal from "@/components/calendar/EventModal";
import { useDashboardData, type LiveCalendarEvent } from "@/contexts/DashboardDataContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const CALENDAR_WRITE_WEBHOOK = 'https://n8n.srv1437130.hstgr.cloud/webhook/calendar-write';

const EVENT_TYPES = ["Meeting", "Deadline", "Milestone", "Care", "Valuation", "Distribution", "Task", "Event"] as const;
const EVENT_SOURCES = ["Google Calendar", "Zoho Projects", "Strategic Board"] as const;

type EventType = typeof EVENT_TYPES[number];
type EventSource = typeof EVENT_SOURCES[number];

interface WriteDebug {
  lastAction: string | null;
  lastError: string | null;
  lastSuccess: boolean | null;
  timestamp: string | null;
}

const CalendarView = () => {
  const { calendarEvents, upcomingEvents, calendarSummary, setCalendarEvents, syncCalendar, refetchCalendar, evictCalendarIds, zohoProjects, pinCalendarCreate, pinCalendarDelete, pinCalendarEdit } = useDashboardData();
  const { toast } = useToast();

  console.log('[Calendar Debug] raw events:', calendarEvents?.length, 'sample source:', calendarEvents?.[0]?.source, 'sample type:', calendarEvents?.[0]?.type);

  const [activeTypes, setActiveTypes] = useState<EventType[]>([...EVENT_TYPES]);
  const [activeSources, setActiveSources] = useState<EventSource[]>([...EVENT_SOURCES]);
  const [customFilters, setCustomFilters] = useState<CustomFilter[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<LiveCalendarEvent | null>(null);
  const [createInitialDate, setCreateInitialDate] = useState<Date | null>(null);
  const [calendarDebug, setCalendarDebug] = useState<WriteDebug>({
    lastAction: null, lastError: null, lastSuccess: null, timestamp: null,
  });
  const [sqbEvents, setSqbEvents] = useState<LiveCalendarEvent[]>([]);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "success" | "error">("idle");

  const handleSyncClick = useCallback(async () => {
    if (syncStatus === "syncing") return;
    setSyncStatus("syncing");
    try {
      const TIMEOUT_MS = 90_000;
      const result = await Promise.race<number>([
        refetchCalendar(),
        new Promise<number>((_, reject) =>
          setTimeout(() => reject(new Error("Sync timeout after 90s")), TIMEOUT_MS)
        ),
      ]);
      console.log(`[Sync] workflow completed, events=${result}`);
      setSyncStatus("success");
      toast({ title: "Calendar synced", description: `${result} events loaded from Google Calendar & Zoho.`, className: "border-green-500/30" });
      setTimeout(() => setSyncStatus("idle"), 3000);
    } catch (err: any) {
      console.error("[Sync] failed:", err?.message);
      setSyncStatus("error");
      toast({ title: "Sync failed", description: err?.message || "Please retry.", variant: "destructive" });
      setTimeout(() => setSyncStatus("idle"), 5000);
    }
  }, [refetchCalendar, syncStatus, toast]);

  const allCalendarEvents = useMemo(() => {
    const real = Array.isArray(calendarEvents) ? calendarEvents : [];
    const withoutSqb = real.filter((e) => !e.id.startsWith("sqb-"));
    return [...withoutSqb, ...sqbEvents];
  }, [calendarEvents, sqbEvents]);

  const toggleType = (type: EventType) => {
    setActiveTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const toggleSource = (source: EventSource) => {
    setActiveSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]
    );
  };

  const filtered = useMemo(() => {
    const activeCustomLabels = customFilters.filter((f) => f.active).map((f) => f.label.toLowerCase());
    return allCalendarEvents.filter((e) => {
      if (activeCustomLabels.length > 0 && activeCustomLabels.some((lbl) => e.title.toLowerCase().includes(lbl))) return true;
      const knownSources = ["Google Calendar", "Zoho Calendar", "Zoho Projects", "Strategic Board"];
      const sourcePass = activeSources.includes(e.source as EventSource) || !knownSources.includes(e.source);
      const knownTypes = [...EVENT_TYPES];
      const typePass = activeTypes.includes(e.type as EventType) || !knownTypes.includes(e.type as EventType);
      return sourcePass && typePass;
    });
  }, [allCalendarEvents, activeTypes, activeSources, customFilters]);

  const filteredUpcoming = useMemo(() => {
    const now = new Date().toISOString();
    const activeCustomLabels = customFilters.filter((f) => f.active).map((f) => f.label.toLowerCase());
    return allCalendarEvents
      .filter((e) => {
        if (activeCustomLabels.length > 0 && activeCustomLabels.some((lbl) => e.title.toLowerCase().includes(lbl))) return true;
        const knownSources = ["Google Calendar", "Zoho Calendar", "Zoho Projects", "Strategic Board"];
        const sourcePass = activeSources.includes(e.source as EventSource) || !knownSources.includes(e.source);
        const knownTypes = [...EVENT_TYPES];
        const typePass = activeTypes.includes(e.type as EventType) || !knownTypes.includes(e.type as EventType);
        return sourcePass && typePass && e.start >= now;
      })
      .sort((a, b) => a.start.localeCompare(b.start));
  }, [allCalendarEvents, activeTypes, activeSources, customFilters]);

  const prevDay = () => setSelectedDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1));
  const nextDay = () => setSelectedDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));

  const handleOpenCreate = () => {
    setEditingEvent(null);
    setCreateInitialDate(null);
    setModalOpen(true);
  };

  const handleDayClick = (dateISO: string) => {
    const [y, m, d] = dateISO.split("-").map(Number);
    const clicked = new Date(y, m - 1, d);
    setSelectedDate(clicked);
    setEditingEvent(null);
    setCreateInitialDate(clicked);
    setModalOpen(true);
  };

  const handleOpenEdit = (event: LiveCalendarEvent) => {
    setEditingEvent(event);
    setCreateInitialDate(null);
    setModalOpen(true);
  };

  const handleSaveEvent = useCallback(
    async (action: "create" | "update" | "delete", eventData: Partial<LiveCalendarEvent>) => {
      // Build a stable id for overlay pinning
      const buildStableId = (): string => {
        if (action === "create") {
          // Zoho creates: prefer zohoId shape if backend echoes one back later; for now temp id
          return `temp-${Date.now()}`;
        }
        return editingEvent?.id ?? `temp-${Date.now()}`;
      };
      const stableId = buildStableId();

      setModalOpen(false);

      try {
        const writePayload = {
          action,
          event: {
            title: eventData.title,
            description: eventData.description || "",
            location: eventData.location || "",
            start: eventData.start,
            end: eventData.end,
            startDate: (eventData as any).startDate,
            endDate: (eventData as any).endDate,
            allDay: eventData.allDay,
            type: eventData.type || "Meeting",
            attendees: eventData.attendees || [],
            googleId: editingEvent?.googleId || null,
            zohoId: eventData.zohoId ?? editingEvent?.zohoId ?? null,
            source: (eventData as any).source ?? editingEvent?.source ?? "Google Calendar",
            projectId: (eventData as any).projectId ?? (editingEvent as any)?.projectId,
            parentTaskId: (eventData as any).parentTaskId ?? "",
          },
        };

        const { data, error } = await supabase.functions.invoke("n8n-proxy", {
          body: {
            webhookUrl: CALENDAR_WRITE_WEBHOOK,
            payload: writePayload,
          },
        });

        // ---- Normalise n8n-proxy write response (envelope-agnostic) ----
        const unwrapResponse = (raw: any): any => {
          let cur: any = raw;
          if (typeof cur === "string") {
            try { cur = JSON.parse(cur); } catch { /* keep string */ }
          }
          for (let i = 0; i < 4; i++) {
            if (!cur || typeof cur !== "object") break;
            if (Array.isArray(cur) && cur.length === 1) { cur = cur[0]; continue; }
            if ("success" in cur || "error" in cur || "_proxyError" in cur) break;
            if (cur.body && typeof cur.body === "object") { cur = cur.body; continue; }
            if (cur.data && typeof cur.data === "object") { cur = cur.data; continue; }
            if (cur.response && typeof cur.response === "object") { cur = cur.response; continue; }
            break;
          }
          return cur;
        };

        const deepFindBool = (obj: any, key: "success", depth = 0): boolean | undefined => {
          if (!obj || typeof obj !== "object" || depth > 3) return undefined;
          if (typeof obj[key] === "boolean") return obj[key];
          for (const k of Object.keys(obj)) {
            const v = (obj as any)[k];
            if (v && typeof v === "object") {
              const found = deepFindBool(v, key, depth + 1);
              if (typeof found === "boolean") return found;
            }
          }
          return undefined;
        };

        const unwrapped = unwrapResponse(data);
        const explicitSuccess = deepFindBool(unwrapped, "success");
        const hasError = !!(unwrapped?.error || unwrapped?._error || unwrapped?._proxyError);

        // Source-agnostic success:
        //   success === true  → OK
        //   no explicit flag AND no error/_proxyError → OK (Zoho delete/update return no id)
        //   only fail if success === false OR an error field is present
        const isSuccess = !error && !hasError && explicitSuccess !== false;

        console.log("[write result]", { action, response: data, unwrapped, explicitSuccess, isSuccess, transportError: error?.message });

        if (!isSuccess) {
          throw new Error(
            error?.message ||
              unwrapped?.error ||
              unwrapped?.message ||
              "Failed to save event"
          );
        }

        // ===== OPTIMISTIC OVERLAY — instant UI, reconciled silently by polling =====
        if (action === "create") {
          const source = (eventData as any).source ?? "Google Calendar";
          const newEvent: LiveCalendarEvent = {
            id: stableId,
            title: eventData.title || "",
            description: eventData.description,
            location: eventData.location,
            start: eventData.start || new Date().toISOString(),
            end: eventData.end || eventData.start || new Date().toISOString(),
            allDay: eventData.allDay || false,
            source,
            type: eventData.type || "Meeting",
            attendees: eventData.attendees || [],
            zohoId: eventData.zohoId ?? null,
            googleId: undefined,
          };
          pinCalendarCreate(newEvent);
        } else if (action === "update" && editingEvent) {
          const patch: Partial<LiveCalendarEvent> = {
            title: eventData.title,
            description: eventData.description,
            location: eventData.location,
            start: eventData.start,
            end: eventData.end,
            allDay: eventData.allDay,
            type: eventData.type,
            attendees: eventData.attendees,
          };
          pinCalendarEdit(editingEvent.id, patch);
        } else if (action === "delete" && editingEvent) {
          pinCalendarDelete(editingEvent.id);
          // Backend evict — tells the read cache to permanently drop this event
          // so it does NOT reappear after a page reload once the optimistic
          // overlay is wiped. Send every id shape the backend might match.
          const rawId = editingEvent.id;
          const zohoId = editingEvent.zohoId || "";
          const stripped = rawId.replace(/^zoho-(subtask|task)-/, "");
          const evictIds = Array.from(new Set([rawId, stripped, zohoId].filter(Boolean))) as string[];
          evictCalendarIds(evictIds).catch((e) => console.warn("[Calendar Evict] failed:", e?.message));
        }

        setCalendarDebug({
          lastAction: action,
          lastError: null,
          lastSuccess: true,
          timestamp: new Date().toLocaleString(),
        });

        const actionLabel = action === "create" ? "Event created" : action === "update" ? "Event updated" : "Event deleted";
        toast({ title: actionLabel, className: action === "delete" ? "" : "border-green-500/30" });

      } catch (err: any) {
        const errMsg = err?.message || "Unknown error";
        setCalendarDebug({
          lastAction: action,
          lastError: errMsg,
          lastSuccess: false,
          timestamp: new Date().toLocaleString(),
        });
        toast({ title: "Failed to save event — please try again", variant: "destructive" });
      }
    },
    [editingEvent, pinCalendarCreate, pinCalendarDelete, pinCalendarEdit, toast]
  );

  const debugBadge = (() => {
    if (calendarDebug.lastSuccess === null) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
          No writes yet
        </span>
      );
    }
    if (calendarDebug.lastSuccess) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400">
          ✓ Last write OK
        </span>
      );
    }
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-destructive/15 text-destructive cursor-pointer hover:bg-destructive/25 transition-colors">
            ✕ Last write failed
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 text-xs space-y-1.5" side="bottom" align="end">
          <p className="font-semibold text-destructive">Write Error</p>
          <p className="text-muted-foreground">Action: <span className="text-foreground">{calendarDebug.lastAction}</span></p>
          <p className="text-muted-foreground">Time: <span className="text-foreground">{calendarDebug.timestamp}</span></p>
          <p className="text-muted-foreground break-all">Error: <span className="text-foreground">{calendarDebug.lastError}</span></p>
        </PopoverContent>
      </Popover>
    );
  })();

  return (
    <DashboardLayout>
      {/* Calendar zone — clean, symmetrical responsive layout */}
      <div className="flex flex-col gap-4 w-full max-w-[1600px] mx-auto px-2 sm:px-4">
        {/* Header row */}
        <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <h1 className="text-fluid-2xl font-semibold truncate">Calendar &amp; Deadlines</h1>
            <p className="text-fluid-xs text-muted-foreground font-mono truncate">
              Event Schedule &amp; Critical Dates
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="calendar-header-badge hidden sm:inline-flex">{debugBadge}</span>
            <button
              onClick={handleOpenCreate}
              className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors duration-150"
            >
              + Add Event
            </button>
            <button
              onClick={handleSyncClick}
              disabled={syncStatus === "syncing"}
              aria-busy={syncStatus === "syncing"}
              className={
                "px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors duration-150 inline-flex items-center gap-2 disabled:cursor-wait sync-btn " +
                (syncStatus === "syncing"
                  ? "border-primary/50 text-primary bg-primary/10"
                  : syncStatus === "success"
                  ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10"
                  : syncStatus === "error"
                  ? "border-destructive/50 text-destructive bg-destructive/10 hover:bg-destructive/20"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30")
              }
            >
              {syncStatus === "syncing" ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Syncing…
                </>
              ) : syncStatus === "success" ? (
                <>✓ Synced</>
              ) : syncStatus === "error" ? (
                <>⚠ Sync failed — retry</>
              ) : (
                <>↻ Sync</>
              )}
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="shrink-0 flex flex-wrap gap-1.5">
          <CalendarFilters
            activeSources={activeSources}
            onToggleSource={toggleSource}
            customFilters={customFilters}
            onUpdateCustomFilters={setCustomFilters}
          />
        </div>

        {/* Top row: Calendar grid + Scheduled panel */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4 items-stretch min-h-0">
          <div className="min-w-0 h-full">
            <CalendarGrid
              events={filtered}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onEventClick={handleOpenEdit}
              onAddEvent={handleOpenCreate}
              onDayClick={handleDayClick}
            />
          </div>
          <div className="min-w-0 h-full flex flex-col [&>*]:!h-full [&>*]:!w-full">
            <DaySchedulePanel
              events={filtered}
              selectedDate={selectedDate}
              onPrevDay={prevDay}
              onNextDay={nextDay}
              onEventClick={handleOpenEdit}
            />
          </div>
        </div>

        {/* Bottom row: 3 tidy cards — stack on smaller screens so each has enough width */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4 items-stretch">
          <div className="min-w-0 flex flex-col">
            <CollapsibleCardWrapper
              title="Fund Deadlines & Obligations"
              defaultOpen={true}
              badge={filtered.filter(e => e.type === "Deadline" || e.type === "Milestone" || e.type === "Distribution" || e.type === "Valuation").length}
            >
              <DeadlineTracker events={filtered} />
            </CollapsibleCardWrapper>
          </div>
          <div className="min-w-0 flex flex-col">
            <CollapsibleCardWrapper
              title="Upcoming Projects"
              defaultOpen={true}
              badge={zohoProjects.length}
            >
              <UpcomingProjectsPanel projects={zohoProjects} />
            </CollapsibleCardWrapper>
          </div>
          <div className="min-w-0 flex flex-col">
            <CollapsibleCardWrapper
              title="Upcoming Events"
              defaultOpen={true}
              badge={filteredUpcoming.length}
            >
              <EventTimeline events={filteredUpcoming} onEventClick={handleOpenEdit} />
            </CollapsibleCardWrapper>
          </div>
        </div>

        <StrategicQuartersBoard onInjectEvents={setSqbEvents} />

        <KeepNotesPanel />
      </div>

      <EventModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        event={editingEvent}
        onSave={handleSaveEvent}
        selectedDate={createInitialDate ?? selectedDate}
        zohoProjects={zohoProjects}
      />
    </DashboardLayout>
  );
};

export default CalendarView;
