import { Badge } from "@/components/ui/badge";
import { CalendarEvent, eventTypeColors } from "@/data/calendarMockData";

interface CalendarFiltersProps {
  activeTypes: CalendarEvent["type"][];
  onToggleType: (type: CalendarEvent["type"]) => void;
  activeSources: ("google" | "zoho")[];
  onToggleSource: (source: "google" | "zoho") => void;
  viewMode: "side-by-side" | "cards";
  onViewModeChange: (mode: "side-by-side" | "cards") => void;
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

const CalendarFilters = ({ activeTypes, onToggleType, activeSources, onToggleSource, viewMode, onViewModeChange }: CalendarFiltersProps) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 mr-3">
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Sources:</span>
        <Badge
          variant={activeSources.includes("google") ? "default" : "outline"}
          className="text-[10px] cursor-pointer"
          onClick={() => onToggleSource("google")}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-chart-blue mr-1" /> Google
        </Badge>
        <Badge
          variant={activeSources.includes("zoho") ? "default" : "outline"}
          className="text-[10px] cursor-pointer"
          onClick={() => onToggleSource("zoho")}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-chart-purple mr-1" /> Zoho
        </Badge>
      </div>

      <div className="flex items-center gap-1 mr-3">
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Type:</span>
        {eventTypes.map((et) => (
          <Badge
            key={et.type}
            variant={activeTypes.includes(et.type) ? "default" : "outline"}
            className="text-[9px] cursor-pointer px-1.5"
            onClick={() => onToggleType(et.type)}
          >
            <span className="w-1.5 h-1.5 rounded-full mr-1" style={{ backgroundColor: eventTypeColors[et.type] }} />
            {et.label}
          </Badge>
        ))}
      </div>

      <div className="flex items-center gap-1 ml-auto">
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mr-1">View:</span>
        <button
          onClick={() => onViewModeChange("side-by-side")}
          className={`text-[10px] px-2 py-1 rounded font-mono transition-colors ${viewMode === "side-by-side" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
        >
          Side by Side
        </button>
        <button
          onClick={() => onViewModeChange("cards")}
          className={`text-[10px] px-2 py-1 rounded font-mono transition-colors ${viewMode === "cards" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
        >
          Cards
        </button>
      </div>
    </div>
  );
};

export default CalendarFilters;
