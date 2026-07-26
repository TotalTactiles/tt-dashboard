import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { X, Loader2, ExternalLink } from "lucide-react";
import { postN8nWebhook } from "@/lib/projects/onedrive";
import { supabase } from "@/integrations/supabase/client";

const C_INTERACTIVE = "#3D89DA";
const C_WARNING = "#BA7517";
const C_DESTRUCTIVE = "#E24B4A";

interface Props {
  project: {
    id: string;
    name: string;
    zoho_deal_id: string;
  };
  onClose: () => void;
}

// MUST stay identical to the regex used by the n8n workflows and OneDrive
// path builder. Strips a trailing stage OR variation suffix.
function parseBase(name: string): string {
  const m = name.match(/^(.*?)[\u2013\u2014-]\s*([SV]\d+)\s*$/i);
  return m ? m[1].trim() : name.trim();
}

const db = supabase as any;

export function VariationModal({ project, onClose }: Props) {
  const base = useMemo(() => parseBase(project.name), [project.name]);
  const [nextV, setNextV] = useState<number>(1);
  const [value, setValue] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[] | null>(null);
  const [result, setResult] = useState<
    | { new_deal_name: string; crm_link: string | null }
    | null
  >(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  // Compute next variation number by scanning sibling projects sharing the
  // same base name. Match `- V{n}` at the end (any dash style).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await db
        .from("projects")
        .select("name")
        .ilike("name", `${base}%`);
      if (cancelled) return;
      let max = 0;
      for (const r of (data as Array<{ name: string }>) ?? []) {
        const m = r.name?.match(/[\u2013\u2014-]\s*V(\d+)\s*$/i);
        if (m) {
          const n = parseInt(m[1], 10);
          if (Number.isFinite(n) && n > max) max = n;
        }
      }
      setNextV(max + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [base]);

  const parsed = Number(value);
  const valueOk = Number.isFinite(parsed) && parsed > 0;
  const descOk = description.trim().length > 0;
  const valid = valueOk && descOk;
  const newDealName = `${base} - V${nextV}`;

  const submit = useCallback(async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setErrors(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const { status, data } = await postN8nWebhook<any>(
        "/dashboard-variation",
        {
          project_id: project.id,
          zoho_deal_id: project.zoho_deal_id,
          base_name: base,
          variation_number: nextV,
          variation_value: parsed,
          description: description.trim(),
        },
        {
          dedupeKey: `variation::${project.id}::${nextV}::${parsed}`,
          signal: controller.signal,
        },
      );
      if (status === 400) {
        setErrors(data?.errors ?? [data?.error ?? "Validation failed"]);
        setSubmitting(false);
        return;
      }
      setResult({
        new_deal_name: data?.new_deal_name ?? newDealName,
        crm_link: data?.crm_link ?? null,
      });
      setSubmitting(false);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      toast.error(e?.message ?? "Variation request failed");
      setSubmitting(false);
    }
  }, [valid, submitting, project.id, project.zoho_deal_id, base, nextV, parsed, description, newDealName]);

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
              Raise a Variation
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
              <div className="text-[13px] font-semibold text-foreground">
                Variation created
              </div>
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                <span className="font-mono text-foreground">
                  {result.new_deal_name}
                </span>{" "}
                now exists in Zoho CRM. Paste its scope of works and move it to{" "}
                <em>Awarded</em> to start its project automations.
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
              <Field label="Variation Value">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-mono text-muted-foreground">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min={0}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="w-full h-9 px-2 rounded-md bg-black/40 border text-[13px] tabular-nums outline-none focus:border-primary/50"
                    style={{ borderColor: "#1F2224" }}
                  />
                </div>
              </Field>

              <Field label="Description">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="What does this variation cover?"
                  className="w-full px-2 py-2 rounded-md bg-black/40 border text-[13px] outline-none focus:border-primary/50 resize-y"
                  style={{ borderColor: "#1F2224" }}
                />
              </Field>

              <div
                className="rounded-md border px-3 py-2 font-mono text-[12px]"
                style={{ borderColor: "#1F2224", background: "#0F1113" }}
              >
                <span className="text-muted-foreground">New deal: </span>
                <span className="text-foreground">{newDealName}</span>
              </div>

              <div
                className="text-[10px] font-mono leading-relaxed"
                style={{ color: C_WARNING }}
              >
                A variation creates a new deal. It adds to the job total — it
                does not change this project's contract value.
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
                disabled={!valid || submitting}
                className="h-9 px-4 rounded-md text-[12px] font-mono uppercase tracking-widest text-white inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: C_INTERACTIVE }}
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Raise Variation
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
