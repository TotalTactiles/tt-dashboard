import { useCallback, useEffect, useState } from "react";
import type { LiveCalendarEvent } from "@/contexts/DashboardDataContext";

const SAFETY_MS = 15 * 60 * 1000; // 15 minutes

const toDayKey = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const sameDay = (a?: string, b?: string) => toDayKey(a) === toDayKey(b);

interface PendingCreate {
  event: LiveCalendarEvent;
  ts: number;
}
interface PendingEdit {
  patch: Partial<LiveCalendarEvent>;
  ts: number;
}

export function useCalendarOverlay(rawEvents: LiveCalendarEvent[]) {
  const [pendingCreates, setPendingCreates] = useState<Map<string, PendingCreate>>(new Map());
  const [pendingDeletes, setPendingDeletes] = useState<Map<string, number>>(new Map());
  const [pendingEdits, setPendingEdits] = useState<Map<string, PendingEdit>>(new Map());

  // Reconcile whenever backend events change
  useEffect(() => {
    const now = Date.now();
    const byId = new Map(rawEvents.map((e) => [e.id, e]));

    setPendingDeletes((prev) => {
      if (prev.size === 0) return prev;
      const next = new Map(prev);
      let changed = false;
      for (const [id, ts] of prev) {
        // Backend no longer returns it → cache caught up. Or safety timeout.
        if (!byId.has(id) || now - ts > SAFETY_MS) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    setPendingCreates((prev) => {
      if (prev.size === 0) return prev;
      const next = new Map(prev);
      let changed = false;
      for (const [id, { event, ts }] of prev) {
        const foundById = byId.has(id);
        const foundByShape =
          !foundById &&
          rawEvents.some(
            (e) =>
              e.title === event.title &&
              sameDay(e.start, event.start) &&
              e.source === event.source
          );
        if (foundById || foundByShape || now - ts > SAFETY_MS) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    setPendingEdits((prev) => {
      if (prev.size === 0) return prev;
      const next = new Map(prev);
      let changed = false;
      for (const [id, { patch, ts }] of prev) {
        const cur = byId.get(id);
        let matches = false;
        if (cur) {
          matches = Object.entries(patch).every(([k, v]) => {
            if (v === undefined || v === null) return true;
            if (k === "start" || k === "end") return sameDay((cur as any)[k], v as string);
            return (cur as any)[k] === v;
          });
        }
        if (matches || now - ts > SAFETY_MS) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [rawEvents]);

  const apply = useCallback(
    (events: LiveCalendarEvent[]): LiveCalendarEvent[] => {
      if (pendingCreates.size === 0 && pendingDeletes.size === 0 && pendingEdits.size === 0) {
        return events;
      }
      const filtered = events.filter((e) => !pendingDeletes.has(e.id));
      const withEdits = filtered.map((e) => {
        const edit = pendingEdits.get(e.id);
        return edit ? { ...e, ...edit.patch, _pending: "edit" as const } : e;
      });
      const existingIds = new Set(withEdits.map((e) => e.id));
      const additions: LiveCalendarEvent[] = [];
      for (const [id, { event }] of pendingCreates) {
        if (existingIds.has(id)) continue;
        const dup = withEdits.some(
          (e) =>
            e.title === event.title &&
            sameDay(e.start, event.start) &&
            e.source === event.source
        );
        if (!dup) additions.push({ ...event, _pending: "create" });
      }
      return additions.length ? [...withEdits, ...additions] : withEdits;
    },
    [pendingCreates, pendingDeletes, pendingEdits]
  );

  const pinCreate = useCallback((event: LiveCalendarEvent) => {
    setPendingCreates((p) => {
      const next = new Map(p);
      next.set(event.id, { event, ts: Date.now() });
      return next;
    });
  }, []);

  const pinDelete = useCallback((id: string) => {
    setPendingDeletes((p) => {
      const next = new Map(p);
      next.set(id, Date.now());
      return next;
    });
  }, []);

  const pinEdit = useCallback((id: string, patch: Partial<LiveCalendarEvent>) => {
    setPendingEdits((p) => {
      const next = new Map(p);
      next.set(id, { patch, ts: Date.now() });
      return next;
    });
  }, []);

  return { apply, pinCreate, pinDelete, pinEdit };
}
