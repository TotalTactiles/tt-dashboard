import { useState, useMemo, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import CalendarGrid from "@/components/calendar/CalendarGrid";
import CalendarFilters, { type CustomFilter } from "@/components/calendar/CalendarFilters";
import DaySchedulePanel from "@/components/calendar/DaySchedulePanel";
import DeadlineTracker from "@/components/calendar/DeadlineTracker";
import EventTimeline from "@/components/calendar/EventTimeline";
import StrategicQuartersBoard from "@/components/calendar/StrategicQuartersBoard";
import KeepNotesPanel from "@/components/calendar/KeepNotesPanel";
import CollapsibleCardWrapper from "@/components/calendar/CollapsibleCardWrapper";
import ZohoMilestonesPanel from "@/components/calendar/ZohoMilestonesPanel";
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
  const { calendarEvents, upcomingEvents, calendarSummary, setCalendarEvents, syncCalendar, zohoProjects } = useDashboardData();
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
      const prevEvents = [...calendarEvents];
      if (action === "create") {
        const newEvent: LiveCalendarEvent = {
          id: `temp-${Date.now()}`,
          title: eventData.title || "",
          description: eventData.description,
          location: eventData.location,
          start: eventData.start || new Date().toISOString(),
          end: eventData.end || new Date().toISOString(),
          allDay: eventData.allDay || false,
          source: "Google Calendar",
          type: eventData.type || "Meeting",
          attendees: eventData.attendees || [],
        };
        setCalendarEvents([...calendarEvents, newEvent]);
      } else if (action === "update" && editingEvent) {
        setCalendarEvents(
          calendarEvents.map((e) => (e.id === editingEvent.id ? { ...e, ...eventData } : e))
        );
      } else if (action === "delete" && editingEvent) {
        setCalendarEvents(calendarEvents.filter((e) => e.id !== editingEvent.id));
      }

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

        if (error || data?._proxyError || data?.success === false) {
          throw new Error(error?.message || data?.error || data?.message || "Failed to save event");
        }

        setCalendarDebug({
          lastAction: action,
          lastError: null,
          lastSuccess: true,
          timestamp: new Date().toLocaleString(),
        });

        const actionLabel = action === "create" ? "Event created" : action === "update" ? "Event updated" : "Event deleted";
        toast({ title: actionLabel, className: action === "delete" ? "" : "border-green-500/30" });

        setTimeout(() => syncCalendar(), 5000);
      } catch (err: any) {
        const errMsg = err?.message || "Unknown error";
        setCalendarDebug({
          lastAction: action,
          lastError: errMsg,
          lastSuccess: false,
          timestamp: new Date().toLocaleString(),
        });
        toast({ title: "Failed to save event — please try again", variant: "destructive" });
        setCalendarEvents(prevEvents);
      }
    },
    [calendarEvents, editingEvent, setCalendarEvents, syncCalendar, toast]
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
      {/* Calendar zone — fits within viewport */}
      <div
        className="flex flex-col gap-2 overflow-hidden overflow-x-hidden"
        style={{ height: "calc(100vh - 4rem)" }}
      >
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
              onClick={() => {
                localStorage.removeItem("dashboard_calendar_data");
                syncCalendar();
                toast({ title: "Calendar sync triggered", description: "Fetching fresh data from Google Calendar & Zoho Projects…" });
              }}
              className="px-3 py-1.5 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors duration-150"
            >
              ↻ Sync
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
        <div className="flex flex-col lg:flex-row flex-1 min-h-0 min-w-0 gap-2 overflow-y-auto lg:overflow-hidden">
          <div className="flex-1 min-w-0 min-h-0 lg:overflow-hidden">
            <CalendarGrid
              events={filtered}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onEventClick={handleOpenEdit}
              onAddEvent={handleOpenCreate}
              onDayClick={handleDayClick}
            />
          </div>
          <div className="w-full lg:w-[360px] shrink-0 min-w-0 min-h-0 max-h-[60vh] lg:max-h-none overflow-y-auto">
            <DaySchedulePanel
              events={filtered}
              selectedDate={selectedDate}
              onPrevDay={prevDay}
              onNextDay={nextDay}
              onEventClick={handleOpenEdit}
            />
          </div>
        </div>

        {/* Bottom row: 3 fixed-height panels */}
        <div
          className="flex gap-2 shrink-0"
          style={{ height: "clamp(140px, 22vh, 200px)" }}
        >
          <CollapsibleCardWrapper
            title="Fund Deadlines & Obligations"
            defaultOpen={true}
            badge={filtered.filter(e => e.type === "Deadline" || e.type === "Milestone" || e.type === "Distribution" || e.type === "Valuation").length}
          >
            <div
              className="flex-1 min-h-0 overflow-y-auto"
              style={{ maxHeight: "180px", scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.15) transparent" }}
            >
              <DeadlineTracker events={filtered} />
            </div>
          </CollapsibleCardWrapper>
          <CollapsibleCardWrapper
            title="Zoho Project Milestones"
            defaultOpen={true}
            badge={allCalendarEvents.filter(e =>
              e.source === "Zoho Projects" ||
              e.source?.toLowerCase().includes("zoho") ||
              e.type === "Milestone" ||
              e.type === "Task"
            ).length}
          >
            <div
              className="flex-1 min-h-0 overflow-y-auto"
              style={{ maxHeight: "180px", scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.15) transparent" }}
            >
              <ZohoMilestonesPanel events={allCalendarEvents} onEventClick={handleOpenEdit} />
            </div>
          </CollapsibleCardWrapper>
          <CollapsibleCardWrapper
            title="Upcoming Events"
            defaultOpen={true}
            badge={filteredUpcoming.length}
          >
            <div
              className="flex-1 min-h-0 overflow-y-auto"
              style={{ maxHeight: "180px", scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.15) transparent" }}
            >
              <EventTimeline events={filteredUpcoming} onEventClick={handleOpenEdit} />
            </div>

          </CollapsibleCardWrapper>
        </div>
      </div>

      {/* Auxiliary sections below — scrollable beyond the viewport-locked calendar zone */}
      <div className="mt-4">
        <StrategicQuartersBoard onInjectEvents={setSqbEvents} />
      </div>

      <div className="mt-4 mb-4">
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
