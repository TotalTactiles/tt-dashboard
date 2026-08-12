import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export const CRM_OPERATOR_KEY = "tt_crm_operator";

export interface CrmOperator {
  handle: string;
  display_name: string;
}

/**
 * Single producer of the operator list. Anything that needs to know who can
 * work the CRM reads it from here, never from a hardcoded array.
 */
export async function fetchOperators(): Promise<CrmOperator[]> {
  const { data, error } = await db
    .from("app_users")
    .select("handle, display_name, is_active")
    .eq("is_active", true)
    .order("display_name", { ascending: true });
  if (error) throw new Error(error.message || "The operator list could not be loaded.");
  return ((data as any[]) ?? []).map((r) => ({
    handle: String(r.handle ?? "").trim().toLowerCase(),
    display_name: String(r.display_name ?? r.handle ?? "").trim(),
  })).filter((o) => o.handle);
}

export function useOperators() {
  const [operators, setOperators] = useState<CrmOperator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError(null);
    fetchOperators()
      .then((rows) => { if (!cancel) setOperators(rows); })
      .catch((e: any) => { if (!cancel) { setOperators([]); setError(e?.message || "The operator list could not be loaded."); } })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { operators, loading, error, reload };
}

/**
 * Synchronous by design: callers read this during render. It lowercases and
 * trims so a value stored before this change ("Krishan") resolves to the
 * handle ("krishan"), mirroring tt_lead_gate server side.
 */
export function getStoredOperator(): string | null {
  try {
    const v = localStorage.getItem(CRM_OPERATOR_KEY);
    const norm = (v ?? "").trim().toLowerCase();
    if (!norm) return null;
    return norm;
  } catch { return null; }
}

export function setStoredOperator(handle: string | null) {
  try {
    const norm = (handle ?? "").trim().toLowerCase();
    if (norm) localStorage.setItem(CRM_OPERATOR_KEY, norm);
    else localStorage.removeItem(CRM_OPERATOR_KEY);
  } catch {}
}

export function OperatorPicker({
  onChoose,
  compact = false,
}: {
  onChoose: (handle: string) => void;
  compact?: boolean;
}) {
  const { operators, loading, error, reload } = useOperators();

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> loading the operator list
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        <div>The operator list could not be loaded.</div>
        <div className="mt-1 text-xs text-muted-foreground/80">{error}</div>
        <Button variant="outline" size="sm" className="mt-3" onClick={reload}>
          Try again
        </Button>
      </div>
    );
  }

  if (operators.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        <div>There are no active users to pick from.</div>
        <div className="mt-1 text-xs text-muted-foreground/80">
          Someone has to be marked active before the CRM can attribute activity.
        </div>
        <Button variant="outline" size="sm" className="mt-3" onClick={reload}>
          Reload
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {operators.map((o) => (
        <Button
          key={o.handle}
          variant="outline"
          className={compact ? "h-10" : "h-12 text-base"}
          onClick={() => { setStoredOperator(o.handle); onChoose(o.handle); }}
        >
          {o.display_name}
        </Button>
      ))}
    </div>
  );
}

export default function WorkingAsGate({ onChoose }: { onChoose: (handle: string) => void }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <Card className="w-full max-w-md p-8">
        <h2 className="text-lg font-mono uppercase tracking-wider text-center mb-1">Who's working?</h2>
        <p className="text-xs text-muted-foreground text-center mb-6">
          Sales inbox is shared. Pick your name so activity is attributed correctly.
        </p>
        <OperatorPicker onChoose={onChoose} />
      </Card>
    </div>
  );
}
