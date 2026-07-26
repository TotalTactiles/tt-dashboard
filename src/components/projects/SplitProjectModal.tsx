import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { X, Loader2, ExternalLink } from "lucide-react";
import { postN8nWebhook } from "@/lib/projects/onedrive";
import { formatMetricValue } from "@/lib/formatMetricValue";

const C_INTERACTIVE = "#3D89DA";
const C_DESTRUCTIVE = "#E24B4A";

interface Props {
  project: {
    id: string;
    name: string;
    zoho_deal_id: string;
  };
  contractValue: number | null;
  onClose: () => void;
}

// MUST stay identical to the regex used by Stage Split Engine and the OneDrive
// path builder. Do NOT loosen this without updating both.
function parseStage(name: string): { base: string; stage: number } {
  const m = name.match(/^(.*?)[\u2013\u2014-]\s*S(\d+)\s*$/i);
  return m ? { base: m[1].trim(), stage: parseInt(m[2], 10) } : { base: name.trim(), stage: 1 };
}

export function SplitProjectModal({ project, contractValue, onClose }: Props) {
  const { base, stage: currentStage } = useMemo(() => parseStage(project.name), [project.name]);
  const stageOptions = useMemo(() => {
    const opts: number[] = [];
    for (let s = currentStage + 1; s <= 5; s += 1) opts.push(s);
    return opts;
  }, [currentStage]);

  const [targetStage, setTargetStage] = useState<number>(stageOptions[0] ?? currentStage + 1);
  const [thisStageValue, setThisStageValue] = useState<string>(
    contractValue != null ? String(contractValue) : "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[] | null>(null);
  const [result, setResult] = useState<
    | {
        expected_current_name: string;
        expected_clone_name: string;
        crm_link: string | null;
      }
    | null
  >(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const parsed = Number(thisStageValue);
  const contractOk = contractValue != null && contractValue > 0;
  const valid =
    Number.isFinite(parsed) && parsed > 0 && (contractOk ? parsed <= (contractValue as number) : true);
  const exceeded = contractOk && Number.isFinite(parsed) && parsed > (contractValue as number);
  const remainder = contractOk && valid ? (contractValue as number) - parsed : null;

  const submit = useCallback(async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setErrors(null);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { status, data } = await postN8nWebhook<any>(
        "/dashboard-split-project",
        {
          project_id: project.id,
          zoho_deal_id: project.zoho_deal_id,
          current_stage: currentStage,
          target_stage: targetStage,
          this_stage_value: parsed,
        },
        {
          dedupeKey: `split::${project.id}::${targetStage}::${parsed}`,
          signal: controller.signal,
        },
      );
      if (status === 400) {
        setErrors(data?.errors ?? [data?.error ?? "Validation failed"]);
        setSubmitting(false);
        return;
      }
      setResult({
        expected_current_name:
          data?.expected_current_name ?? `${base} — S${currentStage}`,
        expected_clone_name:
          data?.expected_clone_name ?? `${base} — S${targetStage}`,
        crm_link: data?.crm_link ?? null,
      });
      setSubmitting(false);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      toast.error(e?.message ?? "Split request failed");
      setSubmitting(false);
    }
  }, [valid, submitting, project.id, project.zoho_deal_id, currentStage, targetStage, parsed, base]);

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
            <div className="text-[15px] font-semibold text-foreground">
              Split Project into Stages
            </div>
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
          {result ? (
            <div className="space-y-3">
              <div className="text-[13px] font-semibold text-foreground">Split requested</div>
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                Stage Split Engine runs every 10 minutes. It will rename this
                project to{" "}
                <span className="font-mono text-foreground">
                  {result.expected_current_name}
                </span>{" "}
                and create{" "}
                <span className="font-mono text-foreground">
                  {result.expected_clone_name}
                </span>{" "}
                in Zoho CRM. Once the new deal exists, paste its scope of works
                and move it to <em>Awarded</em> to start its project
                automations.
              </p>
              {result.crm_link && (
                <a
                  href={result.crm_link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[12px] font-mono"
                  style={{ color: C_INTERACTIVE }}
                >
                  Open in Zoho CRM
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          ) : (
            <>
              <Field label="New Stage">
                {stageOptions.length === 0 ? (
                  <div className="text-[12px] text-muted-foreground">
                    Already at S{currentStage} — no further splits available.
                  </div>
                ) : (
                  <select
                    value={targetStage}
                    onChange={(e) => setTargetStage(parseInt(e.target.value, 10))}
                    className="w-full h-9 px-2 rounded-md bg-black/40 border text-[13px] outline-none focus:border-primary/50"
                    style={{ borderColor: "#1F2224" }}
                  >
                    {stageOptions.map((s) => (
                      <option key={s} value={s}>
                        Stage {s}
                      </option>
                    ))}
                  </select>
                )}
              </Field>

              <Field label="This Stage's Value">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-mono text-muted-foreground">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min={0}
                    value={thisStageValue}
                    onChange={(e) => setThisStageValue(e.target.value)}
                    className="w-full h-9 px-2 rounded-md bg-black/40 border text-[13px] tabular-nums outline-none focus:border-primary/50"
                    style={{ borderColor: "#1F2224" }}
                  />
                </div>
                {exceeded && (
                  <div
                    className="mt-1 text-[10.5px] font-mono"
                    style={{ color: C_DESTRUCTIVE }}
                  >
                    Cannot exceed the current contract value.
                  </div>
                )}
              </Field>

              <div
                className="rounded-md border p-3 space-y-1 font-mono text-[12px] tabular-nums"
                style={{ borderColor: "#1F2224", background: "#0F1113" }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Stage {currentStage}
                  </span>
                  <span className="text-foreground">
                    {Number.isFinite(parsed) && parsed > 0
                      ? formatMetricValue(parsed, "currency")
                      : "—"}
                    <span className="ml-2 text-[10px] text-muted-foreground">
                      ← this project keeps
                    </span>
                  </span>
                </div>
                <div
                  className="flex items-center justify-between"
                  style={{ opacity: 0.45 }}
                >
                  <span>Stage {targetStage}</span>
                  <span>
                    {remainder != null
                      ? formatMetricValue(remainder, "currency")
                      : "—"}
                    <span className="ml-2 text-[10px]">
                      ← the new deal receives
                    </span>
                  </span>
                </div>
                <div
                  className="pt-1 text-[10px]"
                  style={{ color: "rgba(229,233,234,0.45)" }}
                >
                  Indicative. The exact split is derived in Zoho from the
                  original contract total.
                </div>
              </div>

              {errors && errors.length > 0 && (
                <div
                  className="rounded-md border px-3 py-2 text-[11.5px] font-mono"
                  style={{
                    borderColor: C_DESTRUCTIVE,
                    color: C_DESTRUCTIVE,
                    background: "rgba(226,75,74,0.08)",
                  }}
                >
                  {errors.map((e, i) => (
                    <div key={i}>· {e}</div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div
          className="flex items-center justify-end gap-2 px-4 py-3 border-t"
          style={{ borderColor: "#1F2224", background: "#0B0C0F" }}
        >
          {result ? (
            <button
              onClick={onClose}
              className="h-9 px-4 rounded-md text-[12px] font-mono uppercase tracking-widest text-white"
              style={{ background: C_INTERACTIVE }}
            >
              Done
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={submitting}
                className="h-9 px-3 rounded-md text-[12px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={!valid || submitting || stageOptions.length === 0}
                className="h-9 px-4 rounded-md text-[12px] font-mono uppercase tracking-widest text-white inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: C_INTERACTIVE }}
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Request Split
              </button>
            </>
          )}
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
