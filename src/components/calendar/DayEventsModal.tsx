import * as DialogPrimitive from "@radix-ui/react-dialog";
import { type LiveCalendarEvent } from "@/contexts/DashboardDataContext";
import { getEventTheme } from "./eventColors";
import { cn } from "@/lib/utils";

interface DayEventsModalProps {
  open: boolean;
  onClose: () => void;
  date: Date | null;
  events: LiveCalendarEvent[];
  onEventClick: (ev: LiveCalendarEvent) => void;
  onAddEvent: () => void;
}

const parseLocal = (raw: string) =>
  raw.includes("T") ? new Date(raw) : new Date(raw + "T00:00:00");

const formatTime = (iso: string) => {
  const d = parseLocal(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
};

// Convert a hex like #RRGGBB to rgba with alpha.
const hexA = (hex: string, alpha: number) => {
  const m = hex.replace("#", "");
  if (m.length !== 6) return hex;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

const DayEventsModal = ({ open, onClose, date, events, onEventClick, onAddEvent }: DayEventsModalProps) => {
  if (!date) return null;

  const title = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const sorted = [...events].sort((a, b) => a.start.localeCompare(b.start));

  const sourceLabel = (ev: LiveCalendarEvent) => {
    const s = (ev.source || "").toLowerCase();
    if (s.includes("google")) return "Google";
    if (s.includes("zoho")) return "Zoho";
    if (s.includes("strategic") || ev.id?.startsWith("sqb-")) return "Board";
    return ev.source || "Other";
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed z-50 bg-card text-foreground border border-border/60 shadow-2xl",
            // Bottom sheet on mobile, centered card on desktop
            "inset-x-0 bottom-0 rounded-t-2xl border-x-0 border-b-0 px-3.5 pt-2 pb-4",
            "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2",
            "sm:w-[440px] sm:max-w-[calc(100vw-2rem)] sm:rounded-2xl sm:border sm:px-4 sm:pt-3 sm:pb-4",
            "max-h-[80vh] flex flex-col",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
            "sm:data-[state=open]:slide-in-from-bottom-2 sm:data-[state=closed]:slide-out-to-bottom-2",
          )}
        >
          {/* Grab handle — tap to close */}
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="mx-auto mb-2 block h-1 w-10 rounded-full bg-muted-foreground/40 hover:bg-muted-foreground/60 transition-colors sm:hidden"
          />

          <div className="flex items-baseline justify-between mb-3 px-0.5">
            <DialogPrimitive.Title className="text-[15px] font-bold text-foreground">
              {title}
            </DialogPrimitive.Title>
            <span className="font-mono text-[11px] text-muted-foreground shrink-0">
              {sorted.length} {sorted.length === 1 ? "event" : "events"}
            </span>
          </div>

          <div
            className="flex-1 min-h-0 overflow-y-auto max-h-[60vh] -mx-1 px-1"
            style={{ scrollbarWidth: "thin" }}
          >
            {sorted.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nothing scheduled</p>
            ) : (
              sorted.map((ev) => {
                const color = getEventTheme(ev).accent;
                const isPending = !!ev._pending;
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => onEventClick(ev)}
                    className="relative w-full flex items-center gap-3 py-2.5 pl-3.5 pr-3 rounded-xl text-left hover:bg-white/[0.04] transition-colors mb-1.5"
                    style={{ opacity: isPending ? 0.6 : 1 }}
                  >
                    <span
                      className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
                      style={{ background: color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-foreground truncate">
                        {ev.title}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground mt-0.5 truncate">
                        {ev.allDay ? "All day" : formatTime(ev.start)}
                        {ev.type ? ` · ${ev.type}` : ""}
                      </div>
                    </div>
                    <span
                      className="font-mono text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 uppercase tracking-wide"
                      style={{ background: hexA(color, 0.16), color }}
                    >
                      {sourceLabel(ev)}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <button
            type="button"
            onClick={onAddEvent}
            className="w-full mt-2 py-2.5 rounded-xl border border-dashed border-border text-[12.5px] font-semibold text-primary hover:bg-primary/10 transition-colors"
          >
            + Add event on this day
          </button>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default DayEventsModal;
