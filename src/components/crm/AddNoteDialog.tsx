import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { addNoteViaRoute, LIVE_ACTION_WARNING } from "@/hooks/useCrmLeads";

const EM_DASH = String.fromCharCode(8212);
const MAX = 4000;

/**
 * Appends a note to the lead timeline through the tt-lead-note workflow.
 * Four distinct states: idle, submitting, error and success. An error is never
 * collapsed into an empty or idle screen.
 */
export default function AddNoteDialog({
  open,
  onOpenChange,
  leadId,
  operator,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId: string;
  operator: string | null;
  onAdded: () => void;
}) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNote("");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const trimmed = note.trim();
  const tooLong = note.length > MAX;
  const hasEmDash = note.includes(EM_DASH);

  const disabled = !operator || !trimmed || tooLong || hasEmDash || submitting;

  async function submit() {
    if (disabled || !operator) return;
    setSubmitting(true);
    setError(null);
    const result = await addNoteViaRoute(leadId, operator, trimmed);
    setSubmitting(false);
    if (result.ok === true) {
      onAdded();
      onOpenChange(false);
      return;
    }
    setError(result.detail || "The note was not saved.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a note to this lead</DialogTitle>
          <DialogDescription>
            A note cannot be edited or deleted once saved, because the timeline is append-only.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {LIVE_ACTION_WARNING}
        </div>

        <textarea
          value={note}
          onChange={(e) => { setNote(e.target.value); setError(null); }}
          rows={6}
          placeholder="What happened, in plain words"
          disabled={submitting}
          className="w-full resize-y rounded border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring disabled:opacity-70"
        />

        <div className="flex items-center justify-between font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground">
          <span>{`${note.length} / ${MAX}`}</span>
          {!operator && <span className="text-destructive">Pick who is working before adding a note.</span>}
        </div>

        {tooLong && (
          <div className="text-sm text-destructive">{`The note is longer than ${MAX} characters.`}</div>
        )}

        {hasEmDash && (
          <div className="text-sm text-destructive">
            The note contains an em dash and must use a plain hyphen instead.
          </div>
        )}

        {error !== null && (
          <div className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <div className="font-mono text-[10.5px] uppercase tracking-widest">Not saved</div>
            <div className="mt-1">{error}</div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => void submit()} disabled={disabled}>
            {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {submitting ? "Saving" : "Save note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
