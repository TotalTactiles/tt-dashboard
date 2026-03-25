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
  const { calendarEvents, upcomingEvents, calendarSummary, setCalendarEvents, syncCalendar } = useDashboardData();
  const { toast } = useToast();

  console.log('[Calendar Debug] raw events:', calendarEvents?.length, 'sample source:', calendarEvents?.[0]?.source, 'sample type:', calendarEvents?.[0]?.type);

  const [activeTypes, setActiveTypes] = useState<EventType[]>([...EVENT_TYPES]);
  const [activeSources, setActiveSources] = useState<EventSource[]>([...EVENT_SOURCES]);
  const [customFilters, setCustomFilters] = useState<CustomFilter[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<LiveCalendarEvent | null>(null);
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
    setModalOpen(true);
  };

  const handleOpenEdit = (event: LiveCalendarEvent) => {
    setEditingEvent(event);
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
            allDay: eventData.allDay,
            type: eventData.type || "Meeting",
            attendees: eventData.attendees || [],
            googleId: editingEvent?.googleId || null,
            zohoId: editingEvent?.zohoId || null,
          },
        };

        const { data, error } = await supabase.functions.invoke("n8n-proxy", {
          body: {
            webhookUrl: CALENDAR_WRITE_WEBHOOK,
            payload: writePayload,
          },
        });

        if (error || data?._proxyError) {
          throw new Error(error?.message || data?.error || "Failed to save event");
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
      <div className="mb-4 md:mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-fluid-2xl font-semibold">Calendar &amp; Deadlines</h1>
          <p className="text-fluid-xs text-muted-foreground font-mono">Event Schedule &amp; Critical Dates</p>
        </div>
        <div className="flex items-center gap-2">
          {debugBadge}
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2.5 md:py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors duration-150 touch-target md:min-h-0"
          >
            + Add Event
          </button>
        </div>
      </div>

      <div className="mb-4 md:mb-5">
        <CalendarFilters
          activeSources={activeSources}
          onToggleSource={toggleSource}
          customFilters={customFilters}
          onUpdateCustomFilters={setCustomFilters}
        />
      </div>

      <div className="flex flex-col lg:flex-row gap-3 md:gap-4 mb-4 md:mb-6">
        <CalendarGrid events={filtered} selectedDate={selectedDate} onSelectDate={setSelectedDate} onEventClick={handleOpenEdit} onAddEvent={handleOpenCreate} />
        <DaySchedulePanel events={filtered} selectedDate={selectedDate} onPrevDay={prevDay} onNextDay={nextDay} onEventClick={handleOpenEdit} />
      </div>

      <div className="flex flex-col md:flex-row gap-3 md:gap-4 mb-4 md:mb-6 items-stretch">
        <CollapsibleCardWrapper
          title="Fund Deadlines & Obligations"
          defaultOpen={true}
          badge={filtered.filter(e => e.type === "Deadline" || e.type === "Milestone" || e.type === "Distribution" || e.type === "Valuation").length}
        >
          <DeadlineTracker events={filtered} />
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
          <ZohoMilestonesPanel events={allCalendarEvents} onEventClick={handleOpenEdit} />
        </CollapsibleCardWrapper>
        <CollapsibleCardWrapper
          title="Upcoming Events"
          defaultOpen={true}
          badge={filteredUpcoming.length}
        >
          <EventTimeline events={filteredUpcoming} onEventClick={handleOpenEdit} />
        </CollapsibleCardWrapper>
      </div>

      <div className="mt-4 md:mt-6">
        <StrategicQuartersBoard onInjectEvents={setSqbEvents} />
      </div>

      <div className="mt-4 md:mt-6">
        <KeepNotesPanel />
      </div>

      <EventModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        event={editingEvent}
        onSave={handleSaveEvent}
        selectedDate={selectedDate}
      />
    </DashboardLayout>
  );
};

export default CalendarView;
