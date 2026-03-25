import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

export interface CustomFilter {
  id: string;
  label: string;
  color: string;
  active: boolean;
}

interface CalendarFiltersProps {
  activeSources: string[];
  onToggleSource: (source: string) => void;
  customFilters: CustomFilter[];
  onUpdateCustomFilters: (filters: CustomFilter[]) => void;
}

const uid = () => Math.random().toString(36).slice(2, 8);

const PRESET_COLORS = [
  "#378ADD", "#1D9E75", "#E24B4A", "#BA7517",
  "#7F77DD", "#639922", "#D4537E", "#5DCAA5",
];

const SOURCE_CONFIG = [
  { key: "Google Calendar", color: "#378ADD" },
  { key: "Zoho Projects",   color: "#7F77DD" },
  { key: "Strategic Board", color: "#BA7517" },
];

const CalendarFilters = ({
  activeSources,
  onToggleSource,
  customFilters,
  onUpdateCustomFilters,
}: CalendarFiltersProps) => {
  const [addOpen, setAddOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);

  const handleAdd = () => {
    if (!newLabel.trim()) return;
    onUpdateCustomFilters([
      ...customFilters,
      { id: uid(), label: newLabel.trim(), color: newColor, active: true },
    ]);
    setNewLabel("");
    setNewColor(PRESET_COLORS[0]);
    setAddOpen(false);
  };

  const toggleCustom = (id: string) =>
    onUpdateCustomFilters(customFilters.map((f) => f.id === id ? { ...f, active: !f.active } : f));

  const removeCustom = (id: string) =>
    onUpdateCustomFilters(customFilters.filter((f) => f.id !== id));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {SOURCE_CONFIG.map(({ key, color }) => {
        const active = activeSources.includes(key);
        return (
          <button
            key={key}
            onClick={() => onToggleSource(key)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-150"
            style={
              active
                ? { background: color, color: "#fff" }
                : { background: "transparent", border: `1px solid ${color}`, color }
            }
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: active ? "#fff" : color }} />
            {key}
          </button>
        );
      })}

      <span className="w-px h-5 bg-border mx-1" />

      {customFilters.map((f) => (
        <div key={f.id} className="group/cf flex items-center">
          <button
            onClick={() => toggleCustom(f.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-l-full text-[11px] font-medium transition-all duration-150"
            style={
              f.active
                ? { background: f.color, color: "#fff" }
                : { background: "transparent", border: `1px solid ${f.color}`, borderRight: "none", color: f.color }
            }
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: f.active ? "#fff" : f.color }} />
            {f.label}
          </button>
          <button
            onClick={() => removeCustom(f.id)}
            className="px-1.5 py-1.5 rounded-r-full opacity-0 group-hover/cf:opacity-100 transition-opacity"
            style={
              f.active
                ? { background: f.color, color: "#fff" }
                : { background: "transparent", border: `1px solid ${f.color}`, borderLeft: "none", color: f.color }
            }
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}

      <Popover open={addOpen} onOpenChange={setAddOpen}>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] text-muted-foreground hover:text-foreground border border-dashed border-border hover:border-foreground/30 transition-colors">
            <Plus className="w-3 h-3" />
            Add filter
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 space-y-3 p-3" side="bottom" align="start">
          <p className="text-xs font-medium text-muted-foreground">New filter label</p>
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="w-full bg-muted rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/40 border-0"
          />
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Colour</p>
            <div className="flex gap-1.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className="w-5 h-5 rounded-full transition-transform hover:scale-110"
                  style={{
                    background: c,
                    outline: newColor === c ? `2px solid ${c}` : "2px solid transparent",
                    outlineOffset: "2px",
                  }}
                />
              ))}
            </div>
          </div>
          <button onClick={handleAdd} className="w-full py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
            Add
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default CalendarFilters;
