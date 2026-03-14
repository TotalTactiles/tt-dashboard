import { useState, useMemo, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import CalendarGrid from "@/components/calendar/CalendarGrid";
import CalendarFilters from "@/components/calendar/CalendarFilters";
import DaySchedulePanel from "@/components/calendar/DaySchedulePanel";
import DeadlineTracker from "@/components/calendar/DeadlineTracker";
import EventTimeline from "@/components/calendar/EventTimeline";
import EventDensityChart from "@/components/calendar/EventDensityChart";
import QuarterlyTimeline from "@/components/calendar/QuarterlyTimeline";
import EventModal from "@/components/calendar/EventModal";
import { useDashboardData, type LiveCalendarEvent } from "@/contexts/DashboardDataContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const EVENT_TYPES = ["Meeting", "Deadline", "Milestone", "Care", "Valuation", "Distribution"] as const;
const EVENT_SOURCES = ["Google Calendar", "Zoho Calendar"] as const;

type EventType = typeof EVENT_TYPES[number];
type EventSource = typeof EVENT_SOURCES[number];

const CalendarView = () => {
  const { calendarEvents, upcomingEvents, calendarSummary, setCalendarEvents, syncNow } = useDashboardData();
  const { toast } = useToast();

  const [activeTypes, setActiveTypes] = useState<EventType[]>([...EVENT_TYPES]);
  const [activeSources, setActiveSources] = useState<EventSource[]>([...EVENT_SOURCES]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<LiveCalendarEvent | null>(null);

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

  const filtered = useMemo(
    () =>
      calendarEvents.filter(
        (e) =>
          activeTypes.includes(e.type as EventType) &&
          activeSources.includes(e.source as EventSource)
      ),
    [calendarEvents, activeTypes, activeSources]
  );

  const filteredUpcoming = useMemo(
    () =>
      upcomingEvents.filter(
        (e) =>
          activeTypes.includes(e.type as EventType) &&
          activeSources.includes(e.source as EventSource)
      ),
    [upcomingEvents, activeTypes, activeSources]
  );

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
      const writeUrl = import.meta.env.VITE_CALENDAR_WRITE_WEBHOOK;
      if (!writeUrl) {
        toast({ title: "Write webhook not configured", description: "Set VITE_CALENDAR_WRITE_WEBHOOK", variant: "destructive" });
        return;
      }

      // Optimistic update
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
        const { data, error } = await supabase.functions.invoke("n8n-proxy", {
          body: {
            webhookUrl: writeUrl,
            source: "calendar_write",
            payload: {
              action,
              event: {
                title: eventData.title,
                description: eventData.description,
                location: eventData.location,
                start: eventData.start,
                end: eventData.end,
                allDay: eventData.allDay,
                type: eventData.type,
                attendees: eventData.attendees,
                googleId: editingEvent?.googleId,
                zohoId: editingEvent?.zohoId,
              },
            },
          },
        });

        if (error) throw error;

        toast({
          title: action === "delete" ? "Event deleted" : "Event saved",
          className: action === "delete" ? "" : "border-green-500/30",
        });

        // Resync after 8 seconds
        setTimeout(() => syncNow("google_sheets"), 8000);
      } catch (err: any) {
        toast({ title: "Failed to save — please try again", variant: "destructive" });
        setCalendarEvents(prevEvents);
      }
    },
    [calendarEvents, editingEvent, setCalendarEvents, syncNow, toast]
  );

  return (
    <DashboardLayout>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Calendar &amp; Deadlines</h1>
          <p className="text-sm text-muted-foreground font-mono">Event Schedule &amp; Critical Dates</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors duration-150"
        >
          + Add Event
        </button>
      </div>

      {/* Filter bar */}
      <div className="mb-5">
        <CalendarFilters
          activeTypes={activeTypes}
          onToggleType={toggleType}
          activeSources={activeSources}
          onToggleSource={toggleSource}
        />
      </div>

      {/* Main split: Calendar grid + Day schedule panel */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        <CalendarGrid events={filtered} selectedDate={selectedDate} onSelectDate={setSelectedDate} onEventClick={handleOpenEdit} onAddEvent={handleOpenCreate} />
        <DaySchedulePanel events={filtered} selectedDate={selectedDate} onPrevDay={prevDay} onNextDay={nextDay} onEventClick={handleOpenEdit} />
      </div>

      {/* Bottom row 1: Deadlines + Upcoming Events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <DeadlineTracker events={filtered} />
        <EventTimeline events={filteredUpcoming} onEventClick={handleOpenEdit} />
      </div>

      {/* Bottom row 2: Density chart + Quarterly roadmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EventDensityChart summary={calendarSummary} />
        <QuarterlyTimeline />
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
