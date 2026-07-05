import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, ExternalLink } from "lucide-react";
import { type LiveCalendarEvent } from "@/contexts/DashboardDataContext";
import { getEventTheme } from "./eventColors";

interface DayEventsModalProps {
  open: boolean;
  onClose: () => void;
  date: Date | null;
  events: LiveCalendarEvent[];
  onEventClick: (ev: LiveCalendarEvent) => void;
  onAddEvent: () => void;
}

const pad = (n: number) => n.toString().padStart(2, "0");
const parseLocal = (raw: string) =>
  raw.includes("T") ? new Date(raw) : new Date(raw + "T00:00:00");

const formatTime = (iso: string) => {
  const d = parseLocal(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
};

const DayEventsModal = ({ open, onClose, date, events, onEventClick, onAddEvent }: DayEventsModalProps) => {
  if (!date) return null;

  const title = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const sorted = [...events].sort((a, b) => a.start.localeCompare(b.start));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[480px] max-h-[85vh] overflow-hidden p-5 flex flex-col">
        <DialogHeader className="shrink-0">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-sm font-semibold">{title}</DialogTitle>
            <button
              onClick={onAddEvent}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Event
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 text-left">
            {sorted.length} {sorted.length === 1 ? "event" : "events"}
          </p>
        </DialogHeader>

        <div
          className="flex-1 min-h-0 overflow-y-auto pr-1 mt-3 space-y-2"
          style={{ scrollbarWidth: "thin" }}
        >
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nothing scheduled</p>
          ) : (
            sorted.map((ev) => {
              const theme = getEventTheme(ev);
              const isPending = !!ev._pending;
              const src = (ev.source || "").toLowerCase();
              const badgeLabel = src.includes("google")
                ? "Google"
                : src.includes("zoho")
                  ? "Zoho"
                  : ev.source || "Other";
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => onEventClick(ev)}
                  className="w-full text-left rounded-xl p-3 transition-all duration-200 hover:scale-[1.01] cursor-pointer block"
                  style={{
                    background: theme.bg,
                    borderLeft: `3px solid ${theme.border}`,
                    opacity: isPending ? 0.6 : 1,
                  }}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`rounded-full shrink-0 w-2 h-2 ${isPending ? "animate-pulse" : ""}`}
                        style={{ backgroundColor: theme.accent }}
                      />
                      <p className="text-xs font-bold text-foreground truncate" title={ev.title}>
                        {ev.title}
                      </p>
                      {ev.htmlLink && (
                        <a
                          href={ev.htmlLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0"
                        >
                          <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary" />
                        </a>
                      )}
                    </div>
                    <span
                      className="text-[9px] font-mono px-2 py-0.5 rounded-full shrink-0"
                      style={{
                        background: theme.bg,
                        color: theme.accent,
                        border: `1px solid ${theme.border}`,
                      }}
                    >
                      {badgeLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {ev.allDay
                        ? "All day"
                        : `${formatTime(ev.start)}${ev.end ? ` – ${formatTime(ev.end)}` : ""}`}
                    </span>
                    {ev.type && (
                      <span className="text-[10px] text-muted-foreground/70">· {ev.type}</span>
                    )}
                    {isPending && (
                      <span className="ml-auto text-[9px] italic text-muted-foreground">syncing…</span>
                    )}
                  </div>
                  {ev.description && (
                    <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                      {ev.description}
                    </p>
                  )}
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DayEventsModal;
