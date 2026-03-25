interface CalendarFiltersProps {
  activeTypes: string[];
  onToggleType: (type: string) => void;
  activeSources: string[];
  onToggleSource: (source: string) => void;
}

const TYPE_COLORS: Record<string, string> = {
  Meeting: "200 80% 50%",
  Deadline: "0 72% 55%",
  Milestone: "270 60% 55%",
  Care: "130 55% 40%",
  Valuation: "38 70% 42%",
  Distribution: "160 70% 35%",
};

const eventTypes = [
  { type: "Meeting", label: "Meetings" },
  { type: "Deadline", label: "Deadlines" },
  { type: "Milestone", label: "Milestones" },
  { type: "Care", label: "Care" },
  { type: "Valuation", label: "Valuations" },
  { type: "Distribution", label: "Distributions" },
];

const CalendarFilters = ({ activeTypes, onToggleType, activeSources, onToggleSource }: CalendarFiltersProps) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Source filters */}
      <button
        onClick={() => onToggleSource("Google Calendar")}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-150"
        style={
          activeSources.includes("Google Calendar")
            ? { background: "hsl(200, 80%, 50%)", color: "hsl(220, 20%, 6%)" }
            : { background: "transparent", border: "1px solid hsl(200, 80%, 50%)", color: "hsl(200, 80%, 50%)" }
        }
      >
        <span className="w-2 h-2 rounded-full" style={{ background: "hsl(200, 80%, 50%)" }} />
        Google Calendar
      </button>
      <button
        onClick={() => onToggleSource("Zoho Calendar")}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-150"
        style={
          activeSources.includes("Zoho Calendar")
            ? { background: "hsl(270, 60%, 55%)", color: "hsl(220, 20%, 6%)" }
            : { background: "transparent", border: "1px solid hsl(270, 60%, 55%)", color: "hsl(270, 60%, 55%)" }
        }
      >
        <span className="w-2 h-2 rounded-full" style={{ background: "hsl(270, 60%, 55%)" }} />
        Zoho Calendar
      </button>
      <button
        onClick={() => onToggleSource("Zoho Projects")}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-150"
        style={
          activeSources.includes("Zoho Projects")
            ? { background: "hsl(130, 55%, 40%)", color: "hsl(220, 20%, 6%)" }
            : { background: "transparent", border: "1px solid hsl(130, 55%, 40%)", color: "hsl(130, 55%, 40%)" }
        }
      >
        <span className="w-2 h-2 rounded-full" style={{ background: "hsl(130, 55%, 40%)" }} />
        Zoho Projects
      </button>
      <button
        onClick={() => onToggleSource("Strategic Board")}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-150"
        style={
          activeSources.includes("Strategic Board")
            ? { background: "hsl(38, 70%, 42%)", color: "hsl(220, 20%, 6%)" }
            : { background: "transparent", border: "1px solid hsl(38, 70%, 42%)", color: "hsl(38, 70%, 42%)" }
        }
      >
        <span className="w-2 h-2 rounded-full" style={{ background: "hsl(38, 70%, 42%)" }} />
        Strategic Board
      </button>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Type filters */}
      {eventTypes.map((et) => {
        const active = activeTypes.includes(et.type);
        const hsl = TYPE_COLORS[et.type] || "200 80% 50%";
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
