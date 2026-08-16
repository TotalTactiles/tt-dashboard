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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addTaskViaRoute, LIVE_ACTION_WARNING, useLeadTaskKinds } from "@/hooks/useCrmLeads";

const EM_DASH = String.fromCharCode(8212);
const MAX_TITLE = 200;

/**
 * Creates a lead task through the tt-lead-task workflow. The task vocabulary comes
 * only from lead_task_kinds, never from a list held in this file. Four distinct
 * states: idle, submitting, error and success. An error is never collapsed into empty.
 */
export default function AddTaskDialog({
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
  const { kinds, loading: kindsLoading, error: kindsError } = useLeadTaskKinds();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle("");
      setKind("");
      setDueDate("");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const trimmed = title.trim();
  const tooLong = title.length > MAX_TITLE;
  const hasEmDash = title.includes(EM_DASH);

  const disabled =
    !operator || kindsLoading || kindsError !== null || kinds.length === 0 ||
    !trimmed || tooLong || hasEmDash || !kind || !dueDate || submitting;

  async function submit() {
    if (disabled || !operator) return;
    setSubmitting(true);
    setError(null);
    const result = await addTaskViaRoute(leadId, operator, trimmed, kind, dueDate);
    setSubmitting(false);
    if (result.ok === true) {
      onAdded();
      onOpenChange(false);
      return;
    }
    setError(result.detail || "The task was not created.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a task to this lead</DialogTitle>
          <DialogDescription>
            The task is written to the lead history, so it becomes visible on the timeline.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {LIVE_ACTION_WARNING}
        </div>

        <div className="space-y-1">
          <div className="font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground">Title</div>
          <input
            value={title}
            onChange={(e) => { setTitle(e.target.value); setError(null); }}
            placeholder="What has to be done"
            disabled={submitting}
            className="w-full rounded border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring disabled:opacity-70"
          />
          <div className="font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground">
            {`${title.length} / ${MAX_TITLE}`}
          </div>
          {tooLong && (
            <div className="text-sm text-destructive">{`The title is longer than ${MAX_TITLE} characters.`}</div>
          )}
          {hasEmDash && (
            <div className="text-sm text-destructive">
              The title contains an em dash and must use a plain hyphen instead.
            </div>
          )}
        </div>

        <div className="space-y-1">
          <div className="font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground">Kind</div>
          {kindsLoading ? (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading the task kinds
            </div>
          ) : kindsError !== null ? (
            <div className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              The task kinds could not be loaded, so a task cannot be created.
              <div className="mt-1">{kindsError}</div>
            </div>
          ) : kinds.length === 0 ? (
            <div className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              No active task kinds are configured, so a task cannot be created.
            </div>
          ) : (
            <Select value={kind} onValueChange={(v) => { setKind(v); setError(null); }} disabled={submitting}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a kind" />
              </SelectTrigger>
              <SelectContent>
                {kinds.map((k) => (
                  <SelectItem key={k.kind} value={k.kind}>{k.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-1">
          <div className="font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground">Due date</div>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => { setDueDate(e.target.value); setError(null); }}
            disabled={submitting}
            className="w-full rounded border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring disabled:opacity-70"
          />
        </div>

        {!operator && (
          <div className="text-sm text-destructive">Pick who is working before adding a task.</div>
        )}

        {error !== null && (
          <div className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <div className="font-mono text-[10.5px] uppercase tracking-widest">Not created</div>
            <div className="mt-1">{error}</div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => void submit()} disabled={disabled}>
            {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {submitting ? "Creating" : "Create task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
