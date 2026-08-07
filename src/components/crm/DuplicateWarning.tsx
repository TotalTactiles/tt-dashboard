import { AlertCircle, AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

export interface SimilarLead {
  id: string;
  project_name: string | null;
  company_builder: string | null;
  stage: string;
  score: number;
  exact_project: boolean;
  same_company: boolean;
}

export type DupState =
  | { kind: "none" }
  | { kind: "exact_live"; row: SimilarLead }
  | { kind: "exact_archived"; row: SimilarLead }
  | { kind: "similar"; rows: SimilarLead[] };

export function classifyDuplicates(rows: SimilarLead[]): DupState {
  // A matching project name only counts as "this project" when it belongs to the
  // same builder: two builders can each legitimately have a project called "Stage 2".
  const exactLive = rows.find((r) => r.exact_project && r.same_company && r.stage !== "archived");
  if (exactLive) return { kind: "exact_live", row: exactLive };
  const exactArch = rows.find((r) => r.exact_project && r.same_company && r.stage === "archived");
  if (exactArch) return { kind: "exact_archived", row: exactArch };
  // No same-builder exact match exists by this point, so any remaining exact-name row
  // belongs to a different builder and should be confirmable rather than hidden.
  const similar = rows.filter((r) => r.score >= 0.55).slice(0, 3);
  if (similar.length) return { kind: "similar", rows: similar };
  return { kind: "none" };
}

export default function DuplicateWarning({
  state, confirmed, onConfirm, onOpen,
}: {
  state: DupState;
  confirmed: boolean;
  onConfirm: (v: boolean) => void;
  onOpen: (id: string) => void;
}) {
  if (state.kind === "none") return null;

  if (state.kind === "exact_live") {
    const r = state.row;
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 space-y-2">
        <div className="flex items-center gap-2 text-destructive text-sm font-semibold">
          <AlertCircle className="w-4 h-4" /> This project already exists
        </div>
        <div className="text-sm flex items-center gap-2">
          <span className="font-medium">{r.project_name}</span>
          <span className="text-muted-foreground">· {r.company_builder}</span>
          <span className="text-[10px] font-mono uppercase text-muted-foreground">· {r.stage.replace(/_/g, " ")}</span>
          <button type="button" onClick={() => onOpen(r.id)} className="ml-auto text-xs underline text-destructive">
            Open that lead
          </button>
        </div>
      </div>
    );
  }

  if (state.kind === "exact_archived") {
    const r = state.row;
    return (
      <div className="rounded-md border border-chart-orange/40 bg-chart-orange/10 p-3 space-y-2">
        <div className="flex items-center gap-2 text-chart-orange text-sm font-semibold">
          <AlertTriangle className="w-4 h-4" /> This project was worked before
        </div>
        <div className="text-sm flex items-center gap-2">
          <span className="font-medium">{r.project_name}</span>
          <span className="text-muted-foreground">· {r.company_builder}</span>
          <span className="text-[10px] font-mono uppercase text-muted-foreground">· archived</span>
          <button type="button" onClick={() => onOpen(r.id)} className="ml-auto text-xs underline text-chart-orange">
            Open that lead
          </button>
        </div>
        <div className="text-xs text-muted-foreground">
          A project can legitimately return. Tick to confirm this is a new opportunity.
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={confirmed} onCheckedChange={(v) => onConfirm(!!v)} />
          Confirmed — create as a new lead
        </label>
      </div>
    );
  }

  // similar
  return (
    <div className="rounded-md border border-chart-orange/40 bg-chart-orange/10 p-3 space-y-2">
      <div className="flex items-center gap-2 text-chart-orange text-sm font-semibold">
        <AlertTriangle className="w-4 h-4" /> Similar project names already exist
      </div>
      <ul className="space-y-1">
        {state.rows.map((r) => (
          <li key={r.id} className="text-sm flex items-center gap-2">
            <span className="font-medium">{r.project_name}</span>
            <span className="text-muted-foreground">· {r.company_builder}</span>
            <span className="text-[10px] font-mono text-muted-foreground">· {r.score.toFixed(2)}</span>
            {r.same_company && (
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-chart-orange/20 text-chart-orange border border-chart-orange/40">
                same builder
              </span>
            )}
            <button type="button" onClick={() => onOpen(r.id)} className="ml-auto text-xs underline text-chart-orange">
              view
            </button>
          </li>
        ))}
      </ul>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <Checkbox checked={confirmed} onCheckedChange={(v) => onConfirm(!!v)} />
        Confirmed — this is a different project
      </label>
    </div>
  );
}
