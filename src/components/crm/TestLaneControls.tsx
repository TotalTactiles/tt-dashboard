import { useCallback, useEffect, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const db = supabase as any;

interface CleanupEntry {
  external_id: string;
  test_number?: number | null;
  company?: string | null;
  project?: string | null;
  gmail_message_id?: string | null;
  sent_to?: string | null;
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
      <div className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-mono text-foreground tabular-nums">{value}</div>
    </div>
  );
}

export default function TestLaneControls({
  onResetComplete,
}: {
  onResetComplete: () => void;
}) {
  const [leadsInLane, setLeadsInLane] = useState<number | null>(null);
  const [snapshotsHeld, setSnapshotsHeld] = useState<number | null>(null);
  const [lastReset, setLastReset] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cleanup, setCleanup] = useState<CleanupEntry[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  const loadCounts = useCallback(async () => {
    const [cases, restore] = await Promise.all([
      db.from("oven_test_cases").select("lead_id", { count: "exact", head: true }),
      db.from("oven_test_restore").select("lead_id", { count: "exact", head: true }),
    ]);
    setLeadsInLane(cases.count ?? 0);
    setSnapshotsHeld(restore.count ?? 0);
  }, []);

  useEffect(() => { loadCounts(); }, [loadCounts]);

  async function runReset() {
    setBusy(true);
    const { data, error } = await db.rpc("tt_oven_test_reset");
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const res = (data ?? {}) as any;
    if (res.ok === false) {
      toast.error(res.message ?? "Reset refused");
      return;
    }
    setLastReset(res.reset_at ?? new Date().toISOString());
    setWarnings(Array.isArray(res.warnings) ? res.warnings.map((w: any) => String(w)) : []);
    setCleanup(Array.isArray(res.manual_cleanup) ? (res.manual_cleanup as CleanupEntry[]) : []);
    toast.success(`Test lane reset. ${res.leads_reset ?? 0} leads restored.`);
    await loadCounts();
    onResetComplete();
  }

  async function forgetDraft(entry: CleanupEntry) {
    const { error } = await db.rpc("tt_oven_test_forget_draft", { p_external_id: entry.external_id });
    if (error) {
      toast.error(error.message);
      return;
    }
    setCleanup((prev) => prev.filter((e) => e.external_id !== entry.external_id));
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2 flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-mono uppercase tracking-wide">Test lane</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              6 borrowed leads, one per route. Reset returns every one to the state it was in before the lane borrowed it.
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" disabled={busy} className="shrink-0">
                {busy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5 mr-1.5" />}
                Reset test lane
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset the test lane?</AlertDialogTitle>
                <AlertDialogDescription>
                  Every borrowed lead goes back to the state it was in before the lane took it. Work done in the lane is discarded.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={runReset}>Reset test lane</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <Tile label="Leads in lane" value={leadsInLane == null ? "-" : String(leadsInLane)} />
          <Tile label="Snapshots held" value={snapshotsHeld == null ? "-" : String(snapshotsHeld)} />
          <Tile label="Last reset" value={lastReset ? new Date(lastReset).toLocaleString() : "not this session"} />
        </CardContent>
      </Card>

      {cleanup.length > 0 && (
        <Card className="border-chart-orange/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase tracking-wide">Delete these by hand</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Reset owns the database. Gmail and Zoho are outside it, so these are yours to clear.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {cleanup.map((entry) => (
              <div
                key={entry.external_id}
                className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/10 px-3 py-2"
              >
                <Badge variant="outline" className="font-mono">{entry.test_number ?? "-"}</Badge>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-foreground truncate">{entry.company ?? "-"}</div>
                  <div className="text-xs text-muted-foreground truncate">{entry.project ?? "-"}</div>
                  <div className="mt-0.5 text-[11px] font-mono text-muted-foreground break-all">
                    {entry.gmail_message_id ?? "no message id"} - {entry.sent_to ?? "no recipient"}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => forgetDraft(entry)}>
                  Deleted it
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {warnings.length > 0 && (
        <div className="space-y-1">
          {warnings.map((w, i) => (
            <p key={i} className="text-xs font-mono text-muted-foreground">{w}</p>
          ))}
        </div>
      )}
    </div>
  );
}
