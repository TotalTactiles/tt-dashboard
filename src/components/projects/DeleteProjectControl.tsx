import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import {
  PROJECT_DELETE_ENABLED,
  callDeleteProject,
  COUNT_LABELS,
  n,
  type DeleteProjectResult,
} from "@/lib/deleteProject";

export const DISABLED_HELP =
  "Not enabled yet. This will be switched on once the delete has been signed off.";


interface Props {
  projectId: string;
  projectName: string;
  onDeleted?: () => void;
  isMobile?: boolean;
}

export function DeleteProjectControl({ projectId, projectName, onDeleted, isMobile }: Props) {
  const { user } = useAuth();
  const [checking, setChecking] = useState(false);
  const [preview, setPreview] = useState<DeleteProjectResult | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [typed, setTyped] = useState("");
  const [reason, setReason] = useState("");
  const [deleting, setDeleting] = useState(false);

  const actor = user?.email ?? user?.id ?? "unknown";

  const startDelete = async () => {
    // Hard gate in the handler itself, not styling alone.
    if (!PROJECT_DELETE_ENABLED) return;
    if (checking) return;
    setChecking(true);
    setTyped("");
    setReason("");
    const outcome = await callDeleteProject({
      projectId,
      dryRun: true,
      reason: "dry run",
      by: actor,
    });
    setChecking(false);
    if (outcome.kind === "error") {
      toast.error(outcome.message);
      return;
    }
    setBlocked(outcome.kind === "blocked");
    setPreview(outcome.data);
  };

  const close = () => {
    setPreview(null);
    setBlocked(false);
  };

  const confirm = async () => {
    if (!PROJECT_DELETE_ENABLED || !preview || blocked) return;
    setDeleting(true);
    const outcome = await callDeleteProject({
      projectId,
      dryRun: false,
      reason: reason.trim(),
      by: actor,
    });
    setDeleting(false);
    if (outcome.kind === "ok") {
      toast.success(`Deleted ${preview.project.name}. ${outcome.data.rows_to_delete} rows removed.`);
      close();
      onDeleted?.();
      return;
    }
    if (outcome.kind === "blocked") {
      setBlocked(true);
      setPreview(outcome.data);
      return;
    }
    toast.error(outcome.message);
  };

  const rows = preview
    ? COUNT_LABELS.filter(([key]) => n(preview.counts?.[key]) > 0)
    : [];
  const orphaned = preview ? n(preview.stock_movements_orphaned) : 0;
  const collateral = preview
    ? n(preview.collateral?.scope_lines_of_other_projects_removed_via_our_tasks)
    : 0;
  const nameMatches = preview ? typed.trim() === preview.project.name : false;

  const blockerLines = preview
    ? ([
        [
          n(preview.blockers?.deals_referencing_project),
          "deals are linked to this project",
        ],
        [
          n(preview.blockers?.foreign_invoices_on_our_tasks),
          "invoices from other projects sit on this project's tasks",
        ],
        [
          n(preview.blockers?.foreign_invoice_lines_on_our_breakdowns),
          "invoice lines from other projects sit on this project's scope breakdown",
        ],
      ] as Array<[number, string]>).filter(([count]) => count > 0)
    : [];

  return (
    <>
      <div className={isMobile ? "space-y-1" : "flex items-center gap-2"}>
        <button
          type="button"
          disabled={!PROJECT_DELETE_ENABLED || checking}
          title={PROJECT_DELETE_ENABLED ? undefined : DISABLED_HELP}
          onClick={startDelete}
          className={
            isMobile
              ? "min-h-[44px] rounded-md text-[11px] font-mono uppercase tracking-widest text-white disabled:cursor-not-allowed px-2"
              : "h-8 px-3 rounded-md text-[11px] font-mono uppercase tracking-widest text-white disabled:cursor-not-allowed"
          }
          style={
            PROJECT_DELETE_ENABLED && !checking
              ? {
                  border: "1px solid #EF4444",
                  color: "#EF4444",
                  background: "transparent",
                }
              : { background: "#1D1D22", opacity: 0.55 }
          }
        >
          Delete Project
        </button>
      </div>
      {isMobile && !PROJECT_DELETE_ENABLED && (
        <div
          className="text-[10px] font-mono leading-snug"
          style={{ opacity: 0.55 }}
        >
          {DISABLED_HELP}
        </div>
      )}

      <Dialog open={!!preview} onOpenChange={(v) => (v ? null : close())}>

        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {preview && blocked && (
            <>
              <DialogHeader>
                <DialogTitle>{preview.project.name} cannot be deleted</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>This project cannot be deleted while these references exist:</p>
                <ul className="list-disc pl-5">
                  {blockerLines.map(([count, text]) => (
                    <li key={text}>
                      {count} {text}
                    </li>
                  ))}
                </ul>
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={close}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}

          {preview && !blocked && (
            <>
              <DialogHeader>
                <DialogTitle>
                  Delete {preview.project.name}? This removes {n(preview.rows_to_delete)} rows.
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-3 text-sm">
                {orphaned > 0 && (
                  <p className="text-muted-foreground">
                    {orphaned} stock movements will be kept but will no longer belong to a job.
                  </p>
                )}
                {collateral > 0 && (
                  <p className="text-destructive">
                    {collateral} scope lines that belong to another project will also be removed.
                  </p>
                )}

                {rows.length > 0 && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border p-3 font-mono text-[11.5px]">
                    {rows.map(([key, label]) => (
                      <div key={key} className="flex justify-between gap-2">
                        <span className="text-muted-foreground">{label}</span>
                        <span>{n(preview.counts?.[key])}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="rounded-md border p-3 space-y-2">
                  <div className="font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground">
                    This project will come back on its own. Here is what to do.
                  </div>
                  <ol className="list-decimal space-y-1 pl-5 text-[12.5px] text-muted-foreground">
                    <li>Open the deal in Zoho CRM.</li>
                    <li>
                      Check the Total Tactiles quote PDF is attached, and that its file name contains
                      "Total Tactiles" or "TT Quote". Remove any other PDF, because if none matches
                      the first attachment is used instead and the wrong document gets read.
                    </li>
                    <li>Check Closing Date is filled.</li>
                    <li>Check Contract Value is filled.</li>
                    <li>Change Stage to "Awarded/Won".</li>
                  </ol>
                  <p className="text-[12.5px] text-muted-foreground">
                    The project rebuilds itself in about a minute. Do not change the Stage again
                    afterwards, it moves itself to PO Received (GRN).
                  </p>
                  <p className="text-[12.5px] text-muted-foreground">
                    The original cost baseline does not come back. The rebuild reads the REVENUE tab
                    as it stands on the day it runs.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground">
                    Reason
                  </label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    placeholder="Why is this project being deleted?"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground">
                    Type {preview.project.name} to confirm
                  </label>
                  <Input value={typed} onChange={(e) => setTyped(e.target.value)} />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" size="sm" onClick={close} disabled={deleting}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={!nameMatches || !reason.trim() || deleting}
                  onClick={confirm}
                >
                  {deleting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Delete permanently
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default DeleteProjectControl;
