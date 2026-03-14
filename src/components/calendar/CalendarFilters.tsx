import { CalendarEvent, eventTypeColors } from "@/data/calendarMockData";

interface CalendarFiltersProps {
  activeTypes: CalendarEvent["type"][];
  onToggleType: (type: CalendarEvent["type"]) => void;
  activeSources: ("google" | "zoho")[];
  onToggleSource: (source: "google" | "zoho") => void;
}

const eventTypes: { type: CalendarEvent["type"]; label: string }[] = [
  { type: "meeting", label: "Meetings" },
  { type: "deadline", label: "Deadlines" },
  { type: "milestone", label: "Milestones" },
  { type: "call", label: "Calls" },
  { type: "filing", label: "Filings" },
  { type: "distribution", label: "Distributions" },
  { type: "valuation", label: "Valuations" },
];

const eventTypeHslMap: Record<CalendarEvent["type"], string> = {
  meeting: "200 80% 50%",
  deadline: "0 72% 55%",
  milestone: "270 60% 55%",
  call: "160 70% 45%",
  filing: "38 92% 55%",
  distribution: "200 80% 50%",
  valuation: "38 92% 55%",
};

const CalendarFilters = ({ activeTypes, onToggleType, activeSources, onToggleSource }: CalendarFiltersProps) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Source filters */}
      <button
        onClick={() => onToggleSource("google")}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-150"
        style={
          activeSources.includes("google")
            ? { background: "hsl(200, 80%, 50%)", color: "hsl(220, 20%, 6%)" }
            : { background: "transparent", border: "1px solid hsl(200, 80%, 50%)", color: "hsl(200, 80%, 50%)" }
        }
      >
        <span className="w-2 h-2 rounded-full" style={{ background: "hsl(200, 80%, 50%)" }} />
        Google
      </button>
      <button
        onClick={() => onToggleSource("zoho")}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-150"
        style={
          activeSources.includes("zoho")
            ? { background: "hsl(270, 60%, 55%)", color: "hsl(220, 20%, 6%)" }
            : { background: "transparent", border: "1px solid hsl(270, 60%, 55%)", color: "hsl(270, 60%, 55%)" }
        }
      >
        <span className="w-2 h-2 rounded-full" style={{ background: "hsl(270, 60%, 55%)" }} />
        Zoho
      </button>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Type filters */}
      {eventTypes.map((et) => {
        const active = activeTypes.includes(et.type);
        const hsl = eventTypeHslMap[et.type];
        return (
          <button
            key={et.type}
            onClick={() => onToggleType(et.type)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-150"
            style={
              active
                ? { background: `hsl(${hsl})`, color: "hsl(220, 20%, 6%)" }
                : { background: "transparent", border: `1px solid hsl(${hsl})`, color: `hsl(${hsl})` }
            }
          >
            {et.label}
          </button>
        );
      })}
    </div>
  );
};

export default CalendarFilters;
