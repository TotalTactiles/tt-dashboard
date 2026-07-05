import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { type LiveCalendarEvent } from "@/contexts/DashboardDataContext";
import { Loader2, AlignLeft, MapPin, Users } from "lucide-react";

interface EventModalProps {
  open: boolean;
  onClose: () => void;
  event: LiveCalendarEvent | null;
  onSave: (action: "create" | "update" | "delete", data: Partial<LiveCalendarEvent>) => Promise<void>;
  selectedDate: Date;
}

const EVENT_TYPES = ["Meeting", "Deadline", "Milestone", "Care", "Valuation", "Distribution"];

const TYPE_COLORS: Record<string, string> = {
  Meeting: "#378ADD",
  Deadline: "#E24B4A",
  Milestone: "#7F77DD",
  Care: "#639922",
  Valuation: "#BA7517",
  Distribution: "#1D9E75",
};

const pad = (n: number) => n.toString().padStart(2, "0");
const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

const EventModal = ({ open, onClose, event, onSave, selectedDate }: EventModalProps) => {
  const isEditing = !!event;

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [allDay, setAllDay] = useState(false);
  const [type, setType] = useState("Meeting");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [attendeesStr, setAttendeesStr] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ title?: boolean; date?: boolean }>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) {
      setLoading(false);
      setErrors({});
      setConfirmDelete(false);
      return;
    }
    if (event) {
      setTitle(event.title);
      const s = new Date(event.start);
      const e = new Date(event.end);
      setDate(toDateInput(s));
      setStartTime(toTimeInput(s));
      setEndTime(toTimeInput(e));
      setAllDay(event.allDay);
      setType(event.type);
      setDescription(event.description || "");
      setLocation(event.location || "");
      setAttendeesStr((event.attendees || []).join(", "));
    } else {
      setTitle("");
      setDate(toDateInput(selectedDate));
      setStartTime("09:00");
      setEndTime("10:00");
      setAllDay(false);
      setType("Meeting");
      setDescription("");
      setLocation("");
      setAttendeesStr("");
    }
  }, [event, selectedDate, open]);

  const handleSave = async () => {
    const newErrors: { title?: boolean; date?: boolean } = {};
    if (!title.trim()) newErrors.title = true;
    if (!date) newErrors.date = true;
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    const startISO = allDay
      ? new Date(`${date}T00:00:00`).toISOString()
      : new Date(`${date}T${startTime}:00`).toISOString();
    const endISO = allDay
      ? new Date(`${date}T23:59:59`).toISOString()
      : new Date(`${date}T${endTime}:00`).toISOString();

    const attendees = attendeesStr
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);

    setLoading(true);
    await onSave(isEditing ? "update" : "create", {
      title: title.trim(),
      description: description.trim() || "",
      location: location.trim() || "",
      start: startISO,
      end: endISO,
      startDate: date,
      endDate: date,
      allDay,
      type,
      attendees,
      googleId: event?.googleId,
      zohoId: event?.zohoId,
      source: event?.source,
      projectId: (event as any)?.projectId,
    } as any);
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setLoading(true);
    await onSave("delete", {
      googleId: event?.googleId,
      zohoId: event?.zohoId,
    });
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[460px] max-h-[85vh] overflow-y-auto p-5">
        <DialogHeader className="sr-only">
          <DialogTitle>{isEditing ? "Edit Event" : "Add Event"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-1 min-w-0">
          {/* Title */}
          <Input
            value={title}
            onChange={(e) => { setTitle(e.target.value); setErrors((p) => ({ ...p, title: false })); }}
            placeholder="Add title"
            className={[
              "w-full min-w-0 text-lg font-medium border-0 border-b rounded-none bg-transparent px-0 py-1.5",
              "placeholder:text-muted-foreground/70 placeholder:font-normal",
              "focus-visible:ring-0 focus-visible:border-b-ring",
              errors.title ? "border-b-destructive focus-visible:border-b-destructive" : "border-b-transparent",
            ].join(" ")}
          />
          {errors.title && <p className="text-[11px] text-destructive -mt-2">Title is required</p>}

          {/* All-day toggle */}
          <div className="flex items-center justify-end gap-1.5">
            <Switch
              id="allDay"
              checked={allDay}
              onCheckedChange={setAllDay}
              className="scale-90 origin-right"
            />
            <Label htmlFor="allDay" className="text-xs text-muted-foreground whitespace-nowrap cursor-pointer">
              All-day
            </Label>
          </div>

          {/* Date */}
          <Input
            type="date"
            value={date}
            onChange={(e) => { setDate(e.target.value); setErrors((p) => ({ ...p, date: false })); }}
            className={[
              "w-full min-w-0 h-9 text-sm border-0 bg-secondary/50 rounded-lg px-2.5",
              errors.date ? "ring-1 ring-destructive" : "",
            ].join(" ")}
          />
          {errors.date && <p className="text-[11px] text-destructive -mt-2">Date is required</p>}

          {/* Time range (hidden when all-day) */}
          {!allDay && (
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="flex-1 basis-0 min-w-0 h-9 text-sm border-0 bg-secondary/50 rounded-lg px-2.5"
              />
              <span className="text-muted-foreground shrink-0">–</span>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="flex-1 basis-0 min-w-0 h-9 text-sm border-0 bg-secondary/50 rounded-lg px-2.5"
              />
            </div>
          )}

          {/* Type chips */}
          <div className="flex flex-wrap gap-2 min-w-0">
            {EVENT_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className="px-2 py-0.5 rounded-full text-[10px] font-medium transition-all duration-150"
                style={
                  type === t
                    ? { backgroundColor: TYPE_COLORS[t], color: "#fff" }
                    : { backgroundColor: "transparent", border: `1px solid ${TYPE_COLORS[t]}`, color: TYPE_COLORS[t] }
                }
              >
                {t}
              </button>
            ))}
          </div>

          {/* Description */}
          <div className="flex items-start gap-2 min-w-0">
            <AlignLeft className="h-4 w-4 text-muted-foreground mt-2 shrink-0" />
            <div className="flex-1 min-w-0">
              <Label className="text-[11px] font-normal text-muted-foreground mb-0.5 block">Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add description"
                rows={2}
                className="w-full min-w-0 min-h-[60px] text-sm border-0 bg-transparent px-0 py-1 resize-y placeholder:text-muted-foreground/70 focus-visible:ring-0"
              />
            </div>
          </div>

          {/* Location */}
          <div className="flex items-start gap-2 min-w-0">
            <MapPin className="h-4 w-4 text-muted-foreground mt-2 shrink-0" />
            <div className="flex-1 min-w-0">
              <Label className="text-[11px] font-normal text-muted-foreground mb-0.5 block">Location</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Add location"
                className="w-full min-w-0 h-8 text-sm border-0 bg-transparent px-0 py-1 placeholder:text-muted-foreground/70 focus-visible:ring-0"
              />
            </div>
          </div>

          {/* Attendees */}
          <div className="flex items-start gap-2 min-w-0">
            <Users className="h-4 w-4 text-muted-foreground mt-2 shrink-0" />
            <div className="flex-1 min-w-0">
              <Label className="text-[11px] font-normal text-muted-foreground mb-0.5 block">Attendees</Label>
              <Input
                value={attendeesStr}
                onChange={(e) => setAttendeesStr(e.target.value)}
                placeholder="email1@example.com, email2@example.com"
                className="w-full min-w-0 h-8 text-sm border-0 bg-transparent px-0 py-1 placeholder:text-muted-foreground/70 focus-visible:ring-0 overflow-x-hidden text-ellipsis"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <div className="min-w-0">
              {isEditing && event?.source === "Zoho Projects" ? (
                <span className="text-[11px] text-muted-foreground">
                  Managed in Zoho Projects — edits sync back.
                </span>
              ) : isEditing ? (
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="text-sm text-destructive hover:text-destructive/80 font-medium transition-colors disabled:opacity-50"
                >
                  {confirmDelete ? "Confirm Delete" : "Delete"}
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
          {confirmDelete && (
            <p className="text-[11px] text-destructive text-center -mt-2">
              Delete this event from Google Calendar? Click again to confirm.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EventModal;
