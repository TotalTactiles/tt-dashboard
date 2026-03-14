import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { type LiveCalendarEvent } from "@/contexts/DashboardDataContext";

interface EventModalProps {
  open: boolean;
  onClose: () => void;
  event: LiveCalendarEvent | null;
  onSave: (action: "create" | "update" | "delete", data: Partial<LiveCalendarEvent>) => void;
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

  useEffect(() => {
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

  const handleSave = () => {
    if (!title.trim() || !date) return;
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

    onSave(isEditing ? "update" : "create", {
      title: title.trim(),
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      start: startISO,
      end: endISO,
      allDay,
      type,
      attendees,
    });
  };

  const handleDelete = () => {
    if (event) onSave("delete", {});
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Event" : "Add Event"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Title */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1 block">Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" />
          </div>

          {/* Date */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1 block">Date *</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          {/* All day toggle */}
          <div className="flex items-center gap-3">
            <Switch checked={allDay} onCheckedChange={setAllDay} />
            <Label className="text-xs">All day</Label>
          </div>

          {/* Time pickers */}
          {!allDay && (
            <div className="flex gap-3">
              <div className="flex-1">
                <Label className="text-xs font-medium text-muted-foreground mb-1 block">Start Time</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div className="flex-1">
                <Label className="text-xs font-medium text-muted-foreground mb-1 block">End Time</Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
          )}

          {/* Type selector */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-2 block">Type</Label>
            <div className="flex flex-wrap gap-1.5">
              {EVENT_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className="px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-150"
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
          </div>

          {/* Description */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1 block">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" rows={2} />
          </div>

          {/* Location */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1 block">Location</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Optional location" />
          </div>

          {/* Attendees */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1 block">Attendees</Label>
            <Input
              value={attendeesStr}
              onChange={(e) => setAttendeesStr(e.target.value)}
              placeholder="email1@example.com, email2@example.com"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={!title.trim() || !date}
              className="flex-1 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
            >
              Cancel
            </button>
            {isEditing && (
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EventModal;
