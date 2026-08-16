import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  fetchDeleteImpact, deleteLeadViaRoute, LIVE_ACTION_WARNING,
  IMPACT_BLOCKS, IMPACT_DESTROYED, IMPACT_REFERENCE_CLEARED,
  type DeleteImpactRow,
} from "@/hooks/useCrmLeads";

const DASH = "-";
const EM_DASH = String.fromCharCode(8212);

export default function DeleteLeadDialog({
  open, onOpenChange, leadId, companyBuilder, projectName, operator, onDeleted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId: string;
  companyBuilder: string | null;
  projectName: string | null;
  operator: string | null;
  onDeleted: () => void;
}) {
  const { toast } = useToast();
  const [impact, setImpact] = useState<DeleteImpactRow[] | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactError, setImpactError] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setDeleteReason("");
    setImpact(null);
    setImpactError(null);
    setImpactLoading(true);
    (async () => {
      try {
        const rows = await fetchDeleteImpact(leadId);
        if (!cancelled) setImpact(rows);
      } catch (err: any) {
        if (!cancelled) setImpactError(err?.message ?? "The impact could not be computed.");
      } finally {
        if (!cancelled) setImpactLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, leadId]);

  const blocking = (impact ?? []).filter((r) => r.behaviour === IMPACT_BLOCKS && Number(r.rows_affected) > 0);
  const destroyed = (impact ?? []).filter((r) => r.behaviour === IMPACT_DESTROYED && Number(r.rows_affected) > 0);
  const cleared   = (impact ?? []).filter((r) => r.behaviour === IMPACT_REFERENCE_CLEARED && Number(r.rows_affected) > 0);
  const untouched = (impact ?? []).filter((r) => Number(r.rows_affected) === 0);
  const unknown   = (impact ?? []).filter((r) =>
    r.behaviour !== IMPACT_BLOCKS && r.behaviour !== IMPACT_DESTROYED && r.behaviour !== IMPACT_REFERENCE_CLEARED);

  const trimmedReason = deleteReason.trim();
  const reasonTooLong = deleteReason.length > 500;
  const reasonHasEmDash = deleteReason.includes(EM_DASH);
  const confirmDisabled =
    deleting || !operator || !trimmedReason || reasonTooLong || reasonHasEmDash ||
    impactLoading || impactError !== null || impact === null || impact.length === 0 ||
    unknown.length > 0 || blocking.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-4 h-4" /> Delete this lead permanently?
          </DialogTitle>
          <DialogDescription asChild>
            <div>
              <div className="font-semibold text-foreground">{companyBuilder}</div>
              {projectName ? <div>{projectName}</div> : null}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive font-semibold">
          {LIVE_ACTION_WARNING}
        </div>

        {impactLoading && (
          <div className="text-xs text-muted-foreground font-mono">Checking what this will remove...</div>
        )}

        {!impactLoading && impactError && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {impactError}
          </div>
        )}

        {!impactLoading && !impactError && impact !== null && impact.length === 0 && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            The impact could not be computed, so this delete is refused.
          </div>
        )}

        {!impactLoading && !impactError && unknown.length > 0 && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive space-y-1">
            <div className="font-semibold">The database returned a behaviour this screen does not understand, so this delete is refused.</div>
            {unknown.map((r) => (
              <div key={r.child_table} className="font-mono">{r.child_table}: {r.behaviour}</div>
            ))}
          </div>
        )}

        {!impactLoading && !impactError && impact !== null && impact.length > 0 && unknown.length === 0 && (
          <div className="space-y-3">
            {blocking.length > 0 && (
              <div className="rounded-md border-2 border-destructive bg-destructive/15 px-3 py-2 text-xs text-destructive space-y-1">
                <div className="font-semibold uppercase tracking-widest font-mono">This lead cannot be deleted</div>
                {blocking.map((r) => (
                  <div key={r.child_table} className="font-mono">{r.child_table}: {r.rows_affected}</div>
                ))}
              </div>
            )}

            {destroyed.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-widest text-destructive font-mono mb-1">Permanently destroyed</div>
                <div className="space-y-0.5">
                  {destroyed.map((r) => (
                    <div key={r.child_table} className="text-xs font-mono">{r.rows_affected} {r.child_table}</div>
                  ))}
                </div>
              </div>
            )}

            {cleared.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1">Kept, reference cleared</div>
                <div className="space-y-0.5">
                  {cleared.map((r) => (
                    <div key={r.child_table} className="text-xs font-mono">{r.rows_affected} {r.child_table}</div>
                  ))}
                </div>
              </div>
            )}

            <div className="text-[10px] text-muted-foreground font-mono">
              {untouched.length} other linked tables have nothing to remove.
            </div>
          </div>
        )}

        <div>
          <Label className="text-xs">Reason (required)</Label>
          <Input
            className="mt-1"
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
            placeholder="e.g. duplicate, out of scope, test data"
          />
          <div className="flex items-center justify-between mt-1">
            <div className="text-[10px] text-destructive">
              {reasonHasEmDash ? "Remove the long dash character from the reason." : reasonTooLong ? "The reason must be 500 characters or fewer." : ""}
            </div>
            <div className="text-[10px] font-mono text-muted-foreground">{deleteReason.length}/500</div>
          </div>
        </div>

        {!operator && (
          <div className="text-[10px] text-destructive font-mono">Pick who is working before deleting this lead.</div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={confirmDisabled}
            onClick={async () => {
              setDeleting(true);
              try {
                const result = await deleteLeadViaRoute(leadId, operator!, trimmedReason, (impact ?? []).length);
                if (result.ok === true) {
                  toast({ title: "Lead deleted", description: `Tombstone key: ${result.tombstone_key ?? DASH}` });
                  onOpenChange(false);
                  onDeleted();
                } else {
                  toast({
                    title: "Delete refused",
                    description: result.detail ?? "The delete did not complete.",
                    className: "border-destructive/40 bg-destructive/10 text-destructive",
                  });
                }
              } finally {
                setDeleting(false);
              }
            }}
          >
            {deleting ? "Deleting..." : "Delete permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
