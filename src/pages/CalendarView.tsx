import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import CalendarGrid from "@/components/calendar/CalendarGrid";
import CalendarFilters from "@/components/calendar/CalendarFilters";
import DaySchedulePanel from "@/components/calendar/DaySchedulePanel";
import DeadlineTracker from "@/components/calendar/DeadlineTracker";
import EventTimeline from "@/components/calendar/EventTimeline";
import EventDensityChart from "@/components/calendar/EventDensityChart";
import QuarterlyTimeline from "@/components/calendar/QuarterlyTimeline";
import { calendarEvents, type CalendarEvent } from "@/data/calendarMockData";

const allTypes: CalendarEvent["type"][] = ["meeting", "deadline", "milestone", "call", "filing", "distribution", "valuation"];
const allSources: ("google" | "zoho")[] = ["google", "zoho"];

const CalendarView = () => {
  const [activeTypes, setActiveTypes] = useState<CalendarEvent["type"][]>(allTypes);
  const [activeSources, setActiveSources] = useState<("google" | "zoho")[]>(allSources);
  const [selectedDate, setSelectedDate] = useState(new Date(2026, 2, 14));

  const toggleType = (type: CalendarEvent["type"]) => {
    setActiveTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const toggleSource = (source: "google" | "zoho") => {
    setActiveSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]
    );
  };

  const filtered = useMemo(
    () => calendarEvents.filter((e) => activeTypes.includes(e.type) && activeSources.includes(e.calendar)),
    [activeTypes, activeSources]
  );

  const prevDay = () => setSelectedDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1));
  const nextDay = () => setSelectedDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));

  return (
    <DashboardLayout>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">Calendar &amp; Deadlines</h1>
        <p className="text-sm text-muted-foreground font-mono">Fund III — Event Schedule &amp; Critical Dates</p>
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
        <CalendarGrid events={filtered} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
        <DaySchedulePanel events={filtered} selectedDate={selectedDate} onPrevDay={prevDay} onNextDay={nextDay} />
      </div>

      {/* Bottom row 1: Deadlines + Upcoming Events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <DeadlineTracker />
        <EventTimeline />
      </div>

      {/* Bottom row 2: Density chart + Quarterly roadmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EventDensityChart />
        <QuarterlyTimeline />
      </div>
    </DashboardLayout>
  );
};

export default CalendarView;
