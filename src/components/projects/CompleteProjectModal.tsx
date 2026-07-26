import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { postN8nWebhook } from "@/lib/projects/onedrive";
import { formatMetricValue } from "@/lib/formatMetricValue";

// Colour tokens per spec — DO NOT introduce new hexes.
const C_INTERACTIVE = "#3D89DA";
const C_WARN = "#BA7517";
const C_DESTRUCTIVE = "#E24B4A";

interface Props {
  project: {
    id: string;
    name: string;
    zoho_deal_id: string;
  };
  originalContractValue: number | null;
  onClose: () => void;
  onCompleted: () => void;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CompleteProjectModal({
  project,
  originalContractValue,
  onClose,
  onCompleted,
}: Props) {
  const [completionDate, setCompletionDate] = useState<string>(todayIso());
  const [contractValue, setContractValue] = useState<string>(
    originalContractValue != null ? String(originalContractValue) : "",
  );
  const [notes, setNotes] = useState<string>("");
  const [stockReconciled, setStockReconciled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[] | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const today = todayIso();
  const parsedContract = Number(contractValue);
  const contractValid = Number.isFinite(parsedContract) && parsedContract >= 0;
  const contractChanged =
    originalContractValue != null &&
    contractValid &&
    Math.abs(parsedContract - originalContractValue) > 0.005;

  const canSubmit = stockReconciled && !submitting && !!completionDate && contractValid;

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setWarning(null);
    setErrors(null);
    const controller = new AbortController();
    abortRef.current = controller;

    const payload: Record<string, unknown> = {
      project_id: project.id,
      zoho_deal_id: project.zoho_deal_id,
      completion_date: completionDate,
      completion_notes: notes.trim() || null,
      stock_reconciled: true,
    };
    if (contractChanged) payload.final_contract_value = parsedContract;

    try {
      const { status, data } = await postN8nWebhook<any>(
        "/dashboard-complete-project",
        payload,
        {
          dedupeKey: `complete::${project.id}`,
          signal: controller.signal,
        },
      );
      if (status === 400) {
        setErrors(data?.errors ?? [data?.error ?? "Validation failed"]);
        setSubmitting(false);
        return;
      }
      if (data?.ok === false) {
        // Local completion happened server-side but CRM did not update. Keep
        // the modal visible so the user sees the warning; do NOT roll back.
        setWarning(
          data?.warning ??
            "Project completed locally, but the CRM was not updated.",
        );
        setSubmitting(false);
        onCompleted();
        return;
      }
      toast.success("Project completed · CRM updated");
      onCompleted();
      onClose();
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      // Network / server-side failure with no envelope — the server may still
      // have written completed_at; also try a client-side fallback write so the
      // dashboard is not stranded if the webhook is offline.
      try {
        await (supabase as any)
          .from("projects")
          .update({
            completed_at: completionDate,
            completion_notes: notes.trim() || null,
            status: "completed",
          })
          .eq("id", project.id);
        setWarning(
          "Saved locally — Zoho was not reachable. Retry from the deal in Zoho.",
        );
        onCompleted();
      } catch {
        toast.error(e?.message ?? "Complete project failed");
      }
      setSubmitting(false);
    }
  }, [
    canSubmit,
    project.id,
    project.zoho_deal_id,
    completionDate,
    notes,
    contractChanged,
    parsedContract,
    onClose,
    onCompleted,
  ]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && !submitting) onClose();
    },
    [onClose, submitting],
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.72)" }}
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-[520px] rounded-lg border overflow-hidden max-h-[92vh] flex flex-col"
        style={{ borderColor: "#1F2224", background: "#0A0A0A" }}
      >
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: "#1F2224", background: "#0F1113" }}
        >
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-foreground">Complete Project</div>
            <div className="text-[11px] font-mono text-muted-foreground truncate">
              {project.name}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/5 text-muted-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <Field label="Completion Date">
            <input
              type="date"
              value={completionDate}
              max={today}
              onChange={(e) => setCompletionDate(e.target.value)}
              className="w-full h-9 px-2 rounded-md bg-black/40 border text-[13px] outline-none focus:border-primary/50"
              style={{ borderColor: "#1F2224" }}
            />
          </Field>

          <Field label="Final Contract Value">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-mono text-muted-foreground">$</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0}
                value={contractValue}
                onChange={(e) => setContractValue(e.target.value)}
                className="w-full h-9 px-2 rounded-md bg-black/40 border text-[13px] tabular-nums outline-none focus:border-primary/50"
                style={{ borderColor: "#1F2224" }}
              />
            </div>
            <div className="mt-1 text-[10.5px] text-muted-foreground font-mono">
              Edit only if a variation changed the contract value.
            </div>
            {contractChanged && originalContractValue != null && (
              <div
                className="mt-1 text-[10.5px] font-mono"
                style={{ color: C_WARN }}
              >
                Changed from {formatMetricValue(originalContractValue, "currency")}
              </div>
            )}
          </Field>

          <Field label="Completion Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional"
              className="w-full px-2 py-2 rounded-md bg-black/40 border text-[13px] outline-none focus:border-primary/50 resize-none"
              style={{ borderColor: "#1F2224" }}
            />
          </Field>

          <label
            className="flex items-start gap-2.5 cursor-pointer select-none rounded-md border p-3"
            style={{ borderColor: "#1F2224", background: "#0F1113" }}
          >
            <input
              type="checkbox"
              checked={stockReconciled}
              onChange={(e) => setStockReconciled(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#3D89DA]"
            />
            <span className="text-[12px] text-foreground/90 leading-snug">
              Leftover stock has been returned to inventory on the Stock
              Reconciliation task.
            </span>
          </label>

          {errors && errors.length > 0 && (
            <div
              className="rounded-md border px-3 py-2 text-[11.5px] font-mono"
              style={{ borderColor: C_DESTRUCTIVE, color: C_DESTRUCTIVE, background: "rgba(226,75,74,0.08)" }}
            >
              {errors.map((e, i) => (
                <div key={i}>· {e}</div>
              ))}
            </div>
          )}

          {warning && (
            <div
              className="rounded-md border px-3 py-2 text-[11.5px] font-mono"
              style={{ borderColor: C_WARN, color: C_WARN, background: "rgba(186,117,23,0.08)" }}
            >
              {warning}
            </div>
          )}
        </div>

        <div
          className="flex items-center justify-end gap-2 px-4 py-3 border-t"
          style={{ borderColor: "#1F2224", background: "#0B0C0F" }}
        >
          <button
            onClick={onClose}
            disabled={submitting}
            className="h-9 px-3 rounded-md text-[12px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="h-9 px-4 rounded-md text-[12px] font-mono uppercase tracking-widest text-white inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: C_INTERACTIVE }}
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Complete Project
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
        {label}
      </div>
      {children}
    </div>
  );
}
